import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const emptyState = () => ({ version: 1, lastRefresh: null, models: [], runs: [] });

export function normaliseHfModels(items, seenAt) {
  if (!Array.isArray(items)) throw new Error("The publisher returned an unexpected model list.");
  return items.flatMap((item) => {
    const id = item?.id ?? item?.modelId;
    if (typeof id !== "string" || !/^[\w.-]+\/[\w.-]+$/.test(id)) return [];
    const tags = Array.isArray(item.tags) ? item.tags.filter((tag) => typeof tag === "string").slice(0, 80) : [];
    return [{
      id,
      source: "huggingface",
      url: `https://huggingface.co/${id}`,
      revision: typeof item.sha === "string" ? item.sha : null,
      updatedAt: typeof item.lastModified === "string" ? item.lastModified : null,
      seenAt,
      task: typeof item.pipeline_tag === "string" ? item.pipeline_tag : null,
      library: typeof item.library_name === "string" ? item.library_name : null,
      downloads: Number.isFinite(item.downloads) ? item.downloads : null,
      gated: Boolean(item.gated),
      gguf: tags.some((tag) => tag.toLowerCase() === "gguf") || /-gguf$/i.test(id),
      tags,
    }];
  });
}

export function mergeModels(existing, incoming) {
  const byId = new Map(existing.map((model) => [model.id, model]));
  for (const model of incoming) byId.set(model.id, model);
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

export function searchModels(models, query) {
  return searchItems(models, query, (model) =>
    [model.id, model.task ?? "", model.library ?? "", ...(model.tags ?? [])]);
}

export function searchRuns(runs, query) {
  return searchItems(runs, query, (run) =>
    [run.model, run.prompt, run.output, run.catalogueId ?? ""]);
}

export function loadState(dataDir) {
  try {
    const state = JSON.parse(readFileSync(join(dataDir, "workbench.json"), "utf8"));
    if (state.version !== 1 || !Array.isArray(state.models) || !Array.isArray(state.runs)) {
      throw new Error("Unsupported local catalogue format.");
    }
    return state;
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
