import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { expenseUpdateInputSchema } from "@/validations/expense";
import { getExpenseById, updateExpense } from "@/services/expense.service";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "expenses:view")) {
    return errorResponse("Forbidden: You lack permission to view expenses", HTTP_STATUS.FORBIDDEN);
  }

  const { id } = await context.params;

  try {
    const expense = await getExpenseById(id);
    if (!expense) {
      return errorResponse("Expense record not found", HTTP_STATUS.NOT_FOUND);
    }
    return successResponse(expense);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load expense details",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "expenses:manage")) {
    return errorResponse("Forbidden: You lack permission to edit expenses", HTTP_STATUS.FORBIDDEN);
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = expenseUpdateInputSchema.safeParse(body);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
      return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
    }

    const updated = await updateExpense(id, parsed.data, currentUser);
    return successResponse(updated);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to update expense record",
      HTTP_STATUS.BAD_REQUEST
    );
  }
}

