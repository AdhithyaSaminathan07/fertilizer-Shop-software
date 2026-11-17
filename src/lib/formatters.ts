import type { IApplicationPreferences } from "@/types/settings";

export const DEFAULT_PREFERENCES: IApplicationPreferences = {
  currency: "INR",
  currencySymbol: "₹",
  numberFormat: "en-IN",
  dateFormat: "DD/MM/YYYY",
  timezone: "Asia/Kolkata",
  financialYearStartMonth: 4,
  defaultLowStockThreshold: 10,
};

/**
 * Formats a monetary amount into standard Indian Rupee currency format (₹).
 */
export function formatCurrency(
  amount: number,
  preferences?: Partial<IApplicationPreferences>
): string {
  const currency = preferences?.currency || DEFAULT_PREFERENCES.currency;
  const locale = preferences?.numberFormat || DEFAULT_PREFERENCES.numberFormat;

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0);
  } catch {
    // Resilient fallback to Indian Rupee
    return `₹${(amount || 0).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
}

/**
 * Formats a date into a localized string based on preferences.
 */
export function formatDate(
  dateVal: string | Date | undefined | null,
  format: string = DEFAULT_PREFERENCES.dateFormat
): string {
  if (!dateVal) return "—";
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return "—";

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  switch (format) {
    case "MM/DD/YYYY":
      return `${month}/${day}/${year}`;
    case "YYYY-MM-DD":
      return `${year}-${month}-${day}`;
    case "DD/MM/YYYY":
    default:
      return `${day}/${month}/${year}`;
  }
}

/**
 * Formats a date and time for display.
 */
export function formatDateTime(
  dateVal: string | Date | undefined | null,
  format: string = DEFAULT_PREFERENCES.dateFormat
): string {
  if (!dateVal) return "—";
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return "—";

  const dateStr = formatDate(d, format);
  const timeStr = d.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return `${dateStr}, ${timeStr}`;
}

/**
 * Formats a standard 10-digit Indian mobile number for readability: +91 XXXXX XXXXX.
 */
export function formatPhone(phone: string | undefined): string {
  if (!phone) return "—";
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 10) {
    return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
  }
  return phone;
}

