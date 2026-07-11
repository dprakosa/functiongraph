import type { VercelRequest, VercelResponse } from "@vercel/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/auth", () => ({ authenticateApiRequest: vi.fn() }));
vi.mock("../_lib/scanInventory", () => ({ handleInventoryScan: vi.fn() }));
vi.mock("../_lib/inventoryStore", () => ({
  InventoryStoreUnavailableError: class InventoryStoreUnavailableError extends Error {},
  listInventoryItems: vi.fn(),
}));

import { authenticateApiRequest } from "../_lib/auth";
import {
  InventoryStoreUnavailableError,
  listInventoryItems,
} from "../_lib/inventoryStore";
import { handleInventoryScan } from "../_lib/scanInventory";
import scanInventory from "./scan";

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
    vi.mocked(listInventoryItems).mockResolvedValue(personalItems);
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
    expect(listInventoryItems).toHaveBeenCalledWith("user_test");
    expect(handleInventoryScan).toHaveBeenCalledWith(
      request.body,
      "user_test",
      personalItems,
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ items: [], warnings: [], needsReview: true });
  });

  it("rejects other methods before authentication", async () => {
    const { response, status } = responseMock();
    await scanInventory({ method: "GET" } as VercelRequest, response);
    expect(status).toHaveBeenCalledWith(405);
    expect(authenticateApiRequest).not.toHaveBeenCalled();
    expect(listInventoryItems).not.toHaveBeenCalled();
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
    expect(listInventoryItems).not.toHaveBeenCalled();
    expect(handleInventoryScan).not.toHaveBeenCalled();
  });

  it("fails closed when personal inventory cannot be loaded", async () => {
    vi.mocked(listInventoryItems).mockRejectedValue(
      new InventoryStoreUnavailableError(),
    );
    const { response, status, json } = responseMock();

    await scanInventory(
      { method: "POST", headers: {}, socket: {} } as unknown as VercelRequest,
      response,
    );

    expect(handleInventoryScan).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(503);
    expect(json).toHaveBeenCalledWith({
      error: "personal inventory is temporarily unavailable",
      hint: "wait a moment and try the photo scan again",
    });
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
