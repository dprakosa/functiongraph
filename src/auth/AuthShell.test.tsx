import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthActionSlot, AuthShell, AuthStatusSlot } from "./AuthShell";

const clerk = vi.hoisted(() => ({
  state: "signed-out" as "loading" | "signed-out" | "signed-in" | "failed",
}));

vi.mock("@clerk/react", () => ({
  ClerkProvider: ({
    children,
    publishableKey,
  }: {
    children: ReactNode;
    publishableKey: string;
  }) => (
    <div data-testid="clerk-provider" data-publishable-key={publishableKey}>
      {children}
    </div>
  ),
  ClerkLoading: ({ children }: { children: ReactNode }) =>
    clerk.state === "loading" ? children : null,
  ClerkLoaded: ({ children }: { children: ReactNode }) =>
    clerk.state === "signed-out" || clerk.state === "signed-in"
      ? children
      : null,
  ClerkFailed: ({ children }: { children: ReactNode }) =>
    clerk.state === "failed" ? children : null,
  Show: ({
    children,
    when,
  }: {
    children: ReactNode;
    when: "signed-in" | "signed-out";
  }) => (clerk.state === when ? children : null),
  SignInButton: ({
    children,
    mode,
    fallbackRedirectUrl,
  }: {
    children: ReactNode;
    mode: string;
    fallbackRedirectUrl?: string;
  }) => (
    <div
      data-sign-in-mode={mode}
      data-fallback-redirect-url={fallbackRedirectUrl}
    >
      {children}
    </div>
  ),
  SignUpButton: ({
    children,
    mode,
  }: {
    children: ReactNode;
    mode: string;
  }) => <div data-sign-up-mode={mode}>{children}</div>,
  UserButton: () => <button aria-label="Open account menu" type="button" />,
  useAuth: () => ({ userId: "user_test", sessionId: "session_test" }),
}));

/**
 * Mirrors how the app consumes AuthShell: page content plus the account
 * status block rendered through AuthStatusSlot (in the real app it mounts
 * inside the sidebar).
 */
function AppStub() {
  return (
    <main>
      Subgraph app
      <AuthStatusSlot />
    </main>
  );
}

function MarketingActionStub() {
  return (
    <nav aria-label="Account navigation">
      <AuthActionSlot />
    </nav>
  );
}

describe("AuthShell", () => {
  beforeEach(() => {
    clerk.state = "signed-out";
  });

  it.each([undefined, "", "   "])(
    "stays in guest-demo mode without a usable Clerk key (%s)",
    (publishableKey) => {
      render(
        <AuthShell publishableKey={publishableKey}>
          <AppStub />
        </AuthShell>,
      );

      expect(screen.getByRole("main")).toHaveTextContent("Subgraph app");
      expect(screen.getByText("Starter inventory")).toBeVisible();
      expect(screen.getByText(/ready-to-use household inventory/i)).toBeVisible();
      expect(screen.queryByTestId("clerk-provider")).not.toBeInTheDocument();
    },
  );

  it("offers modal sign-in and sign-up while keeping the starter inventory visible", () => {
    const { container } = render(
      <AuthShell publishableKey="  pk_test_example  ">
        <AppStub />
      </AuthShell>,
    );

    expect(screen.getByTestId("clerk-provider")).toHaveAttribute(
      "data-publishable-key",
      "pk_test_example",
    );
    expect(screen.getByText("Starter inventory")).toBeVisible();
    expect(screen.getByText(/items in your own home/i)).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Sign up" })).toBeVisible();
    expect(container.querySelector("[data-sign-in-mode='modal']")).not.toBeNull();
    expect(container.querySelector("[data-sign-up-mode='modal']")).not.toBeNull();
    expect(screen.getByRole("main")).toBeVisible();
  });

  it("exposes a working sign-in action to the marketing navigation", () => {
    const { container } = render(
      <AuthShell publishableKey="pk_test_example">
        <MarketingActionStub />
      </AuthShell>,
    );

    expect(screen.getByRole("button", { name: "Sign in" })).toBeVisible();
    expect(container.querySelector("[data-sign-in-mode='modal']")).toHaveAttribute(
      "data-fallback-redirect-url",
      "/graph",
    );
  });

  it("shows the live state and account control for a signed-in user", () => {
    clerk.state = "signed-in";

    render(
      <AuthShell publishableKey="pk_test_example">
        <AppStub />
      </AuthShell>,
    );

    expect(screen.getByText("Your account")).toBeVisible();
    expect(screen.getByText("Account")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Open account menu" }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: "Sign in" })).not.toBeInTheDocument();
    expect(screen.getByRole("main")).toBeVisible();
  });

  it("keeps the app visible while Clerk is loading", () => {
    clerk.state = "loading";

    render(
      <AuthShell publishableKey="pk_test_example">
        <AppStub />
      </AuthShell>,
    );

    expect(screen.getByText("Checking account")).toBeVisible();
    expect(screen.getByRole("main")).toBeVisible();
  });

  it("keeps the starter inventory available if Clerk fails to load", () => {
    clerk.state = "failed";

    render(
      <AuthShell publishableKey="pk_test_example">
        <AppStub />
      </AuthShell>,
    );

    expect(screen.getByText("Starter inventory")).toBeVisible();
    expect(screen.getByText(/account access is temporarily unavailable/i)).toBeVisible();
    expect(screen.getByRole("main")).toBeVisible();
  });
});
