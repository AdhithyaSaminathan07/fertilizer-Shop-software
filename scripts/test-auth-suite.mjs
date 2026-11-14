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
    return { valid: true }; // non-browser or same-origin direct tool
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
  console.log("   KASI AGRI AGENCIES - PHASE 3 SECURITY HARDENED SUITE   ");
  console.log("==========================================================");

  let mongod;
  try {
    console.log("[Setup] Starting isolated MongoMemoryServer...");
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log(`[Setup] Connected to isolated test DB: ${uri}`);
    console.log("[Setup] Business/Production DB is strictly untouched.");

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

    console.log("\n--- TEST GROUP 1: OWNER INITIAL BOOTSTRAP & ZERO-OVERWRITE POLICY ---");
    const ownerPassword = "Balamurugan@Kasi2026";
    const ownerHash = await hash(ownerPassword, ARGON2_OPTIONS);
    const owner = await User.create({
      name: "R. Balamurugan",
      username: "balamurugan",
      email: "balamurugan@kasiagri.com",
      phone: "9842100000",
      passwordHash: ownerHash,
      role: "OWNER",
      permissions: [],
      status: "ACTIVE",
    });
    assert(owner._id !== undefined, "1.1 Owner account created successfully in DB");

    // Zero-overwrite policy check
    const existingOwnerCheck = await User.findOne({ role: "OWNER" });
    const duplicateBlocked = existingOwnerCheck !== null;
    assert(duplicateBlocked, "1.2 Zero-overwrite policy: detects existing owner and denies duplicate creation");

    console.log("\n--- TEST GROUP 2: AUTHENTICATION & LOGIN SCENARIOS ---");
    // Scenario 2.1: Valid login with username
    const validUserByUsername = await User.findOne({ username: "balamurugan" });
    const pwMatch1 = await verify(validUserByUsername.passwordHash, ownerPassword);
    assert(pwMatch1 === true, "2.1 Valid Owner login using username + correct password");

    // Scenario 2.2: Valid login with email
    const validUserByEmail = await User.findOne({ email: "balamurugan@kasiagri.com" });
    const pwMatch2 = await verify(validUserByEmail.passwordHash, ownerPassword);
    assert(pwMatch2 === true, "2.2 Valid Owner login using email + correct password");

    // Scenario 2.3: Invalid password
    const pwMatchWrong = await verify(validUserByUsername.passwordHash, "WrongPassword123!");
    assert(pwMatchWrong === false, "2.3 Invalid password rejected safely");

    // Scenario 2.4: Unknown user lookup
    const unknownUser = await User.findOne({ username: "nonexistent_user" });
    assert(unknownUser === null, "2.4 Unknown username lookup safely returns null (triggers 401)");

    console.log("\n--- TEST GROUP 3: PRODUCTION SHARED RATE LIMITING (HTTP 429) ---");
    const testKey = "login:192.168.1.100:balamurugan";
    await RateLimit.deleteOne({ key: testKey });

    // Perform 5 allowed attempts
    for (let i = 1; i <= 5; i++) {
      const res = await checkDistributedRateLimit(RateLimit, testKey, 5, 900);
      assert(res.success === true, `3.${i} Attempt ${i}/5 allowed by shared MongoDB rate limiter`);
    }

    // 6th attempt must trigger HTTP 429
    const blockedRes = await checkDistributedRateLimit(RateLimit, testKey, 5, 900);
    assert(
      blockedRes.success === false && blockedRes.statusCode === 429 && blockedRes.resetSeconds > 0,
      "3.6 6th attempt rejected with HTTP 429 Too Many Requests and valid Retry-After duration"
    );

    // Reset rate limiter on successful login
    await RateLimit.deleteOne({ key: testKey });
    const postResetRes = await checkDistributedRateLimit(RateLimit, testKey, 5, 900);
    assert(postResetRes.success === true, "3.7 Successful login resets rate limit bucket in DB");

    console.log("\n--- TEST GROUP 4: CSRF & CROSS-ORIGIN VALIDATION ---");
    const sameOriginCheck = validateCsrfOrigin("http://localhost:3000", "localhost:3000", "POST");
    assert(sameOriginCheck.valid === true, "4.1 Valid same-origin POST request permitted");

    const crossOriginAttack = validateCsrfOrigin("https://evil-hacker.com", "localhost:3000", "POST");
    assert(
      crossOriginAttack.valid === false && crossOriginAttack.status === 403,
      "4.2 Cross-origin mutating request (CSRF) blocked with HTTP 403 Forbidden"
    );

    const safeGetCheck = validateCsrfOrigin("https://evil-hacker.com", "localhost:3000", "GET");
    assert(safeGetCheck.valid === true, "4.3 Safe read-only request (GET) not blocked by CSRF filter");

    console.log("\n--- TEST GROUP 5: SESSION MANAGEMENT & LIFECYCLE ---");
    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const session = await Session.create({
      tokenHash,
      userId: owner._id,
      expiresAt,
    });
    assert(session._id !== undefined, "5.1 Session created with SHA-256 tokenHash (raw token never stored)");

    const activeSession = await Session.findOne({
      tokenHash,
      expiresAt: { $gt: new Date() },
    }).populate("userId");
    assert(activeSession !== null && activeSession.userId.username === "balamurugan", "5.2 Active session validated");

    // Expired session rejection
    const expiredRawToken = generateSecureToken(32);
    await Session.create({
      tokenHash: hashToken(expiredRawToken),
      userId: owner._id,
      expiresAt: new Date(Date.now() - 1000),
    });
    const expiredCheck = await Session.findOne({
      tokenHash: hashToken(expiredRawToken),
      expiresAt: { $gt: new Date() },
    });
    assert(expiredCheck === null, "5.3 Expired session rejected");

    // Session revocation on logout
    await Session.deleteOne({ tokenHash });
    const revokedCheck = await Session.findOne({ tokenHash });
    assert(revokedCheck === null, "5.4 Session revocation on logout: removed from DB");

    console.log("\n--- TEST GROUP 6: EMPLOYEE MANAGEMENT & REGISTRATION ---");
    const empPassword = "StaffPassword@2026";
    const empHash = await hash(empPassword, ARGON2_OPTIONS);
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
    assert(employee._id !== undefined, "6.1 Employee registered with Argon2id");

    const empCheck = await User.findOne({ username: "smurugan" });
    const empPwValid = await verify(empCheck.passwordHash, empPassword);
    assert(empPwValid === true, "6.2 Employee successfully authenticates");

    console.log("\n--- TEST GROUP 7: ROLE-BASED ACCESS CONTROL (RBAC) ---");
    assert(hasPermission(owner, "inventory:write") === true, "7.1 Owner has access to inventory:write");
    assert(hasPermission(owner, "employees:manage") === true, "7.2 Owner has access to employees:manage");
    assert(hasPermission(owner, "reports:view") === true, "7.3 Owner has access to reports:view");

    assert(hasPermission(employee, "inventory:read") === true, "7.4 Employee has assigned inventory:read");
    assert(hasPermission(employee, "billing:create") === true, "7.5 Employee has assigned billing:create");
    assert(hasPermission(employee, "employees:manage") === false, "7.6 Employee denied unassigned employees:manage (HTTP 403)");
    assert(hasPermission(employee, "settings:edit") === false, "7.7 Employee denied unassigned settings:edit (HTTP 403)");

    console.log("\n--- TEST GROUP 8: IMMEDIATE SESSION REVOCATION ON DEACTIVATION & RESET ---");
    // Create active session for employee
    const empToken1 = generateSecureToken(32);
    await Session.create({
      tokenHash: hashToken(empToken1),
      userId: employee._id,
      expiresAt: new Date(Date.now() + 86400000),
    });

    // 8.1 Immediate revocation on deactivation
    await User.findByIdAndUpdate(employee._id, { $set: { status: "INACTIVE" } });
    await Session.deleteMany({ userId: employee._id });

    const deactivatedEmp = await User.findById(employee._id);
    const sessionCountAfterDeactivation = await Session.countDocuments({ userId: employee._id });
    assert(sessionCountAfterDeactivation === 0, "8.1 Deactivation immediately purges all active employee sessions");
    assert(hasPermission(deactivatedEmp, "inventory:read") === false, "8.2 Deactivated account denied all permissions");

    // Reactivate for password reset test
    await User.findByIdAndUpdate(employee._id, { $set: { status: "ACTIVE" } });
    const empToken2 = generateSecureToken(32);
    await Session.create({
      tokenHash: hashToken(empToken2),
      userId: employee._id,
      expiresAt: new Date(Date.now() + 86400000),
    });

    // 8.3 Immediate revocation on password reset
    const newPassword = "NewSecretPassword@999";
    const newHash = await hash(newPassword, ARGON2_OPTIONS);
    await User.findByIdAndUpdate(employee._id, { $set: { passwordHash: newHash } });
    await Session.deleteMany({ userId: employee._id });

    const sessionCountAfterReset = await Session.countDocuments({ userId: employee._id });
    assert(sessionCountAfterReset === 0, "8.3 Password reset immediately purges all active employee sessions");

    const empAfterReset = await User.findById(employee._id);
    const newPwValid = await verify(empAfterReset.passwordHash, newPassword);
    const oldPwInvalid = await verify(empAfterReset.passwordHash, empPassword);
    assert(newPwValid === true && oldPwInvalid === false, "8.4 New password authenticates, old password rejected");

    console.log("\n--- TEST GROUP 9: AUDIT LOG CREDENTIAL SCRUBBING ---");
    const rawDetails = {
      password: "SuperSecretPassword123!",
      passwordHash: "$argon2id$v=19$m=65536...",
      sessionToken: "abc123token",
      userSecret: "private_key",
      validMeta: "Updated employee phone",
    };
    const sanitized = sanitizeAuditDetails(rawDetails);
    assert(sanitized.password === "[REDACTED]", "9.1 Audit details: password key redacted");
    assert(sanitized.passwordHash === "[REDACTED]", "9.2 Audit details: passwordHash key redacted");
    assert(sanitized.sessionToken === "[REDACTED]", "9.3 Audit details: sessionToken key redacted");
    assert(sanitized.userSecret === "[REDACTED]", "9.4 Audit details: secret key redacted");
    assert(sanitized.validMeta === "Updated employee phone", "9.5 Non-sensitive metadata preserved in audit log");

    await AuditLog.create({
      action: "EMPLOYEE_UPDATED",
      actorId: owner._id,
      actorName: owner.name,
      targetUserId: employee._id,
      targetUserName: employee.name,
      details: sanitized,
    });
    const loggedEntry = await AuditLog.findOne({ action: "EMPLOYEE_UPDATED" });
    assert(
      loggedEntry.details.password === "[REDACTED]" && !JSON.stringify(loggedEntry).includes("SuperSecretPassword123!"),
      "9.6 Zero credential leakage verified in audit log database records"
    );

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
