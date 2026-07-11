/**
 * Core data model, per PDD.md §3 (DM-1..DM-6).
 * Field names and shapes are normative — do not rename without sign-off.
 */

export type Tier = "primary" | "secondary";

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

/** DM-7: storage is versioned JSON. */
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
