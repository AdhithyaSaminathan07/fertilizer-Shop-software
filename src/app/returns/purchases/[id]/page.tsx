"use client";

import * as React from "react";
import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Truck,
  CheckCircle2,
  XCircle,
  Ban,
  Clock,
  Building2,
  Phone,
  Calendar,
  FileText,
  AlertTriangle,
  Info,
  ExternalLink,
} from "lucide-react";
import { ReturnsNav } from "@/components/returns/returns-nav";
import { ReturnActionDialog } from "@/components/returns/return-action-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { IPurchaseReturn, ReturnStatus, PurchaseReturnSupplierResponse } from "@/types/returns";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PurchaseReturnDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = use(params);

  const [purchaseReturn, setPurchaseReturn] = useState<IPurchaseReturn | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionDialog, setActionDialog] = useState<{
    open: boolean;
    action: "APPROVE" | "REJECT" | "CANCEL" | null;
  }>({
    open: false,
    action: null,
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let ignore = false;
    async function loadDetail() {
      try {
        const res = await fetch(`/api/purchase-returns/${id}`);
        const json = await res.json();
        if (!ignore && res.ok) {
          setPurchaseReturn(json.data);
          setError(null);
        } else if (!ignore) {
          setError(json.error?.message || json.message || "Failed to load purchase return details");
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load purchase return details");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadDetail();
    return () => {
      ignore = true;
    };
  }, [id, refreshTrigger]);

  const handleConfirmAction = async (reason?: string) => {
    if (!actionDialog.action || !purchaseReturn) return;
    const action = actionDialog.action;
    let url = "";
    if (action === "APPROVE") url = `/api/purchase-returns/${purchaseReturn._id}/approve`;
    else if (action === "REJECT") url = `/api/purchase-returns/${purchaseReturn._id}/reject`;
    else if (action === "CANCEL") url = `/api/purchase-returns/${purchaseReturn._id}/cancel`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });

    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error?.message || json.message || `Failed to ${action.toLowerCase()} return`);
    }

    setRefreshTrigger((k) => k + 1);
  };

  const getStatusBadge = (status: ReturnStatus) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Approved
          </span>
        );
      case "PENDING_APPROVAL":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="h-3.5 w-3.5" />
            Pending Approval
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            <XCircle className="h-3.5 w-3.5" />
            Rejected
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-300">
            <Ban className="h-3.5 w-3.5" />
            Cancelled
          </span>
        );
      case "DRAFT":
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Draft
          </span>
        );
    }
  };

  const formatSupplierResponse = (response: PurchaseReturnSupplierResponse) => {
    switch (response) {
      case "REFUND_EXPECTED":
        return "Refund Expected";
      case "CREDIT_NOTE_EXPECTED":
        return "Credit Note Expected";
      case "REPLACEMENT_EXPECTED":
        return "Replacement Expected";
      case "PENDING_CONFIRMATION":
        return "Pending Confirmation";
      case "OTHER":
      default:
        return "Other";
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-64" />
        </div>
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error || !purchaseReturn) {
    return (
      <div className="space-y-6">
        <Button variant="outline" size="sm" onClick={() => router.push("/returns/purchases")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Purchase Returns
        </Button>
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 space-y-2">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
            Failed to load return record
          </h2>
          <p className="text-sm">{error || "Supplier purchase return record not found."}</p>
        </div>
      </div>
    );
  }

  const canApproveOrReject =
    purchaseReturn.status === "PENDING_APPROVAL" || purchaseReturn.status === "DRAFT";
  const canCancel =
    purchaseReturn.status === "DRAFT" || purchaseReturn.status === "PENDING_APPROVAL";

  return (
    <div className="space-y-6">
      <ReturnsNav />

        {/* Top bar with back button and action buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/returns/purchases")}
              className="gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
                  {purchaseReturn.returnNumber}
                </h1>
                {getStatusBadge(purchaseReturn.status)}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Recorded on {new Date(purchaseReturn.returnDate).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })} • Created by {purchaseReturn.createdByName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {canApproveOrReject && (
              <>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                  onClick={() => setActionDialog({ open: true, action: "APPROVE" })}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve Return
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-rose-300 text-rose-700 hover:bg-rose-50 gap-1.5"
                  onClick={() => setActionDialog({ open: true, action: "REJECT" })}
                >
                  <XCircle className="h-4 w-4" />
                  Reject Return
                </Button>
              </>
            )}

            {canCancel && (
              <Button
                variant="outline"
                size="sm"
                className="border-slate-300 text-slate-700 hover:bg-slate-100 gap-1.5"
                onClick={() => setActionDialog({ open: true, action: "CANCEL" })}
              >
                <Ban className="h-4 w-4" />
                Cancel Return
              </Button>
            )}
          </div>
        </div>

        {/* Strict Module Independence Notice */}
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-900 flex items-start gap-2.5">
          <Info className="h-4 w-4 text-purple-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Independent Returns Architecture Notice:</span> This purchase return is an independent audit and settlement record. Approving or managing this return does NOT decrease product inventory or alter supplier balances, advances, or payment records.
          </div>
        </div>

        {/* Grid info cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Original Purchase Card */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center justify-between">
                <span>Original Purchase Order</span>
                <Link
                  href={`/purchases/${purchaseReturn.purchaseId}`}
                  className="text-xs text-purple-600 hover:underline flex items-center gap-1 font-normal"
                >
                  View PO <ExternalLink className="h-3 w-3" />
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">PO Number:</span>
                <span className="font-mono font-medium text-slate-900">{purchaseReturn.purchaseNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Supplier Inv #:</span>
                <span className="font-mono font-medium text-slate-800">
                  {purchaseReturn.supplierInvoiceNumber || "N/A"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Purchase Date:</span>
                <span className="text-slate-700 font-medium">
                  {new Date(purchaseReturn.purchaseDate).toLocaleDateString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">General Reason:</span>
                <span className="font-semibold text-slate-800">{purchaseReturn.generalReason || "DEFECTIVE"}</span>
              </div>
              {purchaseReturn.remarks && (
                <div className="mt-2 pt-2 border-t border-slate-100 text-slate-600 italic">
                  &ldquo;{purchaseReturn.remarks}&rdquo;
                </div>
              )}
            </CardContent>
          </Card>

          {/* Supplier Snapshot Card */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700">Supplier Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex items-center gap-2 py-1 text-slate-900 font-semibold text-sm">
                <Building2 className="h-4 w-4 text-purple-600" />
                {purchaseReturn.supplierSnapshot.name}
              </div>
              {purchaseReturn.supplierSnapshot.phone && (
                <div className="flex items-center gap-2 py-0.5 text-slate-600">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  {purchaseReturn.supplierSnapshot.phone}
                </div>
              )}
              {purchaseReturn.supplierSnapshot.gstin && (
                <div className="flex justify-between py-1 border-t border-slate-100 mt-2">
                  <span className="text-slate-500">GSTIN:</span>
                  <span className="font-mono">{purchaseReturn.supplierSnapshot.gstin}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Settlement & Response Card */}
          <Card className="border-slate-200 bg-slate-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-purple-600" />
                Return Valuation & Settlement
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Items Subtotal:</span>
                <span className="font-mono">₹{purchaseReturn.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Discount Deducted:</span>
                <span className="font-mono text-slate-600">-₹{purchaseReturn.discountTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Tax Component:</span>
                <span className="font-mono text-slate-600">+₹{purchaseReturn.taxTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-t border-slate-200 font-bold text-sm text-purple-700">
                <span>Net Return Total:</span>
                <span className="font-mono">₹{purchaseReturn.returnTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 pt-2 border-t border-slate-200 text-slate-600">
                <span>Expected Response:</span>
                <span className="font-semibold text-slate-800">
                  {formatSupplierResponse(purchaseReturn.supplierResponse)}
                </span>
              </div>
              {purchaseReturn.supplierCreditNoteNumber && (
                <div className="flex justify-between py-0.5 text-slate-600">
                  <span>Credit Note #:</span>
                  <span className="font-mono">{purchaseReturn.supplierCreditNoteNumber}</span>
                </div>
              )}
              {purchaseReturn.supplierCreditNoteDate && (
                <div className="flex justify-between py-0.5 text-slate-600">
                  <span>Credit Note Date:</span>
                  <span>{new Date(purchaseReturn.supplierCreditNoteDate).toLocaleDateString("en-IN")}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Returned Items Table */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-900">
              Returned Items ({purchaseReturn.items.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Product Details</TableHead>
                    <TableHead>Condition & Reason</TableHead>
                    <TableHead className="text-right">Purchased Qty</TableHead>
                    <TableHead className="text-right">Returned Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Line Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseReturn.items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="text-center font-mono text-xs text-slate-400">
                        {idx + 1}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-slate-900 text-xs sm:text-sm">
                          {item.productSnapshot.name}
                        </div>
                        <div className="text-xs text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                          <span>SKU: {item.productSnapshot.sku}</span>
                          {item.batchNumber && <span>• Batch: {item.batchNumber}</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-700 rounded border border-slate-200">
                            {item.condition}
                          </span>
                          <span className="px-2 py-0.5 text-[11px] font-medium bg-purple-50 text-purple-800 rounded border border-purple-200">
                            {item.reason}
                          </span>
                        </div>
                        {item.remarks && (
                          <p className="text-[11px] text-slate-500 italic mt-1">&ldquo;{item.remarks}&rdquo;</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-600">
                        {item.originalPurchasedQty} {item.productSnapshot.primaryUnit}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-purple-700">
                        {item.returnQty} {item.productSnapshot.primaryUnit}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-700">
                        ₹{item.unitPurchasePrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-600">
                        {item.taxRate}% (₹{item.taxAmount.toFixed(2)})
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-slate-900">
                        ₹{item.lineTotal.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Audit & Status History Card */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" />
              Status & Approval Audit Trail
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded border border-slate-200">
                <span className="text-slate-500 block">Created By:</span>
                <span className="font-semibold text-slate-900">{purchaseReturn.createdByName}</span>
                <span className="text-slate-400 block text-[11px] mt-0.5">
                  {new Date(purchaseReturn.createdAt).toLocaleString("en-IN")}
                </span>
              </div>

              {purchaseReturn.approvedByName && (
                <div className="p-3 bg-emerald-50 rounded border border-emerald-200">
                  <span className="text-emerald-700 font-semibold block">Approved By:</span>
                  <span className="font-semibold text-slate-900">{purchaseReturn.approvedByName}</span>
                  <span className="text-slate-500 block text-[11px] mt-0.5">
                    {purchaseReturn.approvedAt && new Date(purchaseReturn.approvedAt).toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              {purchaseReturn.rejectedByName && (
                <div className="p-3 bg-rose-50 rounded border border-rose-200">
                  <span className="text-rose-700 font-semibold block">Rejected By:</span>
                  <span className="font-semibold text-slate-900">{purchaseReturn.rejectedByName}</span>
                  <span className="text-slate-500 block text-[11px] mt-0.5">
                    {purchaseReturn.rejectedAt && new Date(purchaseReturn.rejectedAt).toLocaleString("en-IN")}
                  </span>
                  {purchaseReturn.rejectionReason && (
                    <p className="text-rose-800 text-[11px] mt-1 italic">
                      Reason: {purchaseReturn.rejectionReason}
                    </p>
                  )}
                </div>
              )}

              {purchaseReturn.cancelledByName && (
                <div className="p-3 bg-slate-100 rounded border border-slate-300">
                  <span className="text-slate-700 font-semibold block">Cancelled By:</span>
                  <span className="font-semibold text-slate-900">{purchaseReturn.cancelledByName}</span>
                  <span className="text-slate-500 block text-[11px] mt-0.5">
                    {purchaseReturn.cancelledAt && new Date(purchaseReturn.cancelledAt).toLocaleString("en-IN")}
                  </span>
                  {purchaseReturn.cancellationReason && (
                    <p className="text-slate-800 text-[11px] mt-1 italic">
                      Reason: {purchaseReturn.cancellationReason}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Timeline entries */}
            {purchaseReturn.statusHistory && purchaseReturn.statusHistory.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-xs font-semibold text-slate-600 mb-2">History Log</h4>
                <div className="space-y-2">
                  {purchaseReturn.statusHistory.map((entry, index) => (
                    <div
                      key={index}
                      className="flex items-start justify-between text-xs py-1 px-2.5 rounded bg-slate-50/70 border border-slate-100"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-800 font-mono">{entry.status}</span>
                        <span className="text-slate-500">by {entry.changedByName}</span>
                        {entry.reason && (
                          <span className="text-slate-600 italic">— &ldquo;{entry.reason}&rdquo;</span>
                        )}
                      </div>
                      <span className="text-slate-400 text-[11px] font-mono">
                        {new Date(entry.changedAt).toLocaleString("en-IN")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Dialog */}
        <ReturnActionDialog
          open={actionDialog.open}
          action={actionDialog.action}
          returnType="PURCHASE"
          returnNumber={purchaseReturn.returnNumber}
          onClose={() => setActionDialog({ open: false, action: null })}
          onConfirm={handleConfirmAction}
        />
      </div>
  );
}

