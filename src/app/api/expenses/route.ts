import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import {
  expenseCreateInputSchema,
  expenseFilterQuerySchema,
} from "@/validations/expense";
import { createExpense, getExpenses } from "@/services/expense.service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "expenses:view")) {
    return errorResponse("Forbidden: You lack permission to view expenses", HTTP_STATUS.FORBIDDEN);
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || undefined;
  const categoryId = searchParams.get("categoryId") || undefined;
  const paymentMethod = searchParams.get("paymentMethod") || undefined;
  const status = searchParams.get("status") || undefined;
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;
  const createdById = searchParams.get("createdById") || undefined;
  const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20;

  const parsed = expenseFilterQuerySchema.safeParse({
    search,
    categoryId,
    paymentMethod,
    status,
    startDate,
    endDate,
    createdById,
    page,
    limit,
  });

  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const result = await getExpenses(parsed.data);
    return successResponse(result);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load expenses register",
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
    return errorResponse("Forbidden: You lack permission to record expenses", HTTP_STATUS.FORBIDDEN);
  }

  try {
    const body = await request.json();
    const parsed = expenseCreateInputSchema.safeParse(body);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
      return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
    }

    const expense = await createExpense(parsed.data, currentUser);
    return successResponse(expense, HTTP_STATUS.CREATED);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to record expense",
      HTTP_STATUS.BAD_REQUEST
    );
  }
}

