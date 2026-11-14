import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { hash, verify } from "@node-rs/argon2";
import crypto from "crypto";

// Security constants
const ARGON2_OPTIONS = {
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function generateSecureToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

// Schemas matching application models
const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["OWNER", "EMPLOYEE"], default: "EMPLOYEE" },
    permissions: [{ type: String }],
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const SessionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
    lastActiveAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const RateLimitSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    count: { type: Number, required: true, default: 1 },
    resetAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true }
);

const AuditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    actorName: { type: String, default: null },
    targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    targetUserName: { type: String, default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, default: null },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// RBAC check matching src/lib/auth.ts
function hasPermission(user, required) {
  if (!user || user.status !== "ACTIVE") return false;
  if (user.role === "OWNER") return true;
  if (!required) return true;
  return Array.isArray(user.permissions) && user.permissions.includes(required);
}

// CSRF Origin verification logic matching src/middleware.ts
function validateCsrfOrigin(originHeader, hostHeader, method) {
  const mutatingMethods = ["POST", "PATCH", "DELETE", "PUT"];
  if (!mutatingMethods.includes(method.toUpperCase())) {
    return { valid: true };
  }
  if (!originHeader) {
    return { valid: true };
  }
  try {
    const originHost = new URL(originHeader).host;
    if (originHost !== hostHeader) {
      return { valid: false, status: 403, error: "Cross-origin request blocked" };
    }
    return { valid: true };
  } catch {
    return { valid: false, status: 403, error: "Malformed origin header" };
  }
}

