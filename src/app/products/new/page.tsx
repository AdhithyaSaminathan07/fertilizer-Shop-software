"use client";

import * as React from "react";
import { useState, useEffect, useTransition } from "react";
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
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");

  // Conversion Fields
  const [conversionEnabled, setConversionEnabled] = useState(false);
  const [baseUnit, setBaseUnit] = useState<ProductUnit>("KG");
  const [conversionRatio, setConversionRatio] = useState<string>("50");

  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

  // Load categories
  useEffect(() => {
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.categories) {
          const activeCats = data.data.categories.filter((c: ICategory) => c.status === "ACTIVE");
          setCategories(activeCats);
          if (activeCats.length > 0) {
            setCategoryId(activeCats[0]._id);
          }
        }
        setLoadingCategories(false);
      })
      .catch(() => setLoadingCategories(false));
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
    const brandPrefix = (brand.trim() || "KASI").slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "K");
    const namePrefix = (name.trim() || "PRD").slice(0, 3).toUpperCase().replace(/[^A-Z]/g, "P");
    const rand = Math.floor(1000 + Math.random() * 9000);
    setSku(`${brandPrefix}-${namePrefix}-${rand}`);
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
    if (!sku.trim()) {
      setFormError("SKU code is required.");
      return;
    }
    if (!categoryId) {
      setFormError("Please select a product category.");
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
          sku: sku.trim().toUpperCase(),
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
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div>
          <Link
            href="/products"
            className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-[#176B3A] mb-1 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to Products Catalog
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-[#176B3A]" />
            Register New Product
          </h1>
          <p className="text-sm text-slate-500">
            Define pricing, packaging unit conversions, and low-stock alert thresholds.
          </p>
        </div>
      </div>

      {formError && (
        <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          <div>
            <p className="font-semibold">Validation Error</p>
            <p className="text-rose-700 text-xs mt-0.5">{formError}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card 1: Core Specifications */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="p-4 border-b border-slate-100">
            <CardTitle className="text-base font-semibold text-slate-800">
              1. Product Identification & Classification
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Product Name *</label>
                <Input
                  type="text"
                  placeholder="e.g. Urea 46% Nitrogen, Coragen 18.5% SC"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
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
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">SKU Code *</label>
                  <button
                    type="button"
                    onClick={handleAutoGenerateSku}
                    className="text-[11px] font-medium text-[#176B3A] hover:underline flex items-center gap-0.5"
                  >
                    <Sparkles className="w-3 h-3" /> Auto
                  </button>
                </div>
                <Input
                  type="text"
                  placeholder="e.g. IFF-URE-1001"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="font-mono uppercase text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Barcode / EAN (Optional)</label>
                <Input
                  type="text"
                  placeholder="e.g. 8901234567890"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Category *</label>
                {loadingCategories ? (
                  <div className="h-9 bg-slate-100 rounded-md animate-pulse" />
                ) : (
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full text-sm border border-slate-300 rounded-md px-3 h-9 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#176B3A]"
                    required
                  >
                    {categories.length === 0 && <option value="">No active categories available</option>}
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Product Description (Optional)</label>
              <textarea
                className="w-full text-sm border border-slate-300 rounded-md p-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#176B3A] min-h-[70px]"
                placeholder="Technical specifications, application rates, recommended crops..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Packaging & Configurable Unit Conversion */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="p-4 border-b border-slate-100">
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center justify-between">
              <span>2. Units of Measurement & Custom Conversion</span>
              <span className="text-xs font-normal text-slate-500">
                Dimensionally safe packaging ratios
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Primary Counter / Billing Unit *
                </label>
                <select
                  value={primaryUnit}
                  onChange={(e) => handlePrimaryUnitChange(e.target.value as ProductUnit)}
                  className="w-full text-sm border border-slate-300 rounded-md px-3 h-9 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#176B3A]"
                >
                  {PRODUCT_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400">
                  Dimension: <strong>{UNIT_DIMENSION_MAP[primaryUnit]}</strong>. This is the unit used on customer receipts.
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
                  required
                />
                <p className="text-[11px] text-slate-400">
                  Triggers low-stock alert when available balance falls below this number.
                </p>
              </div>
            </div>

            {/* Configurable Conversion Toggle */}
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200/80 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={conversionEnabled}
                  onChange={(e) => setConversionEnabled(e.target.checked)}
                  className="rounded border-slate-300 text-[#176B3A] focus:ring-[#176B3A] h-4 w-4"
                />
                <span className="text-sm font-semibold text-slate-800">
                  Enable custom packaging conversion ratio
                </span>
              </label>

              {conversionEnabled && (
                <div className="pt-2 pl-6 space-y-3 border-t border-slate-200/60">
                  <p className="text-xs text-slate-600">
                    Define the exact quantity contained inside 1 {primaryUnit}. Never assumed generic.
                  </p>

                  <div className="flex flex-col sm:flex-row items-center gap-3">
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
                      className="w-full sm:w-36 text-sm font-semibold"
                    />

                    <select
                      value={baseUnit}
                      onChange={(e) => setBaseUnit(e.target.value as ProductUnit)}
                      className="text-sm border border-slate-300 rounded-md px-3 h-9 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#176B3A]"
                    >
                      {compatibleBaseUnits.map((u) => (
                        <option key={u.value} value={u.value}>
                          {u.label}
                        </option>
                      ))}
                    </select>

                    <div className="text-xs text-emerald-800 font-medium bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200 shrink-0">
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
          <CardHeader className="p-4 border-b border-slate-100">
            <CardTitle className="text-base font-semibold text-slate-800">
              3. Commercial Pricing & Profit Margin
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
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
                    className="pl-7"
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
                    className="pl-7"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Live Margin Calculation Card */}
            <div
              className={`p-4 rounded-lg border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
                isSubsidized
                  ? "bg-amber-50/70 border-amber-200 text-amber-900"
                  : "bg-emerald-50/70 border-emerald-200 text-emerald-900"
              }`}
            >
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider">
                  Live Unit Profit Calculation
                </p>
                <p className="text-lg font-bold flex items-center gap-1.5 mt-0.5">
                  {isSubsidized ? (
                    <>
                      <TrendingDown className="w-5 h-5 text-amber-700" />
                      Negative Margin: -₹{Math.abs(margin).toFixed(2)} ({marginPercent.toFixed(1)}%)
                    </>
                  ) : (
                    <>
                      <TrendingUp className="w-5 h-5 text-emerald-700" />
                      Net Margin: +₹{margin.toFixed(2)} ({marginPercent.toFixed(1)}%)
                    </>
                  )}
                </p>
              </div>

              <div className="text-xs text-slate-600 max-w-sm">
                {isSubsidized ? (
                  <span className="text-amber-800">
                    <strong>Notice:</strong> Selling price is lower than purchase price. Authorized for government subsidized fertilizers or promotional discounts.
                  </span>
                ) : (
                  <span>
                    Gross retail return on purchase cost. Accurately recorded per unit.
                  </span>
                )}
              </div>
            </div>

            <div className="pt-2">
              <label className="text-xs font-semibold text-slate-700">Initial Account Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as "ACTIVE" | "INACTIVE")}
                className="mt-1 w-full sm:w-64 text-sm border border-slate-300 rounded-md px-3 h-9 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#176B3A]"
              >
                <option value="ACTIVE">Active (Available for billing & inward)</option>
                <option value="INACTIVE">Inactive (Hidden from counter)</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/products">
            <Button type="button" variant="outline" disabled={isPending}>
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            className="bg-[#176B3A] hover:bg-[#12542D] text-white px-6"
            disabled={isPending}
          >
            {isPending ? "Registering Product..." : "Save & Register Product"}
          </Button>
        </div>
      </form>
    </div>
  );
}

