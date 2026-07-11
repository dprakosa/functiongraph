import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { database } from "./db";
import {
  fetchExistingNames,
  queryNearest,
  upsertEmbeddings,
  vectorNamespace,
} from "./embeddingCache";
import { capabilityEmbeddings } from "./inventorySchema";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const integration = describe.skipIf(!testDatabaseUrl);

const run = randomUUID();
const namespaceA = vectorNamespace("text-embedding-3-small", `test-a-${run}`);
const namespaceB = vectorNamespace("text-embedding-3-small", `test-b-${run}`);

/** A unit-length 1536-dim vector that is zero outside the given entries. */
function vec(entries: Record<number, number>): number[] {
  const vector = new Array<number>(1536).fill(0);
  Object.entries(entries).forEach(([index, value]) => {
    vector[Number(index)] = value;
  });
  return vector;
}

integration("pgvector embedding cache (ALG-2)", () => {
  beforeAll(() => {
    const url = new URL(testDatabaseUrl!);
    if (url.pathname !== "/functiongraph_test") {
      throw new Error(
        "TEST_DATABASE_URL must target the dedicated functiongraph_test database",
      );
    }
    process.env.DATABASE_URL = testDatabaseUrl;
  });

  afterAll(async () => {
    await database()
      .delete(capabilityEmbeddings)
      .where(
        inArray(capabilityEmbeddings.modelRevision, [namespaceA, namespaceB]),
      );
  });

  it("stores vectors first-write-wins and reports what exists", async () => {
    expect(
      await fetchExistingNames(namespaceA, ["bakes food", "toasts bread"]),
    ).toEqual(new Set());

    await upsertEmbeddings(namespaceA, [
      { name: "bakes food", vector: vec({ 0: 1 }) },
      { name: "toasts bread", vector: vec({ 1: 1 }) },
    ]);
    // A concurrent duplicate write must not overwrite the stored vector.
    await upsertEmbeddings(namespaceA, [
      { name: "bakes food", vector: vec({ 2: 1 }) },
    ]);

    expect(
      await fetchExistingNames(namespaceA, [
        "bakes food",
        "toasts bread",
        "reheats leftovers",
      ]),
    ).toEqual(new Set(["bakes food", "toasts bread"]));

    const nearest = await queryNearest(
      namespaceA,
      ["bakes food", "toasts bread"],
      vec({ 0: 1 }),
    );
    expect(nearest?.name).toBe("bakes food");
    expect(nearest?.score).toBeCloseTo(1, 5);
  });

  it("returns the nearest in-vocabulary name with a calibrated cosine score", async () => {
    await upsertEmbeddings(namespaceA, [
      { name: "reheats leftovers", vector: vec({ 3: 1 }) },
    ]);

    const query = vec({ 3: 0.83, 4: Math.sqrt(1 - 0.83 ** 2) });
    const nearest = await queryNearest(
      namespaceA,
      ["bakes food", "toasts bread", "reheats leftovers"],
      query,
    );

    expect(nearest?.name).toBe("reheats leftovers");
    expect(nearest?.score).toBeCloseTo(0.83, 5);
  });

  it("never returns a cached name outside the active vocabulary", async () => {
    // Another inventory's capability is a perfect match for the query…
    await upsertEmbeddings(namespaceA, [
      { name: "warms plated dinners", vector: vec({ 5: 1 }) },
    ]);

    const nearest = await queryNearest(
      namespaceA,
      ["bakes food", "toasts bread", "reheats leftovers"],
      vec({ 5: 1 }),
    );

    // …but the vocabulary filter keeps it unreachable (ALG-1 scoping).
    expect(nearest?.name).not.toBe("warms plated dinners");

    const unfiltered = await queryNearest(
      namespaceA,
      ["warms plated dinners"],
      vec({ 5: 1 }),
    );
    expect(unfiltered?.name).toBe("warms plated dinners");
  });

  it("isolates vectors across embedding model revisions", async () => {
    await upsertEmbeddings(namespaceB, [
      { name: "bakes food", vector: vec({ 6: 1 }) },
    ]);

    expect(await fetchExistingNames(namespaceB, ["bakes food"])).toEqual(
      new Set(["bakes food"]),
    );
    // namespaceA's "bakes food" points elsewhere; namespaceB only sees its own.
    const nearest = await queryNearest(namespaceB, ["bakes food"], vec({ 0: 1 }));
    expect(nearest?.name).toBe("bakes food");
    expect(nearest?.score).toBeCloseTo(0, 5);
  });
});
