import { describe, expect, it } from "vitest";
import { routeVerdict } from "../lib/route";
import { scoreProduct } from "../lib/scoring";
import type { EvaluateResult, Item, ProductDecomposition } from "../lib/types";
import { buildGraph, type GraphNodeDatum } from "./buildGraph";

type SavedItem = Item & { quantity?: number | null };

const items: SavedItem[] = [
  {
    id: "kettle",
    name: "Kettle",
    domain: "kitchen",
    quantity: 2,
    capabilities: [
      { name: "boils water", tier: "primary" },
      { name: "brews tea", tier: "secondary" },
      { name: "keeps water warm", tier: "secondary" },
      { name: "filters water", tier: "secondary" },
    ],
  },
  {
    id: "cooktop",
    name: "Cooktop",
    domain: "kitchen",
    capabilities: [
      { name: "boils water", tier: "secondary" },
      { name: "heats food", tier: "primary" },
    ],
  },
  {
    id: "saucepan",
    name: "Saucepan",
    domain: "kitchen",
    quantity: null,
    capabilities: [
      { name: "boils water", tier: "primary" },
      { name: "heats food", tier: "secondary" },
    ],
  },
  {
    id: "urn",
    name: "Urn",
    domain: "kitchen",
    capabilities: [{ name: "boils water", tier: "primary" }],
  },
  {
    id: "radio",
    name: "Radio",
    domain: "electronics",
    capabilities: [{ name: "plays audio", tier: "primary" }],
  },
];

const unscannedRooms = ["garage"];

const expectedKinds = [
  "room",
  "room-unscanned",
  "item",
  "hub",
  "hub-new",
  "ghost",
  "mini",
] as const satisfies readonly GraphNodeDatum["kind"][];

function evaluate(product: ProductDecomposition): EvaluateResult {
  return {
    ...product,
    verdict: scoreProduct(product, items),
    cached: false,
  };
}

function findNode(graph: ReturnType<typeof buildGraph>, id: string) {
  const node = graph.nodes.find((candidate) => candidate.id === id);
  expect(node, `node ${id}`).toBeDefined();
  return node!;
}

