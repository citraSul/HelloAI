#!/usr/bin/env node
/**
 * Removes .next, regenerates Prisma client, then starts dev (with port check).
 */
import { rmSync, existsSync } from "fs";
import { spawn } from "child_process";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const nextDir = join(root, ".next");

const nextDirPath = nextDir;
if (existsSync(nextDirPath)) {
  rmSync(nextDirPath, { recursive: true, force: true });
  console.log("[hirelens] Removed .next");
}

execSync("npx prisma generate", { cwd: root, stdio: "inherit" });

const start = join(__dirname, "dev-start.mjs");
const child = spawn(process.execPath, [start], { cwd: root, stdio: "inherit", env: process.env });
child.on("exit", (code) => process.exit(code ?? 0));
