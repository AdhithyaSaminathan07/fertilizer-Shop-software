import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";
import { customerInputSchema, customerQuerySchema } from "@/validations/customer";
import { createCustomer, getCustomers, searchCustomers } from "@/services/customer.service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "farmers:view") && !hasPermission(currentUser, "billing:view") && !hasPermission(currentUser, "ledger:view")) {
    return errorResponse(
      "Forbidden: You lack permission to view customer records",
      HTTP_STATUS.FORBIDDEN
    );
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search") || undefined;
  const status = searchParams.get("status") || undefined;
  const hasCredit = searchParams.get("hasCredit") === "true" ? true : undefined;
  const isAutocomplete = searchParams.get("autocomplete") === "true";
  const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : 20;

  if (isAutocomplete) {
    try {
      const customers = await searchCustomers(search || "", limit);
      return successResponse({ customers });
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : "Failed to search customers",
        HTTP_STATUS.INTERNAL_SERVER_ERROR
      );
    }
  }

  const parsed = customerQuerySchema.safeParse({ search, status, hasCredit, page, limit });
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const result = await getCustomers(parsed.data);
    return successResponse(result);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load customers",
      HTTP_STATUS.INTERNAL_SERVER_ERROR
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const currentUser = await getCurrentUser(request);
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }
  if (!hasPermission(currentUser, "farmers:manage") && !hasPermission(currentUser, "billing:create")) {
    return errorResponse(
      "Forbidden: You lack permission to create customer records",
      HTTP_STATUS.FORBIDDEN
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", HTTP_STATUS.BAD_REQUEST);
  }

  const parsed = customerInputSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
  }

  try {
    const customer = await createCustomer(parsed.data, undefined, {
      id: currentUser.id,
      name: currentUser.name,
    });
    return successResponse({ customer }, HTTP_STATUS.CREATED);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create customer";
    return errorResponse(message, HTTP_STATUS.BAD_REQUEST);
  }
}
