import { describe, expect, it } from "vitest";
import inventoryFile from "../data/inventory.json";
import {
  deriveDomains,
  deriveHubs,
  ghostEdgeId,
  HUB_CAP,
  inventoryEdgeId,
  uniqueCapabilities,
} from "./graphDerive";
import type { InventoryFile } from "./types";

const inventory = inventoryFile as InventoryFile;
const items = inventory.items;

describe("hub promotion (ALG-8)", () => {
  const hubs = deriveHubs(items);

  it("promotes exactly the shared (degree ≥ 2) capabilities within the cap", () => {
    expect(hubs.length).toBeLessThanOrEqual(HUB_CAP);
    hubs.forEach((hub) => expect(hub.degree).toBeGreaterThanOrEqual(2));
  });

  it("includes every hub the demo arcs rely on", () => {
    const names = hubs.map((hub) => hub.name);
    // Ghost edges must land on visible hubs (PR-3b): all four covered oven
    // capabilities and all three cable capabilities must be promoted.
    for (const required of [
      "bakes food",
      "toasts bread",
      "reheats leftovers",
      "keeps food warm",
      "charges usb-c devices",
      "transfers data between devices",
      "connects external displays",
    ]) {
      expect(names).toContain(required);
    }
  });

  it("marks degree ≥ 4 hubs hot, including the planted degree-6 usb-c hub", () => {
    const byName = new Map(hubs.map((hub) => [hub.name, hub]));
    expect(byName.get("charges usb-c devices")?.degree).toBe(6);
    expect(byName.get("charges usb-c devices")?.hot).toBe(true);
    expect(byName.get("bakes food")?.hot).toBe(false);
    hubs.forEach((hub) => expect(hub.hot).toBe(hub.degree >= 4));
  });

  it("keeps the planted weak links promoted", () => {
    const names = hubs.map((hub) => hub.name);
    expect(names).toContain("boils water");
    expect(names).toContain("keeps food warm");
  });
});

describe("domain emergence (ALG-9)", () => {
  it("computes kitchen and electronics as connected components — never from labels", () => {
    const domains = deriveDomains(items).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
    expect(domains.map((domain) => domain.label)).toEqual([
      "electronics",
      "kitchen",
    ]);
    expect(domains[0].itemIds).toHaveLength(6);
    expect(domains[1].itemIds).toHaveLength(13);
  });
});

describe("edge id contract (VIS-5)", () => {
  it("builds the exact strings rows resolve against", () => {
    expect(ghostEdgeId("roasts-large-meals")).toBe("ghost->roasts-large-meals");
    expect(inventoryEdgeId("air-fryer", "toasts-bread")).toBe(
      "e:air-fryer->toasts-bread",
    );
  });
});

describe("unique capability minis (VIS-2, DEM-3)", () => {
  it("blooms crisps food with hot air on the air fryer", () => {
    const airFryer = items.find((item) => item.id === "air-fryer")!;
    expect(uniqueCapabilities(airFryer, items)).toEqual([
      "crisps food with hot air",
    ]);
  });
});
