import type { Tier } from "../lib/types";
import type { Phase } from "../state/appReducer";

export type TooltipNodeKind =
  | "room"
  | "room-unscanned"
  | "item"
  | "hub"
  | "hub-new"
  | "ghost"
  | "mini";

export interface GraphTooltipDetail {
  label: string;
  value: string;
}

export interface GraphTooltipPreview {
  label: string;
  values: string[];
  overflowCount: number;
}

/**
 * Presentation-ready, database-free content attached to a graph node. D3 only
 * receives this shaped model; it never reads personal inventory records.
 */
export interface GraphNodeTooltip {
  kind: TooltipNodeKind;
  eyebrow: string;
  title: string;
  status?: string;
  details: GraphTooltipDetail[];
  preview?: GraphTooltipPreview;
  action?: string;
}

export interface TooltipRect {
  top: number;
  right: number;
  bottom: number;
  left: number;
  width: number;
  height: number;
}

export interface TooltipPlacement {
  left: number;
  top: number;
  side: "above" | "below";
}

/** Viewport/canvas-clamped placement that never feeds coordinates into D3. */
export function placeGraphTooltip(
  container: TooltipRect,
  node: TooltipRect,
  tooltip: TooltipRect,
  padding = 8,
  gap = 10,
): TooltipPlacement {
  const desiredLeft =
    node.left - container.left + node.width / 2 - tooltip.width / 2;
  const maxLeft = Math.max(padding, container.width - tooltip.width - padding);
  const left = Math.min(maxLeft, Math.max(padding, desiredLeft));
  const above = node.top - container.top - tooltip.height - gap;
  const below = node.bottom - container.top + gap;
  const fitsAbove = above >= padding;
  const fitsBelow = below + tooltip.height <= container.height - padding;
  const roomAbove = node.top - container.top;
  const roomBelow = container.bottom - node.bottom;
  const side = fitsAbove || (!fitsBelow && roomAbove >= roomBelow) ? "above" : "below";
  const desiredTop = side === "above" ? above : below;
  const maxTop = Math.max(padding, container.height - tooltip.height - padding);

  return {
    left: Math.min(maxLeft, Math.max(padding, left)),
    top: Math.min(maxTop, Math.max(padding, desiredTop)),
    side,
  };
}

export type GraphTooltipSource =
  | {
      kind: "room";
      name: string;
      itemCount: number;
      hotspotCount: number;
    }
  | {
      kind: "room-unscanned";
      name: string;
    }
  | {
      kind: "item";
      name: string;
      domain: string;
      quantity?: number | null;
      capabilities: string[];
    }
  | {
      kind: "hub";
      name: string;
      ownerCount: number;
      owners: string[];
      hot: boolean;
    }
  | {
      kind: "hub-new";
      name: string;
      tier: Tier;
    }
  | {
      kind: "ghost";
      name: string;
      price: number | null;
      phase: Phase;
    }
  | {
      kind: "mini";
      name: string;
      owner: string | null;
      tier: Tier | null;
    };

const PREVIEW_LIMIT = 3;

function titleCase(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
}

function preview(label: string, values: string[]): GraphTooltipPreview {
  return {
    label,
    values: values.slice(0, PREVIEW_LIMIT),
    overflowCount: Math.max(0, values.length - PREVIEW_LIMIT),
  };
}

function formatPrice(price: number | null): string {
  if (price == null) return "Not provided";
  return `$${price.toLocaleString("en-AU", {
    maximumFractionDigits: Number.isInteger(price) ? 0 : 2,
  })}`;
}

function formatQuantity(quantity: number | null | undefined): string {
  return typeof quantity === "number" &&
    Number.isInteger(quantity) &&
    quantity > 0
    ? quantity.toLocaleString("en-AU")
    : "Not recorded";
}

function phaseLabel(phase: Phase): string {
  switch (phase) {
    case "resting":
      return "Ready";
    case "extracting":
      return "Reading product";
    case "scanning":
      return "Comparing inventory";
    case "routing":
      return "Finding matches";
    case "settling":
      return "Preparing result";
    case "verdict":
      return "Result ready";
  }
}

export function deriveGraphNodeTooltip(
  source: GraphTooltipSource,
): GraphNodeTooltip {
  switch (source.kind) {
    case "room":
      return {
        kind: source.kind,
        eyebrow: "Room",
        title: titleCase(source.name),
        details: [
          { label: "Items", value: String(source.itemCount) },
          { label: "Hotspots", value: String(source.hotspotCount) },
        ],
        action: "Enter room",
      };
    case "room-unscanned":
      return {
        kind: source.kind,
        eyebrow: "Unscanned room",
        title: titleCase(source.name),
        status: "Not scanned",
        details: [],
        action: "Scan this room",
      };
    case "item":
      return {
        kind: source.kind,
        eyebrow: "Owned item",
        title: source.name,
        details: [
          { label: "Room", value: titleCase(source.domain) },
          {
            label: "Quantity",
            value: formatQuantity(source.quantity),
          },
          { label: "Capabilities", value: String(source.capabilities.length) },
        ],
        preview: preview("Capability preview", source.capabilities),
        action: "Select item to inspect",
      };
    case "hub":
      return {
        kind: source.kind,
        eyebrow: "Shared capability",
        title: source.name,
        status: source.hot
          ? "Hotspot · shared by four or more items"
          : undefined,
        details: [{ label: "Local owners", value: String(source.ownerCount) }],
        preview: preview("Owner preview", source.owners),
      };
    case "hub-new":
      return {
        kind: source.kind,
        eyebrow: "New capability",
        title: source.name,
        status: "New · provisional",
        details: [{ label: "Tier", value: titleCase(source.tier) }],
      };
    case "ghost":
      return {
        kind: source.kind,
        eyebrow: "Considering",
        title: source.name,
        status: phaseLabel(source.phase),
        details: [{ label: "Price", value: formatPrice(source.price) }],
      };
    case "mini":
      return {
        kind: source.kind,
        eyebrow: "Unique capability",
        title: source.name,
        details: [
          { label: "Owned by", value: source.owner ?? "Owner unavailable" },
          {
            label: "Tier",
            value: source.tier == null ? "Not recorded" : titleCase(source.tier),
          },
        ],
      };
  }
}
