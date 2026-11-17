import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { getSaleById } from "@/services/sale.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "billing:view")) {
    return errorResponse(
      "Forbidden: You lack permission to view billing details",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { id } = await params;
  if (!id) {
    return errorResponse("Missing sale invoice ID", HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const sale = await getSaleById(id);
    if (!sale) {
      return errorResponse("Sales invoice not found", HTTP_STATUS.NOT_FOUND);
    }
    return successResponse({ sale });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load sales invoice",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

