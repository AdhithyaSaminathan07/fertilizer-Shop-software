"use client";

import * as React from "react";
import {
  AlertTriangle,
  Search,
  Filter,
  SlidersHorizontal,
  Settings2,
  RefreshCw,
} from "lucide-react";
import { InventoryNav } from "@/components/inventory/inventory-nav";
import { ReorderDialog } from "@/components/inventory/reorder-dialog";
import { StockAdjustmentDialog } from "@/components/inventory/stock-adjustment-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { ILowStockItem } from "@/types/inventory";

export default function LowStockPage() {
  const [items, setItems] = React.useState<ILowStockItem[]>([]);
  const [categories, setCategories] = React.useState<Array<{ _id: string; name: string }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [stockStatus, setStockStatus] = React.useState<"ALL" | "OUT_OF_STOCK" | "LOW_STOCK">("ALL");

  const [selectedProductForReorder, setSelectedProductForReorder] = React.useState<ILowStockItem | null>(null);
  const [selectedProductForAdjustment, setSelectedProductForAdjustment] = React.useState<ILowStockItem | null>(null);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  React.useEffect(() => {
    let ignore = false;
    async function loadCategories() {
      try {
        const res = await fetch("/api/categories");
        const json = await res.json();
        if (!ignore && res.ok) {
          setCategories(json?.data?.categories || json?.categories || []);
        }
      } catch {}
    }
    loadCategories();
    return () => {
      ignore = true;
    };
  }, []);

  React.useEffect(() => {
    let ignore = false;
    async function loadItems() {
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (categoryId) params.set("categoryId", categoryId);
        if (stockStatus !== "ALL") params.set("stockStatus", stockStatus);

        const res = await fetch(`/api/inventory/low-stock?${params.toString()}`);
        const json = await res.json();
        if (!ignore && res.ok) {
          setItems(json.data?.items || []);
          setError(null);
        } else if (!ignore) {
          setError(json.error?.message || json.message || "Failed to load low stock items");
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load low stock items");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadItems();
    return () => {
      ignore = true;
    };
  }, [search, categoryId, stockStatus, refreshTrigger]);

  return (
    <div className="space-y-6">
      {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-amber-500" />
              Low Stock & Reorder Intelligence
            </h1>
            <p className="text-sm text-slate-500">
              Identify depleted stock levels and configure minimum reorder thresholds
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true);
              setRefreshTrigger((prev) => prev + 1);
            }}
            disabled={loading}
            className="gap-1.5 self-start sm:self-auto"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Tab Subnavigation */}
        <InventoryNav />

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name, SKU or brand..."
              className="pl-9 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="text-xs border border-slate-300 rounded-md p-2 bg-white focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Categories</option>
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={stockStatus}
              onChange={(e) => setStockStatus(e.target.value as any)}
              className="text-xs border border-slate-300 rounded-md p-2 bg-white focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Reorder Alerts</option>
              <option value="OUT_OF_STOCK">Out of Stock Only</option>
              <option value="LOW_STOCK">Low Stock Only</option>
            </select>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50/75">
              <TableRow>
                <TableHead className="w-56">Product & SKU</TableHead>
                <TableHead className="w-36">Category / Brand</TableHead>
                <TableHead className="w-32 text-right">Current Stock</TableHead>
                <TableHead className="w-32 text-right">Min Threshold</TableHead>
                <TableHead className="w-32 text-right">Suggested Reorder</TableHead>
                <TableHead className="w-28 text-center">Status</TableHead>
                <TableHead className="w-40 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-xs text-slate-500">
                    No low-stock products found matching criteria. Stock levels are healthy!
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.productId} className="hover:bg-slate-50/60 transition-colors">
                    <TableCell>
                      <div className="font-semibold text-slate-900 text-xs">{item.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">{item.sku}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs text-slate-700">{item.categoryName}</div>
                      {item.brand && <div className="text-[11px] text-slate-500">{item.brand}</div>}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`font-bold text-xs ${
                          item.currentStock <= 0
                            ? "text-rose-600"
                            : item.currentStock <= item.minStockThreshold
                            ? "text-amber-600"
                            : "text-slate-800"
                        }`}
                      >
                        {item.currentStock} {item.primaryUnit}
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-xs text-slate-600 font-mono">
                      {item.minStockThreshold} {item.primaryUnit}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-semibold text-xs text-emerald-700">
                        {item.suggestedReorderQty} {item.primaryUnit}
                      </span>
                      {item.preferredReorderQty ? (
                        <div className="text-[10px] text-slate-400">Pref: {item.preferredReorderQty}</div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                          item.stockStatus === "OUT_OF_STOCK"
                            ? "bg-rose-100 text-rose-800"
                            : item.stockStatus === "LOW_STOCK"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {item.stockStatus.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedProductForReorder(item)}
                          className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900"
                          title="Configure Reorder Settings"
                        >
                          <Settings2 className="h-3.5 w-3.5 mr-1" />
                          Thresholds
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedProductForAdjustment(item)}
                          className="h-7 px-2 text-xs border-emerald-600 text-emerald-700 hover:bg-emerald-50"
                          title="Record Stock Adjustment"
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
                          Adjust
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Dialogs */}
        <ReorderDialog
          open={Boolean(selectedProductForReorder)}
          product={selectedProductForReorder}
          onClose={() => setSelectedProductForReorder(null)}
          onSuccess={() => {
            setSelectedProductForReorder(null);
            setLoading(true);
            setRefreshTrigger((prev) => prev + 1);
          }}
        />

        <StockAdjustmentDialog
          open={Boolean(selectedProductForAdjustment)}
          initialProductId={selectedProductForAdjustment?.productId}
          initialType="INCREASE"
          onClose={() => setSelectedProductForAdjustment(null)}
          onSuccess={() => {
            setSelectedProductForAdjustment(null);
            setLoading(true);
            setRefreshTrigger((prev) => prev + 1);
          }}
        />
      </div>
  );
}

