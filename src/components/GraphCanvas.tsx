import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import type { GraphData, GraphEdgeDatum, GraphNodeDatum } from "../graph/buildGraph";
import { GHOST_ID } from "../graph/buildGraph";
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
      const width = Math.max(88, 34 + len * 6.8);
      return { width, height: 30, collideRadius: width / 2 + 8 };
    }
    case "hub":
    case "hub-new": {
      const width = 22 + len * 6.3;
      return { width, height: 24, collideRadius: width / 2 + 7 };
    }
    case "ghost": {
      const width = Math.max(170, 40 + Math.min(len, 34) * 6.4);
      return { width, height: 44, collideRadius: width / 2 + 10 };
    }
    case "mini": {
      const width = 16 + len * 5.6;
      return { width, height: 20, collideRadius: width / 2 + 5 };
    }
  }
}

function endpointId(endpoint: string | ForceNode): string {
  return typeof endpoint === "string" ? endpoint : endpoint.id;
}

function isInteractiveNode(node: GraphNodeDatum): boolean {
  return node.kind === "room" || node.kind === "room-unscanned" || node.kind === "item";
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
      body
        .append("rect")
        .attr("class", "gnode__shape")
        .attr("x", -width / 2)
        .attr("y", -height / 2)
        .attr("width", width)
        .attr("height", height)
        .attr("rx", 11);
      body
        .append("text")
        .attr("class", "gnode__label")
        .attr("text-anchor", "middle")
        .attr("y", rest.length ? -3 : 4)
        .text(name);
      if (rest.length) {
        body
          .append("text")
          .attr("class", "gnode__sub")
          .attr("text-anchor", "middle")
          .attr("y", 13)
          .text(rest.join(" · "));
      }
      return;
    }

    if (node.kind === "item") {
      body
        .append("rect")
        .attr("class", "gnode__hit")
        .attr("x", -width / 2 - 5)
        .attr("y", -22)
        .attr("width", width + 10)
        .attr("height", 44)
        .attr("rx", 12);
      body
        .append("rect")
        .attr("class", "gnode__shape")
        .attr("x", -width / 2)
        .attr("y", -height / 2)
        .attr("width", width)
        .attr("height", height)
        .attr("rx", 9);
      body
        .append("circle")
        .attr("class", "gnode__dot")
        .attr("cx", -width / 2 + 12)
        .attr("r", 3.5);
      body
        .append("text")
        .attr("class", "gnode__label")
        .attr("x", -width / 2 + 21)
        .attr("y", 4)
        .text(node.label);
      if (node.badge) {
        body
          .append("text")
          .attr("class", "gnode__badge")
          .attr("x", width / 2 - 8)
          .attr("text-anchor", "end")
          .attr("y", 4)
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
  reducedMotion,
  viewKey,
  onNodeClick,
  onZoomOut,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
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
  const sizeRef = useRef({ width: 900, height: 640 });
  const fitPendingRef = useRef(true);
  const initialFitDoneRef = useRef(false);
  const viewKeyRef = useRef(viewKey);
  const onNodeClickRef = useRef(onNodeClick);
  onNodeClickRef.current = onNodeClick;
  const onZoomOutRef = useRef(onZoomOut);
  onZoomOutRef.current = onZoomOut;

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

  // --- one-time svg/simulation scaffold -----------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const width = Math.max(320, container.clientWidth || 900);
    const height = Math.max(320, container.clientHeight || 640);
    sizeRef.current = { width, height };

    const svg = d3
      .select(container)
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

    simulation.on("tick", renderSimulationFrame);

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
    resizeObserver.observe(container);

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

  function fitView(duration: number) {
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
      Math.min(1.5, 0.92 / Math.max((maxX - minX) / width, (maxY - minY) / height)),
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
    if (signature === signatureRef.current) return;
    signatureRef.current = signature;
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
            .style("opacity", 1);
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
      .attr("role", (node) => (isInteractiveNode(node) ? "button" : null))
      .attr("tabindex", (node) => (isInteractiveNode(node) ? 0 : null))
      .attr("data-node-id", (node) => node.id)
      .attr("aria-label", (node) =>
        `${node.label}${node.sub ? `, ${node.sub}` : ""}, ${node.kind.replaceAll("-", " ")}`,
      )
      .attr(
        "transform",
        (node) => `translate(${node.x ?? 0},${node.y ?? 0})`,
      )
      .on("click", (event: MouseEvent, node) => {
        if (!isInteractiveNode(node)) return;
        event.stopPropagation();
        onNodeClickRef.current(node);
      })
      .on("keydown", (event: KeyboardEvent, node) => {
        if (isInteractiveNode(node) && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onNodeClickRef.current(node);
        }
      });

    const drag = d3
      .drag<SVGGElement, ForceNode>()
      .filter((_event, node) =>
        !(node.kind === "ghost" && GHOST_PIN_PHASES.has(phase)),
      )
      .on("start", (event, node) => {
        event.sourceEvent?.stopPropagation();
        // Ambient: drag reheats locally then cools (INT ambient rule).
        if (!event.active) simulation.alphaTarget(0.12).restart();
        node.fx = node.x;
        node.fy = node.y;
      })
      .on("drag", (event, node) => {
        node.fx = event.x;
        node.fy = event.y;
      })
      .on("end", (event, node) => {
        if (!event.active) simulation.alphaTarget(0);
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
    if (viewChanged) fitPendingRef.current = true;

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
      );

    scanSelection?.classed(
      "is-dimmed",
      (edge) =>
        routingActive &&
        routeDomain != null &&
        endpointId(edge.target) !== `room:${routeDomain}`,
    );

    edgeSelection
      ?.classed(
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
  }, [routingActive, routeDomain, pulsingSlug, reducedMotion, signature]);

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

  return <div ref={containerRef} className="graph-canvas" data-testid="graph-canvas" />;
}
