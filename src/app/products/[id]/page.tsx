"use client";

import * as React from "react";
import { useState, useEffect, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Package,
  ArrowLeft,
  Edit3,
  Archive,
  AlertCircle,
  Calendar,
  Layers,
  TrendingDown,
  TrendingUp,
  Tag,
  RefreshCw,
  Info,
  Clock,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { IProduct, ICategory, IBatch, ProductUnit } from "@/types/product";
import { PRODUCT_UNITS, areUnitsCompatible, calculateMargin } from "@/lib/units";

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const [product, setProduct] = useState<IProduct | null>(null);
  const [categories, setCategories] = useState<ICategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshIndex, setRefreshIndex] = useState(0);

  // Edit Dialog States
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);

  // Edit form states
  const [editName, setEditName] = useState("");
  const [editBrand, setEditBrand] = useState("");
  const [editSku, setEditSku] = useState("");
  const [editBarcode, setEditBarcode] = useState("");
  const [editCategoryId, setEditCategoryId] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editBuyPrice, setEditBuyPrice] = useState("0");
  const [editSellPrice, setEditSellPrice] = useState("0");
  const [editPrimaryUnit, setEditPrimaryUnit] = useState<ProductUnit>("BAGS");
  const [editMinThreshold, setEditMinThreshold] = useState("10");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "INACTIVE" | "ARCHIVED">("ACTIVE");

  // Conversion fields
  const [editConvEnabled, setEditConvEnabled] = useState(false);
  const [editBaseUnit, setEditBaseUnit] = useState<ProductUnit>("KG");
  const [editConvRatio, setEditConvRatio] = useState("50");

  const [dialogError, setDialogError] = useState("");
  const [isPending, startTransition] = useTransition();

  // Load product & categories
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      fetch(`/api/products/${productId}`).then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ])
      .then(([prodData, catData]) => {
        if (!isMounted) return;
        if (prodData.success && prodData.data?.product) {
          setProduct(prodData.data.product);
        }
        if (catData.success && catData.data?.categories) {
          setCategories(catData.data.categories);
        }
        setLoading(false);
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [productId, refreshIndex]);

  const handleOpenEdit = () => {
    if (!product) return;
    setEditName(product.name);
    setEditBrand(product.brand);
    setEditSku(product.sku);
    setEditBarcode(product.barcode || "");
    setEditCategoryId(product.categoryId);
    setEditDesc(product.description || "");
    setEditBuyPrice(String(product.purchasePrice));
    setEditSellPrice(String(product.sellingPrice));
    setEditPrimaryUnit(product.primaryUnit);
    setEditMinThreshold(String(product.minStockThreshold));
    setEditStatus(product.status);

    if (product.unitConversion?.enabled) {
      setEditConvEnabled(true);
      setEditBaseUnit(product.unitConversion.baseUnit || "KG");
      setEditConvRatio(String(product.unitConversion.conversionRatio || 50));
    } else {
      setEditConvEnabled(false);
      setEditConvRatio("50");
    }

    setDialogError("");
    setIsEditOpen(true);
  };

  const handleUpdateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setDialogError("");

    const buy = parseFloat(editBuyPrice) || 0;
    const sell = parseFloat(editSellPrice) || 0;

    let convData: any = undefined;
    if (editConvEnabled) {
      const ratio = parseFloat(editConvRatio);
      if (!ratio || ratio <= 0) {
        setDialogError("Conversion ratio must be greater than zero.");
        return;
      }
      if (!areUnitsCompatible(editPrimaryUnit, editBaseUnit)) {
        setDialogError("Primary unit and base unit must be dimensionally compatible.");
        return;
      }
      convData = {
        enabled: true,
        baseUnit: editBaseUnit,
        conversionRatio: ratio,
      };
    }

    startTransition(async () => {
      try {
        const payload = {
          name: editName.trim(),
          brand: editBrand.trim(),
          sku: editSku.trim().toUpperCase(),
          barcode: editBarcode.trim() || undefined,
          categoryId: editCategoryId,
          description: editDesc.trim() || undefined,
          purchasePrice: buy,
          sellingPrice: sell,
          primaryUnit: editPrimaryUnit,
          unitConversion: convData,
          minStockThreshold: parseFloat(editMinThreshold) || 10,
          status: editStatus,
        };

        const res = await fetch(`/api/products/${product._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          setDialogError(data.error || "Failed to update product");
          return;
        }

        setIsEditOpen(false);
        setRefreshIndex((p) => p + 1);
      } catch {
        setDialogError("Network communication error.");
      }
    });
  };

  const handleArchiveProduct = () => {
    if (!product) return;
    setDialogError("");
    startTransition(async () => {
      try {
        const res = await fetch(`/api/products/${product._id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setDialogError(data.error || "Failed to archive product");
          return;
        }
        setIsArchiveOpen(false);
        router.push("/products");
      } catch {
        setDialogError("Network communication error.");
      }
    });
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#176B3A] mb-2" />
        <p className="text-sm">Loading product details...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-2" />
        <h2 className="text-lg font-bold text-slate-900">Product Not Found</h2>
        <p className="text-sm text-slate-500 mt-1">The requested product does not exist or has been removed.</p>
        <Link href="/products" className="mt-4 inline-block">
          <Button size="sm" variant="outline">
            Back to Catalog
          </Button>
        </Link>
      </div>
    );
  }

  const { margin, marginPercent } = calculateMargin(product.purchasePrice, product.sellingPrice);
  const isSubsidized = margin < 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <Link
            href="/products"
            className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-[#176B3A] mb-1 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Back to Products Catalog
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{product.name}</h1>
            <Badge variant={product.status === "ACTIVE" ? "agri" : "neutral"} className="capitalize">
              {product.status.toLowerCase()}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Brand: <span className="font-semibold text-slate-700">{product.brand}</span> • SKU:{" "}
            <span className="font-mono text-slate-700">{product.sku}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleOpenEdit} className="min-h-[40px] sm:min-h-[36px] flex-1 sm:flex-initial">
            <Edit3 className="w-4 h-4 mr-1.5" />
            Edit Product
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsArchiveOpen(true)}
            className="text-rose-600 hover:bg-rose-50 min-h-[40px] sm:min-h-[36px] flex-1 sm:flex-initial"
          >
            <Archive className="w-4 h-4 mr-1.5" />
            Archive
          </Button>
        </div>
      </div>

      {/* Main Specs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Commercial Pricing & Margin */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="p-4 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
              Commercial Pricing
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Purchase Cost:</span>
              <span className="font-semibold text-slate-900">₹{product.purchasePrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Retail Selling Price:</span>
              <span className="font-semibold text-slate-900">₹{product.sellingPrice.toFixed(2)}</span>
            </div>
            <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-sm">
              <span className="text-slate-500">Calculated Margin:</span>
              <span
                className={`font-bold flex items-center gap-1 ${
                  isSubsidized ? "text-amber-700" : "text-emerald-700"
                }`}
              >
                {isSubsidized ? (
                  <>
                    <TrendingDown className="w-4 h-4" />
                    -₹{Math.abs(margin).toFixed(2)} ({marginPercent.toFixed(1)}%)
                  </>
                ) : (
                  <>
                    <TrendingUp className="w-4 h-4" />
                    +₹{margin.toFixed(2)} ({marginPercent.toFixed(1)}%)
                  </>
                )}
              </span>
            </div>
            {isSubsidized && (
              <p className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded border border-amber-200/60 mt-1">
                Selling price is below purchase cost. Permitted for government subsidized or promotional fertilizer rates.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Packaging & Conversion */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="p-4 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
              Packaging & Unit Conversion
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Counter Billing Unit:</span>
              <span className="font-semibold text-[#176B3A] bg-[#EBF5EE] px-2.5 py-0.5 rounded">
                {product.primaryUnit}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Unit Conversion:</span>
              {product.unitConversion?.enabled ? (
                <span className="font-semibold text-slate-900">
                  1 {product.primaryUnit} = {product.unitConversion.conversionRatio}{" "}
                  {product.unitConversion.baseUnit}
                </span>
              ) : (
                <span className="text-slate-400 italic">None configured</span>
              )}
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Low Stock Alert:</span>
              <span className="font-semibold text-slate-900">
                &le; {product.minStockThreshold} {product.primaryUnit}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Classification & Barcode */}
        <Card className="border-slate-200 shadow-xs">
          <CardHeader className="p-4 border-b border-slate-100">
            <CardTitle className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
              Category & Classification
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Category:</span>
              <span className="font-semibold text-slate-900">
                {product.category?.name || "Uncategorized"}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Barcode / EAN:</span>
              <span className="font-mono text-xs text-slate-700">
                {product.barcode || "Not configured"}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500">Current Stock:</span>
              <Badge
                variant={
                  product.stockStatus === "OUT_OF_STOCK"
                    ? "neutral"
                    : product.stockStatus === "LOW_STOCK"
                    ? "warning"
                    : "agri"
                }
              >
                {product.currentStock} {product.primaryUnit}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card 4: Batch & Expiry Tracking Ledger */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-base font-semibold text-slate-800 flex items-center gap-2">
              <Layers className="w-5 h-5 text-[#176B3A]" />
              Batch & Expiry Tracking Ledger
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Tracks manufacturing batches, expiry dates and inwards quantities.
            </p>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {/* Phase 4 Notice */}
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-start gap-2.5 text-xs text-slate-600">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-800">Inventory Integrity Architecture (Phase 4):</p>
              <p className="mt-0.5 text-slate-600 leading-relaxed">
                Manual stock injection is disabled to prevent inventory discrepancies.
                Batches and stock quantities will be populated automatically through the verified{" "}
                <strong>Purchase & Inward Goods module (Phase 5)</strong> upon GRN receipt.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/70">
                <TableRow>
                  <TableHead className="font-semibold text-slate-700">Batch Number</TableHead>
                  <TableHead className="font-semibold text-slate-700">Mfg. Date</TableHead>
                  <TableHead className="font-semibold text-slate-700">Expiry Date</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-right">Inward Quantity</TableHead>
                  <TableHead className="font-semibold text-slate-700 text-center">Batch Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(!product.batches || product.batches.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-slate-400 text-xs italic">
                      No batch records registered yet. Incoming stock batches will appear automatically when Purchase Inward is recorded.
                    </TableCell>
                  </TableRow>
                ) : (
                  (product.batches || []).map((b: IBatch) => (
                    <TableRow key={b._id}>
                      <TableCell className="font-mono font-medium text-slate-800 text-xs">
                        {b.batchNumber}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {b.manufacturingDate ? new Date(b.manufacturingDate).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : "-"}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-slate-900 text-xs">
                        {b.quantity} {product.primaryUnit}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={b.status === "ACTIVE" ? "agri" : "neutral"} className="text-[11px]">
                          {b.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Product Dialog */}
      <Dialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        title={
          <span className="flex items-center gap-2 text-slate-900">
            <Edit3 className="w-5 h-5 text-[#176B3A]" />
            Edit Product Master
          </span>
        }
        description="Update commercial specs, category, and conversion ratios."
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={handleUpdateProduct} className="bg-[#176B3A] text-white" disabled={isPending}>
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {dialogError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              {dialogError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Product Name *</label>
              <Input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Brand / Manufacturer *</label>
              <Input
                type="text"
                value={editBrand}
                onChange={(e) => setEditBrand(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">SKU Code *</label>
              <Input
                type="text"
                value={editSku}
                onChange={(e) => setEditSku(e.target.value)}
                className="font-mono uppercase text-sm"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Barcode</label>
              <Input
                type="text"
                value={editBarcode}
                onChange={(e) => setEditBarcode(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Category *</label>
              <select
                value={editCategoryId}
                onChange={(e) => setEditCategoryId(e.target.value)}
                className="w-full text-sm border border-slate-300 rounded-md px-2.5 h-9 bg-white"
              >
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Purchase Price (₹) *</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={editBuyPrice}
                onChange={(e) => setEditBuyPrice(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Selling Price (₹) *</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={editSellPrice}
                onChange={(e) => setEditSellPrice(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Primary Billing Unit</label>
              <select
                value={editPrimaryUnit}
                onChange={(e) => setEditPrimaryUnit(e.target.value as ProductUnit)}
                className="w-full text-sm border border-slate-300 rounded-md px-2.5 h-9 bg-white"
              >
                {PRODUCT_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Min Stock Threshold</label>
              <Input
                type="number"
                min="0"
                value={editMinThreshold}
                onChange={(e) => setEditMinThreshold(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Conversion toggle in edit */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
              <input
                type="checkbox"
                checked={editConvEnabled}
                onChange={(e) => setEditConvEnabled(e.target.checked)}
                className="h-4 w-4 rounded text-[#176B3A]"
              />
              Enable unit conversion ratio
            </label>
            {editConvEnabled && (
              <div className="flex items-center gap-2 pt-1 pl-6">
                <span className="text-xs font-medium text-slate-600">1 {editPrimaryUnit} =</span>
                <Input
                  type="number"
                  min="0.01"
                  step="any"
                  value={editConvRatio}
                  onChange={(e) => setEditConvRatio(e.target.value)}
                  className="w-24 h-8 text-xs font-semibold"
                />
                <select
                  value={editBaseUnit}
                  onChange={(e) => setEditBaseUnit(e.target.value as ProductUnit)}
                  className="text-xs border border-slate-300 rounded-md px-2 h-8 bg-white"
                >
                  {PRODUCT_UNITS.filter((u) => areUnitsCompatible(editPrimaryUnit, u.value) && u.value !== editPrimaryUnit).map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">Product Status</label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as "ACTIVE" | "INACTIVE" | "ARCHIVED")}
              className="w-full text-sm border border-slate-300 rounded-md px-2.5 h-10 bg-white"
            >
              <option value="ACTIVE">Active (Available for operations)</option>
              <option value="INACTIVE">Inactive (Temporarily unavailable)</option>
              <option value="ARCHIVED">Archived (Retired / Discontinued)</option>
            </select>
          </div>
        </div>
      </Dialog>

      {/* Archive Product Dialog */}
      <Dialog
        open={isArchiveOpen}
        onOpenChange={setIsArchiveOpen}
        title={
          <span className="flex items-center gap-2 text-rose-700">
            <Archive className="w-5 h-5" />
            Archive Product
          </span>
        }
        description={`Are you sure you want to archive "${product.name}"?`}
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button type="button" variant="outline" onClick={() => setIsArchiveOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleArchiveProduct}
              disabled={isPending}
            >
              {isPending ? "Archiving..." : "Confirm Archive"}
            </Button>
          </div>
        }
      >
        <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded border border-slate-200">
          Archiving removes this product from active counter billing and search, while preserving historical ledger data and SKU references for compliance.
        </div>
        {dialogError && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs mt-3">
            {dialogError}
          </div>
        )}
      </Dialog>
    </div>
  );
}
