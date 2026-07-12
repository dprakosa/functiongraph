/**
 * Local persistence for purchase decisions (Skip / Bought anyway). Device
 * scoped by design: decisions are personal judgment calls, not inventory, so
 * they stay in localStorage until a backend sync is warranted.
 */

export interface PurchaseDecision {
  id: string;
  product: string;
  price: number | null;
  coverage: number;
  coveredCount: number;
  totalCount: number;
  choice: "skipped" | "bought";
  reason: string | null;
  decidedAt: string;
}

const STORAGE_KEY = "functiongraph:decisions:v1";

function isDecision(value: unknown): value is PurchaseDecision {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.product === "string" &&
    (candidate.price === null || typeof candidate.price === "number") &&
    typeof candidate.coverage === "number" &&
    typeof candidate.coveredCount === "number" &&
    typeof candidate.totalCount === "number" &&
    (candidate.choice === "skipped" || candidate.choice === "bought") &&
    (candidate.reason === null || typeof candidate.reason === "string") &&
    typeof candidate.decidedAt === "string"
  );
}

export function readDecisions(): PurchaseDecision[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isDecision);
  } catch {
    return [];
  }
}

export function appendDecision(
  decision: Omit<PurchaseDecision, "id" | "decidedAt">,
): void {
  try {
    const next: PurchaseDecision = {
      ...decision,
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      decidedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([next, ...readDecisions()]),
    );
  } catch {
    // Storage may be unavailable (private mode, quota); the decision flow
    // must never break because history could not be written.
  }
}

export function clearDecisions(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
