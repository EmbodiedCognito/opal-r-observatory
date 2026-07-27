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
});
