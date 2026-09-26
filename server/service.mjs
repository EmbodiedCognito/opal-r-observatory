import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { loadState, mergeModels, normaliseHfModels, saveState, searchModels, searchRuns } from "./catalogue.mjs";

const publisher = "https://huggingface.co/api/models";
const contentTypes = {
  ".css": "text/css", ".html": "text/html", ".ico": "image/x-icon",
  ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml",
  ".wasm": "application/wasm", ".woff": "font/woff", ".woff2": "font/woff2",
};

function fail(status, message) {
  const error = new Error(message);
  error.status = status;
  throw error;
}

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

async function upstreamJson(fetcher, url, options = {}, source = "Publisher") {
  let response;
  try {
    const { timeoutMs = 30_000, ...requestOptions } = options;
    response = await fetcher(url, { ...requestOptions, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    fail(502, `${source} unavailable. Saved local records are unaffected.`);
  }
  if (!response.ok) fail(502, `${source} returned HTTP ${response.status}. Saved local records were kept.`);
  try {
    return await response.json();
  } catch {
    fail(502, `${source} returned invalid JSON. Saved local records were kept.`);
  }
}

function validatedText(value, maximum, label) {
  if (typeof value !== "string" || value.length > maximum) fail(400, `Invalid ${label}.`);
  return value.trim();
}

export function createOpalServer({ dataDir, staticDir, fetcher = fetch, lmStudioUrl = "http://127.0.0.1:1234", lmToken = "" }) {
  const lmBase = new URL(lmStudioUrl);
  if (lmBase.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(lmBase.hostname)) {
    throw new Error("The LM Studio endpoint must be on this computer.");
  }
  const lm = (path) => new URL(path, lmBase).toString();
  const lmHeaders = lmToken ? { Authorization: `Bearer ${lmToken}` } : {};
  const lmJson = (path, options = {}) => upstreamJson(fetcher, lm(path), {
    ...options,
    headers: { ...lmHeaders, ...options.headers },
  }, "LM Studio");

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
        return send(response, 200, { models: matches.slice(0, 200), matched: matches.length, total: state.models.length, lastRefresh: state.lastRefresh });
      }
      if (request.method === "POST" && url.pathname === "/api/catalogue/refresh") {
        const input = await bodyOf(request);
        const query = validatedText(input.query ?? "", 100, "publisher query");
        const source = new URL(publisher);
        source.search = new URLSearchParams({ filter: "gguf", sort: "lastModified", direction: "-1", limit: "100", ...(query ? { search: query } : {}) }).toString();
        const remote = await upstreamJson(fetcher, source.toString());
        const at = new Date().toISOString();
        const records = normaliseHfModels(remote, at);
        if (remote.length && !records.length) fail(502, "Publisher returned no recognisable model records.");
        const state = loadState(dataDir);
        state.models = mergeModels(state.models, records);
        state.lastRefresh = { source: "huggingface", query, at, returned: records.length };
        saveState(dataDir, state);
        return send(response, 200, { ...state.lastRefresh, total: state.models.length });
      }
      if (request.method === "GET" && url.pathname === "/api/local/models") {
        const result = await lmJson("/api/v1/models");
        if (!Array.isArray(result.models)) fail(502, "LM Studio returned an unexpected model list.");
        return send(response, 200, { models: result.models.map((model) => ({
          key: model.key, name: model.display_name ?? model.key, type: model.type,
          format: model.format, sizeBytes: model.size_bytes,
          loaded: Array.isArray(model.loaded_instances) && model.loaded_instances.length > 0,
        })).filter((model) => typeof model.key === "string") });
      }
      if (request.method === "POST" && url.pathname === "/api/local/download") {
        const input = await bodyOf(request);
        const id = validatedText(input.id, 200, "catalogue model ID");
        const model = loadState(dataDir).models.find((item) => item.id === id);
        if (!model || !model.gguf || model.gated) fail(400, "Choose a saved, public GGUF model.");
        const quantization = input.quantization == null ? "" : validatedText(input.quantization, 40, "quantization");
        if (quantization && !/^[A-Za-z0-9_.-]+$/.test(quantization)) fail(400, "Invalid quantization.");
        const result = await lmJson("/api/v1/models/download", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ model: model.url, ...(quantization ? { quantization } : {}) }),
        });
        return send(response, 200, result);
      }
      if (request.method === "GET" && url.pathname === "/api/local/download/status") {
        const job = url.searchParams.get("job") ?? "";
        if (!/^job_[A-Za-z0-9_-]+$/.test(job)) fail(400, "Invalid download job.");
        return send(response, 200, await lmJson(`/api/v1/models/download/status/${job}`));
      }
      if (request.method === "POST" && url.pathname === "/api/local/chat") {
        const input = await bodyOf(request);
        const model = validatedText(input.model, 200, "local model");
        const prompt = validatedText(input.prompt, 10_000, "prompt");
        if (!prompt) fail(400, "Enter a prompt.");
        const installed = await lmJson("/api/v1/models");
        if (!Array.isArray(installed.models) || !installed.models.some((item) => item.key === model && item.type === "llm")) {
          fail(400, "Choose an installed local language model.");
        }
        const result = await lmJson("/api/v1/chat", {
          method: "POST", timeoutMs: 180_000, headers: { "content-type": "application/json" },
          body: JSON.stringify({ model, input: prompt, stream: false, store: false }),
        });
        const output = Array.isArray(result.output)
          ? result.output.filter((item) => item.type === "message" && typeof item.content === "string").map((item) => item.content).join("\n")
          : "";
        if (!output) fail(502, "The local model returned no text response.");
        const run = { id: randomUUID(), at: new Date().toISOString(), model, prompt, output, modelInstance: result.model_instance_id ?? null };
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
