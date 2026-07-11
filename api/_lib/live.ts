import { deriveVocabulary } from "../../src/lib/vocabulary";
import type { Item, ProductDecomposition, Tier } from "../../src/lib/types";

/**
 * Live evaluation path (API-2 step 3): structured LLM decomposition (API-4)
 * followed by canonicalization (ALG-2). Model snapshots are pinned via env
 * (API-6, NFR-5); keys never leave the server.
 */

export class LiveUnavailableError extends Error {}

/** ALG-2 / §13: snap threshold 0.83. */
export const SNAP_THRESHOLD = 0.83;

const OPENAI_BASE = "https://api.openai.com/v1";

function config() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new LiveUnavailableError(
      "live evaluation isn't configured on this deployment",
    );
  }
  return {
    apiKey,
    chatModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
    embedModel: process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small",
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
          name: { type: "string" },
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
 * ALG-2 pinning: vocabulary vectors are embedded lazily per process with the
 * same pinned model used for incoming strings, so cross-model comparison is
 * impossible by construction. Keyed by model in case env changes between
 * warm invocations.
 */
const vocabularyVectorsCache = new Map<
  string,
  Promise<{ names: string[]; vectors: number[][] }>
>();

function vocabularyVectors(
  vocabularyNames: string[],
  apiKey: string,
  embedModel: string,
) {
  const cacheKey = `${embedModel}::${vocabularyNames.join("|")}`;
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
  const { apiKey, chatModel, embedModel } = config();
  const vocabularyNames = [...deriveVocabulary(items).keys()];

  const completion = await openai(
    "/chat/completions",
    {
      model: chatModel,
      messages: [
        { role: "system", content: decompositionPrompt(vocabularyNames) },
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

  const raw = JSON.parse(completion.choices[0].message.content) as {
    name: string | null;
    price: number | null;
    capabilities: { name: string; tier: Tier }[];
    altSuggestion: string | null;
  };
  if (!raw.name) {
    throw new Error("not a product");
  }

  // ALG-2 (2): exact string match against the vocabulary.
  const vocabularySet = new Set(vocabularyNames);
  const capabilities = raw.capabilities.map((capability) => ({
    name: capability.name.toLowerCase().trim(),
    tier: capability.tier,
  }));
  const unmatched = capabilities.filter(
    (capability) => !vocabularySet.has(capability.name),
  );

  // ALG-2 (3): embed and snap to the nearest entry at cosine ≥ 0.83.
  if (unmatched.length > 0) {
    const [vocab, unmatchedVectors] = await Promise.all([
      vocabularyVectors(vocabularyNames, apiKey, embedModel),
      embed(
        unmatched.map((capability) => capability.name),
        apiKey,
        embedModel,
      ),
    ]);
    unmatched.forEach((capability, index) => {
      let bestScore = -1;
      let bestName: string | null = null;
      vocab.vectors.forEach((vector, vocabIndex) => {
        const score = cosine(unmatchedVectors[index], vector);
        if (score > bestScore) {
          bestScore = score;
          bestName = vocab.names[vocabIndex];
        }
      });
      if (bestName && bestScore >= SNAP_THRESHOLD) {
        capability.name = bestName;
      }
      // ALG-2 (4): otherwise it stays as-is — a new capability.
    });
  }

  // Snapping can collapse two capabilities onto one vocabulary entry; keep the
  // strongest tier for each final name.
  const deduped = new Map<string, { name: string; tier: Tier }>();
  capabilities.forEach((capability) => {
    const existing = deduped.get(capability.name);
    if (!existing || (existing.tier === "secondary" && capability.tier === "primary")) {
      deduped.set(capability.name, capability);
    }
  });

  return {
    name: raw.name,
    price: raw.price,
    capabilities: [...deduped.values()],
    altSuggestion: raw.altSuggestion,
  };
}
