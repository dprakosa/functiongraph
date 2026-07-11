import { deriveVocabulary, type VocabEntry } from "./vocabulary";
import type { Item } from "./types";

/** ALG-8 tuning knobs (§13 — normative values). */
export const HUB_CAP = 12;
export const HOT_DEGREE = 4;
export const HUB_MIN_DEGREE = 2;

export interface Hub extends VocabEntry {
  hot: boolean;
}

/**
 * ALG-8: a capability is a visible hub iff degree ≥ 2, capped at the top 12
 * by degree (name as deterministic tie-break). degree ≥ 4 is "hot".
 */
export function deriveHubs(items: Item[]): Hub[] {
  return [...deriveVocabulary(items).values()]
    .filter((entry) => entry.degree >= HUB_MIN_DEGREE)
    .sort((a, b) => b.degree - a.degree || a.name.localeCompare(b.name))
    .slice(0, HUB_CAP)
    .map((entry) => ({ ...entry, hot: entry.degree >= HOT_DEGREE }));
}

export interface Domain {
  label: string;
  itemIds: string[];
}

/**
 * ALG-9: domains are connected components of the item–capability graph.
 * Membership is computed; the label is curated (majority of the items'
 * curated domain fields within the computed component).
 */
export function deriveDomains(items: Item[]): Domain[] {
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    let cursor = id;
    while (parent.get(cursor) !== cursor) {
      const next = parent.get(cursor)!;
      parent.set(cursor, root);
      cursor = next;
    }
    return root;
  };
  const union = (a: string, b: string) => {
    parent.set(find(a), find(b));
  };

  items.forEach((item) => parent.set(item.id, item.id));
  const firstOwnerByCapability = new Map<string, string>();
  items.forEach((item) => {
    item.capabilities.forEach((capability) => {
      const existing = firstOwnerByCapability.get(capability.name);
      if (existing) union(existing, item.id);
      else firstOwnerByCapability.set(capability.name, item.id);
    });
  });

  const components = new Map<string, Item[]>();
  items.forEach((item) => {
    const root = find(item.id);
    components.set(root, [...(components.get(root) ?? []), item]);
  });

  return [...components.values()].map((members) => {
    const labelCounts = new Map<string, number>();
    members.forEach((member) => {
      labelCounts.set(member.domain, (labelCounts.get(member.domain) ?? 0) + 1);
    });
    const label = [...labelCounts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0][0];
    return { label, itemIds: members.map((member) => member.id) };
  });
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
  const vocabulary = deriveVocabulary(items);
  return item.capabilities
    .filter((capability) => (vocabulary.get(capability.name)?.degree ?? 0) === 1)
    .map((capability) => capability.name);
}
