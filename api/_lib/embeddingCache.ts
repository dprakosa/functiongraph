import { and, cosineDistance, eq, inArray, sql } from "drizzle-orm";
import { database } from "./db.js";
import { capabilityEmbeddings } from "./inventorySchema.js";

/**
 * Neon pgvector embedding cache for ALG-2 canonicalization vectors (§14
 * decision log, 2026-07-12). Vocabulary vectors persist in the same database
 * as the inventory so cold starts reuse them instead of re-embedding; the
 * embedding model stays the pinned OpenAI one, so `1 - cosine distance`
 * returns the same scores the in-process math produces and the 0.83 snap
 * threshold keeps its calibration. Every query filters to the caller's active
 * vocabulary, so a shared cache can never snap across inventories (ALG-1).
 */

/** Insert requests stay well inside Neon's HTTP payload limit. */
const UPSERT_BATCH = 50;

export interface VectorStoreConfig {
  databaseUrl: string;
}

/**
 * DATABASE_URL is the only switch: the cache lives in the inventory database,
 * so a deployment with persistence has the cache and one without falls back
 * to in-process snapping. Unlike the former Pinecone key, DATABASE_URL is
 * deliberate app config, never ambient shell state.
 */
export function readVectorStoreConfig(
  environment: NodeJS.ProcessEnv = process.env,
): VectorStoreConfig | null {
  const databaseUrl = environment.DATABASE_URL?.trim();
  return databaseUrl ? { databaseUrl } : null;
}

/**
 * ALG-2: vectors from different embedding deployments are not comparable and
 * must never mix. Partitioning rows by model + revision makes a config bump
 * land in a fresh partition instead of silently querying stale vectors.
 */
export function vectorNamespace(
  embedModel: string,
  embedRevision: string,
): string {
  return `${embedModel}@${embedRevision}`;
}

/** Which of these capability names already have a cached vector. */
export async function fetchExistingNames(
  namespace: string,
  names: string[],
): Promise<Set<string>> {
  if (names.length === 0) return new Set();
  const rows = await database()
    .select({ name: capabilityEmbeddings.name })
    .from(capabilityEmbeddings)
    .where(
      and(
        eq(capabilityEmbeddings.modelRevision, namespace),
        inArray(capabilityEmbeddings.name, names),
      ),
    );
  return new Set(rows.map((row) => row.name));
}

export interface VocabularyEmbedding {
  name: string;
  vector: number[];
}

/** Concurrent writers may race on the same names; first write wins. */
export async function upsertEmbeddings(
  namespace: string,
  embeddings: VocabularyEmbedding[],
): Promise<void> {
  for (let start = 0; start < embeddings.length; start += UPSERT_BATCH) {
    await database()
      .insert(capabilityEmbeddings)
      .values(
        embeddings.slice(start, start + UPSERT_BATCH).map((embedding) => ({
          modelRevision: namespace,
          name: embedding.name,
          embedding: embedding.vector,
        })),
      )
      .onConflictDoNothing();
  }
}

/**
 * Nearest active-vocabulary entry for one query vector. The vocabulary filter
 * is load-bearing: the cache is shared across inventories, and ALG-2 may only
 * snap to names in the caller's own vocabulary.
 */
export async function queryNearest(
  namespace: string,
  vocabularyNames: string[],
  vector: number[],
): Promise<{ name: string; score: number } | null> {
  if (vocabularyNames.length === 0) return null;
  const distance = cosineDistance(capabilityEmbeddings.embedding, vector);
  const rows = await database()
    .select({
      name: capabilityEmbeddings.name,
      score: sql<number>`1 - (${distance})`,
    })
    .from(capabilityEmbeddings)
    .where(
      and(
        eq(capabilityEmbeddings.modelRevision, namespace),
        inArray(capabilityEmbeddings.name, vocabularyNames),
      ),
    )
    .orderBy(distance)
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { name: row.name, score: Number(row.score) };
}
