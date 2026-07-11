import {
  createContext,
  useContext,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from "react";

export interface RouterContextValue {
  navigate: (to: string, replace?: boolean) => void;
}

const RouterContext = createContext<RouterContextValue | null>(null);

export function RouterProvider({
  value,
  children,
}: {
  value: RouterContextValue;
  children: ReactNode;
}) {
  return <RouterContext.Provider value={value}>{children}</RouterContext.Provider>;
}

export interface RouteLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: string;
  replace?: boolean;
}

/**
 * An ordinary anchor enhanced with the History API. If it is rendered outside
 * RootRouter (for isolated component tests), the browser handles it normally.
 */
export function RouteLink({
  to,
  replace = false,
  onClick,
  target,
  ...props
}: RouteLinkProps) {
  const router = useContext(RouterContext);

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      !router ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      (target && target !== "_self")
    ) {
      return;
    }

    const destination = new URL(to, window.location.href);
    if (destination.origin !== window.location.origin) return;

    event.preventDefault();
    router.navigate(
      `${destination.pathname}${destination.search}${destination.hash}`,
      replace,
    );
  };

  return <a href={to} target={target} onClick={handleClick} {...props} />;
}
