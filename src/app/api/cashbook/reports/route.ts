import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { cashbookReportQuerySchema } from "@/validations/expense";
import { getCashbookReports } from "@/services/cashbook.service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "cashbook:view")) {
    return errorResponse("Forbidden: You lack permission to view cashbook reports", HTTP_STATUS.FORBIDDEN);
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;
  const year = searchParams.get("year") ? parseInt(searchParams.get("year")!, 10) : undefined;
  const month = searchParams.get("month") ? parseInt(searchParams.get("month")!, 10) : undefined;

  const parsed = cashbookReportQuerySchema.safeParse({
    startDate,
    endDate,
    year,
    month,
  });

  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const reports = await getCashbookReports(parsed.data);
    return successResponse(reports);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to generate cashbook reports",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

