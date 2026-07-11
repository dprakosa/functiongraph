import type { VercelRequest, VercelResponse } from "@vercel/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/auth", () => ({ authenticateApiRequest: vi.fn() }));
vi.mock("../_lib/scanInventory", () => ({ handleInventoryScan: vi.fn() }));

import { authenticateApiRequest } from "../_lib/auth";
import { handleInventoryScan } from "../_lib/scanInventory";
import scanInventory from "./scan";

function responseMock() {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const setHeader = vi.fn();
  return {
    response: { status, setHeader } as unknown as VercelResponse,
    json,
    status,
    setHeader,
  };
}

describe("POST /api/inventory/scan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      ok: true,
      userId: "user_test",
    });
    vi.mocked(handleInventoryScan).mockResolvedValue({
      status: 200,
      body: { items: [], warnings: [], needsReview: true },
    });
  });

  it("authenticates and forwards the Clerk user id without caching", async () => {
    const { response, status, json, setHeader } = responseMock();
    const request = {
      method: "POST",
      body: { imageDataUrl: "data:image/jpeg;base64,aW1hZ2U=" },
      headers: {},
      socket: {},
    } as unknown as VercelRequest;

    await scanInventory(request, response);

    expect(setHeader).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(authenticateApiRequest).toHaveBeenCalledWith(request);
    expect(handleInventoryScan).toHaveBeenCalledWith(request.body, "user_test");
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ items: [], warnings: [], needsReview: true });
  });

  it("rejects other methods before authentication", async () => {
    const { response, status } = responseMock();
    await scanInventory({ method: "GET" } as VercelRequest, response);
    expect(status).toHaveBeenCalledWith(405);
    expect(authenticateApiRequest).not.toHaveBeenCalled();
  });

  it("passes through authentication failures", async () => {
    vi.mocked(authenticateApiRequest).mockResolvedValue({
      ok: false,
      status: 401,
      body: { error: "sign in", hint: "sign in and retry" },
    });
    const { response, status } = responseMock();
    await scanInventory(
      { method: "POST", headers: {}, socket: {} } as unknown as VercelRequest,
      response,
    );
    expect(status).toHaveBeenCalledWith(401);
    expect(handleInventoryScan).not.toHaveBeenCalled();
  });

  it("returns a shaped error for unexpected failures", async () => {
    vi.mocked(handleInventoryScan).mockRejectedValue(new Error("secret image"));
    const { response, status, json } = responseMock();
    await scanInventory(
      { method: "POST", headers: {}, socket: {} } as unknown as VercelRequest,
      response,
    );
    expect(status).toHaveBeenCalledWith(500);
    expect(JSON.stringify(json.mock.calls)).not.toContain("secret image");
  });
});
