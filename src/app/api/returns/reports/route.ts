import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { getReturnsReports } from "@/services/returns-overview.service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "returns:view") && !hasPermission(currentUser, "reports:view")) {
    return errorResponse(
      "Forbidden: You lack permission to view returns reports",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;

  try {
    const reports = await getReturnsReports({ startDate, endDate });
    return successResponse(reports);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load returns reports",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

