export type WorkingDay =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export interface IBusinessAddress {
  street?: string;
  villageTown: string;
  district: string;
  state: string;
  pincode: string;
}

export interface IBusinessProfile {
  shopName: string;
  proprietorName: string;
  phone: string;
  alternatePhone?: string;
  email?: string;
  address: IBusinessAddress;
  gstin?: string;
  logoUrl?: string;
  description?: string;
}

export interface IApplicationPreferences {
  currency: string; // e.g. "INR"
  currencySymbol: string; // e.g. "₹"
  numberFormat: string; // e.g. "en-IN"
  dateFormat: string; // e.g. "DD/MM/YYYY"
  timezone: string; // e.g. "Asia/Kolkata"
  financialYearStartMonth: number; // 4 for April (1-12)
  defaultLowStockThreshold: number; // e.g. 10
}

export interface IBusinessHours {
  openingTime?: string; // e.g. "08:30"
  closingTime?: string; // e.g. "20:30"
  workingDays: WorkingDay[];
  isShopOpen?: boolean;
}

export interface ISettings {
  id: string;
  settingsKey: string; // Singleton key "GLOBAL_SETTINGS"
  businessProfile: IBusinessProfile;
  preferences: IApplicationPreferences;
  businessHours: IBusinessHours;
  updatedBy?: {
    id: string;
    name: string;
  };
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface UpdateBusinessProfileInput {
  shopName?: string;
  proprietorName?: string;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  address?: Partial<IBusinessAddress>;
  gstin?: string;
  logoUrl?: string;
  description?: string;
}

export interface UpdateApplicationPreferencesInput {
  currency?: string;
  currencySymbol?: string;
  numberFormat?: string;
  dateFormat?: string;
  timezone?: string;
  financialYearStartMonth?: number;
  defaultLowStockThreshold?: number;
}

export interface UpdateBusinessHoursInput {
  openingTime?: string;
  closingTime?: string;
  workingDays?: WorkingDay[];
  isShopOpen?: boolean;
}

export interface UpdateSettingsInput {
  businessProfile?: UpdateBusinessProfileInput;
  preferences?: UpdateApplicationPreferencesInput;
  businessHours?: UpdateBusinessHoursInput;
}

