import type { VercelRequest, VercelResponse } from "@vercel/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_lib/auth", () => ({
  authenticateEvaluateRequest: vi.fn(),
}));

vi.mock("./_lib/handler", () => ({
  handleEvaluate: vi.fn(),
}));

import evaluate from "./evaluate";
import { authenticateEvaluateRequest } from "./_lib/auth";
import { handleEvaluate } from "./_lib/handler";

describe("POST /api/evaluate production wrapper", () => {
  beforeEach(() => {
    vi.mocked(authenticateEvaluateRequest).mockResolvedValue({
      ok: true,
      userId: "user_test",
    });
  });

  it("returns an API-5 next step when the handler fails unexpectedly", async () => {
    vi.mocked(handleEvaluate).mockRejectedValueOnce(new Error("unexpected"));
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const request = {
      method: "POST",
      headers: {},
      socket: { remoteAddress: "test-ip" },
      body: { text: "test product" },
    } as unknown as VercelRequest;
    const response = { status } as unknown as VercelResponse;

    await evaluate(request, response);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: "evaluation failed unexpectedly",
      hint: "tap an example — those never touch the network",
    });
  });
});
