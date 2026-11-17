import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { getDashboardFinancials } from "@/services/cashbook.service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }

  try {
    const data = await getDashboardFinancials();
    return successResponse(data);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load dashboard financials",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

