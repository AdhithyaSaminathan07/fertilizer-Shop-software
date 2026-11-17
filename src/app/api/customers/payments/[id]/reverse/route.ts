import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { customerPaymentReversalSchema } from "@/validations/customer";
import { reverseCustomerPayment } from "@/services/customer.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "farmers:manage") && !hasPermission(currentUser, "ledger:manage")) {
    return errorResponse(
      "Forbidden: You lack permission to reverse customer payments",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { id } = await params;
  if (!id) {
    return errorResponse("Missing payment voucher ID", HTTP_STATUS.BAD_REQUEST);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", HTTP_STATUS.BAD_REQUEST);
  }

  const parsed = customerPaymentReversalSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const payment = await reverseCustomerPayment(id, parsed.data.reason, {
      id: currentUser.id,
      name: currentUser.name,
    });
    return successResponse({ payment });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reverse customer payment";
    return errorResponse(message, HTTP_STATUS.BAD_REQUEST);
  }
}

