import * as Schema from "effect/Schema";

/**
 * Pearl (pearlresearch.ai) mines its PRL coin with the same matrix math that
 * runs AI. Its inference API is OpenAI-compatible, and T3 Code reaches it
 * through an OpenCode instance whose only provider is `pearl`. Every Pearl
 * model therefore arrives with a `pearl/` slug prefix, which is how clients
 * recognize Pearl turns and estimate their PRL reward.
 */
export const PEARL_OPENCODE_PROVIDER_ID = "pearl";
export const PEARL_INFERENCE_BASE_URL = "https://inference.pearlresearch.ai/v1";
export const PEARL_API_KEY_ENV = "PEARL_API_KEY";

export interface PearlModel {
  readonly id: string;
  readonly name: string;
  /** Weights used per token. Mixture-of-experts models run only a slice of their total size. */
  readonly activeParams: number;
  readonly contextTokens: number;
  readonly vision: boolean;
  /** USD per million tokens, Pearl launch pricing checked 12 Oct 2026. */
  readonly price: { readonly input: number; readonly cachedInput: number; readonly output: number };
}

// Active parameter counts for the MoE models come from third-party write-ups,
// not the model makers. They only scale the reward estimate.
export const PEARL_MODELS: ReadonlyArray<PearlModel> = [
  {
    id: "google/gemma-4-31B-it",
    name: "Gemma 4 31B",
    activeParams: 31e9,
    contextTokens: 256_000,
    vision: false,
    price: { input: 0.09, cachedInput: 0.05, output: 0.34 },
  },
  {
    id: "zai-org/GLM-5.3",
    name: "GLM-5.3",
    activeParams: 40e9,
    contextTokens: 1_000_000,
    vision: false,
    price: { input: 1.1, cachedInput: 0.23, output: 3.5 },
  },
  {
    id: "deepseek-ai/DeepSeek-V4-Pro-0813",
    name: "DeepSeek V4 Pro",
    activeParams: 49e9,
    contextTokens: 1_000_000,
    vision: false,
    price: { input: 1.1, cachedInput: 0.043, output: 3.3 },
  },
  {
    id: "Qwen/Qwen3.8-27B",
    name: "Qwen 3.8 27B",
    activeParams: 27e9,
    contextTokens: 256_000,
    vision: true,
    price: { input: 0.2, cachedInput: 0.05, output: 2 },
  },
  {
    id: "zai-org/GLM-5.3-Flash",
    name: "GLM-5.3 Flash",
    activeParams: 18e9,
    contextTokens: 1_000_000,
    vision: true,
    price: { input: 0.07, cachedInput: 0.015, output: 0.24 },
  },
  {
    id: "deepseek-ai/DeepSeek-V4.1-Flash",
    name: "DeepSeek V4.1 Flash",
    activeParams: 16e9,
    contextTokens: 1_000_000,
    vision: true,
    price: { input: 0.14, cachedInput: 0.004, output: 0.42 },
  },
  {
    id: "Qwen/Qwen3.8-Flash-Next",
    name: "Qwen 3.8 Flash",
    activeParams: 6e9,
    contextTokens: 256_000,
    vision: true,
    price: { input: 0.14, cachedInput: 0.015, output: 0.45 },
  },
];

const PEARL_SLUG_PREFIX = `${PEARL_OPENCODE_PROVIDER_ID}/`;

/** The Pearl model behind an OpenCode slug such as `pearl/zai-org/GLM-5.3`, if any. */
export function pearlModelForSlug(slug: string | null | undefined): PearlModel | undefined {
  if (!slug?.startsWith(PEARL_SLUG_PREFIX)) return undefined;
  const id = slug.slice(PEARL_SLUG_PREFIX.length);
  return PEARL_MODELS.find((model) => model.id === id);
}

/** Live network numbers the reward estimate depends on. */
export const PearlNetworkStats = Schema.Struct({
  blockRewardPrl: Schema.Number,
  blockTimeSeconds: Schema.Number,
  /** Hashes per second across the whole network. */
  networkHashrate: Schema.Number,
  prlUsd: Schema.Number,
  blockHeight: Schema.NullOr(Schema.Number),
  /** ISO timestamp of the reading. */
  fetchedAt: Schema.String,
  /** False when a live source failed and these are the bundled snapshot. */
  live: Schema.Boolean,
});
export type PearlNetworkStats = typeof PearlNetworkStats.Type;

/** Snapshot from 12 Oct 2026, served only while live sources are unreachable. */
export const PEARL_NETWORK_SNAPSHOT: PearlNetworkStats = {
  blockRewardPrl: 2260.63,
  blockTimeSeconds: 187,
  networkHashrate: 5.227e19,
  prlUsd: 1.53,
  blockHeight: 126964,
  fetchedAt: "2026-10-12T00:00:00.000Z",
  live: false,
};

/** OpenCode config that makes Pearl the instance's only model source. */
export function pearlOpenCodeConfig(): Record<string, unknown> {
  return {
    enabled_providers: [PEARL_OPENCODE_PROVIDER_ID],
    provider: {
      [PEARL_OPENCODE_PROVIDER_ID]: {
        npm: "@ai-sdk/openai-compatible",
        name: "Pearl",
        options: { baseURL: PEARL_INFERENCE_BASE_URL, apiKey: `{env:${PEARL_API_KEY_ENV}}` },
        models: Object.fromEntries(
          PEARL_MODELS.map((model) => [
            model.id,
            {
              name: model.name,
              limit: { context: model.contextTokens, output: 32_000 },
              modalities: { input: model.vision ? ["text", "image"] : ["text"], output: ["text"] },
              cost: {
                input: model.price.input,
                output: model.price.output,
                cache_read: model.price.cachedInput,
              },
            },
          ]),
        ),
      },
    },
  };
}
