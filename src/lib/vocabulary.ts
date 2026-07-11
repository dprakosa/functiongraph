import { capSlug } from "./text.js";
import type { Item, Tier } from "./types.js";

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

      // ALG-1 defines degree as the number of owning items, not the number of
      // capability rows. Treat an item id as the owner identity and retain the
      // stronger tier if malformed input repeats a capability on that item.
      const existingOwner = entry.owners.find((owner) => owner.itemId === item.id);
      if (!existingOwner) {
        entry.owners.push({
          itemId: item.id,
          itemName: item.name,
          tier: capability.tier,
        });
        entry.degree = entry.owners.length;
      } else if (
        existingOwner.tier === "secondary" &&
        capability.tier === "primary"
      ) {
        existingOwner.tier = "primary";
      }
    });
  });
  return vocabulary;
}
