import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createOpalServer } from "./service.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const port = Number(process.env.OPAL_PORT ?? 4317);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("OPAL_PORT must be a TCP port.");

const server = createOpalServer({
  dataDir: process.env.OPAL_DATA_DIR ?? join(homedir(), ".opal-r-observatory"),
  staticDir: join(root, "dist"),
  lmStudioUrl: process.env.LM_STUDIO_URL ?? "http://127.0.0.1:1234",
  lmToken: process.env.LM_STUDIO_API_TOKEN ?? "",
});
server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`Opal local workbench: http://127.0.0.1:${port}\n`);
});
