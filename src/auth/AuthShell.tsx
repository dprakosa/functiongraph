import {
  ClerkFailed,
  ClerkLoaded,
  ClerkLoading,
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/react";
import { createContext, useContext, type ReactNode } from "react";

interface AuthShellProps {
  publishableKey?: string | null;
  children: ReactNode;
}

interface GuestDemoStatusProps {
  unavailable?: boolean;
}

export type ViewerMode = "guest" | "loading" | "signed-in";

interface ViewerState {
  mode: ViewerMode;
}

const ViewerStateContext = createContext<ViewerState>({ mode: "guest" });
const AuthStatusContext = createContext<ReactNode>(null);

export function useViewerState(): ViewerState {
  return useContext(ViewerStateContext);
}

export function ViewerStateProvider({
  mode,
  children,
}: {
  mode: ViewerMode;
  children: ReactNode;
}) {
  return (
    <ViewerStateContext.Provider value={{ mode }}>
      {children}
    </ViewerStateContext.Provider>
  );
}

/**
 * Renders the account status block for the current auth state wherever it is
 * placed (app sidebar, settings page, marketing nav). The status node itself
 * is selected by AuthShell so Clerk state handling stays in one place.
 */
export function AuthStatusSlot() {
  return <>{useContext(AuthStatusContext)}</>;
}

function AuthFrame({
  mode,
  status,
  children,
}: {
  mode: ViewerMode;
  status: ReactNode;
  children: ReactNode;
}) {
  return (
    <ViewerStateProvider mode={mode}>
      <AuthStatusContext.Provider value={status}>
        <div className="contents" data-viewer-mode={mode}>
          {children}
        </div>
      </AuthStatusContext.Provider>
    </ViewerStateProvider>
  );
}

function StatusCopy({
  label,
  children,
  tone = "demo",
}: {
  label: string;
  children: ReactNode;
  tone?: "demo" | "live" | "loading";
}) {
  return (
    <div className="grid gap-1">
      <span
        className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-ink"
        data-tone={tone}
      >
        <i
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${
            tone === "live"
              ? "bg-new"
              : tone === "loading"
                ? "animate-pulse bg-faint"
                : "bg-faint"
          }`}
        />
        {label}
      </span>
      <p className="m-0 text-xs leading-relaxed text-muted">{children}</p>
    </div>
  );
}

export function GuestDemoStatus({ unavailable = false }: GuestDemoStatusProps) {
  return (
    <aside
      className="grid gap-2"
      aria-label="Account status"
      data-auth-state="guest-demo"
    >
      <StatusCopy label="Guest demo">
        {unavailable
          ? "Account services are unavailable. The three examples still run fully offline."
          : "Accounts aren't configured here. The three examples run fully offline."}
      </StatusCopy>
    </aside>
  );
}

function AuthLoadingStatus() {
  return (
    <aside
      className="grid gap-2"
      aria-label="Account status"
      aria-live="polite"
      data-auth-state="loading"
    >
      <StatusCopy label="Checking account" tone="loading">
        The graph waits here until the correct inventory boundary is known.
      </StatusCopy>
    </aside>
  );
}

function SignedOutStatus() {
  return (
    <aside
      className="grid gap-2.5"
      aria-label="Account status"
      data-auth-state="signed-out"
    >
      <StatusCopy label="Guest demo">
        The three examples work offline. Sign in for live product checks.
      </StatusCopy>
      <div className="flex gap-2" aria-label="Account actions">
        <SignInButton mode="modal">
          <button
            className="rounded-control bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-accent-hover active:bg-accent-pressed"
            type="button"
          >
            Sign in
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button
            className="rounded-control border border-hairline bg-white px-3 py-1.5 text-xs font-semibold text-body transition-colors hover:bg-hairline-soft"
            type="button"
          >
            Sign up
          </button>
        </SignUpButton>
      </div>
    </aside>
  );
}

function SignedInStatus() {
  return (
    <aside
      className="grid gap-2.5"
      aria-label="Account status"
      data-auth-state="signed-in"
    >
      <StatusCopy label="Live enabled" tone="live">
        Signed in for live product checks. Offline examples remain available.
      </StatusCopy>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted">Account</span>
        <UserButton />
      </div>
    </aside>
  );
}

/**
 * Keeps the application available regardless of Clerk configuration or load
 * state. Clerk components are never mounted without a non-blank key.
 */
export function AuthShell({ publishableKey, children }: AuthShellProps) {
  const configuredKey = publishableKey?.trim();

  if (!configuredKey) {
    return (
      <AuthFrame mode="guest" status={<GuestDemoStatus />}>
        {children}
      </AuthFrame>
    );
  }

  return (
    <ClerkProvider publishableKey={configuredKey}>
      <ClerkLoading>
        <AuthFrame mode="loading" status={<AuthLoadingStatus />}>
          {children}
        </AuthFrame>
      </ClerkLoading>
      <ClerkLoaded>
        <Show when="signed-out">
          <AuthFrame mode="guest" status={<SignedOutStatus />}>
            {children}
          </AuthFrame>
        </Show>
        <Show when="signed-in">
          <AuthFrame mode="signed-in" status={<SignedInStatus />}>
            {children}
          </AuthFrame>
        </Show>
      </ClerkLoaded>
      <ClerkFailed>
        <AuthFrame mode="guest" status={<GuestDemoStatus unavailable />}>
          {children}
        </AuthFrame>
      </ClerkFailed>
    </ClerkProvider>
  );
}
