import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { updateBusinessLogo } from "@/services/settings.service";

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/svg+xml",
];

export async function POST(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }

  if (!hasPermission(currentUser, "settings:manage")) {
    return errorResponse(
      "Forbidden: You lack permission to update shop logo",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  const contentType = request.headers.get("content-type") || "";

  let logoUrl = "";

  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await request.formData();
      const file = (formData.get("file") || formData.get("logo")) as File | null;

      if (!file) {
        return errorResponse("No logo file provided in request", HTTP_STATUS.BAD_REQUEST);
      }

      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        return errorResponse(
          `Invalid file type (${file.type}). Allowed types: PNG, JPEG, WEBP, SVG`,
          HTTP_STATUS.BAD_REQUEST
        );
      }

      if (file.size > MAX_LOGO_BYTES) {
        return errorResponse(
          `File size exceeds 2MB limit (${(file.size / (1024 * 1024)).toFixed(2)}MB)`,
          HTTP_STATUS.BAD_REQUEST
        );
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const base64 = buffer.toString("base64");
      logoUrl = `data:${file.type};base64,${base64}`;
    } catch {
      return errorResponse("Failed to parse logo upload form data", HTTP_STATUS.BAD_REQUEST);
    }
  } else if (contentType.includes("application/json")) {
    try {
      const json = await request.json();
      if (!json.logoUrl || typeof json.logoUrl !== "string") {
        return errorResponse("logoUrl is required in JSON payload", HTTP_STATUS.BAD_REQUEST);
      }
      logoUrl = json.logoUrl.trim();
    } catch {
      return errorResponse("Invalid JSON payload", HTTP_STATUS.BAD_REQUEST);
    }
  } else {
    return errorResponse(
      "Unsupported Content-Type. Use multipart/form-data or application/json",
      HTTP_STATUS.BAD_REQUEST
    );
  }

  try {
    const updated = await updateBusinessLogo(logoUrl, {
      id: currentUser.id,
      name: currentUser.name,
      ip: ipAddress,
    });
    return successResponse({
      logoUrl: updated.businessProfile.logoUrl,
      settings: updated,
    });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to update business logo",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }

  if (!hasPermission(currentUser, "settings:manage")) {
    return errorResponse(
      "Forbidden: You lack permission to remove shop logo",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  try {
    const updated = await updateBusinessLogo("", {
      id: currentUser.id,
      name: currentUser.name,
      ip: ipAddress,
    });
    return successResponse({
      logoUrl: "",
      settings: updated,
    });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to remove business logo",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

