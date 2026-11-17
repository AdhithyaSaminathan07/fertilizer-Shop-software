"use client";

import * as React from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import type { IExpense } from "@/types/expense";

interface ExpenseReversalDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  expense: IExpense | null;
}

function ReversalDialogContent({
  onClose,
  onSuccess,
  expense,
}: {
  onClose: () => void;
  onSuccess: () => void;
  expense: IExpense;
}) {
  const [reason, setReason] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleReverse = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!reason.trim() || reason.trim().length < 5) {
      setError("Please provide a detailed reversal reason (at least 5 characters)");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`/api/expenses/${expense._id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to reverse expense");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-rose-700">Reverse Expense Record</h2>
      <p className="text-sm text-slate-500 mt-1">
        Reversing expense <strong>{expense.expenseNumber}</strong> will restore the corresponding{" "}
        <strong>{expense.paymentMethod}</strong> balance in the business cashbook. Financial records
        are never deleted.
      </p>

      <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200 text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-500">Category:</span>
          <span className="font-semibold text-slate-800">{expense.categoryName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Amount:</span>
          <span className="font-semibold text-slate-800">{formatCurrency(expense.amount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Payment Method:</span>
          <span className="font-semibold text-slate-800">{expense.paymentMethod}</span>
        </div>
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700">
          {error}
        </div>
      )}

      <form onSubmit={handleReverse} className="mt-4 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Reversal Reason *
          </label>
          <Input
            type="text"
            placeholder="e.g. Duplicate voucher entered by mistake, transaction cancelled"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
          />
          <span className="text-[11px] text-slate-400 mt-1 block">
            Mandatory minimum 5 characters for compliance audit.
          </span>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            {loading ? "Reversing..." : "Confirm Reversal"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ExpenseReversalDialog({
  open,
  onClose,
  onSuccess,
  expense,
}: ExpenseReversalDialogProps) {
  if (!open || !expense) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <ReversalDialogContent
        key={expense._id}
        onClose={onClose}
        onSuccess={onSuccess}
        expense={expense}
      />
    </Dialog>
  );
}
