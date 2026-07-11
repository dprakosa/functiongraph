import { deriveDomains } from "./graphDerive";
import { deriveVocabulary } from "./vocabulary";
import type { Item, Verdict } from "./types";

export interface RouteResult {
  /** Computed domain label to dive into, or null → no dive, approval state (SM-5). */
  domain: string | null;
  /** Covered rows attributable to that domain — the toast's "X of Y matches". */
  matchesInRoom: number;
  totalCount: number;
}

/**
 * SM-5 routing. Threshold rule (derived, see plan): each domain scores the sum
 * of covered-row weights it can cover with at least one owner; dive the
 * strongest domain iff at least one capability is covered at all. Zero covered
 * capabilities → no dive, ghost stays at home level, approval state (PR-3c).
 */
export function routeVerdict(verdict: Verdict, items: Item[]): RouteResult {
  const domains = deriveDomains(items);
  const vocabulary = deriveVocabulary(items);
  const domainByItemId = new Map<string, string>();
  domains.forEach((domain) => {
    domain.itemIds.forEach((itemId) => domainByItemId.set(itemId, domain.label));
  });

  const scores = new Map<string, { weight: number; matches: number }>();
  verdict.rows.forEach((row) => {
    if (!row.covered) return;
    const owners = vocabulary.get(row.capability)?.owners ?? [];
    const owningDomains = new Set(
      owners.map((owner) => domainByItemId.get(owner.itemId)!),
    );
    owningDomains.forEach((label) => {
      const score = scores.get(label) ?? { weight: 0, matches: 0 };
      score.weight += row.weight;
      score.matches += 1;
      scores.set(label, score);
    });
  });

  const best = [...scores.entries()].sort(
    (a, b) => b[1].weight - a[1].weight || a[0].localeCompare(b[0]),
  )[0];

  return {
    domain: best?.[0] ?? null,
    matchesInRoom: best?.[1].matches ?? 0,
    totalCount: verdict.totalCount,
  };
}
