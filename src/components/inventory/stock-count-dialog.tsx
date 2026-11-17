"use client";

import * as React from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface StockCountDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (sessionId: string) => void;
}

function StockCountDialogContent({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (sessionId: string) => void;
}) {
  const [title, setTitle] = React.useState(
    `Physical Stock Count - ${new Date().toLocaleDateString("en-IN", { month: "short", year: "numeric", day: "numeric" })}`
  );
  const [notes, setNotes] = React.useState("");
  const [categories, setCategories] = React.useState<Array<{ _id: string; name: string }>>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    fetch("/api/categories")
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setCategories(data?.data?.categories || data?.categories || []);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const toggleCategory = (id: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title || title.trim().length < 3) {
      setError("Session title must be at least 3 characters");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/inventory/stock-count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          notes: notes.trim() || undefined,
          categoryIds: selectedCategoryIds.length > 0 ? selectedCategoryIds : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.message || "Failed to start count session");
      }

      onSuccess(data.data?.session?.id || data.data?.session?._id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start count session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-lg w-full bg-white rounded-lg shadow-xl">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900">New Physical Stock Count Session</h2>
          <p className="text-xs text-slate-500">
            Initializes current system stock snapshot for physical auditing
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
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Session Title <span className="text-rose-500">*</span>
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Month-End Fertilizer Audit"
            required
            className="text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Categories to Include (Optional)
          </label>
          <p className="text-[11px] text-slate-500 mb-2">
            Leave unselected to audit all products across the catalog.
          </p>
          <div className="max-h-36 overflow-y-auto border border-slate-200 rounded p-2 space-y-1">
            {categories.map((cat) => (
              <label
                key={cat._id}
                className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 p-1 rounded"
              >
                <input
                  type="checkbox"
                  checked={selectedCategoryIds.includes(cat._id)}
                  onChange={() => toggleCategory(cat._id)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>{cat.name}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Notes / Audit Objective (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="e.g. Semi-annual warehouse count verification"
            className="w-full text-sm border border-slate-300 rounded-md p-2 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading} size="sm">
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="bg-emerald-600 hover:bg-emerald-700" size="sm">
            {loading ? "Starting..." : "Start Count Session"}
          </Button>
        </div>
      </form>
    </div>
  );
}

export function StockCountDialog({ open, onClose, onSuccess }: StockCountDialogProps) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <StockCountDialogContent onClose={onClose} onSuccess={onSuccess} />
    </Dialog>
  );
}

