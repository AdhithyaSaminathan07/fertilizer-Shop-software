"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Landmark,
  Coins,
  QrCode,
  Building,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  FileSpreadsheet,
  Settings,
  Wallet,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { EmptyState } from "@/components/ui/empty-state";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type {
  ICashbookEntry,
  ICashbookSummary,
  ICashbookOpeningBalanceConfig,
} from "@/types/expense";
import { OpeningBalanceDialog } from "@/components/cashbook/opening-balance-dialog";

function CashbookContent() {
  const searchParams = useSearchParams();

  const [entries, setEntries] = React.useState<ICashbookEntry[]>([]);
  const [summary, setSummary] = React.useState<ICashbookSummary | null>(null);
  const [openingConfig, setOpeningConfig] = React.useState<ICashbookOpeningBalanceConfig | null>(null);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  // Filters
  const [paymentMethod, setPaymentMethod] = React.useState<string>(searchParams.get("paymentMethod") || "ALL");
  const [selectedModule, setSelectedModule] = React.useState<string>(searchParams.get("module") || "ALL");
  const [search, setSearch] = React.useState(searchParams.get("search") || "");
  const [startDate, setStartDate] = React.useState(searchParams.get("startDate") || "");
  const [endDate, setEndDate] = React.useState(searchParams.get("endDate") || "");
  const [datePreset, setDatePreset] = React.useState<"today" | "month" | "all" | "custom">("all");

  const [isOpeningDialogOpen, setIsOpeningDialogOpen] = React.useState(false);

  // Apply date preset
  const handleDatePreset = (preset: "today" | "month" | "all" | "custom") => {
    setDatePreset(preset);
    setPage(1);
    const now = new Date();
    if (preset === "today") {
      const todayStr = now.toISOString().split("T")[0];
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === "month") {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const todayStr = now.toISOString().split("T")[0];
      setStartDate(firstDay);
      setEndDate(todayStr);
    } else if (preset === "all") {
      setStartDate("");
      setEndDate("");
    }
  };

  React.useEffect(() => {
    let ignore = false;
    async function loadConfig() {
      try {
        const res = await fetch("/api/cashbook/opening-balance");
        const data = await res.json();
        if (!ignore && res.ok && data.data) {
          setOpeningConfig(data.data);
        }
      } catch (e) {
        console.error("Failed to load opening balance:", e);
      }
    }
    loadConfig();
    return () => {
      ignore = true;
    };
  }, [refreshTrigger]);

  React.useEffect(() => {
    let ignore = false;
    async function fetchLedger() {
      try {
        const params = new URLSearchParams();
        if (paymentMethod && paymentMethod !== "ALL") params.set("paymentMethod", paymentMethod);
        if (selectedModule && selectedModule !== "ALL") params.set("module", selectedModule);
        if (search.trim()) params.set("search", search.trim());
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        params.set("page", String(page));
        params.set("limit", "50");

        const res = await fetch(`/api/cashbook?${params.toString()}`);
        const data = await res.json();
        if (!ignore && res.ok && data.data) {
          setEntries(data.data.entries || []);
          setSummary(data.data.summary || null);
          setTotal(data.data.total || 0);
          setTotalPages(data.data.totalPages || 1);
        }
      } catch (e) {
        console.error("Failed to load cashbook:", e);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchLedger();
    return () => {
      ignore = true;
    };
  }, [paymentMethod, selectedModule, search, startDate, endDate, page, refreshTrigger]);

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Landmark className="h-7 w-7 text-[#176B3A]" />
            Business Cashbook & Money Movement
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Unified single-entry store ledger tracking all physical cash, UPI, bank, and cheque movements.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/cashbook/reports">
            <Button variant="outline" className="flex items-center gap-2 border-slate-200 text-slate-700">
              <FileSpreadsheet className="h-4 w-4 text-[#176B3A]" />
              Cashbook Reports
            </Button>
          </Link>
          <Button
            onClick={() => setIsOpeningDialogOpen(true)}
            variant="outline"
            className="flex items-center gap-2 border-slate-200 text-slate-700"
          >
            <Settings className="h-4 w-4 text-slate-500" />
            Opening Balances
          </Button>
        </div>
      </div>

      {/* Account Balance Separation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cash Balance */}
        <Card className="border border-emerald-200/90 bg-emerald-50/30 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center justify-between">
              <span>Recorded Cash Balance</span>
              <Coins className="h-4 w-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">
              {summary ? formatCurrency(summary.closingBalances.cash) : "₹0.00"}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-emerald-100">
              <span className="text-emerald-700 font-medium">
                In: {summary ? formatCurrency(summary.periodInflows.cash) : "₹0"}
              </span>
              <span className="text-rose-700 font-medium">
                Out: {summary ? formatCurrency(summary.periodOutflows.cash) : "₹0"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* UPI Balance */}
        <Card className="border border-blue-200/90 bg-blue-50/30 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-blue-800 uppercase tracking-wider flex items-center justify-between">
              <span>Recorded UPI Balance</span>
              <QrCode className="h-4 w-4 text-blue-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">
              {summary ? formatCurrency(summary.closingBalances.upi) : "₹0.00"}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-blue-100">
              <span className="text-blue-700 font-medium">
                In: {summary ? formatCurrency(summary.periodInflows.upi) : "₹0"}
              </span>
              <span className="text-rose-700 font-medium">
                Out: {summary ? formatCurrency(summary.periodOutflows.upi) : "₹0"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Bank Balance */}
        <Card className="border border-purple-200/90 bg-purple-50/30 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-purple-800 uppercase tracking-wider flex items-center justify-between">
              <span>Recorded Bank Balance</span>
              <Building className="h-4 w-4 text-purple-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-slate-900">
              {summary ? formatCurrency(summary.closingBalances.bank) : "₹0.00"}
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-2 border-t border-purple-100">
              <span className="text-purple-700 font-medium">
                In: {summary ? formatCurrency(summary.periodInflows.bank) : "₹0"}
              </span>
              <span className="text-rose-700 font-medium">
                Out: {summary ? formatCurrency(summary.periodOutflows.bank) : "₹0"}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Total Liquidity */}
        <Card className="border border-slate-200/90 shadow-xs bg-gradient-to-br from-slate-900 to-slate-800 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Total Recorded Balance</span>
              <Wallet className="h-4 w-4 text-emerald-400" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-white">
              {summary ? formatCurrency(summary.closingBalances.total) : "₹0.00"}
            </div>
            <div className="text-[11px] text-slate-300 mt-2 pt-2 border-t border-slate-700 flex justify-between">
              <span>Total Inflows: {summary ? formatCurrency(summary.periodInflows.total) : "₹0"}</span>
              <span>Total Outflows: {summary ? formatCurrency(summary.periodOutflows.total) : "₹0"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Control Bar */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
        {/* Date presets & accounts tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="font-semibold text-slate-500 mr-1">Period:</span>
            <button
              type="button"
              onClick={() => handleDatePreset("all")}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                datePreset === "all" ? "bg-[#176B3A] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              All Time
            </button>
            <button
              type="button"
              onClick={() => handleDatePreset("today")}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                datePreset === "today" ? "bg-[#176B3A] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handleDatePreset("month")}
              className={`px-3 py-1 rounded-md font-medium transition-colors ${
                datePreset === "month" ? "bg-[#176B3A] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              This Month
            </button>
          </div>

          <div className="flex items-center gap-1 text-xs">
            <span className="font-semibold text-slate-500 mr-1">Account:</span>
            {(["ALL", "CASH", "UPI", "BANK_TRANSFER", "CHEQUE"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setPaymentMethod(m);
                  setPage(1);
                }}
                className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                  paymentMethod === m
                    ? "bg-slate-800 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {m === "ALL" ? "All Accounts" : m === "BANK_TRANSFER" ? "Bank" : m}
              </button>
            ))}
          </div>
        </div>

        {/* Detailed inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search reference, party, description..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>

          <div>
            <select
              value={selectedModule}
              onChange={(e) => {
                setSelectedModule(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#176B3A]/20"
            >
              <option value="ALL">All Source Modules</option>
              <option value="SALES">Sales Invoices</option>
              <option value="CUSTOMER_KHATA">Customer Repayments</option>
              <option value="EXPENSES">Daily Expenses</option>
              <option value="SUPPLIERS">Supplier Payments</option>
              <option value="PURCHASES">Purchase Upfront Payments</option>
            </select>
          </div>

          <div>
            <Input
              type="date"
              placeholder="From Date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setDatePreset("custom");
                setPage(1);
              }}
            />
          </div>

          <div>
            <Input
              type="date"
              placeholder="To Date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setDatePreset("custom");
                setPage(1);
              }}
            />
          </div>

          <div className="flex items-center">
            {(search || paymentMethod !== "ALL" || selectedModule !== "ALL" || startDate || endDate) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setPaymentMethod("ALL");
                  setSelectedModule("ALL");
                  setStartDate("");
                  setEndDate("");
                  setDatePreset("all");
                  setPage(1);
                }}
                className="text-xs text-slate-500 hover:text-slate-800 w-full"
              >
                Reset Filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Opening Balance Banner for Selected Period */}
      {summary && (
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/90 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <Badge variant="neutral">Period Opening Balance</Badge>
            <span className="font-extrabold text-slate-800 text-sm">
              {formatCurrency(summary.openingBalances.total)}
            </span>
            <span className="text-slate-400">
              (Cash: {formatCurrency(summary.openingBalances.cash)} | UPI: {formatCurrency(summary.openingBalances.upi)} | Bank: {formatCurrency(summary.openingBalances.bank)})
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-600">
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <ArrowDownLeft className="h-3.5 w-3.5" /> Inflows: +{formatCurrency(summary.periodInflows.total)}
            </span>
            <span className="text-rose-700 font-semibold flex items-center gap-1">
              <ArrowUpRight className="h-3.5 w-3.5" /> Outflows: -{formatCurrency(summary.periodOutflows.total)}
            </span>
            <span className="font-extrabold text-slate-900">
              Closing: {formatCurrency(summary.closingBalances.total)}
            </span>
          </div>
        </div>
      )}

      {/* Unified Cashbook Table */}
      <Card className="border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/75">
              <TableRow>
                <TableHead className="w-28">Date & Time</TableHead>
                <TableHead className="w-36">Reference</TableHead>
                <TableHead className="w-32">Module</TableHead>
                <TableHead>Description & Details</TableHead>
                <TableHead className="w-24">Method</TableHead>
                <TableHead className="w-32 text-right">Money In (+)</TableHead>
                <TableHead className="w-32 text-right">Money Out (-)</TableHead>
                <TableHead className="w-36 text-right font-bold">Running Balance</TableHead>
                <TableHead className="w-32">Staff</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-44" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  </TableRow>
                ))
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center">
                    <EmptyState
                      icon={<Landmark className="h-6 w-6" />}
                      title="No transactions found"
                      description="No money movements match the selected filters or date period."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((entry) => (
                  <TableRow key={entry.id} className="hover:bg-slate-50/60 transition-colors">
                    <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                      {formatDate(entry.date)}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-slate-800 text-xs">
                        {entry.reference}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          entry.module === "SALES"
                            ? "agri"
                            : entry.module === "CUSTOMER_KHATA"
                            ? "neutral"
                            : entry.module === "EXPENSES"
                            ? "warning"
                            : "neutral"
                        }
                        className="text-[10px]"
                      >
                        {entry.module === "CUSTOMER_KHATA"
                          ? "Khata"
                          : entry.module === "SALES"
                          ? "Sales"
                          : entry.module === "EXPENSES"
                          ? "Expense"
                          : entry.module === "SUPPLIERS"
                          ? "Supplier"
                          : entry.module}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-800">
                      <div className="font-medium">{entry.description}</div>
                      {entry.notes && (
                        <div className="text-[10px] text-slate-400 italic">{entry.notes}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={entry.paymentMethod === "CASH" ? "agri" : "neutral"}
                        className="text-[10px]"
                      >
                        {entry.paymentMethod}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {entry.inflow > 0 ? (
                        <span className="font-semibold text-emerald-700">
                          +{formatCurrency(entry.inflow)}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {entry.outflow > 0 ? (
                        <span className="font-semibold text-rose-700">
                          -{formatCurrency(entry.outflow)}
                        </span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-black text-slate-900 text-sm">
                      {formatCurrency(entry.runningBalance)}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500 truncate max-w-[120px]">
                      {entry.recordedByName}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
            <span>
              Page {page} of {totalPages} ({total} total transactions)
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 text-xs"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 text-xs"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Opening Balance Configuration Modal */}
      <OpeningBalanceDialog
        open={isOpeningDialogOpen}
        onClose={() => setIsOpeningDialogOpen(false)}
        onSuccess={triggerRefresh}
        currentConfig={openingConfig}
      />
    </div>
  );
}

export default function CashbookPage() {
  return (
    <React.Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-4 gap-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <CashbookContent />
    </React.Suspense>
  );
}
