import { afterEach, describe, expect, it, vi } from "vitest";
import inventoryFile from "../../src/data/inventory.json";
import type {
  EvaluateError,
  EvaluateResult,
  InventoryFile,
  Item,
} from "../../src/lib/types";
import * as live from "./live";
import {
  handleEvaluate as handleEvaluateWithItems,
  resetEvaluateMemoForTests,
} from "./handler";

const guestItems = (inventoryFile as InventoryFile).items;

function handleEvaluate(rawBody: unknown, clientIp: string, items = guestItems) {
  return handleEvaluateWithItems(rawBody, clientIp, items);
}

describe("POST /api/evaluate handler", () => {
  afterEach(() => {
    resetEvaluateMemoForTests();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("resolves demo-cache entries instantly with cached: true (API-2, NFR-1)", async () => {
    const { status, body } = await handleEvaluate(
      { text: "Convection countertop oven — $129" },
      "test-ip",
    );
    expect(status).toBe(200);
    const result = body as EvaluateResult;
    expect(result.cached).toBe(true);
    expect(result.name).toBe("Convection countertop oven");
    expect(result.verdict.coveredCount).toBe(4);
    expect(Math.round(result.verdict.coverage * 100)).toBe(75);
  });

  it("rescans cached decompositions against each caller's inventory", async () => {
    const empty = await handleEvaluate(
      { text: "Convection countertop oven — $129" },
      "test-empty",
      [],
    );
    const matchingItems: Item[] = [
      {
        id: "oven",
        name: "Oven",
        domain: "kitchen",
        capabilities: [
          { name: "bakes food", tier: "primary" },
          { name: "toasts bread", tier: "primary" },
          { name: "roasts food", tier: "primary" },
          { name: "reheats food", tier: "secondary" },
        ],
      },
    ];
    const matching = await handleEvaluate(
      { text: "Convection countertop oven — $129" },
      "test-matching",
      matchingItems,
    );

    expect((empty.body as EvaluateResult).verdict.coverage).toBe(0);
    expect((matching.body as EvaluateResult).verdict.coverage).toBeGreaterThan(0);
  });

  it("memoizes only a decomposition and rebuilds the verdict for the current items", async () => {
    const decomposition = {
      name: "Test water tool",
      price: null,
      capabilities: [{ name: "boils water", tier: "primary" as const }],
      altSuggestion: null,
    };
    const decompose = vi
      .spyOn(live, "decomposeLive")
      .mockResolvedValue(decomposition);
    const firstItems: Item[] = [
      {
        id: "first-kettle",
        name: "First kettle",
        domain: "kitchen",
        capabilities: [{ name: "boils water", tier: "primary" }],
      },
    ];
    const secondItems: Item[] = [
      {
        id: "second-kettle",
        name: "Second kettle",
        domain: "kitchen",
        capabilities: [{ name: "boils water", tier: "secondary" }],
      },
    ];

    const first = await handleEvaluate(
      { text: "uncached memo boundary product" },
      "memo-first",
      firstItems,
    );
    const second = await handleEvaluate(
      { text: "uncached memo boundary product" },
      "memo-second",
      secondItems,
    );

    expect(decompose).toHaveBeenCalledOnce();
    expect((first.body as EvaluateResult).cached).toBe(false);
    expect((second.body as EvaluateResult).cached).toBe(true);
    expect((first.body as EvaluateResult).verdict.rows[0].bestCoverer).toBe(
      "First kettle",
    );
    expect((second.body as EvaluateResult).verdict.rows[0].bestCoverer).toBe(
      "Second kettle",
    );
  });

  it("rejects too-short input with a hint, never a crash (API-5)", async () => {
    const { status, body } = await handleEvaluate({ text: "xy" }, "test-ip");
    expect(status).toBe(400);
    const failure = body as EvaluateError;
    expect(failure.hint).toBeTruthy();
    expect(failure.hint).not.toMatch(/sorry/i);
  });

  it("rejects over-length input (API-1: 3–1500 chars)", async () => {
    const { status } = await handleEvaluate(
      { text: "x".repeat(1501) },
      "test-ip",
    );
    expect(status).toBe(400);
  });

  it("rejects symbol-only garbage with a friendly hint (API-5)", async () => {
    const { status, body } = await handleEvaluate(
      { text: "$$$ !!! ***" },
      "test-ip",
    );
    expect(status).toBe(400);
    expect((body as EvaluateError).hint).toContain("example");
  });

  it("points unconfigured live path at the examples (API-5)", async () => {
    // Keep this deterministic even if the surrounding shell/CI has a live key.
    vi.stubEnv("OPENAI_API_KEY", "");
    const { status, body } = await handleEvaluate(
      { text: "an unusual product nobody cached" },
      "test-ip",
    );
    expect(status).toBe(503);
    expect((body as EvaluateError).hint).toBe(
      "tap an example — those never touch the network",
    );
  });
});
