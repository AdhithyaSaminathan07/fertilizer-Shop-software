import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { getReturnableSaleDetails } from "@/services/sales-return.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ saleId: string }> }
): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "returns:create") && !hasPermission(currentUser, "returns:view")) {
    return errorResponse(
      "Forbidden: You lack permission to initiate returns",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { saleId } = await params;

  try {
    const details = await getReturnableSaleDetails(saleId);
    return successResponse(details);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load sale returnable details",
      HTTP_STATUS.NOT_FOUND
    );
  }
}

