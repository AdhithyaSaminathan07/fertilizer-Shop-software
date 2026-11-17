"use client";

import * as React from "react";
import {
  SlidersHorizontal,
  Plus,
  RefreshCw,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { InventoryNav } from "@/components/inventory/inventory-nav";
import { StockAdjustmentDialog } from "@/components/inventory/stock-adjustment-dialog";
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
import type { IStockAdjustment, StockAdjustmentReason } from "@/types/inventory";

export default function StockAdjustmentsPage() {
  const [adjustments, setAdjustments] = React.useState<IStockAdjustment[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pages, setPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [reason, setReason] = React.useState<string>("");
  const [type, setType] = React.useState<string>("");
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  React.useEffect(() => {
    let ignore = false;
    async function loadAdjustments() {
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", "20");
        if (reason) params.set("reason", reason);
        if (type) params.set("type", type);

        const res = await fetch(`/api/inventory/adjustments?${params.toString()}`);
        const json = await res.json();
        if (!ignore && res.ok) {
          setAdjustments(json.data?.adjustments || []);
          setTotal(json.data?.total || 0);
          setPages(json.data?.pages || 1);
          setError(null);
        } else if (!ignore) {
          setError(json.error?.message || json.message || "Failed to load adjustments");
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load adjustments");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadAdjustments();
    return () => {
      ignore = true;
    };
  }, [page, reason, type, refreshTrigger]);

  return (
    <div className="space-y-6">
      {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <SlidersHorizontal className="h-6 w-6 text-emerald-600" />
              Stock Adjustments & Write-Offs
            </h1>
            <p className="text-sm text-slate-500">
              Immutable audit history of physical adjustments, damaged goods and write-offs
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLoading(true);
                setRefreshTrigger((prev) => prev + 1);
              }}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="h-4 w-4" />
              New Adjustment / Write-off
            </Button>
          </div>
        </div>

        {/* Tab Subnavigation */}
        <InventoryNav />

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  setPage(1);
                }}
                className="text-xs border border-slate-300 rounded-md p-2 bg-white focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Reasons</option>
                <option value="PHYSICAL_CORRECTION">Physical Count Correction</option>
                <option value="DAMAGED_GOODS">Damaged Goods Write-off</option>
                <option value="EXPIRED_GOODS">Expired Goods Write-off</option>
                <option value="STOCK_LOSS">Stock Loss / Theft</option>
                <option value="DATA_CORRECTION">Data Correction</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
              className="text-xs border border-slate-300 rounded-md p-2 bg-white focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Movement Types</option>
              <option value="INCREASE">+ Increase Only</option>
              <option value="DECREASE">- Decrease (Write-off) Only</option>
            </select>
          </div>

          <div className="text-xs text-slate-500">
            Total records: <span className="font-semibold text-slate-900">{total}</span>
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
                <TableHead className="w-36">Adjustment #</TableHead>
                <TableHead className="w-28">Date</TableHead>
                <TableHead className="w-56">Product & SKU</TableHead>
                <TableHead className="w-28 text-center">Type</TableHead>
                <TableHead className="w-28 text-right">Adjustment</TableHead>
                <TableHead className="w-28 text-right">New Stock</TableHead>
                <TableHead>Reason & Audit Explanation</TableHead>
                <TableHead className="w-32">Recorded By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  </TableRow>
                ))
              ) : adjustments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-xs text-slate-500">
                    No stock adjustments recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                adjustments.map((adj) => {
                  const isInc = adj.type === "INCREASE";
                  return (
                    <TableRow key={adj._id} className="hover:bg-slate-50/60 transition-colors">
                      <TableCell className="font-mono text-xs font-semibold text-slate-900">
                        {adj.adjustmentNumber}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {new Date(adj.date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-slate-900 text-xs">
                          {adj.productSnapshot.name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {adj.productSnapshot.sku}{" "}
                          {adj.batchNumber && (
                            <span className="bg-slate-100 text-slate-700 px-1 rounded ml-1">
                              Batch: {adj.batchNumber}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                            isInc
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {isInc ? (
                            <ArrowDownRight className="h-3 w-3" />
                          ) : (
                            <ArrowUpRight className="h-3 w-3" />
                          )}
                          {adj.type}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`font-bold text-xs ${
                            isInc ? "text-emerald-700" : "text-rose-600"
                          }`}
                        >
                          {isInc ? `+${adj.adjustmentQuantity}` : `-${adj.adjustmentQuantity}`}
                        </span>
                        <div className="text-[10px] text-slate-400">
                          {adj.productSnapshot.primaryUnit}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-slate-800">
                        {adj.newQuantity} {adj.productSnapshot.primaryUnit}
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">
                        <div className="font-semibold text-slate-900">
                          {adj.reason.replace(/_/g, " ")}
                        </div>
                        <div className="text-slate-600 italic mt-0.5 max-w-sm truncate">
                          &ldquo;{adj.explanation}&rdquo;
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-600 font-medium">
                        {adj.createdByName}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {pages > 1 && (
            <div className="p-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <div>
                Page {page} of {pages} ({total} adjustments)
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="h-7 text-xs"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page >= pages}
                  className="h-7 text-xs"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Dialog */}
        <StockAdjustmentDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSuccess={() => {
            setDialogOpen(false);
            setLoading(true);
            setRefreshTrigger((prev) => prev + 1);
          }}
        />
      </div>
  );
}

