import {
  useMemo,
  useReducer,
  useRef,
  useState,
  useEffect,
  type FormEvent,
} from "react";
import inventoryFile from "./data/inventory.json";
import { GraphCanvas } from "./components/GraphCanvas";
import { ProductCommandBar } from "./components/ProductCommandBar";
import {
  buildGraph,
  type GraphNodeDatum,
} from "./graph/buildGraph";
import { useReducedMotion } from "./hooks/useReducedMotion";
import { copy } from "./lib/copy";
import { routeVerdict } from "./lib/route";
import type { InventoryFile, Row } from "./lib/types";
import {
  appReducer,
  initialState,
  type AppAction,
  type AppState,
} from "./state/appReducer";
import { evaluate, EvaluateFailure } from "./state/evaluateClient";
import { useBeats } from "./state/useBeats";

const inventory = inventoryFile as InventoryFile;

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatPrice(price: number): string {
  return `$${price.toLocaleString("en-AU", {
    maximumFractionDigits: Number.isInteger(price) ? 0 : 2,
  })}`;
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

interface VerdictRowProps {
  row: Row;
  active: boolean;
  onPulse: (capSlug: string) => void;
}

function VerdictRow({ row, active, onPulse }: VerdictRowProps) {
  const source = row.covered
    ? copy.rowSource(row.bestCoverer ?? "Owned item", row.covererCount)
    : copy.rowNew;

  return (
    <li>
      <button
        className={`verdict-row verdict-row--${row.covered ? "covered" : "new"}`}
        type="button"
        onClick={() => onPulse(row.capSlug)}
        aria-pressed={active}
        aria-label={`${row.capability}: ${source}. Highlight its graph edge`}
      >
        <span className="verdict-row__mark" aria-hidden="true">
          {row.covered ? "✓" : "+"}
        </span>
        <span className="verdict-row__body">
          <span className="verdict-row__capability">{row.capability}</span>
          <span className="verdict-row__source">{source}</span>
        </span>
        <span className="verdict-row__tier">{row.tier}</span>
        <span className="verdict-row__edge" aria-hidden="true">
          ↗
        </span>
      </button>
    </li>
  );
}

interface VerdictPanelProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

function VerdictPanel({ state, dispatch }: VerdictPanelProps) {
  const result = state.result;
  if (!result || state.phase !== "verdict") return null;

  const { verdict } = result;
  const percent = Math.round(verdict.coverage * 100);
  const isApproval = verdict.coveredCount === 0;
  const delta =
    result.price == null
      ? null
      : verdict.newCapabilities.length === 0
        ? copy.deltaNothing(result.price)
        : copy.deltaNew(
            result.price,
            verdict.newCapabilities.length,
            verdict.pricePerNewCapability!,
          );

  const submitReason = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    dispatch({ type: "BOUGHT_ANYWAY" });
  };

  return (
    <aside
      className={`verdict-panel${isApproval ? " verdict-panel--approval" : ""}`}
      aria-labelledby="verdict-title"
    >
      <div className="verdict-panel__header">
        <p className="eyebrow">Verdict</p>
        <div className="verdict-panel__titleline">
          <h2 id="verdict-title">{result.name}</h2>
          {result.price != null && (
            <span className="verdict-panel__price">{formatPrice(result.price)}</span>
          )}
        </div>
        {isApproval && <p className="approval-line">{copy.approval}</p>}
      </div>

      <section className="coverage" aria-label="Coverage score">
        <div className="coverage__line">
          <strong>{copy.coverageLine(verdict.coveredCount, verdict.totalCount)}</strong>
          <span>{percent}%</span>
        </div>
        <progress value={verdict.coverage} max={1}>
          {percent}%
        </progress>
        <p>{copy.coverageSub(percent)}</p>
      </section>

      <section className="checklist" aria-labelledby="checklist-title">
        <div className="section-heading">
          <h3 id="checklist-title">Capability checklist</h3>
          <span>Tap a row to trace its edge</span>
        </div>
        <ul>
          {verdict.rows.map((row) => (
            <VerdictRow
              key={row.capSlug}
              row={row}
              active={state.pulsingSlug === row.capSlug}
              onPulse={(capSlug) => dispatch({ type: "ROW_PULSED", capSlug })}
            />
          ))}
        </ul>
      </section>

      {(delta || result.altSuggestion) && (
        <section className="delta" aria-label="Delta economics">
          {delta && <p className="delta__line">{delta}</p>}
          {result.altSuggestion && (
            <p className="delta__alternative">
              <span>Acquire only the delta</span>
              {result.altSuggestion}
            </p>
          )}
        </section>
      )}

      <section className="verdict-actions" aria-label="Purchase actions">
        <button
          className="button button--skip"
          type="button"
          onClick={() => dispatch({ type: "PURCHASE_SKIPPED" })}
        >
          {copy.skipAction}
        </button>
        <button
          className="button button--quiet"
          type="button"
          aria-expanded={state.stillNeedItOpen}
          onClick={() => dispatch({ type: "STILL_NEEDED" })}
        >
          {copy.stillNeedAction}
        </button>

        {state.stillNeedItOpen && (
          <form className="reason-form" onSubmit={submitReason}>
            <label htmlFor="purchase-reason">{copy.reasonPrompt}</label>
            <div className="reason-form__controls">
              <input
                id="purchase-reason"
                name="reason"
                type="text"
                value={state.reason}
                maxLength={240}
                autoFocus
                placeholder="A capability or situation that matters to you"
                onChange={(event) =>
                  dispatch({ type: "REASON_CHANGED", reason: event.target.value })
                }
              />
              <button className="button button--buy" type="submit">
                {copy.buyAction}
              </button>
            </div>
          </form>
        )}
      </section>
    </aside>
  );
}

