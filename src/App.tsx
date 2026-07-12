import {
  useMemo,
  useReducer,
  useRef,
  useState,
  useEffect,
  type FormEvent,
} from "react";
import inventoryFile from "./data/inventory.json";
import { useViewerState } from "./auth/AuthShell";
import { GraphCanvas } from "./components/GraphCanvas";
import { ProductCommandBar } from "./components/ProductCommandBar";
import { InventoryCanvasState } from "./components/evaluate/InventoryCanvasState";
import { InventoryStatus } from "./components/evaluate/InventoryStatus";
import { ItemInspector } from "./components/evaluate/ItemInspector";
import { VerdictPanel } from "./components/evaluate/VerdictPanel";
import {
  buildGraph,
  type GraphNodeDatum,
} from "./graph/buildGraph";
import { useReducedMotion } from "./hooks/useReducedMotion";
import { useActiveInventory } from "./inventory/useActiveInventory";
import { copy } from "./lib/copy";
import { routeVerdict } from "./lib/route";
import type { InventoryFile } from "./lib/types";
import {
  appReducer,
  initialState,
  type AppState,
} from "./state/appReducer";
import { evaluate, EvaluateFailure } from "./state/evaluateClient";
import { useBeats } from "./state/useBeats";

const guestInventory = inventoryFile as InventoryFile;

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function phaseMessage(state: AppState): string | null {
  switch (state.phase) {
    case "extracting":
      return "Extracting capabilities";
    case "scanning":
      return "Scanning every room";
    case "routing":
      return state.route?.domain
        ? copy.routeToast(
            state.route.domain,
            state.route.matchesInRoom,
            state.route.totalCount,
          )
        : copy.routeNoMatch;
    case "settling":
      return state.route?.domain
        ? `Settling into ${titleCase(state.route.domain)}`
        : "Settling";
    default:
      return null;
  }
}

function GraphLegend() {
  return (
    <div
      className="flex flex-wrap items-center gap-3 rounded-full border border-hairline bg-white/90 px-3 py-1.5 text-[10px] font-semibold text-muted backdrop-blur-sm"
      aria-label="Graph legend"
    >
      <span className="inline-flex items-center gap-1.5">
        <i className="inline-block h-0.5 w-4 bg-covered" /> covered
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className="inline-block h-0.5 w-4 bg-new" /> new
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className="inline-block h-2.5 w-2.5 rounded-full border border-item-node-border bg-item-node" />{" "}
        item
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className="inline-block h-2 w-4 rounded-full border border-capability-node-border bg-capability-node" />{" "}
        capability
      </span>
    </div>
  );
}

