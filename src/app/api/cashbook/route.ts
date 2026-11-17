import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { cashbookFilterQuerySchema } from "@/validations/expense";
import { getCashbookLedger } from "@/services/cashbook.service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "cashbook:view")) {
    return errorResponse("Forbidden: You lack permission to view cashbook records", HTTP_STATUS.FORBIDDEN);
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;
  const paymentMethod = searchParams.get("paymentMethod") || undefined;
  const moduleParam = searchParams.get("module") || undefined;
  const search = searchParams.get("search") || undefined;
  const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 50;

  const parsed = cashbookFilterQuerySchema.safeParse({
    startDate,
    endDate,
    paymentMethod,
    module: moduleParam,
    search,
    page,
    limit,
  });

  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const result = await getCashbookLedger(parsed.data);
    return successResponse(result);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load business cashbook",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

