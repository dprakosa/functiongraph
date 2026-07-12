import { describe, expect, it } from "vitest";
import inventoryFile from "../data/inventory.json";
import demoCacheFile from "../data/demoCache.json";
import { scoreProduct, specificityWeight, TIER_WEIGHTS } from "./scoring";
import { routeVerdict } from "./route";
import { norm } from "./text";
import type { DemoCacheFile, InventoryFile } from "./types";

const inventory = inventoryFile as InventoryFile;
const demoCache = demoCacheFile as unknown as DemoCacheFile;
const items = inventory.items;

function cachedEntry(chipText: string) {
  const entry = demoCache.entries[norm(chipText)];
  expect(entry, `demo cache entry for chip "${chipText}"`).toBeDefined();
  return entry;
}

describe("normative weights (ALG-3, ALG-4)", () => {
  it("uses IDF-style specificity", () => {
    expect(specificityWeight(0)).toBeCloseTo(1.0, 10);
    expect(specificityWeight(2)).toBeCloseTo(0.5, 10);
    expect(specificityWeight(6)).toBeCloseTo(1 / 3, 10);
  });

  it("weights tiers 1.0 / 0.4", () => {
    expect(TIER_WEIGHTS.primary).toBe(1.0);
    expect(TIER_WEIGHTS.secondary).toBe(0.4);
  });
});

describe("suggested product: heavy overlap — air fryer oven", () => {
  const oven = cachedEntry("Air fryer oven — $199");
  const verdict = scoreProduct(oven, items);

  it("covers 4 of 5", () => {
    expect(verdict.coveredCount).toBe(4);
    expect(verdict.totalCount).toBe(5);
  });

  it("scores 74% weighted coverage", () => {
    expect(Math.round(verdict.coverage * 100)).toBe(74);
  });

  it("finds exactly one new capability", () => {
    expect(verdict.newCapabilities).toEqual(["cooks food on rotisserie"]);
  });

  it("retains the internal price-per-new calculation", () => {
    expect(verdict.pricePerNewCapability).toBe(199);
  });

  it("names primary-tier best coverers (ALG-6)", () => {
    const rowByName = new Map(verdict.rows.map((row) => [row.capability, row]));
    expect(rowByName.get("bakes food")?.bestCoverer).toBe("Oven");
    expect(rowByName.get("toasts bread")?.bestCoverer).toBe("Toaster");
    expect(rowByName.get("reheats leftovers")?.bestCoverer).toBe("Microwave");
    expect(rowByName.get("toasts bread")?.covererCount).toBe(4);
  });

  it("routes to kitchen with 4 of 5 matches (SM-5)", () => {
    const route = routeVerdict(verdict, items);
    expect(route.domain).toBe("kitchen");
    expect(route.matchesInRoom).toBe(4);
    expect(route.totalCount).toBe(5);
  });
});

describe("suggested product: total redundancy — USB-C hub", () => {
  const cable = cachedEntry("USB-C hub — $79");
  const verdict = scoreProduct(cable, items);

  it("is 100 % covered", () => {
    expect(verdict.coverage).toBe(1);
    expect(verdict.coveredCount).toBe(verdict.totalCount);
  });

  it("buys nothing new: null price-per-new despite a known price (ALG-7)", () => {
    expect(verdict.newCapabilities).toEqual([]);
    expect(verdict.pricePerNewCapability).toBeNull();
  });

  it("routes to electronics", () => {
    expect(routeVerdict(verdict, items).domain).toBe("electronics");
  });
});

describe("suggested product: genuinely new — air purifier", () => {
  const drone = cachedEntry("Air purifier — $199");
  const verdict = scoreProduct(drone, items);

  it("is 0 % covered — the tool says yes (PR-3c)", () => {
    expect(verdict.coverage).toBe(0);
    expect(verdict.coveredCount).toBe(0);
  });

  it("does not dive — approval happens at home level (SM-5)", () => {
    expect(routeVerdict(verdict, items).domain).toBeNull();
  });

  it("prices each new function (ALG-7)", () => {
    expect(verdict.pricePerNewCapability).toBe(Math.round(199 / 4));
  });
});

describe("ALG-7 edge cases", () => {
  it("returns null price-per-new when price is unknown", () => {
    const verdict = scoreProduct(
      {
        price: null,
        capabilities: [{ name: "does something novel", tier: "primary" }],
      },
      items,
    );
    expect(verdict.pricePerNewCapability).toBeNull();
  });
});

describe("expanded-room routing", () => {
  it.each([
    [
      "garage",
      [
        { name: "drives screws", tier: "primary" as const },
        { name: "removes household dust", tier: "secondary" as const },
        { name: "inflates vehicle tires", tier: "secondary" as const },
      ],
    ],
    [
      "bathroom",
      [
        { name: "styles hair", tier: "primary" as const },
        { name: "massages gums", tier: "secondary" as const },
        { name: "trims facial hair", tier: "secondary" as const },
      ],
    ],
  ])("routes shared %s capabilities into their active room", (domain, capabilities) => {
    const verdict = scoreProduct({ price: null, capabilities }, items);
    expect(routeVerdict(verdict, items)).toMatchObject({
      domain,
      matchesInRoom: 3,
      totalCount: 3,
    });
  });
});
