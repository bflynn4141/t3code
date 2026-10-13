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
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

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
        <RadialGradient id="pearl-body" cx="38%" cy="34%" r="70%">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="0.45" stopColor="#f1ebe3" />
          <Stop offset="0.8" stopColor="#d9d3df" />
          <Stop offset="1" stopColor="#b9b2c4" />
        </RadialGradient>
      </Defs>
      <Circle cx="10" cy="10" r="9.5" fill="url(#pearl-body)" />
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
        accessibilityLabel={`Estimated Pearl reward: ${formatGrains(reward.grains)} grains`}
        accessibilityState={{ expanded }}
        hitSlop={6}
        onPress={() => setExpanded((open) => !open)}
        className="min-h-7 flex-row items-center gap-1.5 self-start rounded-full px-1.5"
      >
        <PearlDot size={11} />
        <Text className="font-t3-medium text-xs tabular-nums text-foreground-secondary">
          {formatGrains(reward.grains)} grains
          {reward.durationMs !== null ? ` · ${formatDuration(reward.durationMs)}` : ""}
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
