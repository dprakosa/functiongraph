import type { EvaluateError } from "../../src/lib/types.js";
import {
  createInventoryItems,
  deleteInventoryItem,
  InventoryStoreUnavailableError,
  listInventoryItems,
  updateInventoryItem,
} from "./inventoryStore.js";
import {
  InventoryValidationError,
  isInventoryItemId,
  parseCreateInventoryBody,
  parseUpdateInventoryBody,
} from "./inventoryValidation.js";

export interface InventoryHandlerResponse {
  status: number;
  body?: unknown;
}

const NOT_FOUND: EvaluateError = {
  error: "inventory item not found",
  hint: "refresh your inventory and choose an item that still exists",
};

const UNAVAILABLE: EvaluateError = {
  error: "personal inventory is temporarily unavailable",
  hint: "wait a moment and try loading your inventory again",
};

function failure(error: unknown): InventoryHandlerResponse {
  if (error instanceof InventoryValidationError) {
    return {
      status: 400,
      body: { error: error.message, hint: error.hint } satisfies EvaluateError,
    };
  }
  if (error instanceof InventoryStoreUnavailableError) {
    return { status: 503, body: UNAVAILABLE };
  }
  return { status: 500, body: UNAVAILABLE };
}

export async function handleInventoryCollection(
  method: "GET" | "POST",
  rawBody: unknown,
  userId: string,
): Promise<InventoryHandlerResponse> {
  try {
    if (method === "GET") {
      return { status: 200, body: { items: await listInventoryItems(userId) } };
    }
    const items = parseCreateInventoryBody(rawBody);
    return {
      status: 201,
      body: { items: await createInventoryItems(userId, items) },
    };
  } catch (error) {
    return failure(error);
  }
}

export async function handleInventoryItem(
  method: "PATCH" | "DELETE",
  id: unknown,
  rawBody: unknown,
  userId: string,
): Promise<InventoryHandlerResponse> {
  if (!isInventoryItemId(id)) return { status: 404, body: NOT_FOUND };

  try {
    if (method === "PATCH") {
      const item = await updateInventoryItem(
        userId,
        id,
        parseUpdateInventoryBody(rawBody),
      );
      return item
        ? { status: 200, body: { item } }
        : { status: 404, body: NOT_FOUND };
    }
    return (await deleteInventoryItem(userId, id))
      ? { status: 204 }
      : { status: 404, body: NOT_FOUND };
  } catch (error) {
    return failure(error);
  }
}
