import { describe, expect, it } from "vitest";
import inventoryFile from "../data/inventory.json";
import { deriveRoomHubs, deriveRooms, ghostEdgeId } from "../lib/graphDerive";
import { routeVerdict } from "../lib/route";
import { scoreProduct } from "../lib/scoring";
import type {
  EvaluateResult,
  InventoryFile,
  ProductDecomposition,
} from "../lib/types";
import { buildGraph, deriveItemCapabilitySelection } from "./buildGraph";

const inventory = inventoryFile as InventoryFile;

describe("room verdict evidence (PR-3b, VIS-5)", () => {
  it("keeps local and cross-room verdict rows mapped to present endpoints", () => {
    const decomposition: ProductDecomposition = {
      name: "Kitchen charging station",
      price: 80,
      capabilities: [
        { name: "bakes food", tier: "primary" },
        { name: "charges usb-c devices", tier: "secondary" },
        { name: "stores backup power", tier: "secondary" },
      ],
      altSuggestion: null,
    };
    const verdict = scoreProduct(decomposition, inventory.items);
    const route = routeVerdict(verdict, inventory.items);
    const result: EvaluateResult = {
      ...decomposition,
      verdict,
      cached: false,
    };

    expect(route.domain).toBe("kitchen");

    const graph = buildGraph({
      items: inventory.items,
      unscannedRooms: inventory.unscannedRooms,
      view: { level: "room", domain: route.domain! },
      phase: "verdict",
      result,
      route,
      expandedItemId: null,
    });
    const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));

    verdict.rows.forEach((row) => {
      const edge = graph.edges.find(
        (candidate) => candidate.id === ghostEdgeId(row.capSlug),
      );
      expect(edge, `ghost edge for ${row.capability}`).toBeDefined();
      expect(edge?.source).toBe("ghost");
      expect(
        nodesById.has(edge?.target ?? ""),
        `present endpoint for ${row.capability}`,
      ).toBe(true);
    });

    // The promoted cross-room capability remains a hub.
    expect(nodesById.get("hub:charges-usb-c-devices")?.kind).toBe("hub");
    // The degree-1 cross-room capability is evidence, not a new hub.
    expect(nodesById.get("mini:stores-backup-power")?.kind).toBe("mini");
    expect(nodesById.has("hub:stores-backup-power")).toBe(false);

    const promotedHubIds = new Set(
      deriveRooms(inventory.items).flatMap((room) =>
        deriveRoomHubs(inventory.items, room.label).map(
          (hub) => `hub:${hub.slug}`,
        ),
      ),
    );
    graph.nodes
      .filter((node) => node.kind === "hub")
      .forEach((node) => expect(promotedHubIds.has(node.id)).toBe(true));
  });
});

describe("expanded four-room graph", () => {
  it("shows four active rooms with their seeded item counts", () => {
    const graph = buildGraph({
      items: inventory.items,
      unscannedRooms: inventory.unscannedRooms,
      view: { level: "home" },
      phase: "resting",
      result: null,
      route: null,
      expandedItemId: null,
    });
    expect(graph.nodes.map(({ kind, label, sub }) => ({ kind, label, sub }))).toEqual([
      { kind: "room", label: "kitchen", sub: "19 items" },
      { kind: "room", label: "electronics", sub: "18 items" },
      { kind: "room", label: "garage", sub: "16 items" },
      { kind: "room", label: "bathroom", sub: "11 items" },
    ]);
  });

  it.each(["kitchen", "electronics", "garage", "bathroom"])(
    "keeps every %s room edge attached to a present node",
    (domain) => {
      const graph = buildGraph({
        items: inventory.items,
        unscannedRooms: inventory.unscannedRooms,
        view: { level: "room", domain },
        phase: "resting",
        result: null,
        route: null,
        expandedItemId: null,
      });
      const nodeIds = new Set(graph.nodes.map((node) => node.id));
      expect(graph.nodes.filter((node) => node.kind === "hub").length).toBeLessThanOrEqual(8);
      graph.edges.forEach((edge) => {
        expect(nodeIds.has(String(edge.source))).toBe(true);
        expect(nodeIds.has(String(edge.target))).toBe(true);
      });
    },
  );
});

describe("room → item → capability hierarchy", () => {
  it("never connects one item directly to another item", () => {
    const graph = buildGraph({
      items: inventory.items,
      unscannedRooms: inventory.unscannedRooms,
      view: { level: "room", domain: "kitchen" },
      phase: "resting",
      result: null,
      route: null,
      expandedItemId: "air-fryer",
    });
    const kindById = new Map(graph.nodes.map((node) => [node.id, node.kind]));

    graph.edges.forEach((edge) => {
      expect(
        kindById.get(edge.source) === "item" &&
          kindById.get(edge.target) === "item",
        `direct item edge ${edge.id}`,
      ).toBe(false);
    });

    graph.edges
      .filter((edge) => edge.kind === "inventory")
      .forEach((edge) => {
        expect(kindById.get(edge.source)).toBe("item");
        expect(["hub", "mini"]).toContain(kindById.get(edge.target));
      });
  });

  it("derives every connected capability for the selected item", () => {
    const graph = buildGraph({
      items: inventory.items,
      unscannedRooms: inventory.unscannedRooms,
      view: { level: "room", domain: "kitchen" },
      phase: "resting",
      result: null,
      route: null,
      expandedItemId: "air-fryer",
    });
    const selection = deriveItemCapabilitySelection(graph, "air-fryer");

    expect([...selection.nodeIds].sort()).toEqual(
      [
        "hub:bakes-food",
        "hub:reheats-leftovers",
        "hub:toasts-bread",
        "mini:crisps-food-with-hot-air",
      ].sort(),
    );
    expect(selection.edgeIds.size).toBe(4);
    expect(
      graph.nodes
        .filter((node) => selection.nodeIds.has(node.id))
        .every((node) => node.kind === "hub" || node.kind === "mini"),
    ).toBe(true);
  });

  it("keeps highlighting cosmetic when the selected item has no unique nodes", () => {
    const buildRoom = (expandedItemId: string | null) =>
      buildGraph({
        items: inventory.items,
        unscannedRooms: inventory.unscannedRooms,
        view: { level: "room", domain: "electronics" },
        phase: "resting",
        result: null,
        route: null,
        expandedItemId,
      });
    const unselected = buildRoom(null);
    const toasterSelected = buildRoom("laptop-dock");
    const signature = (graph: ReturnType<typeof buildGraph>) => ({
      nodes: graph.nodes.map((node) => node.id).sort(),
      edges: graph.edges.map((edge) => edge.id).sort(),
    });

    expect(signature(toasterSelected)).toEqual(signature(unselected));
    expect([
      ...deriveItemCapabilitySelection(toasterSelected, "laptop-dock").nodeIds,
    ].sort()).toEqual([
      "hub:adds-usb-ports",
      "hub:charges-usb-c-devices",
      "hub:connects-external-displays",
      "hub:transfers-data-between-devices",
    ].sort());
  });
});
