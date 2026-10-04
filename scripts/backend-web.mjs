// Load only the API credential into Next's process; never expose it through NEXT_PUBLIC_*.
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const [mode = "dev", port = "3000"] = process.argv.slice(2);
if (!["dev", "start"].includes(mode) || !/^\d{4,5}$/.test(port) || Number(port) > 65535) {
  throw new Error("Usage: node scripts/backend-web.mjs dev|start [port]");
}
const values = Object.fromEntries((await readFile(path.join(root, ".env.backend.local"), "utf8")).trim().split(/\r?\n/).map(line => {
  const separator = line.indexOf("=");
  return [line.slice(0, separator), line.slice(separator + 1)];
}));
if (!values.CONVERSION_API_SECRET) throw new Error("Run scripts/setup-backend.mjs first.");
const child = spawn(process.execPath, [path.join(root, "node_modules/next/dist/bin/next"), mode, "--port", port], {
  cwd: root, stdio: "inherit",
  env: { ...process.env, SITE_ORIGIN: "http://localhost:" + port, CONVERSION_API_URL: "http://127.0.0.1:8000", CONVERSION_API_SECRET: values.CONVERSION_API_SECRET },
});
child.on("exit", code => { process.exitCode = code ?? 1; });
child.on("error", () => { console.error("Unable to start Next.js."); process.exitCode = 1; });
