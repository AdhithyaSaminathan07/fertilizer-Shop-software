"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import {
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Receipt,
  RefreshCw,
  Info,
  Calendar,
  Layers,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CustomerPaymentMethod } from "@/types/customer";

interface RecordRepaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  currentOutstanding: number;
  onSuccess: () => void;
}

interface CustomerUnpaidInvoice {
  _id: string;
  invoiceNumber: string;
  saleDate?: string;
  createdAt: string;
  grandTotal: number;
  creditAmount: number;
  repaidAmount: number;
  outstandingAmount: number;
  paymentStatus: string;
}

interface InvoiceAllocationRow {
  saleId: string;
  invoiceNumber: string;
  saleDate?: string;
  grandTotal: number;
  outstandingAmount: number;
  allocatedAmount: number;
  selected: boolean;
}

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function formatINR(val: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(val || 0);
}

function createIdempotencyKey(customerId: string): string {
  return `CPAY-IDEMP-${customerId}-${new Date().getTime()}`;
}

export function RecordRepaymentDialog(props: RecordRepaymentDialogProps) {
  if (!props.open) return null;
  return <RecordRepaymentContent {...props} />;
}

function RecordRepaymentContent({
  open,
  onOpenChange,
  customerId,
  customerName,
  customerPhone,
  currentOutstanding,
  onSuccess,
}: RecordRepaymentDialogProps) {
  const [amount, setAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [paymentMethod, setPaymentMethod] =
    useState<CustomerPaymentMethod>("CASH");
  const [transactionReference, setTransactionReference] = useState("");
  const [notes, setNotes] = useState("");
  const [allocationMode, setAllocationMode] = useState<"FIFO" | "MANUAL">("FIFO");

  const [invoicesLoading, setInvoicesLoading] = useState(true);
  const [allocationRows, setAllocationRows] = useState<InvoiceAllocationRow[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load unpaid invoices on mount
  useEffect(() => {
    let isMounted = true;

    fetch(`/api/sales?customer=${customerId}&paymentStatus=UNPAID,PARTIALLY_PAID&limit=50`, {
      credentials: "same-origin",
    })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && Array.isArray(data.data?.sales)) {
          const list: CustomerUnpaidInvoice[] = data.data.sales
            .map((s: any) => ({
              _id: s._id || s.id,
              invoiceNumber: s.invoiceNumber,
              saleDate: s.saleDate,
              createdAt: s.createdAt,
              grandTotal: s.grandTotal,
              creditAmount: s.creditAmount ?? s.grandTotal,
              repaidAmount: s.repaidAmount ?? 0,
              outstandingAmount:
                s.outstandingAmount !== undefined
                  ? s.outstandingAmount
                  : round2((s.creditAmount ?? s.grandTotal) - (s.repaidAmount ?? 0)),
              paymentStatus: s.paymentStatus,
            }))
            .filter((s: CustomerUnpaidInvoice) => s.outstandingAmount > 0);

          const rows: InvoiceAllocationRow[] = list.map((inv) => ({
            saleId: inv._id,
            invoiceNumber: inv.invoiceNumber,
            saleDate: inv.saleDate || inv.createdAt,
            grandTotal: inv.grandTotal,
            outstandingAmount: inv.outstandingAmount,
            allocatedAmount: 0,
            selected: false,
          }));
          setAllocationRows(rows);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setInvoicesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [customerId]);

  const numAmount = parseFloat(amount) || 0;
  const isOverpayment = round2(numAmount) > round2(currentOutstanding);

  // Quick preset amount helper
  const handlePresetAmount = (presetVal: number) => {
    const safeVal = Math.min(presetVal, currentOutstanding);
    setAmount(safeVal > 0 ? safeVal.toString() : "");
  };

  // Manual allocation handlers
  const handleRowCheckbox = (idx: number, checked: boolean) => {
    setAllocationRows((prev) => {
      const next = [...prev];
      const target = { ...next[idx], selected: checked };
      if (!checked) {
        target.allocatedAmount = 0;
      } else {
        const remaining = Math.max(0, numAmount - totalAllocatedExcluding(next, idx));
        target.allocatedAmount = round2(Math.min(target.outstandingAmount, remaining));
      }
      next[idx] = target;
      return next;
    });
  };

  const handleRowAmountChange = (idx: number, valStr: string) => {
    const val = parseFloat(valStr) || 0;
    setAllocationRows((prev) => {
      const next = [...prev];
      const target = { ...next[idx] };
      target.allocatedAmount = round2(Math.min(val, target.outstandingAmount));
      target.selected = target.allocatedAmount > 0;
      next[idx] = target;
      return next;
    });
  };

  function totalAllocatedExcluding(rows: InvoiceAllocationRow[], excludeIdx: number): number {
    return round2(
      rows.reduce((sum, r, i) => (i === excludeIdx ? sum : sum + (r.allocatedAmount || 0)), 0)
    );
  }

  const manualTotalAllocated = round2(
    allocationRows.reduce((sum, r) => sum + (r.allocatedAmount || 0), 0)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (numAmount <= 0) {
      setError("Please enter a valid repayment amount greater than 0.");
      return;
    }

    if (isOverpayment) {
      setError(
        `Repayment amount (${formatINR(numAmount)}) exceeds customer's outstanding credit (${formatINR(currentOutstanding)}). Excess unallocated advance is not supported in Khata.`
      );
      return;
    }

    let allocationsToSend: { saleId: string; amount: number }[] | undefined = undefined;

    if (allocationMode === "MANUAL") {
      const activeRows = allocationRows.filter((r) => r.allocatedAmount > 0);
      if (activeRows.length === 0) {
        setError("Please allocate amount to at least one invoice, or switch to Auto (FIFO) mode.");
        return;
      }
      if (Math.abs(manualTotalAllocated - numAmount) > 0.01) {
        setError(
          `Allocated sum (${formatINR(manualTotalAllocated)}) must match the total repayment amount (${formatINR(numAmount)}).`
        );
        return;
      }
      allocationsToSend = activeRows.map((r) => ({
        saleId: r.saleId,
        amount: round2(r.allocatedAmount),
      }));
    }

    setSubmitting(true);
    try {
      const payload: any = {
        customerId,
        amount: round2(numAmount),
        paymentDate,
        paymentMethod,
        transactionReference: transactionReference.trim() || undefined,
        notes: notes.trim() || undefined,
        idempotencyKey: createIdempotencyKey(customerId),
      };

      if (allocationsToSend && allocationsToSend.length > 0) {
        payload.allocations = allocationsToSend;
      }

      const res = await fetch("/api/customers/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.error || "Failed to record customer repayment.");
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
        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400">
          <CreditCard className="w-5 h-5 text-emerald-600" />
          <span>Record Customer Repayment</span>
        </div>
      }
      description={
        <span>
          Record credit repayment against farmer / customer Khata for{" "}
          <strong className="text-foreground">{customerName}</strong>
          {customerPhone ? ` (${customerPhone})` : ""}.
        </span>
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Customer Balance Banner */}
        <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex items-center justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider font-semibold text-emerald-700 dark:text-emerald-400">
              Current Outstanding Balance
            </div>
            <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-200 mt-0.5">
              {formatINR(currentOutstanding)}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7 border-emerald-300 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50"
              onClick={() => handlePresetAmount(currentOutstanding)}
            >
              Full Balance
            </Button>
            {currentOutstanding > 1000 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => handlePresetAmount(1000)}
              >
                ₹1,000
              </Button>
            )}
            {currentOutstanding > 2000 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => handlePresetAmount(2000)}
              >
                ₹2,000
              </Button>
            )}
            {currentOutstanding > 5000 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs h-7"
                onClick={() => handlePresetAmount(5000)}
              >
                ₹5,000
              </Button>
            )}
          </div>
        </div>

        {/* Amount & Date */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Repayment Amount (₹) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-500 font-semibold">₹</span>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={currentOutstanding}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={`pl-7 font-semibold text-base ${
                  isOverpayment ? "border-amber-500 bg-amber-50/30" : ""
                }`}
              />
            </div>
            {isOverpayment && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                Exceeds outstanding credit ({formatINR(currentOutstanding)}).
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              required
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>
        </div>

        {/* Method & Reference */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as CustomerPaymentMethod)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="CASH">Cash</option>
              <option value="UPI">UPI / QR Code</option>
              <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
              <option value="CHEQUE">Cheque</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Transaction / Cheque Reference
            </label>
            <Input
              type="text"
              value={transactionReference}
              onChange={(e) => setTransactionReference(e.target.value)}
              placeholder={paymentMethod === "UPI" ? "e.g. UPI Ref / UTR #" : "e.g. Cheque / Txn Ref"}
            />
          </div>
        </div>

        {/* Allocation Mode Selector */}
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>Invoice Allocation Strategy</span>
            </div>
            <div className="flex items-center gap-1 bg-slate-200/80 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setAllocationMode("FIFO")}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  allocationMode === "FIFO"
                    ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                Auto (FIFO)
              </button>
              <button
                type="button"
                onClick={() => setAllocationMode("MANUAL")}
                className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                  allocationMode === "MANUAL"
                    ? "bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                }`}
              >
                Specific Invoices
              </button>
            </div>
          </div>

          {allocationMode === "FIFO" ? (
            <div className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2 bg-white dark:bg-slate-950 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <Info className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <span>
                Standard Khata Accounting: The payment will automatically settle the oldest unpaid sales invoices in FIFO order. Any leftover portion will be allocated to the subsequent invoice.
              </span>
            </div>
          ) : (
            <div className="space-y-2 mt-2">
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Select unpaid invoices and specify exact allocation amounts. Total must equal {formatINR(numAmount)}.
              </div>

              {invoicesLoading ? (
                <div className="py-4 text-center text-xs text-slate-500">
                  <RefreshCw className="w-4 h-4 animate-spin inline mr-1" />
                  Loading customer invoices...
                </div>
              ) : allocationRows.length === 0 ? (
                <div className="py-3 text-center text-xs text-slate-500 bg-white dark:bg-slate-950 rounded border border-dashed">
                  No unpaid invoices found for this customer.
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                  {allocationRows.map((row, idx) => (
                    <div
                      key={row.saleId}
                      className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 transition-all ${
                        row.selected
                          ? "bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"
                          : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={(e) => handleRowCheckbox(idx, e.target.checked)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {row.invoiceNumber}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Due: {formatINR(row.outstandingAmount)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-500">Alloc: ₹</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max={row.outstandingAmount}
                          value={row.allocatedAmount || ""}
                          onChange={(e) => handleRowAmountChange(idx, e.target.value)}
                          placeholder="0.00"
                          className="w-24 px-2 py-1 text-xs text-right font-medium rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {allocationMode === "MANUAL" && allocationRows.length > 0 && (
                <div className="flex justify-between items-center text-xs font-semibold pt-1 border-t border-slate-200 dark:border-slate-800">
                  <span>Total Allocated:</span>
                  <span
                    className={
                      Math.abs(manualTotalAllocated - numAmount) < 0.01
                        ? "text-emerald-600 font-bold"
                        : "text-amber-600 font-bold"
                    }
                  >
                    {formatINR(manualTotalAllocated)} / {formatINR(numAmount)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Notes / Remarks (Optional)
          </label>
          <Input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Received partial cash against cotton seed credit bill"
          />
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
            disabled={submitting || numAmount <= 0 || isOverpayment}
            className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]"
          >
            {submitting ? (
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Recording...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Record Repayment
              </span>
            )}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
