/**
 * Thin client wrappers for the personal-inventory item endpoints (API-9).
 * The server validates and scopes every request; these only shape the fetch
 * and surface { error, hint } failures (API-5).
 */

import type {
  Capability,
  ConfirmedInventoryItemInput,
  InventoryScanCandidate,
  InventoryScanResult,
} from "../lib/types";

export interface InventoryItemPatch {
  name?: string;
  domain?: string;
  quantity?: number | null;
}

export class InventoryMutationError extends Error {
  readonly hint: string;
  readonly status: number | null;

  constructor(error: string, hint: string, status: number | null = null) {
    super(error);
    this.name = "InventoryMutationError";
    this.hint = hint;
    this.status = status;
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
    response.status,
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCapability(value: unknown): value is Capability {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    (value.tier === "primary" || value.tier === "secondary")
  );
}

function isScanCandidate(value: unknown): value is InventoryScanCandidate {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    (value.quantity === null ||
      (typeof value.quantity === "number" &&
        Number.isSafeInteger(value.quantity) &&
        value.quantity > 0)) &&
    (value.suggestedDomain === "kitchen" ||
      value.suggestedDomain === "electronics" ||
      value.suggestedDomain === "garage" ||
      value.suggestedDomain === "bathroom" ||
      value.suggestedDomain === "unclassified") &&
    (value.confidence === "high" ||
      value.confidence === "medium" ||
      value.confidence === "low") &&
    typeof value.evidence === "string" &&
    Array.isArray(value.capabilities) &&
    value.capabilities.length > 0 &&
    value.capabilities.every(isCapability)
  );
}

function isScanResult(value: unknown): value is InventoryScanResult {
  return (
    isRecord(value) &&
    value.needsReview === true &&
    Array.isArray(value.items) &&
    value.items.every(isScanCandidate) &&
    Array.isArray(value.warnings) &&
    value.warnings.every((warning) => typeof warning === "string")
  );
}

export async function scanInventoryPhoto(
  imageDataUrl: string,
  roomHint?: string,
  signal?: AbortSignal,
): Promise<InventoryScanResult> {
  const response = await fetch("/api/inventory/scan", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      imageDataUrl,
      ...(roomHint === undefined ? {} : { roomHint }),
    }),
    signal,
  });
  if (!response.ok) throw await readFailure(response);

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }
  if (!isScanResult(payload)) {
    throw new InventoryMutationError(
      "the photo scan returned invalid data",
      "Try again with a clearer, well-lit photo.",
    );
  }
  return payload;
}

export async function confirmInventoryItems(
  items: ConfirmedInventoryItemInput[],
  signal?: AbortSignal,
): Promise<void> {
  const confirmedItems = items.map((item) => ({
    name: item.name,
    domain: item.domain,
    quantity: item.quantity,
    capabilities: item.capabilities.map((capability) => ({
      name: capability.name,
      tier: capability.tier,
    })),
  }));
  const response = await fetch("/api/inventory/items", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ items: confirmedItems }),
    signal,
  });
  if (!response.ok) throw await readFailure(response);
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
