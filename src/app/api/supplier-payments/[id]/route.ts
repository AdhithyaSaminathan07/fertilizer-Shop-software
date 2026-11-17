import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { getSupplierPaymentById } from "@/services/supplier-payment.service";

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
    return errorResponse(
      "Forbidden: You lack permission to view supplier payment details",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { id } = await params;

  try {
    const payment = await getSupplierPaymentById(id);
    if (!payment) {
      return errorResponse("Supplier payment not found", HTTP_STATUS.NOT_FOUND);
    }
    return successResponse({ payment });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load supplier payment",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function PUT(): Promise<NextResponse> {
  return errorResponse(
    "Editing historical supplier payments is prohibited. Use reversal instead.",
    HTTP_STATUS.METHOD_NOT_ALLOWED
  );
}

export async function PATCH(): Promise<NextResponse> {
  return errorResponse(
    "Editing historical supplier payments is prohibited. Use reversal instead.",
    HTTP_STATUS.METHOD_NOT_ALLOWED
  );
}

export async function DELETE(): Promise<NextResponse> {
  return errorResponse(
    "Deleting historical supplier payments is prohibited. Use reversal instead.",
    HTTP_STATUS.METHOD_NOT_ALLOWED
  );
}

