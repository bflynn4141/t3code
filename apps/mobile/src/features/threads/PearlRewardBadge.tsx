import { useAtomValue } from "@effect/atom-react";
import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  formatBackRate,
  formatDuration,
  formatGrains,
  formatOperations,
  formatPrl,
  formatSmallUsd,
  pearlRewardsByRun,
} from "@t3tools/client-runtime/pearl";
import {
  type EnvironmentId,
  PEARL_NETWORK_SNAPSHOT,
  type PearlNetworkStats,
  pearlModelForSlug,
  type RunId,
  type ThreadId,
} from "@t3tools/contracts";
import * as Option from "effect/Option";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Pressable, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Stop } from "react-native-svg";

import { AppText as Text } from "../../components/AppText";
import { usePreparedConnection } from "../../state/session";
import { environmentThreadDetails } from "../../state/threads";

// One shared network reading, refreshed on the server's five-minute cache window.
const REFRESH_MS = 5 * 60_000;
let network: PearlNetworkStats = PEARL_NETWORK_SNAPSHOT;
let lastFetchAt = 0;
const listeners = new Set<() => void>();

function refreshNetwork(httpBaseUrl: string) {
  if (Date.now() - lastFetchAt < REFRESH_MS) return;
  lastFetchAt = Date.now();
  fetch(new URL("/api/pearl/network", httpBaseUrl).toString())
    .then((response) => (response.ok ? response.json() : null))
    .then((stats: PearlNetworkStats | null) => {
      if (!stats) return;
      network = stats;
      for (const listener of listeners) listener();
    })
    .catch(() => {});
}

function PearlDot({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 20 20">
      <Defs>
        <LinearGradient id="pearl-nacre" x1="0.1" y1="0.05" x2="0.9" y2="0.95">
          <Stop offset="0" stopColor="#FF9ECF" />
          <Stop offset="0.22" stopColor="#FFD08A" />
          <Stop offset="0.42" stopColor="#FFF39A" />
          <Stop offset="0.6" stopColor="#9EF2C4" />
          <Stop offset="0.8" stopColor="#8FD0FF" />
          <Stop offset="1" stopColor="#C6A4FF" />
        </LinearGradient>
        <RadialGradient id="pearl-shine" cx="34%" cy="30%" r="60%">
          <Stop offset="0" stopColor="#ffffff" stopOpacity="1" />
          <Stop offset="0.3" stopColor="#ffffff" stopOpacity="0.35" />
          <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </RadialGradient>
      </Defs>
      <Circle cx="10" cy="10" r="9.5" fill="url(#pearl-nacre)" />
      <Circle cx="10" cy="10" r="9.5" fill="url(#pearl-shine)" />
    </Svg>
  );
}

export function PearlRewardBadge(props: {
  environmentId: EnvironmentId;
  threadId: ThreadId;
  runId: RunId;
}) {
  const projection = useAtomValue(
    environmentThreadDetails.threadAtom(scopeThreadRef(props.environmentId, props.threadId)),
    (thread) => thread?.projection ?? null,
  );
  const isPearlRun = useMemo(
    () =>
      projection?.runs.some(
        (run) => run.id === props.runId && pearlModelForSlug(run.modelSelection.model),
      ) ?? false,
    [projection?.runs, props.runId],
  );
  const connection = usePreparedConnection(props.environmentId);
  const httpBaseUrl = Option.isSome(connection) ? connection.value.httpBaseUrl : null;
  useEffect(() => {
    if (isPearlRun && httpBaseUrl) refreshNetwork(httpBaseUrl);
  }, [isPearlRun, httpBaseUrl]);
  const stats = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => network,
  );
  const reward = useMemo(
    () =>
      projection && isPearlRun ? pearlRewardsByRun(projection, stats).get(props.runId) : undefined,
    [projection, isPearlRun, stats, props.runId],
  );
  const [expanded, setExpanded] = useState(false);
  if (!reward) return null;

  return (
    <View className="mt-1">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Estimated reward: ${formatGrains(reward.grains)} grains, about ${formatSmallUsd(reward.usd)}`}
        accessibilityState={{ expanded }}
        hitSlop={6}
        onPress={() => setExpanded((open) => !open)}
        className="min-h-7 flex-row items-center gap-1.5 self-start rounded-full px-1.5"
      >
        <PearlDot size={14} />
        <Text className="font-t3-medium text-xs tabular-nums text-foreground">
          {formatGrains(reward.grains)} grains{" "}
          <Text className="text-foreground-secondary" style={{ opacity: 0.75 }}>
            {formatSmallUsd(reward.usd)}
          </Text>
          <Text className="text-foreground-secondary">
            {reward.durationMs !== null ? ` · ${formatDuration(reward.durationMs)}` : ""}
          </Text>
        </Text>
      </Pressable>
      {expanded ? (
        <View className="mt-1 gap-0.5 rounded-xl border border-border px-3 py-2">
          <Text className="text-xs tabular-nums text-foreground">
            {formatPrl(reward.prl)} ≈ {formatSmallUsd(reward.usd)}
          </Text>
          <Text className="text-xs tabular-nums text-foreground-secondary">
            {reward.model.name} · {formatOperations(reward.operations)} ops · cost{" "}
            {formatSmallUsd(reward.costUsd)} · {formatBackRate(reward.backRate)} back
          </Text>
          <Text className="text-xs text-foreground-secondary">
            {stats.live ? "Live network data." : "Using the 12 Oct 2026 snapshot."}{" "}
            {reward.complete ? "" : "Some usage wasn't reported, so this is a lower bound. "}
            Estimate only. Payouts aren't live yet.
          </Text>
        </View>
      ) : null}
    </View>
  );
}
