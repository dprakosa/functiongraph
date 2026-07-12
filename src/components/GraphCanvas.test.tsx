import { fireEvent, render, screen, within, type RenderResult } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { GraphData, GraphNodeDatum } from "../graph/buildGraph";
import { deriveGraphNodeTooltip } from "../graph/tooltip";
import type { Phase } from "../state/appReducer";
import { GraphCanvas, type GraphCanvasProps } from "./GraphCanvas";

const INTERACTIVE_NODE_IDS = ["room:kitchen", "room:garage", "air-fryer"] as const;
const PASSIVE_NODE_IDS = [
  "hub:bakes-food",
  "hubnew:captures-aerial-photos",
  "ghost",
  "mini:toasts-bread",
] as const;
const ALL_NODE_IDS = [...INTERACTIVE_NODE_IDS, ...PASSIVE_NODE_IDS] as const;

function makeGraph(ghostPhase: Phase = "scanning"): GraphData {
  return {
    nodes: [
      {
        id: "room:kitchen",
        kind: "room",
        label: "kitchen",
        sub: "1 item",
        tooltip: deriveGraphNodeTooltip({
          kind: "room",
          name: "kitchen",
          itemCount: 1,
          hotspotCount: 0,
        }),
      },
      {
        id: "room:garage",
        kind: "room-unscanned",
        label: "garage",
        tooltip: deriveGraphNodeTooltip({
          kind: "room-unscanned",
          name: "garage",
        }),
      },
      {
        id: "air-fryer",
        kind: "item",
        label: "Air fryer",
        domain: "kitchen",
        tooltip: deriveGraphNodeTooltip({
          kind: "item",
          name: "Air fryer",
          domain: "kitchen",
          quantity: 2,
          capabilities: ["bakes food", "crisps food with hot air"],
        }),
      },
      {
        id: "hub:bakes-food",
        kind: "hub",
        label: "bakes food",
        tooltip: deriveGraphNodeTooltip({
          kind: "hub",
          name: "bakes food",
          ownerCount: 2,
          owners: ["Air fryer", "Toaster oven"],
          hot: false,
        }),
      },
      {
        id: "hubnew:captures-aerial-photos",
        kind: "hub-new",
        label: "captures aerial photos",
        tooltip: deriveGraphNodeTooltip({
          kind: "hub-new",
          name: "captures aerial photos",
          tier: "primary",
        }),
      },
      {
        id: "ghost",
        kind: "ghost",
        label: "Camera drone",
        tooltip: deriveGraphNodeTooltip({
          kind: "ghost",
          name: "Camera drone",
          price: 89,
          phase: ghostPhase,
        }),
      },
      {
        id: "mini:toasts-bread",
        kind: "mini",
        label: "toasts bread",
        tooltip: deriveGraphNodeTooltip({
          kind: "mini",
          name: "toasts bread",
          owner: "Toaster oven",
          tier: "secondary",
        }),
      },
    ],
    edges: [],
  };
}

const baseProps: Omit<GraphCanvasProps, "graph" | "onNodeClick"> = {
  phase: "scanning",
  routeDomain: null,
  routingActive: false,
  pulsingSlug: null,
  selectedItemId: null,
  reducedMotion: true,
  viewKey: "home",
};

type CanvasHarness = RenderResult & {
  rerenderCanvas: (next: Partial<GraphCanvasProps>) => void;
};

function renderCanvas(overrides: Partial<GraphCanvasProps> = {}): CanvasHarness {
  let props: GraphCanvasProps = {
    ...baseProps,
    graph: makeGraph(),
    onNodeClick: vi.fn(),
    ...overrides,
  };
  const result = render(<GraphCanvas {...props} />);

  return {
    ...result,
    rerenderCanvas(next) {
      props = { ...props, ...next };
      result.rerender(<GraphCanvas {...props} />);
    },
  };
}

function graphNode(container: HTMLElement, id: string): SVGGElement {
  const node = container.querySelector<SVGGElement>(`g.gnode[data-node-id="${id}"]`);
  if (!node) throw new Error(`Graph node ${id} was not rendered`);
  return node;
}

function graphSvg(): SVGSVGElement {
  return screen.getByRole("group", {
    name: "Subgraph capability graph",
  }) as unknown as SVGSVGElement;
}

