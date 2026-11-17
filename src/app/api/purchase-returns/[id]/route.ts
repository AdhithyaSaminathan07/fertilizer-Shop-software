import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { updatePurchaseReturnSchema } from "@/validations/returns";
import {
  getPurchaseReturnById,
  updatePurchaseReturn,
} from "@/services/purchase-return.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "returns:view") && !hasPermission(currentUser, "suppliers:view")) {
    return errorResponse(
      "Forbidden: You lack permission to view purchase return details",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { id } = await params;

  try {
    const purchaseReturn = await getPurchaseReturnById(id);
    return successResponse({ purchaseReturn });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Purchase return not found",
      HTTP_STATUS.NOT_FOUND
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "returns:create") && !hasPermission(currentUser, "returns:manage")) {
    return errorResponse(
      "Forbidden: You lack permission to edit purchase returns",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = updatePurchaseReturnSchema.safeParse(body);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
      return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
    }

    const updated = await updatePurchaseReturn(id, parsed.data, {
      id: currentUser.id,
      name: currentUser.name,
      ip: request.headers.get("x-forwarded-for") || undefined,
    });

    return successResponse({
      purchaseReturn: updated,
      message: "Purchase return updated successfully",
    });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to update purchase return",
      HTTP_STATUS.BAD_REQUEST
    );
  }
}

