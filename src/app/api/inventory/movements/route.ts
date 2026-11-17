import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { getStockMovements } from "@/services/inventory.service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (
    !hasPermission(currentUser, "inventory:view") &&
    !hasPermission(currentUser, "inventory:read") &&
    !hasPermission(currentUser, "reports:view")
  ) {
    return errorResponse(
      "Forbidden: You lack permission to view stock movements",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId") || undefined;
  const movementType = searchParams.get("movementType") || undefined;
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;
  const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20;

  try {
    const result = await getStockMovements({
      productId,
      movementType,
      startDate,
      endDate,
      page,
      limit,
    });
    return successResponse(result);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load stock movements",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

