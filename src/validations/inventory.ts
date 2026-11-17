import { z } from "zod";

export const stockAdjustmentReasonEnum = z.enum([
  "PHYSICAL_CORRECTION",
  "DAMAGED_GOODS",
  "EXPIRED_GOODS",
  "STOCK_LOSS",
  "DATA_CORRECTION",
  "OTHER",
]);

export const stockAdjustmentTypeEnum = z.enum(["INCREASE", "DECREASE"]);

export const stockAdjustmentInputSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  batchId: z.string().optional(),
  type: stockAdjustmentTypeEnum,
  adjustmentQuantity: z.number().positive("Adjustment quantity must be greater than 0"),
  reason: stockAdjustmentReasonEnum,
  explanation: z
    .string()
    .trim()
    .min(5, "A detailed explanation (at least 5 characters) is mandatory for financial and stock audits")
    .max(500, "Explanation cannot exceed 500 characters"),
});

export const reorderSettingsInputSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  minStockThreshold: z.number().min(0, "Minimum threshold cannot be negative"),
  preferredReorderQty: z.number().min(0, "Preferred reorder quantity cannot be negative").optional(),
});

export const stockCountCreateSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(150),
  notes: z.string().trim().max(500).optional(),
  categoryIds: z.array(z.string()).optional(),
});

export const stockCountUpdateSchema = z.object({
  title: z.string().trim().min(3).max(150).optional(),
  notes: z.string().trim().max(500).optional(),
  items: z.array(
    z.object({
      productId: z.string().min(1),
      countedStock: z.number().min(0, "Counted stock cannot be negative"),
      notes: z.string().trim().max(250).optional(),
    })
  ),
});

export const stockCountApprovalSchema = z.object({
  approvalNotes: z.string().trim().max(500).optional(),
});

export const inventoryFilterQuerySchema = z.object({
  categoryId: z.string().optional(),
  search: z.string().optional(),
  stockStatus: z.enum(["ALL", "IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]).optional().default("ALL"),
  expiryBucket: z
    .enum(["ALL", "EXPIRED", "EXPIRING_7D", "EXPIRING_30D", "EXPIRING_60D", "EXPIRING_LATER"])
    .optional()
    .default("ALL"),
  page: z.number().int().positive().default(1),
  limit: z.number().int().min(1).max(200).default(50),
});

