import { describe, expect, it } from "vitest";
import { datasetToR } from "./rCode";
import type { Dataset } from "../types";

describe("datasetToR", () => {
  it("serialises values without treating text as code", () => {
    const dataset: Dataset = {
      name: "hostile labels",
      rows: [{ 'name"); stop("x': 'a"); system("bad")' }],
      variables: [{
        id: "x",
        name: 'name"); stop("x',
        label: "x",
        kind: "nominal",
        missing: 0,
        unique: 1,
      }],
    };
    const code = datasetToR(dataset);
    expect(code).toContain('\\"');
    expect(code).toContain("structure(");
  });

  it("sends inferred continuous CSV columns to R as numbers and preserves identifiers", () => {
    const dataset: Dataset = {
      name: "numeric.csv",
      rows: [{ participant_id: "001", score: "1.5" }, { participant_id: "002", score: "3" }],
      variables: [
        { id: "id", name: "participant_id", label: "participant id", kind: "identifier", missing: 0, unique: 2 },
        { id: "score", name: "score", label: "score", kind: "continuous", missing: 0, unique: 2 },
      ],
    };
    const code = datasetToR(dataset);
    expect(code).toContain('c("001", "002")');
    expect(code).toContain("c(1.5, 3)");
  });

  it("reports invalid numeric CSV cells instead of silently changing the analysis", () => {
    const dataset: Dataset = {
      name: "invalid.csv",
      rows: [{ score: "unrecorded" }],
      variables: [{ id: "score", name: "score", label: "score", kind: "continuous", missing: 0, unique: 1 }],
    };
    expect(() => datasetToR(dataset)).toThrow("Column score, row 1");
  });
});
