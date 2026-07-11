import { describe, expect, it } from "vitest";
import {
  InventoryValidationError,
  isInventoryItemId,
  parseCreateInventoryBody,
  parseUpdateInventoryBody,
} from "./inventoryValidation";

const reviewedItem = {
  name: "  Toaster  ",
  domain: "kitchen",
  quantity: 2,
  capabilities: [{ name: "toasts bread", tier: "primary" }],
};

describe("inventory write validation", () => {
  it("accepts only reviewed persistence fields and normalizes the item name", () => {
    expect(parseCreateInventoryBody({ items: [reviewedItem] })).toEqual([
      {
        ...reviewedItem,
        name: "Toaster",
      },
    ]);
  });

  it("accepts a deliberate scan-candidate projection but not the review draft itself", () => {
    const candidate = {
      id: "candidate-1",
      name: "Toaster",
      quantity: 1,
      suggestedDomain: "kitchen",
      confidence: "high",
      evidence: "Two bread slots are visible.",
      capabilities: [{ name: "toasts bread", tier: "primary" }],
    };

    expect(() => parseCreateInventoryBody({ items: [candidate] })).toThrow(
      InventoryValidationError,
    );
    expect(
      parseCreateInventoryBody({
        items: [
          {
            name: candidate.name,
            domain: candidate.suggestedDomain,
            quantity: candidate.quantity,
            capabilities: candidate.capabilities,
          },
        ],
      }),
    ).toEqual([
      {
        name: "Toaster",
        domain: "kitchen",
        quantity: 1,
        capabilities: [{ name: "toasts bread", tier: "primary" }],
      },
    ]);
  });

  it.each([
    [undefined, "confirmation"],
    [{ items: [] }, "selected items"],
    [{ items: [reviewedItem], imageDataUrl: "private" }, "confirmation"],
    [{ items: [reviewedItem], warnings: ["private"] }, "confirmation"],
    [{ items: [{ ...reviewedItem, id: "candidate-1" }] }, "item"],
    [{ items: [{ ...reviewedItem, evidence: "visible slots" }] }, "item"],
    [{ items: [{ ...reviewedItem, confidence: "high" }] }, "item"],
    [{ items: [{ ...reviewedItem, domain: "bedroom" }] }, "room"],
    [{ items: [{ ...reviewedItem, quantity: 0 }] }, "quantity"],
    [{ items: [{ ...reviewedItem, name: "   " }] }, "name"],
    [{ items: [{ ...reviewedItem, capabilities: [] }] }, "capability list"],
    [
      {
        items: [
          {
            ...reviewedItem,
            capabilities: [{ name: "aerial photography", tier: "primary" }],
          },
        ],
      },
      "canonical",
    ],
    [
      {
        items: [
          {
            ...reviewedItem,
            capabilities: [
              { name: "toasts bread", tier: "primary" },
              { name: "toasts bread", tier: "secondary" },
            ],
          },
        ],
      },
      "duplicated",
    ],
  ])("rejects an invalid confirmation without returning private input", (body, fragment) => {
    expect(() => parseCreateInventoryBody(body)).toThrow(
      expect.objectContaining({
        name: "InventoryValidationError",
        message: expect.stringContaining(fragment),
        hint: expect.any(String),
      }),
    );
  });

  it("accepts a strict editable-field subset for updates", () => {
    expect(
      parseUpdateInventoryBody({ name: "  Kettle ", quantity: null }),
    ).toEqual({ name: "Kettle", quantity: null });
  });

  it.each([{}, { capabilities: [] }, { domain: "bedroom" }, { quantity: 1.5 }])(
    "rejects unsupported or invalid updates",
    (body) => {
      expect(() => parseUpdateInventoryBody(body)).toThrow(
        InventoryValidationError,
      );
    },
  );

  it("accepts UUID ids and rejects arbitrary path values", () => {
    expect(isInventoryItemId("f65cf02e-134f-4bb7-bec8-1c43767315c3")).toBe(true);
    expect(isInventoryItemId("../../another-user")).toBe(false);
    expect(isInventoryItemId(["f65cf02e-134f-4bb7-bec8-1c43767315c3"])).toBe(false);
  });
});
