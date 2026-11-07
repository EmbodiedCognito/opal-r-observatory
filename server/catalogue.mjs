import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const emptyState = () => ({ version: 2, lastRefresh: null, models: [], runs: [] });

export function modelKey(model) {
  return `${model.source}:${model.id}`;
}

function upgradeModel(model) {
  // Version 1 stored an LM Studio-specific flag on every catalogue entry.
  const { gguf, ...record } = model;
  const formats = Array.isArray(record.formats) ? record.formats : [];
  return {
    ...record,
    key: modelKey(record),
    formats: gguf && !formats.includes("gguf") ? [...formats, "gguf"] : formats,
  };
}

export function mergeModels(existing, incoming) {
  const byId = new Map(existing.map((model) => [modelKey(model), model]));
  for (const model of incoming) byId.set(modelKey(model), model);
  return [...byId.values()].sort((a, b) =>
    (b.updatedAt ?? b.seenAt ?? "").localeCompare(a.updatedAt ?? a.seenAt ?? ""));
}

export function searchItems(items, query, fields) {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return items;
  return items.filter((item) => {
    const content = fields(item).join(" ").toLocaleLowerCase();
    return words.every((word) => content.includes(word));
  });
}

// Index values, including fields added by later adapters, without prescribing
// a model type or a particular shape for an experiment's recorded output.
function values(item) {
  return item == null ? [] : Array.isArray(item)
    ? item.flatMap(values) : typeof item === "object"
      ? Object.values(item).flatMap(values) : [String(item)];
}

export function searchModels(models, query) {
  return searchItems(models, query, values);
}

export function searchRuns(runs, query) {
  return searchItems(runs, query, values);
}

export function loadState(dataDir) {
  try {
    const state = JSON.parse(readFileSync(join(dataDir, "workbench.json"), "utf8"));
    if (![1, 2].includes(state.version) || !Array.isArray(state.models) || !Array.isArray(state.runs)) {
      throw new Error("Unsupported local catalogue format.");
    }
    return { ...state, version: 2, models: state.models.map(upgradeModel) };
  } catch (error) {
    if (error.code === "ENOENT") return emptyState();
    throw error;
  }
}

export function saveState(dataDir, state) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const temporary = join(dataDir, `workbench-${randomUUID()}.tmp`);
  writeFileSync(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
  renameSync(temporary, join(dataDir, "workbench.json"));
}
