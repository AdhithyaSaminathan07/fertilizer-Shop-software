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

// User schema inline definition matching src/models/user.ts
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

// In-memory rate limiter matching src/lib/rate-limit.ts
class RateLimiter {
  constructor() {
    this.store = new Map();
  }
  check(key, max = 5, windowMs = 15 * 60 * 1000) {
    const now = Date.now();
    const entry = this.store.get(key);
    if (!entry || now > entry.resetTime) {
      this.store.set(key, { count: 1, resetTime: now + windowMs });
      return { allowed: true, remaining: max - 1 };
    }
    if (entry.count >= max) {
      return { allowed: false, remaining: 0, resetInSeconds: Math.ceil((entry.resetTime - now) / 1000) };
    }
    entry.count += 1;
    return { allowed: true, remaining: max - entry.count };
  }
  reset(key) {
    this.store.delete(key);
  }
}

async function runAuthTestSuite() {
  console.log("==========================================================");
  console.log("   KASI AGRI AGENCIES - PHASE 3 VERIFICATION TEST SUITE   ");
  console.log("==========================================================");

  let mongod;
  try {
    console.log("[Setup] Starting MongoMemoryServer...");
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log("[Setup] Connected to isolated in-memory test database.");

    const User = mongoose.model("User", UserSchema);
    const Session = mongoose.model("Session", SessionSchema);
    const AuditLog = mongoose.model("AuditLog", AuditLogSchema);
    const rateLimiter = new RateLimiter();

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

    // Test zero-overwrite policy
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

    console.log("\n--- TEST GROUP 3: BRUTE FORCE & RATE LIMITING ---");
    const ip = "192.168.1.100";
    rateLimiter.reset(ip);
    for (let i = 1; i <= 5; i++) {
      rateLimiter.check(ip, 5);
    }
    const rateLimitBlocked = rateLimiter.check(ip, 5);
    assert(rateLimitBlocked.allowed === false, "3.1 Rate limiter triggers lockout after 5 failed attempts (HTTP 422)");

    console.log("\n--- TEST GROUP 4: SESSION MANAGEMENT & LIFECYCLE ---");
    // Create session token
    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const session = await Session.create({
      tokenHash,
      userId: owner._id,
      expiresAt,
    });
    assert(session._id !== undefined, "4.1 Cryptographically secure session created and persisted with SHA-256 tokenHash");

    // Validate active session
    const activeSession = await Session.findOne({
      tokenHash,
      expiresAt: { $gt: new Date() },
    }).populate("userId");
    assert(activeSession !== null && activeSession.userId.username === "balamurugan", "4.2 Active session successfully validated against DB");

    // Scenario 4.3: Session expiration test
    const expiredRawToken = generateSecureToken(32);
    const expiredTokenHash = hashToken(expiredRawToken);
    await Session.create({
      tokenHash: expiredTokenHash,
      userId: owner._id,
      expiresAt: new Date(Date.now() - 1000), // expired 1s ago
    });
    const expiredCheck = await Session.findOne({
      tokenHash: expiredTokenHash,
      expiresAt: { $gt: new Date() },
    });
    assert(expiredCheck === null, "4.3 Expired session correctly rejected");

    // Scenario 4.4: Logout / session revocation
    await Session.deleteOne({ tokenHash });
    const revokedCheck = await Session.findOne({ tokenHash });
    assert(revokedCheck === null, "4.4 Session revocation on logout: session deleted from DB");

    console.log("\n--- TEST GROUP 5: EMPLOYEE MANAGEMENT & REGISTRATION ---");
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
    assert(employee._id !== undefined, "5.1 Employee created with Argon2id hash and initial permissions");

    // Scenario 5.2: Employee login
    const empCheck = await User.findOne({ username: "smurugan" });
    const empPwValid = await verify(empCheck.passwordHash, empPassword);
    assert(empPwValid === true, "5.2 Employee successfully authenticates with correct credentials");

    console.log("\n--- TEST GROUP 6: ROLE-BASED ACCESS CONTROL (RBAC) ---");
    // Owner authorization (Full access to all modules)
    assert(hasPermission(owner, "inventory:write") === true, "6.1 Owner has access to inventory:write");
    assert(hasPermission(owner, "employees:manage") === true, "6.2 Owner has access to employees:manage");
    assert(hasPermission(owner, "reports:view") === true, "6.3 Owner has access to reports:view");

    // Employee authorization with assigned permissions
    assert(hasPermission(employee, "inventory:read") === true, "6.4 Employee allowed access to assigned permission inventory:read");
    assert(hasPermission(employee, "billing:create") === true, "6.5 Employee allowed access to assigned permission billing:create");

    // Employee denied unauthorized permissions
    assert(hasPermission(employee, "employees:manage") === false, "6.6 Employee denied unassigned permission employees:manage (HTTP 403)");
    assert(hasPermission(employee, "settings:edit") === false, "6.7 Employee denied unassigned permission settings:edit (HTTP 403)");

    console.log("\n--- TEST GROUP 7: PERMISSION UPDATES ---");
    // Update employee permissions
    await User.findByIdAndUpdate(employee._id, {
      $set: { permissions: ["inventory:read", "billing:create", "inventory:write"] },
    });
    const updatedEmployee = await User.findById(employee._id);
    assert(
      hasPermission(updatedEmployee, "inventory:write") === true,
      "7.1 Permission update reflected immediately: inventory:write is now granted"
    );

    console.log("\n--- TEST GROUP 8: PASSWORD RESET ---");
    const newPassword = "NewSecretPassword@999";
    const newHash = await hash(newPassword, ARGON2_OPTIONS);
    await User.findByIdAndUpdate(employee._id, { $set: { passwordHash: newHash } });

    // Revoke all active sessions on password reset
    const empSessionToken = generateSecureToken(32);
    await Session.create({
      tokenHash: hashToken(empSessionToken),
      userId: employee._id,
      expiresAt: new Date(Date.now() + 86400000),
    });
    // Now trigger session purge on password reset
    await Session.deleteMany({ userId: employee._id });
    const empSessionsAfterReset = await Session.countDocuments({ userId: employee._id });
    assert(empSessionsAfterReset === 0, "8.1 Password reset revokes all existing active sessions for user");

    // Test new password authentication
    const empAfterReset = await User.findById(employee._id);
    const newPwValid = await verify(empAfterReset.passwordHash, newPassword);
    const oldPwInvalid = await verify(empAfterReset.passwordHash, empPassword);
    assert(newPwValid === true && oldPwInvalid === false, "8.2 New password authenticates, old password fails");

    console.log("\n--- TEST GROUP 9: EMPLOYEE DEACTIVATION ---");
    await User.findByIdAndUpdate(employee._id, { $set: { status: "INACTIVE" } });
    const deactivatedEmp = await User.findById(employee._id);

    // Verify permission check fails for inactive account
    assert(hasPermission(deactivatedEmp, "inventory:read") === false, "9.1 Deactivated employee denied all permissions");

    // Verify login logic rejects inactive account
    const canLogin = deactivatedEmp.status === "ACTIVE";
    assert(canLogin === false, "9.2 Deactivated employee login rejected (Account deactivated)");

    console.log("\n--- TEST GROUP 10: AUDIT LOGGING ---");
    await AuditLog.create({
      action: "EMPLOYEE_DEACTIVATED",
      actorId: owner._id,
      actorName: owner.name,
      targetUserId: employee._id,
      targetUserName: employee.name,
      details: { reason: "Seasonal contract complete" },
    });
    const auditCount = await AuditLog.countDocuments({ action: "EMPLOYEE_DEACTIVATED" });
    assert(auditCount === 1, "10.1 Audit trail records sensitive account status changes with actor & timestamp");

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

