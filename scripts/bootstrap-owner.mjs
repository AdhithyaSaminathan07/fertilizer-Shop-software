import mongoose from "mongoose";
import crypto from "crypto";
import { hash } from "@node-rs/argon2";
import fs from "fs";
import path from "path";

// Manually parse .env.local if present
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
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
}

loadEnv();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/kasi_agri";

const ARGON2_OPTIONS = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

async function bootstrapOwner() {
  console.log("=================================================");
  console.log("   KASI AGRI AGENCIES - OWNER BOOTSTRAP TOOL    ");
  console.log("=================================================");

  console.log("Connecting to database...");
  await mongoose.connect(MONGODB_URI, { bufferCommands: false });

  const db = mongoose.connection.db;
  const usersCollection = db.collection("users");
  const auditCollection = db.collection("auditlogs");

  // Enforce zero-overwrite security: check if any owner already exists
  const existingOwner = await usersCollection.findOne({ role: "OWNER" });
  if (existingOwner) {
    console.error("\n[SECURITY BLOCK] An Owner account already exists in the system:");
    console.error(`- Username: ${existingOwner.username}`);
    console.error(`- Name:     ${existingOwner.name}`);
    console.error("\nRecreating or overwriting an existing Owner is strictly prohibited.");
    console.error("To reset an owner password, contact system administrator directly via secure channel.");
    await mongoose.disconnect();
    process.exit(1);
  }

  // Parse CLI args or env
  const args = process.argv.slice(2);
  let password = process.env.OWNER_INITIAL_PASSWORD;
  for (const arg of args) {
    if (arg.startsWith("--password=")) {
      password = arg.split("=")[1];
    }
  }

  // If no password provided, generate a cryptographically strong 16-character password
  let wasGenerated = false;
  if (!password) {
    password = `Kasi@${crypto.randomBytes(6).toString("hex")}#${crypto.randomInt(10, 99)}`;
    wasGenerated = true;
  }

  const name = "R. Balamurugan";
  const username = "balamurugan";
  const email = "balamurugan@kasiagri.com";
  const phone = "9842100000";

  console.log(`Hashing password with Argon2id for Proprietor: ${name}...`);
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

  await auditCollection.insertOne({
    action: "OWNER_BOOTSTRAP",
    targetUserId: result.insertedId,
    targetUserName: name,
    details: { initialBootstrap: true, username },
    timestamp: new Date(),
  });

  console.log("\n[SUCCESS] Owner account bootstrapped securely:");
  console.log(`- Proprietor: ${name}`);
  console.log(`- Username:   ${username}`);
  console.log(`- Email:      ${email}`);
  console.log(`- Role:       OWNER (Full system permissions)`);
  console.log(`- Status:     ACTIVE`);
  if (wasGenerated) {
    console.log(`\n>>> SECURE GENERATED INITIAL PASSWORD: [ ${password} ]`);
    console.log(">>> Please record this initial password securely. It will not be shown again.");
  } else {
    console.log("\n>>> Initial password has been set from environment/arguments.");
  }
  console.log("=================================================\n");

  await mongoose.disconnect();
  process.exit(0);
}

bootstrapOwner().catch((err) => {
  console.error("Owner bootstrap failed:", err);
  process.exit(1);
});

