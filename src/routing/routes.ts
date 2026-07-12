export type AppRoute =
  | "landing"
  | "graph"
  | "inventory"
  | "history"
  | "settings"
  | "not-found";

export function routeName(pathname: string): AppRoute {
  if (pathname === "/") return "landing";
  if (pathname === "/graph") return "graph";
  if (pathname === "/inventory") return "inventory";
  if (pathname === "/history") return "history";
  if (pathname === "/settings") return "settings";
  return "not-found";
}

export function titleForRoute(route: AppRoute): string {
  switch (route) {
    case "landing":
      return "Subgraph — See what a purchase adds";
    case "graph":
      return "Evaluate a purchase — Subgraph";
    case "inventory":
      return "Your inventory — Subgraph";
    case "history":
      return "Decision history — Subgraph";
    case "settings":
      return "Settings — Subgraph";
    case "not-found":
      return "Page not found — Subgraph";
  }
}
