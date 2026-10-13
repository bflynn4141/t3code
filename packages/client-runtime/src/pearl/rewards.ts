import {
  pearlModelForSlug,
  type OrchestrationV2ThreadProjection,
  type PearlModel,
  type PearlNetworkStats,
  type RunId,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";

/**
 * Estimates the PRL a Pearl turn earned.
 *
 * Pearl mints PRL for matrix multiplication, so the estimate follows the math:
 *   1. A model does about 2 × activeParams operations per token it computes.
 *      Cached input is read back from the KV cache and skips that math, so only
 *      fresh input and output count. Agent turns resend their whole context on
 *      every step, which makes this distinction large.
 *   2. The network mints blockReward every blockTime, shared across its hashrate.
 *      Pearl does not publish hashes per operation, so it is calibrated on a
 *      reference GPU: mining hashrate over the operations per second it sustains.
 *   3. USER_SHARE is the part of that value passed back to the person prompting.
 *
 * This counts only the work the turn itself caused. It ignores attention math
 * and any mining the GPU does while idle, so it is a floor, not a promise.
 */
export const PEARL_CALIBRATION = {
  gpu: "NVIDIA H100 SXM",
  /** Mining hashrate in H/s: ~1.5× WhatToMine's 204 TH/s reference card. */
  gpuHashrate: 300e12,
  /** Dense INT8 peak (1,979 TOPS) at 70% utilization; Pearl mines on W7A7 integer math. */
  gpuOperationsPerSecond: 1979e12 * 0.7,
} as const;

/** Share of the mined value passed back to the user. An open product decision. */
export const PEARL_USER_SHARE = 1;

/** Display unit: a grain is one millionth of a PRL, and a real unit for weighing pearls. */
export const GRAINS_PER_PRL = 1_000_000;

export interface PearlUsage {
  /** Includes cache reads and writes, matching `TurnTokenUsage`. */
  readonly inputTokens: number;
  readonly cachedInputTokens: number;
  readonly outputTokens: number;
}

export interface PearlReward {
  readonly model: PearlModel;
  readonly usage: PearlUsage;
  readonly operations: number;
  readonly prl: number;
  readonly grains: number;
  readonly usd: number;
  readonly costUsd: number;
  /** Reward value as a share of what the turn cost. */
  readonly backRate: number;
  /** False when a provider turn reported partial usage, so the totals are a lower bound. */
  readonly complete: boolean;
}

export function prlPerOperation(network: PearlNetworkStats): number {
  const networkPrlPerSecond = network.blockRewardPrl / network.blockTimeSeconds;
  const hashesPerOperation =
    PEARL_CALIBRATION.gpuHashrate / PEARL_CALIBRATION.gpuOperationsPerSecond;
  return (networkPrlPerSecond * hashesPerOperation) / network.networkHashrate;
}

export function pearlCostUsd(model: PearlModel, usage: PearlUsage): number {
  const freshInput = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  return (
    (freshInput * model.price.input +
      usage.cachedInputTokens * model.price.cachedInput +
      usage.outputTokens * model.price.output) /
    1e6
  );
}

export function estimatePearlReward(
  model: PearlModel,
  usage: PearlUsage,
  network: PearlNetworkStats,
  complete = true,
): PearlReward {
  const computedTokens =
    Math.max(0, usage.inputTokens - usage.cachedInputTokens) + usage.outputTokens;
  const operations = 2 * model.activeParams * computedTokens;
  const prl = operations * prlPerOperation(network) * PEARL_USER_SHARE;
  const usd = prl * network.prlUsd;
  const costUsd = pearlCostUsd(model, usage);
  return {
    model,
    usage,
    operations,
    prl,
    grains: prl * GRAINS_PER_PRL,
    usd,
    costUsd,
    backRate: costUsd > 0 ? usd / costUsd : 0,
    complete,
  };
}

export interface PearlRunReward extends PearlReward {
  /** Wall time from the run starting to finishing, when both are known. */
  readonly durationMs: number | null;
}

type RewardProjection = Pick<
  OrchestrationV2ThreadProjection,
  "runs" | "attempts" | "providerTurns"
>;

/**
 * Rewards for every finished Pearl run in a thread, keyed by run. A run can span
 * several attempts (retries, steering restarts), and each attempt's provider
 * turns did real work, so their usage is summed.
 */
export function pearlRewardsByRun(
  projection: RewardProjection,
  network: PearlNetworkStats,
): ReadonlyMap<RunId, PearlRunReward> {
  const rewards = new Map<RunId, PearlRunReward>();
  const pearlRuns = new Map<RunId, { model: PearlModel; durationMs: number | null }>();
  for (const run of projection.runs) {
    const model = pearlModelForSlug(run.modelSelection.model);
    if (!model) continue;
    const durationMs =
      run.startedAt && run.completedAt
        ? DateTime.toEpochMillis(run.completedAt) - DateTime.toEpochMillis(run.startedAt)
        : null;
    pearlRuns.set(run.id, { model, durationMs });
  }
  if (pearlRuns.size === 0) return rewards;

  const runByAttempt = new Map<string, RunId>();
  for (const attempt of projection.attempts) {
    if (pearlRuns.has(attempt.runId)) runByAttempt.set(attempt.id, attempt.runId);
  }

  const totals = new Map<
    RunId,
    { input: number; cached: number; output: number; complete: boolean }
  >();
  for (const turn of projection.providerTurns) {
    const runId = turn.runAttemptId === null ? undefined : runByAttempt.get(turn.runAttemptId);
    const usage = turn.turnTokenUsage;
    if (runId === undefined || usage === undefined || usage.usageStatus === "unavailable") continue;
    const total = totals.get(runId) ?? { input: 0, cached: 0, output: 0, complete: true };
    total.input += usage.inputTokens ?? 0;
    total.cached += usage.cachedInputTokens ?? 0;
    total.output += usage.outputTokens ?? 0;
    total.complete &&= usage.usageStatus === "complete";
    totals.set(runId, total);
  }

  for (const [runId, total] of totals) {
    const run = pearlRuns.get(runId);
    if (!run) continue;
    rewards.set(runId, {
      ...estimatePearlReward(
        run.model,
        { inputTokens: total.input, cachedInputTokens: total.cached, outputTokens: total.output },
        network,
        total.complete,
      ),
      durationMs: run.durationMs,
    });
  }
  return rewards;
}

export function formatGrains(grains: number): string {
  if (grains >= 1_000_000) return `${(grains / 1_000_000).toFixed(2)}M`;
  if (grains >= 10_000) return `${(grains / 1000).toFixed(1)}k`;
  if (grains >= 100) return Math.round(grains).toLocaleString("en-US");
  if (grains >= 10) return grains.toFixed(1);
  return grains.toFixed(2);
}

/** Dollars, with enough digits that tiny amounts don't read as zero. */
export function formatSmallUsd(usd: number): string {
  if (usd <= 0) return "$0";
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(Math.min(10, Math.ceil(-Math.log10(usd)) + 1))}`;
}

export function formatPrl(prl: number): string {
  if (prl <= 0) return "0 PRL";
  if (prl >= 1) return `${prl.toFixed(3)} PRL`;
  return `${prl.toFixed(Math.min(12, Math.ceil(-Math.log10(prl)) + 1))} PRL`;
}

export function formatBackRate(rate: number): string {
  const percent = rate * 100;
  return `${percent >= 10 ? percent.toFixed(0) : percent >= 1 ? percent.toFixed(1) : percent.toFixed(2)}%`;
}

/** 8.1e13 → "81 trillion" */
export function formatOperations(operations: number): string {
  const units: ReadonlyArray<readonly [number, string]> = [
    [1e18, "quintillion"],
    [1e15, "quadrillion"],
    [1e12, "trillion"],
    [1e9, "billion"],
    [1e6, "million"],
  ];
  for (const [size, name] of units) {
    if (operations >= size) {
      const value = operations / size;
      return `${value >= 10 ? Math.round(value) : value.toFixed(1)} ${name}`;
    }
  }
  return Math.round(operations).toLocaleString("en-US");
}

export function formatDuration(ms: number): string {
  if (ms < 10_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

/** Hashes per second → "52.3 EH/s" */
export function formatHashrate(hashesPerSecond: number): string {
  if (hashesPerSecond >= 1e18) return `${(hashesPerSecond / 1e18).toFixed(1)} EH/s`;
  if (hashesPerSecond >= 1e15) return `${(hashesPerSecond / 1e15).toFixed(1)} PH/s`;
  return `${(hashesPerSecond / 1e12).toFixed(1)} TH/s`;
}
