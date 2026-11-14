import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { AuditLog } from "@/models/audit-log";
import { getCurrentUser, hasPermission } from "@/lib/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  _: Request,
  { params }: RouteParams
): Promise<NextResponse> {
  const { id } = await params;
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }

  if (!hasPermission(currentUser, "employees:manage")) {
    return errorResponse("Forbidden: You lack permission to view employee activity logs", HTTP_STATUS.FORBIDDEN);
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return errorResponse("Invalid employee ID format", HTTP_STATUS.BAD_REQUEST);
  }

  await connectDB();
  const objId = new mongoose.Types.ObjectId(id);

  const logs = await AuditLog.find({
    $or: [{ userId: objId }, { targetUserId: objId }],
  })
    .sort({ timestamp: -1 })
    .limit(50);

  return successResponse({ logs });
}