function containsRawInventoryItem(
  value: unknown,
  seen = new Set<object>(),
): boolean {
  if (value == null || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (!Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (
      typeof record.id === "string" &&
      typeof record.name === "string" &&
      typeof record.domain === "string" &&
      Array.isArray(record.capabilities)
    ) {
      return true;
    }
  }

  return Object.values(value).some((child) =>
    containsRawInventoryItem(child, seen),
  );
}

function expectTypedPresentationData(graph: ReturnType<typeof buildGraph>) {
  graph.nodes.forEach((node) => {
    expect(node.tooltip.kind, `tooltip kind for ${node.id}`).toBe(node.kind);
    expect(containsRawInventoryItem(node), `raw inventory on ${node.id}`).toBe(
      false,
    );
  });
}

describe("buildGraph tooltip integration", () => {
  it("attaches room counts and hotspot totals on the home graph", () => {
    const graph = buildGraph({
      items,
      unscannedRooms,
      view: { level: "home" },
      phase: "resting",
      result: null,
      route: null,
      expandedItemId: null,
    });

    expect(findNode(graph, "room:kitchen").tooltip).toEqual({
      kind: "room",
      eyebrow: "Room",
      title: "Kitchen",
      details: [
        { label: "Items", value: "4" },
        { label: "Hotspots", value: "1" },
      ],
      action: "Enter room",
    });
    expect(findNode(graph, "room:electronics").tooltip.details).toEqual([
      { label: "Items", value: "1" },
      { label: "Hotspots", value: "0" },
    ]);
    expect(findNode(graph, "room:garage").tooltip).toEqual({
      kind: "room-unscanned",
      eyebrow: "Unscanned room",
      title: "Garage",
      status: "Not scanned",
      details: [],
      action: "Scan this room",
    });

    expectTypedPresentationData(graph);
  });

  it("attaches item, local hub, and expanded mini details on a room graph", () => {
    const graph = buildGraph({
      items,
      unscannedRooms,
      view: { level: "room", domain: "kitchen" },
      phase: "resting",
      result: null,
      route: null,
      expandedItemId: "kettle",
    });

    expect(findNode(graph, "kettle").tooltip).toEqual({
      kind: "item",
      eyebrow: "Owned item",
      title: "Kettle",
      details: [
        { label: "Room", value: "Kitchen" },
        { label: "Quantity", value: "2" },
        { label: "Capabilities", value: "4" },
      ],
      preview: {
        label: "Capability preview",
        values: ["boils water", "brews tea", "keeps water warm"],
        overflowCount: 1,
      },
      action: "Select item to inspect",
    });
    expect(findNode(graph, "cooktop").tooltip.details).toContainEqual({
      label: "Quantity",
      value: "Not recorded",
    });
    expect(findNode(graph, "saucepan").tooltip.details).toContainEqual({
      label: "Quantity",
      value: "Not recorded",
    });

    expect(findNode(graph, "hub:boils-water").tooltip).toEqual({
      kind: "hub",
      eyebrow: "Shared capability",
      title: "boils water",
      status: "Hotspot · shared by four or more items",
      details: [{ label: "Local owners", value: "4" }],
      preview: {
        label: "Owner preview",
        values: ["Kettle", "Cooktop", "Saucepan"],
        overflowCount: 1,
      },
    });
    expect(findNode(graph, "hub:heats-food").tooltip).toEqual({
      kind: "hub",
      eyebrow: "Shared capability",
      title: "heats food",
      details: [{ label: "Local owners", value: "2" }],
      preview: {
        label: "Owner preview",
        values: ["Cooktop", "Saucepan"],
        overflowCount: 0,
      },
    });
    expect(findNode(graph, "mini:brews-tea").tooltip).toEqual({
      kind: "mini",
      eyebrow: "Unique capability",
      title: "brews tea",
      details: [
        { label: "Owned by", value: "Kettle" },
        { label: "Tier", value: "Secondary" },
      ],
    });

    expectTypedPresentationData(graph);
  });

  it("attaches tier/status and priced verdict phase to no-match nodes", () => {
    const result = evaluate({
      name: "Countertop composter",
      price: 249,
      capabilities: [
        { name: "composts food scraps", tier: "primary" },
        { name: "tracks methane", tier: "secondary" },
      ],
      altSuggestion: null,
    });
    const route = routeVerdict(result.verdict, items);
    expect(route.domain).toBeNull();

    const graph = buildGraph({
      items,
      unscannedRooms,
      view: { level: "home" },
      phase: "verdict",
      result,
      route,
      expandedItemId: null,
    });

    expect(findNode(graph, "ghost").tooltip).toEqual({
      kind: "ghost",
      eyebrow: "Considering",
      title: "Countertop composter",
      status: "Verdict ready",
      details: [{ label: "Price", value: "$249" }],
    });
    expect(findNode(graph, "hubnew:composts-food-scraps").tooltip).toEqual({
      kind: "hub-new",
      eyebrow: "New capability",
      title: "composts food scraps",
      status: "New · provisional",
      details: [{ label: "Tier", value: "Primary" }],
    });
    expect(findNode(graph, "hubnew:tracks-methane").tooltip.details).toEqual([
      { label: "Tier", value: "Secondary" },
    ]);

    expectTypedPresentationData(graph);
  });

  it("attaches covered hub/mini evidence and missing-price ghost data", () => {
    const result = evaluate({
      name: "Connected kettle",
      price: null,
      capabilities: [
        { name: "boils water", tier: "primary" },
        { name: "brews tea", tier: "secondary" },
      ],
      altSuggestion: null,
    });
    const route = routeVerdict(result.verdict, items);
    expect(route.domain).toBe("kitchen");

    const graph = buildGraph({
      items,
      unscannedRooms,
      view: { level: "room", domain: route.domain! },
      phase: "verdict",
      result,
      route,
      expandedItemId: null,
    });

    expect(findNode(graph, "ghost").tooltip).toEqual({
      kind: "ghost",
      eyebrow: "Considering",
      title: "Connected kettle",
      status: "Verdict ready",
      details: [{ label: "Price", value: "Not provided" }],
    });
    expect(findNode(graph, "hub:boils-water").tooltip.details).toEqual([
      { label: "Local owners", value: "4" },
    ]);
    expect(findNode(graph, "hub:boils-water").tooltip.status).toBe(
      "Hotspot · shared by four or more items",
    );
    expect(findNode(graph, "mini:brews-tea").tooltip).toEqual({
      kind: "mini",
      eyebrow: "Unique capability",
      title: "brews tea",
      details: [
        { label: "Owned by", value: "Kettle" },
        { label: "Tier", value: "Secondary" },
      ],
    });

    expectTypedPresentationData(graph);

    const emittedKinds = new Set(
      [
        ...buildGraph({
          items,
          unscannedRooms,
          view: { level: "home" },
          phase: "resting",
          result: null,
          route: null,
          expandedItemId: null,
        }).nodes,
        ...buildGraph({
          items,
          unscannedRooms,
          view: { level: "room", domain: "kitchen" },
          phase: "resting",
          result: null,
          route: null,
          expandedItemId: "kettle",
        }).nodes,
        ...graph.nodes,
      ].map((node) => node.kind),
    );
    const noMatch = evaluate({
      name: "Composter",
      price: 249,
      capabilities: [{ name: "composts food scraps", tier: "primary" }],
      altSuggestion: null,
    });
    buildGraph({
      items,
      unscannedRooms,
      view: { level: "home" },
      phase: "verdict",
      result: noMatch,
      route: routeVerdict(noMatch.verdict, items),
      expandedItemId: null,
    }).nodes.forEach((node) => emittedKinds.add(node.kind));

    expect(emittedKinds).toEqual(new Set(expectedKinds));
  });
});
