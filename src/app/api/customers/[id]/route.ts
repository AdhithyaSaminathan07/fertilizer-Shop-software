import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { customerInputSchema } from "@/validations/customer";
import { getCustomerProfile, updateCustomer } from "@/services/customer.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "farmers:view") && !hasPermission(currentUser, "billing:view") && !hasPermission(currentUser, "ledger:view")) {
    return errorResponse(
      "Forbidden: You lack permission to view customer details",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { id } = await params;
  if (!id) {
    return errorResponse("Missing customer ID", HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const customer = await getCustomerProfile(id);
    if (!customer) {
      return errorResponse("Customer not found", HTTP_STATUS.NOT_FOUND);
    }
    return successResponse({ customer });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load customer",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "farmers:manage") && !hasPermission(currentUser, "ledger:manage")) {
    return errorResponse(
      "Forbidden: You lack permission to update customer details",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { id } = await params;
  if (!id) {
    return errorResponse("Missing customer ID", HTTP_STATUS.BAD_REQUEST);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", HTTP_STATUS.BAD_REQUEST);
  }

  const parsed = customerInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const updated = await updateCustomer(id, parsed.data, {
      id: currentUser.id,
      name: currentUser.name,
    });
    if (!updated) {
      return errorResponse("Customer not found", HTTP_STATUS.NOT_FOUND);
    }
    return successResponse({ customer: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update customer";
    return errorResponse(message, HTTP_STATUS.BAD_REQUEST);
  }
}
