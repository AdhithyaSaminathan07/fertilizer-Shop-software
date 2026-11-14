import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getCurrentUser, destroySession, clearSessionCookie, logAuditEvent, SESSION_COOKIE_NAME } from "@/lib/auth";
import { successResponse } from "@/lib/api-response";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const user = await getCurrentUser();
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    await destroySession(token);
  }

  await clearSessionCookie();

  if (user) {
    await logAuditEvent({
      action: "LOGOUT",
      userId: user.id,
      userName: user.name,
      ipAddress,
    });
  }

  return successResponse({ message: "Logged out successfully" });
}

