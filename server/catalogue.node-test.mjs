import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadState, mergeModels, saveState, searchModels, searchRuns } from "./catalogue.mjs";
import { normaliseHfModels } from "./sources/huggingface.mjs";

test("publisher records survive restart and remain searchable without a network", () => {
  const directory = mkdtempSync(join(tmpdir(), "opal-catalogue-"));
  try {
    const first = normaliseHfModels([
      { id: "maker/Small-GGUF", sha: "abc123", tags: ["gguf", "text-generation"], lastModified: "2026-09-25T10:00:00Z" },
      { id: "maker/Other-GGUF", tags: ["gguf", "embeddings"] },
    ], "2026-09-26T00:00:00Z");
    const state = loadState(directory);
    state.models = mergeModels(state.models, first);
    state.runs.push({ id: "r1", model: "maker/Small-GGUF", prompt: "test sine wave", output: "response" });
    saveState(directory, state);

    const reloaded = loadState(directory);
    assert.equal(searchModels(reloaded.models, "maker text-generation").length, 1);
    assert.equal(searchRuns(reloaded.runs, "sine response").length, 1);
    assert.equal(searchRuns([{ input: { condition: "baseline" }, result: { metric: 0.05 } }], "baseline 0.05").length, 1);
    assert.equal(reloaded.models.find((model) => model.id === "maker/Small-GGUF").revision, "abc123");
    assert.deepEqual(reloaded.models.find((model) => model.id === "maker/Small-GGUF").formats, ["gguf"]);
    assert.equal(mergeModels(reloaded.models, first).length, 2);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("version 1 catalogue and run history upgrade without dropping records", () => {
  const directory = mkdtempSync(join(tmpdir(), "opal-catalogue-v1-"));
  try {
    writeFileSync(join(directory, "workbench.json"), JSON.stringify({
      version: 1, lastRefresh: { source: "huggingface", at: "2026-09-25T10:00:00Z" },
      models: [{ id: "maker/Legacy-GGUF", source: "huggingface", gguf: true, tags: ["gguf"], seenAt: "2026-09-25T10:00:00Z" }],
      runs: [{ id: "r1", model: "installed", prompt: "legacy", output: "kept" }],
    }));
    const upgraded = loadState(directory);
    assert.equal(upgraded.version, 2);
    assert.equal(upgraded.models[0].key, "huggingface:maker/Legacy-GGUF");
    assert.deepEqual(upgraded.models[0].formats, ["gguf"]);
    assert.equal(searchRuns(upgraded.runs, "legacy kept").length, 1);
    saveState(directory, upgraded);
    assert.equal(loadState(directory).runs[0].output, "kept");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
