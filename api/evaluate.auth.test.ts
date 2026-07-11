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

function request(
  overrides: Partial<VercelRequest> = {},
): VercelRequest {
  return {
    method: "POST",
    headers: {},
    socket: { remoteAddress: "socket-ip" },
    body: { text: "uncached test product" },
    ...overrides,
  } as unknown as VercelRequest;
}

function response() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  return {
    response: { status } as unknown as VercelResponse,
    status,
    json,
  };
}

describe("POST /api/evaluate authentication boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateEvaluateRequest).mockResolvedValue({
      ok: true,
      userId: "user_test",
    });
  });

  it("keeps the friendly 405 contract without invoking authentication", async () => {
    const outgoing = response();

    await evaluate(request({ method: "GET" }), outgoing.response);

    expect(authenticateEvaluateRequest).not.toHaveBeenCalled();
    expect(handleEvaluate).not.toHaveBeenCalled();
    expect(outgoing.status).toHaveBeenCalledWith(405);
    expect(outgoing.json).toHaveBeenCalledWith({
      error: "that method isn't supported",
      hint: 'POST JSON like { "text": "convection oven" }',
    });
  });

  it("returns an actionable 401 and never reaches the handler without a session", async () => {
    const body = {
      error: "sign in to evaluate a live product",
      hint: "sign in and try again, or tap an example — those never touch the network",
    };
    vi.mocked(authenticateEvaluateRequest).mockResolvedValue({
      ok: false,
      status: 401,
      body,
    });
    const incoming = request();
    const outgoing = response();

    await evaluate(incoming, outgoing.response);

    expect(authenticateEvaluateRequest).toHaveBeenCalledWith(incoming);
    expect(handleEvaluate).not.toHaveBeenCalled();
    expect(outgoing.status).toHaveBeenCalledWith(401);
    expect(outgoing.json).toHaveBeenCalledWith(body);
  });

  it("passes a valid session into the unchanged evaluation handler", async () => {
    const result: Awaited<ReturnType<typeof handleEvaluate>> = {
      status: 200,
      body: {
        name: "Test product",
        price: null,
        capabilities: [],
        verdict: {
          coverage: 0,
          coveredCount: 0,
          totalCount: 0,
          rows: [],
          newCapabilities: [],
          pricePerNewCapability: null,
        },
        altSuggestion: null,
        cached: false,
      },
    };
    vi.mocked(handleEvaluate).mockResolvedValue(result);
    const incoming = request({
      headers: { "x-forwarded-for": "203.0.113.8, 10.0.0.2" },
    });
    const outgoing = response();

    await evaluate(incoming, outgoing.response);

    expect(handleEvaluate).toHaveBeenCalledWith(
      { text: "uncached test product" },
      "203.0.113.8",
    );
    expect(outgoing.status).toHaveBeenCalledWith(200);
    expect(outgoing.json).toHaveBeenCalledWith(result.body);
  });
});
