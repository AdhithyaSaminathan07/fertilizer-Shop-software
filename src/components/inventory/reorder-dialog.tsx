"use client";

import * as React from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ReorderDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product: {
    productId: string;
    name: string;
    sku: string;
    primaryUnit: string;
    currentStock: number;
    minStockThreshold: number;
    preferredReorderQty?: number;
  } | null;
}

function ReorderDialogContent({
  product,
  onClose,
  onSuccess,
}: {
  product: NonNullable<ReorderDialogProps["product"]>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [minThreshold, setMinThreshold] = React.useState(String(product.minStockThreshold || 0));
  const [preferredQty, setPreferredQty] = React.useState(
    product.preferredReorderQty !== undefined ? String(product.preferredReorderQty) : ""
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const min = parseFloat(minThreshold);
    if (isNaN(min) || min < 0) {
      setError("Minimum stock threshold cannot be negative");
      return;
    }

    let pref: number | undefined = undefined;
    if (preferredQty.trim() !== "") {
      pref = parseFloat(preferredQty);
      if (isNaN(pref) || pref < 0) {
        setError("Preferred reorder quantity cannot be negative");
        return;
      }
    }

    setLoading(true);
    try {
      const res = await fetch("/api/inventory/reorder-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.productId,
          minStockThreshold: min,
          preferredReorderQty: pref,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.message || "Failed to update reorder settings");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update reorder settings");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-md w-full bg-white rounded-lg shadow-xl">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Reorder Settings</h2>
          <p className="text-xs text-slate-500">
            {product.name} ({product.sku})
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
        <div className="bg-slate-50 p-3 rounded-md border border-slate-200 text-xs flex justify-between">
          <span className="text-slate-600">Current Stock:</span>
          <span className="font-bold text-slate-900">
            {product.currentStock} {product.primaryUnit}
          </span>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Minimum Stock Threshold ({product.primaryUnit}) <span className="text-rose-500">*</span>
          </label>
          <Input
            type="number"
            step="any"
            min="0"
            value={minThreshold}
            onChange={(e) => setMinThreshold(e.target.value)}
            placeholder="e.g. 10"
            required
            className="text-sm"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            When available stock falls at or below this level, an alert is triggered.
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Preferred Reorder Quantity ({product.primaryUnit})
          </label>
          <Input
            type="number"
            step="any"
            min="0"
            value={preferredQty}
            onChange={(e) => setPreferredQty(e.target.value)}
            placeholder="e.g. 50 (leave empty for auto calculation)"
            className="text-sm"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Suggested reorder batch size when placing purchase orders with suppliers.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading} size="sm">
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700" size="sm">
            {loading ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function ReorderDialog({ open, onClose, onSuccess, product }: ReorderDialogProps) {
  if (!open || !product) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <ReorderDialogContent
        key={product.productId}
        product={product}
        onClose={onClose}
        onSuccess={onSuccess}
      />
    </Dialog>
  );
}

