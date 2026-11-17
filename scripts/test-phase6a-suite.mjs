/**
 * KASI AGRI AGENCIES — PHASE 6A CORE SETTINGS & SHOP PROFILE TEST SUITE
 *
 * Verifies:
 * 1. Safe settings initialization with comprehensive defaults
 * 2. RBAC enforcement (401 unauthenticated, 403 forbidden for missing settings:view / settings:manage)
 * 3. Business profile update & atomic partial preservation
 * 4. Application preferences update & atomic partial preservation
 * 5. Business working hours & schedule updates
 * 6. Zod validation guards (GSTIN, phone, PIN code, threshold, time format)
 * 7. Logo upload, MIME/size validation, and removal
 * 8. Audit logging for all settings modifications
 * 9. Currency and date formatting helper parity
 */

import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { z } from "zod";

// Schema definitions
const BusinessAddressSchema = new mongoose.Schema(
  {
    street: { type: String, trim: true, default: "Main Road" },
    villageTown: { type: String, required: true, trim: true, default: "Thiruvarur" },
    district: { type: String, required: true, trim: true, default: "Thiruvarur" },
    state: { type: String, required: true, trim: true, default: "Tamil Nadu" },
    pincode: { type: String, required: true, trim: true, default: "610001" },
  },
  { _id: false }
);

const BusinessProfileSchema = new mongoose.Schema(
  {
    shopName: { type: String, required: true, trim: true, default: "KASI Agri Agencies" },
    proprietorName: { type: String, required: true, trim: true, default: "R. Balamurugan" },
    phone: { type: String, required: true, trim: true, default: "9876543210" },
    alternatePhone: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "kasiagri@gmail.com" },
    address: { type: BusinessAddressSchema, default: () => ({}) },
    gstin: { type: String, trim: true, uppercase: true, default: "" },
    logoUrl: { type: String, trim: true, default: "" },
    description: {
      type: String,
      trim: true,
      default: "Retailer and distributor of certified fertilizers, hybrid seeds, and plant protection chemicals.",
    },
  },
  { _id: false }
);

const ApplicationPreferencesSchema = new mongoose.Schema(
  {
    currency: { type: String, required: true, default: "INR" },
    currencySymbol: { type: String, required: true, default: "₹" },
    numberFormat: { type: String, required: true, default: "en-IN" },
    dateFormat: { type: String, required: true, default: "DD/MM/YYYY" },
    timezone: { type: String, required: true, default: "Asia/Kolkata" },
    financialYearStartMonth: { type: Number, required: true, min: 1, max: 12, default: 4 },
    defaultLowStockThreshold: { type: Number, required: true, min: 0, default: 10 },
  },
  { _id: false }
);

const BusinessHoursSchema = new mongoose.Schema(
  {
    openingTime: { type: String, default: "08:30" },
    closingTime: { type: String, default: "20:30" },
    workingDays: {
      type: [String],
      enum: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
      default: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"],
    },
    isShopOpen: { type: Boolean, default: true },
  },
  { _id: false }
);

const SettingsSchema = new mongoose.Schema(
  {
    settingsKey: { type: String, required: true, unique: true, default: "GLOBAL_SETTINGS", index: true },
    businessProfile: { type: BusinessProfileSchema, default: () => ({}) },
    preferences: { type: ApplicationPreferencesSchema, default: () => ({}) },
    businessHours: { type: BusinessHoursSchema, default: () => ({}) },
    updatedBy: {
      id: { type: mongoose.Schema.Types.ObjectId },
      name: { type: String, trim: true },
    },
  },
  { timestamps: true }
);

const AuditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    ipAddress: String,
    details: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

const Settings = mongoose.model("Settings", SettingsSchema);
const AuditLog = mongoose.model("AuditLog", AuditLogSchema);

// Security & RBAC helpers
function hasPermission(user, permission) {
  if (!user || user.status !== "ACTIVE") return false;
  if (user.role === "OWNER") return true;
  if (user.permissions && user.permissions.includes(permission)) return true;
  return false;
}

// Zod Validation Schemas
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;
const PHONE_REGEX = /^[6-9]\d{9}$/;
const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

