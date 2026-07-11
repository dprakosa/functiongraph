/**
 * Core data model, per PDD.md §3 (DM-1..DM-6).
 * Field names and shapes are normative — do not rename without sign-off.
 */

export type Tier = "primary" | "secondary";

export type InventoryDomain =
  | "kitchen"
  | "electronics"
  | "garage"
  | "bathroom";

/** DM-2 */
export interface Capability {
  name: string;
  tier: Tier;
}

/** DM-1 */
export interface Item {
  id: string;
  name: string;
  domain: string;
  quantity?: number | null;
  capabilities: Capability[];
}

/** DM-9: confirmed, Clerk-owned inventory returned by API-9. */
export interface OwnedInventoryItem extends Omit<Item, "domain"> {
  domain: InventoryDomain;
  quantity: number | null;
  source: "photo";
  createdAt: string;
  updatedAt: string;
}

/** DM-9: reviewed fields accepted by transactional confirmation. */
export interface ConfirmedInventoryItemInput {
  name: string;
  domain: InventoryDomain;
  quantity: number | null;
  capabilities: Capability[];
}

/** DM-6 */
export interface Row {
  capability: string;
  capSlug: string;
  tier: Tier;
  covered: boolean;
  bestCoverer: string | null;
  covererCount: number;
  weight: number;
}

/** DM-5 */
export interface Verdict {
  coverage: number;
  coveredCount: number;
  totalCount: number;
  rows: Row[];
  newCapabilities: string[];
  pricePerNewCapability: number | null;
}

/** API-4 decomposition shape (cached entries store exactly this, ALG-10). */
export interface ProductDecomposition {
  name: string;
  price: number | null;
  capabilities: Capability[];
  altSuggestion: string | null;
}

/** API-1 response */
export interface EvaluateResult extends ProductDecomposition {
  verdict: Verdict;
  cached: boolean;
}

/** API-5 error shape: failures always carry a next step. */
export interface EvaluateError {
  error: string;
  hint: string;
}

export type InventoryScanDomain = InventoryDomain | "unclassified";
export type InventoryScanConfidence = "high" | "medium" | "low";

/** API-7: provisional, review-required candidate produced from one photo. */
export interface InventoryScanCandidate {
  id: string;
  name: string;
  quantity: number | null;
  suggestedDomain: InventoryScanDomain;
  confidence: InventoryScanConfidence;
  evidence: string;
  capabilities: Capability[];
}

export interface InventoryScanResult {
  items: InventoryScanCandidate[];
  warnings: string[];
  needsReview: true;
}

/** DM-7: guest storage remains versioned JSON. */
export interface InventoryFile {
  version: number;
  unscannedRooms: string[];
  items: Item[];
}

export interface DemoCacheFile {
  version: number;
  chips: string[];
  entries: Record<string, ProductDecomposition>;
}
