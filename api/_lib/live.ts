import { deriveVocabulary } from "../../src/lib/vocabulary.js";
import type {
  Capability,
  Item,
  ProductDecomposition,
  Tier,
} from "../../src/lib/types.js";
import {
  fetchExistingNames,
  queryNearest,
  readVectorStoreConfig,
  upsertEmbeddings,
  vectorNamespace,
  type VectorStoreConfig,
} from "./embeddingCache.js";
import { LiveUnavailableError } from "./errors.js";

/**
 * Live evaluation path (API-2 step 3): structured LLM decomposition (API-4)
 * followed by canonicalization (ALG-2). Model snapshots are pinned via env
 * (API-6, NFR-5); keys never leave the server.
 */

export { LiveUnavailableError } from "./errors.js";

/** ALG-2 / §13: snap threshold 0.83. */
export const SNAP_THRESHOLD = 0.83;

const OPENAI_BASE = "https://api.openai.com/v1";
const IMMUTABLE_SNAPSHOT_SUFFIX = /-\d{4}-\d{2}-\d{2}$/;

export interface LiveConfig {
  apiKey: string;
  chatModel: string;
  embedModel: string;
  embedRevision: string;
}

/** API-6/NFR-5: live calls never fall back to mutable model aliases. */
export function readLiveConfig(
  environment: NodeJS.ProcessEnv = process.env,
): LiveConfig {
  const apiKey = environment.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new LiveUnavailableError(
      "the evaluation service is temporarily unavailable",
    );
  }

  const chatModel = environment.OPENAI_MODEL?.trim();
  if (!chatModel || !IMMUTABLE_SNAPSHOT_SUFFIX.test(chatModel)) {
    throw new LiveUnavailableError(
      "the evaluation service is temporarily unavailable",
    );
  }

  const embedModel = environment.OPENAI_EMBED_MODEL?.trim();
  const embedRevision = environment.OPENAI_EMBED_REVISION?.trim();
  if (!embedModel || !embedRevision || /^(?:latest|current)$/i.test(embedRevision)) {
    throw new LiveUnavailableError(
      "the evaluation service is temporarily unavailable",
    );
  }

  return {
    apiKey,
    chatModel,
    embedModel,
    embedRevision,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function openai(path: string, payload: unknown, apiKey: string): Promise<any> {
  let response: Response;
  try {
    response = await fetch(`${OPENAI_BASE}${path}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new LiveUnavailableError("the evaluation service didn't respond");
  }
  if (!response.ok) {
    throw new LiveUnavailableError("the evaluation service didn't respond");
  }
  return response.json();
}

/** API-4: structured/JSON-schema output mode — no free-text parsing. */
const DECOMPOSITION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name", "price", "capabilities", "altSuggestion"],
  properties: {
    name: {
      type: ["string", "null"],
      description: "Short product name, or null if the text does not describe a purchasable product.",
    },
    price: { type: ["number", "null"], description: "Price in dollars if stated or confidently known, else null." },
    capabilities: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "tier"],
        properties: {
          name: {
            type: "string",
            minLength: 3,
            maxLength: 80,
            pattern: "^[a-z][a-z-]*s(?: [a-z][a-z0-9-]*)+$",
            description:
              "Lowercase present-tense verb plus object phrase, with no brand, model, number, or marketing adjective.",
          },
          tier: { type: "string", enum: ["primary", "secondary"] },
        },
      },
    },
    altSuggestion: { type: ["string", "null"] },
  },
} as const;

function decompositionPrompt(vocabularyNames: string[]): string {
  return [
    "You decompose a product someone is considering buying into 3-8 functional capabilities.",
    "",
    "Capability naming law (strict): lowercase, present-tense verb + object phrase.",
    "No brand names, no model numbers, no marketing adjectives.",
    'Good: "toasts bread", "charges usb-c devices". Bad: "Smart Toasting", "Breville baking".',
    "",
    "Tier: 'primary' for the product's main jobs, 'secondary' for incidental abilities.",
    "",
    "The user's existing capability vocabulary is listed below. If a capability of this",
    "product matches one of these in meaning, you MUST reuse the exact string verbatim:",
    ...vocabularyNames.map((name) => `- ${name}`),
    "",
    "altSuggestion: one sentence describing a cheaper or secondhand way to acquire only",
    "what this product adds beyond the vocabulary above, when plausible; otherwise null.",
    "",
    "If the text does not describe a purchasable product, set name to null.",
  ].join("\n");
}

const CAPABILITY_NAME_SHAPE =
  /^[a-z][a-z-]*s(?: [a-z][a-z0-9-]*)+$/;
const NON_OBJECT_HEADS = new Set([
  "as",
  "at",
  "between",
  "by",
  "for",
  "from",
  "in",
  "into",
  "of",
  "on",
  "over",
  "through",
  "to",
  "under",
  "with",
  "without",
]);
const FORBIDDEN_CAPABILITY_WORDS = new Set([
  "anker",
  "breville",
  "deluxe",
  "dji",
  "instant",
  "ninja",
  "premium",
  "pro",
  "smart",
]);

/** DM-3: enforce the naming law on the finalized live decomposition. */
export function followsCapabilityNamingLaw(name: string): boolean {
  if (!CAPABILITY_NAME_SHAPE.test(name) || /\d/.test(name)) return false;
  const words = name.split(" ");
  if (NON_OBJECT_HEADS.has(words[1])) return false;
  return !words.some((word) => FORBIDDEN_CAPABILITY_WORDS.has(word));
}

/**
 * Snapping may merge several raw capabilities. Validate the returned set after
 * that merge so the API never emits a decomposition outside DM-3/DM-4.
 */
export function finalizeCanonicalCapabilities(
  capabilities: Capability[],
): Capability[] {
  return finalizeCapabilities(capabilities, 3, 8);
}

function finalizeCapabilities(
  capabilities: Capability[],
  minItems: number,
  maxItems: number,
): Capability[] {
  const deduped = new Map<string, Capability>();
  capabilities.forEach((capability) => {
    if (
      !capability ||
      typeof capability.name !== "string" ||
      (capability.tier !== "primary" && capability.tier !== "secondary")
    ) {
      throw new Error("invalid capability shape");
    }

    const existing = deduped.get(capability.name);
    if (
      !existing ||
      (existing.tier === "secondary" && capability.tier === "primary")
    ) {
      deduped.set(capability.name, capability);
    }
  });

  const finalized = [...deduped.values()];
  if (finalized.length < minItems || finalized.length > maxItems) {
    throw new Error(
      `canonical decomposition must contain ${minItems}-${maxItems} unique capabilities`,
    );
  }
  const invalid = finalized.find(
    (capability) => !followsCapabilityNamingLaw(capability.name),
  );
  if (invalid) {
    throw new Error(`capability violates the naming law: ${invalid.name}`);
  }
  return finalized;
}

/**
 * Canonicalize every candidate together so unmatched capability strings share
 * one embeddings request. Exact vocabulary matches never use embeddings.
 */
export async function canonicalizeCapabilityGroups(
  groups: Capability[][],
  items: Item[],
  config: LiveConfig,
  limits: { min: number; max: number } = { min: 1, max: 6 },
): Promise<Capability[][]> {
  const vectorStoreConfig = readVectorStoreConfig();
  const vocabularyNames = [...deriveVocabulary(items).keys()];
  const vocabularySet = new Set(vocabularyNames);
  const normalized = groups.map((group) =>
    group.map((capability) => ({
      name: capability.name.toLowerCase().trim(),
      tier: capability.tier,
    })),
  );
  const unmatchedNames = [
    ...new Set(
      normalized
        .flat()
        .map((capability) => capability.name)
        .filter((name) => !vocabularySet.has(name)),
    ),
  ];

  if (unmatchedNames.length > 0 && vocabularyNames.length > 0) {
    const unmatchedVectorsPromise = embed(
      unmatchedNames,
      config.apiKey,
      config.embedModel,
    );

    let snapped: Map<string, string> | null = null;
    if (vectorStoreConfig) {
      try {
        snapped = await snapWithVectorStore(
          vectorStoreConfig,
          vocabularyNames,
          unmatchedNames,
          unmatchedVectorsPromise,
          config,
        );
      } catch (error) {
        // The vector store persists what the in-process path can always
        // recompute; an outage must not take down live evaluation.
        console.warn("vector store unavailable — snapping in-process", error);
      }
    }

    if (!snapped) {
      const [vocab, unmatchedVectors] = await Promise.all([
        vocabularyVectors(
          vocabularyNames,
          config.apiKey,
          config.embedModel,
          config.embedRevision,
        ),
        unmatchedVectorsPromise,
      ]);
      snapped = new Map<string, string>();
      unmatchedNames.forEach((name, index) => {
        let bestScore = -1;
        let bestName: string | null = null;
        vocab.vectors.forEach((vector, vocabIndex) => {
          const score = cosine(unmatchedVectors[index], vector);
          if (score > bestScore) {
            bestScore = score;
            bestName = vocab.names[vocabIndex];
          }
        });
        if (bestName && bestScore >= SNAP_THRESHOLD) snapped!.set(name, bestName);
      });
    }

    normalized.flat().forEach((capability) => {
      capability.name = snapped.get(capability.name) ?? capability.name;
    });
  }

  return normalized.map((group) =>
    finalizeCapabilities(group, limits.min, limits.max),
  );
}

/**
 * ALG-2 step 3 against the embedding cache: make sure every vocabulary vector
 * is persisted, then snap each unmatched name to its nearest neighbor within
 * the active vocabulary. The cache shares the pinned embedding model and
 * cosine metric with the in-process path, so scores and the 0.83 threshold
 * are interchangeable.
 */
async function snapWithVectorStore(
  vectorStoreConfig: VectorStoreConfig,
  vocabularyNames: string[],
  unmatchedNames: string[],
  unmatchedVectorsPromise: Promise<number[][]>,
  config: LiveConfig,
): Promise<Map<string, string>> {
  const namespace = vectorNamespace(config.embedModel, config.embedRevision);
  const [, unmatchedVectors] = await Promise.all([
    ensureVocabularyVectors(vectorStoreConfig, namespace, vocabularyNames, config),
    unmatchedVectorsPromise,
  ]);
  const nearest = await Promise.all(
    unmatchedVectors.map((vector) =>
      queryNearest(namespace, vocabularyNames, vector),
    ),
  );
  const snapped = new Map<string, string>();
  nearest.forEach((match, index) => {
    if (match && match.score >= SNAP_THRESHOLD) {
      snapped.set(unmatchedNames[index], match.name);
    }
  });
  return snapped;
}

/**
 * Vocabulary vectors are written once per namespace and reused across cold
 * starts; only names missing from the cache are embedded. Memoized per
 * process like vocabularyVectorsCache so warm instances skip the existence
 * check. The namespace embeds the model + revision, so the key can never
 * alias vectors across embedding deployments.
 */
const ensuredVocabularyCache = new Map<string, Promise<void>>();

function ensureVocabularyVectors(
  vectorStoreConfig: VectorStoreConfig,
  namespace: string,
  vocabularyNames: string[],
  config: LiveConfig,
): Promise<void> {
  // The database URL is part of the key so a URL change (e.g. the isolated
  // test database) can never reuse another database's ensure result.
  const cacheKey = JSON.stringify([
    vectorStoreConfig.databaseUrl,
    namespace,
    vocabularyNames,
  ]);
  let ensured = ensuredVocabularyCache.get(cacheKey);
  if (!ensured) {
    ensured = (async () => {
      const existing = await fetchExistingNames(namespace, vocabularyNames);
      const missing = vocabularyNames.filter((name) => !existing.has(name));
      if (missing.length === 0) return;
      const vectors = await embed(missing, config.apiKey, config.embedModel);
      await upsertEmbeddings(
        namespace,
        missing.map((name, index) => ({ name, vector: vectors[index] })),
      );
    })();
    ensured.catch(() => ensuredVocabularyCache.delete(cacheKey));
    ensuredVocabularyCache.set(cacheKey, ensured);
  }
  return ensured;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function embed(
  texts: string[],
  apiKey: string,
  embedModel: string,
): Promise<number[][]> {
  const response = await openai(
    "/embeddings",
    { model: embedModel, input: texts },
    apiKey,
  );
  return response.data.map((entry: { embedding: number[] }) => entry.embedding);
}

/**
 * ALG-2 pinning: vocabulary vectors are embedded lazily per process. The cache
 * is partitioned by both model id and the required deployment revision, so a
 * deployment that changes embedding configuration cannot silently reuse the
 * previous revision's vectors.
 */
const vocabularyVectorsCache = new Map<
  string,
  Promise<{ names: string[]; vectors: number[][] }>
>();

function vocabularyVectors(
  vocabularyNames: string[],
  apiKey: string,
  embedModel: string,
  embedRevision: string,
) {
  const cacheKey = JSON.stringify([
    embedModel,
    embedRevision,
    vocabularyNames,
  ]);
  let cached = vocabularyVectorsCache.get(cacheKey);
  if (!cached) {
    cached = embed(vocabularyNames, apiKey, embedModel).then((vectors) => ({
      names: vocabularyNames,
      vectors,
    }));
    cached.catch(() => vocabularyVectorsCache.delete(cacheKey));
    vocabularyVectorsCache.set(cacheKey, cached);
  }
  return cached;
}

export async function decomposeLive(
  text: string,
  items: Item[],
): Promise<ProductDecomposition> {
  const { apiKey, chatModel, embedModel, embedRevision } = readLiveConfig();
  const vocabularyNames = [...deriveVocabulary(items).keys()];
  let validationError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const retryInstruction =
      attempt === 0
        ? ""
        : [
            "",
            "Retry requirement: the previous result failed validation after canonicalization.",
            "Return 3-8 semantically distinct functional jobs, not synonyms or restatements",
            "of the same job. Follow the capability naming law exactly.",
          ].join("\n");
    const completion = await openai(
      "/chat/completions",
      {
        model: chatModel,
        messages: [
          {
            role: "system",
            content: `${decompositionPrompt(vocabularyNames)}${retryInstruction}`,
          },
          { role: "user", content: text },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "product_decomposition",
            strict: true,
            schema: DECOMPOSITION_SCHEMA,
          },
        },
      },
      apiKey,
    );

    try {
      const raw = JSON.parse(completion.choices[0].message.content) as {
        name: string | null;
        price: number | null;
        capabilities: { name: string; tier: Tier }[];
        altSuggestion: string | null;
      };
      if (!raw.name) {
        throw new Error("not a product");
      }

      const [finalizedCapabilities] = await canonicalizeCapabilityGroups(
        [raw.capabilities],
        items,
        { apiKey, chatModel, embedModel, embedRevision },
        { min: 3, max: 8 },
      );

      return {
        name: raw.name,
        price: raw.price,
        capabilities: finalizedCapabilities,
        altSuggestion: raw.altSuggestion,
      };
    } catch (error) {
      validationError = error;
    }
  }

  throw validationError;
}
