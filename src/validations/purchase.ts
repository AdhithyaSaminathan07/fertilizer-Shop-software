import { z } from "zod";

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const purchaseItemInputSchema = z.object({
  productId: z.string().regex(OBJECT_ID_REGEX, "Valid product selection is required"),
  orderedQty: z.number().positive("Ordered quantity must be greater than zero"),
  unitPurchasePrice: z.number().min(0, "Unit purchase price cannot be negative"),
  discountAmount: z.number().min(0, "Discount cannot be negative").default(0),
  taxRate: z
    .number()
    .min(0, "Tax rate cannot be negative")
    .max(100, "Tax rate cannot exceed 100%")
    .default(0),
});

export const createPurchaseSchema = z.object({
  supplierId: z.string().regex(OBJECT_ID_REGEX, "A registered supplier must be selected"),
  supplierInvoiceNumber: z
    .string()
    .min(1, "Supplier invoice number is required")
    .max(100, "Invoice number cannot exceed 100 characters")
    .trim(),
  supplierInvoiceDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Valid supplier invoice date is required",
  }),
  purchaseDate: z
    .string()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "Purchase date must be a valid date",
    })
    .optional(),
  items: z
    .array(purchaseItemInputSchema)
    .min(1, "At least one product item is required for a purchase order"),
  status: z.enum(["DRAFT", "PENDING_RECEIPT"]).default("DRAFT"),
  notes: z
    .string()
    .max(1000, "Notes cannot exceed 1000 characters")
    .trim()
    .optional()
    .or(z.literal("")),
});

export const updatePurchaseDraftSchema = z.object({
  supplierId: z.string().regex(OBJECT_ID_REGEX, "A registered supplier must be selected").optional(),
  supplierInvoiceNumber: z
    .string()
    .min(1, "Supplier invoice number is required")
    .max(100, "Invoice number cannot exceed 100 characters")
    .trim()
    .optional(),
  supplierInvoiceDate: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), {
      message: "Valid supplier invoice date is required",
    })
    .optional(),
  items: z
    .array(purchaseItemInputSchema)
    .min(1, "At least one product item is required")
    .optional(),
  status: z.enum(["DRAFT", "PENDING_RECEIPT", "CANCELLED"]).optional(),
  notes: z.string().max(1000).trim().optional().or(z.literal("")),
});

export const amendPurchaseSchema = z.object({
  reason: z
    .string()
    .min(5, "Amendment reason must be at least 5 characters")
    .max(500, "Amendment reason cannot exceed 500 characters")
    .trim(),
  items: z
    .array(purchaseItemInputSchema)
    .min(1, "At least one product item must be present in the amended order"),
});

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type UpdatePurchaseDraftInput = z.infer<typeof updatePurchaseDraftSchema>;
export type AmendPurchaseInput = z.infer<typeof amendPurchaseSchema>;
export type PurchaseItemInput = z.infer<typeof purchaseItemInputSchema>;
