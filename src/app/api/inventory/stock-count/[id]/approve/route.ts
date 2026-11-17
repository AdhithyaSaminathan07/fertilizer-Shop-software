import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import {
  approveStockCountSession,
  rejectStockCountSession,
} from "@/services/inventory.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (
    !hasPermission(currentUser, "inventory:approve") &&
    !hasPermission(currentUser, "inventory:manage")
  ) {
    return errorResponse(
      "Forbidden: You lack permission to approve or reject stock count reconciliations",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || "APPROVE";
    const notes = body.approvalNotes || body.notes || "";

    const actor = {
      id: currentUser.id,
      name: currentUser.name,
      ip: request.headers.get("x-forwarded-for") || undefined,
    };

    if (action === "REJECT") {
      const session = await rejectStockCountSession(id, notes, actor);
      return successResponse({
        session,
        message: "Stock count session rejected",
      });
    } else {
      const session = await approveStockCountSession(id, notes, actor);
      return successResponse({
        session,
        message: "Stock count session approved and adjustments applied successfully",
      });
    }
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to process stock count session",
      HTTP_STATUS.BAD_REQUEST
    );
  }
}

