"use client";

import * as React from "react";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Building2,
  Store,
  MapPin,
  Phone,
  Mail,
  FileText,
  Clock,
  Calendar,
  Save,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  ShieldCheck,
  Sparkles,
  Info,
  DollarSign,
  ArrowLeft,
  Tag,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { CategoryManager } from "@/components/settings/category-manager";
import { SupplierManager } from "@/components/settings/supplier-manager";
import type {
  ISettings,
  IBusinessProfile,
  IApplicationPreferences,
  IBusinessHours,
  WorkingDay,
} from "@/types/settings";
import {
  GSTIN_REGEX,
  PINCODE_REGEX,
  PHONE_REGEX,
  TIME_REGEX,
} from "@/validations/settings";

type SettingsTab =
  | "profile"
  | "contact"
  | "tax"
  | "preferences"
  | "hours"
  | "categories"
  | "suppliers";

const ALL_WORKING_DAYS: { key: WorkingDay; label: string; short: string }[] = [
  { key: "MONDAY", label: "Monday", short: "Mon" },
  { key: "TUESDAY", label: "Tuesday", short: "Tue" },
  { key: "WEDNESDAY", label: "Wednesday", short: "Wed" },
  { key: "THURSDAY", label: "Thursday", short: "Thu" },
  { key: "FRIDAY", label: "Friday", short: "Fri" },
  { key: "SATURDAY", label: "Saturday", short: "Sat" },
  { key: "SUNDAY", label: "Sunday", short: "Sun" },
];

