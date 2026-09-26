import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { test } from "node:test";
import { loadState } from "./catalogue.mjs";
import { createOpalServer } from "./service.mjs";

test("online refresh supports offline search, deliberate download, and saved local runs", async () => {
  const directory = mkdtempSync(join(tmpdir(), "opal-service-"));
  writeFileSync(join(directory, "index.html"), "local workbench");
  writeFileSync(join(directory, "loader.mjs"), "export const local = true;");
  let publisherOnline = true;
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    if (url.startsWith("https://huggingface.co/api/models")) {
      if (!publisherOnline) throw new Error("offline");
      return Response.json([{ id: "maker/Small-GGUF", sha: "rev1", tags: ["gguf", "text-generation"], gated: false }]);
    }
    if (url.endsWith("/api/v1/models")) return Response.json({ models: [{ key: "installed-model", type: "llm", display_name: "Installed model" }] });
    if (url.endsWith("/api/v1/models/download")) return Response.json({ job_id: "job_test", status: "downloading" });
    if (url.endsWith("/api/v1/chat")) return Response.json({ model_instance_id: "installed-model", output: [{ type: "message", content: "Local answer" }] });
    throw new Error(`Unexpected URL ${url}`);
  };
  const server = createOpalServer({ dataDir: directory, staticDir: directory, fetcher: fakeFetch });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, input) => fetch(`${base}${path}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  });

  try {
    assert.equal((await fetch(base)).status, 200);
    assert.match((await fetch(`${base}/loader.mjs`)).headers.get("content-type"), /text\/javascript/);
    const refresh = await post("/api/catalogue/refresh", { query: "small" });
    assert.equal(refresh.status, 200);
    assert.equal((await refresh.json()).total, 1);
    assert.match(calls[0].url, /search=small/);

    publisherOnline = false;
    const search = await (await fetch(`${base}/api/catalogue?q=small%20gguf`)).json();
    assert.equal(search.matched, 1);
    assert.equal(search.models[0].revision, "rev1");
    assert.equal((await post("/api/catalogue/refresh", {})).status, 502);
    assert.equal(loadState(directory).models.length, 1);

    const download = await post("/api/local/download", { id: "maker/Small-GGUF", quantization: "Q4_K_M" });
    assert.equal((await download.json()).job_id, "job_test");
    const request = calls.find((call) => call.url.endsWith("/api/v1/models/download"));
    assert.deepEqual(JSON.parse(request.options.body), {
      model: "https://huggingface.co/maker/Small-GGUF", quantization: "Q4_K_M",
    });

    const chat = await post("/api/local/chat", { model: "installed-model", prompt: "sine wave" });
    assert.equal((await chat.json()).run.output, "Local answer");
    assert.equal((await (await fetch(`${base}/api/runs?q=sine`)).json()).matched, 1);
    assert.equal(loadState(directory).runs.length, 1);
  } finally {
    server.close();
    await once(server, "close");
    rmSync(directory, { recursive: true, force: true });
  }
});
