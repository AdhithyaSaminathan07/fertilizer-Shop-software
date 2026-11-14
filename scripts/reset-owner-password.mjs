import mongoose from "mongoose";
import { hash } from "@node-rs/argon2";
import fs from "fs";
import path from "path";
import readline from "readline";

// Safely parse .env (or .env.local fallback) without external dependencies
function loadEnv() {
  const envFiles = [".env", ".env.local"];
  for (const file of envFiles) {
    const envPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, "utf8").split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const [key, ...values] = trimmed.split("=");
        if (key && values.length > 0) {
          const varKey = key.trim();
          if (!process.env[varKey]) {
            process.env[varKey] = values.join("=").trim().replace(/^["']|["']$/g, "");
          }
        }
      }
    }
  }
}

loadEnv();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/kasi_agri";

const ARGON2_OPTIONS = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

async function promptPasswordInteractive() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question("Enter new password for Owner/Admin: ", (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

export async function resetOwnerPassword(options = {}) {
  const isDirectRun = options.isDirectRun ?? true;
  console.log("=================================================");
  console.log("   KASI AGRI AGENCIES - OWNER PASSWORD RESET     ");
  console.log("=================================================");

  const hasCliPassword = process.argv.some(
    (arg) => arg.startsWith("--password") || arg.startsWith("-p")
  );
  if (hasCliPassword) {
    console.error("\n[SECURITY BLOCK] Passing passwords as command-line arguments is forbidden.");
    console.error("CLI arguments are exposed in process listings (e.g. ps, top, Task Manager).");
    console.error("Please supply the password via KASI_OWNER_INITIAL_PASSWORD in .env.local");
    console.error("or run the script interactively without command-line password arguments.\n");
    if (isDirectRun) process.exit(1);
    throw new Error("CLI password argument forbidden");
  }

  const targetUri = options.mongoUri || MONGODB_URI;
  console.log(`Connecting to database...`);
  await mongoose.connect(targetUri, { bufferCommands: false });

  const db = mongoose.connection.db;
  const usersCollection = db.collection("users");
  const sessionsCollection = db.collection("sessions");
  const auditCollection = db.collection("auditlogs");

  const owner = await usersCollection.findOne({ role: "OWNER" });
  if (!owner) {
    console.error("\n[ERROR] No Owner account found in database.");
    console.error("Run 'npm run seed:owner' first to provision the initial Owner account.\n");
    if (isDirectRun) {
      await mongoose.disconnect();
      process.exit(1);
    }
    throw new Error("No Owner account found");
  }

  let newPassword =
    options.newPassword ||
    process.env.KASI_OWNER_NEW_PASSWORD ||
    process.env.KASI_OWNER_INITIAL_PASSWORD;

  if (process.env.KASI_OWNER_NEW_PASSWORD) delete process.env.KASI_OWNER_NEW_PASSWORD;
  if (process.env.KASI_OWNER_INITIAL_PASSWORD) delete process.env.KASI_OWNER_INITIAL_PASSWORD;

  if (!newPassword && process.stdin.isTTY && isDirectRun) {
    newPassword = await promptPasswordInteractive();
  }

  if (!newPassword || newPassword.length < 8) {
    console.error("\n[ERROR] A new password of at least 8 characters must be provided.");
    console.error("Configure KASI_OWNER_INITIAL_PASSWORD in .env.local or enter interactively.\n");
    if (isDirectRun) {
      await mongoose.disconnect();
      process.exit(1);
    }
    throw new Error("Password too short");
  }

  console.log(`Hashing new password with Argon2id for: ${owner.name} (${owner.username})...`);
  const passwordHash = await hash(newPassword, ARGON2_OPTIONS);

  await usersCollection.updateOne(
    { _id: owner._id },
    { $set: { passwordHash, updatedAt: new Date() } }
  );

  // Revoke all existing sessions immediately
  const revoked = await sessionsCollection.deleteMany({ userId: owner._id });

  await auditCollection.insertOne({
    action: "PASSWORD_RESET",
    targetUserId: owner._id,
    targetUserName: owner.name,
    details: { reason: "Manual owner password reset via secure tool" },
    timestamp: new Date(),
  });

  console.log("\n[SUCCESS] Owner password has been updated securely:");
  console.log(`- Username:         ${owner.username}`);
  console.log(`- Active Sessions:  ${revoked.deletedCount} revoked`);
  console.log(`- Security:         Argon2id hash updated (Plaintext password never stored)`);
  console.log("=================================================\n");

  if (isDirectRun) {
    await mongoose.disconnect();
    process.exit(0);
  }

  return { success: true, revokedCount: revoked.deletedCount };
}

if (process.argv[1] && process.argv[1].endsWith("reset-owner-password.mjs")) {
  resetOwnerPassword({ isDirectRun: true }).catch((err) => {
    console.error("Owner password reset failed:", err.message);
    process.exit(1);
  });
}

