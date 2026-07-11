import {
  deriveRoomHubs,
  deriveRooms,
  ghostEdgeId,
  inventoryEdgeId,
} from "../lib/graphDerive";
import { specificityWeight } from "../lib/scoring";
import { deriveVocabulary } from "../lib/vocabulary";
import { capSlug } from "../lib/text";
import { copy } from "../lib/copy";
import type { Phase, View } from "../state/appReducer";
import type { RouteResult } from "../lib/route";
import type { EvaluateResult, Item, Tier } from "../lib/types";

/** VIS-3 node taxonomy. Dashed always means provisional / not owned. */
export type NodeKind =
  | "room"
  | "room-unscanned"
  | "item"
  | "hub"
  | "hub-new"
  | "ghost"
  | "mini";

/** VIS-4 edge taxonomy (pulse is a cosmetic class, not a kind; SM-8). */
export type EdgeKind =
  | "inventory"
  | "scan"
  | "covered"
  | "new"
  | "cross-room";

export interface GraphNodeDatum {
  id: string;
  kind: NodeKind;
  label: string;
  sub?: string;
  /** amber hotspot count on rooms; "+N" unique badge on items */
  badge?: number;
  hot?: boolean;
  /** node id whose last position seeds this node when it first appears (SM-8) */
  seedNear?: string;
  domain?: string;
}

export interface GraphEdgeDatum {
  id: string;
  source: string;
  target: string;
  kind: EdgeKind;
  tier?: Tier;
  /** Unique-capability inventory edge, rendered dashed beside its expanded item. */
  mini?: boolean;
  /** physics, precomputed from data (ALG-3: specificity keeps domains apart) */
  distance: number;
  strength: number;
}

export interface GraphData {
  nodes: GraphNodeDatum[];
  edges: GraphEdgeDatum[];
}

export interface ItemCapabilitySelection {
  nodeIds: ReadonlySet<string>;
  edgeIds: ReadonlySet<string>;
}

/**
 * Derive the capability evidence connected to one owned item. Inventory
 * edges are the only allowed item relationship: item -> hub/mini capability.
 * Keeping this as graph-derived cosmetic state prevents selection from
 * duplicating inventory data or reheating the simulation.
 */
export function deriveItemCapabilitySelection(
  graph: GraphData,
  itemId: string | null,
): ItemCapabilitySelection {
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  if (!itemId) return { nodeIds, edgeIds };
  const kindById = new Map(graph.nodes.map((node) => [node.id, node.kind]));

  graph.edges.forEach((edge) => {
    if (edge.kind !== "inventory" || edge.source !== itemId) return;
    const targetKind = kindById.get(edge.target);
    if (targetKind !== "hub" && targetKind !== "mini") return;
    nodeIds.add(edge.target);
    edgeIds.add(edge.id);
  });
  return { nodeIds, edgeIds };
}

interface BuildArgs {
  items: Item[];
  unscannedRooms: string[];
  view: View;
  phase: Phase;
  result: EvaluateResult | null;
  route: RouteResult | null;
  expandedItemId: string | null;
  /** Settling sub-beat; defaults true for direct/test callers. */
  evidenceVisible?: boolean;
}

const roomId = (label: string) => `room:${label}`;
const hubId = (slug: string) => `hub:${slug}`;
const hubNewId = (slug: string) => `hubnew:${slug}`;
const miniId = (slug: string) => `mini:${slug}`;
export const GHOST_ID = "ghost";

function inventoryEdge(
  itemId: string,
  slug: string,
  target: string,
  tier: Tier,
  degree: number,
): GraphEdgeDatum {
  const specificity = specificityWeight(degree);
  return {
    id: inventoryEdgeId(itemId, slug),
    source: itemId,
    target,
    kind: "inventory",
    tier,
    // Generic capabilities (low specificity) hold their items loosely and far;
    // distinctive ones bind tightly — this is what keeps clusters honest.
    distance: 56 + (1 - specificity) * 84,
    strength: (0.25 + 0.55 * specificity) * (tier === "primary" ? 1 : 0.75),
  };
}

