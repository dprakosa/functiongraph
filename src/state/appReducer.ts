import { KG_PER_DOLLAR } from "../lib/copy";
import type { RouteResult } from "../lib/route";
import type { EvaluateResult } from "../lib/types";

/**
 * SM-1: one reducer owns the app. Phases run
 * resting → extracting → scanning → routing (sub-beat) → settling → verdict;
 * every animation is a phase change plus the simulation reacting.
 */
export type Phase =
  | "resting"
  | "extracting"
  | "scanning"
  | "routing"
  | "settling"
  | "verdict";

export type View = { level: "home" } | { level: "room"; domain: string };

export interface Impact {
  dollarsKept: number;
  kgAvoided: number;
}

export interface AppState {
  phase: Phase;
  view: View;
  pendingText: string | null;
  result: EvaluateResult | null;
  route: RouteResult | null;
  revealedChips: number;
  /** Settling sub-beat: camera enters the room before ghost evidence appears. */
  evidenceVisible: boolean;
  expandedItemId: string | null;
  pulsingSlug: string | null;
  stillNeedItOpen: boolean;
  reason: string;
  error: { error: string; hint: string } | null;
  toast: string | null;
  impact: Impact;
}

export type AppAction =
  | { type: "EVALUATE_START"; text: string }
  | {
      type: "EVALUATE_SUCCESS";
      result: EvaluateResult;
      route: RouteResult;
      reducedMotion: boolean;
    }
  | { type: "EVALUATE_FAILURE"; error: string; hint: string }
  | { type: "CHIP_REVEALED" }
  | { type: "SCAN_STARTED" }
  | { type: "ROUTE_SHOWN" }
  | { type: "DIVE_STARTED" }
  | { type: "EVIDENCE_REVEALED" }
  | { type: "VERDICT_SHOWN" }
  | { type: "REDUCED_MOTION_ENABLED" }
  | { type: "ROW_PULSED"; capSlug: string }
  | { type: "PULSE_ENDED" }
  | { type: "ITEM_TOGGLED"; itemId: string }
  | { type: "ROOM_ENTERED"; domain: string }
  | { type: "WENT_HOME" }
  | { type: "PURCHASE_SKIPPED" }
  | { type: "STILL_NEEDED" }
  | { type: "REASON_CHANGED"; reason: string }
  | { type: "BOUGHT_ANYWAY" }
  | { type: "ERROR_DISMISSED" }
  | { type: "UNSCANNED_TAPPED"; message: string }
  | { type: "TOAST_CLEARED" };

export function initialState(impact: Impact): AppState {
  return {
    phase: "resting",
    view: { level: "home" },
    pendingText: null,
    result: null,
    route: null,
    revealedChips: 0,
    evidenceVisible: false,
    expandedItemId: null,
    pulsingSlug: null,
    stillNeedItOpen: false,
    reason: "",
    error: null,
    toast: null,
    impact,
  };
}

/** Clear one evaluation, keep view + impact. */
function clearedEvaluation(state: AppState): AppState {
  return {
    ...state,
    phase: "resting",
    pendingText: null,
    result: null,
    route: null,
    revealedChips: 0,
    evidenceVisible: false,
    pulsingSlug: null,
    stillNeedItOpen: false,
    reason: "",
  };
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "EVALUATE_START":
      return {
        ...clearedEvaluation(state),
        pendingText: action.text,
        error: null,
        expandedItemId: null,
      };

    case "EVALUATE_SUCCESS": {
      // SM-2: the full result arrived before any choreography begins.
      const base: AppState = {
        ...state,
        pendingText: null,
        result: action.result,
        route: action.route,
        error: null,
        expandedItemId: null,
        pulsingSlug: null,
        stillNeedItOpen: false,
        reason: "",
        view: { level: "home" },
        revealedChips: 0,
        evidenceVisible: false,
        phase: "extracting",
      };
      if (action.reducedMotion) {
        // SM-9: skip choreography straight to verdict.
        return {
          ...base,
          phase: "verdict",
          revealedChips: action.result.capabilities.length,
          evidenceVisible: true,
          view: action.route.domain
            ? { level: "room", domain: action.route.domain }
            : { level: "home" },
        };
      }
      return base;
    }

    case "EVALUATE_FAILURE":
      return {
        ...clearedEvaluation(state),
        error: { error: action.error, hint: action.hint },
      };

    case "CHIP_REVEALED":
      return state.phase === "extracting"
        ? { ...state, revealedChips: state.revealedChips + 1 }
        : state;

    case "SCAN_STARTED":
      return state.phase === "extracting" ? { ...state, phase: "scanning" } : state;

    case "ROUTE_SHOWN":
      return state.phase === "scanning" ? { ...state, phase: "routing" } : state;

    case "DIVE_STARTED":
      return state.phase === "routing" && state.route?.domain
        ? {
            ...state,
            phase: "settling",
            view: { level: "room", domain: state.route.domain },
            evidenceVisible: false,
          }
        : state;

    case "EVIDENCE_REVEALED":
      return state.phase === "settling"
        ? { ...state, evidenceVisible: true }
        : state;

    case "VERDICT_SHOWN":
      return state.phase === "routing" || state.phase === "settling"
        ? { ...state, phase: "verdict", evidenceVisible: true }
        : state;

    case "REDUCED_MOTION_ENABLED":
      // SM-9 also applies when the preference changes during an active beat:
      // reveal the already-fetched result immediately instead of leaving a
      // timer-driven phase paused indefinitely.
      return state.result && state.phase !== "resting" && state.phase !== "verdict"
        ? {
            ...state,
            phase: "verdict",
            revealedChips: state.result.capabilities.length,
            evidenceVisible: true,
            view: state.route?.domain
              ? { level: "room", domain: state.route.domain }
              : { level: "home" },
          }
        : state;

    case "ROW_PULSED":
      return { ...state, pulsingSlug: action.capSlug };

    case "PULSE_ENDED":
      return { ...state, pulsingSlug: null };

    case "ITEM_TOGGLED":
      // INT-5: bloom unique capabilities, one expansion at a time.
      return {
        ...state,
        expandedItemId:
          state.expandedItemId === action.itemId ? null : action.itemId,
      };

    case "ROOM_ENTERED":
      return state.phase === "resting"
        ? { ...state, view: { level: "room", domain: action.domain }, expandedItemId: null }
        : state;

    case "WENT_HOME":
      return {
        ...clearedEvaluation(state),
        view: { level: "home" },
        expandedItemId: null,
        toast: null,
      };

    case "PURCHASE_SKIPPED": {
      const price = state.result?.price ?? 0;
      return {
        ...clearedEvaluation(state),
        impact: {
          dollarsKept: state.impact.dollarsKept + price,
          kgAvoided: state.impact.kgAvoided + price * KG_PER_DOLLAR,
        },
      };
    }

    case "STILL_NEEDED":
      return { ...state, stillNeedItOpen: true };

    case "REASON_CHANGED":
      return { ...state, reason: action.reason };

    case "BOUGHT_ANYWAY":
      return clearedEvaluation(state);

    case "ERROR_DISMISSED":
      return { ...state, error: null };

    case "UNSCANNED_TAPPED":
      return { ...state, toast: action.message };

    case "TOAST_CLEARED":
      return { ...state, toast: null };

    default:
      return state;
  }
}
