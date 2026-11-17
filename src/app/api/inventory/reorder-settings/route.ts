import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { reorderSettingsInputSchema } from "@/validations/inventory";
import { updateProductReorderLevels } from "@/services/inventory.service";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (
    !hasPermission(currentUser, "inventory:write") &&
    !hasPermission(currentUser, "inventory:manage") &&
    !hasPermission(currentUser, "inventory:adjust")
  ) {
    return errorResponse(
      "Forbidden: You lack permission to update reorder settings",
      HTTP_STATUS.FORBIDDEN
    );
  }

  try {
    const body = await request.json();
    const parsed = reorderSettingsInputSchema.safeParse(body);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
      return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
    }

    const { productId, minStockThreshold, preferredReorderQty } = parsed.data;
    const updatedProduct = await updateProductReorderLevels(
      productId,
      minStockThreshold,
      preferredReorderQty,
      {
        id: currentUser.id,
        name: currentUser.name,
        ip: request.headers.get("x-forwarded-for") || undefined,
      }
    );

    return successResponse({
      product: updatedProduct,
      message: "Reorder settings updated successfully",
    });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to update reorder settings",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

