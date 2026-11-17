import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { returnActionReasonSchema } from "@/validations/returns";
import { cancelSalesReturn } from "@/services/sales-return.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "returns:manage")) {
    return errorResponse(
      "Forbidden: You lack permission to cancel sales returns",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = returnActionReasonSchema.safeParse(body);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
      return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
    }

    const cancelled = await cancelSalesReturn(id, parsed.data.reason, {
      id: currentUser.id,
      name: currentUser.name,
      ip: request.headers.get("x-forwarded-for") || undefined,
    });

    return successResponse({
      salesReturn: cancelled,
      message: "Sales return cancelled",
    });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to cancel sales return",
      HTTP_STATUS.BAD_REQUEST
    );
  }
}

