import { capSlug } from "./text";
import type { Item, Tier } from "./types";

/**
 * ALG-1: the capability vocabulary is derived from the inventory at load.
 * Nothing here is maintained by hand.
 */

export interface VocabOwner {
  itemId: string;
  itemName: string;
  tier: Tier;
}

export interface VocabEntry {
  name: string;
  slug: string;
  degree: number;
  owners: VocabOwner[];
}

export function deriveVocabulary(items: Item[]): Map<string, VocabEntry> {
  const vocabulary = new Map<string, VocabEntry>();
  items.forEach((item) => {
    item.capabilities.forEach((capability) => {
      let entry = vocabulary.get(capability.name);
      if (!entry) {
        entry = {
          name: capability.name,
          slug: capSlug(capability.name),
          degree: 0,
          owners: [],
        };
        vocabulary.set(capability.name, entry);
      }
      entry.degree += 1;
      entry.owners.push({
        itemId: item.id,
        itemName: item.name,
        tier: capability.tier,
      });
    });
  });
  return vocabulary;
}
