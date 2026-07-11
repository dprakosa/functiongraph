import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LiveUnavailableError } from "./errors";
import {
  fetchExistingIds,
  queryNearest,
  readPineconeConfig,
  resetPineconeHostCacheForTests,
  upsertVectors,
  vectorNamespace,
  type PineconeConfig,
} from "./pinecone";

const config: PineconeConfig = {
  apiKey: "pinecone-test-key",
  indexName: "functiongraph-vocab",
};
const HOST = "functiongraph-vocab-abc123.svc.test.pinecone.io";

type MockRoute = (url: string, init?: RequestInit) => unknown;

function installPineconeMock(route: MockRoute) {
  const fetchMock = vi.fn(
    async (url: string | URL, init?: RequestInit): Promise<Response> => {
      const payload = route(String(url), init);
      return {
        ok: true,
        json: async () => payload,
      } as Response;
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function describeIndexRoute(url: string): unknown | undefined {
  if (url === "https://api.pinecone.io/indexes/functiongraph-vocab") {
    return { name: config.indexName, host: HOST };
  }
  return undefined;
}

beforeEach(() => {
  resetPineconeHostCacheForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("readPineconeConfig", () => {
  it("treats a missing index as disabled, even with an ambient api key", () => {
    expect(readPineconeConfig({})).toBeNull();
    expect(readPineconeConfig({ PINECONE_API_KEY: "key" })).toBeNull();
  });

  it("rejects an index without a key loudly", () => {
    expect(() =>
      readPineconeConfig({ PINECONE_INDEX: "index" }),
    ).toThrow(LiveUnavailableError);
  });

  it("returns trimmed credentials when both are present", () => {
    expect(
      readPineconeConfig({
        PINECONE_API_KEY: " key ",
        PINECONE_INDEX: " index ",
      }),
    ).toEqual({ apiKey: "key", indexName: "index" });
  });
});

describe("vectorNamespace (ALG-2 partitioning)", () => {
  it("derives the namespace from the pinned model and revision", () => {
    expect(vectorNamespace("text-embedding-3-small", "deployment-v1")).toBe(
      "text-embedding-3-small@deployment-v1",
    );
  });
});

describe("data-plane requests", () => {
  it("resolves the index host once per process and reuses it", async () => {
    const fetchMock = installPineconeMock((url) => {
      const described = describeIndexRoute(url);
      if (described) return described;
      if (url.startsWith(`https://${HOST}/vectors/fetch`)) return { vectors: {} };
      throw new Error(`unexpected request: ${url}`);
    });

    await fetchExistingIds(config, "ns", ["a"]);
    await fetchExistingIds(config, "ns", ["b"]);

    const describeCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).startsWith("https://api.pinecone.io/"),
    );
    expect(describeCalls).toHaveLength(1);
    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers["api-key"]).toBe(config.apiKey);
    expect(headers["x-pinecone-api-version"]).toBe("2025-04");
  });

  it("reports which ids already exist, batching large id lists", async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `cap-${i}`);
    const fetchUrls: string[] = [];
    installPineconeMock((url) => {
      const described = describeIndexRoute(url);
      if (described) return described;
      if (url.startsWith(`https://${HOST}/vectors/fetch`)) {
        fetchUrls.push(url);
        const requested = new URL(url).searchParams.getAll("ids");
        return {
          vectors: Object.fromEntries(
            requested
              .filter((id) => id !== "cap-7")
              .map((id) => [id, { id }]),
          ),
        };
      }
      throw new Error(`unexpected request: ${url}`);
    });

    const existing = await fetchExistingIds(config, "the ns", ids);

    expect(fetchUrls).toHaveLength(2);
    expect(new URL(fetchUrls[0]).searchParams.getAll("ids")).toHaveLength(100);
    expect(new URL(fetchUrls[0]).searchParams.get("namespace")).toBe("the ns");
    expect(existing.size).toBe(100);
    expect(existing.has("cap-7")).toBe(false);
    expect(existing.has("cap-100")).toBe(true);
  });

  it("upserts vectors with metadata names in bounded batches", async () => {
    const vectors = Array.from({ length: 51 }, (_, i) => ({
      id: `cap-${i}`,
      values: [i, 0, 0],
      metadata: { name: `capability ${i}` },
    }));
    const upsertPayloads: { namespace: string; vectors: unknown[] }[] = [];
    installPineconeMock((url, init) => {
      const described = describeIndexRoute(url);
      if (described) return described;
      if (url === `https://${HOST}/vectors/upsert`) {
        upsertPayloads.push(JSON.parse(String(init?.body)));
        return {};
      }
      throw new Error(`unexpected request: ${url}`);
    });

    await upsertVectors(config, "ns", vectors);

    expect(upsertPayloads).toHaveLength(2);
    expect(upsertPayloads[0].vectors).toHaveLength(50);
    expect(upsertPayloads[1].vectors).toHaveLength(1);
    expect(upsertPayloads[0].namespace).toBe("ns");
    expect(upsertPayloads[0].vectors[0]).toEqual({
      id: "cap-0",
      values: [0, 0, 0],
      metadata: { name: "capability 0" },
    });
  });

  it("returns the nearest match with its cosine score", async () => {
    let queryPayload: unknown;
    installPineconeMock((url, init) => {
      const described = describeIndexRoute(url);
      if (described) return described;
      if (url === `https://${HOST}/query`) {
        queryPayload = JSON.parse(String(init?.body));
        return {
          matches: [
            { id: "reheats-leftovers", score: 0.91, metadata: { name: "reheats leftovers" } },
          ],
        };
      }
      throw new Error(`unexpected request: ${url}`);
    });

    const match = await queryNearest(config, "ns", [0, 0, 1]);

    expect(match).toEqual({ name: "reheats leftovers", score: 0.91 });
    expect(queryPayload).toEqual({
      namespace: "ns",
      vector: [0, 0, 1],
      topK: 1,
      includeMetadata: true,
    });
  });

  it("returns null when the namespace has no matches", async () => {
    installPineconeMock((url) => {
      const described = describeIndexRoute(url);
      if (described) return described;
      if (url === `https://${HOST}/query`) return { matches: [] };
      throw new Error(`unexpected request: ${url}`);
    });

    expect(await queryNearest(config, "ns", [1, 0, 0])).toBeNull();
  });

  it("surfaces non-ok responses as errors and retries host resolution", async () => {
    let describeAttempts = 0;
    const fetchMock = vi.fn(async (url: string | URL): Promise<Response> => {
      if (String(url).startsWith("https://api.pinecone.io/")) {
        describeAttempts += 1;
        if (describeAttempts === 1) {
          return { ok: false, status: 500, json: async () => ({}) } as Response;
        }
        return {
          ok: true,
          json: async () => ({ name: config.indexName, host: HOST }),
        } as Response;
      }
      return { ok: true, json: async () => ({ vectors: {} }) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchExistingIds(config, "ns", ["a"])).rejects.toThrow(
      /status 500/,
    );
    // The failed resolution was evicted, so the next call succeeds.
    await expect(fetchExistingIds(config, "ns", ["a"])).resolves.toEqual(
      new Set(),
    );
    expect(describeAttempts).toBe(2);
  });
});
