import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { getReturnablePurchaseDetails } from "@/services/purchase-return.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ purchaseId: string }> }
): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "returns:create") && !hasPermission(currentUser, "returns:view")) {
    return errorResponse(
      "Forbidden: You lack permission to initiate purchase returns",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { purchaseId } = await params;

  try {
    const details = await getReturnablePurchaseDetails(purchaseId);
    return successResponse(details);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load purchase returnable details",
      HTTP_STATUS.NOT_FOUND
    );
  }
}

