"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Package,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  TrendingDown,
  TrendingUp,
  Sparkles,
  RefreshCw,
  Plus,
  FolderPlus,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ICategory, ProductUnit } from "@/types/product";
import { PRODUCT_UNITS, UNIT_DIMENSION_MAP, areUnitsCompatible, calculateMargin } from "@/lib/units";

export default function NewProductPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<ICategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [isRefreshingCats, setIsRefreshingCats] = useState(false);

  // Form Fields
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [purchasePrice, setPurchasePrice] = useState<string>("0");
  const [sellingPrice, setSellingPrice] = useState<string>("0");
  const [primaryUnit, setPrimaryUnit] = useState<ProductUnit>("BAGS");
  const [minThreshold, setMinThreshold] = useState<string>("10");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE" | "ARCHIVED">("ACTIVE");

  // Conversion Fields
  const [conversionEnabled, setConversionEnabled] = useState(false);
  const [baseUnit, setBaseUnit] = useState<ProductUnit>("KG");
  const [conversionRatio, setConversionRatio] = useState<string>("50");

  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

  // Load categories function for manual refresh button
  const loadCategories = useCallback(async (showRefreshingState = false) => {
    if (showRefreshingState) setIsRefreshingCats(true);
    try {
      const res = await fetch("/api/categories");
      const data = await res.json();
      if (data.success && data.data?.categories) {
        const activeCats = data.data.categories.filter((c: ICategory) => c.status === "ACTIVE");
        setCategories(activeCats);
        setCategoryId((prev) => {
          if (prev && activeCats.some((c: ICategory) => c._id === prev)) {
            return prev;
          }
          return activeCats.length > 0 ? activeCats[0]._id : "";
        });
      }
    } catch {
      // silently handle network error on manual refresh
    } finally {
      setLoadingCategories(false);
      if (showRefreshingState) setIsRefreshingCats(false);
    }
  }, []);

  // Initial load & window focus listener for automatic refresh when returning from category creation
  useEffect(() => {
    let isMounted = true;
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          if (data.success && data.data?.categories) {
            const activeCats = data.data.categories.filter((c: ICategory) => c.status === "ACTIVE");
            setCategories(activeCats);
            setCategoryId((prev) => {
              if (prev && activeCats.some((c: ICategory) => c._id === prev)) {
                return prev;
              }
              return activeCats.length > 0 ? activeCats[0]._id : "";
            });
          }
          setLoadingCategories(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoadingCategories(false);
      });

    const handleWindowFocus = () => {
      fetch("/api/categories")
        .then((res) => res.json())
        .then((data) => {
          if (isMounted && data.success && data.data?.categories) {
            const activeCats = data.data.categories.filter((c: ICategory) => c.status === "ACTIVE");
            setCategories(activeCats);
            setCategoryId((prev) => {
              if (prev && activeCats.some((c: ICategory) => c._id === prev)) {
                return prev;
              }
              return activeCats.length > 0 ? activeCats[0]._id : "";
            });
          }
        })
        .catch(() => {});
    };

    window.addEventListener("focus", handleWindowFocus);
    return () => {
      isMounted = false;
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, []);

  // Filter compatible base units when primary unit changes
  const compatibleBaseUnits = PRODUCT_UNITS.filter((u) => {
    return areUnitsCompatible(primaryUnit, u.value) && u.value !== primaryUnit;
  });

  const handlePrimaryUnitChange = (newUnit: ProductUnit) => {
    setPrimaryUnit(newUnit);
    const compatible = PRODUCT_UNITS.filter((u) => areUnitsCompatible(newUnit, u.value) && u.value !== newUnit);
    if (compatible.length > 0) {
      setBaseUnit(compatible[0].value);
    }
  };

  // Live margin calculation
  const numBuy = parseFloat(purchasePrice) || 0;
  const numSell = parseFloat(sellingPrice) || 0;
  const { margin, marginPercent } = calculateMargin(numBuy, numSell);
  const isSubsidized = numBuy > numSell;

  // Auto-generate SKU helper
  const handleAutoGenerateSku = () => {
    const brandPrefix = (brand.trim() || "KASI").slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, "K");
    const namePrefix = (name.trim() || "PRD").slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, "P");
    const rand = Math.floor(1000 + Math.random() * 9000);
    setSku(`KASI-${brandPrefix}-${namePrefix}-${rand}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    if (!name.trim()) {
      setFormError("Product name is required.");
      return;
    }
    if (!brand.trim()) {
      setFormError("Brand or manufacturer is required.");
      return;
    }
    if (!categoryId) {
      setFormError("Please select a product category. Create an active category if none exists.");
      return;
    }

    if (numBuy < 0 || numSell < 0) {
      setFormError("Prices cannot be negative.");
      return;
    }

    let unitConversionData: any = undefined;
    if (conversionEnabled) {
      const ratio = parseFloat(conversionRatio);
      if (!ratio || ratio <= 0) {
        setFormError("Conversion ratio must be greater than zero.");
        return;
      }
      if (!areUnitsCompatible(primaryUnit, baseUnit)) {
        setFormError("Selected base unit is not dimensionally compatible with primary unit.");
        return;
      }
      unitConversionData = {
        enabled: true,
        baseUnit,
        conversionRatio: ratio,
      };
    }

    startTransition(async () => {
      try {
        const payload = {
          name: name.trim(),
          brand: brand.trim(),
          sku: sku.trim() ? sku.trim().toUpperCase() : undefined,
          barcode: barcode.trim() || undefined,
          categoryId,
          description: description.trim() || undefined,
          purchasePrice: numBuy,
          sellingPrice: numSell,
          primaryUnit,
          unitConversion: unitConversionData,
          minStockThreshold: parseFloat(minThreshold) || 10,
          status,
        };

        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          setFormError(data.error || "Failed to create product.");
          return;
        }

        router.push("/products");
      } catch {
        setFormError("Network communication error. Please try again.");
      }
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-4 space-y-4 sm:space-y-6 pb-24 sm:pb-12">
      {/* Top Header */}
      <div className="flex flex-col gap-2 pb-3 border-b border-slate-200">
        <Link
          href="/products"
          className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-[#176B3A] transition-colors py-1 w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back to Products Catalog
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5 sm:w-6 sm:h-6 text-[#176B3A] shrink-0" />
            Register New Product
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Define pricing, packaging unit conversions, and low-stock alert thresholds.
          </p>
        </div>
      </div>

      {formError && (
        <div className="p-3.5 sm:p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-xs sm:text-sm">Validation Error</p>
            <p className="text-rose-700 text-xs mt-0.5 break-words">{formError}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* Card 1: Core Specifications */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="p-3.5 sm:p-4 border-b border-slate-100">
            <CardTitle className="text-sm sm:text-base font-semibold text-slate-800">
              1. Product Identification & Classification
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 space-y-4">
            {/* Name and Brand */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Product Name *</label>
                <Input
                  type="text"
                  placeholder="e.g. Urea 46% Nitrogen, Coragen 18.5% SC"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 sm:h-10 text-base sm:text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Brand / Manufacturer *</label>
                <Input
                  type="text"
                  placeholder="e.g. IFFCO, FMC, Bayer, Syngenta"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="h-11 sm:h-10 text-base sm:text-sm"
                  required
                />
              </div>
            </div>

            {/* SKU, Barcode, and Category */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Optional SKU with auto-generation */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    SKU / Item Code <span className="font-normal text-slate-400">(Optional)</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoGenerateSku}
                    className="text-[11px] font-medium text-[#176B3A] hover:underline flex items-center gap-0.5 py-0.5 px-1 rounded hover:bg-emerald-50"
                  >
                    <Sparkles className="w-3 h-3" /> Auto
                  </button>
                </div>
                <Input
                  type="text"
                  placeholder="Auto-generated if left blank"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="font-mono uppercase h-11 sm:h-10 text-base sm:text-sm"
                />
                <p className="text-[11px] text-slate-400">
                  Unique internal code. Automatically generated if left empty.
                </p>
              </div>

              {/* Barcode */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Barcode / EAN <span className="font-normal text-slate-400">(Optional)</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. 8901234567890"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="font-mono h-11 sm:h-10 text-base sm:text-sm"
                />
                <p className="text-[11px] text-slate-400">
                  Standard manufacturer barcode for scanner support.
                </p>
              </div>

              {/* Category Picker with Empty State & Refresh */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">Category *</label>
                  <button
                    type="button"
                    onClick={() => loadCategories(true)}
                    disabled={isRefreshingCats || loadingCategories}
                    className="text-[11px] font-medium text-slate-500 hover:text-[#176B3A] flex items-center gap-1 py-0.5 px-1 rounded hover:bg-slate-100 transition-colors"
                    title="Reload categories from database"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRefreshingCats ? "animate-spin text-[#176B3A]" : ""}`} />
                    Refresh
                  </button>
                </div>

                {loadingCategories ? (
                  <div className="h-11 sm:h-10 bg-slate-100 rounded-md animate-pulse" />
                ) : categories.length === 0 ? (
                  <div className="space-y-2">
                    <select
                      disabled
                      className="w-full text-sm border border-rose-300 rounded-md px-3 h-11 sm:h-10 bg-rose-50/50 text-rose-700 cursor-not-allowed"
                    >
                      <option>No active categories found</option>
                    </select>
                  </div>
                ) : (
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full text-base sm:text-sm border border-slate-300 rounded-md px-3 h-11 sm:h-10 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#176B3A]"
                    required
                  >
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-[11px] text-slate-400">
                  Only active categories are available for selection.
                </p>
              </div>
            </div>

            {/* Prominent Category Empty State Notice if no active categories */}
            {!loadingCategories && categories.length === 0 && (
              <div className="p-3.5 sm:p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-xs sm:text-sm">
                    <p className="font-semibold text-amber-900">No Active Categories Found</p>
                    <p className="text-amber-800 text-xs mt-0.5">
                      Products must belong to an active category before creation. Please create at least one category first.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1 pl-7">
                  <Link
                    href="/categories"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-[#176B3A] text-white text-xs font-medium hover:bg-[#12542D] transition-colors"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                    Create Category in New Tab
                  </Link>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => loadCategories(true)}
                    disabled={isRefreshingCats}
                    className="h-8 text-xs bg-white"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isRefreshingCats ? "animate-spin" : ""}`} />
                    Check Again
                  </Button>
                </div>
              </div>
            )}

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Product Description <span className="font-normal text-slate-400">(Optional)</span>
              </label>
              <textarea
                className="w-full text-base sm:text-sm border border-slate-300 rounded-md p-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#176B3A] min-h-[72px]"
                placeholder="Technical specifications, application rates, recommended crops, composition..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Packaging & Configurable Unit Conversion */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="p-3.5 sm:p-4 border-b border-slate-100">
            <CardTitle className="text-sm sm:text-base font-semibold text-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <span>2. Units of Measurement & Packaging Conversion</span>
              <span className="text-xs font-normal text-slate-500">
                Dimensionally safe packaging ratios
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Primary Counter / Billing Unit *
                </label>
                <select
                  value={primaryUnit}
                  onChange={(e) => handlePrimaryUnitChange(e.target.value as ProductUnit)}
                  className="w-full text-base sm:text-sm border border-slate-300 rounded-md px-3 h-11 sm:h-10 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#176B3A]"
                >
                  {PRODUCT_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">
                  Dimension: <strong className="text-slate-600">{UNIT_DIMENSION_MAP[primaryUnit]}</strong>. This is the unit printed on customer bills.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Minimum Stock Warning Threshold *
                </label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={minThreshold}
                  onChange={(e) => setMinThreshold(e.target.value)}
                  placeholder="e.g. 10"
                  className="h-11 sm:h-10 text-base sm:text-sm"
                  required
                />
                <p className="text-[11px] text-slate-400">
                  Triggers low-stock alert when available balance falls below this quantity.
                </p>
              </div>
            </div>

            {/* Configurable Conversion Section */}
            <div className="p-3.5 sm:p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={conversionEnabled}
                  onChange={(e) => setConversionEnabled(e.target.checked)}
                  className="rounded border-slate-300 text-[#176B3A] focus:ring-[#176B3A] h-4 w-4"
                />
                <span className="text-xs sm:text-sm font-semibold text-slate-800">
                  Enable custom packaging conversion ratio
                </span>
              </label>

              {conversionEnabled && (
                <div className="pt-2 pl-2 sm:pl-6 space-y-3 border-t border-slate-200/60">
                  <p className="text-xs text-slate-600">
                    Define the exact quantity contained inside 1 {primaryUnit}. Never assumed generic.
                  </p>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <span className="text-sm font-semibold text-slate-700 shrink-0">
                      1 {primaryUnit} =
                    </span>

                    <Input
                      type="number"
                      min="0.01"
                      step="any"
                      placeholder="e.g. 50"
                      value={conversionRatio}
                      onChange={(e) => setConversionRatio(e.target.value)}
                      className="w-full sm:w-36 h-11 sm:h-10 text-base sm:text-sm font-semibold"
                    />

                    <select
                      value={baseUnit}
                      onChange={(e) => setBaseUnit(e.target.value as ProductUnit)}
                      className="w-full sm:w-auto text-base sm:text-sm border border-slate-300 rounded-md px-3 h-11 sm:h-10 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#176B3A]"
                    >
                      {compatibleBaseUnits.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>

                    <div className="text-xs text-emerald-800 font-medium bg-emerald-50 px-3 py-2 sm:py-1 rounded border border-emerald-200 shrink-0">
                      Formula: 1 {primaryUnit} = {conversionRatio || 0} {baseUnit}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Pricing & Live Margin Evaluation */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="p-3.5 sm:p-4 border-b border-slate-100">
            <CardTitle className="text-sm sm:text-base font-semibold text-slate-800">
              3. Commercial Pricing & Profit Margin
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Purchase / Inward Cost Price (₹ per {primaryUnit}) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">
                    ₹
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    className="pl-7 h-11 sm:h-10 text-base sm:text-sm"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Retail Selling Price (₹ per {primaryUnit}) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-medium text-sm">
                    ₹
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="pl-7 h-11 sm:h-10 text-base sm:text-sm"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Live Margin Calculation Display */}
            <div
              className={`p-3.5 sm:p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                isSubsidized
                  ? "bg-amber-50/70 border-amber-200 text-amber-900"
                  : "bg-emerald-50/70 border-emerald-200 text-emerald-900"
              }`}
            >
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider">
                  Live Unit Profit Calculation
                </p>
                <p className="text-base sm:text-lg font-bold flex items-center gap-1.5 mt-0.5">
                  {isSubsidized ? (
                    <>
                      <TrendingDown className="w-5 h-5 text-amber-700 shrink-0" />
                      Negative Margin: -₹{Math.abs(margin).toFixed(2)} ({marginPercent.toFixed(1)}%)
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-5 h-5 text-emerald-700 shrink-0" />
                      Net Margin: +₹{margin.toFixed(2)} ({marginPercent.toFixed(1)}%)
                    </>
                  )}
                </p>
              </div>

              <div className="text-xs text-slate-600 max-w-sm">
                {isSubsidized ? (
                  <span className="text-amber-800">
                    <strong>Notice:</strong> Selling price is lower than purchase cost. Allowed for government subsidized fertilizers or promotional discounts.
                  </span>
                ) : (
                  <span>
                    Gross retail return on purchase cost. Accurately recorded per primary unit.
                  </span>
                )}
              </div>
            </div>

            {/* Product Status (Requirement 4: Clearly labeled Product Status) */}
            <div className="pt-2">
              <label className="text-xs font-semibold text-slate-700 block mb-1">Product Status *</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "ACTIVE" | "INACTIVE" | "ARCHIVED")}
                className="w-full sm:w-72 text-base sm:text-sm border border-slate-300 rounded-md px-3 h-11 sm:h-10 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#176B3A]"
              >
                <option value="ACTIVE">Active (Available for normal operations)</option>
                <option value="INACTIVE">Inactive (Temporarily unavailable)</option>
                <option value="ARCHIVED">Archived (Retired / Discontinued)</option>
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                Active products are immediately available for counter billing and purchase orders.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Sticky or Easily Accessible Form Actions on Mobile */}
        <div className="sticky bottom-0 bg-white/95 backdrop-blur-xs py-3 px-4 -mx-4 sm:mx-0 sm:px-0 sm:py-4 border-t sm:border-t-0 border-slate-200 z-10 flex flex-col-reverse sm:flex-row items-stretch sm:items-center sm:justify-end gap-2.5">
          <Link href="/products" className="w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-[38px] text-sm"
            >
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            className="w-full sm:w-auto bg-[#176B3A] hover:bg-[#12542D] text-white px-6 min-h-[44px] sm:min-h-[38px] text-sm font-semibold shadow-xs"
            disabled={isPending || categories.length === 0}
          >
            {isPending ? "Registering Product..." : "Save & Register Product"}
          </Button>
        </div>
      </form>
    </div>
  );
}
