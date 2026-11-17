import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { expenseReversalInputSchema } from "@/validations/expense";
import { reverseExpense } from "@/services/expense.service";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "expenses:manage")) {
    return errorResponse("Forbidden: You lack permission to reverse expenses", HTTP_STATUS.FORBIDDEN);
  }

  const { id } = await context.params;

  try {
    const body = await request.json();
    const parsed = expenseReversalInputSchema.safeParse(body);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
      return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
    }

    const reversed = await reverseExpense(id, parsed.data.reason, currentUser);
    return successResponse(reversed);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to reverse expense record",
      HTTP_STATUS.BAD_REQUEST
    );
  }
}

