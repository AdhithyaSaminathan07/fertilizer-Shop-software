import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { User } from "@/models/user";
import { getCurrentUser, hasPermission, logAuditEvent, toSafeUser, destroyAllUserSessions } from "@/lib/auth";
import { updateEmployeeSchema } from "@/validations/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  const { id } = await params;
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }

  if (!hasPermission(currentUser, "employees:manage")) {
    return errorResponse("Forbidden: You lack permission to manage employees", HTTP_STATUS.FORBIDDEN);
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return errorResponse("Invalid employee ID format", HTTP_STATUS.BAD_REQUEST);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", HTTP_STATUS.BAD_REQUEST);
  }

  const parsed = updateEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
  }

  await connectDB();
  const targetUser = await User.findById(id);
  if (!targetUser) {
    return errorResponse("Employee not found", HTTP_STATUS.NOT_FOUND);
  }

  const updates = parsed.data;

  // Protect Owner accounts from deactivation
  if (targetUser.role === "OWNER" && updates.status === "INACTIVE") {
    return errorResponse("The Proprietor (Owner) account cannot be deactivated", HTTP_STATUS.FORBIDDEN);
  }

  // Non-owners cannot edit Owner accounts
  if (targetUser.role === "OWNER" && currentUser.role !== "OWNER") {
    return errorResponse("Only the Proprietor can modify owner records", HTTP_STATUS.FORBIDDEN);
  }

  if (updates.name !== undefined) targetUser.name = updates.name;
  if (updates.phone !== undefined) targetUser.phone = updates.phone;
  if (updates.permissions !== undefined && targetUser.role !== "OWNER") {
    targetUser.permissions = updates.permissions;
  }

  const statusChanged = updates.status !== undefined && updates.status !== targetUser.status;
  if (updates.status !== undefined) {
    targetUser.status = updates.status;
  }

  await targetUser.save();

  // If deactivated, revoke all active sessions immediately
  if (statusChanged && targetUser.status === "INACTIVE") {
    await destroyAllUserSessions(id);
  }

  await logAuditEvent({
    action: statusChanged
      ? targetUser.status === "INACTIVE"
        ? "EMPLOYEE_DEACTIVATED"
        : "EMPLOYEE_ACTIVATED"
      : updates.permissions !== undefined
      ? "PERMISSIONS_UPDATED"
      : "EMPLOYEE_UPDATED",
    userId: currentUser.id,
    userName: currentUser.name,
    targetUserId: targetUser._id.toString(),
    targetUserName: targetUser.name,
    details: updates,
    ipAddress,
  });

  return successResponse({
    employee: toSafeUser(targetUser),
    message: "Employee details updated successfully",
  });
}

