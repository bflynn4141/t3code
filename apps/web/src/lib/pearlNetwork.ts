import { PEARL_NETWORK_SNAPSHOT, type PearlNetworkStats } from "@t3tools/contracts";
import { useEffect, useSyncExternalStore } from "react";

import { resolvePrimaryEnvironmentHttpUrl } from "~/environments/primary/target";

// One shared reading for the whole app. The server caches upstream for five
// minutes, so refreshing on the same cadence keeps estimates current without
// extra traffic. Until the first reading lands, estimates use the snapshot.
const REFRESH_MS = 5 * 60_000;

let current: PearlNetworkStats = PEARL_NETWORK_SNAPSHOT;
let lastFetchAt = 0;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function refresh(): Promise<void> {
  if (inFlight || Date.now() - lastFetchAt < REFRESH_MS) return inFlight ?? Promise.resolve();
  inFlight = (async () => {
    try {
      const response = await fetch(resolvePrimaryEnvironmentHttpUrl("/api/pearl/network"));
      if (response.ok) {
        current = (await response.json()) as PearlNetworkStats;
        for (const listener of listeners) listener();
      }
    } catch {
      // No primary environment, or offline: keep the last reading.
    } finally {
      lastFetchAt = Date.now();
      inFlight = null;
    }
  })();
  return inFlight;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Live Pearl network numbers for reward estimates, only fetched while `enabled`. */
export function usePearlNetwork(enabled: boolean): PearlNetworkStats {
  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [enabled]);
  return useSyncExternalStore(subscribe, () => current);
}
