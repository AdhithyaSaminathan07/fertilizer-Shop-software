"use client";

import * as React from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { IExpense, IExpenseCategory, ExpensePaymentMethod } from "@/types/expense";

interface ExpenseDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  categories: IExpenseCategory[];
  expenseToEdit?: IExpense | null;
}

function ExpenseDialogContent({
  onClose,
  onSuccess,
  categories,
  expenseToEdit,
}: {
  onClose: () => void;
  onSuccess: () => void;
  categories: IExpenseCategory[];
  expenseToEdit?: IExpense | null;
}) {
  const isEditing = Boolean(expenseToEdit);

  const [categoryId, setCategoryId] = React.useState(
    expenseToEdit?.categoryId || categories.find((c) => c.isActive)?._id || ""
  );
  const [description, setDescription] = React.useState(expenseToEdit?.description || "");
  const [amount, setAmount] = React.useState(expenseToEdit ? String(expenseToEdit.amount) : "");
  const [paymentMethod, setPaymentMethod] = React.useState<ExpensePaymentMethod>(
    expenseToEdit?.paymentMethod || "CASH"
  );
  const [paymentReference, setPaymentReference] = React.useState(
    expenseToEdit?.paymentReference || ""
  );
  const [paidTo, setPaidTo] = React.useState(expenseToEdit?.paidTo || "");
  const [expenseDate, setExpenseDate] = React.useState(
    expenseToEdit?.expenseDate
      ? new Date(expenseToEdit.expenseDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [notes, setNotes] = React.useState(expenseToEdit?.notes || "");
  const [reason, setReason] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid expense amount greater than 0");
      return;
    }
    if (!categoryId) {
      setError("Please select an expense category");
      return;
    }
    if (!description.trim()) {
      setError("Please enter a description for the expense");
      return;
    }
    if (isEditing && (!reason.trim() || reason.trim().length < 3)) {
      setError("Please provide a modification reason (at least 3 characters)");
      return;
    }

    setLoading(true);

    try {
      if (isEditing && expenseToEdit) {
        const res = await fetch(`/api/expenses/${expenseToEdit._id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId,
            description: description.trim(),
            amount: parsedAmount,
            paymentMethod,
            paymentReference: paymentReference.trim(),
            paidTo: paidTo.trim(),
            expenseDate: expenseDate ? new Date(expenseDate).toISOString() : undefined,
            notes: notes.trim(),
            reason: reason.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || "Failed to update expense");
        }
      } else {
        const res = await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoryId,
            description: description.trim(),
            amount: parsedAmount,
            paymentMethod,
            paymentReference: paymentReference.trim(),
            paidTo: paidTo.trim(),
            expenseDate: expenseDate ? new Date(expenseDate).toISOString() : undefined,
            notes: notes.trim(),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error?.message || "Failed to record expense");
        }
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
      <h2 className="text-xl font-bold text-slate-800">
        {isEditing ? `Edit Expense (${expenseToEdit?.expenseNumber})` : "Record New Expense"}
      </h2>
      <p className="text-sm text-slate-500 mt-1">
        {isEditing
          ? "Modifications will be logged in the permanent audit history."
          : "Record daily operational and business expenses into the cashbook."}
      </p>

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Category *
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#176B3A]/20 focus:border-[#176B3A]"
              required
            >
              <option value="" disabled>
                Select Category
              </option>
              {categories.map((c) => (
                <option key={c._id} value={c._id} disabled={!c.isActive}>
                  {c.name} {!c.isActive ? "(Inactive)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Expense Date *
            </label>
            <Input
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Amount (₹) *
            </label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payment Method *
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as ExpensePaymentMethod)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#176B3A]/20 focus:border-[#176B3A]"
            >
              <option value="CASH">Cash</option>
              <option value="UPI">UPI / QR</option>
              <option value="BANK_TRANSFER">Bank Transfer (NEFT/IMPS)</option>
              <option value="CHEQUE">Cheque</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Paid To (Recipient / Vendor / Staff)
            </label>
            <Input
              type="text"
              placeholder="e.g. EB Office, Mani Transport, Kumar"
              value={paidTo}
              onChange={(e) => setPaidTo(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payment Reference / Cheque / UTR
            </label>
            <Input
              type="text"
              placeholder="e.g. UPI Ref, Chq #, Transaction ID"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Description *
          </label>
          <Input
            type="text"
            placeholder="e.g. Monthly shop EB bill payment, Hamali loading 100 bags"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Additional Notes
          </label>
          <Input
            type="text"
            placeholder="Optional notes or remarks"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {isEditing && (
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
            <label className="block text-xs font-semibold text-amber-900 mb-1">
              Reason for Modification *
            </label>
            <Input
              type="text"
              placeholder="e.g. Corrected EB bill amount as per receipt"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
            <span className="text-[11px] text-amber-700 mt-1 block">
              Required for financial audit and compliance.
            </span>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-[#176B3A] hover:bg-[#12532D] text-white"
          >
            {loading ? "Saving..." : isEditing ? "Save Changes" : "Record Expense"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ExpenseDialog({
  open,
  onClose,
  onSuccess,
  categories,
  expenseToEdit,
}: ExpenseDialogProps) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <ExpenseDialogContent
        key={expenseToEdit?._id || "new"}
        onClose={onClose}
        onSuccess={onSuccess}
        categories={categories}
        expenseToEdit={expenseToEdit}
      />
    </Dialog>
  );
}
