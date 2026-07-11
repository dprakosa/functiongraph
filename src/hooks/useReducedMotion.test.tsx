import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useReducedMotion } from "./useReducedMotion";

describe("useReducedMotion", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("tracks runtime matchMedia changes and removes the same listener on cleanup", () => {
    let changeListener: ((event: MediaQueryListEvent) => void) | undefined;
    const addEventListener = vi.fn(
      (_type: string, listener: EventListenerOrEventListenerObject) => {
        changeListener = listener as (event: MediaQueryListEvent) => void;
      },
    );
    const removeEventListener = vi.fn();
    const mediaQuery = {
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener,
      removeEventListener,
      dispatchEvent: vi.fn(() => false),
    } as MediaQueryList;
    const matchMedia = vi.spyOn(window, "matchMedia").mockReturnValue(mediaQuery);

    const { result, unmount } = renderHook(() => useReducedMotion());

    expect(result.current).toBe(false);
    expect(matchMedia).toHaveBeenCalledWith("(prefers-reduced-motion: reduce)");
    expect(addEventListener).toHaveBeenCalledOnce();
    expect(addEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    expect(changeListener).toBeDefined();

    act(() => changeListener?.({ matches: true } as MediaQueryListEvent));
    expect(result.current).toBe(true);

    act(() => changeListener?.({ matches: false } as MediaQueryListEvent));
    expect(result.current).toBe(false);

    const registeredListener = changeListener;
    unmount();
    expect(removeEventListener).toHaveBeenCalledOnce();
    expect(removeEventListener).toHaveBeenCalledWith(
      "change",
      registeredListener,
    );
  });
});
