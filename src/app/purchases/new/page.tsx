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
  Save,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
  CreditCard,
  Truck,
  Box,
  Clock,
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
}

interface FormBatch {
  batchNumber: string;
  manufacturingDate?: string;
  expiryDate?: string;
  quantity: number;
}

interface FormItem {
  id: string; // client-side unique key
  productId: string;
  productName: string;
  primaryUnit: string;
  sku?: string;
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
  const [notes, setNotes] = useState("");

  const [items, setItems] = useState<FormItem[]>([
    {
      id: "item-1",
      productId: "",
      productName: "",
      primaryUnit: "",
      sku: "",
      orderedQty: 1,
      unitPurchasePrice: 0,
      discountAmount: 0,
      taxRate: 5,
      batches: [{ batchNumber: "", quantity: 1 }],
    },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Fetch active suppliers and products
  useEffect(() => {
    async function loadData() {
      setDataLoading(true);
      try {
        const [supRes, prodRes] = await Promise.all([
          fetch("/api/suppliers?status=ACTIVE&limit=100"),
          fetch("/api/products?limit=100"),
        ]);

        if (supRes.ok) {
          const supData = await supRes.json();
          if (supData.success && supData.data?.suppliers) {
            setSuppliers(supData.data.suppliers);
          }
        }

        if (prodRes.ok) {
          const prodData = await prodRes.json();
          if (prodData.success && prodData.data?.products) {
            setProducts(prodData.data.products);
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
          return {
            ...item,
            productId,
            productName: prod?.name || "",
            primaryUnit: prod?.primaryUnit || "",
            sku: prod?.sku || "",
            unitPurchasePrice: prod?.purchasePrice || item.unitPurchasePrice || 0,
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
        productId: "",
        productName: "",
        primaryUnit: "",
        sku: "",
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
          return {
            ...item,
            batches: [
              ...item.batches,
              { batchNumber: "", quantity: 1 },
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
      taxable: round2(acc.taxable + cur.taxable),
      discount: round2(acc.discount + cur.discount),
      tax: round2(acc.tax + cur.tax),
      grandTotal: round2(acc.grandTotal + cur.lineTotal),
    }),
    { taxable: 0, discount: 0, tax: 0, grandTotal: 0 }
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
      if (!it.productId) {
        setErrorMessage(`Please select a product for line #${i + 1}.`);
        return;
      }
      if (it.orderedQty <= 0) {
        setErrorMessage(`Quantity for line #${i + 1} must be greater than 0.`);
        return;
      }
      if (it.unitPurchasePrice < 0) {
        setErrorMessage(`Unit price for line #${i + 1} cannot be negative.`);
        return;
      }

      // If immediate inward, batches are required with batchNumber
      if (receiveNow) {
        let batchTotal = 0;
        for (let bIdx = 0; bIdx < it.batches.length; bIdx++) {
          const b = it.batches[bIdx];
          if (!b.batchNumber.trim()) {
            setErrorMessage(`Batch number is required for line #${i + 1}, batch #${bIdx + 1} when confirming inward stock.`);
            return;
          }
          if (b.quantity <= 0) {
            setErrorMessage(`Batch quantity must be greater than 0 on line #${i + 1}.`);
            return;
          }
          if (b.manufacturingDate && b.expiryDate) {
            if (new Date(b.manufacturingDate) > new Date(b.expiryDate)) {
              setErrorMessage(`Expiry date must be after manufacturing date on line #${i + 1}, batch ${b.batchNumber}.`);
              return;
            }
          }
          batchTotal += b.quantity;
        }

        if (round2(batchTotal) !== round2(it.orderedQty)) {
          setErrorMessage(
            `Sum of batch quantities (${batchTotal}) must equal total line quantity (${it.orderedQty}) for product '${it.productName}'.`
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
        receiveNow,
        notes: notes.trim() || undefined,
        items: items.map((it) => ({
          productId: it.productId,
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
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Record Inward Purchase Bill
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Record actual supplier invoice, batch inventory details, and initial payment.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={() => handleSubmit(false)}
            leftIcon={<Clock className="w-4 h-4" />}
          >
            Save (Pending Goods)
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={submitting}
            onClick={() => handleSubmit(true)}
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
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
                <option value="">-- Choose a Supplier --</option>
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-600 pt-1">
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
        <CardHeader className="p-0 pb-4 border-b border-slate-100 flex-row items-center justify-between">
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

            return (
              <div
                key={item.id}
                className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/50 space-y-4 relative"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-[#176B3A] text-xs font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-800">
                      Product #{index + 1}
                    </span>
                    {item.primaryUnit && (
                      <Badge variant="neutral" size="sm">
                        Unit: {item.primaryUnit}
                      </Badge>
                    )}
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

                {/* Main Product Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                  <div className="sm:col-span-2">
                    <label htmlFor={`prod-sel-${item.id}`} className="block text-[11px] font-semibold text-slate-600 uppercase tracking-wider mb-1">
                      Product *
                    </label>
                    <select
                      id={`prod-sel-${item.id}`}
                      value={item.productId}
                      onChange={(e) => handleProductChange(item.id, e.target.value)}
                      aria-label="Select Product"
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#176B3A]"
                    >
                      <option value="">-- Choose Product --</option>
                      {products.map((p) => (
                        <option key={p._id} value={p._id}>
                          {p.name} ({p.brand}) {p.sku ? `[${p.sku}]` : ""} - {p.primaryUnit}
                        </option>
                      ))}
                    </select>
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

                {/* Multi-Batch Details Subsection */}
                <div className="p-3 bg-white rounded-lg border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                      <Box className="w-3.5 h-3.5 text-emerald-700" />
                      Batch Tracking ({item.batches.length} {item.batches.length === 1 ? "Batch" : "Batches"})
                    </span>
                    <button
                      type="button"
                      onClick={() => handleAddBatch(item.id)}
                      className="text-[11px] font-semibold text-[#176B3A] hover:underline"
                    >
                      + Split / Add Batch
                    </button>
                  </div>

                  <div className="space-y-2">
                    {item.batches.map((batch, bIdx) => (
                      <div key={bIdx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center text-xs">
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
                            title="Expiry Date"
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
                          {item.batches.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveBatch(item.id, bIdx)}
                              className="text-slate-400 hover:text-rose-600 p-1"
                              title="Remove Batch"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Line calculation summary banner */}
                <div className="pt-2 border-t border-slate-200/60 flex flex-wrap items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-4">
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
              Upfront Supplier Payment & Terms
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 space-y-4">
            <div>
              <label htmlFor="amount-paid-input" className="block text-xs font-semibold text-slate-700 mb-1">
                Upfront Amount Paid (₹) — Optional
              </label>
              <Input
                id="amount-paid-input"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={amountPaid}
                onChange={(e) => setAmountPaid(parseFloat(e.target.value) || 0)}
                className="bg-white text-sm max-w-sm"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Enter any advance or on-the-spot payment made via UPI, cash, or bank transfer for this invoice.
              </p>
            </div>

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
              <span>Taxable Subtotal:</span>
              <span className="font-semibold text-slate-800">
                ₹{totals.taxable.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
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
              <span>Amount Paid:</span>
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
