import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { saleCancelInputSchema } from "@/validations/sale";
import { cancelSale } from "@/services/sale.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "billing:manage")) {
    return errorResponse(
      "Forbidden: You lack permission to cancel sales invoices",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { id } = await params;
  if (!id) {
    return errorResponse("Missing sale invoice ID", HTTP_STATUS.BAD_REQUEST);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", HTTP_STATUS.BAD_REQUEST);
  }

  const parsed = saleCancelInputSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const cancelledSale = await cancelSale(
      id,
      parsed.data.reason,
      currentUser.id,
      currentUser.name
    );
    return successResponse({ sale: cancelledSale });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to cancel sales invoice";
    return errorResponse(message, HTTP_STATUS.BAD_REQUEST);
  }
}

