import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models/user";
import { verifyPassword } from "@/lib/security";
import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";
import { createSession, setSessionCookie, logAuditEvent, toSafeUser } from "@/lib/auth";
import { loginSchema } from "@/validations/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const userAgent = request.headers.get("user-agent") || undefined;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", HTTP_STATUS.BAD_REQUEST);
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
  }

  const { identifier, password } = parsed.data;
  const rateLimitKey = `login:${ipAddress}:${identifier.toLowerCase()}`;
  const rateLimit = await checkRateLimit(rateLimitKey, 5, 15 * 60);

  if (!rateLimit.success) {
    return NextResponse.json(
      {
        success: false,
        error: `Too many failed login attempts. Please try again in ${rateLimit.resetSeconds} seconds.`,
        timestamp: new Date().toISOString(),
      },
      {
        status: HTTP_STATUS.TOO_MANY_REQUESTS,
        headers: {
          "Retry-After": String(rateLimit.resetSeconds),
        },
      }
    );
  }

  await connectDB();

  // Find user by username or email, explicitly selecting passwordHash
  const user = await User.findOne({
    $or: [
      { username: identifier.toLowerCase() },
      { email: identifier.toLowerCase() },
    ],
  }).select("+passwordHash");

  if (!user) {
    await logAuditEvent({
      action: "LOGIN_FAILED",
      details: { reason: "User not found", identifierMasked: identifier.slice(0, 3) + "***" },
      ipAddress,
    });
    return errorResponse("Invalid username/email or password", HTTP_STATUS.UNAUTHORIZED);
  }

  // Check account active status
  if (user.status !== "ACTIVE") {
    await logAuditEvent({
      action: "LOGIN_FAILED",
      userId: user._id.toString(),
      userName: user.name,
      details: { reason: "Account inactive" },
      ipAddress,
    });
    return errorResponse(
      "Your account is inactive. Please contact proprietor R. Balamurugan.",
      HTTP_STATUS.FORBIDDEN
    );
  }

  // Verify Argon2id password hash
  const isValidPassword = await verifyPassword(user.passwordHash, password);
  if (!isValidPassword) {
    await logAuditEvent({
      action: "LOGIN_FAILED",
      userId: user._id.toString(),
      userName: user.name,
      details: { reason: "Invalid password" },
      ipAddress,
    });
    return errorResponse("Invalid username/email or password", HTTP_STATUS.UNAUTHORIZED);
  }

  // Login successful: reset rate limit counter
  await resetRateLimit(rateLimitKey);

  // Update last login timestamp
  user.lastLoginAt = new Date();
  await user.save();

  // Create session and set HTTP-only cookie
  const { rawToken, expiresAt } = await createSession(user._id.toString(), {
    ip: ipAddress,
    userAgent,
  });

  await setSessionCookie(rawToken, expiresAt);

  // Log successful login in audit log
  await logAuditEvent({
    action: "LOGIN_SUCCESS",
    userId: user._id.toString(),
    userName: user.name,
    ipAddress,
    details: { role: user.role },
  });

  const safeUser = toSafeUser(user);
  return successResponse({ user: safeUser, message: "Authentication successful" });
}

