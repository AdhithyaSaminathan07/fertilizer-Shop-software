"use client";

import * as React from "react";
import {
  TrendingUp,
  Filter,
  RefreshCw,
  PieChart,
  PackageCheck,
  Building,
} from "lucide-react";
import { InventoryNav } from "@/components/inventory/inventory-nav";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { IInventoryValuation } from "@/types/inventory";

export default function InventoryValuationPage() {
  const [data, setData] = React.useState<IInventoryValuation | null>(null);
  const [categories, setCategories] = React.useState<Array<{ _id: string; name: string }>>([]);
  const [categoryId, setCategoryId] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
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
    async function loadValuation() {
      try {
        const params = new URLSearchParams();
        if (categoryId) params.set("categoryId", categoryId);

        const res = await fetch(`/api/inventory/valuation?${params.toString()}`);
        const json = await res.json();
        if (!ignore && res.ok) {
          setData(json.data);
          setError(null);
        } else if (!ignore) {
          setError(json.error?.message || json.message || "Failed to load valuation");
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load valuation");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadValuation();
    return () => {
      ignore = true;
    };
  }, [categoryId, refreshTrigger]);

  const totalVal = data?.totalValuation || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-emerald-600" />
              Inventory Valuation Report
            </h1>
            <p className="text-sm text-slate-500">
              Authoritative stock asset valuation computed using batch and purchase cost data
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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Total Stock Asset Valuation
            </span>
            <div className="text-3xl font-extrabold text-emerald-700 mt-2">
              {loading ? (
                <Skeleton className="h-9 w-36" />
              ) : (
                `₹${totalVal.toLocaleString("en-IN", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">Based on batch-level purchase prices</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Total Units in Stock
            </span>
            <div className="text-3xl font-extrabold text-slate-900 mt-2">
              {loading ? (
                <Skeleton className="h-9 w-28" />
              ) : (
                (data?.totalQuantity || 0).toLocaleString()
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">Across all active catalog items</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Category Distribution
            </span>
            <div className="text-3xl font-extrabold text-slate-800 mt-2">
              {loading ? (
                <Skeleton className="h-9 w-20" />
              ) : (
                data?.byCategory?.length || 0
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1">Active product categories</p>
          </div>
        </div>

        {/* Category Breakdown Table */}
        {data?.byCategory && data.byCategory.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <PieChart className="h-4 w-4 text-emerald-600" />
              Valuation by Product Category
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {data.byCategory.map((cat) => {
                const pct = totalVal > 0 ? Math.round((cat.valuation / totalVal) * 100) : 0;
                return (
                  <div key={cat.categoryId} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                    <div className="font-semibold text-slate-900 flex justify-between">
                      <span className="truncate">{cat.categoryName}</span>
                      <span className="font-mono text-emerald-700">{pct}%</span>
                    </div>
                    <div className="text-slate-600 mt-1">
                      ₹{cat.valuation.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {cat.quantity} units • {cat.productCount} products
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Filter bar */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
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
          <span className="text-xs text-slate-500">
            {data?.byProduct?.length || 0} Products
          </span>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Product-wise Table */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50/75">
              <TableRow>
                <TableHead className="w-64">Product & SKU</TableHead>
                <TableHead className="w-36">Category</TableHead>
                <TableHead className="w-32 text-right">Current Stock</TableHead>
                <TableHead className="w-32 text-right">Avg Unit Cost</TableHead>
                <TableHead className="w-36 text-right">Valuation</TableHead>
                <TableHead className="w-24 text-right">% of Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-44" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : !data?.byProduct || data.byProduct.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-12 text-center text-xs text-slate-500">
                    No products found for valuation.
                  </TableCell>
                </TableRow>
              ) : (
                data.byProduct.map((p) => {
                  const pct = totalVal > 0 ? ((p.valuation / totalVal) * 100).toFixed(1) : "0.0";
                  return (
                    <TableRow key={p.productId} className="hover:bg-slate-50/60 transition-colors">
                      <TableCell>
                        <div className="font-semibold text-slate-900 text-xs">{p.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{p.sku}</div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">{p.categoryName}</TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-800">
                        {p.currentStock} {p.primaryUnit}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-600">
                        ₹{p.averageUnitCost.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-bold text-emerald-700">
                        ₹{p.valuation.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right text-xs text-slate-500 font-mono">
                        {pct}%
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
  );
}

