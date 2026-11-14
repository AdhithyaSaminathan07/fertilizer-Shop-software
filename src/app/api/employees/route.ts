import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models/user";
import { getCurrentUser, hasPermission, logAuditEvent, toSafeUser } from "@/lib/auth";
import { hashPassword, validatePasswordStrength } from "@/lib/security";
import { createEmployeeSchema } from "@/validations/auth";
import { errorResponse, successResponse } from "@/lib/api-response";
import { HTTP_STATUS } from "@/constants/http-status";

export async function GET(): Promise<NextResponse> {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }

  if (!hasPermission(currentUser, "employees:manage")) {
    return errorResponse("Forbidden: You lack permission to manage employees", HTTP_STATUS.FORBIDDEN);
  }

  await connectDB();
  const users = await User.find().sort({ createdAt: -1 });
  const safeUsers = users.map(toSafeUser);

  return successResponse({ employees: safeUsers });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return errorResponse("Authentication required", HTTP_STATUS.UNAUTHORIZED);
  }

  if (!hasPermission(currentUser, "employees:manage")) {
    return errorResponse("Forbidden: You lack permission to create employees", HTTP_STATUS.FORBIDDEN);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON payload", HTTP_STATUS.BAD_REQUEST);
  }

  const parsed = createEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    const errorMsg = parsed.error.issues.map((i) => i.message).join(", ");
    return errorResponse(errorMsg, HTTP_STATUS.BAD_REQUEST);
  }

  const { name, username, email, phone, password, role, permissions } = parsed.data;

  // Validate enterprise password policy
  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.valid) {
    return errorResponse(passwordValidation.reason || "Password does not meet requirements", HTTP_STATUS.BAD_REQUEST);
  }

  await connectDB();

  // Check unique constraints
  const existingUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existingUser) {
    if (existingUser.username === username) {
      return errorResponse("An account with this username already exists", HTTP_STATUS.CONFLICT);
    }
    if (existingUser.email === email) {
      return errorResponse("An account with this email already exists", HTTP_STATUS.CONFLICT);
    }
  }

  // Hash password using Argon2id
  const passwordHash = await hashPassword(password);

  const newEmployee = await User.create({
    name,
    username,
    email,
    phone,
    passwordHash,
    role,
    permissions: role === "OWNER" ? [] : permissions,
    status: "ACTIVE",
  });

  await logAuditEvent({
    action: "EMPLOYEE_CREATED",
    userId: currentUser.id,
    userName: currentUser.name,
    targetUserId: newEmployee._id.toString(),
    targetUserName: newEmployee.name,
    details: { role, permissionsCount: permissions.length },
    ipAddress,
  });

  return successResponse(
    { employee: toSafeUser(newEmployee), message: "Employee registered successfully" },
    HTTP_STATUS.CREATED
  );
}

