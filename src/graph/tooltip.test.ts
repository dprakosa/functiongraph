import { describe, expect, it } from "vitest";
import type { Phase } from "../state/appReducer";
import {
  deriveGraphNodeTooltip,
  placeGraphTooltip,
  type TooltipRect,
} from "./tooltip";

function rect(
  left: number,
  top: number,
  width: number,
  height: number,
): TooltipRect {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
  };
}

const phaseCases = [
  ["resting", "Ready"],
  ["extracting", "Reading product"],
  ["scanning", "Comparing inventory"],
  ["routing", "Finding matches"],
  ["settling", "Preparing result"],
  ["verdict", "Result ready"],
] satisfies ReadonlyArray<readonly [Phase, string]>;

describe("deriveGraphNodeTooltip", () => {
  it("describes a scanned room", () => {
    expect(
      deriveGraphNodeTooltip({
        kind: "room",
        name: "kitchen",
        itemCount: 13,
        hotspotCount: 2,
      }),
    ).toEqual({
      kind: "room",
      eyebrow: "Room",
      title: "Kitchen",
      details: [
        { label: "Items", value: "13" },
        { label: "Hotspots", value: "2" },
      ],
      action: "Enter room",
    });
  });

  it("describes an unscanned room", () => {
    expect(
      deriveGraphNodeTooltip({ kind: "room-unscanned", name: "laundry" }),
    ).toEqual({
      kind: "room-unscanned",
      eyebrow: "Unscanned room",
      title: "Laundry",
      status: "Not scanned",
      details: [],
      action: "Scan this room",
    });
  });

  it("describes an owned item with a positive quantity and a deterministic preview", () => {
    const source = {
      kind: "item" as const,
      name: "Stand mixer",
      domain: "kitchen",
      quantity: 1_234,
      capabilities: [
        "mixes batter",
        "kneads dough",
        "whips cream",
        "grinds meat",
        "rolls pasta",
      ],
    };

    const tooltip = deriveGraphNodeTooltip(source);

    expect(tooltip).toEqual({
      kind: "item",
      eyebrow: "Owned item",
      title: "Stand mixer",
      details: [
        { label: "Room", value: "Kitchen" },
        { label: "Quantity", value: "1,234" },
        { label: "Capabilities", value: "5" },
      ],
      preview: {
        label: "Capability preview",
        values: ["mixes batter", "kneads dough", "whips cream"],
        overflowCount: 2,
      },
      action: "Select item to inspect",
    });
    expect(deriveGraphNodeTooltip(source)).toEqual(tooltip);
    expect(source.capabilities).toEqual([
      "mixes batter",
      "kneads dough",
      "whips cream",
      "grinds meat",
      "rolls pasta",
    ]);
  });

  it.each([
    { label: "omitted", quantity: undefined },
    { label: "null", quantity: null },
  ])("uses the quantity fallback when quantity is $label", ({ quantity }) => {
    const tooltip = deriveGraphNodeTooltip({
      kind: "item",
      name: "Kettle",
      domain: "kitchen",
      quantity,
      capabilities: [],
    });

    expect(tooltip.details).toContainEqual({
      label: "Quantity",
      value: "Not recorded",
    });
  });

  it("explains a hotspot and limits the owner preview to three entries", () => {
    expect(
      deriveGraphNodeTooltip({
        kind: "hub",
        name: "heats water",
        ownerCount: 5,
        owners: ["Kettle", "Coffee maker", "Saucepan", "Microwave", "Urn"],
        hot: true,
      }),
    ).toEqual({
      kind: "hub",
      eyebrow: "Shared capability",
      title: "heats water",
      status: "Hotspot · shared by four or more items",
      details: [{ label: "Local owners", value: "5" }],
      preview: {
        label: "Owner preview",
        values: ["Kettle", "Coffee maker", "Saucepan"],
        overflowCount: 2,
      },
    });
  });

  it("does not label an ordinary shared capability as a hotspot", () => {
    expect(
      deriveGraphNodeTooltip({
        kind: "hub",
        name: "toasts bread",
        ownerCount: 2,
        owners: ["Toaster", "Sandwich press"],
        hot: false,
      }).status,
    ).toBeUndefined();
  });

  it("describes a provisional new capability", () => {
    expect(
      deriveGraphNodeTooltip({
        kind: "hub-new",
        name: "carbonates water",
        tier: "secondary",
      }),
    ).toEqual({
      kind: "hub-new",
      eyebrow: "New capability",
      title: "carbonates water",
      status: "New · provisional",
      details: [{ label: "Tier", value: "Secondary" }],
    });
  });

  it.each(phaseCases)("labels the ghost's %s phase", (phase, expectedStatus) => {
    const tooltip = deriveGraphNodeTooltip({
      kind: "ghost",
      name: "Espresso machine",
      price: 749,
      phase,
    });

    expect(tooltip.status).toBe(expectedStatus);
  });

  it("formats a ghost price and falls back when the price is missing", () => {
    expect(
      deriveGraphNodeTooltip({
        kind: "ghost",
        name: "Espresso machine",
        price: 1_234.5,
        phase: "verdict",
      }).details,
    ).toEqual([{ label: "Price", value: "$1,234.5" }]);

    expect(
      deriveGraphNodeTooltip({
        kind: "ghost",
        name: "Unknown product",
        price: null,
        phase: "extracting",
      }).details,
    ).toEqual([{ label: "Price", value: "Not provided" }]);
  });

  it("describes a unique capability and provides owner and tier fallbacks", () => {
    expect(
      deriveGraphNodeTooltip({
        kind: "mini",
        name: "froths cold milk",
        owner: "Milk frother",
        tier: "primary",
      }),
    ).toEqual({
      kind: "mini",
      eyebrow: "Unique capability",
      title: "froths cold milk",
      details: [
        { label: "Owned by", value: "Milk frother" },
        { label: "Tier", value: "Primary" },
      ],
    });

    expect(
      deriveGraphNodeTooltip({
        kind: "mini",
        name: "unattributed capability",
        owner: null,
        tier: null,
      }).details,
    ).toEqual([
      { label: "Owned by", value: "Owner unavailable" },
      { label: "Tier", value: "Not recorded" },
    ]);
  });

  it("preserves long labels and exposes explicit empty previews", () => {
    const longLabel =
      "A deliberately long graph label that must remain complete instead of being truncated in the tooltip model";
    const itemTooltip = deriveGraphNodeTooltip({
      kind: "item",
      name: longLabel,
      domain: "electronics",
      quantity: 1,
      capabilities: [],
    });
    const hubTooltip = deriveGraphNodeTooltip({
      kind: "hub",
      name: longLabel,
      ownerCount: 0,
      owners: [],
      hot: false,
    });

    expect(itemTooltip.title).toBe(longLabel);
    expect(itemTooltip.preview).toEqual({
      label: "Capability preview",
      values: [],
      overflowCount: 0,
    });
    expect(hubTooltip.title).toBe(longLabel);
    expect(hubTooltip.preview).toEqual({
      label: "Owner preview",
      values: [],
      overflowCount: 0,
    });
  });
});

