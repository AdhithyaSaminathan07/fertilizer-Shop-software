import { z } from "zod";

export const salesReturnReasonEnum = z.enum([
  "DAMAGED",
  "DEFECTIVE",
  "WRONG_PRODUCT",
  "EXPIRED",
  "CUSTOMER_CHANGED_MIND",
  "OTHER",
]);

export const purchaseReturnReasonEnum = z.enum([
  "DAMAGED",
  "DEFECTIVE",
  "WRONG_PRODUCT",
  "EXPIRED",
  "QUALITY_REJECTED",
  "SUPPLIER_RECALL",
  "OTHER",
]);

export const returnItemConditionEnum = z.enum([
  "SALEABLE",
  "DAMAGED",
  "DEFECTIVE",
  "OTHER",
]);

export const salesReturnRefundMethodEnum = z.enum([
  "CASH",
  "UPI",
  "BANK_TRANSFER",
  "CHEQUE",
  "CREDIT_NOTE",
]);

export const purchaseReturnSupplierResponseEnum = z.enum([
  "REFUND_EXPECTED",
  "CREDIT_NOTE_EXPECTED",
  "REPLACEMENT_EXPECTED",
  "PENDING_CONFIRMATION",
  "OTHER",
]);

export const returnStatusEnum = z.enum([
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "CANCELLED",
]);

export const salesReturnItemInputSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  batchNumber: z.string().optional(),
  returnQty: z.number().positive("Return quantity must be greater than 0"),
  reason: salesReturnReasonEnum,
  condition: returnItemConditionEnum,
  remarks: z.string().trim().max(250).optional(),
});

export const createSalesReturnSchema = z.object({
  saleId: z.string().min(1, "Original sales invoice is required"),
  returnDate: z.string().optional(),
  items: z.array(salesReturnItemInputSchema).min(1, "At least one item must be returned"),
  refundMethod: salesReturnRefundMethodEnum,
  refundReference: z.string().trim().max(100).optional(),
  generalReason: salesReturnReasonEnum.optional(),
  remarks: z.string().trim().max(500).optional(),
  submitForApproval: z.boolean().optional(),
});

export const updateSalesReturnSchema = z.object({
  items: z.array(salesReturnItemInputSchema).min(1, "At least one item must be returned").optional(),
  refundMethod: salesReturnRefundMethodEnum.optional(),
  refundReference: z.string().trim().max(100).optional(),
  generalReason: salesReturnReasonEnum.optional(),
  remarks: z.string().trim().max(500).optional(),
  submitForApproval: z.boolean().optional(),
});

export const purchaseReturnItemInputSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  batchNumber: z.string().optional(),
  returnQty: z.number().positive("Return quantity must be greater than 0"),
  reason: purchaseReturnReasonEnum,
  condition: returnItemConditionEnum,
  remarks: z.string().trim().max(250).optional(),
});

export const createPurchaseReturnSchema = z.object({
  purchaseId: z.string().min(1, "Original purchase invoice is required"),
  returnDate: z.string().optional(),
  items: z.array(purchaseReturnItemInputSchema).min(1, "At least one item must be returned"),
  supplierResponse: purchaseReturnSupplierResponseEnum,
  supplierCreditNoteNumber: z.string().trim().max(100).optional(),
  supplierCreditNoteDate: z.string().optional(),
  generalReason: purchaseReturnReasonEnum.optional(),
  remarks: z.string().trim().max(500).optional(),
  submitForApproval: z.boolean().optional(),
});

export const updatePurchaseReturnSchema = z.object({
  items: z.array(purchaseReturnItemInputSchema).min(1, "At least one item must be returned").optional(),
  supplierResponse: purchaseReturnSupplierResponseEnum.optional(),
  supplierCreditNoteNumber: z.string().trim().max(100).optional(),
  supplierCreditNoteDate: z.string().optional(),
  generalReason: purchaseReturnReasonEnum.optional(),
  remarks: z.string().trim().max(500).optional(),
  submitForApproval: z.boolean().optional(),
});

export const returnActionReasonSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "A valid reason (minimum 3 characters) is required")
    .max(500),
});

export const returnsFilterQuerySchema = z.object({
  search: z.string().optional(),
  status: returnStatusEnum.optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

