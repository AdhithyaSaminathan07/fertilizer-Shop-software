import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { getLowStockReport } from "@/services/inventory.service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "inventory:view") && !hasPermission(currentUser, "inventory:read")) {
    return errorResponse(
      "Forbidden: You lack permission to view low stock reports",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { searchParams } = new URL(request.url);
  const categoryId = searchParams.get("categoryId") || undefined;
  const search = searchParams.get("search") || undefined;
  const stockStatus = (searchParams.get("stockStatus") as any) || "ALL";

  try {
    const items = await getLowStockReport({ categoryId, search, stockStatus });
    return successResponse({ items });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load low stock items",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