export default function App() {
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
        items: inventory.items,
        unscannedRooms: inventory.unscannedRooms,
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

  const startEvaluation = async (rawText: string) => {
    const text = rawText.trim();
    const sequence = ++requestSequence.current;
    dispatch({ type: "EVALUATE_START", text });
    try {
      const result = await evaluate(text);
      if (sequence !== requestSequence.current) return;
      dispatch({
        type: "EVALUATE_SUCCESS",
        result,
        route: routeVerdict(result.verdict, inventory.items),
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
      dispatch({ type: "UNSCANNED_TAPPED", message: copy.unscannedToast });
      return;
    }
    if (node.kind === "item") {
      dispatch({ type: "ITEM_TOGGLED", itemId: node.id });
    }
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <a className="brand" href="#top" aria-label="FunctionGraph home">
          <span className="brand__mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>FunctionGraph</span>
        </a>
        <p className="app-header__promise">
          Capability-level purchase decisions, mapped live.
        </p>
        <output className="impact-counter" aria-live="polite">
          <span className="impact-counter__dot" aria-hidden="true" />
          {copy.impact(state.impact.dollarsKept, state.impact.kgAvoided)}
        </output>
      </header>

      <section className="intro" id="top" aria-labelledby="intro-title">
        <div className="intro__copy">
          <p className="eyebrow">Purchase evaluation</p>
          <h1 id="intro-title">Map a product against what you own</h1>
          <p>
            See every covered capability and the genuinely new delta before
            you decide.
          </p>
        </div>
        <ProductCommandBar
          draft={draft}
          isEvaluating={isReading}
          onDraftChange={setDraft}
          onSubmit={submitProduct}
          onExample={tryExample}
        />
      </section>

      {state.error && (
        <section className="error-banner" role="alert">
          <div>
            <strong>{titleCase(state.error.error)}</strong>
            <span>{state.error.hint}</span>
          </div>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => dispatch({ type: "ERROR_DISMISSED" })}
          >
            ×
          </button>
        </section>
      )}

      {state.result && state.phase !== "resting" && (
        <section className="capability-stream" aria-label="Extracted capabilities">
          <div className="capability-stream__heading">
            <span>Capabilities</span>
            <span>
              {state.revealedChips} / {state.result.capabilities.length}
            </span>
          </div>
          <div className="capability-stream__chips" aria-live="polite">
            {state.result.capabilities
              .slice(0, state.revealedChips)
              .map((capability) => (
                <span
                  key={`${capability.name}:${capability.tier}`}
                  className={`capability-chip capability-chip--${capability.tier}`}
                >
                  {capability.name}
                  <small>{capability.tier}</small>
                </span>
              ))}
          </div>
        </section>
      )}

      <section
        className={`workspace${state.phase === "verdict" ? " has-verdict" : ""}`}
        aria-label="Capability graph and verdict"
      >
        <div className="canvas-column">
          <div className="canvas-toolbar">
            <div>
              {state.view.level === "room" && (
                <button
                  className="back-button"
                  type="button"
                  onClick={() => dispatch({ type: "WENT_HOME" })}
                >
                  <span aria-hidden="true">←</span> Back to rooms
                </button>
              )}
              <p className="eyebrow">Live inventory</p>
              <h2>{viewLabel}</h2>
            </div>
            <div className="graph-legend" aria-label="Graph legend">
              <span><i className="legend-covered" /> covered</span>
              <span><i className="legend-new" /> new</span>
              <span><i className="legend-owned" /> owned</span>
            </div>
          </div>

          <div className="canvas-frame">
            <GraphCanvas
              graph={graph}
              phase={state.phase}
              routeDomain={state.route?.domain ?? null}
              routingActive={state.phase === "routing"}
              pulsingSlug={state.pulsingSlug}
              reducedMotion={reducedMotion}
              viewKey={viewKey}
              onNodeClick={handleNodeClick}
              onZoomOut={() => dispatch({ type: "WENT_HOME" })}
            />

            {state.phase === "resting" && state.view.level === "home" && (
              <p className="canvas-hint">Tap a room, or map a product above</p>
            )}
            {state.phase === "resting" && state.view.level === "room" && (
              <p className="canvas-hint">Tap an item to reveal its unique capabilities</p>
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
        </div>

        <VerdictPanel state={state} dispatch={dispatch} />
      </section>

      <footer className="app-footer">
        <p>Capabilities create the structure. Every verdict row traces to a graph edge.</p>
        <p>Coral means covered · Green means genuinely new</p>
      </footer>
    </main>
  );
}
