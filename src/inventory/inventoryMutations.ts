/**
 * Thin client wrappers for the personal-inventory item endpoints (API-9).
 * The server validates and scopes every request; these only shape the fetch
 * and surface { error, hint } failures (API-5).
 */

export interface InventoryItemPatch {
  name?: string;
  domain?: string;
  quantity?: number | null;
}

export class InventoryMutationError extends Error {
  hint: string;

  constructor(error: string, hint: string) {
    super(error);
    this.name = "InventoryMutationError";
    this.hint = hint;
  }
}

async function readFailure(response: Response): Promise<InventoryMutationError> {
  let payload: { error?: string; hint?: string } | undefined;
  try {
    payload = (await response.json()) as { error?: string; hint?: string };
  } catch {
    payload = undefined;
  }
  return new InventoryMutationError(
    payload?.error ?? "the inventory change failed",
    payload?.hint ?? "Wait a moment and try again.",
  );
}

export async function updateInventoryItem(
  id: string,
  patch: InventoryItemPatch,
): Promise<void> {
  const response = await fetch(`/api/inventory/items/${encodeURIComponent(id)}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw await readFailure(response);
}

export async function deleteInventoryItem(id: string): Promise<void> {
  const response = await fetch(`/api/inventory/items/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  if (!response.ok && response.status !== 204) throw await readFailure(response);
}
