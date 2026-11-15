import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { createProductSchema } from "@/validations/product";
import { listProducts, createProduct } from "@/services/product.service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "inventory:read")) {
    return errorResponse("Forbidden: You lack permission to view products", HTTP_STATUS.FORBIDDEN);
  }

  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  const search = searchParams.get("search") || undefined;
  const categoryId = searchParams.get("categoryId") || undefined;
  const brand = searchParams.get("brand") || undefined;
  const stockStatus = searchParams.get("stockStatus") || undefined;
  const status = searchParams.get("status") || undefined;

  try {
    const result = await listProducts({
      page,
      limit,
      search,
      categoryId,
      brand,
      stockStatus,
      status,
    });
    return successResponse(result);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Failed to load products", HTTP_STATUS.INTERNAL_SERVER_ERROR);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "inventory:write")) {
    return errorResponse("Forbidden: You lack permission to create products", HTTP_STATUS.FORBIDDEN);
  }

  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", HTTP_STATUS.BAD_REQUEST);
  }

  const parsed = createProductSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const newProduct = await createProduct(parsed.data, {
      id: currentUser.id,
      name: currentUser.name,
      ip: ipAddress,
    });
    return successResponse({ product: newProduct }, HTTP_STATUS.CREATED);
  } catch (err) {
    return errorResponse(err instanceof Error ? err.message : "Failed to create product", HTTP_STATUS.CONFLICT);
  }
}

