import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import GraphPage from "../App";
import { LandingPage } from "../pages/LandingPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { RouterProvider, type RouterContextValue } from "./RouteLink";

function normalizedPathname(pathname: string): string {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "") || "/";
}

function routeName(pathname: string): "landing" | "graph" | "not-found" {
  if (pathname === "/") return "landing";
  if (pathname === "/graph") return "graph";
  return "not-found";
}

function titleForRoute(route: ReturnType<typeof routeName>): string {
  if (route === "landing") return "FunctionGraph — See what a purchase adds";
  if (route === "graph") return "Your knowledge graph — FunctionGraph";
  return "Page not found — FunctionGraph";
}

export function RootRouter() {
  const [pathname, setPathname] = useState(() =>
    normalizedPathname(window.location.pathname),
  );
  const firstRender = useRef(true);
  const route = routeName(pathname);

  const router = useMemo<RouterContextValue>(
    () => ({
      navigate(to, replace = false) {
        const destination = new URL(to, window.location.href);
        const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
        const next = `${destination.pathname}${destination.search}${destination.hash}`;
        if (next === current) return;

        window.history[replace ? "replaceState" : "pushState"]({}, "", next);
        setPathname(normalizedPathname(destination.pathname));
      },
    }),
    [],
  );

  useEffect(() => {
    const handlePopState = () => {
      setPathname(normalizedPathname(window.location.pathname));
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    document.title = titleForRoute(route);
    document.body.dataset.route = route;

    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const heading = document.querySelector<HTMLElement>("[data-route-heading]");
    heading?.focus({ preventScroll: true });
  }, [pathname, route]);

  useEffect(
    () => () => {
      delete document.body.dataset.route;
    },
    [],
  );

  let page: ReactNode;
  if (route === "landing") page = <LandingPage />;
  else if (route === "graph") page = <GraphPage />;
  else page = <NotFoundPage pathname={pathname} />;

  return (
    <RouterProvider value={router}>
      <div className={`route-root route-root--${route}`}>{page}</div>
    </RouterProvider>
  );
}
