import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ConfirmedInventoryItemInput } from "../../src/lib/types";
import {
  createInventoryItems,
  deleteInventoryForUser,
  deleteInventoryItem,
  InventoryStoreUnavailableError,
  listInventoryItems,
  updateInventoryItem,
} from "./inventoryStore";

const testDatabaseUrl = process.env.TEST_DATABASE_URL?.trim();
const integration = describe.skipIf(!testDatabaseUrl);
const userA = `test_a_${randomUUID()}`;
const userB = `test_b_${randomUUID()}`;
const atomicUser = `test_atomic_${randomUUID()}`;
const toaster: ConfirmedInventoryItemInput = {
  name: "Toaster",
  domain: "kitchen",
  quantity: 1,
  capabilities: [{ name: "toasts bread", tier: "primary" }],
};

integration("Neon inventory isolation", () => {
  beforeAll(() => {
    const url = new URL(testDatabaseUrl!);
    if (url.pathname !== "/functiongraph_test") {
      throw new Error(
        "TEST_DATABASE_URL must target the dedicated functiongraph_test database",
      );
    }
    process.env.DATABASE_URL = testDatabaseUrl;
  });

  afterAll(async () => {
    await Promise.all([
      deleteInventoryForUser(userA),
      deleteInventoryForUser(userB),
      deleteInventoryForUser(atomicUser),
    ]);
  });

  it("keeps reads, updates, and deletes scoped to the verified owner", async () => {
    expect(await listInventoryItems(userA)).toEqual([]);
    expect(await listInventoryItems(userB)).toEqual([]);

    const [ownedA] = await createInventoryItems(userA, [toaster]);
    const [ownedB] = await createInventoryItems(userB, [
      { ...toaster, name: "Second toaster" },
    ]);

    expect((await listInventoryItems(userA)).map((item) => item.id)).toEqual([
      ownedA.id,
    ]);
    expect((await listInventoryItems(userB)).map((item) => item.id)).toEqual([
      ownedB.id,
    ]);
    expect(await updateInventoryItem(userB, ownedA.id, { quantity: 2 })).toBeNull();
    expect(await deleteInventoryItem(userB, ownedA.id)).toBe(false);
    expect((await listInventoryItems(userA))[0].quantity).toBe(1);
  });

  it("rolls back the whole multi-row confirmation when one row violates storage constraints", async () => {
    await expect(
      createInventoryItems(atomicUser, [
        toaster,
        { ...toaster, name: "Invalid quantity", quantity: 0 },
      ]),
    ).rejects.toBeInstanceOf(InventoryStoreUnavailableError);
    await expect(listInventoryItems(atomicUser)).resolves.toEqual([]);
  });
});