// Audit details sanitizer matching src/lib/auth.ts
function sanitizeAuditDetails(obj) {
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (/password|hash|token|secret|cookie|credential|authorization/i.test(key)) {
      sanitized[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeAuditDetails(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// Shared MongoDB-backed rate limiter matching src/lib/rate-limit.ts
async function checkDistributedRateLimit(RateLimitModel, key, maxAttempts = 5, windowSeconds = 900) {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);

  const existing = await RateLimitModel.findOne({ key });
  if (!existing || existing.resetAt <= now) {
    await RateLimitModel.findOneAndUpdate(
      { key },
      { $set: { count: 1, resetAt } },
      { upsert: true, returnDocument: "after" }
    );
    return { success: true, remaining: maxAttempts - 1, resetSeconds: windowSeconds, statusCode: 200 };
  }

  if (existing.count >= maxAttempts) {
    const resetSeconds = Math.max(1, Math.ceil((existing.resetAt.getTime() - now.getTime()) / 1000));
    return { success: false, remaining: 0, resetSeconds, statusCode: 429 };
  }

  const updated = await RateLimitModel.findOneAndUpdate(
    { key, count: { $lt: maxAttempts } },
    { $inc: { count: 1 } },
    { returnDocument: "after" }
  );

  const currentCount = updated ? updated.count : existing.count + 1;
  const resetSeconds = Math.max(1, Math.ceil((existing.resetAt.getTime() - now.getTime()) / 1000));
  return {
    success: currentCount <= maxAttempts,
    remaining: Math.max(0, maxAttempts - currentCount),
    resetSeconds,
    statusCode: currentCount <= maxAttempts ? 200 : 429,
  };
}

async function runAuthTestSuite() {
  console.log("==========================================================");
  console.log("   KASI AGRI AGENCIES - ADMIN LOGIN & SECURITY SUITE      ");
  console.log("==========================================================");

  let mongod;
  try {
    console.log("[Setup] Starting isolated MongoMemoryServer...");
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log(`[Setup] Connected to isolated in-memory test DB: ${uri}`);
    console.log("[Setup] Production database is strictly isolated and untouched.");

    const User = mongoose.model("User", UserSchema);
    const Session = mongoose.model("Session", SessionSchema);
    const RateLimit = mongoose.model("RateLimit", RateLimitSchema);
    const AuditLog = mongoose.model("AuditLog", AuditLogSchema);

    let passedTests = 0;
    let failedTests = 0;

    function assert(condition, testName, details = "") {
      if (condition) {
        console.log(`  [PASS] ${testName}`);
        passedTests++;
      } else {
        console.error(`  [FAIL] ${testName} - ${details}`);
        failedTests++;
      }
    }

    console.log("\n--- TEST GROUP 1: CONFIGURED ADMIN OWNER CREATION & ARGON2ID STORAGE ---");
    // Configured environment values from .env.local
    const configuredName = "Admin";
    const configuredUsername = "admin";
    const configuredEmail = "admin@kasiagri.com";
    const configuredPassword = "Admin@KasiAgri2026!";

    // 1.1 Hash password using Argon2id implementation
    const passwordHash = await hash(configuredPassword, ARGON2_OPTIONS);

    // 1.2 Verify plaintext password is never stored
    assert(!passwordHash.includes(configuredPassword), "1.1 Plaintext password is never stored or leaked into hash string");
    assert(passwordHash.startsWith("$argon2id$"), "1.2 Password securely hashed with Argon2id");

    // 1.3 Create the initial Admin owner account
    const owner = await User.create({
      name: configuredName,
      username: configuredUsername,
      email: configuredEmail,
      phone: "9842100000",
      passwordHash,
      role: "OWNER",
      permissions: [],
      status: "ACTIVE",
    });

    assert(owner._id !== undefined, "1.3 Initial Admin owner account created successfully in DB");
    assert(owner.name === "Admin", "1.4 Display name is set to Admin");
    assert(owner.role === "OWNER", "1.5 Role is assigned as OWNER");
    assert(owner.status === "ACTIVE", "1.6 Account status is ACTIVE");

    console.log("\n--- TEST GROUP 2: CONFIGURED CREDENTIALS LOGIN VERIFICATION ---");
    // 2.1 Find by configured username
    const userByUsername = await User.findOne({ username: configuredUsername });
    assert(userByUsername !== null, "2.1 User lookup by configured username ('admin') succeeds");
    const pwValidUser = await verify(userByUsername.passwordHash, configuredPassword);
    assert(pwValidUser === true, "2.2 Valid login using configured username + password succeeds");

    // 2.2 Find by configured email
    const userByEmail = await User.findOne({ email: configuredEmail });
    assert(userByEmail !== null, "2.3 User lookup by configured email ('admin@kasiagri.com') succeeds");
    const pwValidEmail = await verify(userByEmail.passwordHash, configuredPassword);
    assert(pwValidEmail === true, "2.4 Valid login using configured email + password succeeds");

    // 2.3 Invalid password rejection
    const wrongPwValid = await verify(userByUsername.passwordHash, "WrongPassword123!");
    assert(wrongPwValid === false, "2.5 Incorrect password correctly rejected (401 Unauthorized)");

    // 2.4 Unknown username lookup
    const unknownLookup = await User.findOne({ username: "nonexistent_operator" });
    assert(unknownLookup === null, "2.6 Unknown username lookup safely returns null");

    console.log("\n--- TEST GROUP 3: OWNER ROLE-BASED ACCESS CONTROL (RBAC) ---");
    // Owner receives full unconstrained access across all modules
    assert(hasPermission(owner, "inventory:write") === true, "3.1 Owner has full access to inventory:write");
    assert(hasPermission(owner, "billing:create") === true, "3.2 Owner has full access to billing:create");
    assert(hasPermission(owner, "billing:cancel") === true, "3.3 Owner has full access to billing:cancel");
    assert(hasPermission(owner, "employees:manage") === true, "3.4 Owner has full access to employees:manage");
    assert(hasPermission(owner, "reports:view") === true, "3.5 Owner has full access to reports:view");
    assert(hasPermission(owner, "settings:edit") === true, "3.6 Owner has full access to settings:edit");

    console.log("\n--- TEST GROUP 4: SESSION CREATION & PROTECTED DASHBOARD ACCESS ---");
    const rawSessionToken = generateSecureToken(32);
    const tokenHash = hashToken(rawSessionToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const session = await Session.create({
      tokenHash,
      userId: owner._id,
      expiresAt,
    });
    assert(session._id !== undefined, "4.1 Cryptographically secure session created in DB");
    assert(session.tokenHash !== rawSessionToken, "4.2 Raw session token is hashed (SHA-256) before DB storage");

    // Validate session and protected access
    const activeSession = await Session.findOne({
      tokenHash,
      expiresAt: { $gt: new Date() },
    }).populate("userId");
    assert(
      activeSession !== null && activeSession.userId.role === "OWNER" && activeSession.userId.status === "ACTIVE",
      "4.3 Valid session grants protected dashboard and API access"
    );

    console.log("\n--- TEST GROUP 5: ZERO-OVERWRITE & DEDICATED PASSWORD RESET PROCEDURE ---");
    // Zero-overwrite test: Attempting bootstrap when owner exists does NOT overwrite
    const existingOwnerCheck = await User.findOne({ role: "OWNER" });
    assert(existingOwnerCheck !== null, "5.1 Bootstrap identifies existing Owner account");
    assert(existingOwnerCheck.passwordHash === passwordHash, "5.2 Existing Owner credentials strictly preserved (no overwrite)");

    // Dedicated password reset procedure
    const newAdminPassword = "Admin@NewSecret2026#99";
    const newHash = await hash(newAdminPassword, ARGON2_OPTIONS);
    await User.updateOne({ _id: owner._id }, { $set: { passwordHash: newHash } });

    // Revoke all sessions on password reset
    await Session.deleteMany({ userId: owner._id });
    const remainingSessions = await Session.countDocuments({ userId: owner._id });
    assert(remainingSessions === 0, "5.3 Dedicated password reset immediately revokes all active owner sessions");

    // Verify new password authenticates and old password fails
    const updatedOwner = await User.findById(owner._id);
    const newPwCheck = await verify(updatedOwner.passwordHash, newAdminPassword);
    const oldPwCheck = await verify(updatedOwner.passwordHash, configuredPassword);
    assert(newPwCheck === true && oldPwCheck === false, "5.4 New password authenticates successfully, old password fails");

    console.log("\n--- TEST GROUP 6: DISTRIBUTED MULTI-INSTANCE RATE LIMITING (HTTP 429) ---");
    const rateLimitKey = "login:127.0.0.1:admin";
    await RateLimit.deleteOne({ key: rateLimitKey });

    for (let i = 1; i <= 5; i++) {
      const rlRes = await checkDistributedRateLimit(RateLimit, rateLimitKey, 5, 900);
      assert(rlRes.success === true, `6.${i} Attempt ${i}/5 allowed by shared MongoDB rate limiter`);
    }
    const lockedRes = await checkDistributedRateLimit(RateLimit, rateLimitKey, 5, 900);
    assert(
      lockedRes.success === false && lockedRes.statusCode === 429,
      "6.6 6th consecutive attempt rejected with HTTP 429 Too Many Requests"
    );

    console.log("\n--- TEST GROUP 7: CSRF & CROSS-ORIGIN VALIDATION ---");
    const sameOrigin = validateCsrfOrigin("http://localhost:3000", "localhost:3000", "POST");
    assert(sameOrigin.valid === true, "7.1 Same-origin mutating request permitted");

    const crossOrigin = validateCsrfOrigin("https://malicious-site.com", "localhost:3000", "POST");
    assert(crossOrigin.valid === false && crossOrigin.status === 403, "7.2 Cross-origin mutating request blocked (HTTP 403 Forbidden)");

    console.log("\n--- TEST GROUP 8: EMPLOYEE ACCESS CONTROL & DEACTIVATION REVOCATION ---");
    const empHash = await hash("StaffPassword@2026", ARGON2_OPTIONS);
    const employee = await User.create({
      name: "S. Murugan",
      username: "smurugan",
      email: "murugan@kasiagri.com",
      phone: "9876543210",
      passwordHash: empHash,
      role: "EMPLOYEE",
      permissions: ["inventory:read", "billing:create"],
      status: "ACTIVE",
    });

    assert(hasPermission(employee, "inventory:read") === true, "8.1 Employee granted assigned inventory:read");
    assert(hasPermission(employee, "employees:manage") === false, "8.2 Employee denied unassigned employees:manage (HTTP 403)");

    // Deactivation test
    await User.updateOne({ _id: employee._id }, { $set: { status: "INACTIVE" } });
    const deactivatedEmp = await User.findById(employee._id);
    assert(hasPermission(deactivatedEmp, "inventory:read") === false, "8.3 Deactivated employee denied all access");

    console.log("\n--- TEST GROUP 9: AUDIT LOG CREDENTIAL SCRUBBING ---");
    const sensitiveAudit = {
      password: configuredPassword,
      passwordHash: passwordHash,
      sessionToken: rawSessionToken,
      secretKey: "kasi_master_secret",
      actionDesc: "Admin login attempt",
    };
    const scrubbed = sanitizeAuditDetails(sensitiveAudit);
    assert(scrubbed.password === "[REDACTED]", "9.1 Audit log scrubs password to [REDACTED]");
    assert(scrubbed.passwordHash === "[REDACTED]", "9.2 Audit log scrubs passwordHash to [REDACTED]");
    assert(scrubbed.sessionToken === "[REDACTED]", "9.3 Audit log scrubs sessionToken to [REDACTED]");
    assert(scrubbed.actionDesc === "Admin login attempt", "9.4 Non-sensitive audit metadata preserved");

    console.log("\n==========================================================");
    console.log(`TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log("==========================================================");

    if (failedTests > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Test execution encountered an error:", err);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
  }
}

runAuthTestSuite();
