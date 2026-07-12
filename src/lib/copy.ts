/**
 * Fixed key strings per §9 (CNT-1..6). UI copy uses the §2 vocabulary and
 * never substitutes synonyms; sentence case throughout.
 */

export const copy = {
  coverageLine: (covered: number, total: number) => `${covered} of ${total} covered`,
  coverageSub: (percent: number) => `${percent}% of its uses are already covered`,
  approval: "This would add something new",
  rowSource: (coverer: string, covererCount: number) =>
    covererCount > 1 ? `${coverer} + ${covererCount - 1} more` : coverer,
  rowNew: "not in your inventory",
  routeToast: (room: string, matches: number, total: number) =>
    `${room.charAt(0).toUpperCase()}${room.slice(1)} · ${matches} of ${total} matches`,
  routeNoMatch: "Nothing in your inventory already does this",
  ghostLabel: (name: string, price: number | null) =>
    price != null ? `${name} · $${price} · considering` : `${name} · considering`,
  skipAction: "Skip this purchase",
  stillNeedAction: "I still need it",
  buyAction: "Buy anyway",
  reasonPrompt: "Why do you still need it?",
  unscannedCta: "scan this room",
  unscannedToast:
    "Add items from this room to include them in future comparisons.",
};
