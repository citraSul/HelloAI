#!/usr/bin/env node
/**
 * Starts Next dev on 127.0.0.1:3000 only if the port is free — avoids two broken servers.
 */
import { spawn } from "child_process";
import net from "net";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const nextBin = join(root, "node_modules", "next", "dist", "bin", "next");
const HOST = "127.0.0.1";
const PORT = 3000;

function portIsFree(host, port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", (err) => {
      if (err && "code" in err && err.code === "EADDRINUSE") resolve(false);
      else resolve(true);
    });
    s.once("listening", () => {
      s.close(() => resolve(true));
    });
    s.listen(port, host);
  });
}

async function main() {
  const free = await portIsFree(HOST, PORT);
  if (!free) {
    console.error("");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("  HireLense: port 3000 is already in use.");
    console.error("  Stop the other dev server (Ctrl+C in that terminal).");
    console.error("  Or:  lsof -ti:3000 | xargs kill");
    console.error("  If the UI shows missing chunk errors, run:  npm run dev:clean");
    console.error("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.error("");
    process.exit(1);
  }

  if (!existsSync(nextBin)) {
    console.error("[hirelens] Next.js not found. Run npm install from hirelens-web.");
    process.exit(1);
  }

  const child = spawn(process.execPath, [nextBin, "dev", "--hostname", HOST, "--port", String(PORT)], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code) => process.exit(code ?? 0));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
