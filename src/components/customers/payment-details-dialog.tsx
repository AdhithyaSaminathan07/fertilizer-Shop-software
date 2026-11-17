"use client";

import * as React from "react";
import {
  CreditCard,
  Receipt,
  RotateCcw,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Printer,
  X,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ICustomerPayment } from "@/types/customer";

interface PaymentDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: ICustomerPayment | null;
  onReverseClick?: (payment: ICustomerPayment) => void;
}

function formatINR(val: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(val || 0);
}

function formatDate(dateStr: string | Date | undefined): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(dateStr);
  }
}

export function PaymentDetailsDialog({
  open,
  onOpenChange,
  payment,
  onReverseClick,
}: PaymentDetailsDialogProps) {
  if (!payment) return null;

  const isReversed = payment.status === "REVERSED";

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center justify-between w-full pr-6">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600" />
            <span className="font-bold">Repayment Voucher Details</span>
          </div>
          <Badge
            variant={isReversed ? "danger" : "agri"}
            className={
              isReversed
                ? "bg-red-50 text-red-700 border-red-200"
                : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }
          >
            {payment.status}
          </Badge>
        </div>
      }
      description={
        <span>
          Voucher <strong>{payment.paymentNumber}</strong> recorded on{" "}
          {formatDate(payment.paymentDate)}.
        </span>
      }
      maxWidth="lg"
    >
      <div className="space-y-4">
        {/* Reversal Banner if reversed */}
        {isReversed && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-xl space-y-1 text-xs text-red-800 dark:text-red-300">
            <div className="font-semibold flex items-center gap-1.5 text-red-900 dark:text-red-200">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>This repayment voucher has been reversed</span>
            </div>
            {payment.reversal?.reason && (
              <p>
                <strong>Reason:</strong> {payment.reversal.reason}
              </p>
            )}
            {payment.reversal?.reversedAt && (
              <p className="text-[11px] text-red-700 dark:text-red-400">
                Reversed on: {new Date(payment.reversal.reversedAt).toLocaleString("en-IN")}
              </p>
            )}
          </div>
        )}

        {/* Voucher Meta Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-500 block mb-0.5">Voucher Number</span>
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
              {payment.paymentNumber}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block mb-0.5">Total Amount</span>
            <span className="font-bold text-emerald-600 text-sm">
              {formatINR(payment.amount)}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block mb-0.5">Payment Method</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {payment.paymentMethod}
            </span>
          </div>
          <div>
            <span className="text-slate-500 block mb-0.5">Payment Date</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">
              {formatDate(payment.paymentDate)}
            </span>
          </div>
          {payment.transactionReference && (
            <div className="col-span-2">
              <span className="text-slate-500 block mb-0.5">Transaction Ref</span>
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {payment.transactionReference}
              </span>
            </div>
          )}
          {payment.notes && (
            <div className="col-span-2">
              <span className="text-slate-500 block mb-0.5">Notes</span>
              <span className="text-slate-800 dark:text-slate-200">
                {payment.notes}
              </span>
            </div>
          )}
        </div>

        {/* Invoice Allocations */}
        <div>
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center justify-between">
            <span>Linked Invoice Allocations</span>
            <span className="text-slate-500 font-normal">
              {payment.allocations?.length || 0} invoice(s)
            </span>
          </div>

          {payment.allocations && payment.allocations.length > 0 ? (
            <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2 px-3">Invoice Number</th>
                    <th className="py-2 px-3">Sale Date</th>
                    <th className="py-2 px-3 text-right">Allocated Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {payment.allocations.map((alloc, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                      <td className="py-2 px-3 font-mono font-medium text-emerald-700 dark:text-emerald-400">
                        {alloc.invoiceNumber || String(alloc.saleId)}
                      </td>
                      <td className="py-2 px-3 text-slate-500">
                        {formatDate(alloc.invoiceDate || alloc.saleDate)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold text-slate-900 dark:text-slate-100">
                        {formatINR(alloc.allocatedAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 dark:bg-slate-900 font-bold border-t border-slate-200 dark:border-slate-800">
                  <tr>
                    <td colSpan={2} className="py-2 px-3 text-slate-700 dark:text-slate-300">
                      Total Allocated
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-700 dark:text-emerald-300">
                      {formatINR(payment.amount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="p-3 text-center text-xs text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-lg border">
              No specific invoice allocations recorded.
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
          <div>
            {!isReversed && onReverseClick && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs text-amber-700 dark:text-amber-400 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                onClick={() => {
                  onOpenChange(false);
                  onReverseClick(payment);
                }}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Reverse Voucher
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
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
      </div>
    </Dialog>
  );
}

