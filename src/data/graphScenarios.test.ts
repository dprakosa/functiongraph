import { describe, expect, it } from "vitest";
import { graphScenarios } from "./graphScenarios";

describe("graph scenarios", () => {
  it("provides all three product comparisons with valid links", () => {
    expect(graphScenarios.map((scenario) => scenario.id)).toEqual([
      "air-fryer",
      "vegetable-chopper",
      "pressure-cooker",
    ]);

    graphScenarios.forEach((scenario) => {
      const nodeIds = new Set(scenario.nodes.map((node) => node.id));
      expect(nodeIds.has(scenario.candidateId)).toBe(true);
      expect(scenario.edges.length).toBeGreaterThan(0);
      scenario.edges.forEach((edge) => {
        expect(nodeIds.has(edge.source)).toBe(true);
        expect(nodeIds.has(edge.target)).toBe(true);
      });
    });
  });

  it("marks the pressure-cooker capabilities as genuinely uncovered", () => {
    const scenario = graphScenarios.find((item) => item.id === "pressure-cooker");
    const uncoveredLabels = scenario?.nodes
      .filter((node) => node.status === "uncovered")
      .map((node) => node.label);

    expect(uncoveredLabels).toEqual(["Pressure cooking", "Rapid tenderising"]);
    expect(scenario?.metrics.overlapScore).toBe(58);
  });
});
