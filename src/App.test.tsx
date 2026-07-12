import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { ViewerStateProvider } from "./auth/AuthShell";
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
        data-selected-item-id={props.selectedItemId ?? ""}
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
              tooltip: {
                kind: "room",
                eyebrow: "Room",
                title: "Kitchen",
                details: [],
                action: "Enter room",
              },
            })
          }
        >
          Enter kitchen test room
        </button>
        <button
          type="button"
          onClick={() =>
            props.onNodeClick({
              id: "air-fryer",
              kind: "item",
              label: "Air fryer",
              domain: "kitchen",
              tooltip: {
                kind: "item",
                eyebrow: "Owned item",
                title: "Air fryer",
                details: [],
                action: "Select item to inspect",
              },
            })
          }
        >
          Select air fryer test item
        </button>
      </div>
    );
  },
}));

const OVEN_CHIP = "Air fryer oven — $199";
const CABLE_CHIP = "USB-C hub — $79";
const DRONE_CHIP = "Air purifier — $199";

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

function controllableReducedMotion(initial = false) {
  let matches = initial;
  const listeners = new Set<(event: MediaQueryListEvent) => void>();
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        get matches() {
          return matches;
        },
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(
          (_type: string, listener: (event: MediaQueryListEvent) => void) =>
            listeners.add(listener),
        ),
        removeEventListener: vi.fn(
          (_type: string, listener: (event: MediaQueryListEvent) => void) =>
            listeners.delete(listener),
        ),
        dispatchEvent: vi.fn(() => false),
      }) as MediaQueryList,
  );

  return {
    set(next: boolean) {
      matches = next;
      const event = { matches: next } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
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

describe("Subgraph frontend contract", () => {
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
      await screen.findByRole("heading", { name: "Air fryer oven" }),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("graph-canvas")).toHaveAttribute(
      "data-phase",
      "verdict",
    );
    expect(screen.getByText("5 / 5")).toBeInTheDocument();
    expect(screen.getByText("$199")).toBeInTheDocument();
    expect(screen.getByText("4 of 5 covered")).toBeInTheDocument();
    expect(screen.getByText("74% of its uses are already covered")).toBeInTheDocument();
    expect(
      screen.getByText(/A countertop rotisserie can add the one cooking method/),
    ).toBeInTheDocument();

    const bakesRow = screen.getByRole("button", {
      name: /bakes food: Oven \+ 2 more\. Highlight its graph edge/,
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
      await screen.findByRole("heading", { name: "USB-C hub" }),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("4 of 4 covered")).toBeInTheDocument();
    expect(screen.getByText("100% of its uses are already covered")).toBeInTheDocument();
    expect(screen.queryByText("This would add something new")).not.toBeInTheDocument();
    expect(latestGraphProps().routeDomain).toBe("electronics");
  });

  it("renders the genuinely-new drone approval offline without diving", async () => {
    setReducedMotion(true);
    const fetchMock = failedFetch();
    render(<App />);

    await chooseExample(DRONE_CHIP);

    expect(
      await screen.findByRole("heading", { name: "Air purifier" }),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(
      screen.getByText("This would add something new"),
    ).toBeInTheDocument();
    expect(screen.getByText("0 of 4 covered")).toBeInTheDocument();
    expect(screen.getByText("0% of its uses are already covered")).toBeInTheDocument();
    expect(latestGraphProps().routeDomain).toBeNull();
    expect(latestGraphProps().viewKey).toBe("home");
    expect(screen.queryByRole("button", { name: /Back to rooms/ })).not.toBeInTheDocument();
  });

  it.each([
    [OVEN_CHIP, "Air fryer oven", 5],
    [CABLE_CHIP, "USB-C hub", 4],
    [DRONE_CHIP, "Air purifier", 4],
  ])(
    "maps every %s verdict row to exactly one ghost edge",
    async (chip, productName, expectedRows) => {
      setReducedMotion(true);
      failedFetch();
      render(<App />);
      const user = await chooseExample(chip);
      await screen.findByRole("heading", { name: productName });

      const rows = screen.getAllByRole("button", {
        name: /Highlight its graph edge$/,
      });
      expect(rows).toHaveLength(expectedRows);

      for (const row of rows) {
        await user.click(row);
        const { pulsingSlug, graph } = latestGraphProps();
        expect(pulsingSlug).toBeTruthy();
        expect(
          graph.edges.filter((edge) => edge.id === `ghost->${pulsingSlug}`),
        ).toHaveLength(1);
      }
    },
  );

  it("clears the verdict while keeping only the compact shared brand", async () => {
    setReducedMotion(true);
    failedFetch();
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Evaluate a purchase" }),
    ).toBeVisible();
    expect(
      screen.queryByText("Capability-level purchase decisions, mapped live."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("$0 kept · 0.0 kg landfill avoided"),
    ).not.toBeInTheDocument();

    const user = await chooseExample(OVEN_CHIP);
    await screen.findByRole("heading", { name: "Air fryer oven" });
    await user.click(screen.getByRole("button", { name: "Skip this purchase" }));

    expect(
      screen.queryByRole("heading", { name: "Air fryer oven" }),
    ).not.toBeInTheDocument();
  });

  it("persists skip decisions to local history", async () => {
    window.localStorage.clear();
    setReducedMotion(true);
    failedFetch();
    render(<App />);

    const user = await chooseExample(OVEN_CHIP);
    await screen.findByRole("heading", { name: "Air fryer oven" });
    await user.click(screen.getByRole("button", { name: "Skip this purchase" }));

    const stored = JSON.parse(
      window.localStorage.getItem("functiongraph:decisions:v1") ?? "[]",
    );
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({
      product: "Air fryer oven",
      price: 199,
      choice: "skipped",
      coveredCount: 4,
      totalCount: 5,
    });
  });

  it("collects a still-needed reason and then clears the verdict on Buy anyway", async () => {
    setReducedMotion(true);
    failedFetch();
    render(<App />);

    const user = await chooseExample(OVEN_CHIP);
    await screen.findByRole("heading", { name: "Air fryer oven" });
    await user.click(screen.getByRole("button", { name: "I still need it" }));

    const reason = screen.getByLabelText("Why do you still need it?");
    await user.type(reason, "Cooking for twelve people");
    expect(reason).toHaveValue("Cooking for twelve people");

    await user.click(screen.getByRole("button", { name: "Buy anyway" }));
    expect(
      screen.queryByRole("heading", { name: "Air fryer oven" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Why do you still need it?"),
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
    await user.click(screen.getByRole("button", { name: /Check product/ }));

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("The evaluation service didn't respond")).toBeInTheDocument();
    expect(
      within(alert).getByText(
        "check your connection or choose one of the suggested products",
      ),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("never flashes the guest graph while a signed-in inventory is loading", () => {
    setReducedMotion(true);
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => undefined)));

    render(
      <ViewerStateProvider mode="signed-in">
        <App />
      </ViewerStateProvider>,
    );

    expect(screen.getByRole("heading", { name: "Loading your capability map" })).toBeVisible();
    expect(screen.getByText("Loading your confirmed items")).toBeVisible();
    expect(screen.queryByTestId("graph-canvas")).not.toBeInTheDocument();
    expect(screen.queryByText(/starter household/i)).not.toBeInTheDocument();
  });

  it("shows the signed-in scan-first empty state and scores offline examples against no owned items", async () => {
    setReducedMotion(true);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ViewerStateProvider mode="signed-in">
        <App />
      </ViewerStateProvider>,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Capture what you own to build this graph",
      }),
    ).toBeVisible();
    expect(screen.getByText("No confirmed items yet")).toBeVisible();
    expect(screen.queryByTestId("graph-canvas")).not.toBeInTheDocument();

    await chooseExample(OVEN_CHIP);

    expect(
      await screen.findByRole("heading", { name: "Air fryer oven" }),
    ).toBeVisible();
    expect(screen.getByText("0 of 5 covered")).toBeVisible();
    expect(screen.getByTestId("graph-canvas")).toBeVisible();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps a signed-in inventory error explicit and retryable without demo fallback", async () => {
    setReducedMotion(true);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "inventory service is unavailable",
          hint: "Try again in a moment.",
        }),
        { status: 503, headers: { "content-type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ViewerStateProvider mode="signed-in">
        <App />
      </ViewerStateProvider>,
    );

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText("Your inventory could not load")).toBeVisible();
    expect(within(alert).getByText(/Try again in a moment/)).toBeVisible();
    expect(screen.queryByTestId("graph-canvas")).not.toBeInTheDocument();

    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("renders a populated personal graph from the signed-in inventory response", async () => {
    setReducedMotion(true);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [
              {
                id: "f65cf02e-134f-4bb7-bec8-1c43767315c3",
                name: "Personal kettle",
                domain: "kitchen",
                quantity: 1,
                capabilities: [{ name: "boils water", tier: "primary" }],
                source: "photo",
                createdAt: "2026-07-11T00:00:00.000Z",
                updatedAt: "2026-07-11T00:00:00.000Z",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    render(
      <ViewerStateProvider mode="signed-in">
        <App />
      </ViewerStateProvider>,
    );

    expect(await screen.findByText("1 confirmed item")).toBeVisible();
    expect(screen.getByTestId("graph-canvas")).toBeVisible();
    expect(screen.queryByText(/bundled items/i)).not.toBeInTheDocument();
  });

  it("honours reduced motion when the preference changes during a pending evaluation", async () => {
    const motion = controllableReducedMotion();
    let resolveFetch!: (response: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          }),
      ),
    );
    render(<App />);
    const user = userEvent.setup();

    await user.type(
      screen.getByLabelText("What are you considering?"),
      "A live novelty product",
    );
    await user.click(screen.getByRole("button", { name: /Check product/ }));

    act(() => motion.set(true));
    resolveFetch(
      new Response(
        JSON.stringify({
          name: "Live novelty product",
          price: null,
          capabilities: [
            { name: "captures aerial photos", tier: "primary" },
            { name: "records aerial video", tier: "primary" },
            { name: "flies preset routes", tier: "secondary" },
          ],
          verdict: {
            coverage: 0,
            coveredCount: 0,
            totalCount: 3,
            rows: [
              {
                capability: "captures aerial photos",
                capSlug: "captures-aerial-photos",
                tier: "primary",
                covered: false,
                bestCoverer: null,
                covererCount: 0,
                weight: 1,
              },
              {
                capability: "records aerial video",
                capSlug: "records-aerial-video",
                tier: "primary",
                covered: false,
                bestCoverer: null,
                covererCount: 0,
                weight: 1,
              },
              {
                capability: "flies preset routes",
                capSlug: "flies-preset-routes",
                tier: "secondary",
                covered: false,
                bestCoverer: null,
                covererCount: 0,
                weight: 0.4,
              },
            ],
            newCapabilities: [
              "captures aerial photos",
              "records aerial video",
              "flies preset routes",
            ],
            pricePerNewCapability: null,
          },
          altSuggestion: null,
          cached: false,
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    expect(
      await screen.findByRole("heading", { name: "Live novelty product" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("graph-canvas")).toHaveAttribute(
      "data-phase",
      "verdict",
    );
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
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
    expect(
      latestGraphProps().graph.edges.some((edge) => edge.id.startsWith("ghost->")),
    ).toBe(false);

    act(() => vi.advanceTimersByTime(TIMINGS.cameraMs - 1));
    expect(screen.getByTestId("graph-canvas")).toHaveAttribute(
      "data-phase",
      "settling",
    );
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId("graph-canvas")).toHaveAttribute(
      "data-phase",
      "settling",
    );
    expect(
      latestGraphProps().graph.edges.filter((edge) =>
        edge.id.startsWith("ghost->"),
      ),
    ).toHaveLength(5);

    act(() => vi.advanceTimersByTime(TIMINGS.settleMs - 1));
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
      screen.getByRole("heading", { name: "Air fryer oven" }),
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
    expect(screen.getByRole("heading", { name: "Your household map" })).toBeInTheDocument();
    expect(latestGraphProps().viewKey).toBe("home");
    expect(screen.queryByRole("button", { name: /Back to rooms/ })).not.toBeInTheDocument();
  });

  it("selects one item at a time so its connected capabilities can be highlighted", async () => {
    setReducedMotion(false);
    failedFetch();
    render(<App />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Enter kitchen test room" }));
    await user.click(
      screen.getByRole("button", { name: "Select air fryer test item" }),
    );

    expect(latestGraphProps().selectedItemId).toBe("air-fryer");
    expect(screen.getByTestId("graph-canvas")).toHaveAttribute(
      "data-selected-item-id",
      "air-fryer",
    );
    expect(
      screen.getByText(
        "Air fryer selected. Connected capabilities: crisps food with hot air, bakes food, reheats leftovers, toasts bread.",
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Select air fryer test item" }),
    );
    expect(latestGraphProps().selectedItemId).toBeNull();
    expect(screen.getByText("Item selection cleared.")).toBeInTheDocument();
  });
});
