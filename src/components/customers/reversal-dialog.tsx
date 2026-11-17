"use client";

import * as React from "react";
import { useState } from "react";
import {
  AlertTriangle,
  RefreshCw,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ICustomerPayment } from "@/types/customer";

interface ReversalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: ICustomerPayment | null;
  onSuccess: () => void;
}

function formatINR(val: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(val || 0);
}

export function ReversalDialog(props: ReversalDialogProps) {
  if (!props.open || !props.payment) return null;
  return <ReversalContent {...props} payment={props.payment} />;
}

function ReversalContent({
  open,
  onOpenChange,
  payment,
  onSuccess,
}: ReversalDialogProps & { payment: ICustomerPayment }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 5) {
      setError("Please provide a meaningful reversal reason (at least 5 characters).");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/customers/payments/${payment._id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ reason: reason.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.error || "Failed to reverse repayment voucher.");
      }

      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <span>Reverse Customer Repayment</span>
        </div>
      }
      description={
        <span>
          Safely reverse payment voucher <strong>{payment.paymentNumber}</strong>.
        </span>
      }
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Voucher summary */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Voucher Number:</span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
              {payment.paymentNumber}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Repayment Amount:</span>
            <span className="font-bold text-emerald-600 text-sm">
              {formatINR(payment.amount)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Payment Method:</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {payment.paymentMethod}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-slate-500">Linked Invoices:</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {payment.allocations?.length || 0} invoice(s)
            </span>
          </div>
        </div>

        {/* Accounting impact warning */}
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-xl text-xs text-amber-800 dark:text-amber-300 space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>Accounting Impact & Ledger Balance Restoration</span>
          </div>
          <p className="leading-relaxed">
            Reversing this payment will restore <strong>{formatINR(payment.amount)}</strong> back
            to the customer&apos;s outstanding credit balance, and reinstate the outstanding amount
            on all {payment.allocations?.length || 0} linked sales invoice(s).
          </p>
        </div>

        {/* Reversal Reason */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Reversal Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Cheque returned by bank due to signature mismatch, or recorded against wrong customer"
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
          <span className="text-[11px] text-slate-500">
            A clear audit reason is required for accounting verification.
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting || !reason.trim() || reason.trim().length < 5}
            className="bg-amber-600 hover:bg-amber-700 text-white min-w-[120px]"
          >
            {submitting ? (
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Reversing...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <RotateCcw className="w-4 h-4" />
                Confirm Reversal
              </span>
            )}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
