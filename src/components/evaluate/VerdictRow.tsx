import { copy } from "../../lib/copy";
import type { Row } from "../../lib/types";

export interface VerdictRowProps {
  row: Row;
  active: boolean;
  onPulse: (capSlug: string) => void;
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" aria-hidden="true">
      <circle cx="7" cy="7" r="6.2" fill="currentColor" opacity="0.15" />
      <path
        d="m4.2 7.2 1.9 1.9 3.7-4.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" aria-hidden="true">
      <path
        d="M7 1.4 8.3 5 12 6.4 8.3 7.8 7 11.4 5.7 7.8 2 6.4 5.7 5 7 1.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * One capability claim. Activating it pulses exactly the edge with the
 * matching id (ghost-><capSlug> or e:<itemId>-><capSlug>) — the aria-label
 * and dispatch contract are load-bearing (PDD VIS-4).
 */
export function VerdictRow({ row, active, onPulse }: VerdictRowProps) {
  const source = row.covered
    ? copy.rowSource(row.bestCoverer ?? "Owned item", row.covererCount)
    : copy.rowNew;

  return (
    <li>
      <button
        type="button"
        onClick={() => onPulse(row.capSlug)}
        aria-pressed={active}
        aria-label={`${row.capability}: ${source}. Highlight its graph edge`}
        className={`group flex w-full items-center gap-2.5 rounded-control border px-2.5 py-2 text-left transition-colors ${
          active
            ? "border-accent/40 bg-accent-soft"
            : row.covered
              ? "border-transparent bg-transparent hover:bg-hairline-soft"
              : "border-new/20 bg-new-soft/60 hover:bg-new-soft"
        }`}
      >
        <span
          aria-hidden="true"
          className={`shrink-0 ${row.covered ? "text-covered" : "text-new"}`}
        >
          {row.covered ? <CheckIcon /> : <SparkleIcon />}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-[13px] font-medium ${
              row.covered ? "text-covered-text" : "text-ink"
            }`}
          >
            {row.capability}
          </span>
          <span
            className={`block truncate text-[11px] ${
              row.covered ? "text-muted" : "font-medium text-new-text"
            }`}
          >
            {source}
          </span>
        </span>
        <span className="shrink-0 rounded-chip bg-hairline-soft px-1.5 py-0.5 text-[10px] font-medium text-muted">
          {row.tier}
        </span>
        <span
          aria-hidden="true"
          className="shrink-0 text-xs text-faint opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          ↗
        </span>
      </button>
    </li>
  );
}
