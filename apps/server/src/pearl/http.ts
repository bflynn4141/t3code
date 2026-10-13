import {
  EnvironmentHttpApi,
  PEARL_NETWORK_SNAPSHOT,
  type PearlNetworkStats,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { HttpClient, HttpClientRequest } from "effect/http";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";

import { annotateEnvironmentRequest } from "../auth/http.ts";

// WhatToMine and CoinGecko are the public sources for Pearl's block reward,
// block time, hashrate and price. WhatToMine sends no CORS headers, so clients
// read through this route instead, and the cache keeps every client on one
// upstream request per window.
const LIVE_TTL = "5 minutes";

const MiningStats = Schema.Struct({
  block_reward: Schema.Number,
  block_time: Schema.NumberFromString,
  nethash: Schema.Number,
  last_block: Schema.optional(Schema.Number),
});
const PriceStats = Schema.Struct({
  "pearl-2": Schema.Struct({ usd: Schema.Number }),
});

const getJson = <S extends Schema.Top>(url: string, schema: S) =>
  Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient;
    const response = yield* http.execute(
      HttpClientRequest.get(url).pipe(HttpClientRequest.acceptJson),
    );
    if (response.status !== 200) return yield* Effect.fail(response.status);
    return yield* response.json.pipe(Effect.flatMap(Schema.decodeUnknownEffect(schema)));
  }).pipe(Effect.timeout("10 seconds"));

const positive = (value: number) => Number.isFinite(value) && value > 0;

class PearlNetworkUnavailable extends Schema.TaggedError<PearlNetworkUnavailable>()(
  "PearlNetworkUnavailable",
  {},
) {}

/** Reads live network stats, failing when any source is missing or implausible. */
export const readPearlNetwork = Effect.gen(function* () {
  const [mining, price] = yield* Effect.all(
    [
      Effect.option(getJson("https://whattomine.com/coins/469.json", MiningStats)),
      Effect.option(
        getJson(
          "https://api.coingecko.com/api/v3/simple/price?ids=pearl-2&vs_currencies=usd",
          PriceStats,
        ),
      ),
    ],
    { concurrency: "unbounded" },
  );
  const m = mining._tag === "Some" ? mining.value : undefined;
  const usd = price._tag === "Some" ? price.value["pearl-2"].usd : undefined;
  const live =
    m !== undefined &&
    usd !== undefined &&
    positive(m.block_reward) &&
    positive(m.block_time) &&
    positive(m.nethash) &&
    positive(usd);
  if (!live) return yield* new PearlNetworkUnavailable();
  return {
    blockRewardPrl: m.block_reward,
    blockTimeSeconds: m.block_time,
    networkHashrate: m.nethash,
    prlUsd: usd,
    blockHeight: m.last_block ?? null,
    fetchedAt: DateTime.formatIso(yield* DateTime.now),
    live: true,
  } satisfies PearlNetworkStats;
});

export const layer = HttpApiBuilder.group(
  EnvironmentHttpApi,
  "pearl",
  Effect.fnUntraced(function* (handlers) {
    const http = yield* HttpClient.HttpClient;
    const [cached, invalidate] = yield* Effect.cachedInvalidateWithTTL(
      readPearlNetwork.pipe(Effect.provideService(HttpClient.HttpClient, http)),
      LIVE_TTL,
    );
    return handlers.handle(
      "network",
      Effect.fn("environment.pearl.network")(function* (args) {
        yield* annotateEnvironmentRequest(args.endpoint.name);
        // Only live readings are cached; after a failure the next request retries.
        return yield* cached.pipe(
          Effect.catch(() => invalidate.pipe(Effect.as(PEARL_NETWORK_SNAPSHOT))),
        );
      }),
    );
  }),
);
