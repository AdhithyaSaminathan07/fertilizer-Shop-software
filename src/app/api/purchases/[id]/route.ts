import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { updatePurchaseDraftSchema } from "@/validations/purchase";
import {
  getPurchaseById,
  updatePurchaseDraft,
  cancelPurchase,
} from "@/services/purchase.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "suppliers:view")) {
    return errorResponse("Forbidden: You lack permission to view purchase orders", HTTP_STATUS.FORBIDDEN);
  }

  const { id } = await params;

  try {
    const purchase = await getPurchaseById(id);
    return successResponse({ purchase });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Purchase order not found",
      HTTP_STATUS.NOT_FOUND
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "suppliers:manage")) {
    return errorResponse("Forbidden: You lack permission to update purchase orders", HTTP_STATUS.FORBIDDEN);
  }

  const { id } = await params;
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", HTTP_STATUS.BAD_REQUEST);
  }

  // Handle explicit cancellation action
  if (body?.action === "cancel") {
    try {
      const cancelled = await cancelPurchase(id, body.reason || "Cancelled by user", {
        id: currentUser.id,
        name: currentUser.name,
        ip: ipAddress,
      });
      return successResponse({ purchase: cancelled });
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : "Failed to cancel purchase",
        HTTP_STATUS.BAD_REQUEST
      );
    }
  }

  // Otherwise handle draft updates
  const parsed = updatePurchaseDraftSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const updated = await updatePurchaseDraft(id, parsed.data, {
      id: currentUser.id,
      name: currentUser.name,
      ip: ipAddress,
    });
    return successResponse({ purchase: updated });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to update purchase draft",
      HTTP_STATUS.BAD_REQUEST
    );
  }
}

