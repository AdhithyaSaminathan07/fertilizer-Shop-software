import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import {
  customerRepaymentSchema,
  customerPaymentFilterSchema,
} from "@/validations/customer";
import {
  getCustomerPayments,
  recordCustomerRepayment,
} from "@/services/customer.service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "farmers:view") && !hasPermission(currentUser, "ledger:view")) {
    return errorResponse(
      "Forbidden: You lack permission to view customer payments",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId") || undefined;
  const paymentMethod = searchParams.get("paymentMethod") || undefined;
  const status = searchParams.get("status") || undefined;
  const fromDate = searchParams.get("fromDate") || undefined;
  const toDate = searchParams.get("toDate") || undefined;
  const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20;

  const parsed = customerPaymentFilterSchema.safeParse({
    customerId,
    paymentMethod,
    status,
    fromDate,
    toDate,
    page,
    limit,
  });

  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const result = await getCustomerPayments(parsed.data);
    return successResponse(result);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load customer payments",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "farmers:manage") && !hasPermission(currentUser, "ledger:manage")) {
    return errorResponse(
      "Forbidden: You lack permission to record customer repayments",
      HTTP_STATUS.FORBIDDEN
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", HTTP_STATUS.BAD_REQUEST);
  }

  const headerIdempotencyKey =
    request.headers.get("x-idempotency-key") || request.headers.get("idempotency-key");
  if (headerIdempotencyKey && !body.idempotencyKey) {
    body.idempotencyKey = headerIdempotencyKey.trim();
  }

  const parsed = customerRepaymentSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const payment = await recordCustomerRepayment(parsed.data, {
      id: currentUser.id,
      name: currentUser.name,
    });
    return successResponse({ payment }, HTTP_STATUS.CREATED);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record customer repayment";
    return errorResponse(message, HTTP_STATUS.BAD_REQUEST);
  }
}