function SettingsContent() {
  const searchParams = useSearchParams();
  const urlTab = searchParams?.get("tab") as SettingsTab | null;
  const validUrlTab =
    urlTab && ["profile", "contact", "tax", "preferences", "hours", "categories", "suppliers"].includes(urlTab)
      ? urlTab
      : null;

  const [selectedTab, setSelectedTab] = useState<SettingsTab>("profile");
  const activeTab = validUrlTab || selectedTab;
  const setActiveTab = setSelectedTab;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [profile, setProfile] = useState<IBusinessProfile>({
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
    description: "",
  });

  const [preferences, setPreferences] = useState<IApplicationPreferences>({
    currency: "INR",
    currencySymbol: "₹",
    numberFormat: "en-IN",
    dateFormat: "DD/MM/YYYY",
    timezone: "Asia/Kolkata",
    financialYearStartMonth: 4,
    defaultLowStockThreshold: 10,
  });

  const [businessHours, setBusinessHours] = useState<IBusinessHours>({
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
  });

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Load Settings
  useEffect(() => {
    let ignore = false;

    fetch("/api/settings", { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data) => {
        if (!ignore && data.success && data.data?.settings) {
          const s: ISettings = data.data.settings;
          setProfile(s.businessProfile);
          setPreferences(s.preferences);
          setBusinessHours(s.businessHours);
        } else if (!data.success && data.message?.includes("Forbidden")) {
          setStatusMessage({
            type: "error",
            text: "Access Denied: You do not have permission to view system settings.",
          });
        }
      })
      .catch(() => {
        if (!ignore) {
          setStatusMessage({
            type: "error",
            text: "Failed to load settings. Please check your connection.",
          });
        }
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  // Validation
  const validateCurrentTab = (): boolean => {
    const errors: Record<string, string> = {};

    if (activeTab === "profile") {
      if (!profile.shopName.trim() || profile.shopName.trim().length < 2) {
        errors.shopName = "Business name must be at least 2 characters.";
      }
      if (!profile.proprietorName.trim() || profile.proprietorName.trim().length < 2) {
        errors.proprietorName = "Proprietor name must be at least 2 characters.";
      }
    }

    if (activeTab === "contact") {
      if (!PHONE_REGEX.test(profile.phone)) {
        errors.phone = "Primary phone must be a valid 10-digit Indian mobile number.";
      }
      if (profile.alternatePhone && !PHONE_REGEX.test(profile.alternatePhone)) {
        errors.alternatePhone = "Alternate phone must be a valid 10-digit Indian mobile number.";
      }
      if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) {
        errors.email = "Please enter a valid email address.";
      }
      if (!profile.address.villageTown.trim()) {
        errors.villageTown = "Village/Town is required.";
      }
      if (!profile.address.district.trim()) {
        errors.district = "District is required.";
      }
      if (!profile.address.state.trim()) {
        errors.state = "State is required.";
      }
      if (!PINCODE_REGEX.test(profile.address.pincode)) {
        errors.pincode = "PIN code must be a valid 6-digit Indian postal code.";
      }
    }

    if (activeTab === "tax") {
      if (profile.gstin && !GSTIN_REGEX.test(profile.gstin)) {
        errors.gstin = "GSTIN must be a valid 15-character Indian GST format (e.g. 33AAAAA0000A1Z5).";
      }
    }

    if (activeTab === "preferences") {
      if (preferences.defaultLowStockThreshold < 0) {
        errors.defaultLowStockThreshold = "Low-stock threshold cannot be negative.";
      }
      if (preferences.financialYearStartMonth < 1 || preferences.financialYearStartMonth > 12) {
        errors.financialYearStartMonth = "Financial year start month must be between 1 and 12.";
      }
    }

    if (activeTab === "hours") {
      if (businessHours.openingTime && !TIME_REGEX.test(businessHours.openingTime)) {
        errors.openingTime = "Opening time must be in HH:mm 24-hour format.";
      }
      if (businessHours.closingTime && !TIME_REGEX.test(businessHours.closingTime)) {
        errors.closingTime = "Closing time must be in HH:mm 24-hour format.";
      }
      if (!businessHours.workingDays || businessHours.workingDays.length === 0) {
        errors.workingDays = "Please select at least one working day.";
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Save Settings
  const handleSave = async () => {
    setStatusMessage(null);
    if (!validateCurrentTab()) {
      setStatusMessage({
        type: "error",
        text: "Please correct the highlighted validation errors before saving.",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        businessProfile: profile,
        preferences,
        businessHours,
      };

      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || "Failed to update settings");
      }

      setIsDirty(false);
      setStatusMessage({
        type: "success",
        text: "Shop profile and settings updated successfully!",
      });

      // Clear success message after 4 seconds
      setTimeout(() => {
        setStatusMessage((current) => (current?.type === "success" ? null : current));
      }, 4000);
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save settings",
      });
    } finally {
      setSaving(false);
    }
  };

  // Logo Upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setStatusMessage({
        type: "error",
        text: "Invalid file type. Please upload a PNG, JPEG, WEBP, or SVG image.",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setStatusMessage({
        type: "error",
        text: "Logo file size must be less than 2MB.",
      });
      return;
    }

    setUploadingLogo(true);
    setStatusMessage(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/settings/logo", {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to upload logo");
      }

      setProfile((prev) => ({ ...prev, logoUrl: data.data.logoUrl }));
      setStatusMessage({
        type: "success",
        text: "Shop logo uploaded and saved successfully!",
      });
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to upload logo",
      });
    } finally {
      setUploadingLogo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Remove Logo
  const handleRemoveLogo = async () => {
    setUploadingLogo(true);
    setStatusMessage(null);
    try {
      const res = await fetch("/api/settings/logo", {
        method: "DELETE",
        credentials: "same-origin",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to remove logo");
      }

      setProfile((prev) => ({ ...prev, logoUrl: "" }));
      setStatusMessage({
        type: "success",
        text: "Shop logo removed successfully.",
      });
    } catch (err) {
      setStatusMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to remove logo",
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  const toggleWorkingDay = (day: WorkingDay) => {
    setIsDirty(true);
    setBusinessHours((prev) => {
      const exists = prev.workingDays.includes(day);
      const next = exists
        ? prev.workingDays.filter((d) => d !== day)
        : [...prev.workingDays, day];
      return { ...prev, workingDays: next };
    });
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-6 w-6 animate-spin text-[#176B3A]" />
          <p className="text-xs font-semibold text-slate-500">Loading shop settings...</p>
        </div>
      </div>
    );
  }

  const tabs: { key: SettingsTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "profile", label: "Business Profile", icon: Store },
    { key: "contact", label: "Address & Contact", icon: MapPin },
    { key: "tax", label: "Tax & Registration", icon: FileText },
    { key: "preferences", label: "Preferences", icon: Sliders },
    { key: "hours", label: "Business Hours", icon: Clock },
    { key: "categories", label: "Category Management", icon: Tag },
    { key: "suppliers", label: "Supplier Management", icon: Truck },
  ];

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#176B3A] to-[#2E9D59] text-white shadow-md shadow-[#176B3A]/20">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  Settings & Shop Profile
                </h1>
                <Badge variant="success" size="sm">
                  Active Shop
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage business registration, contact coordinates, tax identifiers, and operational preferences.
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        {!["categories", "suppliers"].includes(activeTab) && (
          <div className="flex items-center gap-2.5">
            {isDirty && (
              <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full animate-pulse">
                Unsaved changes
              </span>
            )}
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-2 shadow-xs"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Changes</span>
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`flex items-center justify-between rounded-xl border p-4 text-xs font-medium shadow-xs ${
            statusMessage.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-rose-200 bg-rose-50 text-rose-900"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Settings Card */}
      <Card className="overflow-hidden border-slate-200 shadow-xs bg-white">
        {/* Horizontal Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 overflow-x-auto px-4 sm:px-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setFieldErrors({});
                  setActiveTab(tab.key);
                }}
                className={`flex items-center gap-2 border-b-2 px-4 py-3.5 text-xs font-semibold whitespace-nowrap transition-colors ${
                  isActive
                    ? "border-[#176B3A] text-[#176B3A]"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-[#176B3A]" : "text-slate-400"}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <CardContent className="p-6">
          {/* TAB 1: BUSINESS PROFILE */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Shop Identity & Proprietor Details
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  General shop branding and proprietor ownership information printed on bills and receipts.
                </p>
              </div>

              {/* Logo Section */}
              <div className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 space-y-3">
                <label className="block text-xs font-semibold text-slate-700">
                  Shop Brand Logo
                </label>
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white overflow-hidden shadow-xs">
                    {profile.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.logoUrl}
                        alt="Shop Logo"
                        className="h-full w-full object-contain p-1"
                      />
                    ) : (
                      <Store className="h-8 w-8 text-slate-300" />
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleLogoUpload}
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        className="hidden"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingLogo}
                        className="gap-1.5 text-xs"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        <span>{uploadingLogo ? "Uploading..." : "Upload Logo"}</span>
                      </Button>

                      {profile.logoUrl && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleRemoveLogo}
                          disabled={uploadingLogo}
                          className="gap-1 text-rose-600 hover:bg-rose-50 hover:text-rose-700 text-xs"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>Remove</span>
                        </Button>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Recommended: Square PNG or SVG with transparent background (Max 2MB).
                    </p>
                  </div>
                </div>
              </div>

              {/* Text Fields */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Business / Shop Name *
                  </label>
                  <Input
                    required
                    value={profile.shopName}
                    onChange={(e) => {
                      setIsDirty(true);
                      setProfile({ ...profile, shopName: e.target.value });
                    }}
                    placeholder="e.g. KASI Agri Agencies"
                    className="text-xs font-medium text-slate-900"
                  />
                  {fieldErrors.shopName && (
                    <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.shopName}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Proprietor / Owner Name *
                  </label>
                  <Input
                    required
                    value={profile.proprietorName}
                    onChange={(e) => {
                      setIsDirty(true);
                      setProfile({ ...profile, proprietorName: e.target.value });
                    }}
                    placeholder="e.g. R. Balamurugan"
                    className="text-xs font-medium text-slate-900"
                  />
                  {fieldErrors.proprietorName && (
                    <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.proprietorName}</p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Business Description / Tagline
                  </label>
                  <textarea
                    rows={3}
                    value={profile.description || ""}
                    onChange={(e) => {
                      setIsDirty(true);
                      setProfile({ ...profile, description: e.target.value });
                    }}
                    placeholder="Brief description of products and agricultural services..."
                    className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#176B3A] focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    This appears on tax invoice headers and customer receipts.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ADDRESS & CONTACT */}
          {activeTab === "contact" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Address & Communication Coordinates
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Physical shop location, phone contacts, and email address for billing notices.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Primary Phone Number *
                  </label>
                  <Input
                    required
                    maxLength={10}
                    value={profile.phone}
                    onChange={(e) => {
                      setIsDirty(true);
                      setProfile({ ...profile, phone: e.target.value.replace(/\D/g, "") });
                    }}
                    placeholder="10-digit mobile number"
                    className="text-xs font-mono font-medium"
                  />
                  {fieldErrors.phone && (
                    <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.phone}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Alternate Phone Number (Optional)
                  </label>
                  <Input
                    maxLength={10}
                    value={profile.alternatePhone || ""}
                    onChange={(e) => {
                      setIsDirty(true);
                      setProfile({ ...profile, alternatePhone: e.target.value.replace(/\D/g, "") });
                    }}
                    placeholder="e.g. Landline or second mobile"
                    className="text-xs font-mono"
                  />
                  {fieldErrors.alternatePhone && (
                    <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.alternatePhone}</p>
                  )}
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    value={profile.email || ""}
                    onChange={(e) => {
                      setIsDirty(true);
                      setProfile({ ...profile, email: e.target.value });
                    }}
                    placeholder="shop@agriagencies.com"
                    className="text-xs"
                  />
                  {fieldErrors.email && (
                    <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.email}</p>
                  )}
                </div>

                <div className="sm:col-span-2 border-t border-slate-100 pt-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-3 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[#176B3A]" />
                    Physical Shop Location
                  </h4>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Street Address / Door No.
                  </label>
                  <Input
                    value={profile.address.street || ""}
                    onChange={(e) => {
                      setIsDirty(true);
                      setProfile({
                        ...profile,
                        address: { ...profile.address, street: e.target.value },
                      });
                    }}
                    placeholder="e.g. 12/4, Main Road, Near Bus Stand"
                    className="text-xs"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Village / Town *
                  </label>
                  <Input
                    required
                    value={profile.address.villageTown}
                    onChange={(e) => {
                      setIsDirty(true);
                      setProfile({
                        ...profile,
                        address: { ...profile.address, villageTown: e.target.value },
                      });
                    }}
                    placeholder="e.g. Thiruvarur"
                    className="text-xs"
                  />
                  {fieldErrors.villageTown && (
                    <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.villageTown}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    District *
                  </label>
                  <Input
                    required
                    value={profile.address.district}
                    onChange={(e) => {
                      setIsDirty(true);
                      setProfile({
                        ...profile,
                        address: { ...profile.address, district: e.target.value },
                      });
                    }}
                    placeholder="e.g. Thiruvarur"
                    className="text-xs"
                  />
                  {fieldErrors.district && (
                    <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.district}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    State *
                  </label>
                  <Input
                    required
                    value={profile.address.state}
                    onChange={(e) => {
                      setIsDirty(true);
                      setProfile({
                        ...profile,
                        address: { ...profile.address, state: e.target.value },
                      });
                    }}
                    placeholder="e.g. Tamil Nadu"
                    className="text-xs"
                  />
                  {fieldErrors.state && (
                    <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.state}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Postal PIN Code *
                  </label>
                  <Input
                    required
                    maxLength={6}
                    value={profile.address.pincode}
                    onChange={(e) => {
                      setIsDirty(true);
                      setProfile({
                        ...profile,
                        address: {
                          ...profile.address,
                          pincode: e.target.value.replace(/\D/g, ""),
                        },
                      });
                    }}
                    placeholder="6-digit PIN code"
                    className="text-xs font-mono font-medium"
                  />
                  {fieldErrors.pincode && (
                    <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.pincode}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TAX & REGISTRATION */}
          {activeTab === "tax" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  GST & Tax Registration Particulars
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Goods and Services Tax Identification Number (GSTIN) and legal tax classification.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Goods & Services Tax Identification Number (GSTIN)
                  </label>
                  <div className="relative">
                    <Input
                      maxLength={15}
                      value={profile.gstin || ""}
                      onChange={(e) => {
                        setIsDirty(true);
                        setProfile({
                          ...profile,
                          gstin: e.target.value.toUpperCase().trim(),
                        });
                      }}
                      placeholder="e.g. 33AAAAA0000A1Z5"
                      className="text-xs font-mono font-bold tracking-wider uppercase pr-28"
                    />
                    <div className="absolute right-2 top-2">
                      {profile.gstin ? (
                        GSTIN_REGEX.test(profile.gstin) ? (
                          <Badge variant="success" size="sm">
                            Valid GSTIN
                          </Badge>
                        ) : (
                          <Badge variant="danger" size="sm">
                            Invalid Format
                          </Badge>
                        )
                      ) : (
                        <Badge variant="neutral" size="sm">
                          Composition / Unregistered
                        </Badge>
                      )}
                    </div>
                  </div>
                  {fieldErrors.gstin && (
                    <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.gstin}</p>
                  )}
                  <p className="mt-1 text-[11px] text-slate-400">
                    Format: 2-digit State code + 10-digit PAN + Entity number + Z + Check digit.
                  </p>
                </div>

                {profile.gstin && GSTIN_REGEX.test(profile.gstin) && (
                  <div className="sm:col-span-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-xs space-y-2">
                    <span className="font-bold text-emerald-950 flex items-center gap-1.5">
                      <ShieldCheck className="h-4 w-4 text-emerald-700" />
                      Parsed GSTIN Structure
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">State Code:</span>
                        <strong className="text-slate-800 font-mono">
                          {profile.gstin.slice(0, 2)} ({profile.gstin.startsWith("33") ? "Tamil Nadu" : "Other State"})
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Business PAN:</span>
                        <strong className="text-slate-800 font-mono">
                          {profile.gstin.slice(2, 12)}
                        </strong>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Entity & Check Code:</span>
                        <strong className="text-slate-800 font-mono">
                          {profile.gstin.slice(12)}
                        </strong>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: APPLICATION PREFERENCES */}
          {activeTab === "preferences" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Regional & Calculation Preferences
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure currency symbols, numbering conventions, date formatting, and inventory thresholds.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Currency Symbol & Code
                  </label>
                  <div className="flex items-center gap-2">
                    <Input
                      disabled
                      value={`${preferences.currencySymbol} (${preferences.currency})`}
                      className="text-xs font-bold bg-slate-50 text-slate-800"
                    />
                    <Badge variant="neutral" size="sm" className="shrink-0">
                      Indian Rupee (Standard)
                    </Badge>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Number Formatting
                  </label>
                  <select
                    value={preferences.numberFormat}
                    onChange={(e) => {
                      setIsDirty(true);
                      setPreferences({ ...preferences, numberFormat: e.target.value });
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-[#176B3A] focus:outline-none"
                  >
                    <option value="en-IN">en-IN (Indian Lakhs & Crores: ₹1,00,000.00)</option>
                    <option value="en-US">en-US (International Millions: ₹100,000.00)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Date Display Format
                  </label>
                  <select
                    value={preferences.dateFormat}
                    onChange={(e) => {
                      setIsDirty(true);
                      setPreferences({
                        ...preferences,
                        dateFormat: e.target.value as any,
                      });
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-[#176B3A] focus:outline-none font-mono"
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY (Indian Standard: 17/11/2026)</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD (ISO Format: 2026-11-17)</option>
                    <option value="MM/DD/YYYY">MM/DD/YYYY (US Format: 11/17/2026)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Application Timezone
                  </label>
                  <Input
                    disabled
                    value={preferences.timezone}
                    className="text-xs bg-slate-50 font-mono text-slate-700"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Default: Asia/Kolkata (Indian Standard Time, UTC +5:30).
                  </p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Financial Year Start Month
                  </label>
                  <select
                    value={preferences.financialYearStartMonth}
                    onChange={(e) => {
                      setIsDirty(true);
                      setPreferences({
                        ...preferences,
                        financialYearStartMonth: parseInt(e.target.value, 10),
                      });
                    }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-[#176B3A] focus:outline-none"
                  >
                    <option value={4}>April (Indian Fiscal Year Standard: Apr-Mar)</option>
                    <option value={1}>January (Calendar Year: Jan-Dec)</option>
                    <option value={7}>July (Mid-Year)</option>
                    <option value={10}>October</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Default Low-Stock Threshold (Units / Bags) *
                  </label>
                  <Input
                    type="number"
                    min={0}
                    value={preferences.defaultLowStockThreshold}
                    onChange={(e) => {
                      setIsDirty(true);
                      setPreferences({
                        ...preferences,
                        defaultLowStockThreshold: Math.max(0, parseInt(e.target.value, 10) || 0),
                      });
                    }}
                    className="text-xs font-bold"
                  />
                  {fieldErrors.defaultLowStockThreshold && (
                    <p className="mt-1 text-[11px] text-rose-600">
                      {fieldErrors.defaultLowStockThreshold}
                    </p>
                  )}
                  <p className="mt-1 text-[11px] text-slate-400">
                    Products with inventory at or below this count trigger low-stock alerts.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: BUSINESS HOURS */}
          {activeTab === "hours" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Shop Operating Hours & Working Days
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure daily counter timings and operational business schedule.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Counter Opening Time
                  </label>
                  <Input
                    type="time"
                    value={businessHours.openingTime || "08:30"}
                    onChange={(e) => {
                      setIsDirty(true);
                      setBusinessHours({ ...businessHours, openingTime: e.target.value });
                    }}
                    className="text-xs font-mono font-medium"
                  />
                  {fieldErrors.openingTime && (
                    <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.openingTime}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700">
                    Counter Closing Time
                  </label>
                  <Input
                    type="time"
                    value={businessHours.closingTime || "20:30"}
                    onChange={(e) => {
                      setIsDirty(true);
                      setBusinessHours({ ...businessHours, closingTime: e.target.value });
                    }}
                    className="text-xs font-mono font-medium"
                  />
                  {fieldErrors.closingTime && (
                    <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.closingTime}</p>
                  )}
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Weekly Working Days *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                    {ALL_WORKING_DAYS.map((day) => {
                      const isChecked = businessHours.workingDays?.includes(day.key);
                      return (
                        <button
                          key={day.key}
                          type="button"
                          onClick={() => toggleWorkingDay(day.key)}
                          className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-semibold transition-all ${
                            isChecked
                              ? "border-[#176B3A] bg-emerald-50 text-[#176B3A] shadow-xs"
                              : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"
                          }`}
                        >
                          <span className="text-[11px] font-bold">{day.short}</span>
                          <span className="text-[9px] mt-0.5 uppercase tracking-wider">
                            {isChecked ? "Open" : "Closed"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {fieldErrors.workingDays && (
                    <p className="mt-1 text-[11px] text-rose-600">{fieldErrors.workingDays}</p>
                  )}
                </div>

                <div className="sm:col-span-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Counter Operational Status
                    </span>
                    <span className="text-[11px] text-slate-500">
                      When marked open, POS counter billing and customer inward entries are active.
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={businessHours.isShopOpen ?? true}
                      onChange={(e) => {
                        setIsDirty(true);
                        setBusinessHours({
                          ...businessHours,
                          isShopOpen: e.target.checked,
                        });
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#176B3A]"></div>
                  </label>
                </div>
              </div>
            </div>
          )}
          {/* TAB 6: CATEGORY MANAGEMENT */}
          {activeTab === "categories" && (
            <div className="pt-2">
              <CategoryManager />
            </div>
          )}

          {/* TAB 7: SUPPLIER MANAGEMENT */}
          {activeTab === "suppliers" && (
            <div className="pt-2">
              <SupplierManager />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex h-96 items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-[#176B3A]" />
            <p className="text-xs font-semibold text-slate-500">Loading shop settings...</p>
          </div>
        </div>
      }
    >
      <SettingsContent />
    </React.Suspense>
  );
}

