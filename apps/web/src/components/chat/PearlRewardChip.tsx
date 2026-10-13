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

import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";

/** A small lit pearl: ivory body, soft shadow side, and a faint nacre sheen. */
function PearlDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        borderRadius: "9999px",
        background:
          "radial-gradient(circle at 34% 30%, #fff 0 12%, transparent 34%)," +
          "radial-gradient(circle at 70% 78%, rgb(176 168 196 / 0.55), transparent 60%)," +
          "conic-gradient(from 210deg, #efe6df, #e1e9e6, #e8e2ee, #f4eddf, #efe6df)",
        boxShadow: "inset -1px -1.5px 2px rgb(70 60 80 / 0.28), 0 0 0 0.5px rgb(0 0 0 / 0.12)",
      }}
    />
  );
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
            className="inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 text-muted-foreground text-xs tabular-nums hover:bg-accent/60 hover:text-foreground"
            aria-label={`Estimated Pearl reward: ${formatGrains(reward.grains)} grains`}
          >
            <PearlDot className="size-2.5 shrink-0" />
            <span>{formatGrains(reward.grains)} grains</span>
            {reward.durationMs !== null ? (
              <span className="text-muted-foreground/70">
                · {formatDuration(reward.durationMs)}
              </span>
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
            <div className="font-medium text-muted-foreground text-xs">Pearl reward</div>
            <div className="text-secondary-label text-2xs">Estimate</div>
          </div>
          <div className="flex items-center gap-2">
            <PearlDot className="size-5 shrink-0" />
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
