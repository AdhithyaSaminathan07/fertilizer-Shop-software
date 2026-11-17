import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { getExpenseSummary } from "@/services/expense.service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "expenses:view")) {
    return errorResponse("Forbidden: You lack permission to view expenses", HTTP_STATUS.FORBIDDEN);
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;

  try {
    const summary = await getExpenseSummary(startDate, endDate);
    return successResponse(summary);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load expense summary",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

