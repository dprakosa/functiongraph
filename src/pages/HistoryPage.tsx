import { useState } from "react";
import { Badge } from "../components/ui/Badge";
import { StatCard } from "../components/ui/StatCard";
import { RouteLink } from "../routing/RouteLink";
import { readDecisions, type PurchaseDecision } from "../state/decisionStore";

function formatPrice(price: number): string {
  return `$${price.toLocaleString("en-AU", {
    maximumFractionDigits: Number.isInteger(price) ? 0 : 2,
  })}`;
}

function formatDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function DecisionRow({ decision }: { decision: PurchaseDecision }) {
  const percent = Math.round(decision.coverage * 100);
  return (
    <li className="grid gap-2 border-b border-hairline-soft px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <span className="truncate text-sm font-semibold text-ink">
            {decision.product}
          </span>
          {decision.price != null && (
            <span className="text-metric shrink-0 text-[13px] text-body">
              {formatPrice(decision.price)}
            </span>
          )}
          <span className="text-metric shrink-0 text-xs text-muted">
            {percent}% covered
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[11px] text-faint">{formatDate(decision.decidedAt)}</span>
          {decision.choice === "skipped" ? (
            <Badge tone="amber">Skipped</Badge>
          ) : (
            <Badge tone="neutral">Bought anyway</Badge>
          )}
        </div>
      </div>
      {decision.reason && (
        <p className="m-0 text-xs text-muted italic">“{decision.reason}”</p>
      )}
    </li>
  );
}

export function HistoryPage() {
  const [decisions] = useState<PurchaseDecision[]>(() => readDecisions());

  const skippedCount = decisions.filter(
    (decision) => decision.choice === "skipped",
  ).length;
  const boughtCount = decisions.length - skippedCount;

  return (
    <main
      className="mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-10"
      aria-labelledby="history-title"
    >
      <header className="grid gap-1">
        <h1
          id="history-title"
          data-route-heading
          tabIndex={-1}
          className="m-0 text-2xl font-semibold tracking-tight text-ink outline-none"
        >
          Decision history
        </h1>
        <p className="m-0 text-[13px] text-muted">
          Every purchase decision you have recorded on this device.
        </p>
      </header>

      {decisions.length === 0 ? (
        <section className="mt-8 grid justify-items-center gap-3 rounded-panel border border-dashed border-hairline bg-wash px-6 py-14 text-center">
          <h2 className="m-0 text-base font-semibold text-ink">No decisions yet</h2>
          <p className="m-0 max-w-sm text-[13px] leading-relaxed text-muted">
            Check a product against what you own and your skip / buy calls will
            build a running tally here.
          </p>
          <RouteLink
            to="/graph"
            className="mt-1 rounded-control bg-accent px-4 py-2 text-[13px] font-semibold text-white no-underline shadow-xs transition-colors hover:bg-accent-hover active:bg-accent-pressed"
          >
            Check your first product
          </RouteLink>
        </section>
      ) : (
        <>
          <section
            className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3"
            aria-label="Decision summary"
          >
            <StatCard
              label="Decisions recorded"
              value={decisions.length}
              detail="on this device"
            />
            <StatCard
              label="Skipped"
              value={skippedCount}
              detail="purchases"
            />
            <StatCard
              label="Still bought"
              value={boughtCount}
              detail="purchases"
            />
          </section>

          <section
            className="mt-6 rounded-panel border border-hairline bg-white shadow-xs"
            aria-label="Recorded decisions"
          >
            <ul className="m-0 grid list-none p-0">
              {decisions.map((decision) => (
                <DecisionRow key={decision.id} decision={decision} />
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
