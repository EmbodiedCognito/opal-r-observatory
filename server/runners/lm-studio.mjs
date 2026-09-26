import { fail, upstreamJson } from "../upstream.mjs";

export function createLmStudioRunner({ fetcher, url = "http://127.0.0.1:1234", token = "" }) {
  const base = new URL(url);
  if (base.protocol !== "http:" || !["127.0.0.1", "localhost", "[::1]"].includes(base.hostname)) {
    throw new Error("The LM Studio endpoint must be on this computer.");
  }
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const request = (path, options = {}) => upstreamJson(fetcher, new URL(path, base).toString(), {
    ...options, headers: { ...headers, ...options.headers },
  }, "LM Studio");

  return {
    id: "lmstudio",
    label: "LM Studio",
    canDownload(model) {
      return model.source === "huggingface" && model.formats?.includes("gguf") && !model.gated;
    },
    async listModels() {
      const result = await request("/api/v1/models");
      if (!Array.isArray(result.models)) fail(502, "LM Studio returned an unexpected model list.");
      return result.models.map((model) => ({
        key: model.key, name: model.display_name ?? model.key, type: model.type,
        format: model.format, sizeBytes: model.size_bytes,
        loaded: Array.isArray(model.loaded_instances) && model.loaded_instances.length > 0,
      })).filter((model) => typeof model.key === "string");
    },
    download(model, quantization) {
      return request("/api/v1/models/download", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: model.url, ...(quantization ? { quantization } : {}) }),
      });
    },
    downloadStatus(job) {
      return request(`/api/v1/models/download/status/${job}`);
    },
    async run(model, prompt) {
      const installed = await this.listModels();
      if (!installed.some((item) => item.key === model && item.type === "llm")) {
        fail(400, "Choose an installed local language model.");
      }
      const result = await request("/api/v1/chat", {
        method: "POST", timeoutMs: 180_000, headers: { "content-type": "application/json" },
        body: JSON.stringify({ model, input: prompt, stream: false, store: false }),
      });
      const output = Array.isArray(result.output)
        ? result.output.filter((item) => item.type === "message" && typeof item.content === "string").map((item) => item.content).join("\n")
        : "";
      if (!output) fail(502, "The local model returned no text response.");
      return { output, modelInstance: result.model_instance_id ?? null };
    },
  };
}
