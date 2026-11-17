import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Settings, type ISettingsDocument } from "@/models/settings";
import { AuditLog } from "@/models/audit-log";
import type {
  ISettings,
  UpdateSettingsInput,
  UpdateBusinessProfileInput,
  UpdateApplicationPreferencesInput,
  UpdateBusinessHoursInput,
} from "@/types/settings";
import {
  updateSettingsSchema,
  updateBusinessProfileSchema,
  updatePreferencesSchema,
  updateBusinessHoursSchema,
} from "@/validations/settings";

export interface SettingsActorContext {
  id: string;
  name: string;
  ip?: string;
}

const SETTINGS_KEY = "GLOBAL_SETTINGS";

export const DEFAULT_SETTINGS = {
  settingsKey: SETTINGS_KEY,
  businessProfile: {
    shopName: "KASI Agri Agencies",
    proprietorName: "R. Balamurugan",
    phone: "9876543210",
    alternatePhone: "",
    email: "kasiagri@gmail.com",
    address: {
      street: "Main Road",
      villageTown: "Thiruvarur",
      district: "Thiruvarur",
      state: "Tamil Nadu",
      pincode: "610001",
    },
    gstin: "",
    logoUrl: "",
    description:
      "Retailer and distributor of certified fertilizers, hybrid seeds, and plant protection chemicals.",
  },
  preferences: {
    currency: "INR",
    currencySymbol: "₹",
    numberFormat: "en-IN",
    dateFormat: "DD/MM/YYYY",
    timezone: "Asia/Kolkata",
    financialYearStartMonth: 4,
    defaultLowStockThreshold: 10,
  },
  businessHours: {
    openingTime: "08:30",
    closingTime: "20:30",
    workingDays: [
      "MONDAY",
      "TUESDAY",
      "WEDNESDAY",
      "THURSDAY",
      "FRIDAY",
      "SATURDAY",
    ],
    isShopOpen: true,
  },
};

function formatSettings(doc: ISettingsDocument): ISettings {
  return {
    id: doc._id.toString(),
    settingsKey: doc.settingsKey,
    businessProfile: {
      shopName: doc.businessProfile?.shopName || DEFAULT_SETTINGS.businessProfile.shopName,
      proprietorName: doc.businessProfile?.proprietorName || DEFAULT_SETTINGS.businessProfile.proprietorName,
      phone: doc.businessProfile?.phone || DEFAULT_SETTINGS.businessProfile.phone,
      alternatePhone: doc.businessProfile?.alternatePhone || "",
      email: doc.businessProfile?.email || DEFAULT_SETTINGS.businessProfile.email,
      address: {
        street: doc.businessProfile?.address?.street || DEFAULT_SETTINGS.businessProfile.address.street,
        villageTown: doc.businessProfile?.address?.villageTown || DEFAULT_SETTINGS.businessProfile.address.villageTown,
        district: doc.businessProfile?.address?.district || DEFAULT_SETTINGS.businessProfile.address.district,
        state: doc.businessProfile?.address?.state || DEFAULT_SETTINGS.businessProfile.address.state,
        pincode: doc.businessProfile?.address?.pincode || DEFAULT_SETTINGS.businessProfile.address.pincode,
      },
      gstin: doc.businessProfile?.gstin || "",
      logoUrl: doc.businessProfile?.logoUrl || "",
      description: doc.businessProfile?.description || DEFAULT_SETTINGS.businessProfile.description,
    },
    preferences: {
      currency: doc.preferences?.currency || DEFAULT_SETTINGS.preferences.currency,
      currencySymbol: doc.preferences?.currencySymbol || DEFAULT_SETTINGS.preferences.currencySymbol,
      numberFormat: doc.preferences?.numberFormat || DEFAULT_SETTINGS.preferences.numberFormat,
      dateFormat: doc.preferences?.dateFormat || DEFAULT_SETTINGS.preferences.dateFormat,
      timezone: doc.preferences?.timezone || DEFAULT_SETTINGS.preferences.timezone,
      financialYearStartMonth: doc.preferences?.financialYearStartMonth ?? DEFAULT_SETTINGS.preferences.financialYearStartMonth,
      defaultLowStockThreshold: doc.preferences?.defaultLowStockThreshold ?? DEFAULT_SETTINGS.preferences.defaultLowStockThreshold,
    },
    businessHours: {
      openingTime: doc.businessHours?.openingTime || DEFAULT_SETTINGS.businessHours.openingTime,
      closingTime: doc.businessHours?.closingTime || DEFAULT_SETTINGS.businessHours.closingTime,
      workingDays: doc.businessHours?.workingDays || (DEFAULT_SETTINGS.businessHours.workingDays as any),
      isShopOpen: doc.businessHours?.isShopOpen ?? DEFAULT_SETTINGS.businessHours.isShopOpen,
    },
    updatedBy: doc.updatedBy
      ? {
          id: doc.updatedBy.id?.toString(),
          name: doc.updatedBy.name,
        }
      : undefined,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
  };
}

