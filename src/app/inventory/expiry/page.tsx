"use client";

import * as React from "react";
import {
  ClockAlert,
  Search,
  Filter,
  Trash2,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { InventoryNav } from "@/components/inventory/inventory-nav";
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
import type { IExpiryBatchItem, ExpiryBucket } from "@/types/inventory";

export default function ExpiryMonitorPage() {
  const [batches, setBatches] = React.useState<IExpiryBatchItem[]>([]);
  const [categories, setCategories] = React.useState<Array<{ _id: string; name: string }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [expiryBucket, setExpiryBucket] = React.useState<ExpiryBucket | "ALL">("ALL");

  const [selectedBatchForWriteoff, setSelectedBatchForWriteoff] = React.useState<IExpiryBatchItem | null>(null);
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
    async function loadBatches() {
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (categoryId) params.set("categoryId", categoryId);
        if (expiryBucket !== "ALL") params.set("expiryBucket", expiryBucket);

        const res = await fetch(`/api/inventory/expiry?${params.toString()}`);
        const json = await res.json();
        if (!ignore && res.ok) {
          setBatches(json.data?.batches || []);
          setError(null);
        } else if (!ignore) {
          setError(json.error?.message || json.message || "Failed to load expiry monitor");
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load expiry monitor");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadBatches();
    return () => {
      ignore = true;
    };
  }, [search, categoryId, expiryBucket, refreshTrigger]);

  // Metric counts
  const expiredCount = batches.filter((b) => b.expiryBucket === "EXPIRED").length;
  const criticalCount = batches.filter((b) => b.expiryBucket === "EXPIRING_7D").length;
  const warningCount = batches.filter((b) => b.expiryBucket === "EXPIRING_30D").length;
  const sixtyCount = batches.filter((b) => b.expiryBucket === "EXPIRING_60D").length;

  return (
    <div className="space-y-6">
      {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <ClockAlert className="h-6 w-6 text-rose-600" />
              Batch Expiry Monitoring & FEFO Tracking
            </h1>
            <p className="text-sm text-slate-500">
              Track expiring batches to prevent write-offs and enforce FEFO sales allocation
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

        {/* Bucket KPI Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div
            onClick={() => setExpiryBucket(expiryBucket === "EXPIRED" ? "ALL" : "EXPIRED")}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              expiryBucket === "EXPIRED"
                ? "bg-rose-100/60 border-rose-500 ring-2 ring-rose-400"
                : "bg-white border-slate-200 hover:border-rose-300"
            }`}
          >
            <span className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider block">
              Expired (Blocked)
            </span>
            <div className="text-xl font-bold text-rose-700 mt-1">{expiredCount}</div>
            <span className="text-[10px] text-slate-500">Cannot be sold</span>
          </div>

          <div
            onClick={() => setExpiryBucket(expiryBucket === "EXPIRING_7D" ? "ALL" : "EXPIRING_7D")}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              expiryBucket === "EXPIRING_7D"
                ? "bg-orange-100/60 border-orange-500 ring-2 ring-orange-400"
                : "bg-white border-slate-200 hover:border-orange-300"
            }`}
          >
            <span className="text-[11px] font-semibold text-orange-700 uppercase tracking-wider block">
              Expiring in ≤ 7 Days
            </span>
            <div className="text-xl font-bold text-orange-700 mt-1">{criticalCount}</div>
            <span className="text-[10px] text-slate-500">Critical clearance</span>
          </div>

          <div
            onClick={() => setExpiryBucket(expiryBucket === "EXPIRING_30D" ? "ALL" : "EXPIRING_30D")}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              expiryBucket === "EXPIRING_30D"
                ? "bg-amber-100/60 border-amber-500 ring-2 ring-amber-400"
                : "bg-white border-slate-200 hover:border-amber-300"
            }`}
          >
            <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block">
              Expiring in 8–30 Days
            </span>
            <div className="text-xl font-bold text-amber-700 mt-1">{warningCount}</div>
            <span className="text-[10px] text-slate-500">Priority sale recommendation</span>
          </div>

          <div
            onClick={() => setExpiryBucket(expiryBucket === "EXPIRING_60D" ? "ALL" : "EXPIRING_60D")}
            className={`p-3 rounded-lg border cursor-pointer transition-all ${
              expiryBucket === "EXPIRING_60D"
                ? "bg-blue-100/60 border-blue-500 ring-2 ring-blue-400"
                : "bg-white border-slate-200 hover:border-blue-300"
            }`}
          >
            <span className="text-[11px] font-semibold text-blue-700 uppercase tracking-wider block">
              Expiring in 31–60 Days
            </span>
            <div className="text-xl font-bold text-blue-700 mt-1">{sixtyCount}</div>
            <span className="text-[10px] text-slate-500">Medium warning</span>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product, batch number or SKU..."
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
              value={expiryBucket}
              onChange={(e) => setExpiryBucket(e.target.value as any)}
              className="text-xs border border-slate-300 rounded-md p-2 bg-white focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ALL">All Expiry Windows</option>
              <option value="EXPIRED">Expired Only</option>
              <option value="EXPIRING_7D">≤ 7 Days</option>
              <option value="EXPIRING_30D">8–30 Days</option>
              <option value="EXPIRING_60D">31–60 Days</option>
              <option value="EXPIRING_LATER">&gt; 60 Days</option>
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
                <TableHead className="w-56">Batch & Product</TableHead>
                <TableHead className="w-36">Category</TableHead>
                <TableHead className="w-28 text-right">Batch Stock</TableHead>
                <TableHead className="w-32 text-right">Valuation</TableHead>
                <TableHead className="w-32">Expiry Date</TableHead>
                <TableHead className="w-32 text-center">Status Window</TableHead>
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : batches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-xs text-slate-500">
                    No active batches found matching the selected expiry filters.
                  </TableCell>
                </TableRow>
              ) : (
                batches.map((b) => {
                  const isExpired = b.expiryBucket === "EXPIRED";
                  const is7d = b.expiryBucket === "EXPIRING_7D";
                  const is30d = b.expiryBucket === "EXPIRING_30D";

                  return (
                    <TableRow key={b.batchId} className="hover:bg-slate-50/60 transition-colors">
                      <TableCell>
                        <div className="font-semibold text-slate-900 text-xs flex items-center gap-1.5">
                          <span className="font-mono bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded">
                            {b.batchNumber}
                          </span>
                          <span>{b.productName}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">{b.sku}</div>
                      </TableCell>
                      <TableCell className="text-xs text-slate-700">{b.categoryName}</TableCell>
                      <TableCell className="text-right">
                        <span className="font-bold text-xs text-slate-900">
                          {b.quantity} {b.primaryUnit}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-semibold text-xs text-slate-800">
                          ₹{b.totalValuation.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                        <div className="text-[10px] text-slate-400">@ ₹{b.unitCost}/{b.primaryUnit}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium text-slate-900">
                          {new Date(b.expiryDate).toLocaleDateString("en-IN", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </div>
                        <div
                          className={`text-[11px] font-semibold ${
                            isExpired
                              ? "text-rose-600"
                              : is7d
                              ? "text-orange-600"
                              : is30d
                              ? "text-amber-600"
                              : "text-slate-500"
                          }`}
                        >
                          {isExpired
                            ? `${Math.abs(b.daysRemaining)} days ago`
                            : `${b.daysRemaining} days left`}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${
                            isExpired
                              ? "bg-rose-100 text-rose-800"
                              : is7d
                              ? "bg-orange-100 text-orange-800"
                              : is30d
                              ? "bg-amber-100 text-amber-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {b.expiryBucket.replace(/_/g, " ")}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedBatchForWriteoff(b)}
                          className={`h-7 px-2 text-xs gap-1 ${
                            isExpired
                              ? "border-rose-600 text-rose-700 hover:bg-rose-50"
                              : "border-slate-300 text-slate-700 hover:bg-slate-50"
                          }`}
                          title="Write off this batch stock"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Write-off
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Dialog for batch write-off */}
        <StockAdjustmentDialog
          open={Boolean(selectedBatchForWriteoff)}
          initialProductId={selectedBatchForWriteoff?.productId}
          initialBatchId={selectedBatchForWriteoff?.batchId}
          initialType="DECREASE"
          initialReason={
            selectedBatchForWriteoff?.expiryBucket === "EXPIRED"
              ? "EXPIRED_GOODS"
              : "PHYSICAL_CORRECTION"
          }
          onClose={() => setSelectedBatchForWriteoff(null)}
          onSuccess={() => {
            setSelectedBatchForWriteoff(null);
            setLoading(true);
            setRefreshTrigger((prev) => prev + 1);
          }}
        />
      </div>
  );
}

