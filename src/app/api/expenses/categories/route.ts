import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { expenseCategoryInputSchema } from "@/validations/expense";
import {
  getExpenseCategories,
  createExpenseCategory,
} from "@/services/expense.service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "expenses:view")) {
    return errorResponse("Forbidden: You lack permission to view expenses", HTTP_STATUS.FORBIDDEN);
  }

  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("includeInactive") === "true";

  try {
    const categories = await getExpenseCategories(includeInactive);
    return successResponse(categories);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load expense categories",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "expenses:manage")) {
    return errorResponse("Forbidden: You lack permission to manage expense categories", HTTP_STATUS.FORBIDDEN);
  }

  try {
    const body = await request.json();
    const parsed = expenseCategoryInputSchema.safeParse(body);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
      return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
    }

    const category = await createExpenseCategory(parsed.data, currentUser);
    return successResponse(category, HTTP_STATUS.CREATED);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to create expense category",
      HTTP_STATUS.BAD_REQUEST
    );
  }
}

