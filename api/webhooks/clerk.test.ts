import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clerk/backend/webhooks", () => ({ verifyWebhook: vi.fn() }));
vi.mock("../_lib/inventoryStore", () => ({
  InventoryStoreUnavailableError: class InventoryStoreUnavailableError extends Error {},
  deleteInventoryForUser: vi.fn(),
}));

import { verifyWebhook } from "@clerk/backend/webhooks";
import {
  deleteInventoryForUser,
  InventoryStoreUnavailableError,
} from "../_lib/inventoryStore";
import { POST } from "./clerk";

const request = new Request("https://app.example.com/api/webhooks/clerk", {
  method: "POST",
  body: "{}",
});

describe("Clerk inventory-retention webhook", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects an invalid signature without touching inventory", async () => {
    vi.mocked(verifyWebhook).mockRejectedValue(new Error("private signature detail"));

    const response = await POST(request.clone());

    expect(response.status).toBe(400);
    expect(deleteInventoryForUser).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({ error: "webhook verification failed" });
  });

  it("ignores unrelated verified Clerk events", async () => {
    vi.mocked(verifyWebhook).mockResolvedValue({
      type: "user.updated",
      data: { id: "user_test" },
    } as Awaited<ReturnType<typeof verifyWebhook>>);

    const response = await POST(request.clone());

    expect(response.status).toBe(204);
    expect(deleteInventoryForUser).not.toHaveBeenCalled();
  });

  it("deletes only the verified deleted user's rows", async () => {
    vi.mocked(verifyWebhook).mockResolvedValue({
      type: "user.deleted",
      data: { id: "user_deleted" },
    } as Awaited<ReturnType<typeof verifyWebhook>>);
    vi.mocked(deleteInventoryForUser).mockResolvedValue(3);

    const response = await POST(request.clone());

    expect(response.status).toBe(204);
    expect(deleteInventoryForUser).toHaveBeenCalledWith("user_deleted");
  });

  it("returns a retryable failure when Neon cleanup is unavailable", async () => {
    vi.mocked(verifyWebhook).mockResolvedValue({
      type: "user.deleted",
      data: { id: "user_deleted" },
    } as Awaited<ReturnType<typeof verifyWebhook>>);
    const storeError = new InventoryStoreUnavailableError();
    storeError.message = "private Neon detail";
    vi.mocked(deleteInventoryForUser).mockRejectedValue(storeError);

    const response = await POST(request.clone());

    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("private Neon detail");
  });
});
