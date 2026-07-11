import { useEffect, type Dispatch } from "react";
import type { AppAction, AppState } from "./appReducer";

/**
 * SM-3 timing table. Defaults — tune rhythm, preserve order.
 * Normative values; changes need human sign-off (PDD change control).
 */
export const TIMINGS = {
  chipStagger: 320,
  chipToScanPause: 260,
  scanDuration: 900,
  toastHold: 600,
  cameraMs: 800,
  settleMs: 1500,
  panelMs: 300,
  pulseMs: 2000,
} as const;

/**
 * Drives the four beats as timed phase changes (SM-1); all pacing is
 * client-side reveal over an already-complete result (SM-2).
 */
export function useBeats(
  state: AppState,
  dispatch: Dispatch<AppAction>,
  reducedMotion: boolean,
) {
  const { phase, revealedChips, result, route, pulsingSlug } = state;

  useEffect(() => {
    if (reducedMotion) return; // SM-9: EVALUATE_SUCCESS already jumped to verdict.
    const schedule = (ms: number, action: AppAction) => {
      const id = window.setTimeout(() => dispatch(action), ms);
      return () => window.clearTimeout(id);
    };

    switch (phase) {
      case "extracting": {
        const total = result?.capabilities.length ?? 0;
        if (revealedChips < total) {
          return schedule(TIMINGS.chipStagger, { type: "CHIP_REVEALED" });
        }
        return schedule(TIMINGS.chipToScanPause, { type: "SCAN_STARTED" });
      }
      case "scanning":
        return schedule(TIMINGS.scanDuration, { type: "ROUTE_SHOWN" });
      case "routing":
        // SM-5: the toast holds 600 ms before any camera motion.
        return schedule(
          TIMINGS.toastHold,
          route?.domain ? { type: "DIVE_STARTED" } : { type: "VERDICT_SHOWN" },
        );
      case "settling":
        return schedule(TIMINGS.cameraMs + TIMINGS.settleMs, {
          type: "VERDICT_SHOWN",
        });
      default:
        return undefined;
    }
  }, [dispatch, phase, reducedMotion, result, revealedChips, route]);

  // INT-6: a pulse lasts ≤ 2 s (cosmetic only — never reheats physics, SM-8).
  useEffect(() => {
    if (!pulsingSlug) return undefined;
    const id = window.setTimeout(
      () => dispatch({ type: "PULSE_ENDED" }),
      TIMINGS.pulseMs,
    );
    return () => window.clearTimeout(id);
  }, [dispatch, pulsingSlug]);
}
