import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { reversePaymentBodySchema } from "@/validations/supplier-payment";
import { reverseSupplierPayment } from "@/services/supplier-payment.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "suppliers:manage")) {
    return errorResponse(
      "Forbidden: You lack permission to reverse supplier payments",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { id } = await params;
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", HTTP_STATUS.BAD_REQUEST);
  }

  const parsed = reversePaymentBodySchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const reversedPayment = await reverseSupplierPayment(
      {
        paymentId: id,
        reason: parsed.data.reason,
      },
      {
        id: currentUser.id,
        name: currentUser.name,
        ip: ipAddress,
      }
    );

    return successResponse({ payment: reversedPayment });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to reverse supplier payment";
    const isConflict =
      message.includes("already reversed") ||
      message.includes("already been consumed") ||
      message.includes("no longer available");

    return errorResponse(message, isConflict ? HTTP_STATUS.CONFLICT : HTTP_STATUS.BAD_REQUEST);
  }
}

