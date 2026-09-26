import { describe, expect, it } from "vitest";
import { generateSyntheticDataset } from "./synthetic";

describe("generateSyntheticDataset", () => {
  it("is reproducible from a seed", () => {
    const options = { template: "wellbeing" as const, rows: 40, seed: 42, effect: 0.6, noise: 1, missingness: 0, groups: 2, variables: [] };
    const first = generateSyntheticDataset(options);
    const second = generateSyntheticDataset(options);
    expect(first.rows).toEqual(second.rows);
  });

  it("clamps unsafe sample sizes and labels provenance", () => {
    const dataset = generateSyntheticDataset({ template: "survey", rows: 4, seed: 7, effect: 0.4, noise: 1, missingness: 0, groups: 2, variables: [] });
    expect(dataset.rows).toHaveLength(20);
    expect(dataset.provenance?.kind).toBe("synthetic");
  });

  it("supports each study template", () => {
    for (const template of ["wellbeing", "clinical", "regression", "survey"] as const) {
      const dataset = generateSyntheticDataset({ template, rows: 30, seed: 9, effect: 0.5, noise: 1, missingness: 0.05, groups: 3, variables: [] });
      expect(dataset.rows).toHaveLength(30);
      expect(dataset.variables.length).toBeGreaterThanOrEqual(5);
      expect(dataset.provenance?.generator).toContain(template);
    }
  });

  it("generates a user-defined schema", () => {
    const dataset = generateSyntheticDataset({
      template: "custom",
      rows: 25,
      seed: 11,
      effect: 0,
      noise: 1,
      missingness: 0,
      groups: 2,
      variables: [
        { id: "id", name: "case_id", type: "identifier", distribution: "uniform", mean: 0, spread: 1, min: 1, max: 25, categories: [] },
        { id: "x", name: "temperature", type: "continuous", distribution: "normal", mean: 20, spread: 2, min: 10, max: 30, categories: [] },
        { id: "g", name: "site", type: "categorical", distribution: "uniform", mean: 0, spread: 1, min: 0, max: 1, categories: ["east", "west"] },
      ],
    });
    expect(dataset.variables.map((variable) => variable.name)).toEqual(["case_id", "temperature", "site"]);
    expect(dataset.rows[0]).toHaveProperty("temperature");
  });

  it("rejects ambiguous custom schemas", () => {
    expect(() => generateSyntheticDataset({
      template: "custom",
      rows: 25,
      seed: 3,
      effect: 0,
      noise: 1,
      missingness: 0,
      groups: 2,
      variables: [
        { id: "a", name: "score", type: "continuous", distribution: "normal", mean: 0, spread: 1, min: -2, max: 2, categories: [] },
        { id: "b", name: "score", type: "continuous", distribution: "normal", mean: 0, spread: 1, min: -2, max: 2, categories: [] },
      ],
    })).toThrow("unique");
  });
});
