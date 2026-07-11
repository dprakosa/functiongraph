import { capSlug } from "./text";
import { deriveVocabulary } from "./vocabulary";
import type { Item, ProductDecomposition, Row, Tier, Verdict } from "./types";

/** ALG-4 */
export const TIER_WEIGHTS: Record<Tier, number> = { primary: 1.0, secondary: 0.4 };

/** ALG-3: w_spec(c) = 1 / log2(2 + degree(c)) */
export function specificityWeight(degree: number): number {
  return 1 / Math.log2(2 + degree);
}

/**
 * ALG-5..ALG-7. Runs on every evaluation — cached and live products flow
 * through this identical math against the current inventory (ALG-10).
 * Coverage is asymmetric: over the considered product's capabilities only.
 */
export function scoreProduct(
  product: Pick<ProductDecomposition, "price" | "capabilities">,
  items: Item[],
): Verdict {
  const vocabulary = deriveVocabulary(items);

  const rows: Row[] = product.capabilities.map((capability) => {
    const entry = vocabulary.get(capability.name);
    const degree = entry?.degree ?? 0;
    const covered = degree >= 1;
    // ALG-6: prefer an owner holding the capability as primary, else any owner.
    const bestOwner = entry
      ? (entry.owners.find((owner) => owner.tier === "primary") ?? entry.owners[0])
      : undefined;
    return {
      capability: capability.name,
      capSlug: capSlug(capability.name),
      tier: capability.tier,
      covered,
      bestCoverer: bestOwner?.itemName ?? null,
      covererCount: degree,
      weight: specificityWeight(degree) * TIER_WEIGHTS[capability.tier],
    };
  });

  const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
  const coveredWeight = rows.reduce(
    (sum, row) => sum + (row.covered ? row.weight : 0),
    0,
  );
  const newCapabilities = rows
    .filter((row) => !row.covered)
    .map((row) => row.capability);

  return {
    coverage: totalWeight > 0 ? coveredWeight / totalWeight : 0,
    coveredCount: rows.filter((row) => row.covered).length,
    totalCount: rows.length,
    rows,
    newCapabilities,
    pricePerNewCapability:
      product.price != null && newCapabilities.length > 0
        ? Math.round(product.price / newCapabilities.length)
        : null,
  };
}
