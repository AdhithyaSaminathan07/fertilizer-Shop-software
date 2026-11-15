"use client";

import * as React from "react";
import { useState, useEffect, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
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

export default function CategoriesPage() {
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
    fetch(`/api/categories${search ? `?search=${encodeURIComponent(search)}` : ""}`)
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
          body: JSON.stringify({
            name: formName.trim(),
            description: formDesc.trim() || undefined,
            status: formStatus,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setFormError(data.error || "Failed to create category");
          return;
        }
        setIsAddOpen(false);
        setRefreshIndex((prev) => prev + 1);
      } catch {
        setFormError("An unexpected network error occurred.");
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
          body: JSON.stringify({
            name: formName.trim(),
            description: formDesc.trim() || undefined,
            status: formStatus,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setFormError(data.error || "Failed to update category");
          return;
        }
        setIsEditOpen(false);
        setRefreshIndex((prev) => prev + 1);
      } catch {
        setFormError("An unexpected network error occurred.");
      }
    });
  };

  const handleToggleStatus = (cat: ICategory) => {
    const nextStatus = cat.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    startTransition(async () => {
      try {
        await fetch(`/api/categories/${cat._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: nextStatus }),
        });
        setRefreshIndex((prev) => prev + 1);
      } catch {
        // silent catch
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
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setFormError(data.error || "Failed to delete category");
          return;
        }
        setIsDeleteOpen(false);
        setRefreshIndex((prev) => prev + 1);
      } catch {
        setFormError("An unexpected network error occurred.");
      }
    });
  };

  const activeCount = categories.filter((c) => c.status === "ACTIVE").length;
  const totalProducts = categories.reduce((sum, c) => sum + (c.productCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Tag className="w-6 h-6 text-[#176B3A]" />
            Category Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Organize fertilizers, pesticides, seeds, organic manure and agricultural equipment.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshIndex((p) => p + 1)}
            disabled={loading}
            className="min-h-[40px] sm:min-h-[36px] flex-1 sm:flex-initial"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleOpenAdd}
            className="bg-[#176B3A] hover:bg-[#12542D] text-white min-h-[40px] sm:min-h-[36px] flex-1 sm:flex-initial"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#EBF5EE] text-[#176B3A] flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Categories</p>
              <p className="text-xl font-bold text-slate-900">{categories.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Categories</p>
              <p className="text-xl font-bold text-emerald-700">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Catalog Products</p>
              <p className="text-xl font-bold text-blue-700">{totalProducts}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle className="text-base font-semibold text-slate-800">
            All Product Categories
          </CardTitle>
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search category name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#176B3A] mb-2" />
              Loading categories...
            </div>
          ) : categories.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Tag className="w-6 h-6" />}
                title="No categories found"
                description={
                  search
                    ? `No categories matching "${search}"`
                    : "Create your first category (e.g. Chemical Fertilizers, Organic Manure, Seeds, Pesticides)."
                }
                action={
                  <Button size="sm" onClick={handleOpenAdd} className="bg-[#176B3A] text-white">
                    <Plus className="w-4 h-4 mr-1" />
                    Create First Category
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="w-64 font-semibold text-slate-700">Category Name</TableHead>
                    <TableHead className="font-semibold text-slate-700">Description</TableHead>
                    <TableHead className="w-36 font-semibold text-slate-700 text-center">Products</TableHead>
                    <TableHead className="w-32 font-semibold text-slate-700 text-center">Status</TableHead>
                    <TableHead className="w-36 text-right font-semibold text-slate-700">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {categories.map((cat) => (
                      <motion.tr
                        key={cat._id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors"
                      >
                        <TableCell className="font-medium text-slate-900 py-3.5">
                          <div>
                            <span className="font-semibold">{cat.name}</span>
                            <span className="block text-xs font-mono text-slate-400 mt-0.5">
                              slug: {cat.slug}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-600 text-sm py-3.5">
                          {cat.description || (
                            <span className="text-slate-400 italic">No description provided</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center py-3.5">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700">
                            {cat.productCount || 0} Products
                          </span>
                        </TableCell>
                        <TableCell className="text-center py-3.5">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(cat)}
                            title="Click to toggle status"
                            className="cursor-pointer"
                          >
                            <Badge
                              variant={cat.status === "ACTIVE" ? "agri" : "neutral"}
                              className="capitalize hover:opacity-85"
                            >
                              {cat.status.toLowerCase()}
                            </Badge>
                          </button>
                        </TableCell>
                        <TableCell className="text-right py-3.5">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900"
                              onClick={() => handleOpenEdit(cat)}
                              title="Edit Category"
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900"
                              onClick={() => handleToggleStatus(cat)}
                              title={cat.status === "ACTIVE" ? "Deactivate" : "Activate"}
                            >
                              <Power className={`w-4 h-4 ${cat.status === "ACTIVE" ? "text-emerald-600" : "text-slate-400"}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-rose-600 hover:text-rose-800 hover:bg-rose-50"
                              onClick={() => handleOpenDelete(cat)}
                              title="Delete Category"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Category Dialog */}
      <Dialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        title={
          <span className="flex items-center gap-2 text-slate-900">
            <Tag className="w-5 h-5 text-[#176B3A]" />
            Add New Product Category
          </span>
        }
        description="Define a category for organizing farm stock. Category names must be unique."
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateCategory} className="bg-[#176B3A] text-white" disabled={isPending}>
              {isPending ? "Creating..." : "Save Category"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Category Name *</label>
            <Input
              type="text"
              placeholder="e.g. Chemical Fertilizers, Hybrid Seeds"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Description (Optional)</label>
            <textarea
              className="w-full text-sm border border-slate-300 rounded-md p-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#176B3A] min-h-[80px]"
              placeholder="Brief note about the category or usage types..."
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Initial Status</label>
            <select
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as "ACTIVE" | "INACTIVE")}
              className="w-full text-sm border border-slate-300 rounded-md p-2 focus:outline-hidden focus:ring-2 focus:ring-[#176B3A]"
            >
              <option value="ACTIVE">Active (Available for products)</option>
              <option value="INACTIVE">Inactive (Hidden)</option>
            </select>
          </div>
        </div>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        title={
          <span className="flex items-center gap-2 text-slate-900">
            <Edit2 className="w-5 h-5 text-[#176B3A]" />
            Edit Category
          </span>
        }
        description="Modify category name, description, or activation status."
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button type="button" onClick={handleUpdateCategory} className="bg-[#176B3A] text-white" disabled={isPending}>
              {isPending ? "Updating..." : "Update Category"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Category Name *</label>
            <Input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Description</label>
            <textarea
              className="w-full text-sm border border-slate-300 rounded-md p-2.5 focus:outline-hidden focus:ring-2 focus:ring-[#176B3A] min-h-[80px]"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Status</label>
            <select
              value={formStatus}
              onChange={(e) => setFormStatus(e.target.value as "ACTIVE" | "INACTIVE")}
              className="w-full text-sm border border-slate-300 rounded-md p-2 focus:outline-hidden focus:ring-2 focus:ring-[#176B3A]"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        title={
          <span className="flex items-center gap-2 text-rose-700">
            <AlertCircle className="w-5 h-5" />
            Delete Category
          </span>
        }
        description={`Are you sure you want to permanently delete category "${selectedCategory?.name}"?`}
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button type="button" variant="outline" onClick={() => setIsDeleteOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteCategory}
              disabled={isPending || ((selectedCategory?.productCount || 0) > 0)}
            >
              {isPending ? "Deleting..." : "Confirm Delete"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          {selectedCategory && (selectedCategory.productCount || 0) > 0 ? (
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm space-y-2">
              <p className="font-semibold flex items-center gap-1.5 text-amber-800">
                <AlertCircle className="w-4 h-4" />
                Deletion Blocked by Data Integrity Guard
              </p>
              <p className="text-xs leading-relaxed text-amber-800/90">
                This category currently contains <strong>{selectedCategory.productCount} product(s)</strong>.
                Deleting it would orphan inventory records. Please deactivate this category instead or reassign
                its products.
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              This category has no associated products. Deletion is irreversible.
            </p>
          )}

          {formError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              {formError}
            </div>
          )}
        </div>
      </Dialog>
    </div>
  );
}
