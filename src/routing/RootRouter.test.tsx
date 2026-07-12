import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RootRouter } from "./RootRouter";

vi.mock("../App", () => ({
  default: function MockGraphPage() {
    return (
      <main aria-labelledby="mock-graph-title">
        <h1 id="mock-graph-title" data-route-heading tabIndex={-1}>
          Mock knowledge graph
        </h1>
      </main>
    );
  },
}));

function setPath(pathname: string) {
  window.history.replaceState({}, "", pathname);
}

describe("RootRouter", () => {
  beforeEach(() => {
    setPath("/");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the landing page on a direct root load", () => {
    render(<RootRouter />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /see what a purchase adds/i,
      }),
    ).toBeVisible();
    expect(document.body).toHaveAttribute("data-route", "landing");
  });

  it.each(["/graph", "/graph/"])(
    "renders the graph page on a direct %s load",
    (pathname) => {
      setPath(pathname);

      render(<RootRouter />);

      expect(
        screen.getByRole("heading", {
          level: 1,
          name: "Mock knowledge graph",
        }),
      ).toBeVisible();
      expect(document.body).toHaveAttribute("data-route", "graph");
    },
  );

  it("keeps the primary CTA as an ordinary link and enhances it with pushState", async () => {
    const user = userEvent.setup();
    const pushState = vi.spyOn(window.history, "pushState");
    render(<RootRouter />);

    const cta = screen.getByRole("link", { name: /^check a product$/i });
    expect(cta).toHaveAttribute("href", "/graph");

    await user.click(cta);

    expect(pushState).toHaveBeenCalledWith({}, "", "/graph");
    expect(window.location.pathname).toBe("/graph");
    const graphHeading = screen.getByRole("heading", {
      level: 1,
      name: "Mock knowledge graph",
    });
    expect(graphHeading).toHaveFocus();
  });

  it("follows Back and Forward popstate navigation and restores heading focus", async () => {
    const user = userEvent.setup();
    render(<RootRouter />);

    await user.click(screen.getByRole("link", { name: /^check a product$/i }));
    expect(window.location.pathname).toBe("/graph");

    act(() => window.history.back());

    const landingHeading = await screen.findByRole("heading", {
      level: 1,
      name: /see what a purchase adds/i,
    });
    await waitFor(() => expect(window.location.pathname).toBe("/"));
    expect(landingHeading).toHaveFocus();

    act(() => window.history.forward());

    const graphHeading = await screen.findByRole("heading", {
      level: 1,
      name: "Mock knowledge graph",
    });
    await waitFor(() => expect(window.location.pathname).toBe("/graph"));
    expect(graphHeading).toHaveFocus();
  });

  it.each([
    ["/inventory", "inventory", "Your inventory"],
    ["/history", "history", "Decision history"],
    ["/settings", "settings", "Settings"],
  ])(
    "renders the %s app page inside the app shell",
    (pathname, route, heading) => {
      setPath(pathname);

      render(<RootRouter />);

      expect(
        screen.getByRole("heading", { level: 1, name: heading }),
      ).toBeVisible();
      expect(document.body).toHaveAttribute("data-route", route);
      expect(
        screen.getByRole("navigation", { name: "Application" }),
      ).toBeVisible();
    },
  );

  it("renders an accessible not-found page with links to both known routes", () => {
    setPath("/missing/place");
    render(<RootRouter />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "This page is not in the graph.",
      }),
    ).toBeVisible();
    expect(screen.getByText("/missing/place")).toBeVisible();

    const destinations = screen.getByRole("navigation", {
      name: "Not found destinations",
    });
    expect(
      within(destinations).getByRole("link", { name: "Go to the landing page" }),
    ).toHaveAttribute("href", "/");
    expect(
      within(destinations).getByRole("link", {
        name: "Open the knowledge graph",
      }),
    ).toHaveAttribute("href", "/graph");
  });
});
