import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { User, type IUser } from "@/models/user";
import { Session } from "@/models/session";
import { AuditLog } from "@/models/audit-log";
import { generateSecureToken, hashToken } from "@/lib/security";
import type { SafeUser, Permission, AuditAction } from "@/types/auth";

export const SESSION_COOKIE_NAME = "kasi_session";
export const SESSION_COOKIE_ALIAS = "kasi_session_token";
export const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60; // 7 days

/**
 * Maps a Mongoose User document to a safe, sanitized User object.
 * Strictly strips password hashes and sensitive internal fields.
 */
export function toSafeUser(user: IUser): SafeUser {
  return {
    id: user._id.toString(),
    name: user.name,
    username: user.username,
    email: user.email,
    phone: user.phone || undefined,
    role: user.role,
    permissions: user.permissions || [],
    status: user.status,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : undefined,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

/**
 * Creates a new session in MongoDB and returns the raw unhashed token for the HTTP cookie.
 */
export async function createSession(
  userId: string,
  reqDetails?: { ip?: string; userAgent?: string }
): Promise<{ rawToken: string; expiresAt: Date }> {
  await connectDB();

  const rawToken = generateSecureToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);

  await Session.create({
    tokenHash,
    userId: new mongoose.Types.ObjectId(userId),
    expiresAt,
    ipAddress: reqDetails?.ip,
    userAgent: reqDetails?.userAgent,
  });

  return { rawToken, expiresAt };
}

/**
 * Validates a raw session token against MongoDB.
 * Enforces account status checks and automatic revocation if deactivated.
 */
export async function validateSessionToken(rawToken: string): Promise<SafeUser | null> {
  if (!rawToken || rawToken.trim() === "") {
    return null;
  }

  await connectDB();
  const tokenHash = hashToken(rawToken);

  const session = await Session.findOne({
    tokenHash,
    expiresAt: { $gt: new Date() },
  });

  if (!session) {
    return null;
  }

  const user = await User.findById(session.userId);

  // If user does not exist or has been deactivated, immediately revoke the session
  if (!user || user.status !== "ACTIVE") {
    await Session.deleteOne({ _id: session._id });
    return null;
  }

  return toSafeUser(user);
}

/**
 * Revokes a single session by its raw token.
 */
export async function destroySession(rawToken: string): Promise<void> {
  if (!rawToken) return;
  await connectDB();
  const tokenHash = hashToken(rawToken);
  await Session.deleteOne({ tokenHash });
}

/**
 * Revokes all sessions for a specific user (e.g., on password reset or deactivation).
 */
export async function destroyAllUserSessions(userId: string): Promise<void> {
  await connectDB();
  await Session.deleteMany({ userId: new mongoose.Types.ObjectId(userId) });
}

/**
 * Retrieves the currently authenticated user from request cookies or Next.js headers store.
 * Supports both `kasi_session` and `kasi_session_token` cookie names and Bearer authorization.
 * Safe for use in Server Components and API Route Handlers.
 */
export async function getCurrentUser(req?: NextRequest): Promise<SafeUser | null> {
  try {
    let rawToken: string | undefined;

    // 1. Direct inspection from NextRequest if available
    if (req) {
      rawToken =
        req.cookies.get(SESSION_COOKIE_NAME)?.value ||
        req.cookies.get(SESSION_COOKIE_ALIAS)?.value;

      if (!rawToken) {
        const authHeader = req.headers.get("authorization");
        if (authHeader && authHeader.startsWith("Bearer ")) {
          rawToken = authHeader.slice(7).trim();
        }
      }
    }

    // 2. Next.js asynchronous cookieStore fallback
    if (!rawToken) {
      const cookieStore = await cookies();
      const tokenCookie =
        cookieStore.get(SESSION_COOKIE_NAME) ||
        cookieStore.get(SESSION_COOKIE_ALIAS);
      rawToken = tokenCookie?.value;
    }

    if (!rawToken || rawToken.trim() === "") {
      return null;
    }

    return await validateSessionToken(rawToken);
  } catch {
    return null;
  }
}

/**
 * Sets the secure session cookie on the outgoing response.
 * Sets both standard `kasi_session` and `kasi_session_token` for seamless compatibility.
 */
export async function setSessionCookie(rawToken: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  const isProd = process.env.NODE_ENV === "production";
  const cookieOptions = {
    httpOnly: true,
    secure: isProd && process.env.COOKIE_SECURE !== "false",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };

  cookieStore.set(SESSION_COOKIE_NAME, rawToken, cookieOptions);
  cookieStore.set(SESSION_COOKIE_ALIAS, rawToken, cookieOptions);
}

/**
 * Clears the session cookies on the outgoing response.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  const isProd = process.env.NODE_ENV === "production";
  const clearOptions = {
    httpOnly: true,
    secure: isProd && process.env.COOKIE_SECURE !== "false",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  };

  cookieStore.set(SESSION_COOKIE_NAME, "", clearOptions);
  cookieStore.set(SESSION_COOKIE_ALIAS, "", clearOptions);
}

/**
 * Server-side permission check helper.
 * The OWNER role always has full access to every module.
 * EMPLOYEE role must have the specific permission explicitly granted.
 */
export function hasPermission(user: SafeUser | null, permission: Permission): boolean {
  if (!user || user.status !== "ACTIVE") {
    return false;
  }
  if (user.role === "OWNER") {
    return true;
  }
  if (user.permissions.includes(permission)) {
    return true;
  }
  // Seamless aliases for inventory permissions
  if (permission === "inventory:read" && user.permissions.includes("inventory:view" as Permission)) {
    return true;
  }
  if (permission === "inventory:write" && user.permissions.includes("inventory:manage" as Permission)) {
    return true;
  }
  if (permission === "inventory:delete" && user.permissions.includes("inventory:manage" as Permission)) {
    return true;
  }
  return false;
}

/**
 * Recursively sanitizes audit log details to guarantee credentials, hashes, and tokens are NEVER stored.
 */
function sanitizeAuditDetails(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (/password|hash|token|secret|cookie|credential|authorization/i.test(key)) {
      sanitized[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      sanitized[key] = sanitizeAuditDetails(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Records an audit log event in MongoDB.
 */
export async function logAuditEvent(params: {
  action: AuditAction;
  userId?: string;
  userName?: string;
  targetUserId?: string;
  targetUserName?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  try {
    await connectDB();
    await AuditLog.create({
      action: params.action,
      userId: params.userId ? new mongoose.Types.ObjectId(params.userId) : undefined,
      userName: params.userName,
      targetUserId: params.targetUserId ? new mongoose.Types.ObjectId(params.targetUserId) : undefined,
      targetUserName: params.targetUserName,
      details: params.details ? sanitizeAuditDetails(params.details) : {},
      ipAddress: params.ipAddress,
      timestamp: new Date(),
    });
  } catch (err) {
    // Audit logging should not crash the main thread, but should log error securely
    console.error("Failed to write audit log:", err instanceof Error ? err.message : "Unknown error");
  }
}

