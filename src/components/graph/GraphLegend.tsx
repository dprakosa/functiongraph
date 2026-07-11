import { useId, useState } from "react";
import type { NodeType, RelationshipType } from "../../types/graph";

interface NodeTypePresentation {
  label: string;
  symbol: string;
  description: string;
}

interface RelationshipPresentation {
  label: string;
  symbol: string;
  description: string;
}

export const NODE_TYPE_ORDER = [
  "owned-item",
  "candidate-product",
  "capability",
  "outcome",
  "accessory",
  "constraint",
] as const satisfies readonly NodeType[];

export const RELATIONSHIP_TYPE_ORDER = [
  "supports",
  "enables",
  "requires",
  "constrained-by",
  "overlaps-with",
  "missing-capability",
] as const satisfies readonly RelationshipType[];

export const NODE_TYPE_PRESENTATION: Readonly<
  Record<NodeType, NodeTypePresentation>
> = {
  "owned-item": {
    label: "Owned item",
    symbol: "O",
    description: "A product already in the user's inventory",
  },
  "candidate-product": {
    label: "Candidate product",
    symbol: "C",
    description: "The product currently being compared",
  },
  capability: {
    label: "Capability",
    symbol: "●",
    description: "A function a product can perform",
  },
  outcome: {
    label: "Outcome",
    symbol: "◆",
    description: "A practical result the user wants",
  },
  accessory: {
    label: "Accessory",
    symbol: "◇",
    description: "An attachment or supporting item",
  },
  constraint: {
    label: "Constraint",
    symbol: "!",
    description: "A limitation or trade-off to consider",
  },
};

export const RELATIONSHIP_TYPE_PRESENTATION: Readonly<
  Record<RelationshipType, RelationshipPresentation>
> = {
  supports: {
    label: "Supports",
    symbol: "—",
    description: "A product provides this capability",
  },
  enables: {
    label: "Enables",
    symbol: "→",
    description: "A capability leads to an outcome",
  },
  requires: {
    label: "Requires",
    symbol: "- -",
    description: "A product depends on an accessory",
  },
  "constrained-by": {
    label: "Constrained by",
    symbol: "···",
    description: "A limitation applies to a product",
  },
  "overlaps-with": {
    label: "Overlaps with",
    symbol: "⇄",
    description: "Two products provide similar value",
  },
  "missing-capability": {
    label: "Missing capability",
    symbol: "- - ✦",
    description: "A capability is not covered by owned products",
  },
};

export interface GraphLegendProps {
  /** When supplied, expansion state is controlled by the parent. */
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  heading?: string;
  className?: string;
}

export function GraphLegend({
  collapsed,
  defaultCollapsed = false,
  onCollapsedChange,
  heading = "Graph legend",
  className,
}: GraphLegendProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const contentId = useId();
  const isCollapsed = collapsed ?? internalCollapsed;

  const toggleCollapsed = () => {
    const nextCollapsed = !isCollapsed;
    if (collapsed === undefined) {
      setInternalCollapsed(nextCollapsed);
    }
    onCollapsedChange?.(nextCollapsed);
  };

  return (
    <section
      className={["fg-legend", isCollapsed ? "fg-legend--collapsed" : "", className]
        .filter(Boolean)
        .join(" ")}
      aria-labelledby={`${contentId}-heading`}
    >
      <button
        className="fg-legend__toggle"
        type="button"
        aria-expanded={!isCollapsed}
        aria-controls={contentId}
        onClick={toggleCollapsed}
      >
        <span id={`${contentId}-heading`}>{heading}</span>
        <span className="fg-legend__chevron" aria-hidden="true">
          {isCollapsed ? "+" : "−"}
        </span>
      </button>

      <div id={contentId} className="fg-legend__content" hidden={isCollapsed}>
        <p className="fg-legend__group-label">Nodes</p>
        <ul className="fg-legend__list" aria-label="Node types">
          {NODE_TYPE_ORDER.map((type) => {
            const item = NODE_TYPE_PRESENTATION[type];
            return (
              <li className="fg-legend__item" key={type}>
                <span
                  className={`fg-legend__node-shape fg-legend__node-shape--${type}`}
                  aria-hidden="true"
                >
                  {item.symbol}
                </span>
                <span className="fg-legend__item-copy">
                  <span className="fg-legend__item-label">{item.label}</span>
                  <span className="fg-legend__item-description">{item.description}</span>
                </span>
              </li>
            );
          })}
        </ul>

        <p className="fg-legend__group-label">Relationships</p>
        <ul className="fg-legend__list" aria-label="Relationship coverage">
          {(["supports", "missing-capability"] as const).map((type) => {
            const item = RELATIONSHIP_TYPE_PRESENTATION[type];
            const displayLabel = type === "supports" ? "Covered relationship" : item.label;
            return (
              <li className="fg-legend__item" key={type}>
                <span
                  className={`fg-legend__edge-swatch fg-legend__edge-swatch--${type}`}
                  aria-hidden="true"
                >
                  {item.symbol}
                </span>
                <span className="fg-legend__item-copy">
                  <span className="fg-legend__item-label">{displayLabel}</span>
                  <span className="fg-legend__item-description">{item.description}</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
