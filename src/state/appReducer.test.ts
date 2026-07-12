import { describe, expect, it } from "vitest";
import type { RouteResult } from "../lib/route";
import type { EvaluateResult } from "../lib/types";
import {
  appReducer,
  initialState,
  type AppState,
} from "./appReducer";

const RESULT: EvaluateResult = {
  name: "Convection countertop oven",
  price: 129,
  capabilities: [
    { name: "bakes food", tier: "primary" },
    { name: "roasts large meals", tier: "secondary" },
  ],
  verdict: {
    coverage: 0.5,
    coveredCount: 1,
    totalCount: 2,
    rows: [
      {
        capability: "bakes food",
        capSlug: "bakes-food",
        tier: "primary",
        covered: true,
        bestCoverer: "Toaster oven",
        covererCount: 2,
        weight: 0.5,
      },
      {
        capability: "roasts large meals",
        capSlug: "roasts-large-meals",
        tier: "secondary",
        covered: false,
        bestCoverer: null,
        covererCount: 0,
        weight: 0.4,
      },
    ],
    newCapabilities: ["roasts large meals"],
    pricePerNewCapability: 129,
  },
  altSuggestion: "Buy a secondhand roasting pan.",
  cached: true,
};

const MATCHED_ROUTE: RouteResult = {
  domain: "kitchen",
  matchesInRoom: 1,
  totalCount: 2,
};

const NO_MATCH_ROUTE: RouteResult = {
  domain: null,
  matchesInRoom: 0,
  totalCount: 2,
};

function evaluatedState(route = MATCHED_ROUTE): AppState {
  return appReducer(initialState(), {
    type: "EVALUATE_SUCCESS",
    result: RESULT,
    route,
    reducedMotion: false,
  });
}

