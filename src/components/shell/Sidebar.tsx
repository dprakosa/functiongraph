import type { ReactNode } from "react";
import { AuthStatusSlot } from "../../auth/AuthShell";
import { RouteLink } from "../../routing/RouteLink";
import type { AppRoute } from "../../routing/routes";

interface NavItem {
  route: AppRoute;
  to: string;
  label: string;
  icon: ReactNode;
}

function GraphIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 shrink-0">
      <circle cx="4" cy="4" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="6" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7" cy="12" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 5.2 10 5.6M5.8 10.4 4.8 6M8.8 10.8 10.8 7.8" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 shrink-0">
      <path
        d="M2.5 5 8 2.2 13.5 5v6L8 13.8 2.5 11V5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M2.5 5 8 7.8 13.5 5M8 7.8v6" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 shrink-0">
      <circle cx="8" cy="8" r="5.8" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4.8V8l2.3 1.6" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4 shrink-0">
      <circle cx="8" cy="8" r="2.1" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M8 1.8v2M8 12.2v2M1.8 8h2M12.2 8h2M3.6 3.6l1.4 1.4M11 11l1.4 1.4M12.4 3.6 11 5M5 11l-1.4 1.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export const NAV_ITEMS: NavItem[] = [
  { route: "graph", to: "/graph", label: "Evaluate", icon: <GraphIcon /> },
  { route: "inventory", to: "/inventory", label: "Inventory", icon: <BoxIcon /> },
  { route: "history", to: "/history", label: "History", icon: <ClockIcon /> },
  { route: "settings", to: "/settings", label: "Settings", icon: <GearIcon /> },
];

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <RouteLink
      className="flex items-center gap-2 font-semibold tracking-tight text-ink no-underline"
      to="/"
      aria-label="Subgraph home"
    >
      <span
        aria-hidden="true"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-control bg-accent text-[11px] font-bold text-white"
      >
        S
      </span>
      {!compact && <span className="text-[15px]">Subgraph</span>}
    </RouteLink>
  );
}

export function SidebarNav({
  activeRoute,
  collapsed = false,
  onNavigate,
}: {
  activeRoute: AppRoute;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav aria-label="Application" className="grid gap-0.5">
      {NAV_ITEMS.map((item) => {
        const active = item.route === activeRoute;
        return (
          <RouteLink
            key={item.route}
            to={item.to}
            aria-current={active ? "page" : undefined}
            title={collapsed ? item.label : undefined}
            onClick={onNavigate}
            className={`flex items-center gap-2.5 rounded-control px-2.5 py-2 text-[13px] font-medium no-underline transition-colors ${
              active
                ? "bg-white text-ink shadow-xs"
                : "text-body hover:bg-hairline-soft hover:text-ink"
            } ${collapsed ? "justify-center px-0" : ""}`}
          >
            <span className={active ? "text-accent" : "text-muted"}>{item.icon}</span>
            {!collapsed && item.label}
          </RouteLink>
        );
      })}
    </nav>
  );
}

export function Sidebar({
  activeRoute,
  collapsed,
  onToggleCollapsed,
}: {
  activeRoute: AppRoute;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto border-r border-hairline bg-shell px-3 py-4">
      <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} px-1`}>
        <Wordmark compact={collapsed} />
        <button
          type="button"
          className="hidden rounded-chip p-1 text-muted transition-colors hover:bg-hairline-soft hover:text-ink md:block"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          onClick={onToggleCollapsed}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4">
            <path
              d={collapsed ? "M6 3.5 10.5 8 6 12.5" : "M10 3.5 5.5 8 10 12.5"}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <RouteLink
        to="/graph"
        className={`flex items-center justify-center gap-1.5 rounded-control bg-accent py-2 text-[13px] font-semibold text-white no-underline shadow-xs transition-colors hover:bg-accent-hover active:bg-accent-pressed ${
          collapsed ? "px-0" : "px-3"
        }`}
        title={collapsed ? "Check a product" : undefined}
      >
        <span aria-hidden="true" className="text-sm leading-none">+</span>
        {!collapsed && "Check a product"}
      </RouteLink>

      <SidebarNav activeRoute={activeRoute} collapsed={collapsed} />

      <div className="mt-auto grid gap-3">
        {!collapsed && (
          <div className="rounded-card border border-hairline bg-white p-3">
            <AuthStatusSlot />
          </div>
        )}
      </div>
    </div>
  );
}
