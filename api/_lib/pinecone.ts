import { LiveUnavailableError } from "./errors";

/**
 * Pinecone vector store for ALG-2 canonicalization vectors (§14 decision log,
 * 2026-07-11). Vocabulary vectors persist in a standard serverless index so
 * cold starts reuse them instead of re-embedding; the embedding model stays
 * the pinned OpenAI one, so a cosine-metric index returns the same scores the
 * in-process math produces and the 0.83 snap threshold keeps its calibration.
 */

const CONTROL_PLANE = "https://api.pinecone.io";
/** NFR-5: pin the REST API version like every other provider surface. */
const API_VERSION = "2025-04";
/** Fetch accepts a bounded id list per request; stay well inside it. */
const FETCH_BATCH = 100;
/** Upsert requests are capped at 2 MB; ~31 KB per 1536-dim JSON vector. */
const UPSERT_BATCH = 50;

export interface PineconeConfig {
  apiKey: string;
  indexName: string;
}

/**
 * PINECONE_INDEX is the feature switch: absent means the vector store is off
 * (in-process snapping), regardless of any ambient PINECONE_API_KEY — a bare
 * key is common shell state and must not change behavior. An index without a
 * key is a real deployment mistake and must be loud, mirroring readLiveConfig.
 */
export function readPineconeConfig(
  environment: NodeJS.ProcessEnv = process.env,
): PineconeConfig | null {
  const indexName = environment.PINECONE_INDEX?.trim();
  if (!indexName) return null;
  const apiKey = environment.PINECONE_API_KEY?.trim();
  if (!apiKey) {
    throw new LiveUnavailableError("pinecone configuration is incomplete");
  }
  return { apiKey, indexName };
}

/**
 * ALG-2: vectors from different embedding deployments are not comparable and
 * must never mix. Partitioning namespaces by model + revision makes a config
 * bump land in a fresh namespace instead of silently querying stale vectors.
 */
export function vectorNamespace(
  embedModel: string,
  embedRevision: string,
): string {
  return `${embedModel}@${embedRevision}`;
}

export interface VocabularyVector {
  id: string;
  values: number[];
  metadata: { name: string };
}

async function pinecone(
  url: string,
  apiKey: string,
  init: { method: "GET" } | { method: "POST"; payload: unknown },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const response = await fetch(url, {
    method: init.method,
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      "x-pinecone-api-version": API_VERSION,
    },
    ...(init.method === "POST" ? { body: JSON.stringify(init.payload) } : {}),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`pinecone request failed with status ${response.status}`);
  }
  return response.json();
}

/**
 * The data-plane host is stable per index; resolve it once per process via
 * the control plane. Failed resolutions are evicted so a transient control
 * plane error doesn't poison every later request.
 */
const hostCache = new Map<string, Promise<string>>();

export function resetPineconeHostCacheForTests(): void {
  hostCache.clear();
}

function indexHost(config: PineconeConfig): Promise<string> {
  const cacheKey = `${config.apiKey}:${config.indexName}`;
  let cached = hostCache.get(cacheKey);
  if (!cached) {
    cached = pinecone(
      `${CONTROL_PLANE}/indexes/${encodeURIComponent(config.indexName)}`,
      config.apiKey,
      { method: "GET" },
    ).then((index: { host?: string }) => {
      if (!index.host) throw new Error("pinecone index has no host");
      return `https://${index.host}`;
    });
    cached.catch(() => hostCache.delete(cacheKey));
    hostCache.set(cacheKey, cached);
  }
  return cached;
}

/** Which of these vector ids already exist in the namespace. */
export async function fetchExistingIds(
  config: PineconeConfig,
  namespace: string,
  ids: string[],
): Promise<Set<string>> {
  const host = await indexHost(config);
  const existing = new Set<string>();
  for (let start = 0; start < ids.length; start += FETCH_BATCH) {
    const batch = ids.slice(start, start + FETCH_BATCH);
    const params = new URLSearchParams();
    batch.forEach((id) => params.append("ids", id));
    params.set("namespace", namespace);
    const result = (await pinecone(
      `${host}/vectors/fetch?${params}`,
      config.apiKey,
      { method: "GET" },
    )) as { vectors?: Record<string, unknown> };
    Object.keys(result.vectors ?? {}).forEach((id) => existing.add(id));
  }
  return existing;
}

export async function upsertVectors(
  config: PineconeConfig,
  namespace: string,
  vectors: VocabularyVector[],
): Promise<void> {
  const host = await indexHost(config);
  for (let start = 0; start < vectors.length; start += UPSERT_BATCH) {
    await pinecone(`${host}/vectors/upsert`, config.apiKey, {
      method: "POST",
      payload: { namespace, vectors: vectors.slice(start, start + UPSERT_BATCH) },
    });
  }
}

/**
 * Nearest vocabulary entry for one query vector. The index is cosine-metric,
 * so the returned score is directly comparable to SNAP_THRESHOLD.
 */
export async function queryNearest(
  config: PineconeConfig,
  namespace: string,
  vector: number[],
): Promise<{ name: string; score: number } | null> {
  const host = await indexHost(config);
  const result = (await pinecone(`${host}/query`, config.apiKey, {
    method: "POST",
    payload: { namespace, vector, topK: 1, includeMetadata: true },
  })) as {
    matches?: { score?: number; metadata?: { name?: unknown } }[];
  };
  const match = result.matches?.[0];
  if (
    !match ||
    typeof match.score !== "number" ||
    typeof match.metadata?.name !== "string"
  ) {
    return null;
  }
  return { name: match.metadata.name, score: match.score };
}
