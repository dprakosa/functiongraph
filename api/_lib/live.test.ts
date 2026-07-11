import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import demoCacheFile from "../../src/data/demoCache.json";
import inventoryFile from "../../src/data/inventory.json";
import { capSlug } from "../../src/lib/text";
import type { Capability, Item } from "../../src/lib/types";
import {
  decomposeLive,
  finalizeCanonicalCapabilities,
  followsCapabilityNamingLaw,
  LiveUnavailableError,
  readLiveConfig,
  SNAP_THRESHOLD,
} from "./live";
import { resetPineconeHostCacheForTests } from "./pinecone";

interface MockDecomposition {
  name: string | null;
  price: number | null;
  capabilities: Capability[];
  altSuggestion: string | null;
}

const liveItems: Item[] = [
  {
    id: "owned-oven",
    name: "Owned oven",
    domain: "kitchen",
    capabilities: [
      { name: "bakes food", tier: "primary" },
      { name: "toasts bread", tier: "primary" },
      { name: "reheats leftovers", tier: "secondary" },
    ],
  },
];

const vocabularyVectors: Record<string, number[]> = {
  "bakes food": [1, 0, 0],
  "toasts bread": [0, 1, 0],
  "reheats leftovers": [0, 0, 1],
};

function mockResponse(payload: unknown): Response {
  return {
    ok: true,
    json: async () => payload,
  } as Response;
}

