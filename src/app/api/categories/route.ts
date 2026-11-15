import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { createCategorySchema } from "@/validations/category";
import { listCategories, createCategory } from "@/services/category.service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    console.log("[Auth/Categories] GET 401 Unauthorized: no valid session found");
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "inventory:read")) {
    console.log(`[Auth/Categories] GET 403 Forbidden: user '${currentUser.username}' lacks 'inventory:read'`);
    return errorResponse("Forbidden: You lack permission to view categories", HTTP_STATUS.FORBIDDEN);
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || undefined;
  const status = searchParams.get("status") || undefined;

  try {
    const categories = await listCategories({ search, status });
    return successResponse({ categories });
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Failed to load categories", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    console.log("[Auth/Categories] POST 401 Unauthorized: no valid session found");
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "inventory:write")) {
    console.log(`[Auth/Categories] POST 403 Forbidden: user '${currentUser.username}' lacks 'inventory:write'`);
    return errorResponse("Forbidden: You lack permission to create categories", HTTP_STATUS.FORBIDDEN);
  }

  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", HTTP_STATUS.BAD_REQUEST);
  }

  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const newCategory = await createCategory(parsed.data, {
      id: currentUser.id,
      name: currentUser.name,
      ip: ipAddress,
    });
    return successResponse({ category: newCategory }, HTTP_STATUS.CREATED);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Failed to create category", HTTP_STATUS.CONFLICT);
  }
}

