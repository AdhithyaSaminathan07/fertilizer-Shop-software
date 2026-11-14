import { z } from "zod";
import { PERMISSIONS } from "@/types/auth";

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(3, "Username or email must be at least 3 characters")
    .max(100, "Identifier too long"),
  password: z
    .string()
    .min(1, "Password is required")
    .max(128, "Password too long"),
});

export const createEmployeeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username cannot exceed 30 characters")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Username can only contain alphanumeric characters, underscores, dashes, and periods"
    ),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please provide a valid email address"),
  phone: z
    .string()
    .trim()
    .max(20, "Phone number cannot exceed 20 characters")
    .optional(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password cannot exceed 128 characters"),
  role: z.enum(["OWNER", "EMPLOYEE"]).default("EMPLOYEE"),
  permissions: z.array(z.enum(PERMISSIONS)).default([]),
});

export const updateEmployeeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters")
    .optional(),
  phone: z
    .string()
    .trim()
    .max(20, "Phone number cannot exceed 20 characters")
    .optional(),
  permissions: z.array(z.enum(PERMISSIONS)).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export const resetPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password cannot exceed 128 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

