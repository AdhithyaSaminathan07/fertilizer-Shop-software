import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import {
  createSupplierPaymentSchema,
  supplierPaymentFilterSchema,
} from "@/validations/supplier-payment";
import {
  listSupplierPayments,
  recordSupplierPayment,
} from "@/services/supplier-payment.service";
import type { SupplierPaymentMethod, SupplierPaymentStatus } from "@/types/supplier-payment";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "suppliers:view")) {
    return errorResponse(
      "Forbidden: You lack permission to view supplier payments",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || undefined;
  const supplierId = searchParams.get("supplierId") || undefined;
  const paymentMethod =
    (searchParams.get("paymentMethod") as SupplierPaymentMethod) || undefined;
  const status =
    (searchParams.get("status") as SupplierPaymentStatus) || undefined;
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;
  const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20;

  const filterParsed = supplierPaymentFilterSchema.safeParse({
    search,
    supplierId,
    paymentMethod,
    status,
    startDate,
    endDate,
    page,
    limit,
  });

  if (!filterParsed.success) {
    const errorMsg = filterParsed.error.issues.map((i) => i.message).join(", ");
    return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const result = await listSupplierPayments(filterParsed.data);
    return successResponse(result);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load supplier payments",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "suppliers:manage")) {
    return errorResponse(
      "Forbidden: You lack permission to record supplier payments",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", HTTP_STATUS.BAD_REQUEST);
  }

  // Support idempotency key passed via HTTP header or request body
  const headerIdempotencyKey =
    request.headers.get("x-idempotency-key") ||
    request.headers.get("idempotency-key");
  if (headerIdempotencyKey && !body.idempotencyKey) {
    body.idempotencyKey = headerIdempotencyKey.trim();
  }

  const parsed = createSupplierPaymentSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const newPayment = await recordSupplierPayment(parsed.data, {
      id: currentUser.id,
      name: currentUser.name,
      ip: ipAddress,
    });
    return successResponse({ payment: newPayment }, HTTP_STATUS.CREATED);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record supplier payment";
    // Distinguish validation/business rule conflicts from internal server errors
    const isConflict =
      message.includes("exceeds eligible outstanding") ||
      message.includes("belongs to a different supplier") ||
      message.includes("Goods must be inwarded") ||
      message.includes("Duplicate allocation") ||
      message.includes("has no outstanding balance");

    return errorResponse(message, isConflict ? HTTP_STATUS.CONFLICT : HTTP_STATUS.BAD_REQUEST);
  }
}

