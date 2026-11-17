import { z } from "zod";

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;
const PHONE_REGEX = /^(?:\+91|91)?[6-9]\d{9}$/;

export const saleItemInputSchema = z.object({
  productId: z
    .string()
    .trim()
    .refine((val) => OBJECT_ID_REGEX.test(val), {
      message: "Invalid product ID",
    }),
  batchId: z
    .string()
    .trim()
    .refine((val) => OBJECT_ID_REGEX.test(val), {
      message: "Invalid batch ID",
    })
    .optional()
    .or(z.literal("")),
  quantity: z
    .number()
    .gt(0, "Quantity must be greater than zero"),
  unit: z.string().trim().optional(),
  unitSellingPrice: z
    .number()
    .min(0, "Selling price cannot be negative"),
  discountType: z.enum(["PERCENT", "FIXED"]).default("FIXED"),
  discountValue: z.number().min(0, "Discount cannot be negative").default(0),
  gstRate: z.number().min(0, "GST rate cannot be negative").default(0),
});

export const salePaymentInputSchema = z.object({
  method: z.enum(["CASH", "UPI", "CREDIT", "SPLIT"]),
  cashAmount: z.number().min(0, "Cash amount cannot be negative").default(0),
  upiAmount: z.number().min(0, "UPI amount cannot be negative").default(0),
  upiReference: z.string().trim().max(100).optional().or(z.literal("")),
  creditAmount: z.number().min(0, "Credit amount cannot be negative").default(0),
});

export const saleCreateInputSchema = z
  .object({
    customerId: z
      .string()
      .trim()
      .refine((val) => OBJECT_ID_REGEX.test(val), {
        message: "Invalid customer ID",
      })
      .optional()
      .or(z.literal("")),
    customerName: z
      .string()
      .min(2, "Customer name must be at least 2 characters")
      .max(150)
      .trim()
      .optional()
      .or(z.literal("")),
    customerPhone: z
      .string()
      .trim()
      .refine((val) => !val || PHONE_REGEX.test(val.replace(/[\s-]/g, "")), {
        message: "Please enter a valid 10-digit phone number",
      })
      .optional()
      .or(z.literal("")),
    customerVillage: z
      .string()
      .max(100)
      .trim()
      .optional()
      .or(z.literal("")),
    isWalkIn: z.boolean().default(false),
    items: z
      .array(saleItemInputSchema)
      .min(1, "Invoice must contain at least one item"),
    invoiceDiscount: z.number().min(0).default(0),
    roundOff: z.number().min(-50).max(50).default(0),
    payment: salePaymentInputSchema,
    notes: z.string().max(1000).trim().optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      // If credit amount > 0, customer identification is mandatory
      const credit = data.payment.creditAmount || 0;
      if (credit > 0) {
        const hasCustomerId = Boolean(data.customerId && data.customerId.trim().length > 0);
        const hasCustomerDetails = Boolean(
          data.customerName &&
          data.customerName.trim().length >= 2 &&
          data.customerPhone &&
          data.customerPhone.trim().length >= 10
        );
        return hasCustomerId || hasCustomerDetails;
      }
      return true;
    },
    {
      message: "Customer name and phone are required when extending credit",
      path: ["customerId"],
    }
  );

export const saleCancelInputSchema = z.object({
  reason: z
    .string()
    .min(3, "Cancellation reason must be at least 3 characters")
    .max(500, "Cancellation reason cannot exceed 500 characters")
    .trim(),
});

export const salesFilterQuerySchema = z.object({
  search: z.string().optional(),
  customerId: z.string().optional(),
  paymentMethod: z.string().optional(),
  status: z.string().optional(),
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});
