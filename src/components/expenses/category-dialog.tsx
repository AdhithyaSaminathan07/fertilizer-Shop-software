"use client";

import * as React from "react";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import type { IExpenseCategory } from "@/types/expense";

interface CategoryDialogProps {
  open: boolean;
  onClose: () => void;
  categories: IExpenseCategory[];
  onRefresh: () => void;
}

function CategoryDialogContent({
  onClose,
  categories,
  onRefresh,
}: {
  onClose: () => void;
  categories: IExpenseCategory[];
  onRefresh: () => void;
}) {
  const [newCategoryName, setNewCategoryName] = React.useState("");
  const [newDescription, setNewDescription] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!newCategoryName.trim()) {
      setError("Category name is required");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/expenses/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          description: newDescription.trim(),
          isActive: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to create category");

      setNewCategoryName("");
      setNewDescription("");
      setSuccessMsg("Category created successfully");
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (cat: IExpenseCategory) => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/expenses/categories/${cat._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive: !cat.isActive,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to update status");

      setSuccessMsg(`Category '${cat.name}' ${cat.isActive ? "deactivated" : "activated"}`);
      onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-h-[85vh] flex flex-col">
      <h2 className="text-xl font-bold text-slate-800">Expense Categories</h2>
      <p className="text-sm text-slate-500 mt-1">
        Manage standard operational categories. Deactivate categories to preserve historical accounting.
      </p>

      {error && (
        <div className="mt-3 p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="mt-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-700">
          {successMsg}
        </div>
      )}

      {/* Add new category form */}
      <form onSubmit={handleCreate} className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          Add New Category
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Input
              placeholder="Category Name (e.g. Generator Fuel)"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              required
            />
          </div>
          <div>
            <Input
              placeholder="Description (optional)"
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end mt-3">
          <Button
            type="submit"
            disabled={loading}
            size="sm"
            className="bg-[#176B3A] hover:bg-[#12532D] text-white"
          >
            Add Category
          </Button>
        </div>
      </form>

      {/* Categories List */}
      <div className="mt-4 flex-1 overflow-y-auto space-y-2 pr-1">
        {categories.map((cat) => (
          <div
            key={cat._id}
            className="flex items-center justify-between p-3 rounded-lg border border-slate-100 bg-white hover:border-slate-200 transition-colors"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800 text-sm">{cat.name}</span>
                <Badge variant={cat.isActive ? "agri" : "neutral"} className="text-[10px]">
                  {cat.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              {cat.description && (
                <p className="text-xs text-slate-500 mt-0.5">{cat.description}</p>
              )}
              <div className="text-[11px] text-slate-400 mt-1">
                Expenses: {cat.expenseCount || 0} • Total: {formatCurrency(cat.totalAmount || 0)}
              </div>
            </div>

            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => handleToggleActive(cat)}
                className="text-xs h-7"
              >
                {cat.isActive ? "Deactivate" : "Activate"}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-4 mt-2 border-t border-slate-100">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

export function CategoryDialog({
  open,
  onClose,
  categories,
  onRefresh,
}: CategoryDialogProps) {
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(val) => { if (!val) onClose(); }}>
      <CategoryDialogContent
        onClose={onClose}
        categories={categories}
        onRefresh={onRefresh}
      />
    </Dialog>
  );
}
