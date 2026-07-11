import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import * as d3 from "d3";
import type { GraphData, GraphEdgeDatum, GraphNodeDatum } from "../graph/buildGraph";
import {
  deriveItemCapabilitySelection,
  GHOST_ID,
} from "../graph/buildGraph";
import {
  placeGraphTooltip,
  type GraphNodeTooltip,
} from "../graph/tooltip";
import type { Phase } from "../state/appReducer";
import { TIMINGS } from "../state/useBeats";

interface ForceNode extends GraphNodeDatum, d3.SimulationNodeDatum {
  width: number;
  height: number;
  collideRadius: number;
}

interface ForceEdge extends Omit<GraphEdgeDatum, "source" | "target"> {
  source: string | ForceNode;
  target: string | ForceNode;
}

export interface GraphCanvasProps {
  graph: GraphData;
  phase: Phase;
  routeDomain: string | null;
  routingActive: boolean;
  pulsingSlug: string | null;
  selectedItemId: string | null;
  reducedMotion: boolean;
  /** set when a view change was just announced (route toast) or user-initiated */
  viewKey: string;
  onNodeClick: (node: GraphNodeDatum) => void;
  onZoomOut?: () => void;
}

const GHOST_PIN_PHASES: ReadonlySet<Phase> = new Set([
  "extracting",
  "scanning",
  "routing",
]);

const GRAPH_TOOLTIP_ID = "graph-node-tooltip";

type TooltipTrigger = "pointer" | "focus" | "touch";

interface ActiveTooltip {
  nodeId: string;
  model: GraphNodeTooltip;
  trigger: TooltipTrigger;
}

