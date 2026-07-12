import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { EvaluateResult } from "../lib/types";
import {
  evaluate,
  EvaluateFailure,
  TRY_THESE_CHIPS,
} from "./evaluateClient";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

const liveResult: EvaluateResult = {
  name: "Uncached kettle",
  price: null,
  capabilities: [{ name: "boils water", tier: "primary" }],
  verdict: {
    coverage: 0,
    coveredCount: 0,
    totalCount: 1,
    rows: [],
    newCapabilities: ["boils water"],
    pricePerNewCapability: null,
  },
  altSuggestion: null,
  cached: false,
};

describe("evaluation client resolution", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ["Air fryer oven — $199", 74],
    ["USB-C hub — $79", 100],
    ["Air purifier — $199", 0],
  ])(
    "resolves the exact demo chip %s without a network request",
    async (text, expectedCoverage) => {
      const result = await evaluate(text);

      expect(TRY_THESE_CHIPS).toContain(text);
      expect(fetch).not.toHaveBeenCalled();
      expect(result.cached).toBe(true);
      expect(Math.round(result.verdict.coverage * 100)).toBe(expectedCoverage);
    },
  );

  it("posts only unknown input as JSON and returns the server decomposition", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(liveResult));

    const result = await evaluate("an uncached electric kettle");

    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith("/api/evaluate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "an uncached electric kettle" }),
    });
    expect(result).toMatchObject({
      name: "Uncached kettle",
      cached: false,
    });
  });

  it("rescans a returned decomposition against the supplied active inventory", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(liveResult));

    const result = await evaluate("another uncached kettle", [
      {
        id: "personal-kettle",
        name: "Personal kettle",
        domain: "kitchen",
        capabilities: [{ name: "boils water", tier: "primary" }],
      },
    ]);

    expect(result.verdict.coveredCount).toBe(1);
    expect(result.verdict.rows[0].bestCoverer).toBe("Personal kettle");
  });

  it("maps a shaped API failure to EvaluateFailure without losing its next step", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse(
        {
          error: "too many live evaluations from this device",
          hint: "wait a minute and try again",
        },
        429,
      ),
    );

    await expect(evaluate("uncached rate-limited product")).rejects.toMatchObject({
      name: "Error",
      message: "too many live evaluations from this device",
      hint: "wait a minute and try again",
    });
  });

  it("returns an actionable offline failure when fetch rejects", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("private network detail"));

    const failure = await evaluate("uncached offline product").catch(
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(EvaluateFailure);
    expect(failure).toMatchObject({
      message: "the evaluation service didn't respond",
      hint: expect.stringContaining("check your connection"),
    });
    expect(JSON.stringify(failure)).not.toContain("private network detail");
  });
});
