import demoCacheFile from "../data/demoCache.json";
import inventoryFile from "../data/inventory.json";
import { norm } from "../lib/text";
import { scoreProduct } from "../lib/scoring";
import type {
  DemoCacheFile,
  EvaluateResult,
  InventoryFile,
  Item,
} from "../lib/types";

const demoCache = demoCacheFile as unknown as DemoCacheFile;
const inventory = inventoryFile as InventoryFile;

/** NFR-2: the three one-tap examples, one per demo arc. */
export const TRY_THESE_CHIPS: string[] = demoCache.chips;

export class EvaluateFailure extends Error {
  readonly hint: string;

  constructor(message: string, hint: string) {
    super(message);
    this.hint = hint;
  }
}

/**
 * NFR-1: scripted products resolve from the bundled demo cache without any
 * network hop — scored client-side through the same scoreProduct the server
 * uses (ALG-10). Everything else goes to POST /api/evaluate (API-1).
 */
export async function evaluate(
  text: string,
  items: Item[] = inventory.items,
): Promise<EvaluateResult> {
  const entry = demoCache.entries[norm(text)];
  if (entry) {
    return {
      ...entry,
      verdict: scoreProduct(entry, items),
      cached: true,
    };
  }

  let response: Response;
  try {
    response = await fetch("/api/evaluate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    throw new EvaluateFailure(
      "the evaluation service didn't respond",
      "check your connection or choose one of the suggested products",
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }

  if (!response.ok) {
    const failed = payload as { error?: string; hint?: string } | undefined;
    throw new EvaluateFailure(
      failed?.error ?? "evaluation failed",
      failed?.hint ?? "choose one of the suggested products and try again",
    );
  }
  const result = payload as EvaluateResult;
  return {
    ...result,
    // The server remains authoritative, while client-side rescoring keeps the
    // displayed graph aligned with the inventory that was actually loaded.
    verdict: scoreProduct(result, items),
  };
}
