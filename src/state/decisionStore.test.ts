import { beforeEach, describe, expect, it } from "vitest";
import {
  appendDecision,
  clearDecisions,
  readDecisions,
} from "./decisionStore";

const KEY = "functiongraph:decisions:v1";

describe("decisionStore", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns an empty list when nothing is stored", () => {
    expect(readDecisions()).toEqual([]);
  });

  it("appends decisions newest-first with id and timestamp", () => {
    appendDecision({
      product: "Convection countertop oven",
      price: 129,
      coverage: 0.75,
      coveredCount: 4,
      totalCount: 5,
      choice: "skipped",
      reason: null,
    });
    appendDecision({
      product: "Mini camera drone",
      price: 89,
      coverage: 0,
      coveredCount: 0,
      totalCount: 4,
      choice: "bought",
      reason: "aerial shots",
    });

    const decisions = readDecisions();
    expect(decisions).toHaveLength(2);
    expect(decisions[0].product).toBe("Mini camera drone");
    expect(decisions[0].choice).toBe("bought");
    expect(decisions[0].reason).toBe("aerial shots");
    expect(decisions[0].id).toBeTruthy();
    expect(Number.isNaN(Date.parse(decisions[0].decidedAt))).toBe(false);
    expect(decisions[1].product).toBe("Convection countertop oven");
  });

  it("survives corrupted storage payloads", () => {
    window.localStorage.setItem(KEY, "{not json");
    expect(readDecisions()).toEqual([]);

    window.localStorage.setItem(KEY, JSON.stringify([{ bogus: true }, 42]));
    expect(readDecisions()).toEqual([]);
  });

  it("keeps only well-formed entries from mixed payloads", () => {
    const good = {
      id: "a",
      product: "Kettle",
      price: null,
      coverage: 1,
      coveredCount: 3,
      totalCount: 3,
      choice: "skipped",
      reason: null,
      decidedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(KEY, JSON.stringify([good, { bad: 1 }]));
    expect(readDecisions()).toHaveLength(1);
    expect(readDecisions()[0].product).toBe("Kettle");
  });

  it("clears all decisions", () => {
    appendDecision({
      product: "Kettle",
      price: 20,
      coverage: 1,
      coveredCount: 3,
      totalCount: 3,
      choice: "skipped",
      reason: null,
    });
    clearDecisions();
    expect(readDecisions()).toEqual([]);
  });
});
