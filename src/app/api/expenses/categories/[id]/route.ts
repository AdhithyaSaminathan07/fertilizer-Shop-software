import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { expenseCategoryInputSchema } from "@/validations/expense";
import {
  updateExpenseCategory,
  deleteExpenseCategory,
} from "@/services/expense.service";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "expenses:manage")) {
    return errorResponse("Forbidden: You lack permission to manage expense categories", HTTP_STATUS.FORBIDDEN);
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = expenseCategoryInputSchema.partial().safeParse(body);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
      return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
    }

    const updated = await updateExpenseCategory(id, parsed.data, currentUser);
    return successResponse(updated);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to update expense category",
      HTTP_STATUS.BAD_REQUEST
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "expenses:manage")) {
    return errorResponse("Forbidden: You lack permission to delete expense categories", HTTP_STATUS.FORBIDDEN);
  }

  const { id } = await context.params;

  try {
    await deleteExpenseCategory(id);
    return successResponse({ message: "Category deleted successfully" });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to delete expense category",
      HTTP_STATUS.BAD_REQUEST
    );
  }
}

