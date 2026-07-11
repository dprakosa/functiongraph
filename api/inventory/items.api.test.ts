import type { VercelRequest, VercelResponse } from "@vercel/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../_lib/auth", () => ({ authenticateInventoryRequest: vi.fn() }));
vi.mock("../_lib/inventoryHandler", () => ({
  handleInventoryCollection: vi.fn(),
  handleInventoryItem: vi.fn(),
}));

import { authenticateInventoryRequest } from "../_lib/auth";
import {
  handleInventoryCollection,
  handleInventoryItem,
} from "../_lib/inventoryHandler";
import inventoryCollection from "./items";
import inventoryItem from "./items/[id]";

function responseMock() {
  const json = vi.fn();
  const end = vi.fn();
  const status = vi.fn(() => ({ json, end }));
  const setHeader = vi.fn();
  return {
    response: { status, setHeader } as unknown as VercelResponse,
    json,
    end,
    status,
    setHeader,
  };
}

function request(overrides: Partial<VercelRequest> = {}): VercelRequest {
  return {
    method: "GET",
    headers: {},
    socket: {},
    query: {},
    ...overrides,
  } as unknown as VercelRequest;
}

describe("personal inventory API wrappers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authenticateInventoryRequest).mockResolvedValue({
      ok: true,
      userId: "user_test",
    });
  });

  it("authenticates GET and passes only the verified owner to the collection handler", async () => {
    vi.mocked(handleInventoryCollection).mockResolvedValue({
      status: 200,
      body: { items: [] },
    });
    const incoming = request();
    const outgoing = responseMock();

    await inventoryCollection(incoming, outgoing.response);

    expect(outgoing.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "private, no-store",
    );
    expect(outgoing.setHeader).toHaveBeenCalledWith("Allow", "GET, POST");
    expect(authenticateInventoryRequest).toHaveBeenCalledWith(incoming);
    expect(handleInventoryCollection).toHaveBeenCalledWith(
      "GET",
      undefined,
      "user_test",
    );
    expect(outgoing.status).toHaveBeenCalledWith(200);
    expect(outgoing.json).toHaveBeenCalledWith({ items: [] });
  });

  it("forwards only the authenticated confirmation request to the collection handler", async () => {
    const body = {
      items: [
        {
          name: "Toaster",
          domain: "kitchen",
          quantity: 1,
          capabilities: [{ name: "toasts bread", tier: "primary" }],
        },
      ],
    };
    const created = {
      items: [
        {
          id: "f65cf02e-134f-4bb7-bec8-1c43767315c3",
          ...body.items[0],
          source: "photo",
          createdAt: "2026-07-12T00:00:00.000Z",
          updatedAt: "2026-07-12T00:00:00.000Z",
        },
      ],
    };
    vi.mocked(handleInventoryCollection).mockResolvedValue({
      status: 201,
      body: created,
    });
    const incoming = request({ method: "POST", body });
    const outgoing = responseMock();

    await inventoryCollection(incoming, outgoing.response);

    expect(outgoing.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "private, no-store",
    );
    expect(authenticateInventoryRequest).toHaveBeenCalledWith(incoming);
    expect(handleInventoryCollection).toHaveBeenCalledWith(
      "POST",
      body,
      "user_test",
    );
    expect(outgoing.status).toHaveBeenCalledWith(201);
    expect(outgoing.json).toHaveBeenCalledWith(created);
  });

  it("rejects unsupported collection methods before authentication", async () => {
    const outgoing = responseMock();

    await inventoryCollection(request({ method: "PUT" }), outgoing.response);

    expect(outgoing.status).toHaveBeenCalledWith(405);
    expect(authenticateInventoryRequest).not.toHaveBeenCalled();
    expect(handleInventoryCollection).not.toHaveBeenCalled();
  });

  it("stops on authentication failure", async () => {
    vi.mocked(authenticateInventoryRequest).mockResolvedValue({
      ok: false,
      status: 401,
      body: { error: "sign in", hint: "sign in and retry" },
    });
    const outgoing = responseMock();

    await inventoryCollection(request(), outgoing.response);

    expect(outgoing.status).toHaveBeenCalledWith(401);
    expect(handleInventoryCollection).not.toHaveBeenCalled();
  });

  it("forwards a single path id and emits an empty 204 delete response", async () => {
    vi.mocked(handleInventoryItem).mockResolvedValue({ status: 204 });
    const incoming = request({
      method: "DELETE",
      query: { id: "f65cf02e-134f-4bb7-bec8-1c43767315c3" },
    });
    const outgoing = responseMock();

    await inventoryItem(incoming, outgoing.response);

    expect(outgoing.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "private, no-store",
    );
    expect(handleInventoryItem).toHaveBeenCalledWith(
      "DELETE",
      "f65cf02e-134f-4bb7-bec8-1c43767315c3",
      undefined,
      "user_test",
    );
    expect(outgoing.status).toHaveBeenCalledWith(204);
    expect(outgoing.end).toHaveBeenCalledOnce();
    expect(outgoing.json).not.toHaveBeenCalled();
  });

  it("forwards an authenticated patch and returns only the confirmed item", async () => {
    const id = "f65cf02e-134f-4bb7-bec8-1c43767315c3";
    const body = { name: "Countertop toaster", quantity: null };
    const item = {
      id,
      name: "Countertop toaster",
      domain: "kitchen",
      quantity: null,
      capabilities: [{ name: "toasts bread", tier: "primary" }],
      source: "photo",
      createdAt: "2026-07-12T00:00:00.000Z",
      updatedAt: "2026-07-12T00:01:00.000Z",
    };
    vi.mocked(handleInventoryItem).mockResolvedValue({
      status: 200,
      body: { item },
    });
    const incoming = request({ method: "PATCH", query: { id }, body });
    const outgoing = responseMock();

    await inventoryItem(incoming, outgoing.response);

    expect(outgoing.setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "private, no-store",
    );
    expect(authenticateInventoryRequest).toHaveBeenCalledWith(incoming);
    expect(handleInventoryItem).toHaveBeenCalledWith(
      "PATCH",
      id,
      body,
      "user_test",
    );
    expect(outgoing.status).toHaveBeenCalledWith(200);
    expect(outgoing.json).toHaveBeenCalledWith({ item });
  });

  it("rejects unsupported item methods before authentication", async () => {
    const outgoing = responseMock();

    await inventoryItem(request({ method: "GET" }), outgoing.response);

    expect(outgoing.status).toHaveBeenCalledWith(405);
    expect(authenticateInventoryRequest).not.toHaveBeenCalled();
    expect(handleInventoryItem).not.toHaveBeenCalled();
  });
});
