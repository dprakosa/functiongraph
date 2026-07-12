import type { VercelRequest, VercelResponse } from "@vercel/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./_lib/auth", () => ({
  authenticateEvaluateRequest: vi.fn(),
}));

vi.mock("./_lib/handler", () => ({
  handleEvaluate: vi.fn(),
}));

vi.mock("./_lib/inventoryStore", () => ({
  InventoryStoreUnavailableError: class InventoryStoreUnavailableError extends Error {},
  listInventoryItems: vi.fn(),
}));

import evaluate from "./evaluate";
import { authenticateEvaluateRequest } from "./_lib/auth";
import { handleEvaluate } from "./_lib/handler";
import {
  InventoryStoreUnavailableError,
  listInventoryItems,
} from "./_lib/inventoryStore";

const personalItems = [
  {
    id: "f65cf02e-134f-4bb7-bec8-1c43767315c3",
    name: "Desk lamp",
    domain: "electronics" as const,
    quantity: 1,
    capabilities: [{ name: "lights desk", tier: "primary" as const }],
    source: "photo" as const,
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z",
  },
];

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
  const setHeader = vi.fn();
  return {
    response: { status, setHeader } as unknown as VercelResponse,
    status,
    json,
    setHeader,
  };
}

describe("POST /api/evaluate authentication boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateEvaluateRequest).mockResolvedValue({
      ok: true,
      userId: "user_test",
    });
    vi.mocked(listInventoryItems).mockResolvedValue(personalItems);
  });

  it("keeps the friendly 405 contract without invoking authentication", async () => {
    const outgoing = response();

    await evaluate(request({ method: "GET" }), outgoing.response);

    expect(outgoing.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "private, no-store",
    );
    expect(authenticateEvaluateRequest).not.toHaveBeenCalled();
    expect(listInventoryItems).not.toHaveBeenCalled();
    expect(handleEvaluate).not.toHaveBeenCalled();
    expect(listInventoryItems).not.toHaveBeenCalled();
    expect(outgoing.status).toHaveBeenCalledWith(405);
    expect(outgoing.json).toHaveBeenCalledWith({
      error: "that method isn't supported",
      hint: 'POST JSON like { "text": "convection oven" }',
    });
  });

  it("returns an actionable 401 and never reaches the handler without a session", async () => {
    const body = {
      error: "sign in to evaluate a live product",
      hint: "sign in and try again, or choose one of the suggested products",
    };
    vi.mocked(authenticateEvaluateRequest).mockResolvedValue({
      ok: false,
      status: 401,
      body,
    });
    const incoming = request();
    const outgoing = response();

    await evaluate(incoming, outgoing.response);

    expect(outgoing.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "private, no-store",
    );
    expect(authenticateEvaluateRequest).toHaveBeenCalledWith(incoming);
    expect(handleEvaluate).not.toHaveBeenCalled();
    expect(outgoing.status).toHaveBeenCalledWith(401);
    expect(outgoing.json).toHaveBeenCalledWith(body);
  });

  it("loads and passes only the authenticated user's inventory", async () => {
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

    expect(listInventoryItems).toHaveBeenCalledWith("user_test");
    expect(handleEvaluate).toHaveBeenCalledWith(
      { text: "uncached test product" },
      "203.0.113.8",
      personalItems,
    );
    expect(outgoing.status).toHaveBeenCalledWith(200);
    expect(outgoing.json).toHaveBeenCalledWith(result.body);
  });

  it("fails closed when personal inventory cannot be loaded", async () => {
    vi.mocked(listInventoryItems).mockRejectedValue(
      new InventoryStoreUnavailableError(),
    );
    const outgoing = response();

    await evaluate(request(), outgoing.response);

    expect(handleEvaluate).not.toHaveBeenCalled();
    expect(outgoing.status).toHaveBeenCalledWith(503);
    expect(outgoing.json).toHaveBeenCalledWith({
      error: "personal inventory is temporarily unavailable",
      hint: "wait a moment and try the evaluation again",
    });
  });
});
