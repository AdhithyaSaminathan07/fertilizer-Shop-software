import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { updateSupplierSchema } from "@/validations/supplier";
import { getSupplierById, updateSupplier, archiveSupplier } from "@/services/supplier.service";

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
    return errorResponse("Forbidden: You lack permission to view suppliers", HTTP_STATUS.FORBIDDEN);
  }

  const { id } = await params;

  try {
    const supplier = await getSupplierById(id);
    return successResponse({ supplier });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Supplier not found",
      HTTP_STATUS.NOT_FOUND
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "suppliers:manage")) {
    return errorResponse("Forbidden: You lack permission to update suppliers", HTTP_STATUS.FORBIDDEN);
  }

  const { id } = await params;
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", HTTP_STATUS.BAD_REQUEST);
  }

  const parsed = updateSupplierSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const updated = await updateSupplier(id, parsed.data, {
      id: currentUser.id,
      name: currentUser.name,
      ip: ipAddress,
    });
    return successResponse({ supplier: updated });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to update supplier",
      HTTP_STATUS.CONFLICT
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "suppliers:manage")) {
    return errorResponse("Forbidden: You lack permission to archive suppliers", HTTP_STATUS.FORBIDDEN);
  }

  const { id } = await params;
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  try {
    const archived = await archiveSupplier(id, {
      id: currentUser.id,
      name: currentUser.name,
      ip: ipAddress,
    });
    return successResponse({
      message: `Supplier '${archived.name}' has been archived successfully`,
      supplier: archived,
    });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to archive supplier",
      HTTP_STATUS.BAD_REQUEST
    );
  }
}

