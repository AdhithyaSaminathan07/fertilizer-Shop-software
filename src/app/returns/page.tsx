"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RotateCcw,
  Receipt,
  Truck,
  ClockAlert,
  CheckCircle2,
  TrendingDown,
  Plus,
  RefreshCw,
  ArrowUpRight,
} from "lucide-react";
import { ReturnsNav } from "@/components/returns/returns-nav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { IReturnsOverview } from "@/types/returns";

export default function ReturnsDashboardPage() {
  const router = useRouter();
  const [data, setData] = React.useState<IReturnsOverview | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  React.useEffect(() => {
    let ignore = false;
    async function loadOverview() {
      try {
        const res = await fetch("/api/returns/overview");
        const json = await res.json();
        if (!ignore && res.ok) {
          setData(json.data);
          setError(null);
        } else if (!ignore) {
          setError(json.error?.message || json.message || "Failed to load returns overview");
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load returns overview");
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <RotateCcw className="h-6 w-6 text-emerald-600" />
              Returns Management
            </h1>
            <p className="text-sm text-slate-500">
              Independent sales returns, supplier purchase returns, and refund processing
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLoading(true);
                setRefreshTrigger((p) => p + 1);
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
              onClick={() => router.push("/returns/purchases/new")}
              className="gap-1.5 border-emerald-600 text-emerald-700 hover:bg-emerald-50"
            >
              <Truck className="h-4 w-4" />
              Supplier Return
            </Button>
            <Button
              size="sm"
              onClick={() => router.push("/returns/sales/new")}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="h-4 w-4" />
              Customer Sales Return
            </Button>
          </div>
        </div>

        {/* Tab Subnavigation */}
        <ReturnsNav />

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Sales Returns (Customer)
              </span>
              <Receipt className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              {loading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <span className="text-2xl font-bold text-slate-900">
                  ₹{(data?.totalSalesReturnsValue ?? 0).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {loading ? "..." : data?.totalSalesReturnsCount ?? 0} total sales return requests
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Purchase Returns (Supplier)
              </span>
              <Truck className="h-5 w-5 text-blue-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              {loading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <span className="text-2xl font-bold text-slate-900">
                  ₹{(data?.totalPurchaseReturnsValue ?? 0).toLocaleString("en-IN", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {loading ? "..." : data?.totalPurchaseReturnsCount ?? 0} total purchase return requests
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Pending Approvals
              </span>
              <ClockAlert className="h-5 w-5 text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <span className="text-2xl font-bold text-amber-600">
                  {data?.pendingApprovalsCount ?? 0}
                </span>
              )}
              <span className="text-xs text-slate-500">requests</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">Awaiting manager review</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Approved Returns
              </span>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              {loading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <span className="text-2xl font-bold text-emerald-700">
                  {data?.approvedReturnsCount ?? 0}
                </span>
              )}
              <span className="text-xs text-slate-500">processed</span>
            </div>
            <p className="text-xs text-slate-500 mt-2">Completed and verified</p>
          </div>
        </div>

        {/* Two-Column: Recent Sales Returns & Recent Purchase Returns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Customer Sales Returns */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Recent Customer Returns</h3>
                <p className="text-xs text-slate-500">Issued customer return requests and credit notes</p>
              </div>
              <Link
                href="/returns/sales"
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-1"
              >
                View all <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : !data?.recentSalesReturns || data.recentSalesReturns.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No customer sales returns recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.recentSalesReturns.map((sr) => (
                  <div
                    key={sr._id || sr.id}
                    onClick={() => router.push(`/returns/sales/${sr._id || sr.id}`)}
                    className="py-3 flex items-center justify-between text-xs hover:bg-slate-50/75 p-2 rounded cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{sr.returnNumber}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            sr.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800"
                              : sr.status === "PENDING_APPROVAL"
                              ? "bg-amber-100 text-amber-800"
                              : sr.status === "DRAFT"
                              ? "bg-slate-100 text-slate-700"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {sr.status}
                        </span>
                      </div>
                      <p className="text-slate-500 mt-0.5">
                        {sr.customerSnapshot?.name} • Ref: {sr.saleNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">
                        ₹{sr.refundTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(sr.returnDate).toLocaleDateString("en-IN", {
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

          {/* Supplier Purchase Returns */}
          <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Recent Supplier Returns</h3>
                <p className="text-xs text-slate-500">Goods returned to suppliers and credit notes</p>
              </div>
              <Link
                href="/returns/purchases"
                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium inline-flex items-center gap-1"
              >
                View all <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : !data?.recentPurchaseReturns || data.recentPurchaseReturns.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No supplier purchase returns recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.recentPurchaseReturns.map((pr) => (
                  <div
                    key={pr._id || pr.id}
                    onClick={() => router.push(`/returns/purchases/${pr._id || pr.id}`)}
                    className="py-3 flex items-center justify-between text-xs hover:bg-slate-50/75 p-2 rounded cursor-pointer transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900">{pr.returnNumber}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            pr.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-800"
                              : pr.status === "PENDING_APPROVAL"
                              ? "bg-amber-100 text-amber-800"
                              : pr.status === "DRAFT"
                              ? "bg-slate-100 text-slate-700"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {pr.status}
                        </span>
                      </div>
                      <p className="text-slate-500 mt-0.5">
                        {pr.supplierSnapshot?.name} • Invoice: {pr.supplierInvoiceNumber}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-slate-900">
                        ₹{pr.returnTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {new Date(pr.returnDate).toLocaleDateString("en-IN", {
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
        </div>
      </div>
  );
}

