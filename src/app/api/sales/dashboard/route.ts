import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { getSalesDashboardKPIs } from "@/services/sale.service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "billing:view")) {
    return errorResponse(
      "Forbidden: You lack permission to view billing analytics",
      HTTP_STATUS.FORBIDDEN
    );
  }

  try {
    const kpis = await getSalesDashboardKPIs();
    return successResponse({ kpis });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load sales dashboard KPIs",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

