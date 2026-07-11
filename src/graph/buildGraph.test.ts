import { describe, expect, it } from "vitest";
import inventoryFile from "../data/inventory.json";
import { deriveHubs, ghostEdgeId } from "../lib/graphDerive";
import { routeVerdict } from "../lib/route";
import { scoreProduct } from "../lib/scoring";
import type {
  EvaluateResult,
  InventoryFile,
  ProductDecomposition,
} from "../lib/types";
import { buildGraph } from "./buildGraph";

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
      deriveHubs(inventory.items).map((hub) => `hub:${hub.slug}`),
    );
    graph.nodes
      .filter((node) => node.kind === "hub")
      .forEach((node) => expect(promotedHubIds.has(node.id)).toBe(true));
  });
});
