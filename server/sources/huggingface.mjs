import { fail, upstreamJson } from "../upstream.mjs";

const publisher = "https://huggingface.co/api/models";
const formatTags = new Set(["gguf", "safetensors", "onnx", "pytorch", "tensorflow", "mlx", "tflite", "coreml"]);

export function normaliseHfModels(items, seenAt) {
  if (!Array.isArray(items)) fail(502, "The publisher returned an unexpected model list.");
  return items.flatMap((item) => {
    const id = item?.id ?? item?.modelId;
    if (typeof id !== "string" || !/^[\w.-]+\/[\w.-]+$/.test(id)) return [];
    const tags = Array.isArray(item.tags) ? item.tags.filter((tag) => typeof tag === "string").slice(0, 80) : [];
    const formats = [...new Set(tags.map((tag) => tag.toLowerCase()).filter((tag) => formatTags.has(tag)))];
    if (/-gguf$/i.test(id) && !formats.includes("gguf")) formats.push("gguf");
    return [{
      key: `huggingface:${id}`,
      id,
      source: "huggingface",
      title: id,
      url: `https://huggingface.co/${id}`,
      revision: typeof item.sha === "string" ? item.sha : null,
      updatedAt: typeof item.lastModified === "string" ? item.lastModified : null,
      seenAt,
      kind: typeof item.pipeline_tag === "string" ? item.pipeline_tag : null,
      task: typeof item.pipeline_tag === "string" ? item.pipeline_tag : null,
      library: typeof item.library_name === "string" ? item.library_name : null,
      downloads: Number.isFinite(item.downloads) ? item.downloads : null,
      gated: Boolean(item.gated),
      formats,
      tags,
    }];
  });
}

export function createHuggingFaceSource({ fetcher }) {
  return {
    id: "huggingface",
    label: "Hugging Face",
    async refresh(query) {
      const url = new URL(publisher);
      // A bounded snapshot of recent records, not a GGUF or LLM-only index.
      url.search = new URLSearchParams({ sort: "lastModified", direction: "-1", limit: "100", ...(query ? { search: query } : {}) }).toString();
      const remote = await upstreamJson(fetcher, url.toString());
      const records = normaliseHfModels(remote, new Date().toISOString());
      if (remote.length && !records.length) fail(502, "Publisher returned no recognisable model records.");
      return records;
    },
  };
}
