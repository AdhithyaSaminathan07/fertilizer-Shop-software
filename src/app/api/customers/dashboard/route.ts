import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { getCreditCollectionDashboard } from "@/services/customer.service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "farmers:view") && !hasPermission(currentUser, "ledger:view")) {
    return errorResponse(
      "Forbidden: You lack permission to view credit collection dashboard",
      HTTP_STATUS.FORBIDDEN
    );
  }

  try {
    const dashboard = await getCreditCollectionDashboard();
    return successResponse({ dashboard });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load credit collection dashboard",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

