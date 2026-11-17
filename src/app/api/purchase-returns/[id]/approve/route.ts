import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { approvePurchaseReturn } from "@/services/purchase-return.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "returns:approve") && !hasPermission(currentUser, "returns:manage")) {
    return errorResponse(
      "Forbidden: You lack permission to approve purchase returns",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { id } = await params;

  try {
    const approved = await approvePurchaseReturn(id, {
      id: currentUser.id,
      name: currentUser.name,
      ip: request.headers.get("x-forwarded-for") || undefined,
    });

    return successResponse({
      purchaseReturn: approved,
      message: "Purchase return approved successfully",
    });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to approve purchase return",
      HTTP_STATUS.BAD_REQUEST
    );
  }
}