/**
 * Retrieves the global shop settings, auto-initializing with safe defaults if missing.
 */
export async function getShopSettings(): Promise<ISettings> {
  await connectDB();

  let doc = await Settings.findOne({ settingsKey: SETTINGS_KEY });
  if (!doc) {
    doc = await Settings.findOneAndUpdate(
      { settingsKey: SETTINGS_KEY },
      { $setOnInsert: DEFAULT_SETTINGS },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
  }

  if (!doc) {
    throw new Error("Failed to initialize or retrieve shop settings");
  }

  return formatSettings(doc);
}

/**
 * Partially updates any section of settings atomically, preserving all other fields.
 */
export async function updateShopSettings(
  input: UpdateSettingsInput,
  actor: SettingsActorContext
): Promise<ISettings> {
  await connectDB();

  const parsed = updateSettingsSchema.parse(input);
  const updateFields: Record<string, any> = {};

  if (parsed.businessProfile) {
    for (const [key, val] of Object.entries(parsed.businessProfile)) {
      if (val !== undefined) {
        if (key === "address" && typeof val === "object") {
          for (const [addrKey, addrVal] of Object.entries(val)) {
            if (addrVal !== undefined) {
              updateFields[`businessProfile.address.${addrKey}`] = addrVal;
            }
          }
        } else {
          updateFields[`businessProfile.${key}`] = val;
        }
      }
    }
  }

  if (parsed.preferences) {
    for (const [key, val] of Object.entries(parsed.preferences)) {
      if (val !== undefined) {
        updateFields[`preferences.${key}`] = val;
      }
    }
  }

  if (parsed.businessHours) {
    for (const [key, val] of Object.entries(parsed.businessHours)) {
      if (val !== undefined) {
        updateFields[`businessHours.${key}`] = val;
      }
    }
  }

  if (actor) {
    updateFields["updatedBy"] = {
      id: new mongoose.Types.ObjectId(actor.id),
      name: actor.name,
    };
  }

  const updatedDoc = await Settings.findOneAndUpdate(
    { settingsKey: SETTINGS_KEY },
    { $set: updateFields },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
  );

  if (!updatedDoc) {
    throw new Error("Failed to update shop settings");
  }

  // Log audit event
  await AuditLog.create({
    action: "SETTINGS_UPDATED",
    userId: actor.id,
    userName: actor.name,
    ipAddress: actor.ip,
    details: {
      updatedSections: Object.keys(input),
      fieldsCount: Object.keys(updateFields).length,
    },
  });

  return formatSettings(updatedDoc);
}

/**
 * Updates business profile details atomically.
 */
export async function updateBusinessProfile(
  input: UpdateBusinessProfileInput,
  actor: SettingsActorContext
): Promise<ISettings> {
  const parsed = updateBusinessProfileSchema.parse(input);
  const result = await updateShopSettings({ businessProfile: parsed }, actor);

  await AuditLog.create({
    action: "BUSINESS_PROFILE_UPDATED",
    userId: actor.id,
    userName: actor.name,
    ipAddress: actor.ip,
    details: {
      shopName: result.businessProfile.shopName,
      gstin: result.businessProfile.gstin,
    },
  });

  return result;
}

/**
 * Updates application preferences atomically.
 */
export async function updateApplicationPreferences(
  input: UpdateApplicationPreferencesInput,
  actor: SettingsActorContext
): Promise<ISettings> {
  const parsed = updatePreferencesSchema.parse(input);
  const result = await updateShopSettings({ preferences: parsed }, actor);

  await AuditLog.create({
    action: "PREFERENCES_UPDATED",
    userId: actor.id,
    userName: actor.name,
    ipAddress: actor.ip,
    details: {
      currency: result.preferences.currency,
      timezone: result.preferences.timezone,
      defaultLowStockThreshold: result.preferences.defaultLowStockThreshold,
    },
  });

  return result;
}

/**
 * Updates business working hours and days atomically.
 */
export async function updateBusinessHours(
  input: UpdateBusinessHoursInput,
  actor: SettingsActorContext
): Promise<ISettings> {
  const parsed = updateBusinessHoursSchema.parse(input);
  return await updateShopSettings({ businessHours: parsed }, actor);
}

/**
 * Updates or removes the business logo.
 */
export async function updateBusinessLogo(
  logoUrl: string,
  actor: SettingsActorContext
): Promise<ISettings> {
  const result = await updateShopSettings(
    { businessProfile: { logoUrl } },
    actor
  );

  await AuditLog.create({
    action: "LOGO_UPDATED",
    userId: actor.id,
    userName: actor.name,
    ipAddress: actor.ip,
    details: {
      hasLogo: Boolean(logoUrl),
    },
  });

  return result;
}

