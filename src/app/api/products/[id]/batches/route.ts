import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { listBatchesForProduct } from "@/services/product.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { id } = await params;
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "inventory:read")) {
    return errorResponse("Forbidden: You lack permission to view inventory batches", HTTP_STATUS.FORBIDDEN);
  }

  try {
    const batches = await listBatchesForProduct(id);
    return successResponse({ batches });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Failed to load batches", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

/**
 * Phase 4 Batch Safety Guard:
 * Manual stock injection is strictly disabled.
 * Batches and inventory quantities must be created through legitimate Purchase & Inward Goods workflows in Phase 5.
 */
export async function POST(
  _request: NextRequest,
  _context: RouteParams
): Promise<NextResponse> {
  return errorResponse(
    "Manual stock and batch creation is disabled. Batches and stock quantities must be created through the Purchase & Inward Goods module (Phase 5).",
    HTTP_STATUS.BAD_REQUEST
  );
}

