import { deriveVocabulary, type VocabEntry } from "./vocabulary";
import type { Item } from "./types";

/** ALG-8 tuning knobs (§13 — normative values). */
export const ROOM_HUB_CAP = 8;
export const HOT_DEGREE = 4;
export const HUB_MIN_DEGREE = 2;

export interface Hub extends VocabEntry {
  hot: boolean;
  domain: string;
}

/**
 * ALG-8: within one room, a capability is a visible hub iff degree ≥ 2,
 * capped at the top 8 by degree (name as deterministic tie-break).
 */
export function deriveRoomHubs(items: Item[], domain: string): Hub[] {
  const roomItems = items.filter((item) => item.domain === domain);
  return [...deriveVocabulary(roomItems).values()]
    .filter((entry) => entry.degree >= HUB_MIN_DEGREE)
    .sort((a, b) => b.degree - a.degree || a.name.localeCompare(b.name))
    .slice(0, ROOM_HUB_CAP)
    .map((entry) => ({
      ...entry,
      domain,
      hot: entry.degree >= HOT_DEGREE,
    }));
}

export interface Room {
  label: string;
  itemIds: string[];
}

/**
 * ALG-9: rooms are curated navigation groups. Their order is the first
 * appearance of each domain in inventory data; functional clusters inside
 * each room still emerge from shared-capability graph edges.
 */
export function deriveRooms(items: Item[]): Room[] {
  const roomItems = new Map<string, string[]>();
  items.forEach((item) => {
    roomItems.set(item.domain, [...(roomItems.get(item.domain) ?? []), item.id]);
  });
  return [...roomItems].map(([label, itemIds]) => ({ label, itemIds }));
}

/**
 * VIS-5 edge id contract — verdict rows resolve edges by these exact strings.
 */
export function ghostEdgeId(capSlugValue: string): string {
  return `ghost->${capSlugValue}`;
}

export function inventoryEdgeId(itemId: string, capSlugValue: string): string {
  return `e:${itemId}->${capSlugValue}`;
}

/** Degree-1 capabilities of an item — hidden minis until the item is expanded (VIS-2). */
export function uniqueCapabilities(item: Item, items: Item[]): string[] {
  const vocabulary = deriveVocabulary(
    items.filter((candidate) => candidate.domain === item.domain),
  );
  return item.capabilities
    .filter((capability) => (vocabulary.get(capability.name)?.degree ?? 0) === 1)
    .map((capability) => capability.name);
}
