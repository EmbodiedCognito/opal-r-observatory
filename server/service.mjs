import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { loadState, mergeModels, modelKey, saveState, searchModels, searchRuns } from "./catalogue.mjs";
import { createHuggingFaceSource } from "./sources/huggingface.mjs";
import { createLmStudioRunner } from "./runners/lm-studio.mjs";
import { fail } from "./upstream.mjs";

const contentTypes = {
  ".css": "text/css", ".html": "text/html", ".ico": "image/x-icon",
  ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml",
  ".wasm": "application/wasm", ".woff": "font/woff", ".woff2": "font/woff2",
};

function send(response, status, value) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(value));
}

async function bodyOf(request) {
  if (!request.headers["content-type"]?.startsWith("application/json")) fail(415, "Expected JSON input.");
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 16_384) fail(413, "Request is too large.");
  }
  try {
    const parsed = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) fail(400, "Expected a JSON object.");
    return parsed;
  } catch (error) {
    if (error.status) throw error;
    fail(400, "Invalid JSON input.");
  }
}

function validatedText(value, maximum, label) {
  if (typeof value !== "string" || value.length > maximum) fail(400, `Invalid ${label}.`);
  return value.trim();
}

export function createOpalServer({ dataDir, staticDir, fetcher = fetch, lmStudioUrl = "http://127.0.0.1:1234", lmToken = "", sources, runners }) {
  const sourceAdapters = sources ?? [createHuggingFaceSource({ fetcher })];
  const runnerAdapters = runners ?? [createLmStudioRunner({ fetcher, url: lmStudioUrl, token: lmToken })];
  const byId = (adapters) => {
    const ids = adapters.map((adapter) => adapter.id);
    if (ids.some((id) => typeof id !== "string" || !/^[a-z][a-z0-9-]*$/.test(id)) || new Set(ids).size !== ids.length) {
      throw new Error("Adapter IDs must be unique lowercase names.");
    }
    return new Map(adapters.map((adapter) => [adapter.id, adapter]));
  };
  const sourceById = byId(sourceAdapters);
  const runnerById = byId(runnerAdapters);
  const runnerFor = (id) => runnerById.get(id) ?? fail(400, "Unknown local runner.");

  return createServer(async (request, response) => {
    try {
      const host = request.headers.host?.split(":")[0];
      if (!["127.0.0.1", "localhost"].includes(host)) fail(403, "Local access only.");
      if (request.method === "POST" && request.headers.origin) {
        const origin = new URL(request.headers.origin);
        if (!["127.0.0.1", "localhost"].includes(origin.hostname)) fail(403, "Local origin required.");
      }
      const url = new URL(request.url, `http://${request.headers.host}`);
      if (request.method === "GET" && url.pathname === "/api/catalogue") {
        const state = loadState(dataDir);
        const matches = searchModels(state.models, validatedText(url.searchParams.get("q") ?? "", 200, "search"));
        const models = matches.slice(0, 200).map((model) => ({
          ...model, downloadWith: runnerAdapters.filter((runner) => runner.canDownload(model)).map((runner) => runner.id),
        }));
        return send(response, 200, { models, matched: matches.length, total: state.models.length, lastRefresh: state.lastRefresh });
      }
      if (request.method === "GET" && url.pathname === "/api/catalogue/sources") {
        return send(response, 200, { sources: sourceAdapters.map(({ id, label }) => ({ id, label })) });
      }
      if (request.method === "POST" && url.pathname === "/api/catalogue/refresh") {
        const input = await bodyOf(request);
        const query = validatedText(input.query ?? "", 100, "publisher query");
        const sourceId = validatedText(input.source ?? "huggingface", 40, "source");
        const source = sourceById.get(sourceId);
        if (!source) fail(400, "Unknown catalogue source.");
        const at = new Date().toISOString();
        const records = await source.refresh(query);
        if (!Array.isArray(records) || records.some((record) => !record ||
          record.source !== source.id || typeof record.id !== "string" || !record.id.trim() ||
          (record.key != null && record.key !== modelKey(record)))) {
          fail(502, "Catalogue source returned invalid records. Saved local records were kept.");
        }
        const state = loadState(dataDir);
        state.models = mergeModels(state.models, records.map((record) => ({ ...record, key: modelKey(record), seenAt: record.seenAt ?? at })));
        state.lastRefresh = { source: source.id, query, at, returned: records.length };
        saveState(dataDir, state);
        return send(response, 200, { ...state.lastRefresh, total: state.models.length });
      }
      if (request.method === "GET" && url.pathname === "/api/local/models") {
        const runner = runnerFor(validatedText(url.searchParams.get("runner") ?? "lmstudio", 40, "runner"));
        return send(response, 200, { models: await runner.listModels() });
      }
      if (request.method === "POST" && url.pathname === "/api/local/download") {
        const input = await bodyOf(request);
        const key = validatedText(input.key, 240, "catalogue model key");
        const runner = runnerFor(validatedText(input.runner ?? "lmstudio", 40, "runner"));
        const model = loadState(dataDir).models.find((item) => item.key === key);
        if (!model || !runner.canDownload(model)) fail(400, "This runner cannot download the selected catalogue record.");
        const quantization = input.quantization == null ? "" : validatedText(input.quantization, 40, "quantization");
        if (quantization && !/^[A-Za-z0-9_.-]+$/.test(quantization)) fail(400, "Invalid quantization.");
        return send(response, 200, await runner.download(model, quantization));
      }
      if (request.method === "GET" && url.pathname === "/api/local/download/status") {
        const job = url.searchParams.get("job") ?? "";
        if (!/^job_[A-Za-z0-9_-]+$/.test(job)) fail(400, "Invalid download job.");
        const runner = runnerFor(validatedText(url.searchParams.get("runner") ?? "lmstudio", 40, "runner"));
        return send(response, 200, await runner.downloadStatus(job));
      }
      if (request.method === "POST" && url.pathname === "/api/local/chat") {
        const input = await bodyOf(request);
        const runner = runnerFor(validatedText(input.runner ?? "lmstudio", 40, "runner"));
        const model = validatedText(input.model, 200, "local model");
        const prompt = validatedText(input.prompt, 10_000, "prompt");
        if (!prompt) fail(400, "Enter a prompt.");
        const result = await runner.run(model, prompt);
        const run = { id: randomUUID(), at: new Date().toISOString(), runner: runner.id, model, prompt, ...result };
        const state = loadState(dataDir);
        state.runs.unshift(run);
        saveState(dataDir, state);
        return send(response, 200, { run });
      }
      if (request.method === "GET" && url.pathname === "/api/runs") {
        const matches = searchRuns(loadState(dataDir).runs, validatedText(url.searchParams.get("q") ?? "", 200, "search"));
        return send(response, 200, { runs: matches.slice(0, 100), matched: matches.length });
      }
      if (request.method !== "GET" || url.pathname.startsWith("/api/")) fail(404, "Not found.");
      const file = resolve(staticDir, `.${url.pathname === "/" ? "/index.html" : url.pathname}`);
      const root = resolve(staticDir);
      if (!file.startsWith(root + sep)) fail(403, "Invalid file path.");
      try {
        const bytes = await readFile(file);
        response.writeHead(200, { "content-type": contentTypes[extname(file)] ?? "application/octet-stream" });
        response.end(bytes);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        fail(404, "Run npm run build before starting the local workbench.");
      }
    } catch (error) {
      send(response, error.status ?? 500, { error: error.status ? error.message : "Local service error." });
    }
  });
}
