"use client";

import * as React from "react";
import { useState } from "react";
import { AlertTriangle, Loader2, Ban } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CancelSaleDialogProps {
  open: boolean;
  invoiceNumber: string;
  grandTotal: number;
  creditAmount?: number;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export function CancelSaleDialog({
  open,
  invoiceNumber,
  grandTotal,
  creditAmount = 0,
  onClose,
  onConfirm,
}: CancelSaleDialogProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!reason.trim() || reason.trim().length < 3) {
      setError("Please provide a valid cancellation reason (minimum 3 characters)");
      return;
    }

    setLoading(true);
    try {
      await onConfirm(reason.trim());
      setReason("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to cancel invoice");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()} title={`Cancel Invoice #${invoiceNumber}`}>
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm space-y-2">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Important Cancellation Impact:</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-xs pl-1 text-amber-900">
            <li>
              All product stock and batch quantities for this bill (₹{grandTotal.toFixed(2)}) will be automatically returned to inventory.
            </li>
            {creditAmount > 0 && (
              <li>
                Customer outstanding credit of <span className="font-semibold text-red-700">₹{creditAmount.toFixed(2)}</span> will be reversed immediately.
              </li>
            )}
            <li>This action is permanent and recorded in the system audit logs.</li>
          </ul>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
            Cancellation Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Customer returned items / billing entry error"
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
            required
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Dismiss
          </Button>
          <Button
            type="submit"
            className="bg-red-600 hover:bg-red-700 text-white font-medium"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Ban className="w-4 h-4 mr-2" />
                Confirm Cancellation
              </>
            )}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
