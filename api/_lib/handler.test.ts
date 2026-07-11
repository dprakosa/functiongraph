import { describe, expect, it } from "vitest";
import { handleEvaluate } from "./handler";
import type { EvaluateError, EvaluateResult } from "../../src/lib/types";

describe("POST /api/evaluate handler", () => {
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
    // No OPENAI_API_KEY in the test environment.
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
