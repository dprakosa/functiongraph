import { describe, expect, it } from "vitest";
import inventoryFile from "./inventory.json";
import demoCacheFile from "./demoCache.json";
import { norm } from "../lib/text";
import { deriveVocabulary } from "../lib/vocabulary";
import type { DemoCacheFile, InventoryFile } from "../lib/types";

const inventory = inventoryFile as InventoryFile;
const demoCache = demoCacheFile as unknown as DemoCacheFile;

// DM-3: lowercase, present-tense verb + object, no brands/models/marketing.
// The verb+object grammar can't be machine-checked; shape and brand bans can.
const NAMING_LAW = /^[a-z][a-z0-9-]*( [a-z0-9-]+)+$/;
const BANNED_WORDS = ["breville", "ninja", "instant", "dji", "anker", "smart", "pro", "deluxe"];

function assertNamingLaw(name: string, where: string) {
  expect(name, `${where}: "${name}" must match the naming law`).toMatch(NAMING_LAW);
  BANNED_WORDS.forEach((banned) => {
    expect(
      name.split(/[ -]/),
      `${where}: "${name}" must not contain "${banned}"`,
    ).not.toContain(banned);
  });
}

describe("seed inventory (§13)", () => {
  it("has 19 items: 13 kitchen + 6 electronics", () => {
    expect(inventory.items).toHaveLength(19);
    expect(
      inventory.items.filter((item) => item.domain === "kitchen"),
    ).toHaveLength(13);
    expect(
      inventory.items.filter((item) => item.domain === "electronics"),
    ).toHaveLength(6);
  });

  it("is versioned JSON (DM-7)", () => {
    expect(inventory.version).toBe(1);
    expect(demoCache.version).toBe(1);
  });

  it("plants the weak links and the degree-6 hub", () => {
    const vocabulary = deriveVocabulary(inventory.items);
    expect(vocabulary.get("boils water")!.degree).toBeGreaterThanOrEqual(2);
    expect(vocabulary.get("keeps food warm")!.degree).toBeGreaterThanOrEqual(2);
    expect(vocabulary.get("charges usb-c devices")!.degree).toBe(6);
  });

  it("obeys the capability naming law (DM-3)", () => {
    inventory.items.forEach((item) => {
      item.capabilities.forEach((capability) =>
        assertNamingLaw(capability.name, `inventory item ${item.id}`),
      );
    });
  });
});

describe("demo cache (API-3, NFR-1)", () => {
  it("has an entry keyed by norm() of every try-these chip's exact text", () => {
    expect(demoCache.chips).toHaveLength(3);
    demoCache.chips.forEach((chip) => {
      expect(
        demoCache.entries[norm(chip)],
        `chip "${chip}" must resolve to a cache entry (drift routes it to the live path)`,
      ).toBeDefined();
    });
  });

  it("stores decompositions within DM-4 bounds (3–8 capabilities)", () => {
    Object.values(demoCache.entries).forEach((entry) => {
      expect(entry.capabilities.length).toBeGreaterThanOrEqual(3);
      expect(entry.capabilities.length).toBeLessThanOrEqual(8);
    });
  });

  it("obeys the capability naming law (DM-3)", () => {
    Object.values(demoCache.entries).forEach((entry) => {
      entry.capabilities.forEach((capability) =>
        assertNamingLaw(capability.name, `demo cache entry ${entry.name}`),
      );
    });
  });

  it("uses exact vocabulary strings for covered capabilities (ALG-2 pre-applied)", () => {
    const vocabulary = deriveVocabulary(inventory.items);
    const knownNew = new Set([
      "roasts large meals",
      "captures aerial photos",
      "records aerial video",
      "maintains aerial position",
      "flies preset routes",
    ]);
    Object.values(demoCache.entries).forEach((entry) => {
      entry.capabilities.forEach((capability) => {
        expect(
          vocabulary.has(capability.name) || knownNew.has(capability.name),
          `"${capability.name}" must either match vocabulary exactly or be an intended new capability`,
        ).toBe(true);
      });
    });
  });
});
