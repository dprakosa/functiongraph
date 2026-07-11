import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { GraphCanvasProps } from "./components/GraphCanvas";
import { TIMINGS } from "./state/useBeats";

const graphMock = vi.hoisted(() => ({
  props: vi.fn(),
}));

vi.mock("./components/GraphCanvas", () => ({
  GraphCanvas: (props: GraphCanvasProps) => {
    graphMock.props(props);
    return (
      <div
        data-testid="graph-canvas"
        data-phase={props.phase}
        data-route-domain={props.routeDomain ?? ""}
        data-pulsing-slug={props.pulsingSlug ?? ""}
        data-view-key={props.viewKey}
      >
        <button
          type="button"
          onClick={() =>
            props.onNodeClick({
              id: "room:kitchen",
              kind: "room",
              label: "kitchen",
              domain: "kitchen",
            })
          }
        >
          Enter kitchen test room
        </button>
      </div>
    );
  },
}));

const OVEN_CHIP = "Convection countertop oven — $129";
const CABLE_CHIP = "4th USB-C cable — $15";
const DRONE_CHIP = "Mini camera drone — $89";

function setReducedMotion(matches: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => false),
      }) as MediaQueryList,
  );
}

function latestGraphProps(): GraphCanvasProps {
  const latest = graphMock.props.mock.calls.at(-1);
  if (!latest) throw new Error("GraphCanvas has not rendered");
  return latest[0] as GraphCanvasProps;
}

function failedFetch() {
  const fetchMock = vi.fn().mockRejectedValue(new TypeError("offline"));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

async function chooseExample(label: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: label }));
  return user;
}

