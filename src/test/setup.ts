import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

// Tests must not inherit a live database from the shell (DATABASE_URL doubles
// as the ALG-2 embedding-cache switch); suites opt in via vi.stubEnv, and the
// integration runner re-sets it after this file runs.
// setup.ts compiles under the browser tsconfig, so reach process via globalThis.
const nodeProcess = (
  globalThis as { process?: { env: Record<string, string | undefined> } }
).process;
if (nodeProcess) {
  delete nodeProcess.env.DATABASE_URL;
}

class ResizeObserverMock implements ResizeObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];

  disconnect() {}

  observe() {}

  unobserve() {}

  takeRecords(): ResizeObserverEntry[] {
    return [];
  }
}

Object.defineProperty(globalThis, "ResizeObserver", {
  value: ResizeObserverMock,
  configurable: true,
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});
