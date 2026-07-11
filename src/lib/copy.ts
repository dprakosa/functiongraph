/**
 * Fixed key strings per §9 (CNT-1..6). UI copy uses the §2 vocabulary and
 * never substitutes synonyms; sentence case throughout.
 */

/** CNT-5: placeholder heuristic — replace with a per-category table if time allows. */
export const KG_PER_DOLLAR = 0.018;

export const copy = {
  coverageLine: (covered: number, total: number) => `${covered} of ${total} covered`,
  coverageSub: (percent: number) => `${percent} % of this, you already own`,
  deltaNew: (price: number, count: number, each: number) =>
    `Δ $${price} buys ${count} new function${count === 1 ? "" : "s"} — $${each} each`,
  deltaNothing: (price: number) => `Δ $${price} buys nothing you don't already own`,
  approval: "Genuinely new — nothing you own does this",
  rowSource: (coverer: string, covererCount: number) =>
    covererCount > 1 ? `${coverer} + ${covererCount - 1} more` : coverer,
  rowNew: "not owned — new",
  impact: (dollars: number, kg: number) =>
    `$${dollars} kept · ${kg.toFixed(1)} kg landfill avoided`,
  routeToast: (room: string, matches: number, total: number) =>
    `${room.charAt(0).toUpperCase()}${room.slice(1)} · ${matches} of ${total} matches`,
  routeNoMatch: "No matches anywhere — genuinely new",
  ghostLabel: (name: string, price: number | null) =>
    price != null ? `${name} · $${price} · considering` : `${name} · considering`,
  skipAction: "Skip this purchase",
  stillNeedAction: "I still need it",
  buyAction: "Buy anyway",
  reasonPrompt: "What's it for? teaches the graph",
  unscannedCta: "scan this room",
  unscannedToast:
    "This room isn't scanned yet — photo ingestion is on the roadmap. Kitchen and electronics are live.",
};
