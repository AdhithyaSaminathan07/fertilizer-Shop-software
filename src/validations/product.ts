import { z } from "zod";
import { areUnitsCompatible } from "@/lib/units";
import { ProductUnit } from "@/types/product";

const UNIT_ENUM = z.enum([
  "BAGS",
  "KG",
  "G",
  "L",
  "ML",
  "PIECES",
  "BOXES",
  "BOTTLES",
  "CANS",
  "PACKETS",
]);

export const unitConversionSchema = z
  .object({
    enabled: z.boolean().default(false),
    baseUnit: UNIT_ENUM,
    conversionRatio: z.number().positive("Conversion ratio must be greater than zero"),
  })
  .optional();

export const createProductSchema = z
  .object({
    name: z
      .string()
      .min(2, "Product name must be at least 2 characters")
      .max(150, "Product name cannot exceed 150 characters")
      .trim(),
    sku: z
      .string()
      .max(50, "SKU cannot exceed 50 characters")
      .trim()
      .toUpperCase()
      .optional()
      .or(z.literal("")),
    barcode: z
      .string()
      .max(50, "Barcode cannot exceed 50 characters")
      .trim()
      .optional()
      .or(z.literal("")),
    brand: z
      .string()
      .max(100, "Brand cannot exceed 100 characters")
      .trim()
      .optional()
      .or(z.literal(""))
      .transform((val) => (val && val.trim() ? val.trim() : "General")),
    categoryId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Valid category selection is required"),
    description: z
      .string()
      .max(1000, "Description cannot exceed 1000 characters")
      .trim()
      .optional()
      .or(z.literal("")),
    purchasePrice: z.number().min(0, "Purchase price cannot be negative").default(0),
    sellingPrice: z.number().min(0, "Selling price cannot be negative"),
    primaryUnit: UNIT_ENUM,
    unitConversion: unitConversionSchema,
    minStockThreshold: z.number().min(0, "Minimum stock threshold cannot be negative").default(10),
    status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
  })
  .refine(
    (data) => {
      // Validate dimensional compatibility if conversion is enabled
      if (data.unitConversion?.enabled && data.unitConversion.baseUnit) {
        return areUnitsCompatible(
          data.primaryUnit as ProductUnit,
          data.unitConversion.baseUnit as ProductUnit
        );
      }
      return true;
    },
    {
      message:
        "Primary unit and base conversion unit must be dimensionally compatible (e.g. Mass to Mass, Volume to Volume).",
      path: ["unitConversion", "baseUnit"],
    }
  );

export const updateProductSchema = z
  .object({
    name: z
      .string()
      .min(2, "Product name must be at least 2 characters")
      .max(150, "Product name cannot exceed 150 characters")
      .trim()
      .optional(),
    sku: z
      .string()
      .max(50, "SKU cannot exceed 50 characters")
      .trim()
      .toUpperCase()
      .optional()
      .or(z.literal("")),
    barcode: z
      .string()
      .max(50, "Barcode cannot exceed 50 characters")
      .trim()
      .optional()
      .or(z.literal("")),
    brand: z
      .string()
      .min(2, "Brand must be at least 2 characters")
      .max(100, "Brand cannot exceed 100 characters")
      .trim()
      .optional(),
    categoryId: z
      .string()
      .regex(/^[0-9a-fA-F]{24}$/, "Valid category ID required")
      .optional(),
    description: z
      .string()
      .max(1000, "Description cannot exceed 1000 characters")
      .trim()
      .optional()
      .or(z.literal("")),
    purchasePrice: z.number().min(0, "Purchase price cannot be negative").optional(),
    sellingPrice: z.number().min(0, "Selling price cannot be negative").optional(),
    primaryUnit: UNIT_ENUM.optional(),
    unitConversion: unitConversionSchema,
    minStockThreshold: z.number().min(0, "Minimum stock threshold cannot be negative").optional(),
    status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
  })
  .refine(
    (data) => {
      if (data.primaryUnit && data.unitConversion?.enabled && data.unitConversion.baseUnit) {
        return areUnitsCompatible(
          data.primaryUnit as ProductUnit,
          data.unitConversion.baseUnit as ProductUnit
        );
      }
      return true;
    },
    {
      message: "Primary unit and base conversion unit must be dimensionally compatible.",
      path: ["unitConversion", "baseUnit"],
    }
  );

export const createBatchSchema = z
  .object({
    batchNumber: z
      .string()
      .min(1, "Batch number is required")
      .max(50, "Batch number cannot exceed 50 characters")
      .trim()
      .toUpperCase(),
    manufacturingDate: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), "Invalid manufacturing date"),
    expiryDate: z
      .string()
      .optional()
      .refine((val) => !val || !isNaN(Date.parse(val)), "Invalid expiry date"),
    purchasePrice: z.number().min(0).optional(),
  })
  .refine(
    (data) => {
      if (data.manufacturingDate && data.expiryDate) {
        return new Date(data.manufacturingDate) <= new Date(data.expiryDate);
      }
      return true;
    },
    {
      message: "Manufacturing date must be prior to or equal to expiry date",
      path: ["expiryDate"],
    }
  );

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type CreateBatchInput = z.infer<typeof createBatchSchema>;
