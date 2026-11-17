import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { getInventoryOverview } from "@/services/inventory.service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "inventory:view") && !hasPermission(currentUser, "inventory:read")) {
    return errorResponse(
      "Forbidden: You lack permission to view inventory overview",
      HTTP_STATUS.FORBIDDEN
    );
  }

  try {
    const overview = await getInventoryOverview();
    return successResponse(overview);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load inventory overview",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

