import type { PearlNetworkStats } from "@t3tools/contracts";
import {
  formatBackRate,
  formatDuration,
  formatGrains,
  formatHashrate,
  formatOperations,
  formatPrl,
  formatSmallUsd,
  type PearlRunReward,
} from "@t3tools/client-runtime/pearl";

import { cn } from "~/lib/utils";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";

/** A glossy nacre pearl, the Shucks reward mark. */
function PearlDot({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cn("pearl-gloss inline-block", className)} />;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-2xs leading-4">
      <span className="text-secondary-label">{label}</span>
      <span className="font-medium tabular-nums text-secondary-label">{value}</span>
    </div>
  );
}

export function PearlRewardChip({
  reward,
  network,
}: {
  reward: PearlRunReward;
  network: PearlNetworkStats;
}) {
  const fresh = Math.max(0, reward.usage.inputTokens - reward.usage.cachedInputTokens);
  const computed = fresh + reward.usage.outputTokens;
  const blockMinutes = (network.blockTimeSeconds / 60).toFixed(1);

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        render={
          <button
            type="button"
            className="pearl-chip inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2.5 pl-1 text-xs tabular-nums outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            aria-label={`Estimated reward: ${formatGrains(reward.grains)} grains, about ${formatSmallUsd(reward.usd)}`}
          >
            <PearlDot className="size-3.5 shrink-0" />
            <span className="font-semibold">{formatGrains(reward.grains)} grains</span>
            <span className="opacity-60">{formatSmallUsd(reward.usd)}</span>
            {reward.durationMs !== null ? (
              <span className="opacity-45">· {formatDuration(reward.durationMs)}</span>
            ) : null}
          </button>
        }
      />
      <PopoverPopup
        tooltipStyle
        side="top"
        align="start"
        padding="none"
        width="sm"
        className="text-left whitespace-normal"
      >
        <div className="flex flex-col gap-2 p-(--floating-content-inset)">
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium text-muted-foreground text-xs">Your pearl</div>
            <div className="text-secondary-label text-2xs">Estimate</div>
          </div>
          <div className="flex items-center gap-2">
            <PearlDot className="size-7 shrink-0" />
            <div className="flex flex-col">
              <span className="font-medium text-sm tabular-nums">
                {formatGrains(reward.grains)} grains
              </span>
              <span className="text-secondary-label text-2xs tabular-nums">
                {formatPrl(reward.prl)} ≈ {formatSmallUsd(reward.usd)}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            {reward.durationMs !== null ? (
              <Row label="Time" value={formatDuration(reward.durationMs)} />
            ) : null}
            <Row label="Model" value={reward.model.name} />
            <Row label="Tokens computed" value={computed.toLocaleString("en-US")} />
            {reward.usage.cachedInputTokens > 0 ? (
              <Row
                label="Cached, no new math"
                value={reward.usage.cachedInputTokens.toLocaleString("en-US")}
              />
            ) : null}
            <Row label="Math done" value={`${formatOperations(reward.operations)} ops`} />
            <Row label="Cost" value={formatSmallUsd(reward.costUsd)} />
            <Row label="Paid back" value={`${formatBackRate(reward.backRate)} of cost`} />
          </div>
          <p className="text-pretty text-secondary-label text-2xs leading-4">
            {network.live
              ? `The network mints ${Math.round(network.blockRewardPrl).toLocaleString("en-US")} PRL every ${blockMinutes} min across ${formatHashrate(network.networkHashrate)}. PRL is $${network.prlUsd.toFixed(2)}.`
              : "Live network data is unavailable, so this uses the 12 Oct 2026 snapshot."}{" "}
            {reward.complete ? "" : "Some usage wasn't reported, so this is a lower bound. "}A grain
            is a millionth of a PRL. Payouts aren't live yet.
          </p>
        </div>
      </PopoverPopup>
    </Popover>
  );
}
