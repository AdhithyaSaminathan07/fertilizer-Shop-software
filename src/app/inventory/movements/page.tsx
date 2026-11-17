"use client";

import * as React from "react";
import {
  History,
  Filter,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
} from "lucide-react";
import { InventoryNav } from "@/components/inventory/inventory-nav";
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
import type { IStockMovement, StockMovementType } from "@/types/inventory";

export default function StockMovementsPage() {
  const [movements, setMovements] = React.useState<IStockMovement[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pages, setPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [movementType, setMovementType] = React.useState<string>("ALL");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");

  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  React.useEffect(() => {
    let ignore = false;
    async function loadMovements() {
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", "25");
        if (movementType !== "ALL") params.set("movementType", movementType);
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);

        const res = await fetch(`/api/inventory/movements?${params.toString()}`);
        const json = await res.json();
        if (!ignore && res.ok) {
          setMovements(json.data?.movements || []);
          setTotal(json.data?.total || 0);
          setPages(json.data?.pages || 1);
          setError(null);
        } else if (!ignore) {
          setError(json.error?.message || json.message || "Failed to load movements");
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load movements");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadMovements();
    return () => {
      ignore = true;
    };
  }, [page, movementType, startDate, endDate, refreshTrigger]);

  return (
    <div className="space-y-6">
      {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <History className="h-6 w-6 text-emerald-600" />
              Unified Stock Movement History
            </h1>
            <p className="text-sm text-slate-500">
              Audit trail combining purchase inwards, sales deductions, cancellations, and physical adjustments
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
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-wrap gap-3 items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={movementType}
                onChange={(e) => {
                  setMovementType(e.target.value);
                  setPage(1);
                }}
                className="text-xs border border-slate-300 rounded-md p-2 bg-white focus:ring-2 focus:ring-emerald-500"
              >
                <option value="ALL">All Movement Types</option>
                <option value="PURCHASE_INWARD">Purchase Inward (+)</option>
                <option value="SALE_DEDUCTION">Sale Deduction (-)</option>
                <option value="SALE_CANCELLATION_RESTORE">Sale Cancelled (+)</option>
                <option value="STOCK_ADJUSTMENT_INCREASE">Stock Adjustment (+)</option>
                <option value="STOCK_ADJUSTMENT_DECREASE">Stock Adjustment (-)</option>
                <option value="DAMAGE_WRITEOFF">Damage Write-off (-)</option>
                <option value="EXPIRED_WRITEOFF">Expired Write-off (-)</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Calendar className="h-4 w-4 text-slate-400" />
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="h-8 text-xs w-32"
              />
              <span>to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="h-8 text-xs w-32"
              />
            </div>
          </div>

          <div className="text-xs text-slate-500">
            Total movements: <span className="font-semibold text-slate-900">{total}</span>
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
                <TableHead className="w-36">Timestamp</TableHead>
                <TableHead className="w-56">Product & SKU</TableHead>
                <TableHead className="w-36">Movement Type</TableHead>
                <TableHead className="w-24 text-right">In (+)</TableHead>
                <TableHead className="w-24 text-right">Out (-)</TableHead>
                <TableHead className="w-36">Reference</TableHead>
                <TableHead>Audit Notes & Handler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                  </TableRow>
                ))
              ) : movements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-xs text-slate-500">
                    No stock movements found matching criteria.
                  </TableCell>
                </TableRow>
              ) : (
                movements.map((m) => {
                  const isIn = m.quantityIn > 0;
                  return (
                    <TableRow key={m.id} className="hover:bg-slate-50/60 transition-colors">
                      <TableCell className="text-xs text-slate-600">
                        <div>
                          {new Date(m.date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(m.date).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-slate-900 text-xs">{m.productName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {m.sku}{" "}
                          {m.batchNumber && (
                            <span className="bg-slate-100 text-slate-700 px-1 rounded ml-1">
                              Batch: {m.batchNumber}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            isIn
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {isIn ? (
                            <ArrowDownRight className="h-3 w-3" />
                          ) : (
                            <ArrowUpRight className="h-3 w-3" />
                          )}
                          {m.movementType.replace(/_/g, " ")}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {isIn ? (
                          <span className="font-bold text-xs text-emerald-700">
                            +{m.quantityIn} {m.unit}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!isIn ? (
                          <span className="font-bold text-xs text-rose-600">
                            -{m.quantityOut} {m.unit}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-slate-800">
                        {m.sourceReference}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        <div className="font-medium text-slate-800">{m.notes}</div>
                        <div className="text-[11px] text-slate-400">Recorded: {m.recordedByName}</div>
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
                Page {page} of {pages} ({total} movements)
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
      </div>
  );
}

