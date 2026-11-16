import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { createPurchaseSchema } from "@/validations/purchase";
import { listPurchases, createPurchase } from "@/services/purchase.service";
import type { PurchaseStatus } from "@/types/purchase";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "suppliers:view")) {
    return errorResponse("Forbidden: You lack permission to view purchase orders", HTTP_STATUS.FORBIDDEN);
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || undefined;
  const status = (searchParams.get("status") as PurchaseStatus) || undefined;
  const supplierId = searchParams.get("supplierId") || undefined;
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;
  const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20;
  const sortBy = (searchParams.get("sortBy") as any) || "createdAt";
  const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || "desc";

  try {
    const result = await listPurchases({
      search,
      status,
      supplierId,
      startDate,
      endDate,
      page,
      limit,
      sortBy,
      sortOrder,
    });
    return successResponse(result);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load purchases",
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
    return errorResponse("Forbidden: You lack permission to create purchase orders", HTTP_STATUS.FORBIDDEN);
  }

  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", HTTP_STATUS.BAD_REQUEST);
  }

  const parsed = createPurchaseSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const newPurchase = await createPurchase(parsed.data, {
      id: currentUser.id,
      name: currentUser.name,
      ip: ipAddress,
    });
    return successResponse({ purchase: newPurchase }, HTTP_STATUS.CREATED);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to create purchase order",
      HTTP_STATUS.CONFLICT
    );
  }
}