export default function GraphPage() {
  const viewer = useViewerState();
  const activeInventory = useActiveInventory(viewer.mode, viewer.identityKey);
  const activeItems = activeInventory.items ?? [];
  const unscannedRooms =
    activeInventory.status === "guest" ? guestInventory.unscannedRooms : [];
  const [state, dispatch] = useReducer(appReducer, initialState({
    dollarsKept: 0,
    kgAvoided: 0,
  }));
  const [draft, setDraft] = useState("");
  const requestSequence = useRef(0);
  const reducedMotion = useReducedMotion();
  const reducedMotionRef = useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  useBeats(state, dispatch, reducedMotion);

  useEffect(() => {
    if (reducedMotion) dispatch({ type: "REDUCED_MOTION_ENABLED" });
  }, [reducedMotion]);

  const graph = useMemo(
    () =>
      buildGraph({
        items: activeItems,
        unscannedRooms,
        view: state.view,
        phase: state.phase,
        result: state.result,
        route: state.route,
        expandedItemId: state.expandedItemId,
        evidenceVisible: state.evidenceVisible,
      }),
    [
      state.view,
      state.phase,
      state.result,
      state.route,
      state.expandedItemId,
      state.evidenceVisible,
      activeItems,
      unscannedRooms,
    ],
  );

  const isReading = state.pendingText != null;
  const statusMessage = phaseMessage(state);
  const viewLabel =
    state.view.level === "home"
      ? "Your capability map"
      : `${titleCase(state.view.domain)} room`;
  const viewKey =
    state.view.level === "home" ? "home" : `room:${state.view.domain}`;
  const selectedItem = state.expandedItemId
    ? activeItems.find((item) => item.id === state.expandedItemId) ?? null
    : null;
  const itemSelectionStatus = selectedItem
    ? `${selectedItem.name} selected. Connected capabilities: ${selectedItem.capabilities
        .map((capability) => capability.name)
        .join(", ")}.`
    : "Item selection cleared.";

  const startEvaluation = async (rawText: string) => {
    const text = rawText.trim();
    const sequence = ++requestSequence.current;
    dispatch({ type: "EVALUATE_START", text });
    try {
      const result = await evaluate(text, activeItems);
      if (sequence !== requestSequence.current) return;
      dispatch({
        type: "EVALUATE_SUCCESS",
        result,
        route: routeVerdict(result.verdict, activeItems),
        // Read the current preference after the async evaluation returns. A
        // preference change while a request is pending must not strand the
        // result in the extracting phase (SM-9).
        reducedMotion: reducedMotionRef.current,
      });
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      dispatch({
        type: "EVALUATE_FAILURE",
        error:
          error instanceof Error ? error.message : "the product couldn't be evaluated",
        hint:
          error instanceof EvaluateFailure
            ? error.hint
            : "tap an example — those never touch the network",
      });
    }
  };

  const submitProduct = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void startEvaluation(draft);
  };

  const tryExample = (chip: string) => {
    setDraft(chip);
    void startEvaluation(chip);
  };

  const handleNodeClick = (node: GraphNodeDatum) => {
    if (node.kind === "room" && node.domain) {
      dispatch({ type: "ROOM_ENTERED", domain: node.domain });
      return;
    }
    if (node.kind === "room-unscanned") {
      const photoAction = document.querySelector<HTMLButtonElement>(
        '#photo-action-slot button[aria-haspopup="dialog"]',
      );
      if (photoAction && !photoAction.disabled) {
        photoAction.click();
        return;
      }
      dispatch({ type: "UNSCANNED_TAPPED", message: copy.unscannedToast });
      return;
    }
    if (node.kind === "item") {
      dispatch({ type: "ITEM_TOGGLED", itemId: node.id });
    }
  };

  const inventoryReady =
    activeInventory.status === "guest" ||
    activeInventory.status === "empty" ||
    activeInventory.status === "populated";
  const showGraph =
    inventoryReady && (activeItems.length > 0 || state.phase !== "resting");
  const showItemInspector = Boolean(selectedItem && state.phase !== "verdict");
  const hasContextualRail = state.phase === "verdict" || showItemInspector;
  const commandDisabled =
    activeInventory.status === "loading" || activeInventory.status === "error";

  return (
    <main
      className="flex h-full min-h-0 flex-col bg-white"
      aria-labelledby="evaluate-title"
    >
      <header className="grid shrink-0 gap-2.5 border-b border-hairline px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <h1
            id="evaluate-title"
            data-route-heading
            tabIndex={-1}
            className="m-0 text-sm font-semibold tracking-tight whitespace-nowrap text-ink outline-none"
          >
            Evaluate a purchase
          </h1>
          <InventoryStatus
            inventory={activeInventory}
            identityKey={viewer.identityKey}
          />
        </div>

        <ProductCommandBar
          draft={draft}
          isEvaluating={isReading}
          disabled={commandDisabled}
          disabledLabel={
            activeInventory.status === "loading"
              ? "Loading inventory"
              : "Inventory unavailable"
          }
          onDraftChange={setDraft}
          onSubmit={submitProduct}
          onExample={tryExample}
        />

        {state.error && (
          <section
            className="flex items-center justify-between gap-4 rounded-card border border-hairline bg-wash px-3 py-2.5"
            role="alert"
          >
            <div className="grid gap-0.5">
              <strong className="text-[13px] font-semibold text-ink">
                {titleCase(state.error.error)}
              </strong>
              <span className="text-xs text-body">{state.error.hint}</span>
            </div>
            <button
              type="button"
              aria-label="Dismiss error"
              onClick={() => dispatch({ type: "ERROR_DISMISSED" })}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-control text-base text-muted transition-colors hover:bg-hairline-soft hover:text-ink"
            >
              ×
            </button>
          </section>
        )}

        {state.result && state.phase !== "resting" && (
          <section
            className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3"
            aria-label="Extracted capabilities"
          >
            <div className="flex items-baseline gap-2 pt-1.5 text-[11px] font-semibold text-muted">
              <span>Capabilities</span>
              <span className="text-metric text-faint">
                {state.revealedChips} / {state.result.capabilities.length}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5" aria-live="polite">
              {state.result.capabilities
                .slice(0, state.revealedChips)
                .map((capability) => (
                  <span
                    key={`${capability.name}:${capability.tier}`}
                    className={`capability-chip inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] ${
                      capability.tier === "primary"
                        ? "border-hairline bg-wash text-ink"
                        : "border-hairline-soft bg-transparent text-body"
                    }`}
                  >
                    {capability.name}
                    <small className="text-[8.5px] font-bold tracking-wide text-faint uppercase">
                      {capability.tier}
                    </small>
                  </span>
                ))}
            </div>
          </section>
        )}
      </header>

      <section
        className="flex min-h-0 flex-1 flex-col lg:flex-row"
        aria-label="Capability graph and verdict"
      >
        <div className="canvas-frame relative min-h-[380px] min-w-0 flex-1 lg:min-h-0">
          {/* Floating view control: back action + current level */}
          <div className="absolute top-3 left-3 z-[3] flex items-center gap-2">
            <div className="grid gap-1 rounded-card border border-hairline bg-white/90 px-3 py-2 backdrop-blur-sm">
              {state.view.level === "room" && (
                <button
                  className="-mx-1 -mt-0.5 flex w-fit items-center gap-1 rounded-chip px-1 py-0.5 text-[11px] font-medium text-body transition-colors hover:bg-hairline-soft hover:text-ink"
                  type="button"
                  onClick={() => dispatch({ type: "WENT_HOME" })}
                >
                  <span aria-hidden="true">←</span> Back to rooms
                </button>
              )}
              <p className="m-0 text-[9.5px] font-semibold tracking-widest text-faint uppercase">
                Live inventory
              </p>
              <h2 className="m-0 text-[13px] font-semibold tracking-tight text-ink">
                {viewLabel}
              </h2>
            </div>
          </div>

          {showGraph && (
            <div className="absolute top-3 right-3 z-[3] hidden sm:block">
              <GraphLegend />
            </div>
          )}

          {showGraph ? (
            <>
              <GraphCanvas
                graph={graph}
                phase={state.phase}
                routeDomain={state.route?.domain ?? null}
                routingActive={state.phase === "routing"}
                pulsingSlug={state.pulsingSlug}
                selectedItemId={state.expandedItemId}
                reducedMotion={reducedMotion}
                viewKey={viewKey}
                onNodeClick={handleNodeClick}
                onZoomOut={() => dispatch({ type: "WENT_HOME" })}
              />
              <p
                className="sr-only"
                id="item-selection-status"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {itemSelectionStatus}
              </p>
            </>
          ) : (
            <InventoryCanvasState inventory={activeInventory} />
          )}

          {showGraph && state.phase === "resting" && state.view.level === "home" && (
            <p className="canvas-hint">Tap a room, or map a product above</p>
          )}
          {showGraph && state.phase === "resting" && state.view.level === "room" && (
            <p className="canvas-hint">Tap an item to highlight its capabilities</p>
          )}
          {statusMessage && (
            <div
              className={`route-toast route-toast--${state.phase}`}
              role="status"
              aria-live="polite"
            >
              <span className="route-toast__signal" aria-hidden="true" />
              {statusMessage}
            </div>
          )}
          {state.toast && (
            <div className="notice-toast" role="status">
              <span>{state.toast}</span>
              <button
                type="button"
                aria-label="Dismiss notice"
                onClick={() => dispatch({ type: "TOAST_CLEARED" })}
              >
                ×
              </button>
            </div>
          )}
        </div>

        {hasContextualRail && (
          <div className="min-h-0 w-full shrink-0 border-t border-hairline lg:h-full lg:w-[380px] lg:border-t-0 lg:border-l">
            <VerdictPanel state={state} dispatch={dispatch} />
            {selectedItem && showItemInspector && (
              <ItemInspector
                item={selectedItem}
                onClose={() =>
                  dispatch({ type: "ITEM_TOGGLED", itemId: selectedItem.id })
                }
              />
            )}
          </div>
        )}
      </section>
    </main>
  );
}
