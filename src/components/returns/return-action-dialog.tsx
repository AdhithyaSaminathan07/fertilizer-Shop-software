"use client";

import * as React from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ReturnActionDialogProps {
  open: boolean;
  action: "APPROVE" | "REJECT" | "CANCEL" | null;
  returnType: "SALES" | "PURCHASE";
  returnNumber: string;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void>;
}

function ReturnActionDialogContent({
  action,
  returnType,
  returnNumber,
  onClose,
  onConfirm,
}: {
  action: "APPROVE" | "REJECT" | "CANCEL";
  returnType: "SALES" | "PURCHASE";
  returnNumber: string;
  onClose: () => void;
  onConfirm: (reason?: string) => Promise<void>;
}) {
  const [reason, setReason] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isApproval = action === "APPROVE";
  const isRejection = action === "REJECT";
  const isCancellation = action === "CANCEL";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isApproval && (!reason || reason.trim().length < 3)) {
      setError("Please provide a detailed reason (minimum 3 characters) for audit trail");
      return;
    }

    setLoading(true);
    try {
      await onConfirm(reason.trim());
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-md w-full bg-white rounded-lg shadow-xl">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {isApproval ? "Approve Return" : isRejection ? "Reject Return" : "Cancel Return"}
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            {returnType === "SALES" ? "Sales Return" : "Purchase Return"}: {returnNumber}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 text-lg font-bold"
        >
          &times;
        </button>
      </div>

      {error && (
        <div className="mt-3 p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-md">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {isApproval ? (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 space-y-1">
            <p className="font-semibold">Confirm Return Approval</p>
            <p>
              This will mark the return as <strong>APPROVED</strong>. Notice: Per strict module
              independence rules, approving this return will only update this return record and will
              not mutate inventory or financial ledgers.
            </p>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {isRejection ? "Rejection Reason" : "Cancellation Reason"}{" "}
              <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder={
                isRejection
                  ? "Specify why this return request is being rejected..."
                  : "Specify why this return is being cancelled..."
              }
              required
              className="w-full text-sm border border-slate-300 rounded-md p-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Mandatory for management and compliance audit logging.
            </p>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading} size="sm">
            Close
          </Button>
          <Button
            type="submit"
            disabled={loading}
            size="sm"
            className={
              isApproval
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "bg-rose-600 hover:bg-rose-700 text-white"
            }
          >
            {loading
              ? "Processing..."
              : isApproval
              ? "Confirm Approval"
              : isRejection
              ? "Confirm Rejection"
              : "Confirm Cancellation"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ReturnActionDialog({
  open,
  action,
  returnType,
  returnNumber,
  onClose,
  onConfirm,
}: ReturnActionDialogProps) {
  if (!open || !action) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <ReturnActionDialogContent
        key={`${action}-${returnNumber}`}
        action={action}
        returnType={returnType}
        returnNumber={returnNumber}
        onClose={onClose}
        onConfirm={onConfirm}
      />
    </Dialog>
  );
}

