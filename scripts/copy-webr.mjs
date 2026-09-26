import { cpSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = resolve(root, "node_modules/webr/dist");
const destination = resolve(root, "public/webr");
if (!existsSync(resolve(source, "R.wasm")) || !existsSync(resolve(source, "webr.mjs"))) {
  throw new Error("Install the pinned webR package with npm ci before building.");
}
mkdirSync(destination, { recursive: true });
cpSync(source, destination, { recursive: true, force: true });
