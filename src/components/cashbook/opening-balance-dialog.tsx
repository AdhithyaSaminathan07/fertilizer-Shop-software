"use client";

import * as React from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { ICashbookOpeningBalanceConfig } from "@/types/expense";

interface OpeningBalanceDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentConfig: ICashbookOpeningBalanceConfig | null;
}

function OpeningBalanceContent({
  onClose,
  onSuccess,
  currentConfig,
}: {
  onClose: () => void;
  onSuccess: () => void;
  currentConfig: ICashbookOpeningBalanceConfig | null;
}) {
  const [cash, setCash] = React.useState(String(currentConfig?.cash || 0));
  const [upi, setUpi] = React.useState(String(currentConfig?.upi || 0));
  const [bank, setBank] = React.useState(String(currentConfig?.bank || 0));
  const [cheque, setCheque] = React.useState(String(currentConfig?.cheque || 0));
  const [effectiveDate, setEffectiveDate] = React.useState(
    currentConfig?.effectiveDate
      ? new Date(currentConfig.effectiveDate).toISOString().split("T")[0]
      : ""
  );
  const [notes, setNotes] = React.useState(currentConfig?.notes || "");
  const [reason, setReason] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const c = parseFloat(cash) || 0;
    const u = parseFloat(upi) || 0;
    const b = parseFloat(bank) || 0;
    const ch = parseFloat(cheque) || 0;

    if (c < 0 || u < 0 || b < 0 || ch < 0) {
      setError("Opening balances cannot be negative");
      return;
    }

    if (currentConfig && currentConfig.history && currentConfig.history.length > 0 && !reason.trim()) {
      setError("Please provide an adjustment reason for altering opening balances");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/cashbook/opening-balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          effectiveDate: effectiveDate ? new Date(effectiveDate).toISOString() : undefined,
          cash: c,
          upi: u,
          bank: b,
          cheque: ch,
          notes: notes.trim(),
          reason: reason.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to configure opening balances");
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
    <div className="p-6 max-h-[85vh] overflow-y-auto">
      <h2 className="text-xl font-bold text-slate-800">Configure Cashbook Opening Balances</h2>
      <p className="text-sm text-slate-500 mt-1">
        Set baseline starting balances for physical store cash and recorded digital accounts.
        All subsequent inflows and outflows build upon these balances.
      </p>

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Effective Accounting Date *
          </label>
          <Input
            type="date"
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
            required
          />
          <span className="text-[11px] text-slate-400 mt-1 block">
            Transactions on or after this date will be tracked in the cashbook.
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Store Cash In Hand (₹) *
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={cash}
              onChange={(e) => setCash(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Recorded UPI Account Balance (₹) *
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={upi}
              onChange={(e) => setUpi(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Recorded Bank Account Balance (₹) *
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={bank}
              onChange={(e) => setBank(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Cheques In Hand Balance (₹) *
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={cheque}
              onChange={(e) => setCheque(e.target.value)}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Opening Balance Notes
          </label>
          <Input
            type="text"
            placeholder="e.g. FY 2026-2027 starting cash verified by proprietor"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {currentConfig && (
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
            <label className="block text-xs font-semibold text-amber-900 mb-1">
              Adjustment Reason *
            </label>
            <Input
              type="text"
              placeholder="e.g. Audited cash register re-calibration"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <span className="text-[11px] text-amber-700 mt-1 block">
              Required when adjusting existing baseline balances.
            </span>
          </div>
        )}

        {/* Adjustment History */}
        {currentConfig && currentConfig.history && currentConfig.history.length > 0 && (
          <div className="pt-3 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Previous Adjustments ({currentConfig.history.length})
            </span>
            <div className="space-y-1.5 max-h-32 overflow-y-auto text-xs text-slate-600">
              {currentConfig.history.map((h, i) => (
                <div key={i} className="p-2 bg-slate-50 rounded border border-slate-100">
                  <div>
                    <strong>{formatDate(h.adjustedAt)}</strong> by {h.adjustedByName} — &ldquo;{h.reason}&rdquo;
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Cash: {formatCurrency(h.newBalances.cash)} | UPI: {formatCurrency(h.newBalances.upi)} | Bank: {formatCurrency(h.newBalances.bank)}
                  </div>
                </div>
              ))}
            </div>
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
            {loading ? "Saving..." : "Save Opening Balances"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function OpeningBalanceDialog({
  open,
  onClose,
  onSuccess,
  currentConfig,
}: OpeningBalanceDialogProps) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <OpeningBalanceContent
        key={currentConfig?.updatedAt ? String(currentConfig.updatedAt) : "new"}
        onClose={onClose}
        onSuccess={onSuccess}
        currentConfig={currentConfig}
      />
    </Dialog>
  );
}
