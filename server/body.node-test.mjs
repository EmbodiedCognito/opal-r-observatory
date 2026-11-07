import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createOpalServer } from "./service.mjs";
import { loadState } from "./catalogue.mjs";

// Call the registered HTTP request listener with a controlled async iterable.
// TCP writes can be coalesced, so they cannot guarantee parser chunk boundaries.
async function dispatch(server, chunks) {
  const request = {
    method: "POST", url: "/api/local/chat",
    headers: { host: "127.0.0.1", "content-type": "application/json" },
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield chunk;
    },
  };
  let status;
  let body;
  const response = {
    writeHead(code) { status = code; },
    end(text) { body = JSON.parse(text); },
  };
  const [handler] = server.listeners("request");
  assert.equal(typeof handler, "function");
  await handler(request, response);
  return { status, body };
}

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), "opal-body-boundary-"));
  const prompts = [];
  const runner = { id: "lmstudio", async run(model, prompt) {
    prompts.push(prompt);
    return { output: prompt };
  } };
  const server = createOpalServer({ dataDir: directory, staticDir: directory, sources: [], runners: [runner] });
  return { directory, server, prompts, dispose() { rmSync(directory, { recursive: true, force: true }); } };
}

test("request parser preserves Unicode when every byte is a separate chunk", async () => {
  const f = fixture();
  try {
    const prompt = "café 🧪 漢字";
    const body = Buffer.from(JSON.stringify({ model: "installed", prompt }));
    const chunks = Array.from(body, (_, index) => body.subarray(index, index + 1));
    const result = await dispatch(f.server, chunks);
    assert.equal(result.status, 200);
    assert.deepEqual(f.prompts, [prompt]);
    assert.equal(result.body.run.prompt, prompt);
    assert.equal(loadState(f.directory).runs[0].prompt, prompt);
  } finally {
    f.dispose();
  }
});

for (const split of [false, true]) {
  test(`request parser enforces exact byte limit (${split ? "multiple chunks" : "single chunk"})`, async () => {
    const f = fixture();
    try {
      // Valid JSON whitespace pads the body without hitting the separate prompt limit.
      const prompt = "é".repeat(8000);
      const json = Buffer.from(JSON.stringify({ model: "installed", prompt }));
      const accepted = Buffer.concat([json, Buffer.alloc(16_384 - json.length, 0x20)]);
      const rejected = Buffer.concat([accepted, Buffer.from(" ")]);
      const chunks = (body) => split
        ? [body.subarray(0, 8001), body.subarray(8001, 16_384), body.subarray(16_384)].filter((part) => part.length)
        : [body];
      assert.equal(accepted.length, 16_384);
      assert.equal(rejected.length, 16_385);
      const result = await dispatch(f.server, chunks(accepted));
      assert.equal(result.status, 200);
      assert.equal(result.body.run.prompt, prompt);
      const oversized = await dispatch(f.server, chunks(rejected));
      assert.equal(oversized.status, 413);
      assert.deepEqual(f.prompts, [prompt]);
      assert.equal(loadState(f.directory).runs.length, 1);
    } finally {
      f.dispose();
    }
  });
}
