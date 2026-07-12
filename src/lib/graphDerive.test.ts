import { describe, expect, it } from "vitest";
import inventoryFile from "../data/inventory.json";
import {
  deriveRoomHubs,
  deriveRooms,
  ghostEdgeId,
  inventoryEdgeId,
  ROOM_HUB_CAP,
  uniqueCapabilities,
} from "./graphDerive";
import type { InventoryFile } from "./types";

const inventory = inventoryFile as InventoryFile;
const items = inventory.items;

describe("hub promotion (ALG-8)", () => {
  it("promotes at most eight locally shared capabilities in every room", () => {
    deriveRooms(items).forEach((room) => {
      const hubs = deriveRoomHubs(items, room.label);
      expect(hubs.length).toBeLessThanOrEqual(ROOM_HUB_CAP);
      hubs.forEach((hub) => {
        expect(hub.domain).toBe(room.label);
        expect(hub.degree).toBeGreaterThanOrEqual(2);
      });
    });
  });

  it("includes every hub the demo arcs rely on", () => {
    const names = [
      ...deriveRoomHubs(items, "kitchen"),
      ...deriveRoomHubs(items, "electronics"),
    ].map((hub) => hub.name);
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

  it("marks local degree ≥ 4 hubs hot, including the usb-c hub", () => {
    const hubs = deriveRoomHubs(items, "electronics");
    const byName = new Map(hubs.map((hub) => [hub.name, hub]));
    expect(byName.get("charges usb-c devices")?.degree).toBe(5);
    expect(byName.get("charges usb-c devices")?.hot).toBe(true);
    hubs.forEach((hub) => expect(hub.hot).toBe(hub.degree >= 4));
  });

  it("produces sensible shared-function clusters in garage and bathroom", () => {
    expect(deriveRoomHubs(items, "garage").map((hub) => hub.name)).toEqual([
      "drives screws",
      "removes household dust",
    ]);
    expect(deriveRoomHubs(items, "bathroom").map((hub) => hub.name)).toEqual([
      "styles hair",
      "trims facial hair",
      "cleans teeth",
      "massages gums",
    ]);
  });
});

describe("room navigation and emergent clusters (ALG-9)", () => {
  it("groups rooms in deterministic inventory order", () => {
    const rooms = deriveRooms(items);
    expect(rooms.map((room) => room.label)).toEqual([
      "kitchen",
      "electronics",
      "garage",
      "bathroom",
    ]);
    expect(rooms.map((room) => room.itemIds.length)).toEqual([19, 18, 16, 11]);
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
