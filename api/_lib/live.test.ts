import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import demoCacheFile from "../../src/data/demoCache.json";
import inventoryFile from "../../src/data/inventory.json";
import type { Capability, Item } from "../../src/lib/types";
import {
  decomposeLive,
  finalizeCanonicalCapabilities,
  followsCapabilityNamingLaw,
  LiveUnavailableError,
  readLiveConfig,
  SNAP_THRESHOLD,
} from "./live";

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