describe("GraphCanvas node tooltips", () => {
  it("makes every node focusable and preserves button versus descriptive roles", () => {
    const { container } = renderCanvas();

    INTERACTIVE_NODE_IDS.forEach((id) => {
      const node = graphNode(container, id);
      expect(node).toHaveAttribute("role", "button");
      expect(node).toHaveAttribute("tabindex", "0");
      expect(node).toHaveAccessibleName();
    });

    PASSIVE_NODE_IDS.forEach((id) => {
      const node = graphNode(container, id);
      expect(node).toHaveAttribute("role", "img");
      expect(node).toHaveAttribute("tabindex", "0");
      expect(node).toHaveAccessibleName();
    });
  });

  it("opens on hover and closes when the pointer leaves", () => {
    const { container } = renderCanvas();
    const hub = graphNode(container, "hub:bakes-food");

    fireEvent.pointerEnter(hub, { pointerType: "mouse" });

    const tooltip = screen.getByRole("tooltip");
    expect(within(tooltip).getByText("bakes food")).toBeInTheDocument();
    expect(hub).toHaveAttribute("aria-describedby", "graph-node-tooltip");

    fireEvent.pointerLeave(hub, { pointerType: "mouse" });

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    expect(hub).not.toHaveAttribute("aria-describedby");
  });

  it("opens on focus and closes on blur for passive nodes too", () => {
    const { container } = renderCanvas();
    const mini = graphNode(container, "mini:toasts-bread");

    fireEvent.focus(mini);

    const tooltip = screen.getByRole("tooltip");
    expect(within(tooltip).getByText("Unique capability")).toBeInTheDocument();
    expect(within(tooltip).getByText("Toaster oven")).toBeInTheDocument();

    fireEvent.blur(mini);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("dismisses with Escape from either a node or the window", () => {
    const { container } = renderCanvas();
    const item = graphNode(container, "air-fryer");

    fireEvent.focus(item);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.keyDown(item, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.pointerEnter(item, { pointerType: "mouse" });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("opens on touch pointerdown, survives pointerleave, and dismisses on the background", () => {
    const { container } = renderCanvas();
    const ghost = graphNode(container, "ghost");

    fireEvent.pointerDown(ghost, { pointerType: "touch" });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.pointerLeave(ghost, { pointerType: "touch" });
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    fireEvent.pointerDown(graphSvg(), { pointerType: "touch" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("dismisses an active tooltip when the view changes or its node is removed", () => {
    const graph = makeGraph();
    const { container, rerenderCanvas } = renderCanvas({ graph });

    fireEvent.pointerEnter(graphNode(container, "air-fryer"));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    rerenderCanvas({ viewKey: "room:kitchen" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.pointerEnter(graphNode(container, "air-fryer"));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();

    rerenderCanvas({
      graph: {
        ...graph,
        nodes: graph.nodes.filter((node) => node.id !== "air-fryer"),
      },
    });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("points aria-describedby at only the current tooltip and restores item status", () => {
    const { container } = renderCanvas({ selectedItemId: "air-fryer" });
    const item = graphNode(container, "air-fryer");
    const hub = graphNode(container, "hub:bakes-food");

    expect(item).toHaveAttribute("aria-describedby", "item-selection-status");
    expect(hub).not.toHaveAttribute("aria-describedby");

    fireEvent.focus(hub);
    const hubTooltip = screen.getByRole("tooltip");
    expect(hubTooltip).toHaveAttribute("id", "graph-node-tooltip");
    expect(hub).toHaveAttribute("aria-describedby", "graph-node-tooltip");
    expect(item).toHaveAttribute("aria-describedby", "item-selection-status");

    fireEvent.blur(hub);
    fireEvent.pointerEnter(item);
    const itemTooltip = screen.getByRole("tooltip");
    expect(item).toHaveAttribute("aria-describedby", itemTooltip.id);
    expect(item).not.toHaveAttribute("aria-describedby", "item-selection-status");
    expect(hub).not.toHaveAttribute("aria-describedby");

    fireEvent.pointerLeave(item);
    expect(item).toHaveAttribute("aria-describedby", "item-selection-status");
  });

  it("keeps click, Enter, and Space activation unchanged for actionable nodes", () => {
    const onNodeClick = vi.fn<(node: GraphNodeDatum) => void>();
    const { container } = renderCanvas({ onNodeClick });

    fireEvent.click(graphNode(container, "air-fryer"));
    fireEvent.keyDown(graphNode(container, "room:kitchen"), { key: "Enter" });
    fireEvent.keyDown(graphNode(container, "room:garage"), { key: " " });

    expect(onNodeClick).toHaveBeenCalledTimes(3);
    expect(onNodeClick.mock.calls.map(([node]) => node.id)).toEqual([
      "air-fryer",
      "room:kitchen",
      "room:garage",
    ]);
  });

  it("never activates descriptive hub, ghost, or mini nodes", () => {
    const onNodeClick = vi.fn<(node: GraphNodeDatum) => void>();
    const { container } = renderCanvas({ onNodeClick });

    PASSIVE_NODE_IDS.forEach((id) => {
      const node = graphNode(container, id);
      fireEvent.click(node);
      fireEvent.keyDown(node, { key: "Enter" });
      fireEvent.keyDown(node, { key: " " });
    });

    expect(onNodeClick).not.toHaveBeenCalled();
  });

  it("refreshes an open ghost tooltip when its model changes without changing signature", () => {
    const scanningGraph = makeGraph("scanning");
    const { container, rerenderCanvas } = renderCanvas({ graph: scanningGraph });
    const originalGhost = graphNode(container, "ghost");

    fireEvent.pointerEnter(originalGhost);
    expect(
      within(screen.getByRole("tooltip")).getByText("Comparing inventory"),
    ).toBeInTheDocument();

    const verdictGraph = makeGraph("verdict");
    rerenderCanvas({ graph: verdictGraph, phase: "verdict" });

    const tooltip = screen.getByRole("tooltip");
    expect(within(tooltip).getByText("Result ready")).toBeInTheDocument();
    expect(within(tooltip).queryByText("Comparing inventory")).not.toBeInTheDocument();
    expect(graphNode(container, "ghost")).toBe(originalGhost);
  });

  it("keeps every D3 node element stable across tooltip-only interactions", () => {
    const { container } = renderCanvas();
    const identities = new Map(
      ALL_NODE_IDS.map((id) => [id, graphNode(container, id)] as const),
    );

    fireEvent.pointerEnter(graphNode(container, "room:kitchen"));
    fireEvent.pointerLeave(graphNode(container, "room:kitchen"));
    fireEvent.focus(graphNode(container, "hub:bakes-food"));
    fireEvent.blur(graphNode(container, "hub:bakes-food"));
    fireEvent.pointerDown(graphNode(container, "ghost"), { pointerType: "touch" });
    fireEvent.pointerDown(graphSvg(), { pointerType: "touch" });

    identities.forEach((original, id) => {
      expect(graphNode(container, id)).toBe(original);
    });
  });
});
