import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(cleanup);

// Tests must not inherit a live vector-store configuration from the shell
// (PINECONE_API_KEY is common ambient state); suites opt in via vi.stubEnv.
// setup.ts compiles under the browser tsconfig, so reach process via globalThis.
const nodeProcess = (
  globalThis as { process?: { env: Record<string, string | undefined> } }
).process;
if (nodeProcess) {
  delete nodeProcess.env.PINECONE_API_KEY;
  delete nodeProcess.env.PINECONE_INDEX;
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
