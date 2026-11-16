"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ClipboardList,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  Building2,
  ChevronRight,
  TrendingUp,
  CreditCard,
  DollarSign,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import type { IPurchase, PurchaseStatus, PurchasePaymentStatus } from "@/types/purchase";
import type { ISupplier } from "@/types/supplier";

export default function PurchaseRegisterPage() {
  const [purchases, setPurchases] = useState<IPurchase[]>([]);
  const [suppliers, setSuppliers] = useState<ISupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PurchaseStatus | "ALL">("ALL");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PurchasePaymentStatus | "ALL">("ALL");
  const [supplierFilter, setSupplierFilter] = useState<string>("ALL");
  const [refreshKey, setRefreshKey] = useState(0);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Aggregated stats
  const [stats, setStats] = useState({
    totalCount: 0,
    totalGrossAmount: 0,
    totalPaidAmount: 0,
    totalOutstandingAmount: 0,
    pendingReceiptCount: 0,
    partiallyReceivedCount: 0,
    receivedCount: 0,
    draftCount: 0,
    cancelledCount: 0,
  });

  // Load suppliers list for filtering
  useEffect(() => {
    async function loadSuppliers() {
      try {
        const res = await fetch("/api/suppliers?limit=100");
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data?.suppliers) {
            setSuppliers(data.data.suppliers);
          }
        }
      } catch (err) {
        console.error("Failed to load suppliers:", err);
      }
    }
    loadSuppliers();
  }, []);

  // Fetch purchase bills
  useEffect(() => {
    let ignore = false;
    async function fetchPurchases() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (statusFilter !== "ALL") params.set("status", statusFilter);
        if (paymentStatusFilter !== "ALL") params.set("paymentStatus", paymentStatusFilter);
        if (supplierFilter !== "ALL") params.set("supplierId", supplierFilter);
        params.set("page", page.toString());
        params.set("limit", "15");

        const res = await fetch(`/api/purchases?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load purchases");
        const json = await res.json();

        if (!ignore && json.success && json.data) {
          setPurchases(json.data.purchases || []);
          setTotalPages(json.data.totalPages || 1);
          setTotalCount(json.data.totalCount || 0);
          if (json.data.stats) {
            setStats(json.data.stats);
          }
        }
      } catch (err) {
        console.error("Error loading purchases:", err);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    fetchPurchases();
    return () => {
      ignore = true;
    };
  }, [search, statusFilter, paymentStatusFilter, supplierFilter, page, refreshKey]);

  function getReceiptStatusBadge(status: PurchaseStatus) {
    switch (status) {
      case "DRAFT":
        return <Badge variant="neutral" dot>Draft</Badge>;
      case "PENDING_RECEIPT":
        return <Badge variant="warning" dot>Pending Goods</Badge>;
      case "PARTIALLY_RECEIVED":
        return <Badge variant="info" dot>Partially Received</Badge>;
      case "RECEIVED":
        return <Badge variant="success" dot>Received in Stock</Badge>;
      case "CANCELLED":
        return <Badge variant="danger" dot>Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  }

  function getPaymentStatusBadge(status: PurchasePaymentStatus) {
    switch (status) {
      case "PAID":
        return <Badge variant="success" size="sm">PAID</Badge>;
      case "PARTIALLY_PAID":
        return <Badge variant="warning" size="sm">PARTIAL</Badge>;
      case "UNPAID":
        return <Badge variant="danger" size="sm">UNPAID</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{status}</Badge>;
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Purchase Register
            </h1>
            <Badge variant="agri" size="sm">Phase 5B</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Supplier inward invoices, batch inventory tracking, and payment balances.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshKey((k) => k + 1)}
            leftIcon={<RefreshCw className="w-4 h-4" />}
            title="Refresh List"
          >
            Refresh
          </Button>
          <Link href="/purchases/new">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              New Purchase Entry
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Inward Bills */}
        <Card className="p-3 sm:p-4 bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-[#176B3A] flex items-center justify-center shrink-0">
              <ClipboardList className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Total Invoices
              </p>
              <p className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                {stats.totalCount}
              </p>
            </div>
          </div>
        </Card>

        {/* Total Invoiced Value */}
        <Card className="p-3 sm:p-4 bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Invoiced Value
              </p>
              <p className="text-lg sm:text-xl font-bold text-slate-900 truncate">
                ₹{stats.totalGrossAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </Card>

        {/* Total Paid */}
        <Card className="p-3 sm:p-4 bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Paid to Suppliers
              </p>
              <p className="text-lg sm:text-xl font-bold text-emerald-700 truncate">
                ₹{stats.totalPaidAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </Card>

        {/* Net Outstanding Balance */}
        <Card className="p-3 sm:p-4 bg-white border border-slate-200/80 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Outstanding Balance
              </p>
              <p className="text-lg sm:text-xl font-bold text-amber-700 truncate">
                ₹{stats.totalOutstandingAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="p-4 bg-white border border-slate-200/80 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by Bill #, Supplier Invoice #, or Supplier Name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9 w-full bg-slate-50 border-slate-200 text-sm"
            />
          </div>

          {/* Supplier Dropdown Filter */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            <select
              value={supplierFilter}
              onChange={(e) => {
                setSupplierFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by Supplier"
              className="h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#176B3A] focus:border-transparent"
            >
              <option value="ALL">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id || s._id} value={s.id || s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="pt-3 mt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          {/* Receipt Status Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <span className="text-slate-400 font-medium mr-1 text-[11px] uppercase tracking-wider">Receipt:</span>
            {(["ALL", "PENDING_RECEIPT", "PARTIALLY_RECEIVED", "RECEIVED", "DRAFT", "CANCELLED"] as const).map((st) => (
              <button
                key={st}
                onClick={() => {
                  setStatusFilter(st);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  statusFilter === st
                    ? "bg-[#176B3A] text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {st === "ALL" ? "All Receipts" : st.replace("_", " ")}
              </button>
            ))}
          </div>

          {/* Payment Status Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <span className="text-slate-400 font-medium mr-1 text-[11px] uppercase tracking-wider">Payment:</span>
            {(["ALL", "UNPAID", "PARTIALLY_PAID", "PAID"] as const).map((pst) => (
              <button
                key={pst}
                onClick={() => {
                  setPaymentStatusFilter(pst);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  paymentStatusFilter === pst
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {pst === "ALL" ? "All Payments" : pst.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Purchase Register Content */}
      {loading ? (
        <Card className="p-12 text-center text-slate-400">
          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#176B3A]" />
          <p className="text-sm">Loading purchase entries...</p>
        </Card>
      ) : purchases.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-6 w-6" />}
          title="No purchase invoices found"
          description={
            search || statusFilter !== "ALL" || supplierFilter !== "ALL" || paymentStatusFilter !== "ALL"
              ? "No purchases match your selected filters. Try clearing filters or searching for another invoice."
              : "Record your first inward purchase bill to update stock, batch inventories, and vendor accounts."
          }
          action={
            <Link href="/purchases/new">
              <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
                Record Purchase Bill
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Card className="overflow-hidden border border-slate-200/80 shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead className="font-semibold text-slate-700">Bill # / Date</TableHead>
                    <TableHead className="font-semibold text-slate-700">Supplier</TableHead>
                    <TableHead className="font-semibold text-slate-700">Invoice # / Date</TableHead>
                    <TableHead className="font-semibold text-slate-700">Receipt Status</TableHead>
                    <TableHead className="font-semibold text-slate-700">Payment Status</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right">Invoice Total</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right">Outstanding</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((po) => {
                    const poId = po.id || po._id;
                    return (
                      <TableRow key={poId} className="hover:bg-slate-50/60 transition-colors">
                        <TableCell className="font-medium">
                          <Link
                            href={`/purchases/${poId}`}
                            className="text-[#176B3A] hover:underline font-semibold tracking-tight"
                          >
                            {po.purchaseNumber}
                          </Link>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {new Date(po.purchaseDate || po.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="font-medium text-slate-900">
                            {po.supplierSnapshot?.name || "Unknown Supplier"}
                          </div>
                          {po.supplierSnapshot?.gstin && (
                            <div className="text-[11px] font-mono text-slate-400">
                              GST: {po.supplierSnapshot.gstin}
                            </div>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="font-mono text-xs text-slate-800 font-semibold">
                            {po.supplierInvoiceNumber}
                          </div>
                          <div className="text-xs text-slate-400">
                            {new Date(po.supplierInvoiceDate).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                        </TableCell>

                        <TableCell>{getReceiptStatusBadge(po.status)}</TableCell>

                        <TableCell>{getPaymentStatusBadge(po.paymentStatus)}</TableCell>

                        <TableCell className="text-right font-semibold text-slate-900">
                          ₹{po.grandTotal.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>

                        <TableCell className="text-right font-bold text-amber-700">
                          ₹{(po.outstandingAmount || 0).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>

                        <TableCell className="text-right">
                          <Link href={`/purchases/${poId}`}>
                            <Button variant="outline" size="sm">
                              View Bill
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          </div>

          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3">
            {purchases.map((po) => {
              const poId = po.id || po._id;
              return (
                <Link key={poId} href={`/purchases/${poId}`} className="block">
                  <Card className="p-4 border border-slate-200/80 shadow-sm active:bg-slate-50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-[#176B3A] tracking-tight">
                          {po.purchaseNumber}
                        </span>
                        <h2 className="text-sm font-semibold text-slate-900 mt-0.5">
                          {po.supplierSnapshot?.name || "Unknown Supplier"}
                        </h2>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {getReceiptStatusBadge(po.status)}
                        {getPaymentStatusBadge(po.paymentStatus)}
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <div>
                        <span className="text-slate-400">Inv: </span>
                        <span className="font-mono font-medium text-slate-700">{po.supplierInvoiceNumber}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-400 block">Total: ₹{po.grandTotal.toFixed(2)}</span>
                        <span className="text-sm font-bold text-amber-700">
                          Due: ₹{(po.outstandingAmount || 0).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-slate-500">
                Showing {purchases.length} of {totalCount} bills (Page {page} of {totalPages})
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
