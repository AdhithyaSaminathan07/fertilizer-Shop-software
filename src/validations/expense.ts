import { z } from "zod";

export const expensePaymentMethodEnum = z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE"]);

export const expenseCategoryInputSchema = z.object({
  name: z.string().trim().min(2, "Category name must be at least 2 characters").max(50, "Category name cannot exceed 50 characters"),
  description: z.string().trim().max(250, "Description cannot exceed 250 characters").optional(),
  isActive: z.boolean().optional().default(true),
});

export const expenseCreateInputSchema = z.object({
  expenseDate: z.string().or(z.date()).optional(),
  categoryId: z.string().min(1, "Expense category is required"),
  description: z.string().trim().min(3, "Description must be at least 3 characters").max(500, "Description cannot exceed 500 characters"),
  amount: z.number().positive("Expense amount must be greater than 0"),
  paymentMethod: expensePaymentMethodEnum,
  paymentReference: z.string().trim().max(100).optional(),
  paidTo: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(500).optional(),
  attachmentUrl: z.string().trim().max(500).optional(),
});

export const expenseUpdateInputSchema = z.object({
  expenseDate: z.string().or(z.date()).optional(),
  categoryId: z.string().min(1).optional(),
  description: z.string().trim().min(3).max(500).optional(),
  amount: z.number().positive().optional(),
  paymentMethod: expensePaymentMethodEnum.optional(),
  paymentReference: z.string().trim().max(100).optional(),
  paidTo: z.string().trim().max(100).optional(),
  notes: z.string().trim().max(500).optional(),
  attachmentUrl: z.string().trim().max(500).optional(),
  reason: z.string().trim().min(3, "Reason for modification is required").max(300),
});

export const expenseReversalInputSchema = z.object({
  reason: z.string().trim().min(5, "Reversal reason must be at least 5 characters").max(300, "Reversal reason cannot exceed 300 characters"),
});

export const expenseFilterQuerySchema = z.object({
  search: z.string().optional(),
  categoryId: z.string().optional(),
  paymentMethod: expensePaymentMethodEnum.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  createdById: z.string().optional(),
  status: z.enum(["RECORDED", "REVERSED"]).optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export const cashbookOpeningBalanceInputSchema = z.object({
  effectiveDate: z.string().or(z.date()).optional(),
  cash: z.number().min(0, "Cash opening balance cannot be negative").default(0),
  upi: z.number().min(0, "UPI opening balance cannot be negative").default(0),
  bank: z.number().min(0, "Bank opening balance cannot be negative").default(0),
  cheque: z.number().min(0, "Cheque opening balance cannot be negative").default(0),
  notes: z.string().trim().max(500).optional(),
  reason: z.string().trim().max(300).optional(),
});

export const cashbookFilterQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  paymentMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "ALL"]).optional().default("ALL"),
  module: z.enum(["SALES", "CUSTOMER_KHATA", "EXPENSES", "SUPPLIERS", "PURCHASES", "CASHBOOK", "ALL"]).optional().default("ALL"),
  search: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(200).default(50),
});

export const cashbookReportQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  year: z.number().int().optional(),
  month: z.number().int().min(1).max(12).optional(),
});

