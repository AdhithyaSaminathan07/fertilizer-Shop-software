import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser, destroySession, clearSessionCookie, logAuditEvent, SESSION_COOKIE_NAME } from "@/lib/auth";
import { successResponse } from "@/lib/api-response";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const user = await getCurrentUser(request);
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value || (await cookies()).get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await destroySession(token);
  }

  const response = successResponse({ message: "Logged out successfully" });
  await clearSessionCookie(response);

  if (user) {
    await logAuditEvent({
      action: "LOGOUT",
      userId: user.id,
      userName: user.name,
      ipAddress,
    });
  }

  console.log(`[Auth/Logout] Session revoked and cookie '${SESSION_COOKIE_NAME}' cleared.`);
  return response;
}

