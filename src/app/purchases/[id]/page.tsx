"use client";

import * as React from "react";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Edit3,
  Ban,
  History,
  TrendingUp,
  Package,
  Layers,
  Info,
  CreditCard,
  Truck,
  Box,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import type { IPurchase, PurchaseStatus, PurchasePaymentStatus } from "@/types/purchase";

interface PageProps {
  params: Promise<{ id: string }>;
}

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export default function PurchaseDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = use(params);

  const [purchase, setPurchase] = useState<IPurchase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Inward Dialog state
  const [isInwardOpen, setIsInwardOpen] = useState(false);
  const [inwardNotes, setInwardNotes] = useState("");
  const [inwardItems, setInwardItems] = useState<
    {
      itemId?: string;
      productId?: string;
      productName: string;
      primaryUnit: string;
      orderedQty: number;
      alreadyReceivedQty: number;
      remainingQty: number;
      receivedQty: number;
      batches: {
        batchNumber: string;
        manufacturingDate?: string;
        expiryDate?: string;
        quantity: number;
      }[];
    }[]
  >([]);
  const [inwarding, setInwarding] = useState(false);
  const [inwardError, setInwardError] = useState("");

  // Cancellation dialog state
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  // Amend dialog state
  const [isAmendOpen, setIsAmendOpen] = useState(false);
  const [amendReason, setAmendReason] = useState("");
  const [amendItems, setAmendItems] = useState<any[]>([]);
  const [amending, setAmending] = useState(false);
  const [amendError, setAmendError] = useState("");

  // Fetch purchase details
  useEffect(() => {
    let ignore = false;
    async function loadPurchase() {
      setLoading(true);
      try {
        const res = await fetch(`/api/purchases/${id}`);
        if (!res.ok) throw new Error("Failed to load purchase bill");
        const json = await res.json();
        if (!ignore && json.success && json.data?.purchase) {
          setPurchase(json.data.purchase);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load purchase details");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadPurchase();
    return () => {
      ignore = true;
    };
  }, [id, refreshKey]);

  function getReceiptStatusBadge(status: PurchaseStatus) {
    switch (status) {
      case "DRAFT":
        return <Badge variant="neutral" dot>Draft</Badge>;
      case "PENDING_RECEIPT":
        return <Badge variant="warning" dot>Pending Goods</Badge>;
      case "PARTIALLY_RECEIVED":
        return <Badge variant="info" dot>Partially Received</Badge>;
      case "RECEIVED":
        return <Badge variant="success" dot>Fully Received</Badge>;
      case "CANCELLED":
        return <Badge variant="danger" dot>Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  }

  function getPaymentStatusBadge(status: PurchasePaymentStatus) {
    switch (status) {
      case "PAID":
        return <Badge variant="success" size="sm">PAID</Badge>;
      case "PARTIALLY_PAID":
        return <Badge variant="warning" size="sm">PARTIAL</Badge>;
      case "UNPAID":
        return <Badge variant="danger" size="sm">UNPAID</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  }

  // Open Inward Modal
  function openInwardModal() {
    if (!purchase) return;
    setInwardError("");
    setInwardNotes("");

    const initial = purchase.items.map((it) => {
      const remaining = Math.max(0, round2(it.orderedQty - (it.receivedQty || 0)));
      const idKey = it.id || (it as any)._id || "";
      const batchSuffix = String(it.productId || idKey || "001").slice(-3);
      return {
        itemId: idKey,
        productId: it.productId,
        productName: it.productSnapshot?.name || "Product",
        primaryUnit: it.unit,
        orderedQty: it.orderedQty,
        alreadyReceivedQty: it.receivedQty || 0,
        remainingQty: remaining,
        receivedQty: remaining, // default to receiving the rest
        batches: [
          {
            batchNumber: `BAT-${purchase.purchaseNumber.replace(/[^0-9]/g, "")}-${batchSuffix}`,
            quantity: remaining,
          },
        ],
      };
    });

    setInwardItems(initial);
    setIsInwardOpen(true);
  }

  // Handle Inward Submission
  async function handleConfirmInward() {
    if (!purchase) return;
    setInwardError("");

    const activeInwardItems = inwardItems.filter((it) => it.receivedQty > 0);
    if (activeInwardItems.length === 0) {
      setInwardError("Please specify a received quantity greater than 0 for at least one item.");
      return;
    }

    // Validate batch sums
    for (const it of activeInwardItems) {
      if (it.receivedQty > it.remainingQty) {
        setInwardError(
          `Received quantity (${it.receivedQty}) cannot exceed remaining ordered quantity (${it.remainingQty}) for '${it.productName}'.`
        );
        return;
      }

      let bSum = 0;
      for (const b of it.batches) {
        if (!b.batchNumber.trim()) {
          setInwardError(`Batch number is required for all inward batches of '${it.productName}'.`);
          return;
        }
        if (b.quantity <= 0) {
          setInwardError(`Batch quantity must be greater than 0 for batch '${b.batchNumber}'.`);
          return;
        }
        if (b.manufacturingDate && b.expiryDate) {
          if (new Date(b.manufacturingDate) > new Date(b.expiryDate)) {
            setInwardError(`Expiry date must be after manufacturing date for batch '${b.batchNumber}'.`);
            return;
          }
        }
        bSum += b.quantity;
      }

      if (round2(bSum) !== round2(it.receivedQty)) {
        setInwardError(
          `Sum of batch quantities (${bSum}) must equal received quantity (${it.receivedQty}) for '${it.productName}'.`
        );
        return;
      }
    }

    setInwarding(true);
    try {
      const payload = {
        notes: inwardNotes.trim() || undefined,
        items: activeInwardItems.map((it) => ({
          itemId: it.itemId,
          productId: it.productId || undefined,
          receivedQty: Number(it.receivedQty),
          batches: it.batches.map((b) => ({
            batchNumber: b.batchNumber.trim().toUpperCase(),
            manufacturingDate: b.manufacturingDate ? new Date(b.manufacturingDate).toISOString() : undefined,
            expiryDate: b.expiryDate ? new Date(b.expiryDate).toISOString() : undefined,
            quantity: Number(b.quantity),
          })),
        })),
      };

      const res = await fetch(`/api/purchases/${purchase.id || purchase._id}/inward`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to confirm stock inward");

      setIsInwardOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setInwardError(err instanceof Error ? err.message : "Failed to confirm stock inward");
    } finally {
      setInwarding(false);
    }
  }

  // Handle Cancellation
  async function handleConfirmCancel() {
    if (!purchase) return;
    setCancelError("");
    setCancelling(true);
    try {
      const purchaseId = purchase.id || purchase._id;
      const res = await fetch(`/api/purchases/${purchaseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          reason: cancelReason.trim() || "Cancelled by user",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to cancel purchase bill");
      setIsCancelOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Failed to cancel purchase bill");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return (
      <Card className="p-16 text-center text-slate-400 max-w-5xl mx-auto">
        <Clock className="w-8 h-8 animate-spin mx-auto mb-2 text-[#176B3A]" />
        <p className="text-sm font-medium">Loading purchase bill details...</p>
      </Card>
    );
  }

  if (error || !purchase) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Link href="/purchases">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back to Register
          </Button>
        </Link>
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
          <p className="font-semibold">Unable to load purchase bill</p>
          <p className="text-sm mt-1">{error || "Purchase bill not found."}</p>
        </div>
      </div>
    );
  }

  const canInward =
    purchase.status === "PENDING_RECEIPT" || purchase.status === "PARTIALLY_RECEIVED";

  const canCancel =
    purchase.status !== "CANCELLED" &&
    purchase.status !== "RECEIVED" &&
    (purchase.receivedQty || 0) === 0;

  return (
    <div className="space-y-6 pb-16 max-w-6xl mx-auto">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/purchases">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back to Register
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {purchase.purchaseNumber}
              </h1>
              {getReceiptStatusBadge(purchase.status)}
              {getPaymentStatusBadge(purchase.paymentStatus)}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Recorded on{" "}
              {new Date(purchase.purchaseDate || purchase.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {canInward && (
            <Button
              variant="primary"
              size="sm"
              onClick={openInwardModal}
              leftIcon={<Truck className="w-4 h-4" />}
            >
              Receive / Inward Stock
            </Button>
          )}

          {canCancel && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setCancelReason("");
                setCancelError("");
                setIsCancelOpen(true);
              }}
              leftIcon={<Ban className="w-4 h-4" />}
            >
              Cancel Bill
            </Button>
          )}
        </div>
      </div>

      {/* Supplier & Invoice Snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Supplier Details */}
        <Card className="border border-slate-200/80 shadow-sm p-4 sm:p-5">
          <CardHeader className="p-0 pb-3 border-b border-slate-100 flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#176B3A]" />
              Supplier Details
            </CardTitle>
            <Badge variant="neutral" size="sm">Registered Vendor</Badge>
          </CardHeader>
          <CardContent className="p-0 pt-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Supplier Name:</span>
              <strong className="text-slate-800 text-sm">
                {purchase.supplierSnapshot?.name || "Unknown"}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Contact Person:</span>
              <span className="text-slate-800 font-medium">
                {purchase.supplierSnapshot?.contactPerson || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Phone:</span>
              <span className="text-slate-800 font-medium">{purchase.supplierSnapshot?.phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">GSTIN:</span>
              <span className="font-mono font-medium text-slate-800">
                {purchase.supplierSnapshot?.gstin || "Unregistered"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Invoice Particulars */}
        <Card className="border border-slate-200/80 shadow-sm p-4 sm:p-5">
          <CardHeader className="p-0 pb-3 border-b border-slate-100 flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#176B3A]" />
              Supplier Invoice Particulars
            </CardTitle>
            <Badge variant="neutral" size="sm">Tax Invoice</Badge>
          </CardHeader>
          <CardContent className="p-0 pt-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Supplier Invoice #:</span>
              <strong className="font-mono text-slate-900 text-sm font-bold">
                {purchase.supplierInvoiceNumber}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Supplier Invoice Date:</span>
              <span className="text-slate-800 font-medium">
                {new Date(purchase.supplierInvoiceDate).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Purchase Entry Date:</span>
              <span className="text-slate-800 font-medium">
                {new Date(purchase.purchaseDate || purchase.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
            {purchase.notes && (
              <div className="pt-2 border-t border-slate-100 text-slate-600">
                <span className="font-medium text-slate-700 block mb-0.5">Remarks / LR #:</span>
                <p className="bg-slate-50 p-2 rounded text-slate-600 text-xs">{purchase.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Items Table */}
      <Card className="border border-slate-200/80 shadow-sm overflow-hidden">
        <CardHeader className="p-4 sm:p-5 border-b border-slate-100 flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-[#176B3A]" />
              Invoiced Products & Received Batches
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Breakdown of invoiced quantities, received quantities, cost prices, and batch details.
            </p>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {purchase.items.length} {purchase.items.length === 1 ? "Line Item" : "Line Items"}
          </span>
        </CardHeader>

        {/* Desktop Table View */}
        <div className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/80">
                <TableHead className="w-10">#</TableHead>
                <TableHead>Product / Brand</TableHead>
                <TableHead className="text-center">Invoiced Qty</TableHead>
                <TableHead className="text-center">Stock Inwarded</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Tax (GST)</TableHead>
                <TableHead className="text-right">Line Total</TableHead>
                <TableHead className="text-right">Recognized</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchase.items.map((item, idx) => (
                <TableRow key={idx} className="hover:bg-slate-50/50">
                  <TableCell className="text-slate-400 font-mono text-xs">{idx + 1}</TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-900 flex items-center gap-2">
                      <span>{item.productSnapshot?.name || "Product"}</span>
                      {item.isManualProduct && !item.saveToCatalogue && (
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-normal">
                          Purchase-only
                        </span>
                      )}
                      {item.isManualProduct && item.saveToCatalogue && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-normal">
                          Saved to Catalogue
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                      <span>Brand: {item.productSnapshot?.brand}</span>
                      {item.productSnapshot?.sku && (
                        <span>• SKU: {item.productSnapshot.sku}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-semibold text-slate-800">
                    {item.orderedQty} {item.unit}
                  </TableCell>
                  <TableCell className="text-center">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        item.receivedQty >= item.orderedQty
                          ? "bg-emerald-50 text-emerald-700"
                          : item.receivedQty > 0
                          ? "bg-sky-50 text-sky-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {item.receivedQty || 0} / {item.orderedQty} {item.unit}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-slate-800">
                    ₹{item.unitPurchasePrice.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-slate-600">
                    <div>₹{item.taxAmount.toFixed(2)}</div>
                    <div className="text-[10px] text-slate-400">({item.taxRate}%)</div>
                  </TableCell>
                  <TableCell className="text-right font-bold text-slate-900 font-mono">
                    ₹{item.lineTotal.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-emerald-700 font-mono">
                    ₹{(item.recognizedValue || 0).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Receipts History & Financial Totals */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Inward Receipts History */}
        <Card className="border border-slate-200/80 shadow-sm p-4 sm:p-5">
          <CardHeader className="p-0 pb-3 border-b border-slate-100 flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#176B3A]" />
              Stock Inward Receipts
            </CardTitle>
            <Badge variant="neutral" size="sm">
              {purchase.receipts?.length || 0} Receipts
            </Badge>
          </CardHeader>
          <CardContent className="p-0 pt-3">
            {!purchase.receipts || purchase.receipts.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">
                No stock inward confirmed yet. Goods are pending receipt.
              </p>
            ) : (
              <div className="space-y-3">
                {purchase.receipts.map((rec, index) => (
                  <div
                    key={index}
                    className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-800">
                      <span className="font-mono text-[#176B3A]">{rec.receiptNumber}</span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(rec.receiptDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="text-slate-600">
                      <strong>Received By: </strong> {rec.receivedByName}
                    </div>
                    {rec.notes && (
                      <p className="text-slate-500 italic">Notes: {rec.notes}</p>
                    )}
                    <div className="pt-1 border-t border-slate-200/60 flex items-center justify-between text-slate-700">
                      <span>Recognized Value:</span>
                      <strong className="text-emerald-700 font-mono">
                        +₹{rec.totalRecognizedValue.toFixed(2)}
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financial Totals */}
        <Card className="border border-slate-200/80 shadow-sm p-4 sm:p-5 bg-white">
          <CardHeader className="p-0 pb-3 border-b border-slate-100">
            <CardTitle className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Financial Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-3 space-y-2 text-xs sm:text-sm">
            <div className="flex items-center justify-between text-slate-600">
              <span>Invoice Total (Invoiced):</span>
              <span className="font-semibold text-slate-900">
                ₹{purchase.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between text-emerald-800 font-medium">
              <span>Recognized Value (Received):</span>
              <span className="font-bold">
                ₹{(purchase.recognizedInvoiceValue || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex items-center justify-between text-slate-600">
              <span>Amount Paid:</span>
              <span className="font-semibold text-emerald-700">
                ₹{(purchase.amountPaid || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">Net Outstanding:</span>
              <span className="text-xl font-bold text-amber-700">
                ₹{(purchase.outstandingAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-2.5 rounded bg-emerald-50 border border-emerald-200/60 text-[11px] text-emerald-800 flex items-start gap-2 mt-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Accurate Payable Recognition:</strong> Supplier payable is recognized in exact proportion to confirmed goods receipts, protecting against overpayment on unreceived goods.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Inward Confirmation Modal */}
      <Dialog
        open={isInwardOpen}
        onOpenChange={setIsInwardOpen}
        title={`Receive / Inward Stock: ${purchase.purchaseNumber}`}
        maxWidth="lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Confirm goods physically received into stock. This atomically updates product stock, batch inventories, and vendor payable balance.
          </p>

          <div className="max-h-96 overflow-y-auto space-y-4 pr-1">
            {inwardItems.map((item, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-sm">
                    {idx + 1}. {item.productName}
                  </span>
                  <Badge variant="neutral" size="sm">
                    Remaining: {item.remainingQty} {item.primaryUnit}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Received Quantity ({item.primaryUnit}) *
                    </label>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      max={item.remainingQty}
                      value={item.receivedQty}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setInwardItems((prev) =>
                          prev.map((it, i) =>
                            i === idx
                              ? {
                                  ...it,
                                  receivedQty: val,
                                  batches: it.batches.map((b, bI) =>
                                    bI === 0 ? { ...b, quantity: val } : b
                                  ),
                                }
                              : it
                          )
                        );
                      }}
                      className="h-8 text-xs bg-white font-bold"
                    />
                  </div>
                </div>

                {/* Batch entry */}
                <div className="p-2.5 bg-white rounded border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700 text-[11px] flex items-center gap-1">
                      <Box className="w-3 h-3 text-emerald-700" />
                      Batch Information
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setInwardItems((prev) =>
                          prev.map((it, i) =>
                            i === idx
                              ? {
                                  ...it,
                                  batches: [
                                    ...it.batches,
                                    {
                                      batchNumber: "",
                                      quantity: 0,
                                    },
                                  ],
                                }
                              : it
                          )
                        );
                      }}
                      className="text-[10px] text-[#176B3A] font-semibold hover:underline"
                    >
                      + Split Batch
                    </button>
                  </div>

                  {item.batches.map((b, bI) => (
                    <div key={bI} className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-center text-xs">
                      <div>
                        <Input
                          placeholder="Batch # *"
                          value={b.batchNumber}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInwardItems((prev) =>
                              prev.map((it, i) =>
                                i === idx
                                  ? {
                                      ...it,
                                      batches: it.batches.map((bat, batI) =>
                                        batI === bI ? { ...bat, batchNumber: val } : bat
                                      ),
                                    }
                                  : it
                              )
                            );
                          }}
                          className="h-8 text-xs uppercase font-mono bg-slate-50"
                        />
                      </div>
                      <div>
                        <Input
                          type="date"
                          title="Mfg Date"
                          value={b.manufacturingDate || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInwardItems((prev) =>
                              prev.map((it, i) =>
                                i === idx
                                  ? {
                                      ...it,
                                      batches: it.batches.map((bat, batI) =>
                                        batI === bI ? { ...bat, manufacturingDate: val } : bat
                                      ),
                                    }
                                  : it
                              )
                            );
                          }}
                          className="h-8 text-xs bg-slate-50"
                        />
                      </div>
                      <div>
                        <Input
                          type="date"
                          title="Expiry Date"
                          value={b.expiryDate || ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setInwardItems((prev) =>
                              prev.map((it, i) =>
                                i === idx
                                  ? {
                                      ...it,
                                      batches: it.batches.map((bat, batI) =>
                                        batI === bI ? { ...bat, expiryDate: val } : bat
                                      ),
                                    }
                                  : it
                              )
                            );
                          }}
                          className="h-8 text-xs bg-slate-50"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          step="any"
                          min="0.01"
                          placeholder="Batch Qty"
                          value={b.quantity}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setInwardItems((prev) =>
                              prev.map((it, i) =>
                                i === idx
                                  ? {
                                      ...it,
                                      batches: it.batches.map((bat, batI) =>
                                        batI === bI ? { ...bat, quantity: val } : bat
                                      ),
                                    }
                                  : it
                              )
                            );
                          }}
                          className="h-8 text-xs bg-slate-50 w-20"
                        />
                        {item.batches.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setInwardItems((prev) =>
                                prev.map((it, i) =>
                                  i === idx
                                    ? {
                                        ...it,
                                        batches: it.batches.filter((_, batI) => batI !== bI),
                                      }
                                    : it
                                )
                              );
                            }}
                            className="text-slate-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Receipt Remarks / Lorry LR Number (Optional)
            </label>
            <Input
              placeholder="e.g. Received via Transport Truck TN-45-1234, in good condition"
              value={inwardNotes}
              onChange={(e) => setInwardNotes(e.target.value)}
              className="text-xs"
            />
          </div>

          {inwardError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700">
              {inwardError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              disabled={inwarding}
              onClick={() => setIsInwardOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={inwarding}
              onClick={handleConfirmInward}
            >
              Confirm Inward Stock
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Cancellation Dialog */}
      <Dialog
        open={isCancelOpen}
        onOpenChange={setIsCancelOpen}
        title="Cancel Purchase Bill"
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to cancel purchase bill <strong>{purchase.purchaseNumber}</strong>?
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cancellation Reason *
            </label>
            <Input
              placeholder="Reason for cancellation..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="text-sm"
            />
          </div>

          {cancelError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700">
              {cancelError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              disabled={cancelling}
              onClick={() => setIsCancelOpen(false)}
            >
              Close
            </Button>
            <Button
              variant="destructive"
              size="sm"
              loading={cancelling}
              onClick={handleConfirmCancel}
            >
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
