import { useState } from "react";
import { AuthStatusSlot } from "../auth/AuthShell";
import { RouteLink } from "../routing/RouteLink";
import { clearDecisions, readDecisions } from "../state/decisionStore";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-2" aria-label={title}>
      <h2 className="m-0 text-sm font-semibold tracking-tight text-ink">{title}</h2>
      <div className="rounded-panel border border-hairline bg-white p-4 shadow-xs">
        {children}
      </div>
    </section>
  );
}

export function SettingsPage() {
  const [decisionCount, setDecisionCount] = useState(() => readDecisions().length);
  const [confirming, setConfirming] = useState(false);

  const clearHistory = () => {
    clearDecisions();
    setDecisionCount(0);
    setConfirming(false);
  };

  return (
    <main
      className="mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-10"
      aria-labelledby="settings-title"
    >
      <header className="grid gap-1">
        <h1
          id="settings-title"
          data-route-heading
          tabIndex={-1}
          className="m-0 text-2xl font-semibold tracking-tight text-ink outline-none"
        >
          Settings
        </h1>
        <p className="m-0 text-[13px] text-muted">
          Account, local data, and product details.
        </p>
      </header>

      <div className="mt-6 grid gap-6">
        <Section title="Account">
          <AuthStatusSlot />
        </Section>

        <Section title="Data on this device">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="m-0 text-[13px] text-body">
              <strong className="text-metric font-semibold text-ink">
                {decisionCount}
              </strong>{" "}
              {decisionCount === 1 ? "decision" : "decisions"} recorded in your
              local history.
            </p>
            {confirming ? (
              <span className="flex items-center gap-2">
                <span className="text-xs text-body">
                  Remove all {decisionCount}{" "}
                  {decisionCount === 1 ? "decision" : "decisions"}?
                </span>
                <button
                  type="button"
                  onClick={clearHistory}
                  className="rounded-control bg-ink px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                >
                  Clear history
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="rounded-control border border-hairline bg-white px-3 py-1.5 text-xs font-medium text-body transition-colors hover:bg-hairline-soft"
                >
                  Keep
                </button>
              </span>
            ) : (
              <button
                type="button"
                disabled={decisionCount === 0}
                onClick={() => setConfirming(true)}
                className="rounded-control border border-hairline bg-white px-3 py-1.5 text-xs font-medium text-body transition-colors hover:bg-hairline-soft disabled:opacity-50"
              >
                Clear decision history
              </button>
            )}
          </div>
          <p className="m-0 mt-3 border-t border-hairline-soft pt-3 text-xs leading-relaxed text-muted">
            Decisions are stored only in this browser. Your inventory lives with
            your account and is managed on the{" "}
            <RouteLink to="/inventory" className="font-medium text-accent no-underline hover:underline">
              inventory page
            </RouteLink>
            .
          </p>
        </Section>

        <Section title="About">
          <div className="grid gap-1 text-[13px] text-body">
            <p className="m-0">
              <strong className="font-semibold text-ink">Subgraph</strong> —
              see what a purchase adds, not what it repeats.
            </p>
            <p className="m-0 text-xs text-muted">
              Photos and scan details are discarded after review. Only items you
              confirm are saved, and they belong to your account.{" "}
              <RouteLink to="/" className="font-medium text-accent no-underline hover:underline">
                Learn more
              </RouteLink>
            </p>
          </div>
        </Section>
      </div>
    </main>
  );
}
