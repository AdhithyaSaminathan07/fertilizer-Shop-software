import { z } from "zod";

// Indian GSTIN: 2 state digits + 5 PAN letters + 4 PAN numbers + 1 PAN letter + 1 entity code + 'Z' + 1 checksum
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
// Standard Indian 10-digit phone number with optional +91 prefix
const PHONE_REGEX = /^(?:\+91|91)?[6-9]\d{9}$/;
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

export const supplierAddressSchema = z
  .object({
    street: z.string().max(200, "Street cannot exceed 200 characters").trim().optional().or(z.literal("")),
    city: z.string().max(100, "City cannot exceed 100 characters").trim().optional().or(z.literal("")),
    state: z.string().max(100, "State cannot exceed 100 characters").trim().optional().or(z.literal("")),
    pincode: z
      .string()
      .trim()
      .refine((val) => !val || PINCODE_REGEX.test(val), {
        message: "Pincode must be a valid 6-digit Indian postal code",
      })
      .optional()
      .or(z.literal("")),
  })
  .optional();

export const createSupplierSchema = z.object({
  name: z
    .string()
    .min(2, "Supplier name must be at least 2 characters")
    .max(150, "Supplier name cannot exceed 150 characters")
    .trim(),
  contactPerson: z
    .string()
    .max(100, "Contact person cannot exceed 100 characters")
    .trim()
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .trim()
    .refine((val) => PHONE_REGEX.test(val.replace(/[\s-]/g, "")), {
      message: "Please enter a valid 10-digit Indian phone number (e.g. 9876543210)",
    }),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address")
    .max(150, "Email cannot exceed 150 characters")
    .optional()
    .or(z.literal("")),
  address: supplierAddressSchema,
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((val) => !val || GSTIN_REGEX.test(val), {
      message: "GSTIN must be a valid 15-character Indian Goods & Services Tax Identification Number (e.g. 33AAAAA0000A1Z5)",
    })
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .max(1000, "Notes cannot exceed 1000 characters")
    .trim()
    .optional()
    .or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;

