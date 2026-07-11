import { and, asc, eq } from "drizzle-orm";
import type {
  ConfirmedInventoryItemInput,
  OwnedInventoryItem,
} from "../../src/lib/types.js";
import { database } from "./db.js";
import {
  inventoryItems,
  type InventoryItemRow,
} from "./inventorySchema.js";
import type { InventoryItemUpdate } from "./inventoryValidation.js";

export class InventoryStoreUnavailableError extends Error {
  constructor() {
    super("inventory store unavailable");
    this.name = "InventoryStoreUnavailableError";
  }
}

function toOwnedInventoryItem(row: InventoryItemRow): OwnedInventoryItem {
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    quantity: row.quantity,
    capabilities: row.capabilities,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function execute<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof InventoryStoreUnavailableError) throw error;
    throw new InventoryStoreUnavailableError();
  }
}

export function listInventoryItems(userId: string): Promise<OwnedInventoryItem[]> {
  return execute(async () => {
    const rows = await database()
      .select()
      .from(inventoryItems)
      .where(eq(inventoryItems.clerkUserId, userId))
      .orderBy(asc(inventoryItems.createdAt), asc(inventoryItems.id));
    return rows.map(toOwnedInventoryItem);
  });
}

export function createInventoryItems(
  userId: string,
  items: ConfirmedInventoryItemInput[],
): Promise<OwnedInventoryItem[]> {
  return execute(async () => {
    const rows = await database()
      .insert(inventoryItems)
      .values(
        items.map((item) => ({
          clerkUserId: userId,
          name: item.name,
          domain: item.domain,
          quantity: item.quantity,
          capabilities: item.capabilities,
          source: "photo" as const,
        })),
      )
      .returning();
    return rows.map(toOwnedInventoryItem);
  });
}

export function updateInventoryItem(
  userId: string,
  id: string,
  update: InventoryItemUpdate,
): Promise<OwnedInventoryItem | null> {
  return execute(async () => {
    const rows = await database()
      .update(inventoryItems)
      .set({ ...update, updatedAt: new Date() })
      .where(
        and(
          eq(inventoryItems.id, id),
          eq(inventoryItems.clerkUserId, userId),
        ),
      )
      .returning();
    return rows[0] ? toOwnedInventoryItem(rows[0]) : null;
  });
}

export function deleteInventoryItem(
  userId: string,
  id: string,
): Promise<boolean> {
  return execute(async () => {
    const rows = await database()
      .delete(inventoryItems)
      .where(
        and(
          eq(inventoryItems.id, id),
          eq(inventoryItems.clerkUserId, userId),
        ),
      )
      .returning({ id: inventoryItems.id });
    return rows.length > 0;
  });
}

export function deleteInventoryForUser(userId: string): Promise<number> {
  return execute(async () => {
    const rows = await database()
      .delete(inventoryItems)
      .where(eq(inventoryItems.clerkUserId, userId))
      .returning({ id: inventoryItems.id });
    return rows.length;
  });
}
