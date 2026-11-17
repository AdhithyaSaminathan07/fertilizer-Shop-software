import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { stockCountCreateSchema } from "@/validations/inventory";
import {
  createStockCountSession,
  getStockCountSessions,
} from "@/services/inventory.service";

export async function GET(request: NextRequest): Promise<NextResponse> {
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

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || undefined;
  const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20;

  try {
    const result = await getStockCountSessions({ status, page, limit });
    return successResponse(result);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load stock count sessions",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (
    !hasPermission(currentUser, "inventory:adjust") &&
    !hasPermission(currentUser, "inventory:manage")
  ) {
    return errorResponse(
      "Forbidden: You lack permission to initiate stock count sessions",
      HTTP_STATUS.FORBIDDEN
    );
  }

  try {
    const body = await request.json();
    const parsed = stockCountCreateSchema.safeParse(body);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
      return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
    }

    const session = await createStockCountSession(parsed.data, {
      id: currentUser.id,
      name: currentUser.name,
      ip: request.headers.get("x-forwarded-for") || undefined,
    });

    return successResponse(
      { session, message: "Stock count session created successfully" },
      HTTP_STATUS.CREATED
    );
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to create stock count session",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

