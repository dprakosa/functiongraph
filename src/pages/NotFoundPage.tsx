import { RouteLink } from "../routing/RouteLink";

export function NotFoundPage({ pathname }: { pathname: string }) {
  return (
    <main className="not-found-page" aria-labelledby="not-found-title">
      <p className="eyebrow">404 · Unknown path</p>
      <h1 id="not-found-title" data-route-heading tabIndex={-1}>
        This page is not in the graph.
      </h1>
      <p>
        There is no FunctionGraph page at <code>{pathname}</code>. Choose a
        known destination below.
      </p>
      <nav aria-label="Not found destinations">
        <RouteLink className="route-cta" to="/">Go to the landing page</RouteLink>
        <RouteLink className="secondary-route-link" to="/graph">
          Open the knowledge graph
        </RouteLink>
      </nav>
    </main>
  );
}
