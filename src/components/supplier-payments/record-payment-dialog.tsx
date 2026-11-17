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
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SupplierPaymentMethod } from "@/types/supplier-payment";

interface RecordPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId: string;
  supplierName: string;
  prefilledPurchaseId?: string;
  prefilledAmount?: number;
  onSuccess: () => void;
}

interface EligiblePurchase {
  _id: string;
  id?: string;
  purchaseNumber: string;
  supplierInvoiceNumber: string;
  purchaseDate?: string;
  createdAt: string;
  grandTotal: number;
  recognizedInvoiceValue: number;
  amountPaid: number;
  outstandingAmount: number;
  status: string;
}

interface AllocationState {
  purchaseId: string;
  purchaseNumber: string;
  supplierInvoiceNumber: string;
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

function RecordPaymentForm({
  supplierId,
  supplierName,
  prefilledPurchaseId,
  prefilledAmount,
  onClose,
  onSuccess,
}: {
  supplierId: string;
  supplierName: string;
  prefilledPurchaseId?: string;
  prefilledAmount?: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [paymentDate, setPaymentDate] = useState(() =>
    new Date().toISOString().split("T")[0]
  );
  const [amount, setAmount] = useState<string>(() =>
    prefilledAmount !== undefined && prefilledAmount > 0 ? String(prefilledAmount) : ""
  );
  const [paymentMethod, setPaymentMethod] = useState<SupplierPaymentMethod>("CASH");
  const [paymentReference, setPaymentReference] = useState("");
  const [notes, setNotes] = useState("");
  const [idempotencyKey] = useState(
    () => `PAY-UI-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
  );

  const [loadingPurchases, setLoadingPurchases] = useState(true);
  const [, setEligiblePurchases] = useState<EligiblePurchase[]>([]);
  const [allocations, setAllocations] = useState<AllocationState[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;
    fetch(`/api/purchases?supplierId=${supplierId}&limit=100`, {
      credentials: "same-origin",
    })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && data.data?.purchases) {
          const eligible: EligiblePurchase[] = data.data.purchases.filter(
            (p: any) =>
              p.status !== "PENDING_RECEIPT" &&
              p.status !== "CANCELLED" &&
              (p.outstandingAmount || 0) > 0.01
          );
          setEligiblePurchases(eligible);

          const initialAllocations: AllocationState[] = eligible.map((p) => {
            const pId = p.id || p._id;
            const isPrefilled = prefilledPurchaseId && pId === prefilledPurchaseId;
            const defaultAlloc = isPrefilled
              ? prefilledAmount !== undefined
                ? Math.min(prefilledAmount, p.outstandingAmount)
                : p.outstandingAmount
              : 0;

            return {
              purchaseId: pId,
              purchaseNumber: p.purchaseNumber,
              supplierInvoiceNumber: p.supplierInvoiceNumber,
              outstandingAmount: p.outstandingAmount,
              allocatedAmount: defaultAlloc,
              selected: Boolean(isPrefilled),
            };
          });

          setAllocations(initialAllocations);

          if (!prefilledAmount && prefilledPurchaseId) {
            const match = eligible.find((p) => (p.id || p._id) === prefilledPurchaseId);
            if (match) {
              setAmount(String(match.outstandingAmount));
            }
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load eligible purchases:", err);
      })
      .finally(() => {
        if (isMounted) setLoadingPurchases(false);
      });

    return () => {
      isMounted = false;
    };
  }, [supplierId, prefilledPurchaseId, prefilledAmount]);

  const numAmount = parseFloat(amount) || 0;

  // Compute live allocation metrics
  const totalAllocated = round2(
    allocations.reduce((sum, a) => sum + (a.selected ? a.allocatedAmount || 0 : 0), 0)
  );
  const unallocatedAdvance = round2(Math.max(0, numAmount - totalAllocated));
  const isOverAllocated = round2(totalAllocated - numAmount) > 0.001;

  const handleToggleSelect = (index: number) => {
    setAllocations((prev) =>
      prev.map((a, i) => {
        if (i !== index) return a;
        const nextSelected = !a.selected;
        let nextAlloc = a.allocatedAmount;
        if (nextSelected && nextAlloc === 0) {
          const remainingPayment = Math.max(0, numAmount - totalAllocated);
          nextAlloc = round2(
            Math.min(
              remainingPayment > 0 ? remainingPayment : a.outstandingAmount,
              a.outstandingAmount
            )
          );
        } else if (!nextSelected) {
          nextAlloc = 0;
        }
        return { ...a, selected: nextSelected, allocatedAmount: nextAlloc };
      })
    );
  };

  const handleAllocationAmountChange = (index: number, valStr: string) => {
    const val = parseFloat(valStr) || 0;
    setAllocations((prev) =>
      prev.map((a, i) => {
        if (i !== index) return a;
        return {
          ...a,
          allocatedAmount: val,
          selected: val > 0,
        };
      })
    );
  };

  const handlePayFullInvoice = (index: number) => {
    setAllocations((prev) =>
      prev.map((a, i) => {
        if (i !== index) return a;
        return {
          ...a,
          allocatedAmount: a.outstandingAmount,
          selected: true,
        };
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (numAmount <= 0) {
      setErrorMessage("Payment amount must be greater than zero (₹0.00).");
      return;
    }

    if (isOverAllocated) {
      setErrorMessage(
        `Total allocated amount (${formatINR(totalAllocated)}) cannot exceed the payment amount (${formatINR(numAmount)}).`
      );
      return;
    }

    for (const alloc of allocations) {
      if (alloc.selected && alloc.allocatedAmount > 0) {
        if (alloc.allocatedAmount > alloc.outstandingAmount + 0.001) {
          setErrorMessage(
            `Allocated amount for ${alloc.purchaseNumber} (${formatINR(alloc.allocatedAmount)}) exceeds its outstanding balance (${formatINR(alloc.outstandingAmount)}).`
          );
          return;
        }
      }
    }

    const activeAllocations = allocations
      .filter((a) => a.selected && a.allocatedAmount > 0)
      .map((a) => ({
        purchaseId: a.purchaseId,
        amount: round2(a.allocatedAmount),
      }));

    const payload = {
      supplierId,
      paymentDate: new Date(paymentDate).toISOString(),
      amount: round2(numAmount),
      paymentMethod,
      paymentReference: paymentReference.trim() || undefined,
      allocations: activeAllocations,
      notes: notes.trim() || undefined,
      idempotencyKey,
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/supplier-payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-idempotency-key": idempotencyKey,
        },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || data.message || "Failed to record supplier payment");
      }

      onClose();
      onSuccess();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to record supplier payment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {errorMessage && (
        <div className="flex items-center gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span className="font-medium">{errorMessage}</span>
        </div>
      )}

      {/* Primary Payment Details */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">
            Payment Date *
          </label>
          <Input
            type="date"
            required
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className="text-xs"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">
            Payment Amount (₹) *
          </label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-xs font-bold text-slate-900"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">
            Payment Method *
          </label>
          <select
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as SupplierPaymentMethod)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-[#176B3A] focus:outline-none"
          >
            <option value="CASH">Cash</option>
            <option value="UPI">UPI / GPay / PhonePe</option>
            <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
            <option value="CHEQUE">Cheque</option>
          </select>
        </div>
      </div>

      {/* Reference & Notes */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">
            Transaction Reference / Cheque #
          </label>
          <Input
            placeholder="e.g. UTR / UPI Ref / Cheque No."
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            className="text-xs font-mono"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">
            Payment Remarks / Notes
          </label>
          <Input
            placeholder="Optional notes or settlement details"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="text-xs"
          />
        </div>
      </div>

      {/* Invoice Allocations Section */}
      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5 text-[#176B3A]" />
              Invoice Allocation
            </h4>
            <p className="text-[11px] text-slate-500">
              Allocate this payment against inwarded purchase invoices for {supplierName}.
            </p>
          </div>
          {numAmount > 0 && (
            <span className="text-xs font-semibold text-slate-700">
              Payment: <strong className="text-slate-900">{formatINR(numAmount)}</strong>
            </span>
          )}
        </div>

        {loadingPurchases ? (
          <div className="flex items-center justify-center py-6 text-slate-400">
            <RefreshCw className="h-4 w-4 animate-spin mr-2 text-[#176B3A]" />
            <span className="text-xs">Loading open invoices...</span>
          </div>
        ) : allocations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-center">
            <Info className="mx-auto h-6 w-6 text-slate-400 mb-1" />
            <p className="text-xs font-semibold text-slate-700">No Pending Inwarded Invoices</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              All inwarded purchases for this vendor are fully settled. Any payment made will be retained 100% as an unallocated supplier advance.
            </p>
          </div>
        ) : (
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {allocations.map((alloc, idx) => (
              <div
                key={alloc.purchaseId}
                className={`p-3 text-xs transition-colors ${
                  alloc.selected ? "bg-emerald-50/40" : "hover:bg-slate-50/70"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={alloc.selected}
                      onChange={() => handleToggleSelect(idx)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#176B3A] focus:ring-[#176B3A]"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {alloc.purchaseNumber}
                        </span>
                        <span className="font-mono text-[11px] text-slate-500">
                          Inv: {alloc.supplierInvoiceNumber}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Outstanding:{" "}
                        <strong className="text-amber-700">
                          {formatINR(alloc.outstandingAmount)}
                        </strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:self-center pl-6 sm:pl-0">
                    <div className="w-32">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={alloc.outstandingAmount}
                        placeholder="Allocated ₹"
                        value={alloc.allocatedAmount || ""}
                        onChange={(e) => handleAllocationAmountChange(idx, e.target.value)}
                        className="h-7 text-xs font-bold text-right"
                        disabled={!alloc.selected}
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handlePayFullInvoice(idx)}
                      className="h-7 text-[10px] px-2"
                    >
                      Pay Full
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Allocation Breakdown Bar */}
        <div className="pt-2 border-t border-slate-200/80 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          <div className="rounded-lg bg-white p-2.5 border border-slate-200">
            <span className="text-[11px] text-slate-500 block">Total Disbursed:</span>
            <strong className="text-slate-900 font-bold text-sm">
              {formatINR(numAmount)}
            </strong>
          </div>

          <div className="rounded-lg bg-white p-2.5 border border-slate-200">
            <span className="text-[11px] text-slate-500 block">Allocated to Invoices:</span>
            <strong className={`font-bold text-sm ${isOverAllocated ? "text-rose-600" : "text-[#176B3A]"}`}>
              {formatINR(totalAllocated)}
            </strong>
          </div>

          <div className={`rounded-lg p-2.5 border ${
            unallocatedAdvance > 0
              ? "bg-emerald-50 border-emerald-200 text-emerald-900"
              : "bg-white border-slate-200 text-slate-700"
          }`}>
            <span className="text-[11px] block text-slate-500">Unallocated Advance:</span>
            <strong className="font-bold text-sm text-[#176B3A]">
              {formatINR(unallocatedAdvance)}
            </strong>
          </div>
        </div>

        {unallocatedAdvance > 0 && !isOverAllocated && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50/80 p-2.5 text-[11px] text-emerald-800 border border-emerald-200/60">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>
              <strong>Supplier Advance Credit:</strong> The unallocated amount of{" "}
              <strong>{formatINR(unallocatedAdvance)}</strong> will be safely recorded in the vendor ledger as available advance and automatically absorbed during future goods inwards.
            </span>
          </div>
        )}

        {isOverAllocated && (
          <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-2.5 text-[11px] text-rose-700 border border-rose-200">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>
              Allocations exceed payment amount by <strong>{formatINR(round2(totalAllocated - numAmount))}</strong>. Reduce allocations or increase payment amount.
            </span>
          </div>
        )}
      </div>

      {/* Modal Actions */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={submitting}
        >
          Cancel
        </Button>

        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={submitting || numAmount <= 0 || isOverAllocated}
          className="gap-2 shadow-xs"
        >
          {submitting ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              <span>Recording Payment...</span>
            </>
          ) : (
            <>
              <CreditCard className="h-3.5 w-3.5" />
              <span>Confirm & Record Payment</span>
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

export function RecordPaymentDialog({
  open,
  onOpenChange,
  supplierId,
  supplierName,
  prefilledPurchaseId,
  prefilledAmount,
  onSuccess,
}: RecordPaymentDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Record Supplier Payment"
      description={`Disburse payment to ${supplierName} and allocate across inwarded purchase invoices.`}
      maxWidth="lg"
    >
      {open && supplierId ? (
        <RecordPaymentForm
          supplierId={supplierId}
          supplierName={supplierName}
          prefilledPurchaseId={prefilledPurchaseId}
          prefilledAmount={prefilledAmount}
          onClose={() => onOpenChange(false)}
          onSuccess={onSuccess}
        />
      ) : null}
    </Dialog>
  );
}
