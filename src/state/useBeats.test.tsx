import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RouteResult } from "../lib/route";
import type { EvaluateResult } from "../lib/types";
import { initialState, type AppAction, type AppState } from "./appReducer";
import { TIMINGS, useBeats } from "./useBeats";

const RESULT: EvaluateResult = {
  name: "Mini camera drone",
  price: 89,
  capabilities: [
    { name: "captures aerial photos", tier: "primary" },
    { name: "hovers in place", tier: "secondary" },
  ],
  verdict: {
    coverage: 0,
    coveredCount: 0,
    totalCount: 2,
    rows: [],
    newCapabilities: ["captures aerial photos", "hovers in place"],
    pricePerNewCapability: 45,
  },
  altSuggestion: null,
  cached: true,
};

const NO_MATCH_ROUTE: RouteResult = {
  domain: null,
  matchesInRoom: 0,
  totalCount: 2,
};

function stateFor(
  phase: AppState["phase"],
  overrides: Partial<AppState> = {},
): AppState {
  return {
    ...initialState({ dollarsKept: 0, kgAvoided: 0 }),
    phase,
    result: RESULT,
    route: NO_MATCH_ROUTE,
    ...overrides,
  };
}

describe("useBeats", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("sends a no-match route directly to verdict after the 600 ms toast hold", () => {
    const dispatch = vi.fn<(action: AppAction) => void>();
    const state = stateFor("routing");
    renderHook(() => useBeats(state, dispatch, false));

    expect(TIMINGS.toastHold).toBe(600);
    act(() => vi.advanceTimersByTime(599));
    expect(dispatch).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith({ type: "VERDICT_SHOWN" });
    expect(dispatch).not.toHaveBeenCalledWith({ type: "DIVE_STARTED" });
  });

  it("completes the camera beat before revealing evidence and settling", () => {
    const dispatch = vi.fn<(action: AppAction) => void>();
    const route = { domain: "kitchen", matchesInRoom: 1, totalCount: 2 };
    const cameraState = stateFor("settling", {
      route,
      view: { level: "room", domain: "kitchen" },
      evidenceVisible: false,
    });
    const { rerender } = renderHook(
      ({ state }) => useBeats(state, dispatch, false),
      { initialProps: { state: cameraState } },
    );

    act(() => vi.advanceTimersByTime(TIMINGS.cameraMs - 1));
    expect(dispatch).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(dispatch).toHaveBeenCalledWith({ type: "EVIDENCE_REVEALED" });

    dispatch.mockClear();
    rerender({ state: { ...cameraState, evidenceVisible: true } });
    act(() => vi.advanceTimersByTime(TIMINGS.settleMs - 1));
    expect(dispatch).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(dispatch).toHaveBeenCalledWith({ type: "VERDICT_SHOWN" });
  });

  it("ends a row pulse no later than two seconds", () => {
    const dispatch = vi.fn<(action: AppAction) => void>();
    const state = stateFor("verdict", { pulsingSlug: "bakes-food" });
    renderHook(() => useBeats(state, dispatch, false));

    expect(TIMINGS.pulseMs).toBeLessThanOrEqual(2_000);
    act(() => vi.advanceTimersByTime(TIMINGS.pulseMs - 1));
    expect(dispatch).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith({ type: "PULSE_ENDED" });
  });

  it("cancels pending choreography when reduced motion becomes active", () => {
    const dispatch = vi.fn<(action: AppAction) => void>();
    const state = stateFor("routing", {
      route: { domain: "kitchen", matchesInRoom: 1, totalCount: 2 },
    });
    const { rerender } = renderHook(
      ({ reducedMotion }) => useBeats(state, dispatch, reducedMotion),
      { initialProps: { reducedMotion: false } },
    );

    rerender({ reducedMotion: true });
    act(() => vi.advanceTimersByTime(TIMINGS.toastHold));
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("cleans up pulse timers on unmount", () => {
    const dispatch = vi.fn<(action: AppAction) => void>();
    const state = stateFor("verdict", { pulsingSlug: "bakes-food" });
    const { unmount } = renderHook(() => useBeats(state, dispatch, false));

    unmount();
    act(() => vi.advanceTimersByTime(TIMINGS.pulseMs));
    expect(dispatch).not.toHaveBeenCalled();
  });
});
