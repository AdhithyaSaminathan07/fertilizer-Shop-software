import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { stockAdjustmentInputSchema } from "@/validations/inventory";
import {
  createStockAdjustment,
  getStockAdjustments,
} from "@/services/inventory.service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "inventory:view") && !hasPermission(currentUser, "inventory:read")) {
    return errorResponse(
      "Forbidden: You lack permission to view stock adjustments",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId") || undefined;
  const reason = searchParams.get("reason") || undefined;
  const type = searchParams.get("type") || undefined;
  const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20;

  try {
    const result = await getStockAdjustments({ productId, reason, type, page, limit });
    return successResponse(result);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load stock adjustments",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (
    !hasPermission(currentUser, "inventory:adjust") &&
    !hasPermission(currentUser, "inventory:manage")
  ) {
    return errorResponse(
      "Forbidden: You lack permission to perform stock adjustments and write-offs",
      HTTP_STATUS.FORBIDDEN
    );
  }

  try {
    const body = await request.json();
    const parsed = stockAdjustmentInputSchema.safeParse(body);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
      return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
    }

    const adjustment = await createStockAdjustment(parsed.data, {
      id: currentUser.id,
      name: currentUser.name,
      ip: request.headers.get("x-forwarded-for") || undefined,
    });

    return successResponse(
      { adjustment, message: "Stock adjustment recorded successfully" },
      HTTP_STATUS.CREATED
    );
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to record stock adjustment",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

