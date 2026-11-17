import { z } from "zod";

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const paymentAllocationInputSchema = z.object({
  purchaseId: z
    .string()
    .regex(OBJECT_ID_REGEX, "Valid purchase ID is required"),
  amount: z
    .number()
    .positive("Allocated amount must be greater than zero"),
});

export const createSupplierPaymentSchema = z
  .object({
    supplierId: z
      .string()
      .regex(OBJECT_ID_REGEX, "Valid supplier ID is required"),
    paymentDate: z
      .string()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: "Valid payment date is required",
      })
      .optional()
      .or(z.date().optional()),
    amount: z
      .number()
      .positive("Payment amount must be greater than zero"),
    paymentMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE"]),
    paymentReference: z
      .string()
      .trim()
      .max(100, "Payment reference cannot exceed 100 characters")
      .optional()
      .or(z.literal("")),
    allocations: z.array(paymentAllocationInputSchema).optional().default([]),
    notes: z
      .string()
      .trim()
      .max(1000, "Notes cannot exceed 1000 characters")
      .optional()
      .or(z.literal("")),
    idempotencyKey: z
      .string()
      .trim()
      .max(100, "Idempotency key cannot exceed 100 characters")
      .optional()
      .or(z.literal("")),
  })
  .refine(
    (data) => {
      if (!data.allocations || data.allocations.length === 0) return true;
      const totalAllocated = data.allocations.reduce((sum, a) => sum + (a.amount || 0), 0);
      return Math.round((totalAllocated - data.amount) * 100) / 100 <= 0;
    },
    {
      message: "Total allocated amount cannot exceed the payment amount",
      path: ["allocations"],
    }
  );

export const reverseSupplierPaymentSchema = z.object({
  paymentId: z
    .string()
    .regex(OBJECT_ID_REGEX, "Valid payment ID is required"),
  reason: z
    .string()
    .trim()
    .min(3, "Reversal reason must be at least 3 characters")
    .max(500, "Reversal reason cannot exceed 500 characters"),
});

export const reversePaymentBodySchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Reversal reason must be at least 3 characters")
    .max(500, "Reversal reason cannot exceed 500 characters"),
});

export const supplierPaymentFilterSchema = z.object({
  search: z.string().trim().optional().or(z.literal("")),
  supplierId: z.string().regex(OBJECT_ID_REGEX).optional().or(z.literal("")),
  paymentMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE"]).optional(),
  status: z.enum(["RECORDED", "REVERSED"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateSupplierPaymentValidationInput = z.infer<typeof createSupplierPaymentSchema>;
export type ReverseSupplierPaymentValidationInput = z.infer<typeof reverseSupplierPaymentSchema>;
export type SupplierPaymentFilterValidationInput = z.infer<typeof supplierPaymentFilterSchema>;
