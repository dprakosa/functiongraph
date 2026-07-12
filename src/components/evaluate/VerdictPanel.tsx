import type { FormEvent } from "react";
import { copy } from "../../lib/copy";
import type { Row } from "../../lib/types";
import type { AppAction, AppState } from "../../state/appReducer";
import { appendDecision } from "../../state/decisionStore";
import { Badge } from "../ui/Badge";
import { CoverageRing } from "../ui/CoverageRing";
import { StatCard } from "../ui/StatCard";
import { VerdictRow } from "./VerdictRow";

function formatPrice(price: number): string {
  return `$${price.toLocaleString("en-AU", {
    maximumFractionDigits: Number.isInteger(price) ? 0 : 2,
  })}`;
}

function RowGroup({
  title,
  rows,
  state,
  dispatch,
}: {
  title: string;
  rows: Row[];
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="grid gap-1">
      <h4 className="m-0 text-[11px] font-semibold text-muted">
        {title} ({rows.length})
      </h4>
      <ul className="m-0 grid list-none gap-0.5 p-0">
        {rows.map((row) => (
          <VerdictRow
            key={row.capSlug}
            row={row}
            active={state.pulsingSlug === row.capSlug}
            onPulse={(capSlug) => dispatch({ type: "ROW_PULSED", capSlug })}
          />
        ))}
      </ul>
    </div>
  );
}

export interface VerdictPanelProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

/**
 * The verdict rail. Section order per DESIGN.md: product, coverage,
 * checklist, delta economics, alternative, actions. All user-facing strings
 * come from copy.ts (CNT-4) — do not rephrase them.
 */