const businessAddressSchema = z.object({
  street: z.string().trim().max(150).optional().or(z.literal("")),
  villageTown: z.string().trim().min(2).max(100),
  district: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  pincode: z.string().trim().regex(PINCODE_REGEX, "PIN code must be a valid 6-digit Indian postal code"),
});

const updateBusinessProfileSchema = z.object({
  shopName: z.string().trim().min(2).max(100).optional(),
  proprietorName: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().regex(PHONE_REGEX, "Phone must be a valid 10-digit Indian mobile number").optional(),
  alternatePhone: z.string().trim().refine((val) => !val || PHONE_REGEX.test(val)).optional().or(z.literal("")),
  email: z.string().trim().refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)).optional().or(z.literal("")),
  address: businessAddressSchema.partial().optional(),
  gstin: z.string().trim().toUpperCase().refine((val) => !val || GSTIN_REGEX.test(val), "Invalid GSTIN format").optional().or(z.literal("")),
  logoUrl: z.string().trim().optional().or(z.literal("")),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

const updatePreferencesSchema = z.object({
  currency: z.string().trim().min(2).max(10).default("INR").optional(),
  currencySymbol: z.string().trim().min(1).max(5).default("₹").optional(),
  numberFormat: z.string().trim().min(2).max(20).default("en-IN").optional(),
  dateFormat: z.enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).default("DD/MM/YYYY").optional(),
  timezone: z.string().trim().min(3).max(50).default("Asia/Kolkata").optional(),
  financialYearStartMonth: z.coerce.number().int().min(1).max(12).default(4).optional(),
  defaultLowStockThreshold: z.coerce.number().int().min(0, "Threshold cannot be negative").max(100000).default(10).optional(),
});

const updateBusinessHoursSchema = z.object({
  openingTime: z.string().trim().regex(TIME_REGEX, "Opening time must be in HH:mm format").optional().or(z.literal("")),
  closingTime: z.string().trim().regex(TIME_REGEX, "Closing time must be in HH:mm format").optional().or(z.literal("")),
  workingDays: z
    .array(z.enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]))
    .min(1, "Select at least one business working day")
    .optional(),
  isShopOpen: z.boolean().optional(),
});

const updateSettingsSchema = z.object({
  businessProfile: updateBusinessProfileSchema.optional(),
  preferences: updatePreferencesSchema.optional(),
  businessHours: updateBusinessHoursSchema.optional(),
});

const SETTINGS_KEY = "GLOBAL_SETTINGS";

const DEFAULT_SETTINGS = {
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
    description: "Retailer and distributor of certified fertilizers, hybrid seeds, and plant protection chemicals.",
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
    workingDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"],
    isShopOpen: true,
  },
};

