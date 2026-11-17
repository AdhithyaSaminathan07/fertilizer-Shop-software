import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { getCustomerLedger } from "@/services/customer.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (
    !hasPermission(currentUser, "farmers:view") &&
    !hasPermission(currentUser, "ledger:view") &&
    !hasPermission(currentUser, "billing:view")
  ) {
    return errorResponse(
      "Forbidden: You lack permission to view customer khata ledger",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { id } = await params;
  if (!id) {
    return errorResponse("Missing customer ID", HTTP_STATUS.BAD_REQUEST);
  }

  const { searchParams } = new URL(request.url);
  const fromDate = searchParams.get("fromDate") || undefined;
  const toDate = searchParams.get("toDate") || undefined;

  try {
    const ledger = await getCustomerLedger(id, { fromDate, toDate });
    return successResponse({ ledger });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load customer ledger";
    return errorResponse(
      message,
      message.includes("not found") ? HTTP_STATUS.NOT_FOUND : HTTP_STATUS.BAD_REQUEST
    );
  }
}

