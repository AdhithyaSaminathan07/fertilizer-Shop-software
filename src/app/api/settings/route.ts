import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { updateSettingsSchema } from "@/validations/settings";
import {
  getShopSettings,
  updateShopSettings,
} from "@/services/settings.service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }

  // View settings requires settings:view or OWNER role
  if (!hasPermission(currentUser, "settings:view")) {
    return errorResponse(
      "Forbidden: You lack permission to view shop settings",
      HTTP_STATUS.FORBIDDEN
    );
  }

  try {
    const settings = await getShopSettings();
    return successResponse({ settings });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load shop settings",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }

  // Manage settings requires settings:manage or OWNER role
  if (!hasPermission(currentUser, "settings:manage")) {
    return errorResponse(
      "Forbidden: You lack permission to modify shop settings",
      HTTP_STATUS.FORBIDDEN
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", HTTP_STATUS.BAD_REQUEST);
  }

  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
  }

  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  try {
    const updated = await updateShopSettings(parsed.data, {
      id: currentUser.id,
      name: currentUser.name,
      ip: ipAddress,
    });
    return successResponse({ settings: updated });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to update shop settings",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