function formatSettings(doc) {
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
      workingDays: doc.businessHours?.workingDays || DEFAULT_SETTINGS.businessHours.workingDays,
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

async function getShopSettingsService() {
  let doc = await Settings.findOne({ settingsKey: SETTINGS_KEY });
  if (!doc) {
    doc = await Settings.findOneAndUpdate(
      { settingsKey: SETTINGS_KEY },
      { $setOnInsert: DEFAULT_SETTINGS },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  return formatSettings(doc);
}

async function updateShopSettingsService(input, actor) {
  const parsed = updateSettingsSchema.parse(input);
  const updateFields = {};

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
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

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

// API Simulation Handlers
async function handleGetSettings(request) {
  const { user } = request;
  if (!user) {
    return { status: 401, data: { success: false, message: "Authentication required" } };
  }
  if (!hasPermission(user, "settings:view")) {
    return { status: 403, data: { success: false, message: "Forbidden: You lack permission to view shop settings" } };
  }

  try {
    const settings = await getShopSettingsService();
    return { status: 200, data: { success: true, settings } };
  } catch (err) {
    return { status: 500, data: { success: false, message: err.message } };
  }
}

async function handlePatchSettings(request) {
  const { user, body, headers = {} } = request;
  if (!user) {
    return { status: 401, data: { success: false, message: "Authentication required" } };
  }
  if (!hasPermission(user, "settings:manage")) {
    return { status: 403, data: { success: false, message: "Forbidden: You lack permission to modify shop settings" } };
  }

  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, data: { success: false, message: parsed.error.issues.map((i) => i.message).join(", ") } };
  }

  try {
    const settings = await updateShopSettingsService(parsed.data, {
      id: user.id,
      name: user.name,
      ip: headers["x-forwarded-for"] || "127.0.0.1",
    });
    return { status: 200, data: { success: true, settings } };
  } catch (err) {
    return { status: 500, data: { success: false, message: err.message } };
  }
}

async function handlePostLogo(request) {
  const { user, mimeType, sizeBytes, dataUrl } = request;
  if (!user) {
    return { status: 401, data: { success: false, message: "Authentication required" } };
  }
  if (!hasPermission(user, "settings:manage")) {
    return { status: 403, data: { success: false, message: "Forbidden: You lack permission to update shop logo" } };
  }

  const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
  if (mimeType && !allowedTypes.includes(mimeType)) {
    return { status: 400, data: { success: false, message: "Invalid file type. Allowed: PNG, JPEG, WEBP, SVG" } };
  }

  if (sizeBytes && sizeBytes > 2 * 1024 * 1024) {
    return { status: 400, data: { success: false, message: "File size exceeds 2MB limit" } };
  }

  try {
    const updated = await updateShopSettingsService(
      { businessProfile: { logoUrl: dataUrl } },
      { id: user.id, name: user.name }
    );
    await AuditLog.create({
      action: "LOGO_UPDATED",
      userId: user.id,
      userName: user.name,
      details: { hasLogo: Boolean(dataUrl) },
    });
    return { status: 200, data: { success: true, logoUrl: updated.businessProfile.logoUrl } };
  } catch (err) {
    return { status: 500, data: { success: false, message: err.message } };
  }
}

async function handleDeleteLogo(request) {
  const { user } = request;
  if (!user) {
    return { status: 401, data: { success: false, message: "Authentication required" } };
  }
  if (!hasPermission(user, "settings:manage")) {
    return { status: 403, data: { success: false, message: "Forbidden: You lack permission to remove shop logo" } };
  }

  try {
    await updateShopSettingsService(
      { businessProfile: { logoUrl: "" } },
      { id: user.id, name: user.name }
    );
    await AuditLog.create({
      action: "LOGO_UPDATED",
      userId: user.id,
      userName: user.name,
      details: { hasLogo: false },
    });
    return { status: 200, data: { success: true, logoUrl: "" } };
  } catch (err) {
    return { status: 500, data: { success: false, message: err.message } };
  }
}

// Formatting helpers
function formatCurrency(amount) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function formatDate(dateVal, format = "DD/MM/YYYY") {
  if (!dateVal) return "—";
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  if (format === "YYYY-MM-DD") return `${year}-${month}-${day}`;
  if (format === "MM/DD/YYYY") return `${month}/${day}/${year}`;
  return `${day}/${month}/${year}`;
}

// TEST RUNNER
async function runPhase6ATestSuite() {
  console.log("==========================================================");
  console.log("KASI AGRI AGENCIES — PHASE 6A CORE SETTINGS TEST SUITE");
  console.log("==========================================================");

  let replSet;
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  PASS: ${message}`);
      passed++;
    } else {
      console.error(`  FAIL: ${message}`);
      failed++;
    }
  }

  try {
    console.log("\nStarting isolated MongoDB Replica Set in-memory...");
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    const uri = replSet.getUri();
    await mongoose.connect(uri);
    console.log("Connected to in-memory replica set successfully.\n");

    const ownerUser = {
      id: new mongoose.Types.ObjectId().toString(),
      name: "R. Balamurugan",
      role: "OWNER",
      status: "ACTIVE",
      permissions: ["settings:view", "settings:manage"],
    };

    const managerUser = {
      id: new mongoose.Types.ObjectId().toString(),
      name: "Senthil Manager",
      role: "EMPLOYEE",
      status: "ACTIVE",
      permissions: ["settings:view", "settings:manage"],
    };

    const clerkUser = {
      id: new mongoose.Types.ObjectId().toString(),
      name: "Murugan Clerk (View Only)",
      role: "EMPLOYEE",
      status: "ACTIVE",
      permissions: ["settings:view"], // lacks settings:manage
    };

    const unauthorizedUser = {
      id: new mongoose.Types.ObjectId().toString(),
      name: "No Permissions User",
      role: "EMPLOYEE",
      status: "ACTIVE",
      permissions: [], // lacks both
    };

    console.log("----------------------------------------------------------");
    console.log("TEST 1: SAFE INITIALIZATION & DEFAULT SETTINGS VALUES");
    console.log("----------------------------------------------------------");
    const initialSettings = await getShopSettingsService();

    assert(initialSettings.businessProfile.shopName === "KASI Agri Agencies", "Default shopName is 'KASI Agri Agencies'");
    assert(initialSettings.businessProfile.proprietorName === "R. Balamurugan", "Default proprietorName is 'R. Balamurugan'");
    assert(initialSettings.businessProfile.phone === "9876543210", "Default phone is '9876543210'");
    assert(initialSettings.businessProfile.address.villageTown === "Thiruvarur", "Default villageTown is 'Thiruvarur'");
    assert(initialSettings.businessProfile.address.district === "Thiruvarur", "Default district is 'Thiruvarur'");
    assert(initialSettings.businessProfile.address.state === "Tamil Nadu", "Default state is 'Tamil Nadu'");
    assert(initialSettings.businessProfile.address.pincode === "610001", "Default pincode is '610001'");
    assert(initialSettings.preferences.currency === "INR", "Default currency is 'INR'");
    assert(initialSettings.preferences.currencySymbol === "₹", "Default currencySymbol is '₹'");
    assert(initialSettings.preferences.numberFormat === "en-IN", "Default numberFormat is 'en-IN'");
    assert(initialSettings.preferences.dateFormat === "DD/MM/YYYY", "Default dateFormat is 'DD/MM/YYYY'");
    assert(initialSettings.preferences.timezone === "Asia/Kolkata", "Default timezone is 'Asia/Kolkata'");
    assert(initialSettings.preferences.financialYearStartMonth === 4, "Default financialYearStartMonth is 4 (April)");
    assert(initialSettings.preferences.defaultLowStockThreshold === 10, "Default lowStockThreshold is 10");
    assert(initialSettings.businessHours.openingTime === "08:30", "Default openingTime is '08:30'");
    assert(initialSettings.businessHours.closingTime === "20:30", "Default closingTime is '20:30'");
    assert(initialSettings.businessHours.workingDays.length === 6, "Default workingDays has 6 days");
    assert(initialSettings.businessHours.isShopOpen === true, "Default isShopOpen is true");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 2: AUTHENTICATION & RBAC ACCESS CONTROL");
    console.log("----------------------------------------------------------");
    const unauthGet = await handleGetSettings({ user: null });
    assert(unauthGet.status === 401, "GET /api/settings: Unauthenticated returns 401 Unauthorized");

    const forbiddenGet = await handleGetSettings({ user: unauthorizedUser });
    assert(forbiddenGet.status === 403, "GET /api/settings: Employee lacking 'settings:view' returns 403 Forbidden");

    const clerkGet = await handleGetSettings({ user: clerkUser });
    assert(clerkGet.status === 200, "GET /api/settings: Clerk with 'settings:view' returns 200 OK");

    const clerkForbiddenPatch = await handlePatchSettings({
      user: clerkUser,
      body: { businessProfile: { shopName: "Hacked Shop" } },
    });
    assert(clerkForbiddenPatch.status === 403, "PATCH /api/settings: Clerk lacking 'settings:manage' returns 403 Forbidden");

    const clerkForbiddenLogo = await handlePostLogo({
      user: clerkUser,
      dataUrl: "data:image/png;base64,mock",
    });
    assert(clerkForbiddenLogo.status === 403, "POST /api/settings/logo: Clerk lacking 'settings:manage' returns 403 Forbidden");

    const managerPatch = await handlePatchSettings({
      user: managerUser,
      body: { businessProfile: { description: "Updated by Manager" } },
    });
    assert(managerPatch.status === 200, "PATCH /api/settings: Manager with 'settings:manage' returns 200 OK");

    const ownerPatch = await handlePatchSettings({
      user: ownerUser,
      body: { businessProfile: { description: "Verified by Owner" } },
    });
    assert(ownerPatch.status === 200, "PATCH /api/settings: Owner returns 200 OK");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 3: BUSINESS PROFILE UPDATES & ATOMIC PRESERVATION");
    console.log("----------------------------------------------------------");
    const profileUpdateRes = await handlePatchSettings({
      user: ownerUser,
      body: {
        businessProfile: {
          shopName: "KASI Agri Agencies & Pesticides Hub",
          proprietorName: "R. Balamurugan M.Sc.",
          address: { street: "12/4 East Car Street" },
        },
      },
    });

    assert(profileUpdateRes.status === 200, "Profile update returns 200 OK");
    assert(profileUpdateRes.data.settings.businessProfile.shopName === "KASI Agri Agencies & Pesticides Hub", "shopName updated successfully");
    assert(profileUpdateRes.data.settings.businessProfile.proprietorName === "R. Balamurugan M.Sc.", "proprietorName updated successfully");
    assert(profileUpdateRes.data.settings.businessProfile.address.street === "12/4 East Car Street", "street address updated successfully");
    // Verify untouched fields were preserved
    assert(profileUpdateRes.data.settings.businessProfile.phone === "9876543210", "Preserved untouched primary phone");
    assert(profileUpdateRes.data.settings.businessProfile.address.villageTown === "Thiruvarur", "Preserved untouched villageTown");
    assert(profileUpdateRes.data.settings.preferences.currency === "INR", "Preserved untouched currency preference");
    assert(profileUpdateRes.data.settings.businessHours.openingTime === "08:30", "Preserved untouched openingTime");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 4: APPLICATION PREFERENCES UPDATES & PRESERVATION");
    console.log("----------------------------------------------------------");
    const prefUpdateRes = await handlePatchSettings({
      user: ownerUser,
      body: {
        preferences: {
          defaultLowStockThreshold: 25,
          dateFormat: "YYYY-MM-DD",
        },
      },
    });

    assert(prefUpdateRes.status === 200, "Preferences update returns 200 OK");
    assert(prefUpdateRes.data.settings.preferences.defaultLowStockThreshold === 25, "defaultLowStockThreshold updated to 25");
    assert(prefUpdateRes.data.settings.preferences.dateFormat === "YYYY-MM-DD", "dateFormat updated to YYYY-MM-DD");
    assert(prefUpdateRes.data.settings.preferences.timezone === "Asia/Kolkata", "Preserved untouched timezone");
    assert(prefUpdateRes.data.settings.businessProfile.shopName === "KASI Agri Agencies & Pesticides Hub", "Preserved untouched shopName in profile");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 5: BUSINESS HOURS & SCHEDULE UPDATES");
    console.log("----------------------------------------------------------");
    const hoursUpdateRes = await handlePatchSettings({
      user: ownerUser,
      body: {
        businessHours: {
          openingTime: "09:00",
          closingTime: "21:00",
          workingDays: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"],
          isShopOpen: true,
        },
      },
    });

    assert(hoursUpdateRes.status === 200, "Hours update returns 200 OK");
    assert(hoursUpdateRes.data.settings.businessHours.openingTime === "09:00", "openingTime updated to 09:00");
    assert(hoursUpdateRes.data.settings.businessHours.closingTime === "21:00", "closingTime updated to 21:00");
    assert(hoursUpdateRes.data.settings.businessHours.workingDays.length === 7, "workingDays updated to 7 days");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 6: INPUT VALIDATION & CONFLICT GUARDS");
    console.log("----------------------------------------------------------");
    // 6.1 Short shop name (< 2 chars)
    const shortNameRes = await handlePatchSettings({
      user: ownerUser,
      body: { businessProfile: { shopName: "K" } },
    });
    assert(shortNameRes.status === 400, "Short shop name (<2 chars) returns 400 Bad Request");

    // 6.2 Invalid Indian phone number (not 10 digits or invalid prefix)
    const badPhoneRes = await handlePatchSettings({
      user: ownerUser,
      body: { businessProfile: { phone: "12345" } },
    });
    assert(badPhoneRes.status === 400, "Invalid phone number returns 400 Bad Request");

    // 6.3 Invalid PIN code
    const badPinRes = await handlePatchSettings({
      user: ownerUser,
      body: { businessProfile: { address: { pincode: "6100" } } },
    });
    assert(badPinRes.status === 400, "Invalid 4-digit PIN code returns 400 Bad Request");

    // 6.4 Invalid GSTIN format
    const badGstinRes = await handlePatchSettings({
      user: ownerUser,
      body: { businessProfile: { gstin: "INVALID-GST-NUMBER" } },
    });
    assert(badGstinRes.status === 400, "Invalid GSTIN format returns 400 Bad Request");

    // 6.5 Valid GSTIN format accepted
    const validGstinRes = await handlePatchSettings({
      user: ownerUser,
      body: { businessProfile: { gstin: "33AAACI1234F1Z1" } },
    });
    assert(validGstinRes.status === 200, "Valid 15-character GSTIN returns 200 OK");
    assert(validGstinRes.data.settings.businessProfile.gstin === "33AAACI1234F1Z1", "GSTIN persisted accurately");

    // 6.6 Negative low stock threshold
    const negativeThreshRes = await handlePatchSettings({
      user: ownerUser,
      body: { preferences: { defaultLowStockThreshold: -5 } },
    });
    assert(negativeThreshRes.status === 400, "Negative low stock threshold returns 400 Bad Request");

    // 6.7 Invalid time format
    const badTimeRes = await handlePatchSettings({
      user: ownerUser,
      body: { businessHours: { openingTime: "25:70" } },
    });
    assert(badTimeRes.status === 400, "Invalid time format (25:70) returns 400 Bad Request");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 7: LOGO UPLOAD, VALIDATION & REMOVAL");
    console.log("----------------------------------------------------------");
    // 7.1 Invalid file MIME type
    const badMimeRes = await handlePostLogo({
      user: ownerUser,
      mimeType: "application/pdf",
      dataUrl: "data:application/pdf;base64,mock",
    });
    assert(badMimeRes.status === 400, "PDF logo upload returns 400 Bad Request");

    // 7.2 File size exceeding 2MB
    const bigFileRes = await handlePostLogo({
      user: ownerUser,
      mimeType: "image/png",
      sizeBytes: 3 * 1024 * 1024,
      dataUrl: "data:image/png;base64,huge",
    });
    assert(bigFileRes.status === 400, "File size > 2MB returns 400 Bad Request");

    // 7.3 Valid logo upload
    const validLogoDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const validLogoRes = await handlePostLogo({
      user: ownerUser,
      mimeType: "image/png",
      sizeBytes: 1500,
      dataUrl: validLogoDataUrl,
    });
    assert(validLogoRes.status === 200, "Valid PNG logo upload returns 200 OK");
    assert(validLogoRes.data.logoUrl === validLogoDataUrl, "logoUrl persisted accurately");

    // 7.4 Logo removal
    const removeLogoRes = await handleDeleteLogo({ user: ownerUser });
    assert(removeLogoRes.status === 200, "DELETE /api/settings/logo returns 200 OK");
    assert(removeLogoRes.data.logoUrl === "", "logoUrl cleared to empty string");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 8: AUDIT LOG GENERATION FOR SETTINGS");
    console.log("----------------------------------------------------------");
    const settingsAudit = await AuditLog.findOne({ action: "SETTINGS_UPDATED" });
    assert(settingsAudit !== null, "AuditLog created for SETTINGS_UPDATED");
    assert(settingsAudit.userName === ownerUser.name || settingsAudit.userName === managerUser.name, "AuditLog captures correct actor name");

    const logoAudit = await AuditLog.findOne({ action: "LOGO_UPDATED" });
    assert(logoAudit !== null, "AuditLog created for LOGO_UPDATED");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 9: CENTRALIZED FORMATTING HELPERS PARITY");
    console.log("----------------------------------------------------------");
    const formattedCurr = formatCurrency(125000.5);
    assert(formattedCurr.includes("1,25,000.50"), "formatCurrency applies Indian lakh grouping (₹1,25,000.50)");

    const formattedDate = formatDate(new Date("2026-11-17T10:00:00Z"), "DD/MM/YYYY");
    assert(formattedDate === "17/11/2026", "formatDate formats to DD/MM/YYYY");

    console.log("\n==========================================================");
    console.log(`TEST SUITE RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log("==========================================================\n");

    if (failed > 0) process.exit(1);
  } finally {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  }
}

runPhase6ATestSuite().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});

