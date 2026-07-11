import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import * as d3 from "d3";
import type { GraphEdge, GraphNode, NodeType } from "../../types/graph";

interface ForceNode extends GraphNode, d3.SimulationNodeDatum {}

interface ForceEdge extends d3.SimulationLinkDatum<ForceNode> {
  id: string;
  source: string | ForceNode;
  target: string | ForceNode;
  type: GraphEdge["type"];
  label: string;
  strength?: number;
  curveIndex: number;
  curveTotal: number;
}

interface GraphRuntime {
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  viewport: d3.Selection<SVGGElement, unknown, null, undefined>;
  nodes: ForceNode[];
  edges: ForceEdge[];
  nodeSelection: d3.Selection<SVGGElement, ForceNode, SVGGElement, unknown>;
  edgeSelection: d3.Selection<SVGGElement, ForceEdge, SVGGElement, unknown>;
  edgeLabelSelection: d3.Selection<SVGTextElement, ForceEdge, SVGGElement, unknown>;
  simulation: d3.Simulation<ForceNode, ForceEdge>;
  zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
  width: number;
  height: number;
}

export interface ForceGraphHandle {
  fitView: () => void;
  resetLayout: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  centerNode: (id: string) => void;
}

export interface ForceGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNodeId?: string | null;
  hoveredNodeId?: string | null;
  showEdgeLabels?: boolean;
  comparisonActive?: boolean;
  comparisonNodeIds?: readonly string[];
  comparisonEdgeIds?: readonly string[];
  uncoveredNodeIds?: readonly string[];
  onSelectNode?: (node: GraphNode | null) => void;
  onHoverNode?: (node: GraphNode | null) => void;
  className?: string;
  ariaLabel?: string;
}

const NODE_RADIUS: Record<NodeType, number> = {
  "owned-item": 76,
  "candidate-product": 94,
  capability: 35,
  outcome: 61,
  accessory: 39,
  constraint: 68,
};

