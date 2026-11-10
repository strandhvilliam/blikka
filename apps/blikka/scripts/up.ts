import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// `bun run up`: checks and fixes everything `alchemy dev` needs, then starts it. Safe to run every time.

const LOCAL_DATABASE_URL = "postgres://postgres:postgres@localhost:5433/blikka"; // docker-compose.yml
process.chdir(join(import.meta.dirname, ".."));

const ok = (step: string, detail: string) => console.log(`✓ ${step.padEnd(12)} ${detail}`);
const fail = (step: string, detail: string): never => {
  console.error(`✗ ${step.padEnd(12)} ${detail}`);
  process.exit(1);
};
const run = (command: string, args: string[], env?: Record<string, string>) =>
  spawnSync(command, args, { stdio: "ignore", env: { ...process.env, ...env } }).status === 0;

if (!run("bun", ["install"])) fail("deps", "bun install failed, run it to see why");
ok("deps", "installed");

// Missing keys are appended; values already in .env are never changed.
const defaults: Record<string, () => string> = {
  DATABASE_URL: () => LOCAL_DATABASE_URL,
  BETTER_AUTH_SECRET: () => randomBytes(32).toString("base64"),
  BETTER_AUTH_URL: () => "http://localhost:1337",
  WEBSITE_URL: () => "http://localhost:5173",
};
const env = existsSync(".env") ? readFileSync(".env", "utf8") : "";
const present = new Set([...env.matchAll(/^\s*([A-Z0-9_]+)\s*=/gm)].map((m) => m[1]));
const added = Object.keys(defaults).filter((key) => !present.has(key));
if (added.length > 0) {
  const lines = added.map((key) => `${key}=${defaults[key]!()}`).join("\n");
  writeFileSync(".env", `${env}${env === "" || env.endsWith("\n") ? "" : "\n"}${lines}\n`);
}
ok("env", added.length > 0 ? `added ${added.join(", ")}` : "complete");

if (!run("docker", ["info"])) fail("docker", "not running, start Docker");
if (!run("docker", ["compose", "up", "-d", "--wait"])) {
  fail("postgres", "did not start: docker compose logs postgres");
}
ok("postgres", "healthy on :5433");

if (existsSync("drizzle")) {
  if (!run("bunx", ["drizzle-kit", "migrate"], { DATABASE_URL: LOCAL_DATABASE_URL })) {
    fail("migrations", `failed: DATABASE_URL=${LOCAL_DATABASE_URL} bunx drizzle-kit migrate`);
  }
  ok("migrations", "applied to the local database");
} else {
  ok("migrations", "none yet (no drizzle/ folder)");
}

console.log("→ starting alchemy dev");
// alchemy dev handles Ctrl+C itself; stay alive until it has shut down.
process.on("SIGINT", () => {});
spawn("bun", ["run", "dev"], { stdio: "inherit" }).on("exit", (code) => process.exit(code ?? 1));
