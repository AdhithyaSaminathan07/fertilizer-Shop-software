import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { getInventoryValuation } from "@/services/inventory.service";

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
      "Forbidden: You lack permission to view inventory valuation",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId") || undefined;

  try {
    const valuation = await getInventoryValuation({ categoryId });
    return successResponse(valuation);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load inventory valuation",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

