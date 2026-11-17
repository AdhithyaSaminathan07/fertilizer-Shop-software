import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import {
  createSalesReturnSchema,
  returnsFilterQuerySchema,
} from "@/validations/returns";
import {
  createSalesReturn,
  getSalesReturns,
} from "@/services/sales-return.service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "returns:view") && !hasPermission(currentUser, "billing:view")) {
    return errorResponse(
      "Forbidden: You lack permission to view sales returns",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || undefined;
  const status = searchParams.get("status") || undefined;
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;
  const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20;

  try {
    const result = await getSalesReturns({
      search,
      status,
      startDate,
      endDate,
      page,
      limit,
    });
    return successResponse(result);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load sales returns",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "returns:create") && !hasPermission(currentUser, "returns:manage")) {
    return errorResponse(
      "Forbidden: You lack permission to create sales returns",
      HTTP_STATUS.FORBIDDEN
    );
  }

  try {
    const body = await request.json();
    const parsed = createSalesReturnSchema.safeParse(body);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
      return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
    }

    const salesReturn = await createSalesReturn(parsed.data, {
      id: currentUser.id,
      name: currentUser.name,
      ip: request.headers.get("x-forwarded-for") || undefined,
    });

    return successResponse(
      { salesReturn, message: "Sales return created successfully" },
      HTTP_STATUS.CREATED
    );
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to create sales return",
      HTTP_STATUS.BAD_REQUEST
    );
  }
}

