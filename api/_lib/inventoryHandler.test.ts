import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./inventoryStore", () => ({
  InventoryStoreUnavailableError: class InventoryStoreUnavailableError extends Error {},
  createInventoryItems: vi.fn(),
  deleteInventoryItem: vi.fn(),
  listInventoryItems: vi.fn(),
  updateInventoryItem: vi.fn(),
}));

import {
  handleInventoryCollection,
  handleInventoryItem,
} from "./inventoryHandler";
import {
  createInventoryItems,
  deleteInventoryItem,
  InventoryStoreUnavailableError,
  listInventoryItems,
  updateInventoryItem,
} from "./inventoryStore";

const id = "f65cf02e-134f-4bb7-bec8-1c43767315c3";
const input = {
  name: "Toaster",
  domain: "kitchen" as const,
  quantity: 1,
  capabilities: [{ name: "toasts bread", tier: "primary" as const }],
};
const owned = {
  id,
  ...input,
  source: "photo" as const,
  createdAt: "2026-07-11T00:00:00.000Z",
  updatedAt: "2026-07-11T00:00:00.000Z",
};

describe("personal inventory handlers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an empty personal inventory without inserting guest data", async () => {
    vi.mocked(listInventoryItems).mockResolvedValue([]);

    await expect(
      handleInventoryCollection("GET", undefined, "user_empty"),
    ).resolves.toEqual({ status: 200, body: { items: [] } });
    expect(listInventoryItems).toHaveBeenCalledWith("user_empty");
    expect(createInventoryItems).not.toHaveBeenCalled();
  });

  it("validates a whole confirmation before one atomic store call", async () => {
    vi.mocked(createInventoryItems).mockResolvedValue([owned]);

    const response = await handleInventoryCollection(
      "POST",
      { items: [{ ...input, name: "  Toaster " }] },
      "user_a",
    );

    expect(response).toEqual({ status: 201, body: { items: [owned] } });
    expect(createInventoryItems).toHaveBeenCalledOnce();
    expect(createInventoryItems).toHaveBeenCalledWith("user_a", [input]);
  });

  it("rejects the entire batch before storage when one row is invalid", async () => {
    const response = await handleInventoryCollection(
      "POST",
      { items: [input, { ...input, domain: "bedroom" }] },
      "user_a",
    );

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ error: expect.any(String), hint: expect.any(String) });
    expect(createInventoryItems).not.toHaveBeenCalled();
  });

  it("scopes updates and deletes by the verified owner", async () => {
    vi.mocked(updateInventoryItem).mockResolvedValue({ ...owned, quantity: 2 });
    vi.mocked(deleteInventoryItem).mockResolvedValue(true);

    await expect(
      handleInventoryItem("PATCH", id, { quantity: 2 }, "user_a"),
    ).resolves.toEqual({
      status: 200,
      body: { item: { ...owned, quantity: 2 } },
    });
    await expect(
      handleInventoryItem("DELETE", id, undefined, "user_a"),
    ).resolves.toEqual({ status: 204 });
    expect(updateInventoryItem).toHaveBeenCalledWith("user_a", id, { quantity: 2 });
    expect(deleteInventoryItem).toHaveBeenCalledWith("user_a", id);
  });

  it("uses the same 404 for malformed, missing, and foreign ids", async () => {
    vi.mocked(updateInventoryItem).mockResolvedValue(null);
    vi.mocked(deleteInventoryItem).mockResolvedValue(false);

    const malformed = await handleInventoryItem(
      "PATCH",
      "not-a-uuid",
      { quantity: 2 },
      "user_a",
    );
    const foreign = await handleInventoryItem(
      "PATCH",
      id,
      { quantity: 2 },
      "user_b",
    );
    const missing = await handleInventoryItem(
      "DELETE",
      id,
      undefined,
      "user_a",
    );

    expect(malformed).toEqual(foreign);
    expect(foreign).toEqual(missing);
    expect(malformed.status).toBe(404);
  });

  it("sanitizes database failures", async () => {
    const storeError = new InventoryStoreUnavailableError();
    storeError.message = "private database detail";
    vi.mocked(listInventoryItems).mockRejectedValue(storeError);

    const response = await handleInventoryCollection("GET", undefined, "user_a");

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({ error: expect.any(String), hint: expect.any(String) });
    expect(JSON.stringify(response)).not.toContain("private database detail");
  });

  it("sanitizes item mutation failures without exposing database details", async () => {
    const storeError = new InventoryStoreUnavailableError();
    storeError.message = "private update detail";
    vi.mocked(updateInventoryItem).mockRejectedValue(storeError);

    const unavailable = await handleInventoryItem(
      "PATCH",
      id,
      { quantity: 2 },
      "user_a",
    );

    expect(unavailable.status).toBe(503);
    expect(unavailable.body).toMatchObject({
      error: expect.any(String),
      hint: expect.any(String),
    });
    expect(JSON.stringify(unavailable)).not.toContain("private update detail");

    vi.mocked(deleteInventoryItem).mockRejectedValue(
      new Error("private delete detail"),
    );
    const unexpected = await handleInventoryItem(
      "DELETE",
      id,
      undefined,
      "user_a",
    );
    expect(unexpected.status).toBe(500);
    expect(JSON.stringify(unexpected)).not.toContain("private delete detail");
  });
});
