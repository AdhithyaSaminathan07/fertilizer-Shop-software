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
  Sparkles,
  RefreshCw,
  Plus,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ICategory, ProductUnit } from "@/types/product";
import { PRODUCT_UNITS } from "@/lib/units";

export default function NewProductPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<ICategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [isRefreshingCats, setIsRefreshingCats] = useState(false);

  // Essential Fields
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [primaryUnit, setPrimaryUnit] = useState<ProductUnit>("BAGS");
  const [sellingPrice, setSellingPrice] = useState<string>("");
  const [purchasePrice, setPurchasePrice] = useState<string>("");

  // Optional Fields
  const [brand, setBrand] = useState("");
  const [sku, setSku] = useState("");
  const [description, setDescription] = useState("");

  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

  // Manual refresh categories
  const loadCategories = useCallback(async (showRefreshingState = false) => {
    if (showRefreshingState) setIsRefreshingCats(true);
    try {
      const res = await fetch("/api/categories", { credentials: "same-origin" });
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
      // Network error silent catch
    } finally {
      setLoadingCategories(false);
      if (showRefreshingState) setIsRefreshingCats(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const res = await fetch("/api/categories", { credentials: "same-origin" });
        const data = await res.json();
        if (!ignore && data.success && data.data?.categories) {
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
        // Network error silent catch
      } finally {
        if (!ignore) setLoadingCategories(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

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
    if (!categoryId) {
      setFormError("Please select a product category. Create a category under Settings if none exists.");
      return;
    }
    if (!primaryUnit) {
      setFormError("Primary unit is required.");
      return;
    }

    const numSell = parseFloat(sellingPrice);
    if (isNaN(numSell) || numSell < 0) {
      setFormError("A valid selling price (greater than or equal to 0) is required.");
      return;
    }

    const numBuy = purchasePrice.trim() ? parseFloat(purchasePrice) : 0;
    if (isNaN(numBuy) || numBuy < 0) {
      setFormError("Purchase price cannot be negative.");
      return;
    }

    startTransition(async () => {
      try {
        const payload = {
          name: name.trim(),
          categoryId,
          primaryUnit,
          sellingPrice: numSell,
          purchasePrice: numBuy,
          brand: brand.trim() || undefined,
          sku: sku.trim() ? sku.trim().toUpperCase() : undefined,
          description: description.trim() || undefined,
          status: "ACTIVE",
        };

        const res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          setFormError(data.error?.message || data.error || data.message || "Failed to create product.");
          return;
        }

        router.push("/products");
      } catch {
        setFormError("Network communication error. Please try again.");
      }
    });
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6 pb-20 sm:pb-12">
      {/* Top Header */}
      <div className="flex flex-col gap-2 pb-3 border-b border-slate-200">
        <Link
          href="/products"
          className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-emerald-700 transition-colors py-1 w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1" />
          Back to Products Catalog
        </Link>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-emerald-700 shrink-0" />
            Add New Product
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Quickly register an agri product into the central catalog for billing and inventory.
          </p>
        </div>
      </div>

      {formError && (
        <div className="p-3.5 sm:p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2.5 animate-in fade-in">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-xs sm:text-sm">Validation Error</p>
            <p className="text-rose-700 text-xs mt-0.5 break-words">{formError}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Essential Product Information Card */}
        <Card className="border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-sm sm:text-base font-semibold text-slate-900 flex items-center justify-between">
              <span>Required Details</span>
              <span className="text-xs font-normal text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Core Information
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 space-y-4">
            {/* Product Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                Product Name <span className="text-rose-600">*</span>
              </label>
              <Input
                type="text"
                placeholder="e.g. Urea 46%, DAP 18:46:0, Coragen 60ml, Hybrid Paddy Seeds"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 sm:h-10 text-sm"
                required
              />
            </div>

            {/* Category and Unit Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Category Picker */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                    Category <span className="text-rose-600">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => loadCategories(true)}
                    disabled={isRefreshingCats}
                    className="text-[11px] text-emerald-700 hover:underline flex items-center gap-1"
                    title="Refresh categories"
                  >
                    <RefreshCw className={`w-3 h-3 ${isRefreshingCats ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                </div>
                {loadingCategories ? (
                  <div className="h-10 border border-slate-200 rounded-lg px-3 flex items-center text-xs text-slate-400 bg-slate-50">
                    Loading categories...
                  </div>
                ) : categories.length === 0 ? (
                  <div className="p-2.5 rounded-lg border border-amber-200 bg-amber-50 text-xs text-amber-800 space-y-1">
                    <p className="font-semibold">No active categories found</p>
                    <Link
                      href="/settings?tab=categories"
                      className="text-emerald-700 font-medium underline flex items-center gap-1 text-[11px]"
                    >
                      <Plus className="w-3 h-3" /> Create category in Settings
                    </Link>
                  </div>
                ) : (
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full h-11 sm:h-10 rounded-lg border border-slate-300 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  >
                    <option value="" disabled>
                      Select product category
                    </option>
                    {categories.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Primary Unit */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  Packaging Unit <span className="text-rose-600">*</span>
                </label>
                <select
                  value={primaryUnit}
                  onChange={(e) => setPrimaryUnit(e.target.value as ProductUnit)}
                  className="w-full h-11 sm:h-10 rounded-lg border border-slate-300 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                >
                  {PRODUCT_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label} ({u.value})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selling and Purchase Price Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Selling Price */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1">
                  Selling Price (₹) <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-semibold">
                    ₹
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="pl-8 h-11 sm:h-10 text-sm font-semibold text-slate-900"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-400">Retail counter price for billing</p>
              </div>

              {/* Purchase Price (Optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Purchase Price (₹)</span>
                  <span className="text-[11px] font-normal text-slate-400">Optional</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm font-semibold">
                    ₹
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00 (optional)"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    className="pl-8 h-11 sm:h-10 text-sm text-slate-700"
                  />
                </div>
                <p className="text-[11px] text-slate-400">Cost price from distributor or supplier</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Optional Attributes Card */}
        <Card className="border-slate-200 shadow-sm rounded-xl">
          <CardHeader className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
            <CardTitle className="text-sm font-semibold text-slate-800 flex items-center justify-between">
              <span>Optional Specifications</span>
              <span className="text-xs font-normal text-slate-500">Can be added later</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Brand */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Brand / Manufacturer</span>
                  <span className="text-[11px] font-normal text-slate-400">Optional</span>
                </label>
                <Input
                  type="text"
                  placeholder="e.g. IFFCO, Bayer, Syngenta, Coromandel"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="h-11 sm:h-10 text-sm"
                />
              </div>

              {/* SKU */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    SKU / Item Code <span className="font-normal text-slate-400">(Optional)</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAutoGenerateSku}
                    className="text-[11px] font-medium text-emerald-700 hover:underline flex items-center gap-0.5"
                  >
                    <Sparkles className="w-3 h-3" /> Auto
                  </button>
                </div>
                <Input
                  type="text"
                  placeholder="Leave empty to auto-generate"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  className="font-mono uppercase h-11 sm:h-10 text-sm"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Description / Notes</span>
                <span className="text-[11px] font-normal text-slate-400">Optional</span>
              </label>
              <textarea
                rows={2}
                placeholder="Product composition, dosage or crop usage notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none text-slate-800"
              />
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-3 pt-2">
          <Link
            href="/products"
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors text-center"
          >
            Cancel
          </Link>
          <Button
            type="submit"
            disabled={isPending}
            className="w-full sm:w-auto px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-sm font-bold shadow-sm transition-all"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" /> Saving...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Save Product
              </span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
