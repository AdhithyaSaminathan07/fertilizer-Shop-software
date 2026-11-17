import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { cashbookOpeningBalanceInputSchema } from "@/validations/expense";
import {
  getOpeningBalanceConfig,
  configureOpeningBalance,
} from "@/services/cashbook.service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "cashbook:view")) {
    return errorResponse("Forbidden: You lack permission to view opening balances", HTTP_STATUS.FORBIDDEN);
  }

  try {
    const config = await getOpeningBalanceConfig();
    return successResponse(config);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load opening balance configuration",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "cashbook:manage")) {
    return errorResponse("Forbidden: You lack permission to configure cashbook opening balances", HTTP_STATUS.FORBIDDEN);
  }

  try {
    const body = await request.json();
    const parsed = cashbookOpeningBalanceInputSchema.safeParse(body);
    if (!parsed.success) {
      const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
      return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
    }

    const updated = await configureOpeningBalance(parsed.data, currentUser);
    return successResponse(updated);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to configure opening balances",
      HTTP_STATUS.BAD_REQUEST
    );
  }
}

