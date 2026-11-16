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
import type { IPurchase, PurchaseStatus } from "@/types/purchase";

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

  // Cancellation dialog state
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  // Amend dialog state
  const [isAmendOpen, setIsAmendOpen] = useState(false);
  const [amendReason, setAmendReason] = useState("");
  const [amendItems, setAmendItems] = useState<
    {
      productId: string;
      productName: string;
      primaryUnit: string;
      orderedQty: number;
      receivedQty: number;
      unitPurchasePrice: number;
      discountAmount: number;
      taxRate: number;
    }[]
  >([]);
  const [amending, setAmending] = useState(false);
  const [amendError, setAmendError] = useState("");

  // Status transition loading
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Fetch purchase details
  useEffect(() => {
    let ignore = false;
    async function loadPurchase() {
      setLoading(true);
      try {
        const res = await fetch(`/api/purchases/${id}`);
        if (!res.ok) throw new Error("Failed to load purchase order");
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

  function getStatusBadge(status: PurchaseStatus) {
    switch (status) {
      case "DRAFT":
        return <Badge variant="neutral" dot>Draft</Badge>;
      case "PENDING_RECEIPT":
        return <Badge variant="warning" dot>Pending Receipt</Badge>;
      case "PARTIALLY_RECEIVED":
        return <Badge variant="info" dot>Partially Received</Badge>;
      case "RECEIVED":
        return <Badge variant="success" dot>Received</Badge>;
      case "CANCELLED":
        return <Badge variant="danger" dot>Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  }

  // Handle Confirm Order (DRAFT -> PENDING_RECEIPT)
  async function handleConfirmOrder() {
    if (!purchase) return;
    const purchaseId = purchase.id || purchase._id;
    setUpdatingStatus(true);
    try {
      const res = await fetch(`/api/purchases/${purchaseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "PENDING_RECEIPT" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to confirm order");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error confirming purchase order");
    } finally {
      setUpdatingStatus(false);
    }
  }

  // Handle Cancellation
  async function handleConfirmCancel() {
    if (!purchase) return;
    const purchaseId = purchase.id || purchase._id;
    setCancelError("");
    setCancelling(true);
    try {
      const res = await fetch(`/api/purchases/${purchaseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel",
          reason: cancelReason.trim() || "Cancelled by user",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to cancel purchase");
      setIsCancelOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Failed to cancel purchase order");
    } finally {
      setCancelling(false);
    }
  }

  // Initialize Amend Modal
  function openAmendModal() {
    if (!purchase) return;
    setAmendReason("");
    setAmendError("");
    setAmendItems(
      purchase.items.map((it) => ({
        productId: it.productId,
        productName: it.productSnapshot?.name || "Product",
        primaryUnit: it.unit,
        orderedQty: it.orderedQty,
        receivedQty: it.receivedQty || 0,
        unitPurchasePrice: it.unitPurchasePrice,
        discountAmount: it.discountAmount || 0,
        taxRate: it.taxRate || 0,
      }))
    );
    setIsAmendOpen(true);
  }

  // Handle Amend Submission
  async function handleConfirmAmend() {
    if (!purchase) return;
    setAmendError("");

    if (!amendReason.trim() || amendReason.trim().length < 5) {
      setAmendError("Amendment reason must be at least 5 characters.");
      return;
    }

    // Verify quantity floor rule
    for (const it of amendItems) {
      if (it.orderedQty < it.receivedQty) {
        setAmendError(
          `Cannot reduce quantity of '${it.productName}' below received quantity (${it.receivedQty} ${it.primaryUnit}).`
        );
        return;
      }
      if (it.orderedQty <= 0) {
        setAmendError(`Ordered quantity for '${it.productName}' must be greater than zero.`);
        return;
      }
    }

    setAmending(true);
    try {
      const payload = {
        reason: amendReason.trim(),
        items: amendItems.map((it) => ({
          productId: it.productId,
          orderedQty: Number(it.orderedQty),
          unitPurchasePrice: Number(it.unitPurchasePrice),
          discountAmount: Number(it.discountAmount || 0),
          taxRate: Number(it.taxRate || 0),
        })),
      };

      const purchaseId = purchase.id || purchase._id;
      const res = await fetch(`/api/purchases/${purchaseId}/amend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to amend purchase order");

      setIsAmendOpen(false);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setAmendError(err instanceof Error ? err.message : "Failed to amend purchase order");
    } finally {
      setAmending(false);
    }
  }

  if (loading) {
    return (
      <Card className="p-16 text-center text-slate-400 max-w-5xl mx-auto">
        <Clock className="w-8 h-8 animate-spin mx-auto mb-2 text-[#176B3A]" />
        <p className="text-sm font-medium">Loading purchase order details...</p>
      </Card>
    );
  }

  if (error || !purchase) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Link href="/purchases">
          <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
            Back to Orders
          </Button>
        </Link>
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
          <p className="font-semibold">Unable to load purchase order</p>
          <p className="text-sm mt-1">{error || "Purchase order not found."}</p>
        </div>
      </div>
    );
  }

  const canCancel =
    purchase.status !== "CANCELLED" &&
    purchase.status !== "RECEIVED" &&
    purchase.receivedQty === 0;

  const canAmend =
    purchase.status === "PENDING_RECEIPT" || purchase.status === "PARTIALLY_RECEIVED";

  return (
    <div className="space-y-6 pb-16 max-w-6xl mx-auto">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/purchases">
            <Button variant="outline" size="sm" leftIcon={<ArrowLeft className="w-4 h-4" />}>
              Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {purchase.purchaseNumber}
              </h1>
              {getStatusBadge(purchase.status)}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Created on{" "}
              {new Date(purchase.createdAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {purchase.status === "DRAFT" && (
            <Button
              variant="primary"
              size="sm"
              loading={updatingStatus}
              onClick={handleConfirmOrder}
              leftIcon={<CheckCircle2 className="w-4 h-4" />}
            >
              Confirm Order
            </Button>
          )}

          {canAmend && (
            <Button
              variant="outline"
              size="sm"
              onClick={openAmendModal}
              leftIcon={<Edit3 className="w-4 h-4" />}
            >
              Amend Order
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
              Cancel Order
            </Button>
          )}
        </div>
      </div>

      {/* Supplier & Invoice Snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Supplier Snapshot */}
        <Card className="border border-slate-200/80 shadow-sm p-4 sm:p-5">
          <CardHeader className="p-0 pb-3 border-b border-slate-100 flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#176B3A]" />
              Supplier Information
            </CardTitle>
            <Badge variant="neutral" size="sm">Snapshot</Badge>
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
            {purchase.supplierSnapshot?.address && (
              <div className="pt-2 border-t border-slate-100 text-slate-500">
                <span>Address: </span>
                {[
                  purchase.supplierSnapshot.address.street,
                  purchase.supplierSnapshot.address.city,
                  purchase.supplierSnapshot.address.state,
                  purchase.supplierSnapshot.address.pincode,
                ]
                  .filter(Boolean)
                  .join(", ")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice & Order Details */}
        <Card className="border border-slate-200/80 shadow-sm p-4 sm:p-5">
          <CardHeader className="p-0 pb-3 border-b border-slate-100 flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#176B3A]" />
              Invoice & Order Particulars
            </CardTitle>
            <Badge variant="neutral" size="sm">Metadata</Badge>
          </CardHeader>
          <CardContent className="p-0 pt-3 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Supplier Invoice #:</span>
              <strong className="font-mono text-slate-800 text-sm">
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
              <span className="text-slate-500">Purchase Order Date:</span>
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
                <span className="font-medium text-slate-700 block mb-0.5">Notes:</span>
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
              Purchase Line Items
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Snapshot of products, ordered quantity, unit prices, and GST.
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
                <TableHead>Product</TableHead>
                <TableHead className="text-center">Ordered Qty</TableHead>
                <TableHead className="text-center">Received Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Tax (GST)</TableHead>
                <TableHead className="text-right">Line Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchase.items.map((item, idx) => (
                <TableRow key={idx} className="hover:bg-slate-50/50">
                  <TableCell className="text-slate-400 font-mono text-xs">{idx + 1}</TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-900">
                      {item.productSnapshot?.name || "Product"}
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
                        item.receivedQty > 0
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {item.receivedQty || 0} / {item.orderedQty}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-mono text-slate-800">
                    ₹{item.unitPurchasePrice.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-slate-600">
                    {item.discountAmount > 0 ? `-₹${item.discountAmount.toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-slate-600">
                    <div>₹{item.taxAmount.toFixed(2)}</div>
                    <div className="text-[10px] text-slate-400">({item.taxRate}%)</div>
                  </TableCell>
                  <TableCell className="text-right font-bold text-slate-900 font-mono">
                    ₹{item.lineTotal.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards View */}
        <div className="sm:hidden divide-y divide-slate-100">
          {purchase.items.map((item, idx) => (
            <div key={idx} className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-400 mr-2">#{idx + 1}</span>
                  <span className="font-semibold text-slate-900">
                    {item.productSnapshot?.name}
                  </span>
                  <p className="text-xs text-slate-400">
                    {item.productSnapshot?.brand} {item.productSnapshot?.sku ? `• ${item.productSnapshot.sku}` : ""}
                  </p>
                </div>
                <strong className="text-sm font-bold text-slate-900">
                  ₹{item.lineTotal.toFixed(2)}
                </strong>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 text-xs text-slate-600">
                <div>
                  <span className="text-slate-400 block text-[11px]">Ordered / Received:</span>
                  <span className="font-semibold text-slate-800">
                    {item.orderedQty} {item.unit} (In: {item.receivedQty || 0})
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Unit Price & GST:</span>
                  <span className="font-mono text-slate-800">
                    ₹{item.unitPurchasePrice} + {item.taxRate}% GST
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Financial Breakdown & Audit Footer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Amendments Log */}
        <Card className="border border-slate-200/80 shadow-sm p-4 sm:p-5">
          <CardHeader className="p-0 pb-3 border-b border-slate-100 flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-[#176B3A]" />
              Controlled Amendments Audit Trail
            </CardTitle>
            <Badge variant="neutral" size="sm">
              {purchase.amendments?.length || 0}
            </Badge>
          </CardHeader>
          <CardContent className="p-0 pt-3">
            {!purchase.amendments || purchase.amendments.length === 0 ? (
              <p className="text-xs text-slate-400 py-3">
                No amendments recorded for this purchase order. Order remains in its original confirmed state.
              </p>
            ) : (
              <div className="space-y-3">
                {purchase.amendments.map((am, index) => (
                  <div
                    key={index}
                    className="p-3 bg-slate-50 border border-slate-200/80 rounded-lg text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-semibold text-slate-800">
                      <span>Amendment #{index + 1}</span>
                      <span className="text-[11px] text-slate-400">
                        {new Date(am.amendedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-slate-600">
                      <strong>Reason: </strong>
                      {am.reason}
                    </p>
                    <div className="flex items-center justify-between text-slate-500 pt-1 border-t border-slate-200/60 mt-1">
                      <span>Previous Total: ₹{am.previousGrandTotal.toFixed(2)}</span>
                      <span className="font-semibold text-slate-900">
                        New Total: ₹{(am.revisedGrandTotal ?? am.newGrandTotal ?? 0).toFixed(2)}
                      </span>
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
              Financial Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 pt-3 space-y-2 text-xs sm:text-sm">
            <div className="flex items-center justify-between text-slate-600">
              <span>Taxable Subtotal:</span>
              <span className="font-semibold text-slate-800">
                ₹{purchase.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            {purchase.discountAmount > 0 && (
              <div className="flex items-center justify-between text-emerald-700">
                <span>Total Discount:</span>
                <span className="font-semibold">
                  -₹{purchase.discountAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-slate-600">
              <span>GST Tax Amount:</span>
              <span className="font-semibold text-slate-800">
                +₹{purchase.taxAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">Grand Total:</span>
              <span className="text-xl font-bold text-[#176B3A]">
                ₹{purchase.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="p-2.5 rounded bg-amber-50/80 border border-amber-200/60 text-[11px] text-amber-800 flex items-start gap-2 mt-2">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong>Zero Liability Invariant (Phase 5B):</strong> Supplier payable liability is NOT recognized until Goods Received Notes (GRN) are verified in Phase 5C.
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cancellation Dialog */}
      <Dialog
        open={isCancelOpen}
        onOpenChange={setIsCancelOpen}
        title="Cancel Purchase Order"
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to cancel purchase order <strong>{purchase.purchaseNumber}</strong>?
            This will mark the purchase order as CANCELLED.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cancellation Reason *
            </label>
            <Input
              placeholder="e.g. Supplier unable to fulfill order, duplicate entry..."
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

      {/* Amend Dialog */}
      <Dialog
        open={isAmendOpen}
        onOpenChange={setIsAmendOpen}
        title={`Amend Order: ${purchase.purchaseNumber}`}
        maxWidth="lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Controlled amendments allow revising ordered quantities and pricing. Any amendment is permanently logged in the audit trail.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Reason for Amendment * (Minimum 5 characters)
            </label>
            <Input
              placeholder="e.g. Supplier confirmed updated quantity of 120 Bags..."
              value={amendReason}
              onChange={(e) => setAmendReason(e.target.value)}
              className="text-sm"
            />
          </div>

          <div className="max-h-80 overflow-y-auto space-y-3 pr-1">
            {amendItems.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-800">
                    {idx + 1}. {item.productName}
                  </span>
                  {item.receivedQty > 0 && (
                    <Badge variant="warning" size="sm">
                      Received: {item.receivedQty} {item.primaryUnit} (Floor Limit)
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">
                      Ordered Qty ({item.primaryUnit})
                    </label>
                    <Input
                      type="number"
                      step="any"
                      min={item.receivedQty || 0.01}
                      value={item.orderedQty}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setAmendItems((prev) =>
                          prev.map((it, i) => (i === idx ? { ...it, orderedQty: val } : it))
                        );
                      }}
                      className="h-8 text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">
                      Unit Price (₹)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.unitPurchasePrice}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setAmendItems((prev) =>
                          prev.map((it, i) => (i === idx ? { ...it, unitPurchasePrice: val } : it))
                        );
                      }}
                      className="h-8 text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-500 mb-0.5">
                      Discount (₹)
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.discountAmount}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setAmendItems((prev) =>
                          prev.map((it, i) => (i === idx ? { ...it, discountAmount: val } : it))
                        );
                      }}
                      className="h-8 text-xs bg-white"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {amendError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700">
              {amendError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              variant="outline"
              size="sm"
              disabled={amending}
              onClick={() => setIsAmendOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              loading={amending}
              onClick={handleConfirmAmend}
            >
              Apply Amendment
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
