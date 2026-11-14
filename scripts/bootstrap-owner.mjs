import mongoose from "mongoose";
import crypto from "crypto";
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
          // Do not overwrite existing process.env variables
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
    rl.question("Enter initial Admin password (leave blank to auto-generate): ", (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

export async function bootstrapOwner(options = {}) {
  const isDirectRun = options.isDirectRun ?? true;
  console.log("=================================================");
  console.log("    KASI AGRI AGENCIES - OWNER/ADMIN SETUP      ");
  console.log("=================================================");

  // Enforce security rule: no command line arguments containing passwords!
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
  const auditCollection = db.collection("auditlogs");

  // Check if an Owner account already exists
  const existingOwner = await usersCollection.findOne({ role: "OWNER" });
  if (existingOwner) {
    console.log("\n[STATUS] An Owner/Admin account already exists in the system:");
    console.log(`- Display Name: ${existingOwner.name}`);
    console.log(`- Username:     ${existingOwner.username}`);
    console.log(`- Email:        ${existingOwner.email}`);
    console.log(`- Role:         ${existingOwner.role}`);
    console.log(`- Status:       ${existingOwner.status}`);
    console.log("\n[SECURITY NOTICE] Existing Owner account was NOT modified.");
    console.log("Zero-overwrite policy guarantees existing administrative credentials are preserved.");
    console.log("To securely reset the owner password, run: npm run reset:owner\n");
    console.log("=================================================\n");

    if (isDirectRun) {
      await mongoose.disconnect();
      process.exit(0);
    }
    return { created: false, existingUser: existingOwner };
  }

  // Load configuration from environment variables or options
  const name = options.name || process.env.KASI_OWNER_NAME || "Admin";
  const username = (options.username || process.env.KASI_OWNER_USERNAME || "admin").toLowerCase().trim();
  const email = (options.email || process.env.KASI_OWNER_EMAIL || "admin@kasiagri.com").toLowerCase().trim();
  const phone = options.phone || process.env.KASI_OWNER_PHONE || "9842100000";

  let password = options.password || process.env.KASI_OWNER_INITIAL_PASSWORD || process.env.OWNER_INITIAL_PASSWORD;

  // Immediately clear raw password from process environment
  if (process.env.KASI_OWNER_INITIAL_PASSWORD) delete process.env.KASI_OWNER_INITIAL_PASSWORD;
  if (process.env.OWNER_INITIAL_PASSWORD) delete process.env.OWNER_INITIAL_PASSWORD;

  if (!password && process.stdin.isTTY && isDirectRun) {
    const interactive = await promptPasswordInteractive();
    if (interactive) {
      password = interactive;
    }
  }

  let wasGenerated = false;
  if (!password) {
    password = `Kasi@${crypto.randomBytes(8).toString("hex")}#${crypto.randomInt(10, 99)}`;
    wasGenerated = true;
  }

  console.log(`Hashing initial password with Argon2id for: ${name} (${username})...`);
  const passwordHash = await hash(password, ARGON2_OPTIONS);

  const ownerDoc = {
    name,
    username,
    email,
    phone,
    passwordHash,
    role: "OWNER",
    permissions: [],
    status: "ACTIVE",
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const result = await usersCollection.insertOne(ownerDoc);

  // Write audit trail strictly without passwords or sensitive hashes
  await auditCollection.insertOne({
    action: "OWNER_BOOTSTRAP",
    targetUserId: result.insertedId,
    targetUserName: name,
    details: { initialBootstrap: true, username },
    timestamp: new Date(),
  });

  console.log("\n[SUCCESS] Initial Owner/Admin account provisioned successfully:");
  console.log(`- Display Name: ${name}`);
  console.log(`- Username:     ${username}`);
  console.log(`- Email:        ${email}`);
  console.log(`- Role:         OWNER (Full system permissions)`);
  console.log(`- Status:       ACTIVE`);
  console.log(`- Security:     Argon2id hashed (Plaintext password never stored)`);

  if (wasGenerated) {
    console.log(`\n[NOTICE] Initial password was cryptographically generated.`);
    console.log(`If you did not configure KASI_OWNER_INITIAL_PASSWORD in .env.local,`);
    console.log(`set it in .env.local and run 'npm run reset:owner' to configure your preferred password.`);
  } else {
    console.log(`\n[NOTICE] Account configured with password provided via environment variable.`);
  }
  console.log("=================================================\n");

  if (isDirectRun) {
    await mongoose.disconnect();
    process.exit(0);
  }

  return { created: true, id: result.insertedId, username, email };
}

// Only auto-run if invoked directly via CLI (node scripts/bootstrap-owner.mjs)
if (process.argv[1] && process.argv[1].endsWith("bootstrap-owner.mjs")) {
  bootstrapOwner({ isDirectRun: true }).catch((err) => {
    console.error("Owner bootstrap failed:", err.message);
    process.exit(1);
  });
}