function nodeEndpointId(endpoint: string | ForceNode): string {
  return typeof endpoint === "string" ? endpoint : endpoint.id;
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function targetX(node: ForceNode, width: number) {
  switch (node.type) {
    case "owned-item":
      return width * 0.24;
    case "candidate-product":
      return width * 0.5;
    case "capability":
      return width * 0.48;
    case "outcome":
      return width * 0.78;
    case "accessory":
      return width * 0.37;
    case "constraint":
      return width * 0.68;
  }
}

function targetY(node: ForceNode, height: number) {
  if (node.type === "candidate-product") return height * 0.49;
  if (node.type === "accessory") return height * 0.73;
  if (node.type === "constraint") return height * 0.68;
  return height * 0.5;
}

function seedPositions(nodes: ForceNode[], width: number, height: number) {
  const grouped = d3.group(nodes, (node) => node.type);
  grouped.forEach((group, type) => {
    group.forEach((node, index) => {
      const spread = Math.min(height * 0.62, Math.max(130, group.length * 68));
      const offset = group.length === 1 ? 0 : (index / (group.length - 1) - 0.5) * spread;
      node.x = targetX(node, width) + Math.sin(index * 2.11 + type.length) * 22;
      node.y = targetY(node, height) + offset + Math.cos(index * 1.63) * 12;
      node.vx = 0;
      node.vy = 0;
      node.fx = null;
      node.fy = null;
    });
  });
}

function displayLines(label: string, maxCharacters: number, maxLines = 2) {
  const words = label.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  words.forEach((word) => {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxCharacters && current && lines.length < maxLines - 1) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  });
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

function appendMultilineText(
  group: d3.Selection<SVGGElement, ForceNode, null, undefined>,
  label: string,
  options: { x: number; y: number; maxCharacters: number; className: string },
) {
  const lines = displayLines(label, options.maxCharacters);
  const text = group
    .append("text")
    .attr("class", options.className)
    .attr("x", options.x)
    .attr("y", options.y - (lines.length - 1) * 6)
    .attr("text-anchor", "middle");
  lines.forEach((line, index) => {
    text
      .append("tspan")
      .attr("x", options.x)
      .attr("dy", index === 0 ? 0 : 12)
      .text(line);
  });
}

function renderNodeBody(
  body: d3.Selection<SVGGElement, ForceNode, null, undefined>,
  node: ForceNode,
) {
  if (node.type === "owned-item") {
    body.append("rect").attr("class", "fg-node__shape").attr("x", -70).attr("y", -27).attr("width", 140).attr("height", 54).attr("rx", 13);
    body.append("circle").attr("class", "fg-node__icon-backdrop").attr("cx", -51).attr("cy", 0).attr("r", 11);
    body.append("text").attr("class", "fg-node__icon").attr("x", -51).attr("y", 3).attr("text-anchor", "middle").text("O");
    appendMultilineText(body, node.label, { x: 9, y: -4, maxCharacters: 20, className: "fg-node__title" });
    body.append("text").attr("class", "fg-node__badge").attr("x", 9).attr("y", 19).attr("text-anchor", "middle").text("OWNED · GOOD");
    return;
  }

  if (node.type === "candidate-product") {
    body.append("rect").attr("class", "fg-node__glow").attr("x", -89).attr("y", -41).attr("width", 178).attr("height", 82).attr("rx", 18);
    body.append("rect").attr("class", "fg-node__shape").attr("x", -84).attr("y", -36).attr("width", 168).attr("height", 72).attr("rx", 15);
    body.append("circle").attr("class", "fg-node__candidate-dot").attr("cx", -65).attr("cy", -17).attr("r", 4);
    appendMultilineText(body, node.label, { x: 0, y: -10, maxCharacters: 25, className: "fg-node__title fg-node__title--candidate" });
    body.append("text").attr("class", "fg-node__score").attr("x", 0).attr("y", 14).attr("text-anchor", "middle").text(`${node.overlapScore ?? 0}% OVERLAP`);
    body.append("text").attr("class", "fg-node__classification").attr("x", 0).attr("y", 28).attr("text-anchor", "middle").text(node.classification ?? "candidate");
    return;
  }

  if (node.type === "capability") {
    body.append("circle").attr("class", "fg-node__shape").attr("r", 19);
    body.append("circle").attr("class", "fg-node__inner-dot").attr("r", 5);
    if (node.status === "partially-covered" || node.status === "uncovered") {
      body.append("circle").attr("class", "fg-node__status-ring").attr("r", 24);
    }
    appendMultilineText(body, node.label, { x: 0, y: 38, maxCharacters: 17, className: "fg-node__outside-label" });
    return;
  }

  if (node.type === "outcome") {
    body.append("path").attr("class", "fg-node__shape").attr("d", "M-50,-22 L43,-22 L55,0 L43,22 L-50,22 L-58,0 Z");
    body.append("circle").attr("class", "fg-node__inner-dot").attr("cx", -39).attr("r", 4);
    appendMultilineText(body, node.label, { x: 5, y: -2, maxCharacters: 18, className: "fg-node__title" });
    return;
  }

  if (node.type === "accessory") {
    body.append("path").attr("class", "fg-node__shape").attr("d", "M0,-23 L23,0 L0,23 L-23,0 Z");
    body.append("text").attr("class", "fg-node__icon").attr("x", 0).attr("y", 4).attr("text-anchor", "middle").text("+");
    appendMultilineText(body, node.label, { x: 0, y: 39, maxCharacters: 17, className: "fg-node__outside-label" });
    return;
  }

  body.append("rect").attr("class", "fg-node__shape").attr("x", -62).attr("y", -22).attr("width", 124).attr("height", 44).attr("rx", 10);
  body.append("text").attr("class", "fg-node__warning").attr("x", -47).attr("y", 4).attr("text-anchor", "middle").text("!");
  appendMultilineText(body, node.label, { x: 9, y: -2, maxCharacters: 20, className: "fg-node__title" });
}

function resolvedPoint(endpoint: string | ForceNode) {
  return typeof endpoint === "string" ? { x: 0, y: 0 } : { x: endpoint.x ?? 0, y: endpoint.y ?? 0 };
}

function edgePath(edge: ForceEdge) {
  const source = resolvedPoint(edge.source);
  const target = resolvedPoint(edge.target);
  if (nodeEndpointId(edge.source) === nodeEndpointId(edge.target)) {
    return `M${source.x},${source.y - 18} C${source.x + 54},${source.y - 75} ${source.x + 74},${source.y + 54} ${source.x + 8},${source.y + 20}`;
  }
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const centeredIndex = edge.curveIndex - (edge.curveTotal - 1) / 2;
  const curve = centeredIndex * 30;
  const midpointX = (source.x + target.x) / 2 - (dy / distance) * curve;
  const midpointY = (source.y + target.y) / 2 + (dx / distance) * curve;
  return `M${source.x},${source.y} Q${midpointX},${midpointY} ${target.x},${target.y}`;
}

function edgeLabelPoint(edge: ForceEdge) {
  const source = resolvedPoint(edge.source);
  const target = resolvedPoint(edge.target);
  if (nodeEndpointId(edge.source) === nodeEndpointId(edge.target)) {
    return { x: source.x + 54, y: source.y - 37 };
  }
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
  const centeredIndex = edge.curveIndex - (edge.curveTotal - 1) / 2;
  const curve = centeredIndex * 30;
  return {
    x: (source.x + target.x) / 2 - (dy / distance) * curve * 0.5,
    y: (source.y + target.y) / 2 + (dx / distance) * curve * 0.5 - 5,
  };
}

function assignCurves(edges: ForceEdge[]) {
  const grouped = d3.group(edges, (edge) => {
    const source = nodeEndpointId(edge.source);
    const target = nodeEndpointId(edge.target);
    return [source, target].sort().join("::");
  });
  grouped.forEach((group) => {
    group.forEach((edge, index) => {
      edge.curveIndex = index;
      edge.curveTotal = group.length;
    });
  });
}

export const ForceGraph = forwardRef<ForceGraphHandle, ForceGraphProps>(
  function ForceGraph(
    {
      nodes,
      edges,
      selectedNodeId = null,
      hoveredNodeId = null,
      showEdgeLabels = true,
      comparisonActive = false,
      comparisonNodeIds = [],
      comparisonEdgeIds = [],
      uncoveredNodeIds = [],
      onSelectNode,
      onHoverNode,
      className,
      ariaLabel = "Interactive force-directed graph",
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    const runtimeRef = useRef<GraphRuntime | null>(null);
    const onSelectRef = useRef(onSelectNode);
    const onHoverRef = useRef(onHoverNode);
    onSelectRef.current = onSelectNode;
    onHoverRef.current = onHoverNode;

    const fitView = () => {
      const runtime = runtimeRef.current;
      if (!runtime || runtime.nodes.length === 0) return;
      const xs = runtime.nodes.map((node) => node.x ?? runtime.width / 2);
      const ys = runtime.nodes.map((node) => node.y ?? runtime.height / 2);
      const minX = Math.min(...xs) - 105;
      const maxX = Math.max(...xs) + 105;
      const minY = Math.min(...ys) - 85;
      const maxY = Math.max(...ys) + 85;
      const graphWidth = Math.max(1, maxX - minX);
      const graphHeight = Math.max(1, maxY - minY);
      const scale = Math.max(0.35, Math.min(1.35, 0.86 / Math.max(graphWidth / runtime.width, graphHeight / runtime.height)));
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const transform = d3.zoomIdentity
        .translate(runtime.width / 2, runtime.height / 2)
        .scale(scale)
        .translate(-centerX, -centerY);
      const target = prefersReducedMotion() ? runtime.svg : runtime.svg.transition().duration(480);
      target.call(runtime.zoom.transform, transform);
    };

    const resetLayout = () => {
      const runtime = runtimeRef.current;
      if (!runtime) return;
      seedPositions(runtime.nodes, runtime.width, runtime.height);
      runtime.simulation.alpha(1).restart();
      runtime.svg.call(runtime.zoom.transform, d3.zoomIdentity);
      window.setTimeout(fitView, prefersReducedMotion() ? 10 : 520);
    };

    const changeZoom = (factor: number) => {
      const runtime = runtimeRef.current;
      if (!runtime) return;
      const target = prefersReducedMotion() ? runtime.svg : runtime.svg.transition().duration(220);
      target.call(runtime.zoom.scaleBy, factor);
    };

    const centerNode = (id: string) => {
      const runtime = runtimeRef.current;
      if (!runtime) return;
      const node = runtime.nodes.find((item) => item.id === id);
      if (!node || node.x === undefined || node.y === undefined) return;
      const current = d3.zoomTransform(runtime.svg.node()!);
      const scale = Math.max(1.08, current.k);
      const transform = d3.zoomIdentity
        .translate(runtime.width / 2, runtime.height / 2)
        .scale(scale)
        .translate(-node.x, -node.y);
      const target = prefersReducedMotion() ? runtime.svg : runtime.svg.transition().duration(430);
      target.call(runtime.zoom.transform, transform);
    };

    useImperativeHandle(
      ref,
      () => ({
        fitView,
        resetLayout,
        zoomIn: () => changeZoom(1.25),
        zoomOut: () => changeZoom(0.8),
        centerNode,
      }),
      [],
    );

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const reducedMotion = prefersReducedMotion();
      const width = Math.max(320, container.clientWidth || 900);
      const height = Math.max(320, container.clientHeight || 680);
      const forceNodes: ForceNode[] = nodes.map((node) => ({ ...node }));
      const forceEdges: ForceEdge[] = edges.map((edge) => ({
        ...edge,
        curveIndex: 0,
        curveTotal: 1,
      }));
      assignCurves(forceEdges);
      seedPositions(forceNodes, width, height);

      const svg = d3
        .select(container)
        .append("svg")
        .attr("class", "fg-graph-svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("role", "img")
        .attr("aria-label", ariaLabel)
        .attr("tabindex", 0);
      svg.append("title").text(ariaLabel);
      svg
        .append("desc")
        .text("Drag nodes to rearrange them, scroll to zoom, and select a node to inspect its direct relationships.");

      const defs = svg.append("defs");
      (["enables", "requires", "constrained-by", "missing-capability"] as const).forEach((type) => {
        defs
          .append("marker")
          .attr("id", `fg-arrow-${type}`)
          .attr("viewBox", "0 -5 10 10")
          .attr("refX", 20)
          .attr("refY", 0)
          .attr("markerWidth", 5)
          .attr("markerHeight", 5)
          .attr("orient", "auto")
          .attr("markerUnits", "strokeWidth")
          .append("path")
          .attr("d", "M0,-4L9,0L0,4")
          .attr("class", `fg-marker fg-marker--${type}`);
      });

      svg
        .append("rect")
        .attr("class", "fg-graph-hit-area")
        .attr("width", width)
        .attr("height", height)
        .on("click", () => onSelectRef.current?.(null));

      const viewport = svg.append("g").attr("class", "fg-graph-viewport");
      const edgeLayer = viewport.append("g").attr("class", "fg-edge-layer");
      const edgeLabelLayer = viewport.append("g").attr("class", "fg-edge-label-layer");
      const nodeLayer = viewport.append("g").attr("class", "fg-node-layer");

      const edgeSelection = edgeLayer
        .selectAll<SVGGElement, ForceEdge>("g")
        .data(forceEdges, (edge) => edge.id)
        .join("g")
        .attr("class", (edge) => `fg-edge fg-edge--${edge.type}`)
        .attr("data-edge-id", (edge) => edge.id);
      edgeSelection
        .append("path")
        .attr("class", "fg-edge__line")
        .attr("marker-end", (edge) =>
          ["enables", "requires", "constrained-by", "missing-capability"].includes(edge.type)
            ? `url(#fg-arrow-${edge.type})`
            : null,
        )
        .attr("stroke-width", (edge) => 0.8 + (edge.strength ?? 0.5) * 1.25);

      const edgeLabelSelection = edgeLabelLayer
        .selectAll<SVGTextElement, ForceEdge>("text")
        .data(forceEdges, (edge) => edge.id)
        .join("text")
        .attr("class", (edge) => `fg-edge-label fg-edge-label--${edge.type}`)
        .attr("text-anchor", "middle")
        .text((edge) => edge.label)
        .style("display", showEdgeLabels ? "block" : "none");

      const tooltip = d3
        .select(container)
        .append("div")
        .attr("class", "fg-node-tooltip")
        .attr("role", "tooltip")
        .attr("aria-hidden", "true");

      const nodeSelection = nodeLayer
        .selectAll<SVGGElement, ForceNode>("g.fg-node")
        .data(forceNodes, (node) => node.id)
        .join("g")
        .attr("class", (node) => `fg-node fg-node--${node.type} fg-node--status-${node.status ?? "none"}`)
        .attr("data-node-id", (node) => node.id)
        .attr("role", "button")
        .attr("tabindex", 0)
        .attr("aria-label", (node) => `${node.label}, ${node.type.replaceAll("-", " ")}. ${node.description}`)
        .style("opacity", reducedMotion ? 1 : 0)
        .on("click", (event, node) => {
          event.stopPropagation();
          onSelectRef.current?.(node);
        })
        .on("keydown", (event, node) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectRef.current?.(node);
          }
        })
        .on("mouseenter focus", (event, node) => {
          onHoverRef.current?.(node);
          d3.select(event.currentTarget).classed("is-hovered", true);
          tooltip.attr("aria-hidden", "false").style("opacity", "1");
          tooltip.selectAll("*").remove();
          tooltip.append("strong").text(node.label);
          tooltip.append("span").text(`${node.type.replaceAll("-", " ")} · ${node.status?.replaceAll("-", " ") ?? "available"}`);
        })
        .on("mousemove", (event: MouseEvent) => {
          const bounds = container.getBoundingClientRect();
          const x = Math.min(bounds.width - 210, Math.max(8, event.clientX - bounds.left + 14));
          const y = Math.min(bounds.height - 64, Math.max(8, event.clientY - bounds.top + 14));
          tooltip.style("transform", `translate(${x}px, ${y}px)`);
        })
        .on("mouseleave blur", (event) => {
          onHoverRef.current?.(null);
          d3.select(event.currentTarget).classed("is-hovered", false);
          tooltip.attr("aria-hidden", "true").style("opacity", "0");
        });

      nodeSelection.each(function (node) {
        const body = d3
          .select<SVGGElement, ForceNode>(this)
          .append("g")
          .attr("class", "fg-node__body");
        renderNodeBody(body, node);
      });

      const linkForce = d3
        .forceLink<ForceNode, ForceEdge>(forceEdges)
        .id((node) => node.id)
        .distance((edge) => {
          const target = typeof edge.target === "string" ? undefined : edge.target;
          if (edge.type === "overlaps-with") return 175;
          if (edge.type === "constrained-by") return 112;
          if (target?.type === "outcome") return 125;
          if (target?.type === "capability" && nodeEndpointId(edge.source).includes("candidate")) return 82;
          return 105;
        })
        .strength((edge) => Math.min(0.85, (edge.strength ?? 0.5) * 0.72));

      // Horizontal forces give the graph a readable product → capability → outcome flow,
      // while weak centring and charge forces keep the layout organic rather than columnar.
      const simulation = d3
        .forceSimulation<ForceNode>(forceNodes)
        .force("link", linkForce)
        .force("charge", d3.forceManyBody<ForceNode>().strength((node) => node.type === "candidate-product" ? -680 : -470).distanceMax(620))
        .force("collide", d3.forceCollide<ForceNode>().radius((node) => NODE_RADIUS[node.type] + 12).strength(1).iterations(2))
        .force("center", d3.forceCenter(width / 2, height / 2).strength(0.08))
        .force("x", d3.forceX<ForceNode>((node) => targetX(node, width)).strength((node) => node.type === "candidate-product" ? 0.14 : 0.035))
        .force("y", d3.forceY<ForceNode>((node) => targetY(node, height)).strength((node) => node.type === "constraint" ? 0.055 : 0.025))
        .alphaDecay(0.035)
        .velocityDecay(0.42);

      const drag = d3
        .drag<SVGGElement, ForceNode>()
        .on("start", (event, node) => {
          event.sourceEvent?.stopPropagation();
          if (!event.active) simulation.alphaTarget(0.16).restart();
          node.fx = node.x;
          node.fy = node.y;
        })
        .on("drag", (event, node) => {
          node.fx = event.x;
          node.fy = event.y;
        })
        .on("end", (event, node) => {
          if (!event.active) simulation.alphaTarget(0);
          node.fx = null;
          node.fy = null;
        });
      nodeSelection.call(drag);

      simulation.on("tick", () => {
        nodeSelection.attr("transform", (node) => `translate(${node.x ?? 0},${node.y ?? 0})`);
        edgeSelection.select<SVGPathElement>("path").attr("d", edgePath);
        edgeLabelSelection
          .attr("x", (edge) => edgeLabelPoint(edge).x)
          .attr("y", (edge) => edgeLabelPoint(edge).y);
      });

      nodeSelection
        .transition()
        .delay((_, index) => (reducedMotion ? 0 : index * 22))
        .duration(reducedMotion ? 0 : 360)
        .style("opacity", 1);
      edgeSelection
        .select("path")
        .attr("pathLength", 1)
        .style("stroke-dasharray", reducedMotion ? "" : "1")
        .style("stroke-dashoffset", reducedMotion ? "" : "1")
        .transition()
        .delay((_, index) => (reducedMotion ? 0 : 100 + index * 10))
        .duration(reducedMotion ? 0 : 520)
        .style("stroke-dashoffset", "0")
        .on("end", function () {
          d3.select(this).style("stroke-dasharray", "").style("stroke-dashoffset", "");
        });

      const zoom = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.28, 2.8])
        .filter((event) => event.type !== "dblclick")
        .on("zoom", (event) => viewport.attr("transform", event.transform.toString()));
      svg.call(zoom).on("dblclick.zoom", null);

      runtimeRef.current = {
        svg,
        viewport,
        nodes: forceNodes,
        edges: forceEdges,
        nodeSelection,
        edgeSelection,
        edgeLabelSelection,
        simulation,
        zoom,
        width,
        height,
      };

      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || !runtimeRef.current) return;
        const nextWidth = Math.max(320, entry.contentRect.width);
        const nextHeight = Math.max(320, entry.contentRect.height);
        runtimeRef.current.width = nextWidth;
        runtimeRef.current.height = nextHeight;
        svg.attr("viewBox", `0 0 ${nextWidth} ${nextHeight}`);
        svg.select<SVGRectElement>(".fg-graph-hit-area").attr("width", nextWidth).attr("height", nextHeight);
        simulation.force("center", d3.forceCenter(nextWidth / 2, nextHeight / 2).strength(0.08));
        simulation.force("x", d3.forceX<ForceNode>((node) => targetX(node, nextWidth)).strength((node) => node.type === "candidate-product" ? 0.14 : 0.035));
        simulation.force("y", d3.forceY<ForceNode>((node) => targetY(node, nextHeight)).strength(0.03));
        simulation.alpha(0.24).restart();
      });
      resizeObserver.observe(container);

      window.setTimeout(fitView, reducedMotion ? 25 : 760);

      return () => {
        resizeObserver.disconnect();
        simulation.stop();
        svg.on(".zoom", null);
        tooltip.remove();
        svg.remove();
        runtimeRef.current = null;
      };
    }, [ariaLabel, edges, nodes]);

    useEffect(() => {
      const runtime = runtimeRef.current;
      if (!runtime) return;
      runtime.edgeLabelSelection.style("display", showEdgeLabels ? "block" : "none");
    }, [showEdgeLabels]);

    useEffect(() => {
      const runtime = runtimeRef.current;
      if (!runtime) return;
      const reducedMotion = prefersReducedMotion();
      const activeId = selectedNodeId ?? hoveredNodeId;
      const connectedIds = new Set<string>();
      const connectedEdgeIds = new Set<string>();
      if (activeId) {
        connectedIds.add(activeId);
        runtime.edges.forEach((edge) => {
          const source = nodeEndpointId(edge.source);
          const target = nodeEndpointId(edge.target);
          if (source === activeId || target === activeId) {
            connectedIds.add(source);
            connectedIds.add(target);
            connectedEdgeIds.add(edge.id);
          }
        });
      }

      const comparisonNodes = new Set(comparisonNodeIds);
      const comparisonEdges = new Set(comparisonEdgeIds);
      const uncovered = new Set(uncoveredNodeIds);
      runtime.nodeSelection
        .interrupt()
        .classed("is-selected", (node) => node.id === selectedNodeId)
        .classed("is-connected", (node) => Boolean(activeId) && connectedIds.has(node.id))
        .classed("is-comparison", (node) => comparisonActive && comparisonNodes.has(node.id))
        .classed("is-uncovered", (node) => uncovered.has(node.id));
      runtime.edgeSelection
        .interrupt()
        .classed("is-connected", (edge) => connectedEdgeIds.has(edge.id))
        .classed("is-comparison", (edge) => comparisonActive && comparisonEdges.has(edge.id));

      const nodeOpacity = (node: ForceNode) => {
        if (comparisonActive) return comparisonNodes.has(node.id) ? 1 : 0.16;
        if (activeId) return connectedIds.has(node.id) ? 1 : 0.19;
        return 1;
      };
      const edgeOpacity = (edge: ForceEdge) => {
        if (comparisonActive) return comparisonEdges.has(edge.id) ? 0.98 : 0.07;
        if (activeId) return connectedEdgeIds.has(edge.id) ? 0.95 : 0.08;
        return 0.58;
      };

      const nodeTransition = runtime.nodeSelection.transition().duration(reducedMotion ? 0 : 190);
      if (comparisonActive && !reducedMotion) {
        nodeTransition.delay((node) => {
          const index = comparisonNodeIds.indexOf(node.id);
          return index >= 0 ? Math.min(820, index * 80) : 0;
        });
      }
      nodeTransition.style("opacity", nodeOpacity);

      const edgeTransition = runtime.edgeSelection.transition().duration(reducedMotion ? 0 : 190);
      if (comparisonActive && !reducedMotion) {
        edgeTransition.delay((edge) => {
          const index = comparisonEdgeIds.indexOf(edge.id);
          return index >= 0 ? Math.min(900, 120 + index * 78) : 0;
        });
      }
      edgeTransition.style("opacity", edgeOpacity);
      runtime.edgeLabelSelection
        .interrupt()
        .transition()
        .duration(reducedMotion ? 0 : 160)
        .style("opacity", (edge) => {
          if (!showEdgeLabels) return 0;
          if (comparisonActive) return comparisonEdges.has(edge.id) ? 1 : 0.04;
          if (activeId) return connectedEdgeIds.has(edge.id) ? 1 : 0.05;
          return 0.72;
        });
    }, [comparisonActive, comparisonEdgeIds, comparisonNodeIds, hoveredNodeId, selectedNodeId, showEdgeLabels, uncoveredNodeIds]);

    return (
      <div
        ref={containerRef}
        className={["fg-force-graph-root", className].filter(Boolean).join(" ")}
        data-testid="force-graph"
      />
    );
  },
);

export default ForceGraph;