export function VerdictPanel({ state, dispatch }: VerdictPanelProps) {
  const result = state.result;
  if (!result || state.phase !== "verdict") return null;

  const { verdict } = result;
  const percent = Math.round(verdict.coverage * 100);
  const isApproval = verdict.coveredCount === 0;
  const coveredRows = verdict.rows.filter((row) => row.covered);
  const newRows = verdict.rows.filter((row) => !row.covered);
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

  const recordDecision = (choice: "skipped" | "bought", reason: string | null) => {
    appendDecision({
      product: result.name,
      price: result.price,
      coverage: verdict.coverage,
      coveredCount: verdict.coveredCount,
      totalCount: verdict.totalCount,
      choice,
      reason,
    });
  };

  const submitReason = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    recordDecision("bought", state.reason.trim() || null);
    dispatch({ type: "BOUGHT_ANYWAY" });
  };

  return (
    <aside
      className="flex h-full min-h-0 flex-col bg-white motion-safe:animate-panel-in"
      aria-labelledby="verdict-title"
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid gap-4">
          <header className="grid gap-1">
            <p className="m-0 text-[11px] font-semibold tracking-wide text-muted uppercase">
              Verdict
            </p>
            <div className="flex items-baseline justify-between gap-3">
              <h2
                id="verdict-title"
                className="m-0 text-base font-semibold tracking-tight text-ink"
              >
                {result.name}
              </h2>
              {result.price != null && (
                <span className="text-metric shrink-0 text-base font-semibold text-ink">
                  {formatPrice(result.price)}
                </span>
              )}
            </div>
          </header>

          {isApproval ? (
            <Badge tone="new" block icon={<SparkleGlyph />}>
              {copy.approval}
            </Badge>
          ) : (
            <Badge tone={percent >= 50 ? "amber" : "neutral"} block icon={<OverlapGlyph />}>
              {percent >= 50 ? "Mostly covered by what you own" : "Partly covered by what you own"}
            </Badge>
          )}

          <section
            className="flex items-center gap-4 rounded-card border border-hairline bg-white p-3 shadow-xs"
            aria-label="Coverage score"
          >
            <CoverageRing coverage={verdict.coverage} />
            <div className="grid gap-0.5">
              <strong className="text-metric text-sm font-semibold text-ink">
                {copy.coverageLine(verdict.coveredCount, verdict.totalCount)}
              </strong>
              <p className="text-metric m-0 text-xs text-muted">
                {copy.coverageSub(percent)}
              </p>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-2">
            <StatCard
              label="Genuinely new"
              value={verdict.newCapabilities.length}
              detail={
                verdict.newCapabilities.length === 1 ? "capability" : "capabilities"
              }
            />
            <StatCard
              label="Per new capability"
              value={
                verdict.pricePerNewCapability != null
                  ? `${formatPrice(verdict.pricePerNewCapability)} each`
                  : "—"
              }
            />
          </div>

          <section className="grid gap-3" aria-labelledby="checklist-title">
            <div className="flex items-baseline justify-between gap-2">
              <h3
                id="checklist-title"
                className="m-0 text-[13px] font-semibold text-ink"
              >
                Capability checklist
              </h3>
              <span className="text-[10.5px] text-faint">
                Tap a row to trace its edge
              </span>
            </div>
            <RowGroup
              title="Already covered"
              rows={coveredRows}
              state={state}
              dispatch={dispatch}
            />
            <RowGroup
              title="New to you"
              rows={newRows}
              state={state}
              dispatch={dispatch}
            />
          </section>

          {(delta || result.altSuggestion) && (
            <section
              className="grid gap-2 rounded-card border border-hairline bg-wash p-3"
              aria-label="Delta economics"
            >
              {delta && (
                <p className="text-metric m-0 text-[13px] font-semibold text-ink">
                  {delta}
                </p>
              )}
              {result.altSuggestion && (
                <p className="m-0 grid gap-0.5 text-xs leading-relaxed text-body">
                  <span className="text-[10.5px] font-semibold tracking-wide text-muted uppercase">
                    Acquire only the delta
                  </span>
                  {result.altSuggestion}
                </p>
              )}
            </section>
          )}
        </div>
      </div>

      <section
        className="grid gap-2 border-t border-hairline bg-white p-3"
        aria-label="Purchase actions"
      >
        <div className="grid grid-cols-2 gap-2">
          <button
            className="rounded-control bg-accent px-3 py-2.5 text-[13px] font-semibold text-white shadow-xs transition-colors hover:bg-accent-hover active:bg-accent-pressed"
            type="button"
            onClick={() => {
              recordDecision("skipped", null);
              dispatch({ type: "PURCHASE_SKIPPED" });
            }}
          >
            {copy.skipAction}
          </button>
          <button
            className="rounded-control border border-hairline bg-white px-3 py-2.5 text-[13px] font-medium text-body transition-colors hover:bg-hairline-soft"
            type="button"
            aria-expanded={state.stillNeedItOpen}
            onClick={() => dispatch({ type: "STILL_NEEDED" })}
          >
            {copy.stillNeedAction}
          </button>
        </div>

        {state.stillNeedItOpen && (
          <form className="grid gap-1.5" onSubmit={submitReason}>
            <label
              htmlFor="purchase-reason"
              className="text-xs font-medium text-body"
            >
              {copy.reasonPrompt}
            </label>
            <div className="flex gap-2">
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
                className="min-w-0 flex-1 rounded-control border border-hairline bg-white px-2.5 py-2 text-[13px] text-ink placeholder:text-faint focus:border-accent focus:shadow-[inset_0_0_0_1px_var(--color-accent)] focus:outline-none"
              />
              <button
                className="shrink-0 rounded-control border border-hairline bg-white px-3 py-2 text-[13px] font-semibold text-body transition-colors hover:bg-hairline-soft"
                type="submit"
              >
                {copy.buyAction}
              </button>
            </div>
          </form>
        )}
      </section>
    </aside>
  );
}

function SparkleGlyph() {
  return (
    <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M7 1.4 8.3 5 12 6.4 8.3 7.8 7 11.4 5.7 7.8 2 6.4 5.7 5 7 1.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function OverlapGlyph() {
  return (
    <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" aria-hidden="true">
      <circle cx="5.4" cy="7" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8.6" cy="7" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
