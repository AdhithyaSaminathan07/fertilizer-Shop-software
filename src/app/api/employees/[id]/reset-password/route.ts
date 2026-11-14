import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { User } from "@/models/user";
import { getCurrentUser, hasPermission, logAuditEvent, destroyAllUserSessions } from "@/lib/auth";
import { hashPassword, validatePasswordStrength } from "@/lib/security";
import { resetPasswordSchema } from "@/validations/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
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
    return errorResponse("Forbidden: You lack permission to reset employee passwords", HTTP_STATUS.FORBIDDEN);
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

  const parsed = resetPasswordSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
  }

  const { newPassword } = parsed.data;
  const strength = validatePasswordStrength(newPassword);
  if (!strength.valid) {
    return errorResponse(strength.reason || "Password does not meet complexity requirements", HTTP_STATUS.BAD_REQUEST);
  }

  await connectDB();
  const targetUser = await User.findById(id).select("+passwordHash");
  if (!targetUser) {
    return errorResponse("Employee not found", HTTP_STATUS.NOT_FOUND);
  }

  // Non-owner cannot reset Owner's password
  if (targetUser.role === "OWNER" && currentUser.role !== "OWNER") {
    return errorResponse("Only the Proprietor can reset the owner account password", HTTP_STATUS.FORBIDDEN);
  }

  const passwordHash = await hashPassword(newPassword);
  targetUser.passwordHash = passwordHash;
  await targetUser.save();

  // Revoke all existing sessions so old credentials are immediately killed
  await destroyAllUserSessions(id);

  await logAuditEvent({
    action: "PASSWORD_RESET",
    userId: currentUser.id,
    userName: currentUser.name,
    targetUserId: targetUser._id.toString(),
    targetUserName: targetUser.name,
    ipAddress,
  });

  return successResponse({
    message: "Password reset successfully. All active sessions have been revoked.",
  });
}

