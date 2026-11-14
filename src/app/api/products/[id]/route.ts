import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { updateProductSchema } from "@/validations/product";
import { getProductById, updateProduct, archiveProduct } from "@/services/product.service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "inventory:read")) {
    return errorResponse("Forbidden: You lack permission to view products", HTTP_STATUS.FORBIDDEN);
  }

  const product = await getProductById(id);
  if (!product) {
    return errorResponse("Product not found", HTTP_STATUS.NOT_FOUND);
  }

  return successResponse({ product });
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "inventory:write")) {
    return errorResponse("Forbidden: You lack permission to edit products", HTTP_STATUS.FORBIDDEN);
  }

  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", HTTP_STATUS.BAD_REQUEST);
  }

  const parsed = updateProductSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const updated = await updateProduct(id, parsed.data, {
      id: currentUser.id,
      name: currentUser.name,
      ip: ipAddress,
    });
    return successResponse({ product: updated });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Failed to update product", HTTP_STATUS.BAD_REQUEST);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "inventory:delete")) {
    return errorResponse("Forbidden: You lack permission to delete products", HTTP_STATUS.FORBIDDEN);
  }

  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  try {
    await archiveProduct(id, {
      id: currentUser.id,
      name: currentUser.name,
      ip: ipAddress,
    });
    return successResponse({ message: "Product archived successfully." });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Failed to archive product", HTTP_STATUS.BAD_REQUEST);
  }
}

