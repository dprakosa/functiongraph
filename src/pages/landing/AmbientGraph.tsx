import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { useReducedMotion } from "../../hooks/useReducedMotion";

interface AmbientNode extends d3.SimulationNodeDatum {
  id: number;
  r: number;
  kind: "room" | "item" | "capability" | "new";
}

interface AmbientLink extends d3.SimulationLinkDatum<AmbientNode> {
  source: number | AmbientNode;
  target: number | AmbientNode;
}

const WIDTH = 640;
const HEIGHT = 420;

function buildData(): { nodes: AmbientNode[]; links: AmbientLink[] } {
  const nodes: AmbientNode[] = [];
  const links: AmbientLink[] = [];
  let id = 0;

  // Three loose clusters: a hub with satellites, like rooms with items.
  for (let cluster = 0; cluster < 3; cluster += 1) {
    const hub: AmbientNode = { id: id++, r: 26 + cluster * 4, kind: "room" };
    nodes.push(hub);
    const satellites = 4 + cluster;
    for (let index = 0; index < satellites; index += 1) {
      const satellite: AmbientNode = {
        id: id++,
        r: 8 + ((index + cluster) % 3) * 3,
        kind: index % 3 === 0 ? "capability" : "item",
      };
      nodes.push(satellite);
      links.push({ source: hub.id, target: satellite.id });
      if (index > 1 && index % 2 === 0) {
        links.push({ source: satellite.id, target: satellite.id - 1 });
      }
    }
  }
  // A couple of emerald "genuinely new" accents.
  const newNode: AmbientNode = { id: id++, r: 10, kind: "new" };
  nodes.push(newNode);
  links.push({ source: newNode.id, target: 0 });
  const newNodeB: AmbientNode = { id: id++, r: 7, kind: "new" };
  nodes.push(newNodeB);
  links.push({ source: newNodeB.id, target: nodes[4].id });

  return { nodes, links };
}

const FILLS: Record<AmbientNode["kind"], string> = {
  room: "var(--color-canvas)",
  item: "var(--color-item-node)",
  capability: "var(--color-capability-node)",
  new: "var(--color-new-soft)",
};

const STROKES: Record<AmbientNode["kind"], string> = {
  room: "var(--color-hairline)",
  item: "var(--color-item-node-border)",
  capability: "var(--color-capability-node-border)",
  new: "var(--color-new)",
};

/**
 * Decorative slow-drifting force graph used as landing brand art. Pauses
 * off-screen and renders a static layout under prefers-reduced-motion.
 * Purely presentational — no data, no interaction.
 */
export function AmbientGraph() {
  const svgRef = useRef<SVGSVGElement>(null);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) return;

    const { nodes, links } = buildData();
    const svg = d3.select(svgElement);
    svg.selectAll("*").remove();

    const linkSelection = svg
      .append("g")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", "var(--color-hairline)")
      .attr("stroke-width", 1);

    const nodeSelection = svg
      .append("g")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (node) => node.r)
      .attr("fill", (node) => FILLS[node.kind])
      .attr("stroke", (node) => STROKES[node.kind])
      .attr("stroke-width", (node) => (node.kind === "new" ? 1.6 : 1.1))
      .attr("stroke-dasharray", (node) => (node.kind === "new" ? "4 3" : null));

    const render = () => {
      linkSelection
        .attr("x1", (link) => (link.source as AmbientNode).x ?? 0)
        .attr("y1", (link) => (link.source as AmbientNode).y ?? 0)
        .attr("x2", (link) => (link.target as AmbientNode).x ?? 0)
        .attr("y2", (link) => (link.target as AmbientNode).y ?? 0);
      nodeSelection
        .attr("cx", (node) => node.x ?? 0)
        .attr("cy", (node) => node.y ?? 0);
    };

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink<AmbientNode, AmbientLink>(links)
          .id((node) => node.id)
          .distance(70)
          .strength(0.25),
      )
      .force("charge", d3.forceManyBody().strength(-60))
      .force("center", d3.forceCenter(WIDTH / 2, HEIGHT / 2))
      .force(
        "collide",
        d3.forceCollide<AmbientNode>().radius((node) => node.r + 6),
      )
      .on("tick", render);

    if (reducedMotion) {
      simulation.stop();
      simulation.tick(160);
      render();
      return () => {
        simulation.stop();
      };
    }

    // Gentle perpetual drift, paused while off-screen.
    simulation.alphaTarget(0.02).velocityDecay(0.6);

    if (typeof IntersectionObserver === "undefined") {
      return () => {
        simulation.stop();
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) simulation.restart();
          else simulation.stop();
        }
      },
      { threshold: 0.1 },
    );
    observer.observe(svgElement);

    return () => {
      observer.disconnect();
      simulation.stop();
    };
  }, [reducedMotion]);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="h-full w-full"
      aria-hidden="true"
      focusable="false"
    />
  );
}
