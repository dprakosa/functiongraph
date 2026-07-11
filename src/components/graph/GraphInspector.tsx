import { useId, useMemo } from "react";
import type { GraphEdge, GraphNode } from "../../types/graph";
import {
  NODE_TYPE_PRESENTATION,
  RELATIONSHIP_TYPE_PRESENTATION,
} from "./GraphLegend";

export interface GraphInspectorProps {
  selectedNode: GraphNode | null;
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
  onSelectNode: (nodeId: string) => void;
  onClearSelection?: () => void;
  onRequestClose?: () => void;
  className?: string;
}

interface ResolvedRelationship {
  edge: GraphEdge;
  otherNode: GraphNode | undefined;
}

function formatMetadataKey(key: string): string {
  const normalized = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : key;
}

function formatMetadataValue(value: string | number | boolean): string {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value);
}

function formatOverlapScore(score: number): string {
  const percentage = score > 0 && score <= 1 ? score * 100 : score;
  return `${Math.round(percentage)}%`;
}

function RelationshipList({
  relationships,
  direction,
  onSelectNode,
}: {
  relationships: readonly ResolvedRelationship[];
  direction: "incoming" | "outgoing";
  onSelectNode: (nodeId: string) => void;
}) {
  if (relationships.length === 0) {
    return (
      <p className="fg-inspector__empty-list">
        No {direction} relationships for this node.
      </p>
    );
  }

  return (
    <ul className="fg-inspector__relationship-list">
      {relationships.map(({ edge, otherNode }) => {
        const relationship = RELATIONSHIP_TYPE_PRESENTATION[edge.type];
        return (
          <li className="fg-inspector__relationship" key={`${direction}-${edge.id}`}>
            <span
              className={`fg-inspector__relationship-mark fg-inspector__relationship-mark--${edge.type}`}
              aria-hidden="true"
            >
              {direction === "incoming" ? "←" : "→"}
            </span>
            <span className="fg-inspector__relationship-copy">
              <span className="fg-inspector__relationship-type">
                {edge.label || relationship.label}
              </span>
              {otherNode ? (
                <button
                  className="fg-inspector__node-link"
                  type="button"
                  onClick={() => onSelectNode(otherNode.id)}
                >
                  {otherNode.label}
                </button>
              ) : (
                <span className="fg-inspector__node-link fg-inspector__node-link--missing">
                  Node unavailable
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function GraphInspector({
  selectedNode,
  nodes,
  edges,
  onSelectNode,
  onClearSelection,
  onRequestClose,
  className,
}: GraphInspectorProps) {
  const id = useId();
  const { incoming, outgoing, connectedNodes } = useMemo(() => {
    if (!selectedNode) {
      return {
        incoming: [] as ResolvedRelationship[],
        outgoing: [] as ResolvedRelationship[],
        connectedNodes: [] as GraphNode[],
      };
    }

    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const incomingRelationships: ResolvedRelationship[] = [];
    const outgoingRelationships: ResolvedRelationship[] = [];
    const connectedById = new Map<string, GraphNode>();

    edges.forEach((edge) => {
      if (edge.target === selectedNode.id) {
        const sourceNode = nodeById.get(edge.source);
        incomingRelationships.push({ edge, otherNode: sourceNode });
        if (sourceNode && sourceNode.id !== selectedNode.id) {
          connectedById.set(sourceNode.id, sourceNode);
        }
      }
      if (edge.source === selectedNode.id) {
        const targetNode = nodeById.get(edge.target);
        outgoingRelationships.push({ edge, otherNode: targetNode });
        if (targetNode && targetNode.id !== selectedNode.id) {
          connectedById.set(targetNode.id, targetNode);
        }
      }
    });

    return {
      incoming: incomingRelationships,
      outgoing: outgoingRelationships,
      connectedNodes: Array.from(connectedById.values()).sort((a, b) =>
        a.label.localeCompare(b.label),
      ),
    };
  }, [edges, nodes, selectedNode]);

  const metadataEntries = selectedNode?.metadata
    ? Object.entries(selectedNode.metadata)
    : [];

  return (
    <aside
      className={["fg-inspector", selectedNode ? "fg-inspector--active" : "", className]
        .filter(Boolean)
        .join(" ")}
      aria-label="Selected node inspector"
    >
      <header className="fg-inspector__header">
        <div>
          <p className="fg-inspector__eyebrow">Node inspector</p>
          <h2 className="fg-inspector__panel-title">
            {selectedNode ? "Selection details" : "Explore the graph"}
          </h2>
        </div>
        {onRequestClose ? (
          <button
            className="fg-inspector__close"
            type="button"
            aria-label="Close inspector"
            title="Close inspector"
            onClick={onRequestClose}
          >
            <span aria-hidden="true">×</span>
          </button>
        ) : null}
      </header>

      {!selectedNode ? (
        <div className="fg-inspector__empty" role="status">
          <div className="fg-inspector__empty-graphic" aria-hidden="true">
            <span className="fg-inspector__empty-node fg-inspector__empty-node--one" />
            <span className="fg-inspector__empty-node fg-inspector__empty-node--two" />
            <span className="fg-inspector__empty-node fg-inspector__empty-node--three" />
            <span className="fg-inspector__empty-edge fg-inspector__empty-edge--one" />
            <span className="fg-inspector__empty-edge fg-inspector__empty-edge--two" />
          </div>
          <h3>Select a node to inspect it</h3>
          <p>
            Choose any product, capability, outcome, accessory, or constraint on the
            canvas to understand its role in the comparison.
          </p>
          <ul className="fg-inspector__instructions">
            <li>
              <span aria-hidden="true">01</span>
              Click a node to focus its direct connections.
            </li>
            <li>
              <span aria-hidden="true">02</span>
              Drag nodes to make dense areas easier to read.
            </li>
            <li>
              <span aria-hidden="true">03</span>
              Pan or zoom to explore the full capability map.
            </li>
          </ul>
        </div>
      ) : (
        <div className="fg-inspector__content" aria-live="polite">
          <section className="fg-inspector__identity" aria-labelledby={`${id}-node-name`}>
            <div className="fg-inspector__identity-topline">
              <span
                className={`fg-inspector__node-mark fg-inspector__node-mark--${selectedNode.type}`}
                aria-hidden="true"
              >
                {NODE_TYPE_PRESENTATION[selectedNode.type].symbol}
              </span>
              <span className="fg-inspector__node-type">
                {NODE_TYPE_PRESENTATION[selectedNode.type].label}
              </span>
              {selectedNode.status ? (
                <span className={`fg-status fg-status--${selectedNode.status}`}>
                  {formatMetadataKey(selectedNode.status)}
                </span>
              ) : null}
            </div>
            <h3 id={`${id}-node-name`} className="fg-inspector__node-name">
              {selectedNode.label}
            </h3>
            <p className="fg-inspector__description">
              {selectedNode.description || "No description is available for this node."}
            </p>
            {onClearSelection ? (
              <button
                className="fg-inspector__clear-selection"
                type="button"
                onClick={onClearSelection}
              >
                Clear selection
              </button>
            ) : null}
          </section>

          {selectedNode.overlapScore !== undefined || selectedNode.classification ? (
            <section
              className="fg-inspector__section fg-inspector__section--assessment"
              aria-labelledby={`${id}-assessment-heading`}
            >
              <h3 id={`${id}-assessment-heading`} className="fg-inspector__section-title">
                Comparison assessment
              </h3>
              <div className="fg-inspector__assessment-grid">
                {selectedNode.overlapScore !== undefined ? (
                  <div className="fg-inspector__assessment-card">
                    <span className="fg-inspector__assessment-value">
                      {formatOverlapScore(selectedNode.overlapScore)}
                    </span>
                    <span className="fg-inspector__assessment-label">Functional overlap</span>
                  </div>
                ) : null}
                {selectedNode.classification ? (
                  <div className="fg-inspector__assessment-card">
                    <span className="fg-inspector__assessment-value fg-inspector__assessment-value--text">
                      {selectedNode.classification}
                    </span>
                    <span className="fg-inspector__assessment-label">Classification</span>
                  </div>
                ) : null}
              </div>
            </section>
          ) : null}

          {metadataEntries.length > 0 ? (
            <section
              className="fg-inspector__section"
              aria-labelledby={`${id}-metadata-heading`}
            >
              <h3 id={`${id}-metadata-heading`} className="fg-inspector__section-title">
                Metadata
              </h3>
              <dl className="fg-inspector__metadata">
                {metadataEntries.map(([key, value]) => (
                  <div className="fg-inspector__metadata-row" key={key}>
                    <dt>{formatMetadataKey(key)}</dt>
                    <dd>{formatMetadataValue(value)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : null}

          <section
            className="fg-inspector__section"
            aria-labelledby={`${id}-connections-heading`}
          >
            <div className="fg-inspector__section-heading">
              <h3 id={`${id}-connections-heading`} className="fg-inspector__section-title">
                Connected nodes
              </h3>
              <span className="fg-inspector__count">{connectedNodes.length}</span>
            </div>
            {connectedNodes.length > 0 ? (
              <ul className="fg-inspector__connected-list">
                {connectedNodes.map((node) => (
                  <li key={node.id}>
                    <button
                      className="fg-inspector__connected-button"
                      type="button"
                      onClick={() => onSelectNode(node.id)}
                    >
                      <span
                        className={`fg-inspector__connected-mark fg-inspector__connected-mark--${node.type}`}
                        aria-hidden="true"
                      >
                        {NODE_TYPE_PRESENTATION[node.type].symbol}
                      </span>
                      <span className="fg-inspector__connected-copy">
                        <span className="fg-inspector__connected-name">{node.label}</span>
                        <span className="fg-inspector__connected-type">
                          {NODE_TYPE_PRESENTATION[node.type].label}
                        </span>
                      </span>
                      <span className="fg-inspector__connected-action" aria-hidden="true">
                        →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="fg-inspector__empty-list">No connected nodes are visible.</p>
            )}
          </section>

          <section
            className="fg-inspector__section"
            aria-labelledby={`${id}-outgoing-heading`}
          >
            <div className="fg-inspector__section-heading">
              <h3 id={`${id}-outgoing-heading`} className="fg-inspector__section-title">
                Outgoing relationships
              </h3>
              <span className="fg-inspector__count">{outgoing.length}</span>
            </div>
            <RelationshipList
              relationships={outgoing}
              direction="outgoing"
              onSelectNode={onSelectNode}
            />
          </section>

          <section
            className="fg-inspector__section"
            aria-labelledby={`${id}-incoming-heading`}
          >
            <div className="fg-inspector__section-heading">
              <h3 id={`${id}-incoming-heading`} className="fg-inspector__section-title">
                Incoming relationships
              </h3>
              <span className="fg-inspector__count">{incoming.length}</span>
            </div>
            <RelationshipList
              relationships={incoming}
              direction="incoming"
              onSelectNode={onSelectNode}
            />
          </section>
        </div>
      )}
    </aside>
  );
}
