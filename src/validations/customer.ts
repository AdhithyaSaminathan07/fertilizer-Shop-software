import { z } from "zod";

const PHONE_REGEX = /^(?:\+91|91)?[6-9]\d{9}$/;
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const customerInputSchema = z.object({
  name: z
    .string()
    .min(2, "Customer name must be at least 2 characters")
    .max(150, "Customer name cannot exceed 150 characters")
    .trim(),
  phone: z
    .string()
    .trim()
    .refine((val) => PHONE_REGEX.test(val.replace(/[\s-]/g, "")), {
      message: "Please enter a valid 10-digit Indian phone number",
    }),
  village: z
    .string()
    .max(100, "Village cannot exceed 100 characters")
    .trim()
    .optional()
    .or(z.literal("")),
  address: z
    .string()
    .max(250, "Address cannot exceed 250 characters")
    .trim()
    .optional()
    .or(z.literal("")),
  district: z
    .string()
    .max(100, "District cannot exceed 100 characters")
    .trim()
    .optional()
    .or(z.literal("")),
  state: z
    .string()
    .max(100, "State cannot exceed 100 characters")
    .trim()
    .optional()
    .or(z.literal("")),
  pincode: z
    .string()
    .max(10, "Pincode cannot exceed 10 characters")
    .trim()
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email format")
    .optional()
    .or(z.literal("")),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((val) => !val || GSTIN_REGEX.test(val), {
      message: "Invalid GSTIN format (e.g. 33AAAAA0000A1Z5)",
    })
    .optional()
    .or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE"),
  notes: z
    .string()
    .max(1000, "Notes cannot exceed 1000 characters")
    .trim()
    .optional()
    .or(z.literal("")),
});

export const customerQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "ALL"]).optional().default("ALL"),
  hasCredit: z.coerce.boolean().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const customerRepaymentSchema = z.object({
  customerId: z
    .string()
    .trim()
    .refine((val) => OBJECT_ID_REGEX.test(val), {
      message: "Invalid customer ID",
    }),
  amount: z
    .number()
    .gt(0, "Payment amount must be greater than zero"),
  paymentMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE"]),
  paymentDate: z.string().optional(),
  transactionReference: z.string().max(100).trim().optional().or(z.literal("")),
  allocations: z
    .array(
      z.object({
        saleId: z
          .string()
          .trim()
          .refine((val) => OBJECT_ID_REGEX.test(val), {
            message: "Invalid sale ID",
          }),
        allocatedAmount: z
          .number()
          .gt(0, "Allocated amount must be greater than zero"),
      })
    )
    .optional(),
  notes: z.string().max(1000).trim().optional().or(z.literal("")),
  idempotencyKey: z.string().trim().max(100).optional().or(z.literal("")),
});

export const customerPaymentFilterSchema = z.object({
  customerId: z.string().optional(),
  paymentMethod: z.string().optional(),
  status: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const customerPaymentReversalSchema = z.object({
  reason: z
    .string()
    .min(3, "Reversal reason must be at least 3 characters")
    .max(500, "Reversal reason cannot exceed 500 characters")
    .trim(),
});

export const customerAgingFilterSchema = z.object({
  search: z.string().optional(),
  bucket: z.enum(["ALL", "0-30", "31-60", "61-90", "90+"]).optional().default("ALL"),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const customerStatementQuerySchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});
