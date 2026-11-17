import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { submitStockCountSession } from "@/services/inventory.service";

export async function POST(
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
      "Forbidden: You lack permission to submit stock count sessions",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { id } = await params;

  try {
    const session = await submitStockCountSession(id, {
      id: currentUser.id,
      name: currentUser.name,
      ip: request.headers.get("x-forwarded-for") || undefined,
    });

    return successResponse({
      session,
      message: "Stock count session submitted for approval",
    });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to submit stock count session",
      HTTP_STATUS.BAD_REQUEST
    );
  }
}

