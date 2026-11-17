import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { getReturnsDashboardOverview } from "@/services/returns-overview.service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "returns:view") && !hasPermission(currentUser, "billing:view")) {
    return errorResponse(
      "Forbidden: You lack permission to view returns overview",
      HTTP_STATUS.FORBIDDEN
    );
  }

  try {
    const overview = await getReturnsDashboardOverview();
    return successResponse(overview);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load returns overview",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

