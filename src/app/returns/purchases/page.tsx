"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Truck,
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
import type { IPurchaseReturn, ReturnStatus, PurchaseReturnSupplierResponse } from "@/types/returns";

export default function PurchaseReturnsPage() {
  const router = useRouter();
  const [returns, setReturns] = React.useState<IPurchaseReturn[]>([]);
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
    async function loadPurchaseReturns() {
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("limit", "20");
        if (search.trim()) params.set("search", search.trim());
        if (status) params.set("status", status);
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);

        const res = await fetch(`/api/purchase-returns?${params.toString()}`);
        const json = await res.json();
        if (!ignore && res.ok) {
          setReturns(json.data?.returns || []);
          setTotal(json.data?.total || 0);
          setPages(json.data?.pages || 1);
          setError(null);
        } else if (!ignore) {
          setError(json.error?.message || json.message || "Failed to load purchase returns");
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load purchase returns");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadPurchaseReturns();
    return () => {
      ignore = true;
    };
  }, [page, search, status, startDate, endDate, refreshTrigger]);

  const getStatusBadge = (status: ReturnStatus) => {
    switch (status) {
      case "APPROVED":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
            Approved
          </span>
        );
      case "PENDING_APPROVAL":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            Pending Approval
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-100 text-rose-800 border border-rose-300">
            Rejected
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-800 border border-slate-300">
            Cancelled
          </span>
        );
      case "DRAFT":
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            Draft
          </span>
        );
    }
  };

  const getResponseBadge = (response: PurchaseReturnSupplierResponse) => {
    switch (response) {
      case "REFUND_EXPECTED":
        return <span className="text-xs text-blue-700 font-medium">Refund Expected</span>;
      case "CREDIT_NOTE_EXPECTED":
        return <span className="text-xs text-purple-700 font-medium">Credit Note</span>;
      case "REPLACEMENT_EXPECTED":
        return <span className="text-xs text-indigo-700 font-medium">Replacement</span>;
      case "PENDING_CONFIRMATION":
        return <span className="text-xs text-amber-700 font-medium">Pending Confirm</span>;
      case "OTHER":
      default:
        return <span className="text-xs text-slate-600 font-medium">Other</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Truck className="h-6 w-6 text-purple-600" />
              Supplier Purchase Returns Register
            </h1>
            <p className="text-sm text-slate-500">
              Manage return shipments to suppliers and track independent credit/refund responses
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLoading(true);
                setRefreshTrigger((k) => k + 1);
              }}
              className="gap-1.5"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Link href="/returns/purchases/new">
              <Button size="sm" className="bg-purple-600 hover:bg-purple-700 text-white gap-1.5">
                <Plus className="h-4 w-4" />
                New Purchase Return
              </Button>
            </Link>
          </div>
        </div>

        <ReturnsNav />

        {/* Filter Bar */}
        <div className="p-4 bg-white rounded-lg border border-slate-200 shadow-sm space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search return #, PO #, supplier invoice #, or supplier..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-400 shrink-0" />
              <select
                aria-label="Filter by Status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="h-9 text-xs rounded-md border border-slate-300 bg-white px-2.5 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
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
                aria-label="Start Date"
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
                aria-label="End Date"
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
                <TableHead className="w-36">PO #</TableHead>
                <TableHead className="w-36">Supplier Inv #</TableHead>
                <TableHead className="w-52">Supplier</TableHead>
                <TableHead className="w-20 text-center">Items</TableHead>
                <TableHead className="w-36">Expected Response</TableHead>
                <TableHead className="w-32 text-right">Return Total</TableHead>
                <TableHead className="w-32 text-center">Status</TableHead>
                <TableHead className="w-20 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-36" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : returns.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="py-12 text-center text-xs text-slate-500">
                    No supplier purchase returns found.
                  </TableCell>
                </TableRow>
              ) : (
                returns.map((ret) => (
                  <TableRow
                    key={ret._id || ret.id}
                    className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                    onClick={() => router.push(`/returns/purchases/${ret._id || ret.id}`)}
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
                      {ret.purchaseNumber}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-600">
                      {ret.supplierInvoiceNumber || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-slate-900 text-xs">
                        {ret.supplierSnapshot?.name}
                      </div>
                      {ret.supplierSnapshot?.phone && (
                        <div className="text-[11px] text-slate-500">
                          {ret.supplierSnapshot.phone}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs text-slate-700">
                      {ret.items?.length || 0}
                    </TableCell>
                    <TableCell>
                      {getResponseBadge(ret.supplierResponse)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-bold text-slate-900">
                      ₹{ret.returnTotal?.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-center">
                      {getStatusBadge(ret.status)}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Link href={`/returns/purchases/${ret._id || ret.id}`}>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <Eye className="h-4 w-4 text-slate-600" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {!loading && total > 0 && (
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-600">
              <div>
                Showing <span className="font-semibold">{returns.length}</span> of{" "}
                <span className="font-semibold">{total}</span> returns
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-7 px-2 text-xs"
                >
                  Previous
                </Button>
                <span>
                  Page {page} of {pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  className="h-7 px-2 text-xs"
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