function GraphTooltip({
  active,
  tooltipRef,
}: {
  active: ActiveTooltip;
  tooltipRef: RefObject<HTMLDivElement | null>;
}) {
  const { model } = active;
  const previewCopy = model.preview
    ? [
        ...model.preview.values,
        ...(model.preview.overflowCount > 0
          ? [`+${model.preview.overflowCount} more`]
          : []),
      ].join(" · ")
    : null;

  return (
    <div
      ref={tooltipRef}
      className="graph-tooltip"
      id={GRAPH_TOOLTIP_ID}
      role="tooltip"
      data-tooltip-kind={model.kind}
      data-tooltip-node-id={active.nodeId}
    >
      <span className="graph-tooltip__eyebrow" aria-hidden="true">
        {model.eyebrow}
      </span>
      <strong className="graph-tooltip__title" aria-hidden="true">
        {model.title}
      </strong>
      {model.status && <p className="graph-tooltip__status">{model.status}</p>}
      {model.details.length > 0 && (
        <dl className="graph-tooltip__details">
          {model.details.map((detail) => (
            <div key={detail.label}>
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {model.preview && (
        <p className="graph-tooltip__preview">
          <span>{model.preview.label}</span>
          {previewCopy || "None mapped"}
        </p>
      )}
      {model.action && (
        <p className="graph-tooltip__action" aria-hidden="true">
          {model.action} →
        </p>
      )}
    </div>
  );
}

function itemLabelLines(label: string): string[] {
  if (label.length <= 11 || !label.includes(" ")) return [label];
  return balancedWordLines(label, 3);
}

function balancedWordLines(label: string, maxLines: number): string[] {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words.length === 0 ? [label] : words;

  const lineCount = Math.min(
    maxLines,
    words.length === 2 && label.length > 11 ? 2 : Math.ceil(words.length / 2),
  );
  const lines: string[] = [];
  let wordIndex = 0;

  for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
    const remainingLines = lineCount - lineIndex;
    const remainingWords = words.slice(wordIndex);
    if (remainingLines === 1) {
      lines.push(remainingWords.join(" "));
      break;
    }

    const remainingCharacters = remainingWords.join(" ").length;
    const targetLength = Math.ceil(remainingCharacters / remainingLines);
    const lineWords: string[] = [];
    while (wordIndex < words.length - (remainingLines - 1)) {
      const candidate = [...lineWords, words[wordIndex]].join(" ");
      if (lineWords.length > 0 && candidate.length > targetLength) break;
      lineWords.push(words[wordIndex]);
      wordIndex += 1;
    }
    lines.push(lineWords.join(" "));
  }

  return lines;
}

function nodeDimensions(node: GraphNodeDatum): {
  width: number;
  height: number;
  collideRadius: number;
} {
  const len = node.label.length;
  switch (node.kind) {
    case "room": {
      const itemCount = Number(node.sub?.split(" ")[0] ?? 6);
      const radius = 34 + itemCount * 3;
      return { width: radius * 2, height: radius * 2, collideRadius: radius + 8 };
    }
    case "room-unscanned":
      return { width: 80, height: 80, collideRadius: 48 };
    case "item": {
      const words = node.label.trim().split(/\s+/).filter(Boolean);
      const lines = itemLabelLines(node.label);
      const longestLine = Math.max(...lines.map((line) => line.length));
      const diameter = Math.min(
        124,
        Math.max(
          78,
          50 + longestLine * 5.4,
          76 + Math.max(0, lines.length - 1) * 16 + (node.badge ? 10 : 0),
          72 + Math.max(0, words.length - 1) * 6,
        ),
      );
      return {
        width: diameter,
        height: diameter,
        collideRadius: diameter / 2 + 8,
      };
    }
    case "hub":
    case "hub-new": {
      const width = 28 + len * 6.8;
      return { width, height: 28, collideRadius: width / 2 + 8 };
    }
    case "ghost": {
      const [name] = node.label.split(" · ");
      const words = name.trim().split(/\s+/).filter(Boolean);
      const lines = balancedWordLines(name, 3);
      const longestLine = Math.max(...lines.map((line) => line.length));
      const diameter = Math.min(
        156,
        Math.max(104, 82 + longestLine * 4, 96 + Math.max(0, words.length - 1) * 8),
      );
      return {
        width: diameter,
        height: diameter,
        collideRadius: diameter / 2 + 10,
      };
    }
    case "mini": {
      const width = 22 + len * 6.1;
      return { width, height: 24, collideRadius: width / 2 + 6 };
    }
  }
}

function endpointId(endpoint: string | ForceNode): string {
  return typeof endpoint === "string" ? endpoint : endpoint.id;
}

function isInteractiveNode(node: GraphNodeDatum): boolean {
  return node.kind === "room" || node.kind === "room-unscanned" || node.kind === "item";
}

function accessibleNodeKind(node: GraphNodeDatum): string {
  switch (node.kind) {
    case "hub":
      return "capability";
    case "hub-new":
      return "new capability";
    case "mini":
      return "unique capability";
    case "room-unscanned":
      return "unscanned room";
    case "ghost":
      return "product under consideration";
    default:
      return node.kind;
  }
}

function accessibleNodeLabel(node: GraphNodeDatum): string {
  const action = node.tooltip.action ? `. ${node.tooltip.action}` : "";
  return `${node.tooltip.title}, ${accessibleNodeKind(node)}${action}`;
}

function buildNodeBody(
  group: d3.Selection<SVGGElement, ForceNode, SVGGElement, unknown>,
) {
  group.each(function (node) {
    const body = d3.select(this);
    const { width, height } = node;

    if (node.kind === "room" || node.kind === "room-unscanned") {
      const radius = width / 2;
      if (node.kind === "room") {
        body.append("circle").attr("class", "gnode__ring").attr("r", radius + 7);
      }
      body.append("circle").attr("class", "gnode__shape").attr("r", radius);
      body
        .append("text")
        .attr("class", "gnode__label")
        .attr("text-anchor", "middle")
        .attr("y", node.sub ? -2 : 4)
        .text(node.label);
      if (node.sub) {
        body
          .append("text")
          .attr("class", "gnode__sub")
          .attr("text-anchor", "middle")
          .attr("y", 15)
          .text(node.sub);
      }
      if (node.badge) {
        const badge = body
          .append("g")
          .attr("class", "gnode__hotspot")
          .attr(
            "transform",
            `translate(${radius * 0.72},${-radius * 0.72})`,
          );
        badge.append("circle").attr("r", 11);
        badge
          .append("text")
          .attr("text-anchor", "middle")
          .attr("y", 3.5)
          .text(node.badge);
      }
      return;
    }

    if (node.kind === "ghost") {
      const [name, ...rest] = node.label.split(" · ");
      const lines = balancedWordLines(name, 3);
      const lineHeight = 16;
      const contentHeight = lines.length * lineHeight + (rest.length ? 22 : 0);
      const startY = -contentHeight / 2 + 12;
      body
        .append("circle")
        .attr("class", "gnode__shape")
        .attr("r", width / 2);
      const label = body
        .append("text")
        .attr("class", "gnode__label")
        .attr("text-anchor", "middle");
      lines.forEach((line, index) => {
        label
          .append("tspan")
          .attr("x", 0)
          .attr("y", startY + index * lineHeight)
          .text(line);
      });
      if (rest.length) {
        body
          .append("text")
          .attr("class", "gnode__sub")
          .attr("text-anchor", "middle")
          .attr("y", startY + lines.length * lineHeight + 7)
          .text(rest.join(" · "));
      }
      return;
    }

    if (node.kind === "item") {
      const radius = width / 2;
      const lines = itemLabelLines(node.label);
      const lineHeight = 16;
      const startY = lines.length === 1 ? 5 : 4 - ((lines.length - 1) * lineHeight) / 2;
      body
        .append("circle")
        .attr("class", "gnode__hit")
        .attr("r", radius + 7);
      body
        .append("circle")
        .attr("class", "gnode__shape")
        .attr("r", radius);
      body
        .append("circle")
        .attr("class", "gnode__dot")
        .attr("cy", startY - 22)
        .attr("r", 3.5);
      const label = body
        .append("text")
        .attr("class", "gnode__label")
        .attr("text-anchor", "middle");
      lines.forEach((line, index) => {
        label
          .append("tspan")
          .attr("x", 0)
          .attr("y", startY + index * lineHeight)
          .text(line);
      });
      if (node.badge) {
        body
          .append("text")
          .attr("class", "gnode__badge")
          .attr("text-anchor", "middle")
          .attr("y", startY + lines.length * lineHeight + 8)
          .text(`+${node.badge}`);
      }
      return;
    }

    // hub, hub-new, mini — pills
    body
      .append("rect")
      .attr("class", "gnode__shape")
      .attr("x", -width / 2)
      .attr("y", -height / 2)
      .attr("width", width)
      .attr("height", height)
      .attr("rx", height / 2);
    body
      .append("text")
      .attr("class", "gnode__label")
      .attr("text-anchor", "middle")
      .attr("y", node.kind === "mini" ? 3.5 : 4)
      .text(node.label);
  });
}

export function GraphCanvas({
  graph,
  phase,
  routeDomain,
  routingActive,
  pulsingSlug,
  selectedItemId,
  reducedMotion,
  viewKey,
  onNodeClick,
  onZoomOut,
}: GraphCanvasProps) {
  const itemCapabilitySelection = useMemo(
    () => deriveItemCapabilitySelection(graph, selectedItemId),
    [graph, selectedItemId],
  );
  const [activeTooltip, setActiveTooltip] = useState<ActiveTooltip | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const activeTooltipRef = useRef<ActiveTooltip | null>(null);
  const latestNodesByIdRef = useRef<Map<string, GraphNodeDatum>>(new Map());
  latestNodesByIdRef.current = new Map(graph.nodes.map((node) => [node.id, node]));
  const hoveredNodeRef = useRef<string | null>(null);
  const focusedNodeRef = useRef<string | null>(null);
  const dismissedTooltipNodeRef = useRef<string | null>(null);
  const svgRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
  const viewportRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const simRef = useRef<d3.Simulation<ForceNode, ForceEdge> | null>(null);
  const nodesRef = useRef<ForceNode[]>([]);
  const nodeSelRef = useRef<d3.Selection<SVGGElement, ForceNode, SVGGElement, unknown> | null>(null);
  const edgeSelRef = useRef<d3.Selection<SVGPathElement, ForceEdge, SVGGElement, unknown> | null>(null);
  const scanSelRef = useRef<d3.Selection<SVGPathElement, ForceEdge, SVGGElement, unknown> | null>(null);
  const positionsRef = useRef(new Map<string, { x: number; y: number }>());
  const signatureRef = useRef("");
  const lastReducedMotionRef = useRef(reducedMotion);
  const sizeRef = useRef({ width: 900, height: 640 });
  const fitPendingRef = useRef(true);
  const initialFitDoneRef = useRef(false);
  const viewKeyRef = useRef(viewKey);
  const onNodeClickRef = useRef(onNodeClick);
  onNodeClickRef.current = onNodeClick;
  const onZoomOutRef = useRef(onZoomOut);
  onZoomOutRef.current = onZoomOut;

  const showTooltipRef = useRef<
    (node: GraphNodeDatum, trigger: TooltipTrigger) => void
  >(() => undefined);
  const hideTooltipRef = useRef<
    (nodeId?: string, preserveTouch?: boolean) => void
  >(() => undefined);

  showTooltipRef.current = (node, trigger) => {
    const latest = latestNodesByIdRef.current.get(node.id) ?? node;
    const next = { nodeId: node.id, model: latest.tooltip, trigger };
    activeTooltipRef.current = next;
    setActiveTooltip(next);
  };

  hideTooltipRef.current = (nodeId, preserveTouch = false) => {
    setActiveTooltip((current) => {
      if (!current || (nodeId && current.nodeId !== nodeId)) return current;
      if (preserveTouch && current.trigger === "touch") return current;
      activeTooltipRef.current = null;
      return null;
    });
  };

  function positionActiveTooltip() {
    const container = containerRef.current;
    const tooltip = tooltipRef.current;
    const active = activeTooltipRef.current;
    const nodeSelection = nodeSelRef.current;
    if (!container || !tooltip || !active || !nodeSelection) return;

    const nodeElement = nodeSelection
      .filter((node) => node.id === active.nodeId)
      .node();
    if (!nodeElement) {
      hideTooltipRef.current(active.nodeId);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const nodeRect = nodeElement.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    const placement = placeGraphTooltip(containerRect, nodeRect, tooltipRect);

    tooltip.style.left = `${Math.round(placement.left)}px`;
    tooltip.style.top = `${Math.round(placement.top)}px`;
    tooltip.style.visibility = "visible";
    tooltip.dataset.side = placement.side;
  }

  function renderSimulationFrame() {
    nodesRef.current.forEach((node) => {
      positionsRef.current.set(node.id, { x: node.x ?? 0, y: node.y ?? 0 });
    });
    nodeSelRef.current?.attr(
      "transform",
      (node) => `translate(${node.x ?? 0},${node.y ?? 0})`,
    );
    const line = (edge: ForceEdge) => {
      const source =
        typeof edge.source === "string"
          ? positionsRef.current.get(edge.source)
          : { x: edge.source.x ?? 0, y: edge.source.y ?? 0 };
      const target =
        typeof edge.target === "string"
          ? positionsRef.current.get(edge.target)
          : { x: edge.target.x ?? 0, y: edge.target.y ?? 0 };
      if (!source || !target) return "";
      return `M${source.x},${source.y}L${target.x},${target.y}`;
    };
    edgeSelRef.current?.attr("d", line);
    scanSelRef.current?.attr("d", line);
  }

  const signature = useMemo(
    () =>
      [
        graph.nodes.map((node) => node.id).join(","),
        graph.edges.map((edge) => edge.id).join(","),
      ].join(";"),
    [graph],
  );

  useLayoutEffect(() => {
    positionActiveTooltip();
    // Positioning reads the freshly rendered tooltip and current SVG node.
    // It is cosmetic and never touches force state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTooltip]);

  useEffect(() => {
    const dismissOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !activeTooltipRef.current) return;
      event.preventDefault();
      dismissedTooltipNodeRef.current = activeTooltipRef.current.nodeId;
      hideTooltipRef.current();
    };
    const dismissTouchOutside = (event: PointerEvent) => {
      const active = activeTooltipRef.current;
      if (!active || active.trigger !== "touch") return;
      const target = event.target;
      if (target instanceof Element && target.closest("g.gnode")) return;
      hideTooltipRef.current();
    };
    window.addEventListener("keydown", dismissOnEscape);
    window.addEventListener("pointerdown", dismissTouchOutside, true);
    return () => {
      window.removeEventListener("keydown", dismissOnEscape);
      window.removeEventListener("pointerdown", dismissTouchOutside, true);
    };
  }, []);

  useEffect(() => {
    hideTooltipRef.current();
    hoveredNodeRef.current = null;
    focusedNodeRef.current = null;
    dismissedTooltipNodeRef.current = null;
  }, [signature, viewKey]);

  // --- one-time svg/simulation scaffold -----------------------------------
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const width = Math.max(320, stage.clientWidth || 900);
    const height = Math.max(320, stage.clientHeight || 640);
    sizeRef.current = { width, height };

    const svg = d3
      .select(stage)
      .append("svg")
      .attr("class", "graph-svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("role", "group")
      .attr("aria-label", "FunctionGraph capability graph");
    svg
      .append("desc")
      .text(
        "Force-directed map of what you own. Coral means covered, green means genuinely new.",
      );
    svg.on("pointerdown.tooltip-dismiss", (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest("g.gnode")) return;
      hideTooltipRef.current();
    });

    const viewport = svg.append("g").attr("class", "graph-viewport");
    viewport.append("g").attr("class", "layer-scan");
    viewport.append("g").attr("class", "layer-edges");
    viewport.append("g").attr("class", "layer-nodes");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 2.5])
      .filter((event) => event.type !== "dblclick")
      .on("zoom", (event) => {
        viewport.attr("transform", event.transform.toString());
        positionActiveTooltip();
        if (
          event.sourceEvent &&
          viewKeyRef.current.startsWith("room:") &&
          event.transform.k <= 0.31
        ) {
          onZoomOutRef.current?.();
        }
      });
    svg.call(zoom).on("dblclick.zoom", null);

    const simulation = d3
      .forceSimulation<ForceNode>([])
      .force(
        "charge",
        d3
          .forceManyBody<ForceNode>()
          .strength((node) => {
            switch (node.kind) {
              case "room":
                return -1300;
              case "room-unscanned":
                return -750;
              case "ghost":
                return -420;
              case "item":
                return -300;
              case "mini":
                return -110;
              default:
                return -240;
            }
          })
          .distanceMax(520),
      )
      .force(
        "collide",
        d3
          .forceCollide<ForceNode>()
          .radius((node) => node.collideRadius)
          .strength(0.9)
          .iterations(2),
      )
      .force("x", d3.forceX<ForceNode>(width / 2).strength(0.045))
      .force("y", d3.forceY<ForceNode>(height / 2).strength(0.06))
      .force(
        "link",
        d3
          .forceLink<ForceNode, ForceEdge>([])
          .id((node) => node.id)
          .distance((edge) => edge.distance)
          .strength((edge) => edge.strength),
      )
      .alphaDecay(0.07)
      .velocityDecay(0.45);

    simulation.on("tick", () => {
      renderSimulationFrame();
      // Refit once the force layout is effectively settled. Waiting only for
      // the final `end` event can leave the camera framed around an earlier,
      // tighter cluster when layout and viewport resizing overlap.
      if (fitPendingRef.current && simulation.alpha() <= 0.01) {
        fitPendingRef.current = false;
        fitView(initialFitDoneRef.current ? TIMINGS.cameraMs : 0);
        initialFitDoneRef.current = true;
      }
    });

    simulation.on("end", () => {
      if (fitPendingRef.current) {
        fitPendingRef.current = false;
        // Initial framing must not look like unannounced navigation (VIS-6).
        // Later view changes follow a user action or the route toast and use
        // the normative camera duration.
        fitView(initialFitDoneRef.current ? TIMINGS.cameraMs : 0);
        initialFitDoneRef.current = true;
      }
    });

    svgRef.current = svg;
    viewportRef.current = viewport;
    zoomRef.current = zoom;
    simRef.current = simulation;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextWidth = Math.max(320, entry.contentRect.width);
      const nextHeight = Math.max(320, entry.contentRect.height);
      if (
        Math.abs(nextWidth - sizeRef.current.width) < 4 &&
        Math.abs(nextHeight - sizeRef.current.height) < 4
      ) {
        return;
      }
      sizeRef.current = { width: nextWidth, height: nextHeight };
      svg.attr("viewBox", `0 0 ${nextWidth} ${nextHeight}`);
      simulation.force("x", d3.forceX<ForceNode>(nextWidth / 2).strength(0.045));
      simulation.force("y", d3.forceY<ForceNode>(nextHeight / 2).strength(0.06));
      // Resize is caused by the verdict panel sliding in or a window change —
      // both announced/user-initiated; refit so graph and panel share space.
      fitView(TIMINGS.cameraMs);
    });
    resizeObserver.observe(stage);

    return () => {
      resizeObserver.disconnect();
      simulation.stop();
      svg.remove();
      svgRef.current = null;
      simRef.current = null;
      nodeSelRef.current = null;
      edgeSelRef.current = null;
      scanSelRef.current = null;
      signatureRef.current = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fitView(duration: number, maxScale = 1.5) {
    const svg = svgRef.current;
    const zoom = zoomRef.current;
    const nodes = nodesRef.current;
    if (!svg || !zoom || nodes.length === 0) return;
    const { width, height } = sizeRef.current;
    const minX = Math.min(...nodes.map((n) => (n.x ?? 0) - n.collideRadius)) - 30;
    const maxX = Math.max(...nodes.map((n) => (n.x ?? 0) + n.collideRadius)) + 30;
    const minY = Math.min(...nodes.map((n) => (n.y ?? 0) - n.collideRadius)) - 30;
    const maxY = Math.max(...nodes.map((n) => (n.y ?? 0) + n.collideRadius)) + 30;
    const scale = Math.max(
      0.35,
      Math.min(
        maxScale,
        0.92 / Math.max((maxX - minX) / width, (maxY - minY) / height),
      ),
    );
    const transform = d3.zoomIdentity
      .translate(width / 2, height / 2)
      .scale(scale)
      .translate(-(minX + maxX) / 2, -(minY + maxY) / 2);
    // VIS-6: camera 700–900 ms, eased — or instant under reduced motion.
    const target = reducedMotion
      ? svg
      : svg.transition().duration(duration).ease(d3.easeCubicInOut);
    target.call(zoom.transform, transform);
  }

  // --- structural reconcile (SM-8: reheat only on structural change) -------
  useEffect(() => {
    const simulation = simRef.current;
    const viewport = viewportRef.current;
    if (!simulation || !viewport) return;
    const becameReduced = reducedMotion && !lastReducedMotionRef.current;
    lastReducedMotionRef.current = reducedMotion;
    if (signature === signatureRef.current && !becameReduced) return;
    signatureRef.current = signature;
    // Every structural update gets one final, data-derived fit after physics
    // cools. This keeps newly materialized approval hubs and item minis
    // inspectable without reacting to cosmetic hover or pulse state.
    fitPendingRef.current = true;
    const { width, height } = sizeRef.current;

    const forceNodes: ForceNode[] = graph.nodes.map((node) => {
      const dims = nodeDimensions(node);
      const previous = positionsRef.current.get(node.id);
      const seed = node.seedNear
        ? positionsRef.current.get(node.seedNear)
        : undefined;
      const x =
        previous?.x ?? (seed ? seed.x + (Math.random() - 0.5) * 70 : width / 2 + (Math.random() - 0.5) * 120);
      const y =
        previous?.y ?? (seed ? seed.y + (Math.random() - 0.5) * 70 : height / 2 + (Math.random() - 0.5) * 120);
      return { ...node, ...dims, x, y };
    });

    // SM-4: the ghost is pinned at the canvas edge until the dive (SM-6).
    forceNodes.forEach((node) => {
      if (node.kind !== "ghost") return;
      if (GHOST_PIN_PHASES.has(phase)) {
        node.fx = width - node.width / 2 - 26;
        node.fy = height * 0.3;
        node.x = node.fx;
        node.y = node.fy;
      } else {
        node.fx = null;
        node.fy = null;
      }
    });

    const forceEdges: ForceEdge[] = graph.edges
      .filter((edge) => edge.kind !== "scan")
      .map((edge) => ({ ...edge }));
    const scanEdges: ForceEdge[] = graph.edges
      .filter((edge) => edge.kind === "scan")
      .map((edge) => ({ ...edge }));

    nodesRef.current = forceNodes;

    const nodeSelection = viewport
      .select<SVGGElement>(".layer-nodes")
      .selectAll<SVGGElement, ForceNode>("g.gnode")
      .data(forceNodes, (node) => node.id)
      .join(
        (enter) => {
          const group = enter
            .append("g")
            .style("opacity", 0);
          buildNodeBody(group);
          group
            .transition()
            .duration(reducedMotion ? 0 : 220)
            .style("opacity", 1)
            .on("end", function () {
              // Keep entry animation inline styles from overriding later
              // selection-focus opacity classes.
              d3.select(this).style("opacity", null);
            });
          return group;
        },
        (update) => update,
        (exit) =>
          exit
            .transition()
            .duration(reducedMotion ? 0 : 160)
            .style("opacity", 0)
            .remove(),
      )
      .attr(
        "class",
        (node) =>
          `gnode gnode--${node.kind}${node.hot ? " is-hot" : ""}`,
      )
      .attr("role", (node) => (isInteractiveNode(node) ? "button" : "img"))
      .attr("tabindex", 0)
      .attr("data-node-id", (node) => node.id)
      .attr("aria-label", accessibleNodeLabel)
      .attr(
        "transform",
        (node) => `translate(${node.x ?? 0},${node.y ?? 0})`,
      )
      .on("pointerenter.tooltip", function (_event: PointerEvent, node) {
        hoveredNodeRef.current = node.id;
        dismissedTooltipNodeRef.current = null;
        showTooltipRef.current(node, "pointer");
      })
      .on("pointerleave.tooltip", function (_event: PointerEvent, node) {
        hoveredNodeRef.current =
          hoveredNodeRef.current === node.id ? null : hoveredNodeRef.current;
        if (
          focusedNodeRef.current === node.id &&
          dismissedTooltipNodeRef.current !== node.id
        ) {
          showTooltipRef.current(node, "focus");
          return;
        }
        hideTooltipRef.current(node.id, true);
      })
      .on("focus.tooltip", function (_event: FocusEvent, node) {
        focusedNodeRef.current = node.id;
        dismissedTooltipNodeRef.current = null;
        showTooltipRef.current(node, "focus");
      })
      .on("blur.tooltip", function (_event: FocusEvent, node) {
        focusedNodeRef.current =
          focusedNodeRef.current === node.id ? null : focusedNodeRef.current;
        if (
          hoveredNodeRef.current === node.id &&
          dismissedTooltipNodeRef.current !== node.id
        ) {
          showTooltipRef.current(node, "pointer");
          return;
        }
        hideTooltipRef.current(node.id, true);
      })
      .on("pointerdown.tooltip", function (event: PointerEvent, node) {
        if (event.pointerType === "touch") {
          dismissedTooltipNodeRef.current = null;
          showTooltipRef.current(node, "touch");
        }
      })
      .on("click", (event: MouseEvent, node) => {
        if (!isInteractiveNode(node)) return;
        event.stopPropagation();
        onNodeClickRef.current(node);
      })
      .on("keydown", (event: KeyboardEvent, node) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          dismissedTooltipNodeRef.current = node.id;
          hideTooltipRef.current(node.id);
          return;
        }
        if (isInteractiveNode(node) && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onNodeClickRef.current(node);
        }
      });

    const dragState = new WeakMap<
      ForceNode,
      { startX: number; startY: number; moved: boolean }
    >();
    const drag = d3
      .drag<SVGGElement, ForceNode>()
      .filter((_event, node) =>
        !(node.kind === "ghost" && GHOST_PIN_PHASES.has(phase)),
      )
      .on("start", (event, node) => {
        event.sourceEvent?.stopPropagation();
        // A click and a drag share pointer-down. Pin provisionally, but do not
        // reheat until the pointer actually moves far enough to be a drag.
        dragState.set(node, {
          startX: event.x,
          startY: event.y,
          moved: false,
        });
        node.fx = node.x;
        node.fy = node.y;
      })
      .on("drag", (event, node) => {
        const state = dragState.get(node);
        if (
          state &&
          !state.moved &&
          Math.hypot(event.x - state.startX, event.y - state.startY) < 3
        ) {
          return;
        }
        if (state && !state.moved) {
          state.moved = true;
          // Ambient: a real drag reheats locally, then cools (INT rule).
          simulation.alphaTarget(0.12).restart();
        }
        node.fx = event.x;
        node.fy = event.y;
      })
      .on("end", (event, node) => {
        const state = dragState.get(node);
        if (state?.moved && !event.active) simulation.alphaTarget(0);
        dragState.delete(node);
        if (!(node.kind === "ghost" && GHOST_PIN_PHASES.has(phase))) {
          node.fx = null;
          node.fy = null;
        }
      });
    nodeSelection.call(drag);
    nodeSelRef.current = nodeSelection;

    edgeSelRef.current = viewport
      .select<SVGGElement>(".layer-edges")
      .selectAll<SVGPathElement, ForceEdge>("path.gedge")
      .data(forceEdges, (edge) => edge.id)
      .join("path")
      .attr(
        "class",
        (edge) =>
          `gedge gedge--${edge.kind}${edge.mini ? " gedge--mini" : ""}${edge.tier ? ` gedge--${edge.tier}` : ""}`,
      )
      .attr("data-edge-id", (edge) => edge.id);

    scanSelRef.current = viewport
      .select<SVGGElement>(".layer-scan")
      .selectAll<SVGPathElement, ForceEdge>("path.scanline")
      .data(scanEdges, (edge) => edge.id)
      .join("path")
      .attr("class", "scanline")
      .attr("data-scan-target", (edge) => endpointId(edge.target));

    simulation.nodes(forceNodes);
    (simulation.force("link") as d3.ForceLink<ForceNode, ForceEdge>).links(
      forceEdges,
    );

    const viewChanged = viewKeyRef.current !== viewKey;
    viewKeyRef.current = viewKey;
    if (viewChanged) {
      // The route toast already announced this move. Begin the camera beat as
      // soon as room data swaps in; evidence is revealed only after cameraMs.
      // A conservative room zoom leaves space for nodes to spread as physics
      // settles, without hardcoding any node position.
      // Refit once more when physics cools so the final data-derived layout is
      // fully visible; the first move still completes before evidence enters.
      fitPendingRef.current = true;
      renderSimulationFrame();
      fitView(TIMINGS.cameraMs, viewKey.startsWith("room:") ? 0.85 : 1.5);
      initialFitDoneRef.current = true;
    }

    if (reducedMotion) {
      // SM-9: settle synchronously — layout without motion.
      simulation.alpha(1).stop();
      for (let i = 0; i < 220 && simulation.alpha() > simulation.alphaMin(); i += 1) {
        simulation.tick();
      }
      // d3.simulation.tick() intentionally does not dispatch tick events;
      // render the settled frame explicitly after synchronous reduced-motion
      // ticks instead of reaching for a non-public dispatch API.
      renderSimulationFrame();
      if (fitPendingRef.current) {
        fitPendingRef.current = false;
        fitView(0);
        initialFitDoneRef.current = true;
      }
    } else {
      // Seeded from current positions, nodes glide rather than teleport.
      simulation.alpha(0.7).restart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, phase, reducedMotion, viewKey]);

  // Tooltip copy can change while node/edge ids stay stable (for example the
  // ghost's evaluation phase). Refresh only the shaped tooltip model; this is
  // deliberately separate from the structural reconcile and force lifecycle.
  useEffect(() => {
    const latestById = latestNodesByIdRef.current;
    nodesRef.current.forEach((node) => {
      const latest = latestById.get(node.id);
      if (latest) node.tooltip = latest.tooltip;
    });

    const active = activeTooltipRef.current;
    if (!active) return;
    const latest = latestById.get(active.nodeId);
    if (!latest) {
      hideTooltipRef.current(active.nodeId);
      return;
    }
    const next = { ...active, model: latest.tooltip };
    activeTooltipRef.current = next;
    setActiveTooltip(next);
  }, [graph]);

  // --- cosmetic state: never touches the simulation (SM-8) -----------------
  useEffect(() => {
    const nodeSelection = nodeSelRef.current;
    const edgeSelection = edgeSelRef.current;
    const scanSelection = scanSelRef.current;
    if (!nodeSelection) return;

    nodeSelection
      .classed(
        "is-dimmed",
        (node) =>
          routingActive &&
          routeDomain != null &&
          (node.kind === "room" || node.kind === "room-unscanned") &&
          node.label !== routeDomain,
      )
      .classed(
        "is-winner",
        (node) =>
          routingActive && node.kind === "room" && node.label === routeDomain,
      )
      .classed(
        "is-selected-item",
        (node) => node.kind === "item" && node.id === selectedItemId,
      )
      .classed(
        "is-connected-capability",
        (node) => itemCapabilitySelection.nodeIds.has(node.id),
      )
      .classed(
        "is-unrelated-capability",
        (node) =>
          selectedItemId != null &&
          (node.kind === "hub" || node.kind === "mini") &&
          !itemCapabilitySelection.nodeIds.has(node.id),
      )
      .classed(
        "is-selection-muted",
        (node) =>
          selectedItemId != null &&
          (node.kind === "item" || node.kind === "hub" || node.kind === "mini") &&
          node.id !== selectedItemId &&
          !itemCapabilitySelection.nodeIds.has(node.id),
      )
      .classed(
        "has-visible-tooltip",
        (node) => node.id === activeTooltip?.nodeId,
      )
      .attr("aria-pressed", (node) =>
        node.kind === "item" ? String(node.id === selectedItemId) : null,
      )
      .attr("aria-describedby", (node) => {
        if (node.id === activeTooltip?.nodeId) return GRAPH_TOOLTIP_ID;
        return node.kind === "item" && node.id === selectedItemId
          ? "item-selection-status"
          : null;
      });

    scanSelection?.classed(
      "is-dimmed",
      (edge) =>
        routingActive &&
        routeDomain != null &&
        endpointId(edge.target) !== `room:${routeDomain}`,
    );

    edgeSelection
      ?.classed(
        "is-connected-inventory",
        (edge) => itemCapabilitySelection.edgeIds.has(edge.id),
      )
      .classed(
        "is-selection-muted",
        (edge) =>
          selectedItemId != null &&
          edge.kind === "inventory" &&
          !itemCapabilitySelection.edgeIds.has(edge.id),
      )
      .classed(
        "is-pulsing",
        (edge) =>
          !reducedMotion &&
          pulsingSlug != null &&
          edge.id === `ghost->${pulsingSlug}`,
      )
      .classed(
        "is-highlighted",
        (edge) =>
          reducedMotion &&
          pulsingSlug != null &&
          edge.id === `ghost->${pulsingSlug}`,
      );
  }, [
    itemCapabilitySelection,
    pulsingSlug,
    reducedMotion,
    routeDomain,
    routingActive,
    selectedItemId,
    signature,
    activeTooltip?.nodeId,
  ]);

  // A preference change can arrive while the simulation or an eased camera
  // transition is in flight. Stop both immediately; the App reducer moves the
  // active evaluation straight to its fully revealed verdict (SM-9).
  useEffect(() => {
    if (!reducedMotion) return;
    simRef.current?.stop();
    svgRef.current?.interrupt();
    viewportRef.current?.interrupt();
    nodeSelRef.current?.interrupt();
    edgeSelRef.current?.interrupt();
    scanSelRef.current?.interrupt();
    fitView(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  return (
    <div
      ref={containerRef}
      className={`graph-canvas${selectedItemId ? " has-item-focus" : ""}`}
      data-testid="graph-canvas"
    >
      <div ref={stageRef} className="graph-canvas__stage" />
      {activeTooltip && (
        <GraphTooltip
          active={activeTooltip}
          tooltipRef={tooltipRef}
        />
      )}
    </div>
  );
}