function installOpenAiMock(
  decomposition: MockDecomposition,
  extraVectors: Record<string, number[]> = {},
) {
  const vectors = { ...vocabularyVectors, ...extraVectors };
  const fetchMock = vi.fn(
    async (url: string | URL, init?: RequestInit): Promise<Response> => {
      const payload = JSON.parse(String(init?.body)) as {
        input?: string[];
      };
      if (String(url).endsWith("/chat/completions")) {
        return mockResponse({
          choices: [
            { message: { content: JSON.stringify(decomposition) } },
          ],
        });
      }
      if (String(url).endsWith("/embeddings")) {
        const texts = payload.input ?? [];
        return mockResponse({
          data: texts.map((text, index) => {
            const embedding = vectors[text];
            if (!embedding) throw new Error(`missing test embedding for ${text}`);
            return { index, embedding };
          }),
        });
      }
      throw new Error(`unexpected network request: ${String(url)}`);
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("live model configuration (API-6, NFR-5)", () => {
  const configured = {
    OPENAI_API_KEY: "test-key",
    OPENAI_MODEL: "gpt-4.1-mini-2025-04-14",
    OPENAI_EMBED_MODEL: "text-embedding-3-small",
    OPENAI_EMBED_REVISION: "deployment-v1",
  };

  it("requires explicit immutable model configuration", () => {
    expect(readLiveConfig(configured)).toEqual({
      apiKey: "test-key",
      chatModel: "gpt-4.1-mini-2025-04-14",
      embedModel: "text-embedding-3-small",
      embedRevision: "deployment-v1",
    });
  });

  it("rejects an obvious mutable chat alias", () => {
    expect(() =>
      readLiveConfig({ ...configured, OPENAI_MODEL: "gpt-4.1-mini" }),
    ).toThrow(LiveUnavailableError);
  });

  it("requires a deployment revision for embeddings", () => {
    expect(() =>
      readLiveConfig({ ...configured, OPENAI_EMBED_REVISION: "" }),
    ).toThrow(LiveUnavailableError);
  });
});

describe("final live capability validation (DM-3, DM-4)", () => {
  it("recognizes present-tense verb + object phrases", () => {
    expect(followsCapabilityNamingLaw("charges usb-c devices")).toBe(true);
    expect(followsCapabilityNamingLaw("transfers data between devices")).toBe(
      true,
    );
    expect(followsCapabilityNamingLaw("maintains aerial position")).toBe(true);
    expect(followsCapabilityNamingLaw("hovers in place")).toBe(false);
    expect(followsCapabilityNamingLaw("aerial photography")).toBe(false);
    expect(followsCapabilityNamingLaw("records 4k video")).toBe(false);
    expect(followsCapabilityNamingLaw("Smart charging")).toBe(false);
  });

  it("accepts every bundled inventory and demo-cache capability", () => {
    const names = [
      ...inventoryFile.items.flatMap((item) =>
        item.capabilities.map((capability) => capability.name),
      ),
      ...Object.values(demoCacheFile.entries).flatMap((entry) =>
        entry.capabilities.map((capability) => capability.name),
      ),
    ];

    names.forEach((name) => {
      expect(
        followsCapabilityNamingLaw(name),
        `invalid bundled capability: ${name}`,
      ).toBe(true);
    });
  });

  it("deduplicates snapped names and keeps the strongest tier", () => {
    const capabilities: Capability[] = [
      { name: "charges usb-c devices", tier: "secondary" },
      { name: "charges usb-c devices", tier: "primary" },
      { name: "bakes food", tier: "primary" },
      { name: "roasts large meals", tier: "secondary" },
    ];

    expect(finalizeCanonicalCapabilities(capabilities)).toEqual([
      { name: "charges usb-c devices", tier: "primary" },
      { name: "bakes food", tier: "primary" },
      { name: "roasts large meals", tier: "secondary" },
    ]);
  });

  it("rejects fewer than three unique capabilities after snapping", () => {
    expect(() =>
      finalizeCanonicalCapabilities([
        { name: "bakes food", tier: "secondary" },
        { name: "bakes food", tier: "primary" },
        { name: "toasts bread", tier: "primary" },
      ]),
    ).toThrow(/3-8 unique capabilities/);
  });

  it("rejects a finalized capability that violates the naming law", () => {
    expect(() =>
      finalizeCanonicalCapabilities([
        { name: "bakes food", tier: "primary" },
        { name: "toasts bread", tier: "primary" },
        { name: "hovers in place", tier: "secondary" },
      ]),
    ).toThrow(/naming law/);
  });
});

describe("decomposeLive canonicalization (API-4, ALG-2)", () => {
  let revision = 0;

  beforeEach(() => {
    revision += 1;
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL", "gpt-4.1-mini-2025-04-14");
    vi.stubEnv("OPENAI_EMBED_MODEL", "text-embedding-3-small");
    vi.stubEnv("OPENAI_EMBED_REVISION", `live-test-${revision}`);
  });

  it("keeps exact vocabulary names without calling the embedding endpoint", async () => {
    const capabilities: Capability[] = [
      { name: "bakes food", tier: "primary" },
      { name: "toasts bread", tier: "primary" },
      { name: "reheats leftovers", tier: "secondary" },
    ];
    const fetchMock = installOpenAiMock({
      name: "Candidate oven",
      price: 100,
      capabilities,
      altSuggestion: null,
    });

    const result = await decomposeLive("candidate oven", liveItems);

    expect(result.capabilities).toEqual(capabilities);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).endsWith("/embeddings"),
      ),
    ).toBe(false);
  });

  it("snaps the nearest capability at the inclusive 0.83 threshold", async () => {
    const atThreshold = [
      Math.sqrt(1 - SNAP_THRESHOLD ** 2),
      0,
      SNAP_THRESHOLD,
    ];
    installOpenAiMock(
      {
        name: "Candidate oven",
        price: 100,
        capabilities: [
          { name: "bakes food", tier: "primary" },
          { name: "toasts bread", tier: "primary" },
          { name: "warms cooked meals", tier: "secondary" },
        ],
        altSuggestion: null,
      },
      { "warms cooked meals": atThreshold },
    );

    const result = await decomposeLive("candidate oven", liveItems);

    expect(result.capabilities[2]).toEqual({
      name: "reheats leftovers",
      tier: "secondary",
    });
  });

  it("keeps a capability new when its nearest score is below 0.83", async () => {
    const belowThreshold = [Math.sqrt(1 - 0.829 ** 2), 0, 0.829];
    installOpenAiMock(
      {
        name: "Candidate oven",
        price: 100,
        capabilities: [
          { name: "bakes food", tier: "primary" },
          { name: "toasts bread", tier: "primary" },
          { name: "warms cooked meals", tier: "secondary" },
        ],
        altSuggestion: null,
      },
      { "warms cooked meals": belowThreshold },
    );

    const result = await decomposeLive("candidate oven", liveItems);

    expect(result.capabilities[2]).toEqual({
      name: "warms cooked meals",
      tier: "secondary",
    });
  });

  it("deduplicates snapped names and retains the primary tier", async () => {
    const atThreshold = [
      Math.sqrt(1 - SNAP_THRESHOLD ** 2),
      0,
      SNAP_THRESHOLD,
    ];
    installOpenAiMock(
      {
        name: "Candidate oven",
        price: 100,
        capabilities: [
          { name: "bakes food", tier: "primary" },
          { name: "toasts bread", tier: "primary" },
          { name: "reheats leftovers", tier: "secondary" },
          { name: "warms cooked meals", tier: "primary" },
        ],
        altSuggestion: null,
      },
      { "warms cooked meals": atThreshold },
    );

    const result = await decomposeLive("candidate oven", liveItems);

    expect(result.capabilities).toHaveLength(3);
    expect(
      result.capabilities.find(
        (capability) => capability.name === "reheats leftovers",
      ),
    ).toEqual({ name: "reheats leftovers", tier: "primary" });
  });

  it("rejects when snapping collapses the result below three capabilities", async () => {
    const atThreshold = [
      Math.sqrt(1 - SNAP_THRESHOLD ** 2),
      0,
      SNAP_THRESHOLD,
    ];
    installOpenAiMock(
      {
        name: "Candidate oven",
        price: 100,
        capabilities: [
          { name: "reheats leftovers", tier: "secondary" },
          { name: "warms cooked meals", tier: "primary" },
          { name: "heats leftover dishes", tier: "secondary" },
        ],
        altSuggestion: null,
      },
      {
        "warms cooked meals": atThreshold,
        "heats leftover dishes": atThreshold,
      },
    );

    await expect(decomposeLive("candidate oven", liveItems)).rejects.toThrow(
      /3-8 unique capabilities/,
    );
  });

  it("rejects an invalid new name after canonicalization", async () => {
    installOpenAiMock(
      {
        name: "Candidate oven",
        price: 100,
        capabilities: [
          { name: "bakes food", tier: "primary" },
          { name: "toasts bread", tier: "primary" },
          { name: "hovers in place", tier: "secondary" },
        ],
        altSuggestion: null,
      },
      { "hovers in place": [1, 1, 1] },
    );

    await expect(decomposeLive("candidate oven", liveItems)).rejects.toThrow(
      /naming law/,
    );
  });

  it("rejects a structured non-product result with name null", async () => {
    const fetchMock = installOpenAiMock({
      name: null,
      price: null,
      capabilities: [
        { name: "bakes food", tier: "primary" },
        { name: "toasts bread", tier: "primary" },
        { name: "reheats leftovers", tier: "secondary" },
      ],
      altSuggestion: null,
    });

    await expect(decomposeLive("not a product", liveItems)).rejects.toThrow(
      "not a product",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

const PINECONE_HOST = "vocab-index-abc123.svc.test.pinecone.io";

function cosine3(a: number[], b: number[]): number {
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

/**
 * OpenAI mock plus an in-memory stand-in for the Pinecone index: fetch
 * reports what is stored, upsert stores, and query scores the same 3-dim
 * test vectors with cosine — mirroring a real cosine-metric index.
 */
function installPineconeBackedMock(
  decomposition: MockDecomposition,
  extraVectors: Record<string, number[]> = {},
  options: { seededNames?: string[]; controlPlaneDown?: boolean } = {},
) {
  const vectors = { ...vocabularyVectors, ...extraVectors };
  const index = new Map<string, { name: string; values: number[] }>();
  (options.seededNames ?? []).forEach((name) => {
    index.set(capSlug(name), { name, values: vectors[name] });
  });

  const fetchMock = vi.fn(
    async (url: string | URL, init?: RequestInit): Promise<Response> => {
      const target = String(url);
      if (target.endsWith("/chat/completions")) {
        return mockResponse({
          choices: [{ message: { content: JSON.stringify(decomposition) } }],
        });
      }
      if (target.endsWith("/embeddings")) {
        const payload = JSON.parse(String(init?.body)) as { input?: string[] };
        return mockResponse({
          data: (payload.input ?? []).map((text, i) => {
            const embedding = vectors[text];
            if (!embedding) throw new Error(`missing test embedding for ${text}`);
            return { index: i, embedding };
          }),
        });
      }
      if (target === "https://api.pinecone.io/indexes/vocab-index") {
        if (options.controlPlaneDown) {
          return { ok: false, status: 500, json: async () => ({}) } as Response;
        }
        return mockResponse({ name: "vocab-index", host: PINECONE_HOST });
      }
      if (target.startsWith(`https://${PINECONE_HOST}/vectors/fetch`)) {
        const requested = new URL(target).searchParams.getAll("ids");
        return mockResponse({
          vectors: Object.fromEntries(
            requested.filter((id) => index.has(id)).map((id) => [id, { id }]),
          ),
        });
      }
      if (target === `https://${PINECONE_HOST}/vectors/upsert`) {
        const payload = JSON.parse(String(init?.body)) as {
          vectors: { id: string; values: number[]; metadata: { name: string } }[];
        };
        payload.vectors.forEach((vector) =>
          index.set(vector.id, { name: vector.metadata.name, values: vector.values }),
        );
        return mockResponse({});
      }
      if (target === `https://${PINECONE_HOST}/query`) {
        const payload = JSON.parse(String(init?.body)) as { vector: number[] };
        let best: { id: string; score: number; metadata: { name: string } } | null =
          null;
        index.forEach(({ name, values }, id) => {
          const score = cosine3(payload.vector, values);
          if (!best || score > best.score) best = { id, score, metadata: { name } };
        });
        return mockResponse({ matches: best ? [best] : [] });
      }
      throw new Error(`unexpected network request: ${target}`);
    },
  );
  vi.stubGlobal("fetch", fetchMock);
  return { fetchMock, index };
}

describe("pinecone-backed canonicalization (ALG-2, §14 decision log)", () => {
  let revision = 0;

  const decomposition: MockDecomposition = {
    name: "Candidate oven",
    price: 100,
    capabilities: [
      { name: "bakes food", tier: "primary" },
      { name: "toasts bread", tier: "primary" },
      { name: "warms cooked meals", tier: "secondary" },
    ],
    altSuggestion: null,
  };
  const atThreshold = [Math.sqrt(1 - SNAP_THRESHOLD ** 2), 0, SNAP_THRESHOLD];
  const belowThreshold = [Math.sqrt(1 - 0.829 ** 2), 0, 0.829];

  beforeEach(() => {
    revision += 1;
    resetPineconeHostCacheForTests();
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL", "gpt-4.1-mini-2025-04-14");
    vi.stubEnv("OPENAI_EMBED_MODEL", "text-embedding-3-small");
    vi.stubEnv("OPENAI_EMBED_REVISION", `pinecone-test-${revision}`);
    vi.stubEnv("PINECONE_API_KEY", "pinecone-test-key");
    vi.stubEnv("PINECONE_INDEX", "vocab-index");
  });

  it("persists vocabulary vectors and snaps through the index", async () => {
    const { fetchMock, index } = installPineconeBackedMock(decomposition, {
      "warms cooked meals": atThreshold,
    });

    const result = await decomposeLive("candidate oven", liveItems);

    expect(result.capabilities[2]).toEqual({
      name: "reheats leftovers",
      tier: "secondary",
    });
    // The empty namespace was seeded with all three vocabulary vectors…
    expect([...index.keys()].sort()).toEqual([
      "bakes-food",
      "reheats-leftovers",
      "toasts-bread",
    ]);
    // …and the snap itself went through a query, not an in-process loop.
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).endsWith(`${PINECONE_HOST}/query`),
      ),
    ).toBe(true);
  });

  it("reuses persisted vectors instead of re-embedding the vocabulary", async () => {
    const { fetchMock } = installPineconeBackedMock(
      decomposition,
      { "warms cooked meals": atThreshold },
      { seededNames: ["bakes food", "toasts bread", "reheats leftovers"] },
    );

    const result = await decomposeLive("candidate oven", liveItems);

    expect(result.capabilities[2]).toEqual({
      name: "reheats leftovers",
      tier: "secondary",
    });
    const embeddingCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith("/embeddings"),
    );
    expect(embeddingCalls).toHaveLength(1);
    expect(JSON.parse(String(embeddingCalls[0][1]?.body)).input).toEqual([
      "warms cooked meals",
    ]);
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).endsWith("/vectors/upsert"),
      ),
    ).toBe(false);
  });

  it("keeps a capability new when the index score is below 0.83", async () => {
    installPineconeBackedMock(decomposition, {
      "warms cooked meals": belowThreshold,
    });

    const result = await decomposeLive("candidate oven", liveItems);

    expect(result.capabilities[2]).toEqual({
      name: "warms cooked meals",
      tier: "secondary",
    });
  });

  it("falls back to in-process snapping when the vector store is down", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    installPineconeBackedMock(
      decomposition,
      { "warms cooked meals": atThreshold },
      { controlPlaneDown: true },
    );

    const result = await decomposeLive("candidate oven", liveItems);

    expect(result.capabilities[2]).toEqual({
      name: "reheats leftovers",
      tier: "secondary",
    });
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("rejects a configured index with a missing key loudly", async () => {
    vi.stubEnv("PINECONE_API_KEY", "");
    installOpenAiMock(decomposition);

    await expect(decomposeLive("candidate oven", liveItems)).rejects.toThrow(
      LiveUnavailableError,
    );
  });
});
