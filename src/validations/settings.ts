import { z } from "zod";

export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
export const PINCODE_REGEX = /^[1-9][0-9]{5}$/;
export const PHONE_REGEX = /^[6-9]\d{9}$/;
export const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const businessAddressSchema = z.object({
  street: z.string().trim().max(150, "Street address cannot exceed 150 characters").optional().or(z.literal("")),
  villageTown: z.string().trim().min(2, "Village/Town must be at least 2 characters").max(100),
  district: z.string().trim().min(2, "District must be at least 2 characters").max(100),
  state: z.string().trim().min(2, "State must be at least 2 characters").max(100),
  pincode: z.string().trim().regex(PINCODE_REGEX, "PIN code must be a valid 6-digit Indian postal code"),
});

export const updateBusinessProfileSchema = z.object({
  shopName: z
    .string()
    .trim()
    .min(2, "Business name must be at least 2 characters")
    .max(100, "Business name cannot exceed 100 characters")
    .optional(),
  proprietorName: z
    .string()
    .trim()
    .min(2, "Proprietor name must be at least 2 characters")
    .max(100, "Proprietor name cannot exceed 100 characters")
    .optional(),
  phone: z
    .string()
    .trim()
    .regex(PHONE_REGEX, "Phone number must be a valid 10-digit Indian mobile number")
    .optional(),
  alternatePhone: z
    .string()
    .trim()
    .refine((val) => !val || PHONE_REGEX.test(val), {
      message: "Alternate phone must be a valid 10-digit Indian mobile number",
    })
    .optional()
    .or(z.literal("")),
  email: z
    .string()
    .trim()
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: "Email must be a valid email address",
    })
    .optional()
    .or(z.literal("")),
  address: businessAddressSchema.partial().optional(),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((val) => !val || GSTIN_REGEX.test(val), {
      message: "GSTIN must be a valid 15-character GST identification number",
    })
    .optional()
    .or(z.literal("")),
  logoUrl: z.string().trim().optional().or(z.literal("")),
  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters")
    .optional()
    .or(z.literal("")),
});

export const updatePreferencesSchema = z.object({
  currency: z.string().trim().min(2).max(10).default("INR").optional(),
  currencySymbol: z.string().trim().min(1).max(5).default("₹").optional(),
  numberFormat: z.string().trim().min(2).max(20).default("en-IN").optional(),
  dateFormat: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).default("DD/MM/YYYY").optional(),
  timezone: z.string().trim().min(3).max(50).default("Asia/Kolkata").optional(),
  financialYearStartMonth: z.coerce.number().int().min(1).max(12).default(4).optional(),
  defaultLowStockThreshold: z.coerce.number().int().min(0, "Threshold cannot be negative").max(100000).default(10).optional(),
});

export const updateBusinessHoursSchema = z.object({
  openingTime: z
    .string()
    .trim()
    .regex(TIME_REGEX, "Opening time must be in HH:mm 24-hour format")
    .optional()
    .or(z.literal("")),
  closingTime: z
    .string()
    .trim()
    .regex(TIME_REGEX, "Closing time must be in HH:mm 24-hour format")
    .optional()
    .or(z.literal("")),
  workingDays: z
    .array(
      z.enum([
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
        "SUNDAY",
      ])
    )
    .min(1, "Select at least one business working day")
    .optional(),
  isShopOpen: z.boolean().optional(),
});

export const updateSettingsSchema = z.object({
  businessProfile: updateBusinessProfileSchema.optional(),
  preferences: updatePreferencesSchema.optional(),
  businessHours: updateBusinessHoursSchema.optional(),
});

export type UpdateBusinessProfileValidationInput = z.infer<typeof updateBusinessProfileSchema>;
export type UpdatePreferencesValidationInput = z.infer<typeof updatePreferencesSchema>;
export type UpdateBusinessHoursValidationInput = z.infer<typeof updateBusinessHoursSchema>;
export type UpdateSettingsValidationInput = z.infer<typeof updateSettingsSchema>;

