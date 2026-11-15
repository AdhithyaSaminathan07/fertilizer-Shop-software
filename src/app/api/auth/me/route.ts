import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getCurrentUser(request);
  if (!user) {
    console.log("[Auth/Me] 401 Unauthorized: no valid session found for incoming request");
    return errorResponse("Unauthenticated", HTTP_STATUS.UNAUTHORIZED);
  }
  console.log(`[Auth/Me] 200 OK: session verified for '${user.username}' (${user.role})`);
  return successResponse({ user });
}

