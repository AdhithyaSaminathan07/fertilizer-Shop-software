"use client";

import * as React from "react";
import { useState } from "react";
import {
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Receipt,
  RotateCcw,
  Clock,
  ShieldAlert,
  ArrowRight,
  FileText,
  User,
  Calendar,
  Sparkles,
  Info,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { ISupplierPayment } from "@/types/supplier-payment";

interface PaymentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: ISupplierPayment | null;
  onSuccess: () => void;
}

function formatINR(val: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(val || 0);
}

function formatDate(dateVal: string | Date | undefined): string {
  if (!dateVal) return "—";
  return new Date(dateVal).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(dateVal: string | Date | undefined): string {
  if (!dateVal) return "—";
  return new Date(dateVal).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PaymentDetailsDialog({
  open,
  onOpenChange,
  payment,
  onSuccess,
}: PaymentDetailsDialogProps) {
  const [isReversing, setIsReversing] = useState(false);
  const [reversalReason, setReversalReason] = useState("");
  const [submittingReversal, setSubmittingReversal] = useState(false);
  const [reversalError, setReversalError] = useState("");

  if (!payment) return null;

  const totalAllocated = (payment.allocations || []).reduce(
    (sum, a) => sum + (a.allocatedAmount || 0),
    0
  );
  const advanceConsumed = payment.advanceConsumed || 0;
  const isConsumed = advanceConsumed > 0.001;
  const isReversed = payment.status === "REVERSED";

  const handleStartReversal = () => {
    setReversalError("");
    setReversalReason("");
    setIsReversing(true);
  };

  const handleCancelReversal = () => {
    setIsReversing(false);
    setReversalError("");
    setReversalReason("");
  };

  const handleConfirmReversal = async (e: React.FormEvent) => {
    e.preventDefault();
    setReversalError("");

    if (!reversalReason.trim() || reversalReason.trim().length < 3) {
      setReversalError("Please provide a valid reversal reason (minimum 3 characters).");
      return;
    }

    setSubmittingReversal(true);
    try {
      const res = await fetch(`/api/supplier-payments/${payment.id || payment._id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ reason: reversalReason.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || "Failed to reverse payment voucher");
      }

      setIsReversing(false);
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setReversalError(err instanceof Error ? err.message : "Failed to reverse payment");
    } finally {
      setSubmittingReversal(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-2">
          <span>Payment Voucher: {payment.paymentNumber}</span>
          <Badge
            variant={isReversed ? "danger" : "success"}
            size="sm"
          >
            {payment.status}
          </Badge>
        </div>
      }
      description={`Vendor settlement issued to ${payment.supplierSnapshot?.name || "Supplier"}.`}
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Excess Upfront Credit Notice Banner */}
        {payment.isExcessUpfrontCredit && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 text-xs text-indigo-900">
            <div className="flex items-center gap-2 font-bold text-indigo-950 mb-1">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              <span>Purchase Upfront Excess Credit</span>
            </div>
            <p className="text-indigo-800">
              This record was automatically registered when an upfront payment on a purchase bill exceeded the value of inwarded goods. It represents available supplier advance credit, not a separate cash disbursement.
            </p>
          </div>
        )}

        {/* Reversal Banner if Reversed */}
        {isReversed && payment.reversal && (
          <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-900 space-y-1">
            <div className="flex items-center gap-2 font-bold text-rose-950">
              <ShieldAlert className="h-4 w-4 text-rose-600" />
              <span>Payment Reversal Audit Trail</span>
            </div>
            <p className="text-rose-800">
              <strong>Reason:</strong> {payment.reversal.reason}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-rose-700 pt-1 border-t border-rose-200/60">
              <span>Reversed By: <strong>{payment.reversal.reversedByName}</strong></span>
              <span>Reversed On: {formatDateTime(payment.reversal.reversedAt)}</span>
            </div>
          </div>
        )}

        {/* Core Financial Snapshot */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <span className="text-[11px] text-slate-500 font-medium block">Total Voucher</span>
            <strong className="text-base font-bold text-slate-900">
              {formatINR(payment.amount)}
            </strong>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <span className="text-[11px] text-slate-500 font-medium block">Allocated</span>
            <strong className="text-base font-bold text-[#176B3A]">
              {formatINR(totalAllocated)}
            </strong>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <span className="text-[11px] text-slate-500 font-medium block">Unallocated Advance</span>
            <strong className="text-base font-bold text-amber-700">
              {formatINR(payment.unallocatedAmount || 0)}
            </strong>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <span className="text-[11px] text-slate-500 font-medium block">Available Advance</span>
            <strong className="text-base font-bold text-emerald-700">
              {formatINR(payment.advanceRemaining || 0)}
            </strong>
          </div>
        </div>

        {/* Voucher Particulars */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5 text-xs">
          <h4 className="font-bold uppercase tracking-wider text-slate-800 text-[11px] mb-2">
            Voucher Particulars
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-700">
            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span className="text-slate-500">Payment Date:</span>
              <strong className="text-slate-800">{formatDate(payment.paymentDate)}</strong>
            </div>

            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span className="text-slate-500">Payment Method:</span>
              <Badge variant="neutral" size="sm">{payment.paymentMethod}</Badge>
            </div>

            {payment.paymentReference && (
              <div className="flex justify-between border-b border-slate-100 pb-1.5">
                <span className="text-slate-500">Reference / UTR / Cheque:</span>
                <span className="font-mono font-medium text-slate-800">{payment.paymentReference}</span>
              </div>
            )}

            <div className="flex justify-between border-b border-slate-100 pb-1.5">
              <span className="text-slate-500">Recorded By:</span>
              <span className="font-medium text-slate-800">{payment.createdByName}</span>
            </div>

            <div className="flex justify-between border-b border-slate-100 pb-1.5 sm:col-span-2">
              <span className="text-slate-500">Recorded At:</span>
              <span className="text-slate-600">{formatDateTime(payment.createdAt)}</span>
            </div>
          </div>

          {payment.notes && (
            <div className="pt-2 border-t border-slate-100">
              <span className="text-[11px] font-semibold text-slate-500 block mb-0.5">Remarks / Notes:</span>
              <p className="bg-slate-50 p-2 rounded text-slate-700 text-xs">{payment.notes}</p>
            </div>
          )}
        </div>

        {/* Invoice Allocations */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Receipt className="h-3.5 w-3.5 text-[#176B3A]" />
            Settled Purchase Invoices ({payment.allocations?.length || 0})
          </h4>

          {!payment.allocations || payment.allocations.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-center text-xs text-slate-500">
              No purchase invoices were allocated to this voucher. This payment was retained 100% as a supplier advance.
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                  <tr>
                    <th className="p-2.5">Purchase Order #</th>
                    <th className="p-2.5">Supplier Invoice #</th>
                    <th className="p-2.5 text-right">Settled Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payment.allocations.map((alloc, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/60">
                      <td className="p-2.5 font-semibold text-[#176B3A]">
                        {alloc.purchaseNumber}
                      </td>
                      <td className="p-2.5 font-mono text-slate-800">
                        {alloc.supplierInvoiceNumber}
                      </td>
                      <td className="p-2.5 text-right font-bold text-slate-900 font-mono">
                        {formatINR(alloc.allocatedAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Advance Provenance & Absorption Tracking */}
        {payment.unallocatedAmount > 0 && (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 text-xs">
            <h4 className="font-bold uppercase tracking-wider text-slate-800 text-[11px] flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-emerald-700" />
              Advance Provenance & Consumption History
            </h4>

            <div className="grid grid-cols-2 gap-3 bg-white p-2.5 rounded-lg border border-slate-200/80">
              <div>
                <span className="text-[11px] text-slate-500 block">Initial Advance Created:</span>
                <strong className="text-slate-800 font-bold">{formatINR(payment.unallocatedAmount)}</strong>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Consumed by Purchases:</span>
                <strong className={isConsumed ? "text-amber-700 font-bold" : "text-slate-700 font-bold"}>
                  {formatINR(payment.advanceConsumed || 0)}
                </strong>
              </div>
            </div>

            {payment.advanceAdjustments && payment.advanceAdjustments.length > 0 ? (
              <div className="mt-2 space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-600 block">
                  Absorbed Against Destination Purchase Invoices:
                </span>
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                  {payment.advanceAdjustments.map((adj, i) => (
                    <div key={i} className="flex items-center justify-between p-2 text-xs">
                      <div>
                        <span className="font-semibold text-slate-800">{adj.purchaseNumber}</span>
                        {adj.supplierInvoiceNumber && (
                          <span className="font-mono text-[11px] text-slate-500 ml-2">
                            (Inv: {adj.supplierInvoiceNumber})
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 block">
                          Absorbed on {formatDate(adj.adjustedAt)}
                        </span>
                      </div>
                      <span className="font-bold text-emerald-700 font-mono">
                        -{formatINR(adj.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-slate-500 italic mt-1">
                This advance has not yet been consumed by any inwarded purchase invoice.
              </p>
            )}
          </div>
        )}

        {/* Reversal Action Section */}
        {!isReversed && (
          <div className="pt-3 border-t border-slate-200">
            {isConsumed ? (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Reversal Prohibited:</strong> A total of{" "}
                  <strong>{formatINR(advanceConsumed)}</strong> from this payment&apos;s advance has already been consumed by subsequent goods inward receipts. Historical vouchers cannot be reversed once their advance credit has been drawn down.
                </div>
              </div>
            ) : isReversing ? (
              <form onSubmit={handleConfirmReversal} className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 space-y-3">
                <div className="flex items-center gap-2 text-rose-900 font-bold text-xs">
                  <ShieldAlert className="h-4 w-4 text-rose-600" />
                  <span>Confirm Controlled Voucher Reversal</span>
                </div>
                <p className="text-[11px] text-rose-800">
                  Reversing this voucher will atomically restore{" "}
                  <strong>{formatINR(totalAllocated)}</strong> to the unpaid outstanding balances of settled purchase invoices and reverse{" "}
                  <strong>{formatINR(payment.advanceRemaining || 0)}</strong> of unallocated advance from the vendor ledger.
                </p>

                {reversalError && (
                  <div className="rounded-lg bg-white p-2 text-xs font-medium text-rose-700 border border-rose-300">
                    {reversalError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-rose-950 mb-1">
                    Reversal Reason (Mandatory) *
                  </label>
                  <Input
                    required
                    placeholder="e.g. Cheque bounced / Contract cancelled / Duplicate payment"
                    value={reversalReason}
                    onChange={(e) => setReversalReason(e.target.value)}
                    className="text-xs bg-white"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCancelReversal}
                    disabled={submittingReversal}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="destructive"
                    size="sm"
                    disabled={submittingReversal || reversalReason.trim().length < 3}
                    className="gap-1.5"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{submittingReversal ? "Reversing..." : "Confirm Reversal"}</span>
                  </Button>
                </div>
              </form>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Historical vouchers cannot be edited or deleted.
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleStartReversal}
                  className="gap-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reverse Voucher</span>
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

