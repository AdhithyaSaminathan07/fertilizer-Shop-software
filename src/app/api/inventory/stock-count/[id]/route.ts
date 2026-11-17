import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { stockCountUpdateSchema } from "@/validations/inventory";
import {
  getStockCountSessionById,
  updateStockCountSession,
} from "@/services/inventory.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "inventory:view") && !hasPermission(currentUser, "inventory:read")) {
    return errorResponse(
      "Forbidden: You lack permission to view stock count sessions",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { id } = await params;

  try {
    const session = await getStockCountSessionById(id);
    return successResponse({ session });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load stock count session",
      HTTP_STATUS.NOT_FOUND
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (
    !hasPermission(currentUser, "inventory:adjust") &&
    !hasPermission(currentUser, "inventory:manage")
  ) {
    return errorResponse(
      "Forbidden: You lack permission to update stock count sessions",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = stockCountUpdateSchema.safeParse(body);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
      return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
    }

    const updatedSession = await updateStockCountSession(id, parsed.data, {
      id: currentUser.id,
      name: currentUser.name,
      ip: request.headers.get("x-forwarded-for") || undefined,
    });

    return successResponse({
      session: updatedSession,
      message: "Stock count session updated successfully",
    });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to update stock count session",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

