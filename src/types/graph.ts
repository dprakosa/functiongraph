export type NodeType =
  | "owned-item"
  | "candidate-product"
  | "capability"
  | "outcome"
  | "accessory"
  | "constraint";

export type RelationshipType =
  | "supports"
  | "enables"
  | "requires"
  | "constrained-by"
  | "overlaps-with"
  | "missing-capability";

export type GraphNodeStatus =
  | "owned"
  | "candidate"
  | "covered"
  | "partially-covered"
  | "uncovered"
  | "available"
  | "required"
  | "constraint";

export type ComparisonClassification =
  | "convenience improvement"
  | "strong duplication"
  | "genuinely new capability";

export type GraphMetadataValue = string | number | boolean;

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  description: string;
  status?: GraphNodeStatus;
  overlapScore?: number;
  classification?: ComparisonClassification;
  metadata?: Record<string, GraphMetadataValue>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  label: string;
  strength?: number;
}

export interface ScenarioMetrics {
  overlapScore: number;
  classification: ComparisonClassification;
  coveredCapabilities: number;
  partiallyCoveredCapabilities: number;
  missingCapabilities: number;
  totalCapabilities: number;
  summary: string;
}

export interface ComparisonPath {
  nodeIds: string[];
  edgeIds: string[];
}

export interface GraphScenario {
  id: string;
  name: string;
  title: string;
  shortDescription: string;
  candidateId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  metrics: ScenarioMetrics;
  comparisonPath: ComparisonPath;
}

export const NODE_TYPES: readonly NodeType[] = [
  "owned-item",
  "candidate-product",
  "capability",
  "outcome",
  "accessory",
  "constraint",
];

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  "owned-item": "Owned item",
  "candidate-product": "Candidate product",
  capability: "Capability",
  outcome: "Outcome",
  accessory: "Accessory",
  constraint: "Constraint",
};

export const RELATIONSHIP_TYPES: readonly RelationshipType[] = [
  "supports",
  "enables",
  "requires",
  "constrained-by",
  "overlaps-with",
  "missing-capability",
];

export const RELATIONSHIP_TYPE_LABELS: Record<RelationshipType, string> = {
  supports: "Supports",
  enables: "Enables",
  requires: "Requires",
  "constrained-by": "Constrained by",
  "overlaps-with": "Overlaps with",
  "missing-capability": "Missing capability",
};
