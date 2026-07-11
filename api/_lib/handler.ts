import demoCacheFile from "../../src/data/demoCache.json" with { type: "json" };
import inventoryFile from "../../src/data/inventory.json" with { type: "json" };
import { norm } from "../../src/lib/text.js";
import { scoreProduct } from "../../src/lib/scoring.js";
import type {
  DemoCacheFile,
  EvaluateError,
  EvaluateResult,
  InventoryFile,
  ProductDecomposition,
} from "../../src/lib/types.js";
import { decomposeLive, LiveUnavailableError } from "./live.js";

const demoCache = demoCacheFile as unknown as DemoCacheFile;
const inventory = inventoryFile as InventoryFile;

export interface HandlerResponse {
  status: number;
  body: EvaluateResult | EvaluateError;
}

/** API-2 warm in-memory memo: decompositions only, verdicts always live (ALG-10). */
const memo = new Map<string, ProductDecomposition>();

/** API-6: minimal per-IP rate limit guarding the live path only. */
const LIVE_CALLS_PER_MINUTE = 10;
const liveCallLog = new Map<string, number[]>();

function liveRateLimited(clientIp: string, now: number): boolean {
  const recent = (liveCallLog.get(clientIp) ?? []).filter(
    (at) => now - at < 60_000,
  );
  liveCallLog.set(clientIp, recent);
  if (recent.length >= LIVE_CALLS_PER_MINUTE) return true;
  recent.push(now);
  return false;
}

const HINT_TAP_EXAMPLE = "tap an example — those never touch the network";

function ok(decomposition: ProductDecomposition, cached: boolean): HandlerResponse {
  return {
    status: 200,
    body: {
      ...decomposition,
      verdict: scoreProduct(decomposition, inventory.items),
      cached,
    },
  };
}

export async function handleEvaluate(
  rawBody: unknown,
  clientIp: string,
): Promise<HandlerResponse> {
  const text =
    rawBody && typeof rawBody === "object" && "text" in rawBody
      ? (rawBody as { text: unknown }).text
      : undefined;

  if (typeof text !== "string" || text.trim().length < 3) {
    return {
      status: 400,
      body: {
        error: "that's too short to evaluate",
        hint: "paste a product name — a few words is enough, or tap an example",
      },
    };
  }
  if (text.length > 1500) {
    return {
      status: 400,
      body: {
        error: "that's too long to evaluate",
        hint: "trim it to the product name and a short description",
      },
    };
  }

  const key = norm(text);
  if (!key) {
    return {
      status: 400,
      body: {
        error: "no product name found in that",
        hint: "use letters, not just symbols or numbers — or tap an example",
      },
    };
  }

  // API-2 (1): bundled demo cache — instant, offline-proof.
  const cachedEntry = demoCache.entries[key];
  if (cachedEntry) return ok(cachedEntry, true);

  // API-2 (2): warm in-memory memo.
  const memoEntry = memo.get(key);
  if (memoEntry) return ok(memoEntry, true);

  // API-2 (3): live decomposition → canonicalization → scoring.
  if (liveRateLimited(clientIp, Date.now())) {
    return {
      status: 429,
      body: {
        error: "too many live evaluations from this device",
        hint: `wait a minute before pasting another product, or ${HINT_TAP_EXAMPLE}`,
      },
    };
  }

  try {
    const decomposition = await decomposeLive(text, inventory.items);
    memo.set(key, decomposition);
    return ok(decomposition, false);
  } catch (error) {
    if (error instanceof LiveUnavailableError) {
      return {
        status: 503,
        body: { error: error.message, hint: HINT_TAP_EXAMPLE },
      };
    }
    return {
      status: 422,
      body: {
        error: "couldn't read a product out of that",
        hint: `describe one product in plain words, or ${HINT_TAP_EXAMPLE}`,
      },
    };
  }
}