export function buildGraph({
  items,
  unscannedRooms,
  view,
  phase,
  result,
  route,
  expandedItemId,
  evidenceVisible = true,
}: BuildArgs): GraphData {
  const vocabulary = deriveVocabulary(items);
  const domains = deriveRooms(items);
  const roomHubs = new Map(
    domains.map((domain) => [
      domain.label,
      deriveRoomHubs(items, domain.label),
    ]),
  );
  const allHubs = [...roomHubs.values()].flat();
  const domainByItemId = new Map<string, string>();
  domains.forEach((domain) =>
    domain.itemIds.forEach((itemId) => domainByItemId.set(itemId, domain.label)),
  );

  const nodes: GraphNodeDatum[] = [];
  const edges: GraphEdgeDatum[] = [];

  const ghostActive = phase !== "resting" && result != null;
  const ghostEdgesVisible =
    ghostActive &&
    (phase === "verdict" || (phase === "settling" && evidenceVisible));

  if (view.level === "home") {
    domains.forEach((domain) => {
      const hotspotCount = (roomHubs.get(domain.label) ?? []).filter(
        (hub) => hub.hot,
      ).length;
      nodes.push({
        id: roomId(domain.label),
        kind: "room",
        label: domain.label,
        sub: `${domain.itemIds.length} items`,
        badge: hotspotCount || undefined,
        domain: domain.label,
      });
    });
    unscannedRooms.forEach((label) => {
      nodes.push({
        id: roomId(label),
        kind: "room-unscanned",
        label,
        sub: copy.unscannedCta,
      });
    });

    if (ghostActive && result) {
      nodes.push({
        id: GHOST_ID,
        kind: "ghost",
        label: copy.ghostLabel(result.name, result.price),
      });

      if (phase === "extracting" || phase === "scanning" || phase === "routing") {
        // SM-4: faint dashed scan lines fan to every node — the fan is honest.
        nodes.forEach((node) => {
          if (node.id === GHOST_ID) return;
          edges.push({
            id: `scan:${node.id}`,
            source: GHOST_ID,
            target: node.id,
            kind: "scan",
            distance: 0,
            strength: 0,
          });
        });
      }

      // SM-5 no-match path: approval state at home level — the ghost's new
      // capabilities materialize as green pills so every row has its edge.
      if (ghostEdgesVisible && route && route.domain === null) {
        result.verdict.rows.forEach((row) => {
          if (row.covered) return;
          nodes.push({
            id: hubNewId(row.capSlug),
            kind: "hub-new",
            label: row.capability,
            seedNear: GHOST_ID,
          });
          edges.push({
            id: ghostEdgeId(row.capSlug),
            source: GHOST_ID,
            target: hubNewId(row.capSlug),
            kind: "new",
            tier: row.tier,
            distance: 72,
            strength: 0.7,
          });
        });
      }
    }

    return { nodes, edges };
  }

  // Room level: item chips + hub pills + ghost + blooms (VIS-2).
  const roomLabel = view.domain;
  const roomItems = items.filter(
    (item) => domainByItemId.get(item.id) === roomLabel,
  );
  const roomVocabulary = deriveVocabulary(roomItems);
  const roomItemIds = new Set(roomItems.map((item) => item.id));
  const visibleRoomHubs = roomHubs.get(roomLabel) ?? [];

  roomItems.forEach((item) => {
    const uniqueCount = item.capabilities.filter(
      (capability) => (roomVocabulary.get(capability.name)?.degree ?? 0) === 1,
    ).length;
    nodes.push({
      id: item.id,
      kind: "item",
      label: item.name,
      badge: uniqueCount || undefined,
      seedNear: roomId(roomLabel),
      domain: roomLabel,
    });
  });

  visibleRoomHubs.forEach((hub) => {
    nodes.push({
      id: hubId(hub.slug),
      kind: "hub",
      label: hub.name,
      hot: hub.hot,
      seedNear: roomId(roomLabel),
      domain: roomLabel,
    });
    hub.owners.forEach((owner) => {
      if (!roomItemIds.has(owner.itemId)) return;
      edges.push(
        inventoryEdge(owner.itemId, hub.slug, hubId(hub.slug), owner.tier, hub.degree),
      );
    });
  });

  // INT-5: one expansion at a time — unique capabilities bloom as minis.
  const expandedItem = roomItems.find((item) => item.id === expandedItemId);
  if (expandedItem) {
    expandedItem.capabilities.forEach((capability) => {
      const roomEntry = roomVocabulary.get(capability.name);
      if ((roomEntry?.degree ?? 0) !== 1) return;
      const slug = capSlug(capability.name);
      nodes.push({
        id: miniId(slug),
        kind: "mini",
        label: capability.name,
        seedNear: expandedItem.id,
      });
      edges.push({
        id: inventoryEdgeId(expandedItem.id, slug),
        source: expandedItem.id,
        target: miniId(slug),
        kind: "inventory",
        mini: true,
        tier: capability.tier,
        distance: 44,
        strength: 0.8,
      });
    });
  }

  if (ghostActive && result && ghostEdgesVisible) {
    nodes.push({
      id: GHOST_ID,
      kind: "ghost",
      label: copy.ghostLabel(result.name, result.price),
    });

    result.verdict.rows.forEach((row) => {
      if (row.covered) {
        let targetId: string;
        const promotedHub =
          allHubs.find(
            (hub) => hub.slug === row.capSlug && hub.domain === roomLabel,
          ) ?? allHubs.find((hub) => hub.slug === row.capSlug);
        if (promotedHub) {
          targetId = hubId(row.capSlug);
          // Multi-room results may cite a coverer outside the routed room.
          // Keep a hub promoted in its owning room visible as evidence.
          if (!nodes.some((node) => node.id === targetId)) {
            const localOwner = promotedHub.owners.find((owner) =>
              roomItemIds.has(owner.itemId),
            );
            nodes.push({
              id: targetId,
              kind: "hub",
              label: promotedHub.name,
              hot: promotedHub.hot,
              seedNear: localOwner?.itemId ?? GHOST_ID,
              domain: promotedHub.domain,
            });
          }
        } else {
          // A covered capability below hub promotion materializes only as
          // contextual mini evidence. This preserves ALG-8's per-room cap while
          // keeping the verdict row's ghost edge inspectable (PR-3b).
          const owner = vocabulary.get(row.capability)?.owners[0];
          targetId = miniId(row.capSlug);
          if (!nodes.some((node) => node.id === targetId)) {
            nodes.push({
              id: targetId,
              kind: "mini",
              label: row.capability,
              seedNear:
                owner && roomItemIds.has(owner.itemId)
                  ? owner.itemId
                  : GHOST_ID,
              domain: owner
                ? domainByItemId.get(owner.itemId)
                : undefined,
            });
          }
          if (
            owner &&
            roomItemIds.has(owner.itemId) &&
            !edges.some(
              (edge) => edge.id === inventoryEdgeId(owner.itemId, row.capSlug),
            )
          ) {
            edges.push({
              id: inventoryEdgeId(owner.itemId, row.capSlug),
              source: owner.itemId,
              target: targetId,
              kind: "inventory",
              mini: true,
              tier: owner.tier,
              distance: 44,
              strength: 0.8,
            });
          }
        }
        edges.push({
          id: ghostEdgeId(row.capSlug),
          source: GHOST_ID,
          target: targetId,
          kind: "covered",
          tier: row.tier,
          distance: 88,
          strength: 0.5,
        });
      } else {
        // SM-6: genuinely new capabilities materialize as hub-new pills.
        nodes.push({
          id: hubNewId(row.capSlug),
          kind: "hub-new",
          label: row.capability,
          seedNear: GHOST_ID,
        });
        edges.push({
          id: ghostEdgeId(row.capSlug),
          source: GHOST_ID,
          target: hubNewId(row.capSlug),
          kind: "new",
          tier: row.tier,
          distance: 72,
          strength: 0.7,
        });
      }
    });
  }

  return { nodes, edges };
}