describe("FunctionGraph frontend contract", () => {
  beforeEach(() => {
    graphMock.props.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("offers exactly the three one-tap offline arcs and renders the oven verdict directly with reduced motion", async () => {
    setReducedMotion(true);
    const fetchMock = failedFetch();
    render(<App />);

    const examples = within(screen.getByLabelText("Try these examples")).getAllByRole(
      "button",
    );
    expect(examples).toHaveLength(3);
    expect(examples.map((button) => button.textContent)).toEqual([
      OVEN_CHIP,
      CABLE_CHIP,
      DRONE_CHIP,
    ]);

    const user = await chooseExample(OVEN_CHIP);

    expect(
      await screen.findByRole("heading", { name: "Convection countertop oven" }),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("graph-canvas")).toHaveAttribute(
      "data-phase",
      "verdict",
    );
    expect(screen.getByText("5 / 5")).toBeInTheDocument();
    expect(screen.getByText("$129")).toBeInTheDocument();
    expect(screen.getByText("4 of 5 covered")).toBeInTheDocument();
    expect(screen.getByText("75 % of this, you already own")).toBeInTheDocument();
    expect(
      screen.getByText("Δ $129 buys 1 new function — $129 each"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/A secondhand roasting pan \(about \$20\) adds large-meal roasting/),
    ).toBeInTheDocument();

    const bakesRow = screen.getByRole("button", {
      name: /bakes food: Toaster oven \+ 1 more\. Highlight its graph edge/,
    });
    await user.click(bakesRow);

    expect(latestGraphProps().pulsingSlug).toBe("bakes-food");
    expect(
      latestGraphProps().graph.edges.filter(
        (edge) => edge.id === "ghost->bakes-food",
      ),
    ).toHaveLength(1);
    expect(screen.getByTestId("graph-canvas")).toHaveAttribute(
      "data-pulsing-slug",
      "bakes-food",
    );
  });

  it("renders the total-redundancy cable arc offline", async () => {
    setReducedMotion(true);
    const fetchMock = failedFetch();
    render(<App />);

    await chooseExample(CABLE_CHIP);

    expect(
      await screen.findByRole("heading", { name: "4th USB-C cable" }),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("3 of 3 covered")).toBeInTheDocument();
    expect(screen.getByText("100 % of this, you already own")).toBeInTheDocument();
    expect(
      screen.getByText("Δ $15 buys nothing you don't already own"),
    ).toBeInTheDocument();
    expect(screen.queryByText("Genuinely new — nothing you own does this")).not.toBeInTheDocument();
    expect(latestGraphProps().routeDomain).toBe("electronics");
  });

  it("renders the genuinely-new drone approval offline without diving", async () => {
    setReducedMotion(true);
    const fetchMock = failedFetch();
    render(<App />);

    await chooseExample(DRONE_CHIP);

    expect(
      await screen.findByRole("heading", { name: "Mini camera drone" }),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getByText("Genuinely new — nothing you own does this"),
    ).toBeInTheDocument();
    expect(screen.getByText("0 of 4 covered")).toBeInTheDocument();
    expect(screen.getByText("0 % of this, you already own")).toBeInTheDocument();
    expect(
      screen.getByText("Δ $89 buys 4 new functions — $22 each"),
    ).toBeInTheDocument();
    expect(latestGraphProps().routeDomain).toBeNull();
    expect(latestGraphProps().viewKey).toBe("home");
    expect(screen.queryByRole("button", { name: /Back to rooms/ })).not.toBeInTheDocument();
  });

  it("updates the impact counter when the oven purchase is skipped", async () => {
    setReducedMotion(true);
    failedFetch();
    render(<App />);

    const user = await chooseExample(OVEN_CHIP);
    await screen.findByRole("heading", { name: "Convection countertop oven" });
    await user.click(screen.getByRole("button", { name: "Skip this purchase" }));

    expect(screen.getByText("$129 kept · 2.3 kg landfill avoided")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Convection countertop oven" }),
    ).not.toBeInTheDocument();
  });

  it("collects a still-needed reason and then clears the verdict on Buy anyway", async () => {
    setReducedMotion(true);
    failedFetch();
    render(<App />);

    const user = await chooseExample(OVEN_CHIP);
    await screen.findByRole("heading", { name: "Convection countertop oven" });
    await user.click(screen.getByRole("button", { name: "I still need it" }));

    const reason = screen.getByLabelText("What's it for? teaches the graph");
    await user.type(reason, "Cooking for twelve people");
    expect(reason).toHaveValue("Cooking for twelve people");

    await user.click(screen.getByRole("button", { name: "Buy anyway" }));
    expect(
      screen.queryByRole("heading", { name: "Convection countertop oven" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("What's it for? teaches the graph"),
    ).not.toBeInTheDocument();
  });

  it("renders an actionable error hint when an uncached evaluation cannot reach the API", async () => {
    setReducedMotion(true);
    const fetchMock = failedFetch();
    render(<App />);
    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText("What are you considering?"),
      "Uncached novelty product",
    );
    await user.click(screen.getByRole("button", { name: /Map capabilities/ }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("The evaluation service didn't respond")).toBeInTheDocument();
    expect(
      within(alert).getByText(
        "check your connection, or tap an example — those never touch the network",
      ),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("runs all normal beats in order and holds the route toast for exactly 600 ms", async () => {
    vi.useFakeTimers();
    setReducedMotion(false);
    const fetchMock = failedFetch();
    render(<App />);

    expect(TIMINGS.toastHold).toBe(600);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: OVEN_CHIP }));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("graph-canvas")).toHaveAttribute(
      "data-phase",
      "extracting",
    );

    for (let index = 0; index < 5; index += 1) {
      act(() => vi.advanceTimersByTime(TIMINGS.chipStagger));
    }
    expect(screen.getByText("5 / 5")).toBeInTheDocument();
    expect(screen.getByTestId("graph-canvas")).toHaveAttribute(
      "data-phase",
      "extracting",
    );

    act(() => vi.advanceTimersByTime(TIMINGS.chipToScanPause));
    expect(screen.getByTestId("graph-canvas")).toHaveAttribute(
      "data-phase",
      "scanning",
    );

    act(() => vi.advanceTimersByTime(TIMINGS.scanDuration - 1));
    expect(screen.getByTestId("graph-canvas")).toHaveAttribute(
      "data-phase",
      "scanning",
    );
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("graph-canvas")).toHaveAttribute(
      "data-phase",
      "routing",
    );
    expect(screen.getByText("Kitchen · 4 of 5 matches")).toBeInTheDocument();
    expect(latestGraphProps().viewKey).toBe("home");

    act(() => vi.advanceTimersByTime(TIMINGS.toastHold - 1));
    expect(screen.getByTestId("graph-canvas")).toHaveAttribute(
      "data-phase",
      "routing",
    );
    expect(latestGraphProps().viewKey).toBe("home");
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("graph-canvas")).toHaveAttribute(
      "data-phase",
      "settling",
    );
    expect(latestGraphProps().viewKey).toBe("room:kitchen");

    act(() =>
      vi.advanceTimersByTime(TIMINGS.cameraMs + TIMINGS.settleMs - 1),
    );
    expect(screen.getByTestId("graph-canvas")).toHaveAttribute(
      "data-phase",
      "settling",
    );
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("graph-canvas")).toHaveAttribute(
      "data-phase",
      "verdict",
    );
    expect(
      screen.getByRole("heading", { name: "Convection countertop oven" }),
    ).toBeInTheDocument();
  });

  it("enters a room from the graph and exposes a working back control", async () => {
    setReducedMotion(false);
    failedFetch();
    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Enter kitchen test room" }));
    expect(screen.getByRole("heading", { name: "Kitchen room" })).toBeInTheDocument();
    expect(latestGraphProps().viewKey).toBe("room:kitchen");

    await user.click(screen.getByRole("button", { name: /Back to rooms/ }));
    expect(screen.getByRole("heading", { name: "Your capability map" })).toBeInTheDocument();
    expect(latestGraphProps().viewKey).toBe("home");
    expect(screen.queryByRole("button", { name: /Back to rooms/ })).not.toBeInTheDocument();
  });
});
