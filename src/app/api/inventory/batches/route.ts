import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { getBatchesWithExpiry } from "@/services/inventory.service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "inventory:view") && !hasPermission(currentUser, "inventory:read")) {
    return errorResponse(
      "Forbidden: You lack permission to view inventory batches",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { searchParams } = new URL(request.url);
  const productId = searchParams.get("productId") || undefined;

  try {
    const batches = await getBatchesWithExpiry(productId);
    return successResponse({ batches });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load batches",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

