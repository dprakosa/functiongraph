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
  resetEvaluateRateLimitForTests,
} from "./handler";

const guestItems = (inventoryFile as InventoryFile).items;

function handleEvaluate(rawBody: unknown, clientIp: string, items = guestItems) {
  return handleEvaluateWithItems(rawBody, clientIp, items);
}

describe("POST /api/evaluate handler", () => {
  afterEach(() => {
    resetEvaluateMemoForTests();
    resetEvaluateRateLimitForTests();
    vi.useRealTimers();
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

  it("charges only live misses to a time-bounded per-IP rate limit", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-12T00:00:00.000Z"));
    const decompose = vi.spyOn(live, "decomposeLive").mockImplementation(
      async (text) => ({
        name: text,
        price: null,
        capabilities: [{ name: "heats water", tier: "primary" }],
        altSuggestion: null,
      }),
    );

    const first = await handleEvaluate(
      { text: "uncached memoized rate product" },
      "rate-ip",
    );
    const memoHit = await handleEvaluate(
      { text: "uncached memoized rate product" },
      "rate-ip",
    );
    for (let index = 1; index < 10; index += 1) {
      const result = await handleEvaluate(
        { text: `uncached live product ${index}` },
        "rate-ip",
      );
      expect(result.status).toBe(200);
    }

    for (let index = 0; index < 5; index += 1) {
      const demo = await handleEvaluate(
        { text: "Convection countertop oven — $129" },
        "rate-ip",
      );
      expect(demo.status).toBe(200);
    }

    const limited = await handleEvaluate(
      { text: "uncached eleventh live product" },
      "rate-ip",
    );
    const otherIp = await handleEvaluate(
      { text: "uncached product from another device" },
      "other-ip",
    );

    expect(first.status).toBe(200);
    expect((first.body as EvaluateResult).cached).toBe(false);
    expect(memoHit.status).toBe(200);
    expect((memoHit.body as EvaluateResult).cached).toBe(true);
    expect(decompose).toHaveBeenCalledTimes(11);
    expect(limited).toEqual({
      status: 429,
      body: {
        error: "too many live evaluations from this device",
        hint: expect.stringContaining("wait a minute"),
      },
    });
    expect(otherIp.status).toBe(200);

    vi.setSystemTime(new Date("2026-07-12T00:01:00.001Z"));
    const afterWindow = await handleEvaluate(
      { text: "uncached product after the rate window" },
      "rate-ip",
    );
    expect(afterWindow.status).toBe(200);
    expect(decompose).toHaveBeenCalledTimes(12);
  });

  it("returns a sanitized actionable 422 for an unreadable live product", async () => {
    vi.spyOn(live, "decomposeLive").mockRejectedValue(
      new Error("private provider response"),
    );

    const result = await handleEvaluate(
      { text: "uncached unreadable live product" },
      "failure-ip",
    );

    expect(result).toEqual({
      status: 422,
      body: {
        error: "couldn't read a product out of that",
        hint: expect.stringContaining("describe one product"),
      },
    });
    expect(JSON.stringify(result)).not.toContain("private provider response");
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
