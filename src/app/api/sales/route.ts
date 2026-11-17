import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { saleCreateInputSchema, salesFilterQuerySchema } from "@/validations/sale";
import { createSale, getSales } from "@/services/sale.service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "billing:view")) {
    return errorResponse(
      "Forbidden: You lack permission to view billing and sales records",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || undefined;
  const customerId = searchParams.get("customerId") || undefined;
  const paymentMethod = searchParams.get("paymentMethod") || undefined;
  const status = searchParams.get("status") || undefined;
  const fromDate = searchParams.get("fromDate") || undefined;
  const toDate = searchParams.get("toDate") || undefined;
  const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20;

  const parsed = salesFilterQuerySchema.safeParse({
    search,
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
    const result = await getSales(parsed.data);
    return successResponse(result);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load sales register",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "billing:create")) {
    return errorResponse(
      "Forbidden: You lack permission to create sales bills",
      HTTP_STATUS.FORBIDDEN
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", HTTP_STATUS.BAD_REQUEST);
  }

  const parsed = saleCreateInputSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const newSale = await createSale(parsed.data, currentUser.id, currentUser.name);
    return successResponse({ sale: newSale }, HTTP_STATUS.CREATED);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create sales bill";
    return errorResponse(message, HTTP_STATUS.BAD_REQUEST);
  }
}

