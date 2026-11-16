import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const envPath = path.resolve(process.cwd(), ".env.staging");

if (!fs.existsSync(envPath)) {
  console.error("FATAL: .env.staging file not found. Staging server aborted.");
  process.exit(1);
}

// Safely load staging variables into process.env without CLI flags (avoids NODE_OPTIONS pollution)
if (typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
} else {
  // Fallback line parser for Node versions without process.loadEnvFile
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...values] = trimmed.split("=");
    if (key && values.length > 0) {
      process.env[key.trim()] = values.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
}

// Security Guard 1: Verify APP_ENV is explicitly 'staging'
if (process.env.APP_ENV !== "staging") {
  console.error("FATAL CONFIG GUARD: APP_ENV must be set to 'staging' in .env.staging. Aborting.");
  process.exit(1);
}

// Security Guard 2: Verify MONGODB_URI explicitly targets 'kasi_staging'
const mongoUri = process.env.MONGODB_URI || "";
if (!mongoUri.includes("/kasi_staging")) {
  console.error(
    "FATAL DATABASE GUARD: Staging MONGODB_URI must explicitly target '/kasi_staging'. Aborting to protect production database."
  );
  process.exit(1);
}

console.log("==========================================================");
console.log("   KASI AGRI AGENCIES - STAGING DEVELOPMENT SERVER        ");
console.log("   Environment: APP_ENV=staging                           ");
console.log("   Target DB:   kasi_staging (verified isolated)          ");
console.log("==========================================================\n");

// Launch Next.js dev server with staging environment injected
const nextBin = path.resolve(process.cwd(), "node_modules", "next", "dist", "bin", "next");
const nextArgs = ["dev", ...process.argv.slice(2)];

const child = spawn(process.execPath, [nextBin, ...nextArgs], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 0);
  }
});

process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
