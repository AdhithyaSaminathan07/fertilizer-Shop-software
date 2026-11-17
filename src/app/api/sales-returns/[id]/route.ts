import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { updateSalesReturnSchema } from "@/validations/returns";
import {
  getSalesReturnById,
  updateSalesReturn,
} from "@/services/sales-return.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "returns:view") && !hasPermission(currentUser, "billing:view")) {
    return errorResponse(
      "Forbidden: You lack permission to view sales return details",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { id } = await params;

  try {
    const salesReturn = await getSalesReturnById(id);
    return successResponse({ salesReturn });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Sales return not found",
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
      "Forbidden: You lack permission to edit sales returns",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = updateSalesReturnSchema.safeParse(body);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
      return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
    }

    const updated = await updateSalesReturn(id, parsed.data, {
      id: currentUser.id,
      name: currentUser.name,
      ip: request.headers.get("x-forwarded-for") || undefined,
    });

    return successResponse({
      salesReturn: updated,
      message: "Sales return updated successfully",
    });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to update sales return",
      HTTP_STATUS.BAD_REQUEST
    );
  }
}

