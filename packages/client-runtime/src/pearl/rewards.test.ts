import { PEARL_NETWORK_SNAPSHOT, pearlModelForSlug } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  estimatePearlReward,
  pearlCostUsd,
  pearlRewardsByRun,
  prlPerOperation,
} from "./rewards.ts";

const glm = pearlModelForSlug("pearl/zai-org/GLM-5.3")!;
const gemma = pearlModelForSlug("pearl/google/gemma-4-31B-it")!;
const chatTurn = { inputTokens: 500, cachedInputTokens: 0, outputTokens: 800 };

describe("pearlModelForSlug", () => {
  it("recognizes only Pearl slugs", () => {
    expect(glm.name).toBe("GLM-5.3");
    expect(pearlModelForSlug("openai/gpt-5")).toBeUndefined();
    expect(pearlModelForSlug("zai-org/GLM-5.3")).toBeUndefined();
  });
});

describe("estimatePearlReward", () => {
  it("prices fresh input, cached input and output at their own rates", () => {
    const usage = { inputTokens: 1500, cachedInputTokens: 1000, outputTokens: 800 };
    expect(pearlCostUsd(glm, usage)).toBeCloseTo((500 * 1.1 + 1000 * 0.23 + 800 * 3.5) / 1e6, 12);
  });

  it("counts no mining work for cached input", () => {
    const fresh = estimatePearlReward(glm, chatTurn, PEARL_NETWORK_SNAPSHOT);
    const withCache = estimatePearlReward(
      glm,
      { inputTokens: 100_500, cachedInputTokens: 100_000, outputTokens: 800 },
      PEARL_NETWORK_SNAPSHOT,
    );
    expect(withCache.operations).toBe(fresh.operations);
    expect(fresh.operations).toBe(2 * 40e9 * 1300);
  });

  it("lands in a few grains for an ordinary chat turn", () => {
    const reward = estimatePearlReward(glm, chatTurn, PEARL_NETWORK_SNAPSHOT);
    expect(reward.grains).toBeGreaterThan(2);
    expect(reward.grains).toBeLessThan(10);
    expect(reward.backRate).toBeLessThan(0.01);
  });

  it("halves when the network hashrate doubles", () => {
    const busier = {
      ...PEARL_NETWORK_SNAPSHOT,
      networkHashrate: PEARL_NETWORK_SNAPSHOT.networkHashrate * 2,
    };
    expect(prlPerOperation(busier) / prlPerOperation(PEARL_NETWORK_SNAPSHOT)).toBeCloseTo(0.5, 12);
  });

  it("pays back more per dollar on cheap dense models", () => {
    expect(estimatePearlReward(gemma, chatTurn, PEARL_NETWORK_SNAPSHOT).backRate).toBeGreaterThan(
      estimatePearlReward(glm, chatTurn, PEARL_NETWORK_SNAPSHOT).backRate,
    );
  });
});

describe("pearlRewardsByRun", () => {
  const run = (id: string, model: string) =>
    ({ id, modelSelection: { instanceId: "pearl", model } }) as never;
  const attempt = (id: string, runId: string) => ({ id, runId }) as never;
  const turn = (runAttemptId: string, usage: object) =>
    ({
      runAttemptId,
      turnTokenUsage: { usageScope: "main_agent", hasSubagents: false, ...usage },
    }) as never;

  it("sums usage across a run's attempts and ignores other providers", () => {
    const rewards = pearlRewardsByRun(
      {
        runs: [run("r1", "pearl/zai-org/GLM-5.3"), run("r2", "openai/gpt-5")],
        attempts: [attempt("a1", "r1"), attempt("a2", "r1"), attempt("a3", "r2")],
        providerTurns: [
          turn("a1", { usageStatus: "complete", inputTokens: 300, outputTokens: 100 }),
          turn("a2", { usageStatus: "partial", inputTokens: 200, outputTokens: 700 }),
          turn("a3", { usageStatus: "complete", inputTokens: 9999, outputTokens: 9999 }),
        ],
      },
      PEARL_NETWORK_SNAPSHOT,
    );
    expect([...rewards.keys()]).toEqual(["r1"]);
    const reward = rewards.get("r1" as never)!;
    expect(reward.usage).toEqual({ inputTokens: 500, cachedInputTokens: 0, outputTokens: 800 });
    expect(reward.complete).toBe(false);
  });

  it("skips runs whose usage was unavailable", () => {
    const rewards = pearlRewardsByRun(
      {
        runs: [run("r1", "pearl/zai-org/GLM-5.3")],
        attempts: [attempt("a1", "r1")],
        providerTurns: [turn("a1", { usageStatus: "unavailable" })],
      },
      PEARL_NETWORK_SNAPSHOT,
    );
    expect(rewards.size).toBe(0);
  });
});
