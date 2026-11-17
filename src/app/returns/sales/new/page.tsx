"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Receipt,
  ArrowLeft,
  Search,
  CheckCircle2,
  AlertCircle,
  Save,
  Send,
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
  SalesReturnReason,
  ReturnItemCondition,
  SalesReturnRefundMethod,
} from "@/types/returns";

interface ReturnItemState {
  productId: string;
  productName: string;
  sku: string;
  primaryUnit: string;
  batchNumber?: string;
  soldQuantity: number;
  previouslyReturnedQuantity: number;
  availableToReturn: number;
  unitSellingPrice: number;
  discountAmount: number;
  taxRate: number;
  selected: boolean;
  returnQty: number;
  reason: SalesReturnReason;
  condition: ReturnItemCondition;
  remarks: string;
}

export default function NewSalesReturnPage() {
  const router = useRouter();

  const [sales, setSales] = React.useState<Array<{ _id: string; saleNumber: string; customerSnapshot?: { name: string }; grandTotal: number; saleDate?: string; createdAt: string }>>([]);
  const [selectedSaleId, setSelectedSaleId] = React.useState("");
  const [saleDetails, setSaleDetails] = React.useState<any | null>(null);
  const [returnItems, setReturnItems] = React.useState<ReturnItemState[]>([]);

  const [refundMethod, setRefundMethod] = React.useState<SalesReturnRefundMethod>("CASH");
  const [refundReference, setRefundReference] = React.useState("");
  const [generalReason, setGeneralReason] = React.useState<SalesReturnReason>("DAMAGED");
  const [generalRemarks, setGeneralRemarks] = React.useState("");

  const [loadingSales, setLoadingSales] = React.useState(true);
  const [loadingLookup, setLoadingLookup] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Load sales list for selection
  React.useEffect(() => {
    let ignore = false;
    async function fetchSalesList() {
      try {
        const res = await fetch("/api/sales?limit=50&status=COMPLETED");
        const json = await res.json();
        if (!ignore && res.ok) {
          const list = json.data?.sales || json.sales || [];
          setSales(list);
          if (list.length > 0 && !selectedSaleId) {
            setSelectedSaleId(list[0]._id);
          }
        }
      } catch {} finally {
        if (!ignore) setLoadingSales(false);
      }
    }
    fetchSalesList();
    return () => {
      ignore = true;
    };
  }, [selectedSaleId]);

  // Fetch sale lookup details when selectedSaleId changes
  React.useEffect(() => {
    if (!selectedSaleId) return;

    let ignore = false;
    async function loadSaleLookup() {
      setLoadingLookup(true);
      setError(null);
      try {
        const res = await fetch(`/api/sales-returns/lookup/${selectedSaleId}`);
        const json = await res.json();
        if (!ignore && res.ok) {
          const data = json.data;
          setSaleDetails(data);
          const mappedItems: ReturnItemState[] = (data.items || []).map((it: any) => ({
            productId: it.productId,
            productName: it.productSnapshot?.name || "Product",
            sku: it.productSnapshot?.sku || "",
            primaryUnit: it.productSnapshot?.primaryUnit || "PCS",
            batchNumber: it.batchNumber,
            soldQuantity: it.soldQuantity,
            previouslyReturnedQuantity: it.previouslyReturnedQuantity,
            availableToReturn: it.availableToReturn,
            unitSellingPrice: it.unitSellingPrice,
            discountAmount: it.discountAmount,
            taxRate: it.taxRate,
            selected: it.availableToReturn > 0,
            returnQty: it.availableToReturn > 0 ? 1 : 0,
            reason: "DAMAGED",
            condition: "SALEABLE",
            remarks: "",
          }));
          setReturnItems(mappedItems);
        } else if (!ignore) {
          setError(json.error?.message || json.message || "Failed to load sale details");
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load sale details");
        }
      } finally {
        if (!ignore) setLoadingLookup(false);
      }
    }

    loadSaleLookup();
    return () => {
      ignore = true;
    };
  }, [selectedSaleId]);

  const toggleItemSelection = (index: number) => {
    setReturnItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item))
    );
  };

  const updateItemField = (index: number, field: keyof ReturnItemState, val: any) => {
    setReturnItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: val } : item))
    );
  };

  // Calculations
  const selectedItems = returnItems.filter((it) => it.selected && it.returnQty > 0);
  let computedSubtotal = 0;
  let computedDiscount = 0;
  let computedTax = 0;
  let computedRefundTotal = 0;

  selectedItems.forEach((it) => {
    const gross = Math.round(it.returnQty * it.unitSellingPrice * 100) / 100;
    const unitDiscount = it.soldQuantity > 0 ? it.discountAmount / it.soldQuantity : 0;
    const disc = Math.round(unitDiscount * it.returnQty * 100) / 100;
    const taxable = Math.max(0, gross - disc);
    const tax = Math.round(((taxable * it.taxRate) / 100) * 100) / 100;
    const lineTotal = Math.round((taxable + tax) * 100) / 100;

    computedSubtotal += gross;
    computedDiscount += disc;
    computedTax += tax;
    computedRefundTotal += lineTotal;
  });

  const handleSubmit = async (submitForApproval: boolean) => {
    setError(null);

    if (selectedItems.length === 0) {
      setError("Please select at least one item to return with quantity greater than 0");
      return;
    }

    // Check bounds
    for (const it of selectedItems) {
      if (it.returnQty > it.availableToReturn) {
        setError(
          `Return quantity (${it.returnQty}) for '${it.productName}' exceeds available returnable quantity (${it.availableToReturn})`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        saleId: selectedSaleId,
        submitForApproval,
        refundMethod,
        refundReference: refundReference.trim() || undefined,
        generalReason,
        remarks: generalRemarks.trim() || undefined,
        items: selectedItems.map((it) => ({
          productId: it.productId,
          batchNumber: it.batchNumber || undefined,
          returnQty: it.returnQty,
          reason: it.reason,
          condition: it.condition,
          remarks: it.remarks.trim() || undefined,
        })),
      };

      const res = await fetch("/api/sales-returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.message || "Failed to create sales return");
      }

      const createdId = data.data?.salesReturn?._id || data.data?.salesReturn?.id;
      router.push(`/returns/sales/${createdId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create sales return");
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
        <div className="flex items-center justify-between pb-2">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/returns/sales")}
              className="h-8 w-8 p-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <Receipt className="h-5 w-5 text-emerald-600" />
                Initiate Customer Sales Return
              </h1>
              <p className="text-xs text-slate-500">
                Select an original invoice, return quantities and refund method
              </p>
            </div>
          </div>
        </div>

        {/* Tab Subnavigation */}
        <ReturnsNav />

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-rose-600 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {/* Step 1: Select Original Sale Invoice */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
            1. Select Original Sales Invoice
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Sales Invoice <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedSaleId}
                onChange={(e) => setSelectedSaleId(e.target.value)}
                disabled={loadingSales || loadingLookup}
                className="w-full text-sm border border-slate-300 rounded-md p-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                {sales.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.saleNumber} — {s.customerSnapshot?.name || "Customer"} (₹
                    {s.grandTotal.toLocaleString("en-IN")})
                  </option>
                ))}
              </select>
            </div>

            {saleDetails && (
              <div className="bg-slate-50 border border-slate-200 rounded-md p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Customer:</span>
                  <span className="font-bold text-slate-900">
                    {saleDetails.customerSnapshot?.name || "Walk-in Customer"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phone / Village:</span>
                  <span className="text-slate-700">
                    {saleDetails.customerSnapshot?.mobile || "N/A"}{" "}
                    {saleDetails.customerSnapshot?.village
                      ? `(${saleDetails.customerSnapshot.village})`
                      : ""}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Bill Date:</span>
                  <span className="text-slate-700">
                    {new Date(saleDetails.saleDate).toLocaleDateString("en-IN")}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Return Items Selection */}
        {saleDetails && (
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  2. Select Items to Return
                </h2>
                <p className="text-xs text-slate-500">
                  Select returned items and specify return quantities within available limits
                </p>
              </div>
              <span className="text-xs font-semibold text-emerald-700">
                {selectedItems.length} items selected
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <Table>
                <TableHeader className="bg-slate-50/75">
                  <TableRow>
                    <TableHead className="w-10 text-center">Select</TableHead>
                    <TableHead className="w-48">Product & SKU</TableHead>
                    <TableHead className="w-24 text-right">Sold Qty</TableHead>
                    <TableHead className="w-24 text-right">Prev Return</TableHead>
                    <TableHead className="w-24 text-right">Available</TableHead>
                    <TableHead className="w-28 text-center">Return Qty</TableHead>
                    <TableHead className="w-36">Return Reason</TableHead>
                    <TableHead className="w-28">Condition</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returnItems.map((item, idx) => {
                    const isFullyReturned = item.availableToReturn <= 0;
                    return (
                      <TableRow
                        key={`${item.productId}-${idx}`}
                        className={isFullyReturned ? "bg-slate-50/50 opacity-60" : ""}
                      >
                        <TableCell className="text-center">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            disabled={isFullyReturned}
                            onChange={() => toggleItemSelection(idx)}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-xs text-slate-900">
                            {item.productName}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {item.sku}{" "}
                            {item.batchNumber && (
                              <span className="bg-slate-100 text-slate-700 px-1 rounded ml-1">
                                {item.batchNumber}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-slate-800">
                          {item.soldQuantity} {item.primaryUnit}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs text-slate-500">
                          {item.previouslyReturnedQuantity} {item.primaryUnit}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs font-bold text-emerald-700">
                          {item.availableToReturn} {item.primaryUnit}
                        </TableCell>
                        <TableCell className="text-center">
                          <Input
                            type="number"
                            step="any"
                            min="0.001"
                            max={item.availableToReturn}
                            value={item.returnQty}
                            disabled={!item.selected || isFullyReturned}
                            onChange={(e) =>
                              updateItemField(
                                idx,
                                "returnQty",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-24 mx-auto text-xs text-center font-bold"
                          />
                        </TableCell>
                        <TableCell>
                          <select
                            value={item.reason}
                            disabled={!item.selected || isFullyReturned}
                            onChange={(e) => updateItemField(idx, "reason", e.target.value)}
                            className="w-full text-xs border border-slate-300 rounded p-1.5 bg-white"
                          >
                            <option value="DAMAGED">Damaged</option>
                            <option value="DEFECTIVE">Defective</option>
                            <option value="WRONG_PRODUCT">Wrong Product</option>
                            <option value="EXPIRED">Expired</option>
                            <option value="CUSTOMER_CHANGED_MIND">Customer Changed Mind</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </TableCell>
                        <TableCell>
                          <select
                            value={item.condition}
                            disabled={!item.selected || isFullyReturned}
                            onChange={(e) => updateItemField(idx, "condition", e.target.value)}
                            className="w-full text-xs border border-slate-300 rounded p-1.5 bg-white"
                          >
                            <option value="SALEABLE">Saleable</option>
                            <option value="DAMAGED">Damaged</option>
                            <option value="DEFECTIVE">Defective</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Step 3: Refund Details & Calculation */}
        {saleDetails && (
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              3. Refund Details & Settlement Method
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Refund Method <span className="text-rose-500">*</span>
                </label>
                <select
                  value={refundMethod}
                  onChange={(e) => setRefundMethod(e.target.value as any)}
                  className="w-full text-sm border border-slate-300 rounded-md p-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="CASH">Cash Refund</option>
                  <option value="UPI">UPI Transfer</option>
                  <option value="BANK_TRANSFER">Bank Transfer (NEFT/IMPS)</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="CREDIT_NOTE">Store Credit Note</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Refund / Transaction Reference
                </label>
                <Input
                  value={refundReference}
                  onChange={(e) => setRefundReference(e.target.value)}
                  placeholder="e.g. UPI Ref / Cheque No / Credit Note No"
                  className="text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Return Reason
                </label>
                <select
                  value={generalReason}
                  onChange={(e) => setGeneralReason(e.target.value as any)}
                  className="w-full text-sm border border-slate-300 rounded-md p-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="DAMAGED">Damaged Goods</option>
                  <option value="DEFECTIVE">Defective / Quality Issue</option>
                  <option value="WRONG_PRODUCT">Wrong Item Delivered</option>
                  <option value="EXPIRED">Expired Stock</option>
                  <option value="CUSTOMER_CHANGED_MIND">Customer Changed Mind</option>
                  <option value="OTHER">Other Reason</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Additional Remarks
              </label>
              <textarea
                value={generalRemarks}
                onChange={(e) => setGeneralRemarks(e.target.value)}
                rows={2}
                placeholder="Optional audit notes regarding customer return..."
                className="w-full text-sm border border-slate-300 rounded-md p-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Financial Summary Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Gross Returned Value:</span>
                <span className="font-mono">₹{computedSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Prorated Discount Reversed:</span>
                <span className="font-mono text-rose-600">-₹{computedDiscount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>GST Tax Value:</span>
                <span className="font-mono">₹{computedTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Net Refund Total:</span>
                <span className="font-mono text-emerald-700">₹{computedRefundTotal.toFixed(2)}</span>
              </div>
            </div>

            {/* Submit Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/returns/sales")}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSubmit(false)}
                disabled={submitting || selectedItems.length === 0}
                className="gap-1.5"
              >
                <Save className="h-4 w-4" />
                {submitting ? "Saving..." : "Save as Draft"}
              </Button>
              <Button
                size="sm"
                onClick={() => handleSubmit(true)}
                disabled={submitting || selectedItems.length === 0}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Send className="h-4 w-4" />
                {submitting ? "Submitting..." : "Submit for Approval"}
              </Button>
            </div>
          </div>
        )}
      </div>
  );
}

