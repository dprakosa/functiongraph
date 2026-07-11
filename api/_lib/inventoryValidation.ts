import type {
  Capability,
  ConfirmedInventoryItemInput,
  InventoryDomain,
} from "../../src/lib/types.js";
import { followsCapabilityNamingLaw } from "./live.js";

const ACTIVE_DOMAINS = new Set<InventoryDomain>([
  "kitchen",
  "electronics",
  "garage",
  "bathroom",
]);
const MAX_BATCH_SIZE = 20;
const MAX_NAME_LENGTH = 100;
const MAX_POSTGRES_INTEGER = 2_147_483_647;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class InventoryValidationError extends Error {
  readonly hint: string;

  constructor(message: string, hint: string) {
    super(message);
    this.name = "InventoryValidationError";
    this.hint = hint;
  }
}

export interface InventoryItemUpdate {
  name?: string;
  domain?: InventoryDomain;
  quantity?: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  return Object.keys(value).sort().join(",") === [...expected].sort().join(",");
}

function parseName(value: unknown): string {
  if (typeof value !== "string") {
    throw new InventoryValidationError(
      "an inventory item name is missing",
      "give every selected item a short, recognizable name",
    );
  }
  const name = value.trim();
  if (!name || name.length > MAX_NAME_LENGTH) {
    throw new InventoryValidationError(
      "an inventory item name isn't valid",
      `use a name between 1 and ${MAX_NAME_LENGTH} characters`,
    );
  }
  return name;
}

function parseDomain(value: unknown): InventoryDomain {
  if (typeof value !== "string" || !ACTIVE_DOMAINS.has(value as InventoryDomain)) {
    throw new InventoryValidationError(
      "an inventory room isn't valid",
      "choose kitchen, electronics, garage, or bathroom",
    );
  }
  return value as InventoryDomain;
}

function parseQuantity(value: unknown): number | null {
  if (value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_POSTGRES_INTEGER
  ) {
    throw new InventoryValidationError(
      "an inventory quantity isn't valid",
      "use a positive whole number, or leave quantity empty",
    );
  }
  return value;
}

function parseCapabilities(value: unknown): Capability[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 6) {
    throw new InventoryValidationError(
      "an inventory capability list isn't valid",
      "confirm an item with between 1 and 6 detected capabilities",
    );
  }

  const capabilities = value.map((entry) => {
    if (!isRecord(entry) || !hasExactKeys(entry, ["name", "tier"])) {
      throw new InventoryValidationError(
        "an inventory capability isn't valid",
        "return to photo review and scan that item again",
      );
    }
    if (
      typeof entry.name !== "string" ||
      entry.name !== entry.name.trim() ||
      entry.name.length > MAX_NAME_LENGTH ||
      !followsCapabilityNamingLaw(entry.name) ||
      (entry.tier !== "primary" && entry.tier !== "secondary")
    ) {
      throw new InventoryValidationError(
        "an inventory capability isn't canonical",
        "return to photo review and use the detected capabilities unchanged",
      );
    }
    return { name: entry.name, tier: entry.tier } as Capability;
  });

  if (new Set(capabilities.map((capability) => capability.name)).size !== capabilities.length) {
    throw new InventoryValidationError(
      "an inventory capability is duplicated",
      "return to photo review and scan that item again",
    );
  }
  return capabilities;
}

export function parseCreateInventoryBody(
  rawBody: unknown,
): ConfirmedInventoryItemInput[] {
  if (!isRecord(rawBody) || !hasExactKeys(rawBody, ["items"])) {
    throw new InventoryValidationError(
      "the inventory confirmation isn't valid",
      'send JSON shaped like { "items": [...] }',
    );
  }
  if (
    !Array.isArray(rawBody.items) ||
    rawBody.items.length < 1 ||
    rawBody.items.length > MAX_BATCH_SIZE
  ) {
    throw new InventoryValidationError(
      "the inventory confirmation needs selected items",
      `select between 1 and ${MAX_BATCH_SIZE} reviewed items`,
    );
  }

  return rawBody.items.map((entry) => {
    if (
      !isRecord(entry) ||
      !hasExactKeys(entry, ["name", "domain", "quantity", "capabilities"])
    ) {
      throw new InventoryValidationError(
        "an inventory item isn't valid",
        "confirm only its reviewed name, room, quantity, and capabilities",
      );
    }
    return {
      name: parseName(entry.name),
      domain: parseDomain(entry.domain),
      quantity: parseQuantity(entry.quantity),
      capabilities: parseCapabilities(entry.capabilities),
    };
  });
}

export function parseUpdateInventoryBody(rawBody: unknown): InventoryItemUpdate {
  if (!isRecord(rawBody)) {
    throw new InventoryValidationError(
      "the inventory update isn't valid",
      "send one or more editable name, domain, or quantity fields",
    );
  }
  const keys = Object.keys(rawBody);
  if (
    keys.length === 0 ||
    keys.some((key) => key !== "name" && key !== "domain" && key !== "quantity")
  ) {
    throw new InventoryValidationError(
      "the inventory update contains unsupported fields",
      "edit only the item's name, room, or quantity",
    );
  }

  const update: InventoryItemUpdate = {};
  if ("name" in rawBody) update.name = parseName(rawBody.name);
  if ("domain" in rawBody) update.domain = parseDomain(rawBody.domain);
  if ("quantity" in rawBody) update.quantity = parseQuantity(rawBody.quantity);
  return update;
}

export function isInventoryItemId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}
