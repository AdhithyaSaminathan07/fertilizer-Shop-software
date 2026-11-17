import mongoose, { Schema, Document, Model } from "mongoose";
import type {
  IBusinessAddress,
  IBusinessProfile,
  IApplicationPreferences,
  IBusinessHours,
  WorkingDay,
} from "@/types/settings";

export interface ISettingsDocument extends Document {
  settingsKey: string;
  businessProfile: IBusinessProfile;
  preferences: IApplicationPreferences;
  businessHours: IBusinessHours;
  updatedBy?: {
    id: mongoose.Types.ObjectId;
    name: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const BusinessAddressSchema = new Schema<IBusinessAddress>(
  {
    street: { type: String, trim: true, default: "Main Road" },
    villageTown: { type: String, required: true, trim: true, default: "Thiruvarur" },
    district: { type: String, required: true, trim: true, default: "Thiruvarur" },
    state: { type: String, required: true, trim: true, default: "Tamil Nadu" },
    pincode: { type: String, required: true, trim: true, default: "610001" },
  },
  { _id: false }
);

const BusinessProfileSchema = new Schema<IBusinessProfile>(
  {
    shopName: {
      type: String,
      required: true,
      trim: true,
      default: "KASI Agri Agencies",
    },
    proprietorName: {
      type: String,
      required: true,
      trim: true,
      default: "R. Balamurugan",
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      default: "9876543210",
    },
    alternatePhone: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "kasiagri@gmail.com",
    },
    address: {
      type: BusinessAddressSchema,
      default: () => ({}),
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    logoUrl: {
      type: String,
      trim: true,
      default: "",
    },
    description: {
      type: String,
      trim: true,
      default:
        "Retailer and distributor of certified fertilizers, hybrid seeds, and plant protection chemicals.",
    },
  },
  { _id: false }
);

const ApplicationPreferencesSchema = new Schema<IApplicationPreferences>(
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

const BusinessHoursSchema = new Schema<IBusinessHours>(
  {
    openingTime: { type: String, default: "08:30" },
    closingTime: { type: String, default: "20:30" },
    workingDays: {
      type: [String],
      enum: [
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
        "SUNDAY",
      ],
      default: [
        "MONDAY",
        "TUESDAY",
        "WEDNESDAY",
        "THURSDAY",
        "FRIDAY",
        "SATURDAY",
      ],
    },
    isShopOpen: { type: Boolean, default: true },
  },
  { _id: false }
);

const SettingsSchema = new Schema<ISettingsDocument>(
  {
    settingsKey: {
      type: String,
      required: true,
      unique: true,
      default: "GLOBAL_SETTINGS",
      index: true,
    },
    businessProfile: {
      type: BusinessProfileSchema,
      default: () => ({}),
    },
    preferences: {
      type: ApplicationPreferencesSchema,
      default: () => ({}),
    },
    businessHours: {
      type: BusinessHoursSchema,
      default: () => ({}),
    },
    updatedBy: {
      id: { type: Schema.Types.ObjectId, ref: "User" },
      name: { type: String, trim: true },
    },
  },
  { timestamps: true }
);

export const Settings: Model<ISettingsDocument> =
  mongoose.models.Settings ||
  mongoose.model<ISettingsDocument>("Settings", SettingsSchema);

