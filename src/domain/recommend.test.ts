import { describe, expect, it } from "vitest";
import { inferVariable, recommendAnalyses } from "./recommend";
import type { Dataset } from "../types";

describe("inferVariable", () => {
  it("recognises continuous and identifier variables", () => {
    expect(inferVariable("score", [1, 2, 3, 4, 5, 6, 7, 8, 9]).kind).toBe("continuous");
    expect(inferVariable("participant_id", ["a", "b", "c"]).kind).toBe("identifier");
  });

  it("counts missing observations", () => {
    expect(inferVariable("group", ["control", "", null, "treatment"]).missing).toBe(2);
  });
});

describe("recommendAnalyses", () => {
  it("recommends relationship and group methods from measurement types", () => {
    const dataset: Dataset = {
      name: "test",
      rows: [],
      variables: [
        { id: "x", name: "x", label: "x", kind: "continuous", missing: 0, unique: 20 },
        { id: "y", name: "y", label: "y", kind: "continuous", missing: 0, unique: 20 },
        { id: "g", name: "g", label: "g", kind: "nominal", missing: 0, unique: 2 },
      ],
    };
    const ids = recommendAnalyses(dataset).map((analysis) => analysis.id);
    expect(ids).toEqual(["describe", "correlation", "t-test", "anova", "regression"]);
  });
});
