import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AppRoute } from "../../routing/routes";
import { Sidebar, SidebarNav, Wordmark } from "./Sidebar";
import { AuthStatusSlot } from "../../auth/AuthShell";

const COLLAPSE_KEY = "functiongraph:sidebar-collapsed";

function readCollapsedPref(): boolean {
  try {
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Application chrome for /graph, /inventory, /history, /settings: a light
 * gray sidebar beside a white canvas on desktop, a top bar plus slide-over
 * drawer below 768px. Marketing routes render without it.
 */
export function AppShell({
  route,
  children,
}: {
  route: AppRoute;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(readCollapsedPref);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // Preference persistence is best-effort only.
      }
      return next;
    });
  };

  useEffect(() => {
    if (!drawerOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    drawerRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen]);

  // Close the drawer when navigation changes the route.
  useEffect(() => {
    setDrawerOpen(false);
  }, [route]);

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-canvas md:flex-row">
      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-hairline bg-shell px-4 py-2.5 md:hidden">
        <Wordmark />
        <button
          ref={menuButtonRef}
          type="button"
          className="rounded-control p-1.5 text-body transition-colors hover:bg-hairline-soft"
          aria-label="Open navigation"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true" className="h-5 w-5">
            <path
              d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>

      {/* Mobile slide-over drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-ink/20"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            tabIndex={-1}
            className="absolute inset-y-0 left-0 flex w-72 flex-col gap-4 overflow-y-auto bg-shell px-3 py-4 shadow-overlay outline-none"
          >
            <div className="flex items-center justify-between px-1">
              <Wordmark />
              <button
                type="button"
                className="rounded-chip p-1 text-muted transition-colors hover:bg-hairline-soft hover:text-ink"
                aria-label="Close navigation"
                onClick={() => {
                  setDrawerOpen(false);
                  menuButtonRef.current?.focus();
                }}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true" className="h-4 w-4">
                  <path
                    d="m4 4 8 8M12 4l-8 8"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
            <SidebarNav activeRoute={route} onNavigate={() => setDrawerOpen(false)} />
            <div className="mt-auto rounded-card border border-hairline bg-white p-3">
              <AuthStatusSlot />
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={`hidden shrink-0 transition-[width] duration-200 md:block ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        <Sidebar
          activeRoute={route}
          collapsed={collapsed}
          onToggleCollapsed={toggleCollapsed}
        />
      </aside>

      <div className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}
