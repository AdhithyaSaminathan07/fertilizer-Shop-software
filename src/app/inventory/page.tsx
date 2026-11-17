"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Boxes,
  Package,
  AlertTriangle,
  ClockAlert,
  SlidersHorizontal,
  ClipboardCheck,
  TrendingUp,
  History,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
} from "lucide-react";
import { InventoryNav } from "@/components/inventory/inventory-nav";
import { StockAdjustmentDialog } from "@/components/inventory/stock-adjustment-dialog";
import { StockCountDialog } from "@/components/inventory/stock-count-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { IInventoryOverview } from "@/types/inventory";

export default function InventoryOverviewPage() {
  const router = useRouter();
  const [data, setData] = React.useState<IInventoryOverview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [adjustmentDialogOpen, setAdjustmentDialogOpen] = React.useState(false);
  const [stockCountDialogOpen, setStockCountDialogOpen] = React.useState(false);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  React.useEffect(() => {
    let ignore = false;
    async function loadOverview() {
      try {
        const res = await fetch("/api/inventory/overview");
        const json = await res.json();
        if (!ignore && res.ok) {
          setData(json.data);
          setError(null);
        } else if (!ignore) {
          setError(json.error?.message || json.message || "Failed to load overview");
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load overview");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadOverview();
    return () => {
      ignore = true;
    };
  }, [refreshTrigger]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Boxes className="h-6 w-6 text-emerald-600" />
            Inventory Intelligence & Overview
          </h1>
          <p className="text-sm text-slate-500">
            Live stock levels, valuation, reorder intelligence and batch tracking
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
              variant="outline"
              size="sm"
              onClick={() => setAdjustmentDialogOpen(true)}
              className="gap-1.5 border-emerald-600 text-emerald-700 hover:bg-emerald-50"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Stock Adjustment
            </Button>
            <Button
              size="sm"
              onClick={() => setStockCountDialogOpen(true)}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <ClipboardCheck className="h-4 w-4" />
              Physical Count
            </Button>
          </div>
        </div>

        {/* Tab Subnavigation */}
        <InventoryNav />

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Catalog Products */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Active Catalog
              </span>
              <Package className="h-5 w-5 text-slate-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <span className="text-2xl font-bold text-slate-900">
                  {data?.totalActiveProducts ?? 0}
                </span>
              )}
              <span className="text-xs text-slate-500">products</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Total items: {loading ? "..." : (data?.totalStockQuantity ?? 0).toLocaleString()} units
            </p>
          </div>

          {/* Total Inventory Valuation */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Stock Valuation
              </span>
              <TrendingUp className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              {loading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <span className="text-2xl font-bold text-emerald-700">
                  ₹{(data?.totalInventoryValuation ?? 0).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              )}
            </div>
            <Link
              href="/inventory/valuation"
              className="text-xs text-emerald-600 hover:text-emerald-700 font-medium mt-2 inline-flex items-center gap-1"
            >
              View detailed valuation <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Low Stock & Out of Stock */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Reorder Alerts
              </span>
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <span className="text-2xl font-bold text-amber-600">
                  {(data?.lowStockCount ?? 0) + (data?.outOfStockCount ?? 0)}
                </span>
              )}
              <span className="text-xs text-slate-500">needs reorder</span>
            </div>
            <div className="text-xs text-slate-600 mt-2 flex gap-3">
              <span className="text-rose-600 font-medium">
                {loading ? "..." : data?.outOfStockCount ?? 0} Out of stock
              </span>
              <span>•</span>
              <span className="text-amber-600 font-medium">
                {loading ? "..." : data?.lowStockCount ?? 0} Low stock
              </span>
            </div>
          </div>

          {/* Batch Expiry Alerts */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Expiry Monitoring
              </span>
              <ClockAlert className="h-5 w-5 text-rose-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              {loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <span className="text-2xl font-bold text-rose-600">
                  {(data?.nearExpiryBatchesCount ?? 0) + (data?.expiredBatchesCount ?? 0)}
                </span>
              )}
              <span className="text-xs text-slate-500">batches</span>
            </div>
            <div className="text-xs text-slate-600 mt-2 flex gap-3">
              <span className="text-rose-700 font-semibold">
                {loading ? "..." : data?.expiredBatchesCount ?? 0} Expired
              </span>
              <span>•</span>
              <span className="text-amber-600 font-medium">
                {loading ? "..." : data?.nearExpiryBatchesCount ?? 0} Near expiry
              </span>
            </div>
          </div>
        </div>

        {/* Two-column layout: Recent Inwards & Movements */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recently Received Stock */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Recently Received Inwards</h3>
                <p className="text-xs text-slate-500">Latest confirmed supplier purchase receipts</p>
              </div>
              <Link
                href="/purchases"
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-1"
              >
                All purchases <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : !data?.recentlyReceivedStock || data.recentlyReceivedStock.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No recent purchase inwards recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.recentlyReceivedStock.map((rec, idx) => (
                  <div key={idx} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-semibold text-slate-900">{rec.purchaseNumber}</p>
                      <p className="text-slate-500">{rec.supplierName}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-800">
                        {rec.totalQuantity} units ({rec.itemCount} items)
                      </p>
                      <p className="text-slate-400">
                        {new Date(rec.inwardDate).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Unified Movement Ledger Activity */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Latest Stock Movements</h3>
                <p className="text-xs text-slate-500">Real-time ledger of inwards, sales & adjustments</p>
              </div>
              <Link
                href="/inventory/movements"
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-1"
              >
                Full ledger <History className="h-3 w-3" />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : !data?.recentMovements || data.recentMovements.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No recent stock movements recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {data.recentMovements.slice(0, 7).map((m) => {
                  const isIn = m.quantityIn > 0;
                  return (
                    <div key={m.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`mt-0.5 p-1 rounded ${
                            isIn ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                          }`}
                        >
                          {isIn ? (
                            <ArrowDownRight className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{m.productName}</p>
                          <p className="text-[11px] text-slate-500">
                            Ref: {m.sourceReference} • {m.movementType.replace(/_/g, " ")}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-bold ${
                            isIn ? "text-emerald-700" : "text-rose-600"
                          }`}
                        >
                          {isIn ? `+${m.quantityIn}` : `-${m.quantityOut}`} {m.unit}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {new Date(m.date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Dialogs */}
        <StockAdjustmentDialog
          open={adjustmentDialogOpen}
          onClose={() => setAdjustmentDialogOpen(false)}
          onSuccess={() => {
            setAdjustmentDialogOpen(false);
            setLoading(true);
            setRefreshTrigger((prev) => prev + 1);
          }}
        />

        <StockCountDialog
          open={stockCountDialogOpen}
          onClose={() => setStockCountDialogOpen(false)}
          onSuccess={() => {
            setStockCountDialogOpen(false);
            router.push(`/inventory/stock-count`);
          }}
        />
      </div>
  );
}

