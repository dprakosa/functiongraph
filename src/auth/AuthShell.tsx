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
import type { ReactNode } from "react";

interface AuthShellProps {
  publishableKey?: string | null;
  children: ReactNode;
}

interface GuestDemoStatusProps {
  unavailable?: boolean;
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
    <div className="auth-status__copy">
      <span className={`auth-status__label auth-status__label--${tone}`}>
        <i aria-hidden="true" />
        {label}
      </span>
      <p>{children}</p>
    </div>
  );
}

export function GuestDemoStatus({ unavailable = false }: GuestDemoStatusProps) {
  return (
    <aside
      className="auth-status"
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
      className="auth-status"
      aria-label="Account status"
      aria-live="polite"
      data-auth-state="loading"
    >
      <StatusCopy label="Checking account" tone="loading">
        The offline demo remains available while sign-in loads.
      </StatusCopy>
    </aside>
  );
}

function SignedOutStatus() {
  return (
    <aside
      className="auth-status"
      aria-label="Account status"
      data-auth-state="signed-out"
    >
      <StatusCopy label="Guest demo">
        The three examples work offline. Sign in for live product checks.
      </StatusCopy>
      <div className="auth-status__actions" aria-label="Account actions">
        <SignInButton mode="modal">
          <button className="auth-action auth-action--primary" type="button">
            Sign in
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button className="auth-action" type="button">
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
      className="auth-status"
      aria-label="Account status"
      data-auth-state="signed-in"
    >
      <StatusCopy label="Live enabled" tone="live">
        Signed in for live product checks. Offline examples remain available.
      </StatusCopy>
      <div className="auth-status__account">
        <span>Account</span>
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
      <>
        <GuestDemoStatus />
        {children}
      </>
    );
  }

  return (
    <ClerkProvider publishableKey={configuredKey}>
      <ClerkLoading>
        <AuthLoadingStatus />
      </ClerkLoading>
      <ClerkLoaded>
        <Show when="signed-out">
          <SignedOutStatus />
        </Show>
        <Show when="signed-in">
          <SignedInStatus />
        </Show>
      </ClerkLoaded>
      <ClerkFailed>
        <GuestDemoStatus unavailable />
      </ClerkFailed>
      {children}
    </ClerkProvider>
  );
}
