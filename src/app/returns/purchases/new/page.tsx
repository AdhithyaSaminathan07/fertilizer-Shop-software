"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Truck,
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertCircle,
  Save,
  Send,
  Building2,
} from "lucide-react";
import { ReturnsNav } from "@/components/returns/returns-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import type {
  PurchaseReturnReason,
  ReturnItemCondition,
  PurchaseReturnSupplierResponse,
} from "@/types/returns";

interface PurchaseOption {
  _id: string;
  purchaseNumber: string;
  supplierInvoiceNumber?: string;
  supplierSnapshot?: { name: string };
  totalAmount?: number;
  purchaseDate?: string;
  createdAt: string;
}

interface ReturnItemState {
  productId: string;
  productName: string;
  sku: string;
  primaryUnit: string;
  batchNumber?: string;
  purchasedQuantity: number;
  previouslyReturnedQuantity: number;
  availableToReturn: number;
  unitPurchasePrice: number;
  discountAmount: number;
  taxRate: number;
  selected: boolean;
  returnQty: number;
  reason: PurchaseReturnReason;
  condition: ReturnItemCondition;
  remarks: string;
}

export default function NewPurchaseReturnPage() {
  const router = useRouter();

  const [purchases, setPurchases] = React.useState<PurchaseOption[]>([]);
  const [selectedPurchaseId, setSelectedPurchaseId] = React.useState("");
  const [purchaseDetails, setPurchaseDetails] = React.useState<any | null>(null);
  const [returnItems, setReturnItems] = React.useState<ReturnItemState[]>([]);

  const [supplierResponse, setSupplierResponse] =
    React.useState<PurchaseReturnSupplierResponse>("CREDIT_NOTE_EXPECTED");
  const [supplierCreditNoteNumber, setSupplierCreditNoteNumber] = React.useState("");
  const [supplierCreditNoteDate, setSupplierCreditNoteDate] = React.useState("");
  const [generalReason, setGeneralReason] = React.useState<PurchaseReturnReason>("DEFECTIVE");
  const [generalRemarks, setGeneralRemarks] = React.useState("");

  const [loadingPurchases, setLoadingPurchases] = React.useState(true);
  const [loadingLookup, setLoadingLookup] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Load purchase invoices for selection
  React.useEffect(() => {
    let ignore = false;
    async function fetchPurchasesList() {
      try {
        const res = await fetch("/api/purchases?limit=50&status=RECEIVED");
        const json = await res.json();
        if (!ignore && res.ok) {
          const list = json.data?.purchases || json.purchases || [];
          setPurchases(list);
          if (list.length > 0 && !selectedPurchaseId) {
            setSelectedPurchaseId(list[0]._id);
          }
        }
      } catch {
        // Fallback or retry
      } finally {
        if (!ignore) setLoadingPurchases(false);
      }
    }

    fetchPurchasesList();
    return () => {
      ignore = true;
    };
  }, [selectedPurchaseId]);

  // Load returnable items whenever selectedPurchaseId changes
  React.useEffect(() => {
    if (!selectedPurchaseId) return;

    let ignore = false;
    async function loadPurchaseLookup() {
      setLoadingLookup(true);
      setError(null);
      try {
        const res = await fetch(`/api/purchase-returns/lookup/${selectedPurchaseId}`);
        const json = await res.json();
        if (!ignore && res.ok) {
          setPurchaseDetails(json.data);
          const initialItems: ReturnItemState[] = (json.data.items || []).map((it: any) => ({
            productId: it.productId,
            productName: it.productSnapshot?.name || "Product",
            sku: it.productSnapshot?.sku || "",
            primaryUnit: it.productSnapshot?.primaryUnit || "PCS",
            batchNumber: it.batchNumber,
            purchasedQuantity: it.purchasedQuantity,
            previouslyReturnedQuantity: it.previouslyReturnedQuantity,
            availableToReturn: it.availableToReturn,
            unitPurchasePrice: it.unitPurchasePrice,
            discountAmount: it.discountAmount,
            taxRate: it.taxRate,
            selected: it.availableToReturn > 0,
            returnQty: it.availableToReturn > 0 ? 1 : 0,
            reason: "DEFECTIVE",
            condition: "DEFECTIVE",
            remarks: "",
          }));
          setReturnItems(initialItems);
        } else if (!ignore) {
          setError(json.error?.message || json.message || "Failed to load purchase details");
          setPurchaseDetails(null);
          setReturnItems([]);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load purchase details");
          setPurchaseDetails(null);
          setReturnItems([]);
        }
      } finally {
        if (!ignore) setLoadingLookup(false);
      }
    }

    loadPurchaseLookup();
    return () => {
      ignore = true;
    };
  }, [selectedPurchaseId]);

  const handleToggleItem = (index: number) => {
    setReturnItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, selected: !it.selected } : it))
    );
  };

  const handleUpdateItem = <K extends keyof ReturnItemState>(
    index: number,
    field: K,
    val: ReturnItemState[K]
  ) => {
    setReturnItems((prev) =>
      prev.map((it, i) => {
        if (i !== index) return it;
        if (field === "returnQty") {
          const qty = Number(val);
          const clamped = Math.max(0, Math.min(it.availableToReturn, qty));
          return { ...it, returnQty: clamped, selected: clamped > 0 };
        }
        return { ...it, [field]: val };
      })
    );
  };

  // Recalculate totals
  const selectedItems = returnItems.filter((it) => it.selected && it.returnQty > 0);

  const subtotal = selectedItems.reduce((acc, it) => {
    return acc + it.unitPurchasePrice * it.returnQty;
  }, 0);

  const discountTotal = selectedItems.reduce((acc, it) => {
    const proratedDisc =
      it.purchasedQuantity > 0 ? (it.discountAmount / it.purchasedQuantity) * it.returnQty : 0;
    return acc + proratedDisc;
  }, 0);

  const taxableSubtotal = Math.max(0, subtotal - discountTotal);

  const taxTotal = selectedItems.reduce((acc, it) => {
    const lineGross = it.unitPurchasePrice * it.returnQty;
    const proratedDisc =
      it.purchasedQuantity > 0 ? (it.discountAmount / it.purchasedQuantity) * it.returnQty : 0;
    const lineTaxable = Math.max(0, lineGross - proratedDisc);
    return acc + (lineTaxable * it.taxRate) / 100;
  }, 0);

  const returnTotal = taxableSubtotal + taxTotal;

  const handleSubmit = async (submitForApproval: boolean) => {
    if (!selectedPurchaseId) {
      setError("Please select an original purchase invoice");
      return;
    }

    if (selectedItems.length === 0) {
      setError("Please select at least one item and enter a return quantity > 0");
      return;
    }

    // Validate boundaries
    for (const it of selectedItems) {
      if (it.returnQty > it.availableToReturn) {
        setError(
          `Return quantity for ${it.productName} exceeds remaining available quantity (${it.availableToReturn})`
        );
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        purchaseId: selectedPurchaseId,
        supplierResponse,
        supplierCreditNoteNumber: supplierCreditNoteNumber.trim() || undefined,
        supplierCreditNoteDate: supplierCreditNoteDate || undefined,
        generalReason,
        remarks: generalRemarks.trim() || undefined,
        submitForApproval,
        items: selectedItems.map((it) => ({
          productId: it.productId,
          batchNumber: it.batchNumber,
          returnQty: it.returnQty,
          reason: it.reason,
          condition: it.condition,
          remarks: it.remarks.trim() || undefined,
        })),
      };

      const res = await fetch("/api/purchase-returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || json.message || "Failed to create purchase return");
      }

      const returnId = json.data?._id || json.data?.id;
      router.push(`/returns/purchases/${returnId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit purchase return");
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <Link href="/returns/purchases">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <Truck className="h-6 w-6 text-purple-600" />
                Record Supplier Purchase Return
              </h1>
              <p className="text-xs text-slate-500">
                Return goods to supplier with independent credit note / refund tracking
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={submitting || selectedItems.length === 0}
              onClick={() => handleSubmit(false)}
              className="gap-1.5"
            >
              <Save className="h-4 w-4" />
              Save Draft
            </Button>
            <Button
              size="sm"
              disabled={submitting || selectedItems.length === 0}
              onClick={() => handleSubmit(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
            >
              <Send className="h-4 w-4" />
              Submit for Approval
            </Button>
          </div>
        </div>

        <ReturnsNav />

        {/* Independence Architecture Warning Notice */}
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-900 flex items-start gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Strict Module Independence Notice:</span> Creating or
            approving this purchase return will NOT decrease product inventory or adjust supplier
            outstanding/advance ledger balances. Returns operate as an independent operational
            record.
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Purchase invoice selection card */}
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-purple-600" />
            1. Select Original Purchase Invoice
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Purchase Order / Received Invoice <span className="text-rose-500">*</span>
              </label>
              {loadingPurchases ? (
                <div className="h-9 w-full bg-slate-100 animate-pulse rounded" />
              ) : (
                <select
                  aria-label="Purchase Order / Received Invoice"
                  value={selectedPurchaseId}
                  onChange={(e) => setSelectedPurchaseId(e.target.value)}
                  className="w-full h-9 text-xs rounded-md border border-slate-300 bg-white px-3 py-1 font-mono text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="">-- Choose Purchase Invoice --</option>
                  {purchases.map((po) => (
                    <option key={po._id} value={po._id}>
                      {po.purchaseNumber} (Inv: {po.supplierInvoiceNumber || "N/A"}) — {po.supplierSnapshot?.name || "Supplier"} — ₹{po.totalAmount?.toFixed(2) || "0.00"}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {purchaseDetails && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Supplier:</span>
                  <span className="font-semibold text-slate-900">
                    {purchaseDetails.supplierSnapshot?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Supplier Inv #:</span>
                  <span className="font-mono text-slate-800">
                    {purchaseDetails.supplierInvoiceNumber || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Purchase Date:</span>
                  <span className="text-slate-700">
                    {new Date(purchaseDetails.purchaseDate).toLocaleDateString("en-IN")}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Return items selection table */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">2. Select Items to Return</h2>
              <p className="text-xs text-slate-500">
                Specify return quantities, defect reasons and physical condition
              </p>
            </div>
            <div className="text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-1 rounded border border-purple-200">
              {selectedItems.length} items selected
            </div>
          </div>

          {loadingLookup ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Loading purchase invoice items and return limits...
            </div>
          ) : returnItems.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No items available to return from this invoice.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-10 text-center">Sel</TableHead>
                    <TableHead className="w-56">Product</TableHead>
                    <TableHead className="w-20 text-right">Purchased</TableHead>
                    <TableHead className="w-20 text-right">Available</TableHead>
                    <TableHead className="w-24 text-right">Return Qty</TableHead>
                    <TableHead className="w-28 text-right">Unit Price</TableHead>
                    <TableHead className="w-28 text-right">Tax</TableHead>
                    <TableHead className="w-32">Reason</TableHead>
                    <TableHead className="w-32">Condition</TableHead>
                    <TableHead className="w-32 text-right">Line Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returnItems.map((item, idx) => {
                    const isDisabled = item.availableToReturn <= 0;
                    const lineGross = item.unitPurchasePrice * item.returnQty;
                    const proratedDisc =
                      item.purchasedQuantity > 0
                        ? (item.discountAmount / item.purchasedQuantity) * item.returnQty
                        : 0;
                    const lineTaxable = Math.max(0, lineGross - proratedDisc);
                    const lineTax = (lineTaxable * item.taxRate) / 100;
                    const lineTotal = lineTaxable + lineTax;

                    return (
                      <TableRow
                        key={idx}
                        className={item.selected ? "bg-purple-50/40" : isDisabled ? "opacity-50" : ""}
                      >
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            disabled={isDisabled}
                            onChange={() => handleToggleItem(idx)}
                            className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-slate-900 text-xs">
                            {item.productName}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5">
                            <span>SKU: {item.sku}</span>
                            {item.batchNumber && <span>• Batch: {item.batchNumber}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-slate-600">
                          {item.purchasedQuantity} {item.primaryUnit}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-slate-700 font-medium">
                          {item.availableToReturn} {item.primaryUnit}
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            max={item.availableToReturn}
                            step="any"
                            disabled={isDisabled || !item.selected}
                            value={item.returnQty || ""}
                            onChange={(e) => handleUpdateItem(idx, "returnQty", Number(e.target.value))}
                            className="h-8 text-xs font-mono text-right w-20 ml-auto"
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-slate-700">
                          ₹{item.unitPurchasePrice.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-slate-500">
                          {item.taxRate}%
                        </TableCell>
                        <TableCell>
                          <select
                            aria-label="Item Return Reason"
                            value={item.reason}
                            disabled={!item.selected}
                            onChange={(e) =>
                              handleUpdateItem(idx, "reason", e.target.value as PurchaseReturnReason)
                            }
                            className="h-7 text-[11px] rounded border border-slate-300 bg-white px-2 py-0.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
                          >
                            <option value="DEFECTIVE">Defective</option>
                            <option value="DAMAGED">Damaged</option>
                            <option value="WRONG_PRODUCT">Wrong Product</option>
                            <option value="EXPIRED">Expired</option>
                            <option value="QUALITY_REJECTED">Quality Rejected</option>
                            <option value="SUPPLIER_RECALL">Supplier Recall</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </TableCell>
                        <TableCell>
                          <select
                            aria-label="Item Condition"
                            value={item.condition}
                            disabled={!item.selected}
                            onChange={(e) =>
                              handleUpdateItem(idx, "condition", e.target.value as ReturnItemCondition)
                            }
                            className="h-7 text-[11px] rounded border border-slate-300 bg-white px-2 py-0.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
                          >
                            <option value="DEFECTIVE">Defective</option>
                            <option value="DAMAGED">Damaged</option>
                            <option value="SALEABLE">Saleable</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-slate-900">
                          ₹{item.selected ? lineTotal.toFixed(2) : "0.00"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Supplier Response & Settlement Card */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-white p-5 rounded-lg border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900">3. Supplier Settlement & Reason Details</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supplier Response Mode <span className="text-rose-500">*</span>
                </label>
                <select
                  aria-label="Supplier Response Mode"
                  value={supplierResponse}
                  onChange={(e) =>
                    setSupplierResponse(e.target.value as PurchaseReturnSupplierResponse)
                  }
                  className="w-full h-9 text-xs rounded-md border border-slate-300 bg-white px-3 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="CREDIT_NOTE_EXPECTED">Credit Note Expected</option>
                  <option value="REFUND_EXPECTED">Refund Expected</option>
                  <option value="REPLACEMENT_EXPECTED">Replacement Expected</option>
                  <option value="PENDING_CONFIRMATION">Pending Confirmation</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  General Return Reason
                </label>
                <select
                  aria-label="General Return Reason"
                  value={generalReason}
                  onChange={(e) => setGeneralReason(e.target.value as PurchaseReturnReason)}
                  className="w-full h-9 text-xs rounded-md border border-slate-300 bg-white px-3 py-1 text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                >
                  <option value="DEFECTIVE">Defective</option>
                  <option value="DAMAGED">Damaged</option>
                  <option value="WRONG_PRODUCT">Wrong Product</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="QUALITY_REJECTED">Quality Rejected</option>
                  <option value="SUPPLIER_RECALL">Supplier Recall</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supplier Credit Note Number (Optional)
                </label>
                <Input
                  placeholder="e.g. SCN-2026-091"
                  value={supplierCreditNoteNumber}
                  onChange={(e) => setSupplierCreditNoteNumber(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Credit Note Date (Optional)
                </label>
                <Input
                  type="date"
                  value={supplierCreditNoteDate}
                  onChange={(e) => setSupplierCreditNoteDate(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Remarks / Return Description
              </label>
              <textarea
                rows={2}
                placeholder="Add audit notes regarding returned goods, transporter details or supplier agreement..."
                value={generalRemarks}
                onChange={(e) => setGeneralRemarks(e.target.value)}
                className="w-full rounded-md border border-slate-300 p-2 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Financial summary card */}
          <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 shadow-sm space-y-3 flex flex-col justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 border-b border-slate-200 pb-2">
                Return Valuation
              </h2>
              <div className="space-y-2 pt-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Selected Items:</span>
                  <span className="font-semibold">{selectedItems.length} items</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Items Subtotal:</span>
                  <span className="font-mono">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Discount Deducted:</span>
                  <span className="font-mono">-₹{discountTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Estimated Tax:</span>
                  <span className="font-mono">+₹{taxTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-purple-700 pt-2 border-t border-slate-200">
                  <span>Total Return Value:</span>
                  <span className="font-mono">₹{returnTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-2">
              <Button
                className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs gap-1.5"
                disabled={submitting || selectedItems.length === 0}
                onClick={() => handleSubmit(true)}
              >
                <Send className="h-4 w-4" />
                Submit Return for Approval
              </Button>
              <Button
                variant="outline"
                className="w-full text-xs gap-1.5"
                disabled={submitting || selectedItems.length === 0}
                onClick={() => handleSubmit(false)}
              >
                <Save className="h-4 w-4" />
                Save as Draft
              </Button>
            </div>
          </div>
        </div>
      </div>
  );
}

