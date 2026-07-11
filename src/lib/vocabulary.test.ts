import { describe, expect, it } from "vitest";
import type { Item } from "./types";
import { deriveVocabulary } from "./vocabulary";

describe("deriveVocabulary (ALG-1)", () => {
  it("counts each owning item once and preserves its strongest tier", () => {
    const items: Item[] = [
      {
        id: "first",
        name: "First item",
        domain: "test",
        capabilities: [
          { name: "charges usb-c devices", tier: "secondary" },
          { name: "charges usb-c devices", tier: "primary" },
        ],
      },
      {
        id: "second",
        name: "Second item",
        domain: "test",
        capabilities: [
          { name: "charges usb-c devices", tier: "secondary" },
        ],
      },
    ];

    const entry = deriveVocabulary(items).get("charges usb-c devices");

    expect(entry?.degree).toBe(2);
    expect(entry?.owners).toEqual([
      { itemId: "first", itemName: "First item", tier: "primary" },
      { itemId: "second", itemName: "Second item", tier: "secondary" },
    ]);
  });
});
