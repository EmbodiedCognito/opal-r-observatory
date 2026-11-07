import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { WebR } from "webr";
import { proposalFor, recommendAnalyses } from "../domain/recommend";
import type { Dataset } from "../types";
import { wrapForConsole } from "./rCode";

it("captures descriptive statistics and missing counts from the generated plan in webR", async () => {
  const dataset: Dataset = {
    name: "describe regression",
    rows: [{ score: 1 }, { score: 3 }, { score: null }],
    variables: [{ id: "score", name: "score", label: "Score", kind: "continuous", missing: 1, unique: 2 }],
  };
  const analysis = recommendAnalyses(dataset).find((item) => item.id === "describe")!;
  const baseUrl = fileURLToPath(new URL("../../node_modules/webr/dist/", import.meta.url));
  const runtime = new WebR({ baseUrl, repoUrl: baseUrl, createLazyFilesystem: false });
  try {
    await runtime.init();
    const output = await runtime.evalRString(wrapForConsole(dataset, proposalFor(analysis, dataset).rCode));
    expect(output).toMatch(/Mean\s*:\s*2/);
    expect(output).toMatch(/NA'?s\s*:\s*1/);
    expect(output).toMatch(/score\s*\n\s*1\s*$/);
    expect(output.match(/Mean/g)).toHaveLength(1);
  } finally {
    runtime.close();
  }
}, 30_000);
