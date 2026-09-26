import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadState, mergeModels, normaliseHfModels, saveState, searchModels, searchRuns } from "./catalogue.mjs";

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
    assert.equal(reloaded.models.find((model) => model.id === "maker/Small-GGUF").revision, "abc123");
    assert.equal(mergeModels(reloaded.models, first).length, 2);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
