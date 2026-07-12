import { RouteLink } from "../routing/RouteLink";
import { MarketingNav } from "./landing/MarketingNav";

export function NotFoundPage({ pathname }: { pathname: string }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <MarketingNav />
      <main
        className="mx-auto grid w-full max-w-xl flex-1 content-center justify-items-center gap-4 px-4 py-16 text-center"
        aria-labelledby="not-found-title"
      >
        <p className="m-0 text-[13px] font-semibold text-accent">404 · Unknown path</p>
        <h1
          id="not-found-title"
          data-route-heading
          tabIndex={-1}
          className="m-0 text-4xl font-semibold tracking-tight text-ink outline-none"
        >
          This page is not in the graph.
        </h1>
        <p className="m-0 text-[15px] leading-relaxed text-body">
          There is no FunctionGraph page at{" "}
          <code className="rounded-chip bg-hairline-soft px-1.5 py-0.5 text-[13px] text-ink">
            {pathname}
          </code>
          . Choose a known destination below.
        </p>
        <nav
          aria-label="Not found destinations"
          className="mt-2 flex flex-wrap items-center justify-center gap-3"
        >
          <RouteLink
            to="/"
            className="rounded-control bg-accent px-4 py-2.5 text-[13px] font-semibold text-white no-underline shadow-xs transition-colors hover:bg-accent-hover"
          >
            Go to the landing page
          </RouteLink>
          <RouteLink
            to="/graph"
            className="rounded-control border border-hairline bg-white px-4 py-2.5 text-[13px] font-medium text-body no-underline transition-colors hover:bg-hairline-soft hover:text-ink"
          >
            Open the knowledge graph
          </RouteLink>
        </nav>
      </main>
    </div>
  );
}
