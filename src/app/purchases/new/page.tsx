"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Building2,
  FileText,
  AlertCircle,
  CheckCircle2,
  Layers,
  CreditCard,
  Box,
  Clock,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { ISupplier } from "@/types/supplier";

interface ProductOption {
  _id: string;
  name: string;
  sku?: string;
  brand: string;
  primaryUnit: string;
  purchasePrice?: number;
  unitConversion?: {
    enabled: boolean;
    baseUnit: string;
    conversionRatio: number;
  };
}

interface CategoryOption {
  _id: string;
  name: string;
}

const PRODUCT_UNITS = [
  "BAGS",
  "KG",
  "G",
  "L",
  "ML",
  "PIECES",
  "BOXES",
  "BOTTLES",
  "CANS",
  "PACKETS",
];

interface FormBatch {
  batchNumber: string;
  manufacturingDate?: string;
  expiryDate?: string;
  quantity: number;
}

interface FormItem {
  id: string; // client-side unique key
  isManualProduct: boolean;
  productId: string;
  productName: string;
  brand: string;
  primaryUnit: string;
  sku?: string;
  saveToCatalogue: boolean;
  manualSellingPrice?: number;
  manualCategoryId?: string;
  orderedQty: number;
  unitPurchasePrice: number;
  discountAmount: number;
  taxRate: number;
  batches: FormBatch[];
}

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export default function NewPurchasePage() {
  const router = useRouter();

  // Reference data
  const [suppliers, setSuppliers] = useState<ISupplier[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Form states
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [supplierInvoiceNumber, setSupplierInvoiceNumber] = useState("");
  const [supplierInvoiceDate, setSupplierInvoiceDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE">("CASH");
  const [paymentReference, setPaymentReference] = useState("");
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<FormItem[]>([
    {
      id: "item-1",
      isManualProduct: false,
      productId: "",
      productName: "",
      brand: "",
      primaryUnit: "BAGS",
      sku: "",
      saveToCatalogue: false,
      manualSellingPrice: undefined,
      manualCategoryId: "",
      orderedQty: 1,
      unitPurchasePrice: 0,
      discountAmount: 0,
      taxRate: 5,
      batches: [{ batchNumber: "", quantity: 1 }],
    },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Fetch active suppliers, products, and categories
  useEffect(() => {
    async function loadData() {
      setDataLoading(true);
      try {
        const [supRes, prodRes, catRes] = await Promise.all([
          fetch("/api/suppliers?status=ACTIVE&limit=100", { credentials: "same-origin" }),
          fetch("/api/products?limit=100", { credentials: "same-origin" }),
          fetch("/api/categories?status=ACTIVE&limit=100", { credentials: "same-origin" }),
        ]);

        if (supRes.status === 401 || prodRes.status === 401) {
          setErrorMessage("Your session is unauthenticated. Please sign in to record purchases.");
          return;
        }

        if (supRes.ok) {
          const supData = await supRes.json();
          if (supData.success && supData.data?.suppliers) {
            setSuppliers(supData.data.suppliers);
          }
        }

        if (prodRes.ok) {
          const prodData = await prodRes.json();
          if (prodData.success) {
            // Robust fallback: matches both data.items (standard) and data.products
            const loadedProducts = prodData.data?.items || prodData.data?.products || [];
            setProducts(loadedProducts);
          }
        }

        if (catRes.ok) {
          const catData = await catRes.json();
          if (catData.success && catData.data?.categories) {
            setCategories(catData.data.categories);
          }
        }
      } catch (err) {
        console.error("Failed to load reference data:", err);
      } finally {
        setDataLoading(false);
      }
    }
    loadData();
  }, []);

  const selectedSupplier = suppliers.find((s) => (s.id || s._id) === selectedSupplierId);

  // Line item handlers
  function handleProductChange(itemId: string, productId: string) {
    const prod = products.find((p) => p._id === productId);
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const newPrice =
            typeof prod?.purchasePrice === "number" && prod.purchasePrice > 0
              ? prod.purchasePrice
              : item.unitPurchasePrice || 0;

          return {
            ...item,
            isManualProduct: false,
            productId,
            productName: prod?.name || "",
            brand: prod?.brand || "",
            primaryUnit: prod?.primaryUnit || "BAGS",
            sku: prod?.sku || "",
            unitPurchasePrice: newPrice,
            // If there's only 1 batch, keep its quantity aligned with orderedQty
            batches:
              item.batches.length === 1
                ? [{ ...item.batches[0], quantity: item.orderedQty }]
                : item.batches,
          };
        }
        return item;
      })
    );
  }

  function handleItemChange(
    itemId: string,
    field: keyof FormItem,
    value: any
  ) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          // When orderedQty changes and there is only 1 batch, automatically sync batch quantity
          if (field === "orderedQty") {
            const newQty = parseFloat(value) || 0;
            if (item.batches.length === 1) {
              return {
                ...item,
                orderedQty: newQty,
                batches: [{ ...item.batches[0], quantity: newQty }],
              };
            }
          }
          return {
            ...item,
            [field]: value,
          };
        }
        return item;
      })
    );
  }

  function handleAddItem() {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        isManualProduct: false,
        productId: "",
        productName: "",
        brand: "",
        primaryUnit: "BAGS",
        sku: "",
        saveToCatalogue: false,
        manualSellingPrice: undefined,
        manualCategoryId: "",
        orderedQty: 1,
        unitPurchasePrice: 0,
        discountAmount: 0,
        taxRate: 5,
        batches: [{ batchNumber: "", quantity: 1 }],
      },
    ]);
  }

  function handleRemoveItem(itemId: string) {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  }

  // Batch handlers
  function handleAddBatch(itemId: string) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const allocated = item.batches.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
          const remaining = Math.max(0, round2(item.orderedQty - allocated));
          const nextQty = remaining > 0 ? remaining : 1;

          return {
            ...item,
            batches: [
              ...item.batches,
              { batchNumber: "", quantity: nextQty },
            ],
          };
        }
        return item;
      })
    );
  }

  function handleRemoveBatch(itemId: string, batchIdx: number) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId && item.batches.length > 1) {
          return {
            ...item,
            batches: item.batches.filter((_, idx) => idx !== batchIdx),
          };
        }
        return item;
      })
    );
  }

  function handleBatchChange(
    itemId: string,
    batchIdx: number,
    field: keyof FormBatch,
    val: any
  ) {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const updatedBatches = item.batches.map((b, idx) =>
            idx === batchIdx ? { ...b, [field]: val } : b
          );
          return { ...item, batches: updatedBatches };
        }
        return item;
      })
    );
  }

  // Calculations
  const itemCalculations = items.map((item) => {
    const gross = round2(item.orderedQty * item.unitPurchasePrice);
    const discount = Math.min(gross, round2(item.discountAmount || 0));
    const taxable = round2(gross - discount);
    const tax = round2(taxable * ((item.taxRate || 0) / 100));
    const lineTotal = round2(taxable + tax);
    return { gross, discount, taxable, tax, lineTotal };
  });

  const totals = itemCalculations.reduce(
    (acc, cur) => ({
      gross: round2(acc.gross + cur.gross),
      taxable: round2(acc.taxable + cur.taxable),
      discount: round2(acc.discount + cur.discount),
      tax: round2(acc.tax + cur.tax),
      grandTotal: round2(acc.grandTotal + cur.lineTotal),
    }),
    { gross: 0, taxable: 0, discount: 0, tax: 0, grandTotal: 0 }
  );

  const outstanding = Math.max(0, round2(totals.grandTotal - (amountPaid || 0)));

  // Submit Handler
  async function handleSubmit(receiveNow: boolean) {
    setErrorMessage("");

    if (!selectedSupplierId) {
      setErrorMessage("Please select a registered supplier.");
      return;
    }

    if (!supplierInvoiceNumber.trim()) {
      setErrorMessage("Supplier invoice number is required.");
      return;
    }

    if (!supplierInvoiceDate) {
      setErrorMessage("Supplier invoice date is required.");
      return;
    }

    // Validate items & batches
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.isManualProduct) {
        if (!it.productName.trim() || it.productName.trim().length < 2) {
          setErrorMessage(`Product name for manual line #${i + 1} must be at least 2 characters.`);
          return;
        }
      } else {
        if (!it.productId) {
          setErrorMessage(`Please select a catalogue product for line #${i + 1}.`);
          return;
        }
      }

      if (it.orderedQty <= 0) {
        setErrorMessage(`Quantity for line #${i + 1} must be greater than 0.`);
        return;
      }

      if (it.unitPurchasePrice < 0) {
        setErrorMessage(`Unit price for line #${i + 1} cannot be negative.`);
        return;
      }

      // Batch validation
      const hasAnyBatchNumber = it.batches.some((b) => b.batchNumber.trim() !== "");

      // If immediate inward is selected, batch numbers and exact quantity matching are mandatory
      if (receiveNow) {
        let batchTotal = 0;
        for (let bIdx = 0; bIdx < it.batches.length; bIdx++) {
          const b = it.batches[bIdx];
          if (!b.batchNumber.trim()) {
            setErrorMessage(
              `Batch number is required for line #${i + 1}, batch #${bIdx + 1} when confirming immediate stock inward.`
            );
            return;
          }
          if (b.quantity <= 0) {
            setErrorMessage(`Batch quantity must be greater than 0 on line #${i + 1}, batch #${bIdx + 1}.`);
            return;
          }
          if (b.manufacturingDate && b.expiryDate) {
            if (new Date(b.manufacturingDate) > new Date(b.expiryDate)) {
              setErrorMessage(
                `Expiry date must be on or after manufacturing date on line #${i + 1}, batch '${b.batchNumber}'.`
              );
              return;
            }
          }
          batchTotal = round2(batchTotal + b.quantity);
        }

        if (round2(batchTotal) !== round2(it.orderedQty)) {
          setErrorMessage(
            `Sum of batch quantities (${batchTotal}) must exactly equal total line quantity (${it.orderedQty}) for product '${it.productName || `Line #${i + 1}`}'.`
          );
          return;
        }
      } else if (hasAnyBatchNumber) {
        // If not receiveNow but user entered batch details, validate consistency
        let batchTotal = 0;
        for (let bIdx = 0; bIdx < it.batches.length; bIdx++) {
          const b = it.batches[bIdx];
          if (b.batchNumber.trim()) {
            if (b.quantity <= 0) {
              setErrorMessage(`Batch quantity must be greater than 0 for batch '${b.batchNumber}' on line #${i + 1}.`);
              return;
            }
            if (b.manufacturingDate && b.expiryDate) {
              if (new Date(b.manufacturingDate) > new Date(b.expiryDate)) {
                setErrorMessage(
                  `Expiry date must be on or after manufacturing date on line #${i + 1}, batch '${b.batchNumber}'.`
                );
                return;
              }
            }
            batchTotal = round2(batchTotal + b.quantity);
          }
        }
        if (round2(batchTotal) !== round2(it.orderedQty)) {
          setErrorMessage(
            `Sum of batch quantities (${batchTotal}) must equal total line quantity (${it.orderedQty}) for product '${it.productName || `Line #${i + 1}`}'.`
          );
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        supplierId: selectedSupplierId,
        supplierInvoiceNumber: supplierInvoiceNumber.trim(),
        supplierInvoiceDate: new Date(supplierInvoiceDate).toISOString(),
        purchaseDate: purchaseDate ? new Date(purchaseDate).toISOString() : undefined,
        status: receiveNow ? "RECEIVED" : "PENDING_RECEIPT",
        amountPaid: Number(amountPaid || 0),
        paymentMethod: amountPaid > 0 ? paymentMethod : undefined,
        paymentReference: amountPaid > 0 && paymentReference.trim() ? paymentReference.trim() : undefined,
        receiveNow,
        notes: notes.trim() || undefined,
        items: items.map((it) => ({
          productId: it.isManualProduct ? undefined : it.productId,
          isManualProduct: it.isManualProduct,
          manualProductName: it.isManualProduct ? it.productName.trim() : undefined,
          manualBrand: it.isManualProduct ? it.brand.trim() || undefined : undefined,
          manualUnit: it.isManualProduct ? it.primaryUnit || "BAGS" : undefined,
          manualSellingPrice: it.isManualProduct && it.manualSellingPrice ? Number(it.manualSellingPrice) : undefined,
          manualCategoryId: it.isManualProduct && it.manualCategoryId ? it.manualCategoryId : undefined,
          saveToCatalogue: Boolean(it.isManualProduct && it.saveToCatalogue),
          orderedQty: Number(it.orderedQty),
          unitPurchasePrice: Number(it.unitPurchasePrice),
          discountAmount: Number(it.discountAmount || 0),
          taxRate: Number(it.taxRate || 0),
          batches: it.batches
            .filter((b) => b.batchNumber.trim())
            .map((b) => ({
              batchNumber: b.batchNumber.trim().toUpperCase(),
              manufacturingDate: b.manufacturingDate ? new Date(b.manufacturingDate).toISOString() : undefined,
              expiryDate: b.expiryDate ? new Date(b.expiryDate).toISOString() : undefined,
              quantity: Number(b.quantity),
            })),
        })),
      };

      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.message || "Failed to record purchase entry");
      }

      const createdId = data.data?.purchase?._id || data.data?.purchase?.id;
      if (createdId) {
        router.push(`/purchases/${createdId}`);
      } else {
        router.push("/purchases");
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to record purchase entry");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 pb-16 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/purchases">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Record Inward Purchase Bill
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Record actual supplier invoice, batch inventory details, and initial payment.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <Button
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={() => handleSubmit(false)}
            leftIcon={<Clock className="w-4 h-4" />}
            className="w-full sm:w-auto"
          >
            Save (Pending Goods)
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={submitting}
            onClick={() => handleSubmit(true)}
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
            className="w-full sm:w-auto"
          >
            Confirm & Inward Stock Now
          </Button>
        </div>
      </div>

      {/* Error alert banner */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-3 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">Unable to record purchase bill</p>
            <p className="mt-0.5 text-rose-700">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Section 1: Supplier & Invoice Information */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Supplier Selection */}
        <Card className="lg:col-span-2 border border-slate-200/80 shadow-sm p-4 sm:p-5">
          <CardHeader className="p-0 pb-4 border-b border-slate-100 flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#176B3A]" />
              Supplier Information
            </CardTitle>
            <Link
              href="/suppliers"
              className="text-xs text-[#176B3A] hover:underline font-medium"
            >
              + Manage Suppliers
            </Link>
          </CardHeader>

          <CardContent className="p-0 pt-4 space-y-4">
            <div>
              <label htmlFor="supplier-select" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Select Supplier *
              </label>
              <select
                id="supplier-select"
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                disabled={dataLoading}
                aria-label="Select Supplier"
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#176B3A] focus:border-transparent"
              >
                <option value="">-- Choose a Registered Supplier --</option>
                {suppliers.map((s) => {
                  const sId = s.id || s._id;
                  return (
                    <option key={sId} value={sId}>
                      {s.name} {s.gstin ? `(GST: ${s.gstin})` : ""} - {s.phone}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Selected Supplier Preview Card */}
            {selectedSupplier && (
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900 text-sm">
                    {selectedSupplier.name}
                  </span>
                  <Badge variant="agri" size="sm">ACTIVE</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-600 pt-1">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Contact Person:</span>
                    <span className="font-medium text-slate-800">
                      {selectedSupplier.contactPerson || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Phone:</span>
                    <span className="font-medium text-slate-800">{selectedSupplier.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">GSTIN:</span>
                    <span className="font-mono font-medium text-slate-800">
                      {selectedSupplier.gstin || "Unregistered"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice Metadata */}
        <Card className="border border-slate-200/80 shadow-sm p-4 sm:p-5">
          <CardHeader className="p-0 pb-4 border-b border-slate-100">
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#176B3A]" />
              Invoice Particulars
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0 pt-4 space-y-3">
            <div>
              <label htmlFor="invoice-no-input" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Supplier Invoice # *
              </label>
              <Input
                id="invoice-no-input"
                placeholder="e.g. INV-2026-881"
                value={supplierInvoiceNumber}
                onChange={(e) => setSupplierInvoiceNumber(e.target.value)}
                className="bg-white font-mono text-sm"
              />
            </div>

            <div>
              <label htmlFor="invoice-date-input" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Supplier Invoice Date *
              </label>
              <Input
                id="invoice-date-input"
                type="date"
                value={supplierInvoiceDate}
                onChange={(e) => setSupplierInvoiceDate(e.target.value)}
                className="bg-white text-sm"
              />
            </div>

            <div>
              <label htmlFor="purchase-date-input" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Purchase / Entry Date
              </label>
              <Input
                id="purchase-date-input"
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="bg-white text-sm"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section 2: Line Items & Multiple Batches */}
      <Card className="border border-slate-200/80 shadow-sm p-4 sm:p-5">
        <CardHeader className="p-0 pb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#176B3A]" />
              Purchased Products & Batches
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Record invoiced quantities, cost price, GST, and multiple batches per product.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleAddItem}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Product
          </Button>
        </CardHeader>

        <CardContent className="p-0 pt-4 space-y-6">
          {items.map((item, index) => {
            const calc = itemCalculations[index];
            const selectedProd = products.find((p) => p._id === item.productId);
            const batchSum = item.batches.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
            const isBatchFullyAllocated = round2(batchSum) === round2(item.orderedQty);
            const isBatchOverAllocated = round2(batchSum) > round2(item.orderedQty);

            return (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/50 space-y-4 relative"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-[#176B3A] text-xs font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-800">
                      Product #{index + 1}
                    </span>
                    {item.isManualProduct ? (
                      <Badge variant={item.saveToCatalogue ? "agri" : "warning"} size="sm">
                        {item.saveToCatalogue ? "New: Save to Catalogue" : "New: Purchase Only"}
                      </Badge>
                    ) : item.primaryUnit ? (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="neutral" size="sm">
                          Unit: {item.primaryUnit}
                        </Badge>
                        {selectedProd?.unitConversion?.enabled && (
                          <span className="text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">
                            1 {selectedProd.primaryUnit} = {selectedProd.unitConversion.conversionRatio} {selectedProd.unitConversion.baseUnit}
                          </span>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Toggle: Catalog vs Manual Entry */}
                    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          handleItemChange(item.id, "isManualProduct", false);
                          handleItemChange(item.id, "saveToCatalogue", false);
                        }}
                        className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                          !item.isManualProduct
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        Select from Catalogue
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          handleItemChange(item.id, "isManualProduct", true);
                          handleItemChange(item.id, "productId", "");
                          if (!item.primaryUnit) handleItemChange(item.id, "primaryUnit", "BAGS");
                        }}
                        className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                          item.isManualProduct
                            ? "bg-[#176B3A] text-white shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        + Enter New Product
                      </button>
                    </div>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-slate-400 hover:text-rose-600 transition-colors p-1"
                        title="Remove Item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Main Product Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                  <div className="sm:col-span-2">
                    {!item.isManualProduct ? (
                      <div>
                        <label htmlFor={`prod-sel-${item.id}`} className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                          Select Product from Catalogue *
                        </label>
                        <select
                          id={`prod-sel-${item.id}`}
                          value={item.productId}
                          onChange={(e) => handleProductChange(item.id, e.target.value)}
                          aria-label="Select Product"
                          className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#176B3A]"
                        >
                          <option value="">-- Choose Catalogue Product --</option>
                          {products.map((p) => (
                            <option key={p._id} value={p._id}>
                              {p.name} ({p.brand}) {p.sku ? `[${p.sku}]` : ""} - {p.primaryUnit}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <label htmlFor={`prod-name-${item.id}`} className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                            Product Name *
                          </label>
                          <Input
                            id={`prod-name-${item.id}`}
                            placeholder="e.g. Tata Rallis Panida 1L"
                            value={item.productName}
                            onChange={(e) => handleItemChange(item.id, "productName", e.target.value)}
                            className="h-9 bg-white text-xs sm:text-sm font-medium"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label htmlFor={`prod-brand-${item.id}`} className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                              Brand (Optional)
                            </label>
                            <Input
                              id={`prod-brand-${item.id}`}
                              placeholder="e.g. Tata Rallis"
                              value={item.brand}
                              onChange={(e) => handleItemChange(item.id, "brand", e.target.value)}
                              className="h-8 bg-white text-xs"
                            />
                          </div>
                          <div>
                            <label htmlFor={`prod-unit-${item.id}`} className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                              Unit *
                            </label>
                            <select
                              id={`prod-unit-${item.id}`}
                              value={item.primaryUnit || "BAGS"}
                              onChange={(e) => handleItemChange(item.id, "primaryUnit", e.target.value)}
                              className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#176B3A]"
                            >
                              {PRODUCT_UNITS.map((u) => (
                                <option key={u} value={u}>
                                  {u}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div>
                    <label htmlFor={`qty-${item.id}`} className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Qty ({item.primaryUnit || "Unit"}) *
                    </label>
                    <Input
                      id={`qty-${item.id}`}
                      type="number"
                      min="0.01"
                      step="any"
                      value={item.orderedQty}
                      onChange={(e) =>
                        handleItemChange(item.id, "orderedQty", parseFloat(e.target.value) || 0)
                      }
                      className="h-9 bg-white text-xs sm:text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor={`price-${item.id}`} className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Cost Price (₹) *
                    </label>
                    <Input
                      id={`price-${item.id}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unitPurchasePrice}
                      onChange={(e) =>
                        handleItemChange(
                          item.id,
                          "unitPurchasePrice",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="h-9 bg-white text-xs sm:text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor={`disc-${item.id}`} className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Discount (₹)
                    </label>
                    <Input
                      id={`disc-${item.id}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.discountAmount}
                      onChange={(e) =>
                        handleItemChange(
                          item.id,
                          "discountAmount",
                          parseFloat(e.target.value) || 0
                        )
                      }
                      className="h-9 bg-white text-xs sm:text-sm"
                    />
                  </div>

                  <div>
                    <label htmlFor={`tax-${item.id}`} className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      GST Rate
                    </label>
                    <select
                      id={`tax-${item.id}`}
                      value={item.taxRate}
                      onChange={(e) =>
                        handleItemChange(item.id, "taxRate", parseFloat(e.target.value) || 0)
                      }
                      aria-label="GST Rate"
                      className="w-full h-9 px-2 rounded-lg border border-slate-200 bg-white text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#176B3A]"
                    >
                      <option value="0">0% (Nil)</option>
                      <option value="5">5% GST</option>
                      <option value="12">12% GST</option>
                      <option value="18">18% GST</option>
                      <option value="28">28% GST</option>
                    </select>
                  </div>
                </div>

                {/* Catalogue Integration Panel (Only for manually entered products) */}
                {item.isManualProduct && (
                  <div className="p-3 bg-white rounded-lg border border-slate-200/90 text-xs space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={item.saveToCatalogue}
                          onChange={(e) =>
                            handleItemChange(item.id, "saveToCatalogue", e.target.checked)
                          }
                          className="w-4 h-4 text-[#176B3A] rounded border-slate-300 focus:ring-[#176B3A]"
                        />
                        <span className="font-semibold text-slate-800">
                          Save to Product Catalogue
                        </span>
                      </label>
                      <span className="text-[11px] text-slate-500">
                        {item.saveToCatalogue
                          ? "✓ Permanent catalogue item: auto-generates SKU, tracks inventory and enables future sales"
                          : "Purchase-only item: recorded on invoice without adding to catalog inventory"}
                      </span>
                    </div>

                    {item.saveToCatalogue && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Category (Optional)
                          </label>
                          <select
                            value={item.manualCategoryId || ""}
                            onChange={(e) =>
                              handleItemChange(item.id, "manualCategoryId", e.target.value)
                            }
                            className="w-full h-8 px-2 rounded border border-slate-200 bg-white text-xs text-slate-800"
                          >
                            <option value="">-- Auto-Assign / General --</option>
                            {categories.map((c) => (
                              <option key={c._id} value={c._id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            Selling Price (₹) — Optional
                          </label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder={`Defaults to cost price (₹${item.unitPurchasePrice || 0})`}
                            value={item.manualSellingPrice || ""}
                            onChange={(e) =>
                              handleItemChange(
                                item.id,
                                "manualSellingPrice",
                                parseFloat(e.target.value) || undefined
                              )
                            }
                            className="h-8 text-xs bg-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Multi-Batch Details Subsection */}
                <div className="p-3 bg-white rounded-lg border border-slate-200/80 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                        <Box className="w-3.5 h-3.5 text-[#176B3A]" />
                        Batch Tracking ({item.batches.length} {item.batches.length === 1 ? "Batch" : "Batches"})
                      </span>
                      {isBatchFullyAllocated ? (
                        <span className="text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Check className="w-3 h-3" /> Fully Allocated ({batchSum} / {item.orderedQty} {item.primaryUnit})
                        </span>
                      ) : isBatchOverAllocated ? (
                        <span className="text-[11px] bg-rose-50 text-rose-700 border border-rose-200 font-medium px-2 py-0.5 rounded-full">
                          ⚠ Exceeds by {round2(batchSum - item.orderedQty)} {item.primaryUnit}
                        </span>
                      ) : (
                        <span className="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 font-medium px-2 py-0.5 rounded-full">
                          Unallocated: {round2(item.orderedQty - batchSum)} {item.primaryUnit}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleAddBatch(item.id)}
                      className="text-[11px] font-semibold text-[#176B3A] hover:underline"
                    >
                      + Split / Add Batch
                    </button>
                  </div>

                  <div className="space-y-2">
                    {item.batches.map((batch, bIdx) => {
                      const hasDateError =
                        batch.manufacturingDate &&
                        batch.expiryDate &&
                        new Date(batch.manufacturingDate) > new Date(batch.expiryDate);

                      return (
                        <div key={bIdx} className="space-y-1">
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center text-xs">
                            <div>
                              <Input
                                placeholder="Batch # (e.g. B-101)"
                                value={batch.batchNumber}
                                onChange={(e) =>
                                  handleBatchChange(item.id, bIdx, "batchNumber", e.target.value)
                                }
                                className="h-8 text-xs font-mono uppercase bg-slate-50"
                              />
                            </div>
                            <div>
                              <Input
                                type="date"
                                title="Manufacturing Date"
                                value={batch.manufacturingDate || ""}
                                onChange={(e) =>
                                  handleBatchChange(item.id, bIdx, "manufacturingDate", e.target.value)
                                }
                                className="h-8 text-xs bg-slate-50"
                              />
                            </div>
                            <div>
                              <Input
                                type="date"
                                title="Expiry Date (Optional)"
                                value={batch.expiryDate || ""}
                                onChange={(e) =>
                                  handleBatchChange(item.id, bIdx, "expiryDate", e.target.value)
                                }
                                className="h-8 text-xs bg-slate-50"
                              />
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="number"
                                min="0.01"
                                step="any"
                                placeholder="Qty"
                                value={batch.quantity}
                                onChange={(e) =>
                                  handleBatchChange(
                                    item.id,
                                    bIdx,
                                    "quantity",
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="h-8 text-xs bg-slate-50 w-24"
                              />
                              <span className="text-[11px] text-slate-500 font-medium">
                                {item.primaryUnit || "Unit"}
                              </span>
                              {item.batches.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveBatch(item.id, bIdx)}
                                  className="text-slate-400 hover:text-rose-600 p-1 ml-auto"
                                  title="Remove Batch"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          {hasDateError && (
                            <p className="text-[11px] text-rose-600 font-medium">
                              ⚠ Expiry date must be on or after manufacturing date.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Line calculation summary banner */}
                <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span>
                      Gross: <strong className="text-slate-700">₹{calc.gross.toFixed(2)}</strong>
                    </span>
                    {calc.discount > 0 && (
                      <span className="text-emerald-700">
                        Disc: <strong>-₹{calc.discount.toFixed(2)}</strong>
                      </span>
                    )}
                    <span>
                      Taxable: <strong className="text-slate-700">₹{calc.taxable.toFixed(2)}</strong>
                    </span>
                    <span>
                      GST ({item.taxRate}%): <strong className="text-slate-700">₹{calc.tax.toFixed(2)}</strong>
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-600 font-medium">Line Total: </span>
                    <strong className="text-sm font-bold text-slate-900">
                      ₹{calc.lineTotal.toFixed(2)}
                    </strong>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Section 3: Payment & Grand Totals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Payment & Remarks */}
        <Card className="lg:col-span-2 border border-slate-200/80 shadow-sm p-4 sm:p-5 space-y-4">
          <CardHeader className="p-0 pb-3 border-b border-slate-100 flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#176B3A]" />
              Upfront Supplier Payment & Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-4">
            <div>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                <label htmlFor="amount-paid-input" className="block text-xs font-semibold text-slate-700">
                  Upfront Amount Paid (₹) — Optional
                </label>
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setAmountPaid(totals.grandTotal)}
                    className="px-2 py-0.5 rounded bg-emerald-50 text-[#176B3A] font-semibold hover:bg-emerald-100 transition-colors"
                  >
                    Pay Full (₹{totals.grandTotal.toFixed(2)})
                  </button>
                  {amountPaid > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setAmountPaid(0);
                        setPaymentReference("");
                      }}
                      className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium hover:bg-slate-200 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              <Input
                id="amount-paid-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amountPaid || ""}
                onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                className="bg-white text-sm max-w-sm"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Enter any advance, cash, or immediate electronic payment made to the supplier for this purchase invoice.
              </p>
            </div>

            {/* Payment Method & Reference (Visible when amountPaid > 0) */}
            {amountPaid > 0 && (
              <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-lg space-y-3">
                <span className="text-xs font-bold text-slate-800 block">
                  Payment Mode & Reference
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label htmlFor="payment-method-select" className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Payment Mode
                    </label>
                    <select
                      id="payment-method-select"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full h-8 px-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#176B3A]"
                    >
                      <option value="CASH">Cash</option>
                      <option value="UPI">UPI (GPay / PhonePe / Paytm)</option>
                      <option value="BANK_TRANSFER">Bank Transfer (NEFT / RTGS / IMPS)</option>
                      <option value="CHEQUE">Cheque / Demand Draft</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="payment-ref-input" className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Reference / UTR / Cheque # (Optional)
                    </label>
                    <Input
                      id="payment-ref-input"
                      placeholder="e.g. UTR12345678, CHQ-99120"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>

                {amountPaid > totals.grandTotal && (
                  <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                    ℹ Payment of ₹{amountPaid.toFixed(2)} exceeds invoice total of ₹{totals.grandTotal.toFixed(2)}. The excess ₹{round2(amountPaid - totals.grandTotal).toFixed(2)} will be recognized as advance credit with supplier.
                  </p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="notes-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Internal Remarks & Lorry / Transport Details
              </label>
              <textarea
                id="notes-input"
                rows={3}
                placeholder="Vehicle number, transport LR number, delivery notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#176B3A] resize-none"
              />
            </div>
          </CardContent>
        </Card>

        {/* Financial Summary Card */}
        <Card className="border border-slate-200/80 shadow-sm p-4 sm:p-5 bg-white">
          <CardHeader className="p-0 pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Financial Summary
            </CardTitle>
          </CardHeader>

          <CardContent className="p-0 pt-3 space-y-2.5 text-xs sm:text-sm">
            <div className="flex items-center justify-between text-slate-600">
              <span>Gross Subtotal:</span>
              <span className="font-semibold text-slate-800">
                ₹{totals.gross.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            {totals.discount > 0 && (
              <div className="flex items-center justify-between text-emerald-700">
                <span>Total Discount:</span>
                <span className="font-semibold">
                  -₹{totals.discount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-slate-600">
              <span>Taxable Amount:</span>
              <span className="font-semibold text-slate-800">
                ₹{totals.taxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>Total GST:</span>
              <span className="font-semibold text-slate-800">
                +₹{totals.tax.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">Grand Total:</span>
              <span className="text-lg font-bold text-[#176B3A]">
                ₹{totals.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between text-emerald-700">
              <span>Upfront Paid:</span>
              <span className="font-semibold">
                ₹{(amountPaid || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-amber-700 font-bold">
              <span>Net Outstanding:</span>
              <span className="text-base">
                ₹{outstanding.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 space-y-2">
              <Button
                variant="primary"
                className="w-full"
                loading={submitting}
                onClick={() => handleSubmit(true)}
                leftIcon={<CheckCircle2 className="w-4 h-4" />}
              >
                Confirm & Inward Stock Now
              </Button>
              <Button
                variant="outline"
                className="w-full"
                disabled={submitting}
                onClick={() => handleSubmit(false)}
                leftIcon={<Clock className="w-4 h-4" />}
              >
                Save (Pending Goods)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
