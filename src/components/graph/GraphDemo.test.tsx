import { createElement, forwardRef, useImperativeHandle } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GraphDemo } from "./GraphDemo";

const graphHandle = vi.hoisted(() => ({
  fitView: vi.fn(),
  resetLayout: vi.fn(),
  zoomIn: vi.fn(),
  zoomOut: vi.fn(),
  centerNode: vi.fn(),
}));

vi.mock("./ForceGraph", () => ({
  ForceGraph: forwardRef((props: Record<string, unknown>, ref) => {
    useImperativeHandle(ref, () => graphHandle);
    const nodes = props.nodes as Array<{ id: string; label: string }>;
    const onSelectNode = props.onSelectNode as
      | ((node: { id: string; label: string } | null) => void)
      | undefined;
    return createElement(
      "div",
      {
        "data-testid": "force-graph-mock",
        "data-comparison-active": String(Boolean(props.comparisonActive)),
      },
      createElement("output", { "data-testid": "graph-node-count" }, nodes.length),
      ...nodes.map((node) =>
        createElement(
          "button",
          {
            key: node.id,
            type: "button",
            onClick: () => onSelectNode?.(node),
          },
          `Select ${node.label}`,
        ),
      ),
    );
  }),
}));

describe("GraphDemo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders and switches between all three scenarios", async () => {
    const user = userEvent.setup();
    render(<GraphDemo />);

    const scenarioSelect = screen.getByLabelText("Choose a product comparison");
    expect(scenarioSelect.querySelectorAll("option")).toHaveLength(3);
    expect(screen.getByRole("heading", { name: "Digital air fryer vs owned appliances" })).toBeInTheDocument();

    await user.selectOptions(scenarioSelect, "vegetable-chopper");
    expect(
      screen.getByRole("heading", {
        name: "Manual vegetable chopper vs food processor",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("91%")).toBeInTheDocument();
  });

  it("opens inspector details when a graph node is selected", async () => {
    const user = userEvent.setup();
    render(<GraphDemo />);

    await user.click(screen.getByRole("button", { name: "Select Digital air fryer" }));
    expect(screen.getByRole("heading", { name: "Selection details" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Digital air fryer" })).toBeInTheDocument();
    expect(screen.getAllByText("82%").length).toBeGreaterThan(0);
    expect(screen.getByText("Functional overlap")).toBeInTheDocument();
  });

  it("filters a node type from the graph", async () => {
    const user = userEvent.setup();
    render(<GraphDemo />);
    expect(screen.getByTestId("graph-node-count")).toHaveTextContent("18");

    await user.click(screen.getByRole("checkbox", { name: /Outcome/ }));
    expect(screen.getByTestId("graph-node-count")).toHaveTextContent("14");
  });

  it("wires reset layout to the graph handle", async () => {
    const user = userEvent.setup();
    render(<GraphDemo />);

    await user.click(screen.getByTestId("header-reset-layout"));
    expect(graphHandle.resetLayout).toHaveBeenCalledTimes(1);
  });

  it("activates and exposes the guided comparison path", async () => {
    const user = userEvent.setup();
    render(<GraphDemo />);

    const comparisonButton = screen.getByRole("button", {
      name: /Show comparison path/,
    });
    await user.click(comparisonButton);

    expect(comparisonButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("force-graph-mock")).toHaveAttribute(
      "data-comparison-active",
      "true",
    );
    expect(screen.getByRole("heading", { name: "Digital air fryer" })).toBeInTheDocument();
  });
});
