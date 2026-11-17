"use client";

import * as React from "react";
import { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Receipt,
  CheckCircle2,
  XCircle,
  Ban,
  Clock,
  User,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
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
import type { ISalesReturn, ReturnStatus } from "@/types/returns";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SalesReturnDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = use(params);

  const [salesReturn, setSalesReturn] = useState<ISalesReturn | null>(null);
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
        const res = await fetch(`/api/sales-returns/${id}`);
        const json = await res.json();
        if (!ignore && res.ok) {
          setSalesReturn(json.data);
          setError(null);
        } else if (!ignore) {
          setError(json.error?.message || json.message || "Failed to load sales return details");
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load sales return details");
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
    if (!actionDialog.action || !salesReturn) return;
    const action = actionDialog.action;
    let url = "";
    if (action === "APPROVE") url = `/api/sales-returns/${salesReturn._id}/approve`;
    else if (action === "REJECT") url = `/api/sales-returns/${salesReturn._id}/reject`;
    else if (action === "CANCEL") url = `/api/sales-returns/${salesReturn._id}/cancel`;

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

  if (error || !salesReturn) {
    return (
      <div className="space-y-6">
        <Button variant="outline" size="sm" onClick={() => router.push("/returns/sales")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Sales Returns
        </Button>
        <div className="p-6 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 space-y-2">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-600" />
            Failed to load return record
          </h2>
          <p className="text-sm">{error || "Sales return record not found."}</p>
        </div>
      </div>
    );
  }

  const canApproveOrReject =
    salesReturn.status === "PENDING_APPROVAL" || salesReturn.status === "DRAFT";
  const canCancel =
    salesReturn.status === "DRAFT" || salesReturn.status === "PENDING_APPROVAL";

  return (
    <div className="space-y-6">
      <ReturnsNav />

        {/* Top bar with back button and action buttons */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/returns/sales")}
              className="gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
                  {salesReturn.returnNumber}
                </h1>
                {getStatusBadge(salesReturn.status)}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Recorded on {new Date(salesReturn.returnDate).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })} • Created by {salesReturn.createdByName}
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
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800 flex items-start gap-2.5">
          <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Independent Returns Architecture Notice:</span> This sales return is maintained as an independent operational audit record. Approving or managing this return does not modify physical inventory quantities, customer khata balances, or cashbook ledgers.
          </div>
        </div>

        {/* Grid info cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Original Invoice Card */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center justify-between">
                <span>Original Sales Invoice</span>
                <Link
                  href={`/billing/${salesReturn.saleId}`}
                  className="text-xs text-emerald-600 hover:underline flex items-center gap-1 font-normal"
                >
                  View Bill <ExternalLink className="h-3 w-3" />
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Invoice No:</span>
                <span className="font-mono font-medium text-slate-900">{salesReturn.saleNumber}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Invoice Date:</span>
                <span className="text-slate-700 font-medium">
                  {new Date(salesReturn.saleDate).toLocaleDateString("en-IN")}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Reason:</span>
                <span className="font-semibold text-slate-800">{salesReturn.generalReason || "DAMAGED"}</span>
              </div>
              {salesReturn.remarks && (
                <div className="mt-2 pt-2 border-t border-slate-100 text-slate-600 italic">
                  &ldquo;{salesReturn.remarks}&rdquo;
                </div>
              )}
            </CardContent>
          </Card>

          {/* Customer Snapshot Card */}
          <Card className="border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700">Customer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex items-center gap-2 py-1 text-slate-900 font-semibold text-sm">
                <User className="h-4 w-4 text-slate-500" />
                {salesReturn.customerSnapshot.name}
              </div>
              {salesReturn.customerSnapshot.mobile && (
                <div className="flex items-center gap-2 py-0.5 text-slate-600">
                  <Phone className="h-3.5 w-3.5 text-slate-400" />
                  {salesReturn.customerSnapshot.mobile}
                </div>
              )}
              {salesReturn.customerSnapshot.village && (
                <div className="flex items-center gap-2 py-0.5 text-slate-600">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {salesReturn.customerSnapshot.village}
                </div>
              )}
              {salesReturn.customerSnapshot.gstin && (
                <div className="flex justify-between py-1 border-t border-slate-100 mt-2">
                  <span className="text-slate-500">GSTIN:</span>
                  <span className="font-mono">{salesReturn.customerSnapshot.gstin}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Refund Details Card */}
          <Card className="border-slate-200 bg-slate-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-emerald-600" />
                Refund Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Items Subtotal:</span>
                <span className="font-mono">₹{salesReturn.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Discount Deducted:</span>
                <span className="font-mono text-slate-600">-₹{salesReturn.discountTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Tax Refund:</span>
                <span className="font-mono text-slate-600">+₹{salesReturn.taxTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1.5 border-t border-slate-200 font-bold text-sm text-emerald-700">
                <span>Net Refund Total:</span>
                <span className="font-mono">₹{salesReturn.refundTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 pt-2 border-t border-slate-200 text-slate-600">
                <span>Refund Method:</span>
                <span className="font-semibold text-slate-800">{salesReturn.refundMethod}</span>
              </div>
              {salesReturn.refundReference && (
                <div className="flex justify-between py-0.5 text-slate-600">
                  <span>Reference:</span>
                  <span className="font-mono">{salesReturn.refundReference}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Returned Items Table */}
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-900">
              Returned Items ({salesReturn.items.length})
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
                    <TableHead className="text-right">Invoiced Qty</TableHead>
                    <TableHead className="text-right">Returned Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Tax</TableHead>
                    <TableHead className="text-right">Refund Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesReturn.items.map((item, idx) => (
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
                          {item.productSnapshot.hsnCode && (
                            <span>• HSN: {item.productSnapshot.hsnCode}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 text-[11px] font-semibold bg-slate-100 text-slate-700 rounded border border-slate-200">
                            {item.condition}
                          </span>
                          <span className="px-2 py-0.5 text-[11px] font-medium bg-amber-50 text-amber-800 rounded border border-amber-200">
                            {item.reason}
                          </span>
                        </div>
                        {item.remarks && (
                          <p className="text-[11px] text-slate-500 italic mt-1">&ldquo;{item.remarks}&rdquo;</p>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-600">
                        {item.originalSoldQty} {item.productSnapshot.primaryUnit}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-emerald-700">
                        {item.returnQty} {item.productSnapshot.primaryUnit}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-700">
                        ₹{item.unitSellingPrice.toFixed(2)}
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
                <span className="font-semibold text-slate-900">{salesReturn.createdByName}</span>
                <span className="text-slate-400 block text-[11px] mt-0.5">
                  {new Date(salesReturn.createdAt).toLocaleString("en-IN")}
                </span>
              </div>

              {salesReturn.approvedByName && (
                <div className="p-3 bg-emerald-50 rounded border border-emerald-200">
                  <span className="text-emerald-700 font-semibold block">Approved By:</span>
                  <span className="font-semibold text-slate-900">{salesReturn.approvedByName}</span>
                  <span className="text-slate-500 block text-[11px] mt-0.5">
                    {salesReturn.approvedAt && new Date(salesReturn.approvedAt).toLocaleString("en-IN")}
                  </span>
                </div>
              )}

              {salesReturn.rejectedByName && (
                <div className="p-3 bg-rose-50 rounded border border-rose-200">
                  <span className="text-rose-700 font-semibold block">Rejected By:</span>
                  <span className="font-semibold text-slate-900">{salesReturn.rejectedByName}</span>
                  <span className="text-slate-500 block text-[11px] mt-0.5">
                    {salesReturn.rejectedAt && new Date(salesReturn.rejectedAt).toLocaleString("en-IN")}
                  </span>
                  {salesReturn.rejectionReason && (
                    <p className="text-rose-800 text-[11px] mt-1 italic">
                      Reason: {salesReturn.rejectionReason}
                    </p>
                  )}
                </div>
              )}

              {salesReturn.cancelledByName && (
                <div className="p-3 bg-slate-100 rounded border border-slate-300">
                  <span className="text-slate-700 font-semibold block">Cancelled By:</span>
                  <span className="font-semibold text-slate-900">{salesReturn.cancelledByName}</span>
                  <span className="text-slate-500 block text-[11px] mt-0.5">
                    {salesReturn.cancelledAt && new Date(salesReturn.cancelledAt).toLocaleString("en-IN")}
                  </span>
                  {salesReturn.cancellationReason && (
                    <p className="text-slate-800 text-[11px] mt-1 italic">
                      Reason: {salesReturn.cancellationReason}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Timeline entries */}
            {salesReturn.statusHistory && salesReturn.statusHistory.length > 0 && (
              <div className="pt-2 border-t border-slate-100">
                <h4 className="text-xs font-semibold text-slate-600 mb-2">History Log</h4>
                <div className="space-y-2">
                  {salesReturn.statusHistory.map((entry, index) => (
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
          returnType="SALES"
          returnNumber={salesReturn.returnNumber}
          onClose={() => setActionDialog({ open: false, action: null })}
          onConfirm={handleConfirmAction}
        />
      </div>
  );
}

