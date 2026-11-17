"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Receipt,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Eye,
  Calendar,
} from "lucide-react";
import { ReturnsNav } from "@/components/returns/returns-nav";
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
import type { ISalesReturn, ReturnStatus } from "@/types/returns";

export default function SalesReturnsPage() {
  const router = useRouter();
  const [returns, setReturns] = React.useState<ISalesReturn[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pages, setPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<string>("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  React.useEffect(() => {
    let ignore = false;
    async function loadSalesReturns() {
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", "20");
        if (search.trim()) params.set("search", search.trim());
        if (status) params.set("status", status);
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);

        const res = await fetch(`/api/sales-returns?${params.toString()}`);
        const json = await res.json();
        if (!ignore && res.ok) {
          setReturns(json.data?.returns || []);
          setTotal(json.data?.total || 0);
          setPages(json.data?.pages || 1);
          setError(null);
        } else if (!ignore) {
          setError(json.error?.message || json.message || "Failed to load sales returns");
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load sales returns");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadSalesReturns();
    return () => {
      ignore = true;
    };
  }, [page, search, status, startDate, endDate, refreshTrigger]);

  return (
    <div className="space-y-6">
      {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Receipt className="h-6 w-6 text-emerald-600" />
              Customer Sales Returns Register
            </h1>
            <p className="text-sm text-slate-500">
              Manage returned items from customers and process refunds independently
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
              size="sm"
              onClick={() => router.push("/returns/sales/new")}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="h-4 w-4" />
              New Sales Return
            </Button>
          </div>
        </div>

        {/* Tab Subnavigation */}
        <ReturnsNav />

        {/* Filters */}
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by return #, bill #, customer name or phone..."
              className="pl-9 text-sm"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="text-xs border border-slate-300 rounded-md p-2 bg-white focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">All Statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="PENDING_APPROVAL">Pending Approval</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="CANCELLED">Cancelled</option>
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
                <TableHead className="w-36">Return #</TableHead>
                <TableHead className="w-28">Date</TableHead>
                <TableHead className="w-40">Original Bill #</TableHead>
                <TableHead className="w-56">Customer</TableHead>
                <TableHead className="w-28 text-center">Items</TableHead>
                <TableHead className="w-32">Refund Mode</TableHead>
                <TableHead className="w-32 text-right">Refund Amount</TableHead>
                <TableHead className="w-32 text-center">Status</TableHead>
                <TableHead className="w-24 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : returns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center text-xs text-slate-500">
                    No customer sales returns found.
                  </TableCell>
                </TableRow>
              ) : (
                returns.map((ret) => (
                  <TableRow
                    key={ret._id || ret.id}
                    className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                    onClick={() => router.push(`/returns/sales/${ret._id || ret.id}`)}
                  >
                    <TableCell className="font-mono text-xs font-semibold text-slate-900">
                      {ret.returnNumber}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {new Date(ret.returnDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-800">
                      {ret.saleNumber}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900 text-xs">
                        {ret.customerSnapshot?.name}
                      </div>
                      {ret.customerSnapshot?.mobile && (
                        <div className="text-[11px] text-slate-500 font-mono">
                          {ret.customerSnapshot.mobile}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs text-slate-700">
                      {ret.items?.length || 0}
                    </TableCell>
                    <TableCell className="text-xs text-slate-700">
                      <span className="font-medium">{ret.refundMethod.replace(/_/g, " ")}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-slate-900">
                      ₹{ret.refundTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          ret.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : ret.status === "PENDING_APPROVAL"
                            ? "bg-amber-100 text-amber-800"
                            : ret.status === "DRAFT"
                            ? "bg-slate-100 text-slate-700"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {ret.status.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/returns/sales/${ret._id || ret.id}`)}
                        className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {pages > 1 && (
            <div className="p-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <div>
                Page {page} of {pages} ({total} records)
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

