"use client";

import * as React from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { StockAdjustmentReason, StockAdjustmentType } from "@/types/inventory";

interface StockAdjustmentDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialProductId?: string;
  initialBatchId?: string;
  initialType?: StockAdjustmentType;
  initialReason?: StockAdjustmentReason;
}

const REASONS: Array<{ value: StockAdjustmentReason; label: string; defaultType: StockAdjustmentType }> = [
  { value: "PHYSICAL_CORRECTION", label: "Physical Count Correction", defaultType: "INCREASE" },
  { value: "DAMAGED_GOODS", label: "Damaged Stock Write-off", defaultType: "DECREASE" },
  { value: "EXPIRED_GOODS", label: "Expired Stock Write-off", defaultType: "DECREASE" },
  { value: "STOCK_LOSS", label: "Stock Loss / Theft", defaultType: "DECREASE" },
  { value: "DATA_CORRECTION", label: "Data Entry Correction", defaultType: "INCREASE" },
  { value: "OTHER", label: "Other Operational Reason", defaultType: "INCREASE" },
];

function StockAdjustmentDialogContent({
  onClose,
  onSuccess,
  initialProductId,
  initialBatchId,
  initialType,
  initialReason,
}: {
  onClose: () => void;
  onSuccess: () => void;
  initialProductId?: string;
  initialBatchId?: string;
  initialType?: StockAdjustmentType;
  initialReason?: StockAdjustmentReason;
}) {
  const [products, setProducts] = React.useState<Array<{ _id: string; name: string; sku: string; currentStock: number; primaryUnit: string }>>([]);
  const [productId, setProductId] = React.useState(initialProductId || "");
  const [batches, setBatches] = React.useState<Array<{ _id: string; batchNumber: string; quantity: number; expiryDate?: string }>>([]);
  const [batchId, setBatchId] = React.useState(initialBatchId || "");
  const [type, setType] = React.useState<StockAdjustmentType>(initialType || "DECREASE");
  const [reason, setReason] = React.useState<StockAdjustmentReason>(initialReason || "PHYSICAL_CORRECTION");
  const [quantity, setQuantity] = React.useState("");
  const [explanation, setExplanation] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [fetchingBatches, setFetchingBatches] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch product list
  React.useEffect(() => {
    let active = true;
    fetch("/api/products?limit=100")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const list = data?.data?.products || data?.products || [];
        setProducts(list);
        if (!productId && list.length > 0 && !initialProductId) {
          setProductId(list[0]._id);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [productId, initialProductId]);

  // Fetch batches when productId changes
  React.useEffect(() => {
    let active = true;
    if (!productId) {
      return;
    }
    fetch(`/api/inventory/batches?productId=${productId}`)
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setBatches(data?.data?.batches || []);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setFetchingBatches(false);
      });
    return () => {
      active = false;
    };
  }, [productId]);

  const selectedProduct = products.find((p) => p._id === productId);
  const selectedBatch = batches.find((b) => b._id === batchId);

  const availableStock = selectedBatch
    ? selectedBatch.quantity
    : selectedProduct?.currentStock || 0;

  const handleReasonChange = (val: StockAdjustmentReason) => {
    setReason(val);
    const cfg = REASONS.find((r) => r.value === val);
    if (cfg) {
      setType(cfg.defaultType);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      setError("Please enter a valid quantity greater than 0");
      return;
    }

    if (type === "DECREASE" && qty > availableStock) {
      setError(`Cannot decrease by ${qty}. Available stock is only ${availableStock}`);
      return;
    }

    if (!explanation || explanation.trim().length < 5) {
      setError("A detailed explanation (at least 5 characters) is required for stock audits");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/inventory/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          batchId: batchId || undefined,
          type,
          adjustmentQuantity: qty,
          reason,
          explanation: explanation.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.message || "Failed to record adjustment");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record adjustment");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-lg w-full bg-white rounded-lg shadow-xl">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Record Stock Adjustment</h2>
          <p className="text-xs text-slate-500">Record physical corrections, write-offs or damages</p>
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
        {/* Product selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Product <span className="text-rose-500">*</span>
          </label>
          <select
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              setBatchId("");
              setBatches([]);
            }}
            required
            className="w-full text-sm border border-slate-300 rounded-md p-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {products.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} ({p.sku}) — Stock: {p.currentStock} {p.primaryUnit}
              </option>
            ))}
          </select>
        </div>

        {/* Batch selector (if any) */}
        {batches.length > 0 && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Specific Batch (Optional)
            </label>
            <select
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-md p-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Whole Product Stock (No batch specified)</option>
              {batches.map((b) => (
                <option key={b._id} value={b._id}>
                  Batch: {b.batchNumber} — Qty: {b.quantity}{" "}
                  {b.expiryDate ? `(Exp: ${new Date(b.expiryDate).toLocaleDateString()})` : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Available Stock Indicator */}
        <div className="bg-slate-50 border border-slate-200 rounded p-2.5 flex items-center justify-between text-xs">
          <span className="text-slate-600">Available Stock in System:</span>
          <span className="font-bold text-slate-800">
            {availableStock} {selectedProduct?.primaryUnit || "PCS"}
          </span>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Adjustment Reason <span className="text-rose-500">*</span>
          </label>
          <select
            value={reason}
            onChange={(e) => handleReasonChange(e.target.value as StockAdjustmentReason)}
            className="w-full text-sm border border-slate-300 rounded-md p-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>

        {/* Type toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setType("INCREASE")}
            className={`py-2 px-3 text-xs font-semibold rounded-md border text-center transition-colors ${
              type === "INCREASE"
                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
          >
            + INCREASE STOCK
          </button>
          <button
            type="button"
            onClick={() => setType("DECREASE")}
            className={`py-2 px-3 text-xs font-semibold rounded-md border text-center transition-colors ${
              type === "DECREASE"
                ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
            }`}
          >
            - DECREASE (WRITE-OFF)
          </button>
        </div>

        {/* Quantity */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Quantity to {type === "INCREASE" ? "Add" : "Reduce"} <span className="text-rose-500">*</span>
          </label>
          <Input
            type="number"
            step="any"
            min="0.001"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={`e.g. 10 ${selectedProduct?.primaryUnit || "PCS"}`}
            required
            className="text-sm"
          />
        </div>

        {/* Explanation */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Detailed Reason / Explanation <span className="text-rose-500">*</span>
          </label>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            rows={3}
            placeholder="Document why this stock adjustment is being recorded for financial and stock audits..."
            required
            className="w-full text-sm border border-slate-300 rounded-md p-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <p className="text-[11px] text-slate-400 mt-0.5">Mandatory for stock and balance sheet audits.</p>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading} size="sm">
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={loading || fetchingBatches}
            className={type === "INCREASE" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}
            size="sm"
          >
            {loading ? "Recording..." : type === "INCREASE" ? "Confirm Increase" : "Confirm Write-off"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function StockAdjustmentDialog({
  open,
  onClose,
  onSuccess,
  initialProductId,
  initialBatchId,
  initialType,
  initialReason,
}: StockAdjustmentDialogProps) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <StockAdjustmentDialogContent
        key={`${initialProductId || ""}-${initialBatchId || ""}-${initialType || ""}`}
        onClose={onClose}
        onSuccess={onSuccess}
        initialProductId={initialProductId}
        initialBatchId={initialBatchId}
        initialType={initialType}
        initialReason={initialReason}
      />
    </Dialog>
  );
}

