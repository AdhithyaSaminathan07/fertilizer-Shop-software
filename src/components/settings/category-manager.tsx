"use client";

import * as React from "react";
import { useState, useEffect, useTransition } from "react";
import {
  Tag,
  Plus,
  Search,
  Edit2,
  Trash2,
  Power,
  Package,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { ICategory } from "@/types/product";

export function CategoryManager() {
  const [categories, setCategories] = useState<ICategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [refreshIndex, setRefreshIndex] = useState(0);

  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<ICategory | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formStatus, setFormStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

  // Load categories
  useEffect(() => {
    let isMounted = true;
    fetch(`/api/categories${search ? `?search=${encodeURIComponent(search)}` : ""}`, {
      credentials: "same-origin",
    })
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          if (data.success && data.data?.categories) {
            setCategories(data.data.categories);
          }
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [search, refreshIndex]);

  const handleOpenAdd = () => {
    setFormName("");
    setFormDesc("");
    setFormStatus("ACTIVE");
    setFormError("");
    setIsAddOpen(true);
  };

  const handleOpenEdit = (cat: ICategory) => {
    setSelectedCategory(cat);
    setFormName(cat.name);
    setFormDesc(cat.description || "");
    setFormStatus(cat.status);
    setFormError("");
    setIsEditOpen(true);
  };

  const handleOpenDelete = (cat: ICategory) => {
    setSelectedCategory(cat);
    setFormError("");
    setIsDeleteOpen(true);
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError("Category name is required");
      return;
    }
    setFormError("");
    startTransition(async () => {
      try {
        const res = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            name: formName.trim(),
            description: formDesc.trim() || undefined,
            status: formStatus,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setFormError(data.error?.message || data.error || data.message || "Failed to create category");
          return;
        }
        setIsAddOpen(false);
        setRefreshIndex((p) => p + 1);
      } catch {
        setFormError("Network communication error");
      }
    });
  };

  const handleUpdateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory) return;
    if (!formName.trim()) {
      setFormError("Category name is required");
      return;
    }
    setFormError("");
    startTransition(async () => {
      try {
        const res = await fetch(`/api/categories/${selectedCategory._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            name: formName.trim(),
            description: formDesc.trim() || undefined,
            status: formStatus,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setFormError(data.error?.message || data.error || data.message || "Failed to update category");
          return;
        }
        setIsEditOpen(false);
        setRefreshIndex((p) => p + 1);
      } catch {
        setFormError("Network communication error");
      }
    });
  };

  const handleToggleStatus = (cat: ICategory) => {
    const nextStatus = cat.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    startTransition(async () => {
      try {
        const res = await fetch(`/api/categories/${cat._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ status: nextStatus }),
        });
        if (res.ok) {
          setRefreshIndex((p) => p + 1);
        }
      } catch {
        // Silently handle
      }
    });
  };

  const handleDeleteCategory = () => {
    if (!selectedCategory) return;
    setFormError("");
    startTransition(async () => {
      try {
        const res = await fetch(`/api/categories/${selectedCategory._id}`, {
          method: "DELETE",
          credentials: "same-origin",
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setFormError(data.error?.message || data.error || data.message || "Cannot delete category");
          return;
        }
        setIsDeleteOpen(false);
        setRefreshIndex((p) => p + 1);
      } catch {
        setFormError("Network communication error");
      }
    });
  };

  const activeCount = categories.filter((c) => c.status === "ACTIVE").length;
  const totalProducts = categories.reduce((acc, c) => acc + (c.productCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Tag className="w-5 h-5 text-emerald-700" />
            Category Management
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Organize fertilizers, pesticides, seeds, bio-products, tools, and agricultural equipment.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshIndex((p) => p + 1)}
            disabled={loading}
            className="min-h-[38px] sm:min-h-[34px] flex-1 sm:flex-initial text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleOpenAdd}
            className="bg-emerald-700 hover:bg-emerald-800 text-white min-h-[38px] sm:min-h-[34px] flex-1 sm:flex-initial text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Categories</p>
              <p className="text-xl font-bold text-slate-900">{categories.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Categories</p>
              <p className="text-xl font-bold text-emerald-700">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Linked Products</p>
              <p className="text-xl font-bold text-blue-700">{totalProducts}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-sm sm:text-base font-semibold text-slate-800">
            All Categories ({categories.length})
          </CardTitle>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search categories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs sm:text-sm h-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 animate-spin text-emerald-700" />
              Loading category directory...
            </div>
          ) : categories.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Tag className="w-8 h-8 text-slate-400" />}
                title="No categories found"
                description={search ? "No categories match your search terms." : "Create your first category to start classifying products."}
                action={
                  <Button size="sm" onClick={handleOpenAdd} className="bg-emerald-700 text-white text-xs">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Category
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/70 text-xs">
                    <TableHead className="font-semibold text-slate-700">Category Name</TableHead>
                    <TableHead className="font-semibold text-slate-700 hidden sm:table-cell">Slug</TableHead>
                    <TableHead className="font-semibold text-slate-700">Products</TableHead>
                    <TableHead className="font-semibold text-slate-700">Status</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((cat) => (
                    <TableRow key={cat._id} className="hover:bg-slate-50/50">
                      <TableCell className="py-3">
                        <div className="font-semibold text-slate-900 text-xs sm:text-sm">{cat.name}</div>
                        {cat.description && (
                          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{cat.description}</div>
                        )}
                      </TableCell>
                      <TableCell className="py-3 hidden sm:table-cell text-xs font-mono text-slate-500">
                        {cat.slug}
                      </TableCell>
                      <TableCell className="py-3 text-xs">
                        <Badge variant="neutral" size="sm" className="font-semibold">
                          {cat.productCount || 0} items
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3">
                        <Badge
                          variant={cat.status === "ACTIVE" ? "success" : "neutral"}
                          size="sm"
                          className="cursor-pointer"
                          onClick={() => handleToggleStatus(cat)}
                          title="Click to toggle status"
                        >
                          {cat.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(cat)}
                            className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900"
                            title="Edit Category"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(cat)}
                            className={`h-8 w-8 p-0 ${cat.status === "ACTIVE" ? "text-amber-600 hover:text-amber-700" : "text-emerald-600 hover:text-emerald-700"}`}
                            title={cat.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDelete(cat)}
                            className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700"
                            title="Delete Category"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        title="Add New Category"
        description="Create a category to group agricultural catalog items."
      >
        <form onSubmit={handleCreateCategory} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Category Name *</label>
            <Input
              type="text"
              placeholder="e.g. Bio-Fertilizers, Hybrid Seeds, Insecticides"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="text-sm"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Description (Optional)</label>
            <textarea
              rows={2}
              placeholder="Optional notes or details about this product group..."
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none text-slate-800"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Status</label>
            <select
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as "ACTIVE" | "INACTIVE")}
              className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          {formError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {formError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsAddOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="bg-emerald-700 text-white" disabled={isPending}>
              {isPending ? "Creating..." : "Create Category"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        title="Edit Category"
        description="Update category name, description or status."
      >
        <form onSubmit={handleUpdateCategory} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Category Name *</label>
            <Input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="text-sm"
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Description</label>
            <textarea
              rows={2}
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none text-slate-800"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Status</label>
            <select
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as "ACTIVE" | "INACTIVE")}
              className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          {formError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {formError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsEditOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" size="sm" className="bg-emerald-700 text-white" disabled={isPending}>
              {isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Delete / Safe Removal Dialog */}
      <Dialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title="Delete Category"
        description={`Are you sure you want to permanently delete category "${selectedCategory?.name}"?`}
      >
        <div className="space-y-4">
          {selectedCategory && (selectedCategory.productCount || 0) > 0 ? (
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
              <p className="font-semibold flex items-center gap-1.5 text-amber-800">
                <AlertCircle className="w-4 h-4 shrink-0" />
                Deletion Blocked by Data Integrity Guard
              </p>
              <p className="leading-relaxed text-amber-800/90">
                This category currently contains <strong>{selectedCategory.productCount} product(s)</strong>.
                Deleting it would orphan inventory records. Please deactivate this category instead or reassign
                its products.
              </p>
            </div>
          ) : (
            <p className="text-xs text-slate-600">
              This category has no associated products. Deletion is irreversible.
            </p>
          )}

          {formError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              {formError}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsDeleteOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeleteCategory}
              disabled={isPending || ((selectedCategory?.productCount || 0) > 0)}
            >
              {isPending ? "Deleting..." : "Confirm Delete"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
