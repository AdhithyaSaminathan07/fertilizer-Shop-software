import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { customerAgingFilterSchema } from "@/validations/customer";
import { getCustomerAgingReport } from "@/services/customer.service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "farmers:view") && !hasPermission(currentUser, "ledger:view")) {
    return errorResponse(
      "Forbidden: You lack permission to view customer aging report",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || undefined;
  const bucket = (searchParams.get("bucket") as any) || "ALL";
  const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20;

  const parsed = customerAgingFilterSchema.safeParse({ search, bucket, page, limit });
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const report = await getCustomerAgingReport(parsed.data);
    return successResponse({ report });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load customer aging report",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