describe("placeGraphTooltip", () => {
  const container = rect(100, 50, 400, 300);
  const tooltip = rect(0, 0, 120, 60);

  it("places a tooltip above when it fits", () => {
    expect(placeGraphTooltip(container, rect(260, 180, 40, 40), tooltip)).toEqual({
      left: 120,
      top: 60,
      side: "above",
    });
  });

  it("places a tooltip below when there is not enough room above", () => {
    expect(placeGraphTooltip(container, rect(260, 60, 40, 40), tooltip)).toEqual({
      left: 120,
      top: 60,
      side: "below",
    });
  });

  it.each([
    ["left", rect(102, 90, 20, 20), 8],
    ["right", rect(378, 90, 20, 20), 192],
  ] as const)("clamps against the %s edge", (_edge, node, expectedLeft) => {
    const placement = placeGraphTooltip(
      rect(100, 0, 300, 200),
      node,
      rect(0, 0, 100, 40),
    );

    expect(placement.left).toBe(expectedLeft);
    expect(placement.top).toBe(40);
    expect(placement.side).toBe("above");
  });

  it("uses the padding origin when the tooltip is larger than a narrow canvas", () => {
    expect(
      placeGraphTooltip(
        rect(0, 0, 80, 70),
        rect(30, 25, 20, 20),
        rect(0, 0, 120, 100),
      ),
    ).toEqual({ left: 8, top: 8, side: "above" });
  });

  it.each([
    ["below", rect(110, 70, 20, 20), { left: 70, top: 92, side: "below" }],
    ["above", rect(110, 110, 20, 20), { left: 70, top: 8, side: "above" }],
  ] as const)(
    "chooses the side with more space (%s) when neither side fits",
    (_side, node, expected) => {
      expect(
        placeGraphTooltip(
          rect(0, 0, 240, 200),
          node,
          rect(0, 0, 100, 100),
        ),
      ).toEqual(expected);
    },
  );
});