describe("appReducer", () => {
  it("walks the normal evaluation, dive, verdict, and row-pulse transitions", () => {
    const initial = initialState();
    const started = appReducer(initial, {
      type: "EVALUATE_START",
      text: "countertop oven",
    });
    expect(started).toMatchObject({
      phase: "resting",
      pendingText: "countertop oven",
      result: null,
      error: null,
    });

    const extracting = appReducer(started, {
      type: "EVALUATE_SUCCESS",
      result: RESULT,
      route: MATCHED_ROUTE,
      reducedMotion: false,
    });
    expect(extracting).toMatchObject({
      phase: "extracting",
      pendingText: null,
      result: RESULT,
      route: MATCHED_ROUTE,
      revealedChips: 0,
      view: { level: "home" },
    });

    const revealed = appReducer(extracting, { type: "CHIP_REVEALED" });
    expect(revealed.revealedChips).toBe(1);

    const scanning = appReducer(revealed, { type: "SCAN_STARTED" });
    expect(scanning.phase).toBe("scanning");

    const routing = appReducer(scanning, { type: "ROUTE_SHOWN" });
    expect(routing.phase).toBe("routing");
    expect(routing.view).toEqual({ level: "home" });

    const settling = appReducer(routing, { type: "DIVE_STARTED" });
    expect(settling.phase).toBe("settling");
    expect(settling.view).toEqual({ level: "room", domain: "kitchen" });
    expect(settling.evidenceVisible).toBe(false);

    const withEvidence = appReducer(settling, { type: "EVIDENCE_REVEALED" });
    expect(withEvidence.phase).toBe("settling");
    expect(withEvidence.evidenceVisible).toBe(true);

    const verdict = appReducer(withEvidence, { type: "VERDICT_SHOWN" });
    expect(verdict.phase).toBe("verdict");

    const pulsing = appReducer(verdict, {
      type: "ROW_PULSED",
      capSlug: "bakes-food",
    });
    expect(pulsing.pulsingSlug).toBe("bakes-food");
    expect(appReducer(pulsing, { type: "PULSE_ENDED" }).pulsingSlug).toBeNull();
  });

  it("jumps directly to the correct verdict view under reduced motion", () => {
    const matched = appReducer(initialState(), {
      type: "EVALUATE_SUCCESS",
      result: RESULT,
      route: MATCHED_ROUTE,
      reducedMotion: true,
    });
    expect(matched).toMatchObject({
      phase: "verdict",
      revealedChips: RESULT.capabilities.length,
      evidenceVisible: true,
      view: { level: "room", domain: "kitchen" },
    });

    const noMatch = appReducer(initialState(), {
      type: "EVALUATE_SUCCESS",
      result: RESULT,
      route: NO_MATCH_ROUTE,
      reducedMotion: true,
    });
    expect(noMatch).toMatchObject({
      phase: "verdict",
      revealedChips: RESULT.capabilities.length,
      evidenceVisible: true,
      view: { level: "home" },
    });
  });

  it("finishes an active routed or no-match beat when reduced motion is enabled at runtime", () => {
    const routedActive: AppState = {
      ...evaluatedState(MATCHED_ROUTE),
      phase: "scanning",
      revealedChips: 1,
    };
    expect(
      appReducer(routedActive, { type: "REDUCED_MOTION_ENABLED" }),
    ).toMatchObject({
      phase: "verdict",
      revealedChips: RESULT.capabilities.length,
      view: { level: "room", domain: "kitchen" },
    });

    const noMatchActive: AppState = {
      ...evaluatedState(NO_MATCH_ROUTE),
      phase: "routing",
      revealedChips: RESULT.capabilities.length,
      view: { level: "home" },
    };
    expect(
      appReducer(noMatchActive, { type: "REDUCED_MOTION_ENABLED" }),
    ).toMatchObject({
      phase: "verdict",
      revealedChips: RESULT.capabilities.length,
      view: { level: "home" },
    });

    const resting = initialState();
    expect(
      appReducer(resting, { type: "REDUCED_MOTION_ENABLED" }),
    ).toBe(resting);
  });

  it("skips settling for a no-match route and guards invalid phase transitions", () => {
    const routing: AppState = {
      ...evaluatedState(NO_MATCH_ROUTE),
      phase: "routing",
      view: { level: "home" },
    };

    expect(appReducer(routing, { type: "DIVE_STARTED" })).toBe(routing);
    expect(appReducer(routing, { type: "VERDICT_SHOWN" })).toMatchObject({
      phase: "verdict",
      view: { level: "home" },
    });

    const resting = initialState();
    expect(appReducer(resting, { type: "SCAN_STARTED" })).toBe(resting);
    expect(appReducer(resting, { type: "ROUTE_SHOWN" })).toBe(resting);
    expect(appReducer(resting, { type: "EVIDENCE_REVEALED" })).toBe(resting);
    expect(appReducer(resting, { type: "VERDICT_SHOWN" })).toBe(resting);
  });

  it("enters rooms only at rest, toggles one item expansion at a time, and goes home", () => {
    const initial = initialState();
    const room = appReducer(initial, {
      type: "ROOM_ENTERED",
      domain: "kitchen",
    });
    expect(room.view).toEqual({ level: "room", domain: "kitchen" });

    const firstExpanded = appReducer(room, {
      type: "ITEM_TOGGLED",
      itemId: "air-fryer",
    });
    expect(firstExpanded.expandedItemId).toBe("air-fryer");

    const secondExpanded = appReducer(firstExpanded, {
      type: "ITEM_TOGGLED",
      itemId: "microwave",
    });
    expect(secondExpanded.expandedItemId).toBe("microwave");

    const collapsed = appReducer(secondExpanded, {
      type: "ITEM_TOGGLED",
      itemId: "microwave",
    });
    expect(collapsed.expandedItemId).toBeNull();

    const busy = evaluatedState();
    expect(
      appReducer(busy, { type: "ROOM_ENTERED", domain: "electronics" }),
    ).toBe(busy);

    const withNotice: AppState = {
      ...firstExpanded,
      toast: "A notice",
      result: RESULT,
    };
    expect(appReducer(withNotice, { type: "WENT_HOME" })).toMatchObject({
      phase: "resting",
      view: { level: "home" },
      result: null,
      expandedItemId: null,
      toast: null,
    });
  });

  it("opens the reason flow and Buy anyway clears the evaluation without changing view", () => {
    const verdict: AppState = {
      ...evaluatedState(),
      phase: "verdict",
      view: { level: "room", domain: "kitchen" },
    };
    const opened = appReducer(verdict, { type: "STILL_NEEDED" });
    expect(opened.stillNeedItOpen).toBe(true);

    const reasoned = appReducer(opened, {
      type: "REASON_CHANGED",
      reason: "Cooking for a crowd",
    });
    expect(reasoned.reason).toBe("Cooking for a crowd");

    expect(appReducer(reasoned, { type: "BOUGHT_ANYWAY" })).toMatchObject({
      phase: "resting",
      view: { level: "room", domain: "kitchen" },
      result: null,
      stillNeedItOpen: false,
      reason: "",
    });
  });

  it("Skip clears the evaluation and preserves the current room", () => {
    const verdict: AppState = {
      ...evaluatedState(),
      phase: "verdict",
      view: { level: "room", domain: "kitchen" },
    };

    const skipped = appReducer(verdict, { type: "PURCHASE_SKIPPED" });
    expect(skipped).toMatchObject({
      phase: "resting",
      view: { level: "room", domain: "kitchen" },
      result: null,
    });
  });

  it("stores, dismisses, and clears evaluation errors and notices", () => {
    const failed = appReducer(evaluatedState(), {
      type: "EVALUATE_FAILURE",
      error: "evaluation failed",
      hint: "tap an example",
    });
    expect(failed).toMatchObject({
      phase: "resting",
      result: null,
      error: { error: "evaluation failed", hint: "tap an example" },
    });
    expect(appReducer(failed, { type: "ERROR_DISMISSED" }).error).toBeNull();

    const noticed = appReducer(initialState(), {
      type: "UNSCANNED_TAPPED",
      message: "scan this room",
    });
    expect(noticed.toast).toBe("scan this room");
    expect(appReducer(noticed, { type: "TOAST_CLEARED" }).toast).toBeNull();
  });
});
