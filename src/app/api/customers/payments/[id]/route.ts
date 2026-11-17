import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { getCustomerPaymentById } from "@/services/customer.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "farmers:view") && !hasPermission(currentUser, "ledger:view")) {
    return errorResponse(
      "Forbidden: You lack permission to view customer payment details",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { id } = await params;
  if (!id) {
    return errorResponse("Missing payment voucher ID", HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const payment = await getCustomerPaymentById(id);
    if (!payment) {
      return errorResponse("Payment voucher not found", HTTP_STATUS.NOT_FOUND);
    }
    return successResponse({ payment });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load payment voucher",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

