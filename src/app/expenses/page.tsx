"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  WalletCards,
  Plus,
  Tag,
  Search,
  Eye,
  Edit2,
  RotateCcw,
  Calendar,
  Layers,
  TrendingDown,
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
import type { IExpense, IExpenseCategory, IExpenseSummary } from "@/types/expense";
import { ExpenseDialog } from "@/components/expenses/expense-dialog";
import { CategoryDialog } from "@/components/expenses/category-dialog";
import { ExpenseReversalDialog } from "@/components/expenses/expense-reversal-dialog";

function ExpensesContent() {
  const searchParams = useSearchParams();

  const [expenses, setExpenses] = React.useState<IExpense[]>([]);
  const [categories, setCategories] = React.useState<IExpenseCategory[]>([]);
  const [summary, setSummary] = React.useState<IExpenseSummary | null>(null);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  // Filters
  const [search, setSearch] = React.useState(searchParams.get("search") || "");
  const [selectedCategory, setSelectedCategory] = React.useState(searchParams.get("categoryId") || "");
  const [selectedMethod, setSelectedMethod] = React.useState<string>(searchParams.get("paymentMethod") || "");
  const [selectedStatus, setSelectedStatus] = React.useState<string>(searchParams.get("status") || "RECORDED");
  const [startDate, setStartDate] = React.useState(searchParams.get("startDate") || "");
  const [endDate, setEndDate] = React.useState(searchParams.get("endDate") || "");

  // Dialog states
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = React.useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = React.useState(false);
  const [isReversalDialogOpen, setIsReversalDialogOpen] = React.useState(false);
  const [expenseToEdit, setExpenseToEdit] = React.useState<IExpense | null>(null);
  const [expenseToReverse, setExpenseToReverse] = React.useState<IExpense | null>(null);

  React.useEffect(() => {
    let ignore = false;
    async function loadMeta() {
      try {
        const [resCat, resSum] = await Promise.all([
          fetch("/api/expenses/categories?includeInactive=true"),
          fetch("/api/expenses/summary"),
        ]);
        const dataCat = await resCat.json();
        const dataSum = await resSum.json();
        if (!ignore) {
          if (resCat.ok && dataCat.data) setCategories(dataCat.data);
          if (resSum.ok && dataSum.data) setSummary(dataSum.data);
        }
      } catch (e) {
        console.error("Failed to load meta:", e);
      }
    }
    loadMeta();
    return () => {
      ignore = true;
    };
  }, [refreshTrigger]);

  React.useEffect(() => {
    let ignore = false;
    async function fetchExpenses() {
      try {
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (selectedCategory) params.set("categoryId", selectedCategory);
        if (selectedMethod) params.set("paymentMethod", selectedMethod);
        if (selectedStatus) params.set("status", selectedStatus);
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        params.set("page", String(page));
        params.set("limit", "20");

        const res = await fetch(`/api/expenses?${params.toString()}`);
        const data = await res.json();
        if (!ignore && res.ok && data.data) {
          setExpenses(data.data.expenses || []);
          setTotal(data.data.total || 0);
          setTotalPages(data.data.totalPages || 1);
        }
      } catch (e) {
        console.error("Failed to load expenses:", e);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchExpenses();
    return () => {
      ignore = true;
    };
  }, [search, selectedCategory, selectedMethod, selectedStatus, startDate, endDate, page, refreshTrigger]);

  const handleOpenAdd = () => {
    setExpenseToEdit(null);
    setIsExpenseDialogOpen(true);
  };

  const handleOpenEdit = (exp: IExpense) => {
    setExpenseToEdit(exp);
    setIsExpenseDialogOpen(true);
  };

  const handleOpenReverse = (exp: IExpense) => {
    setExpenseToReverse(exp);
    setIsReversalDialogOpen(true);
  };

  const triggerRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <WalletCards className="h-7 w-7 text-[#176B3A]" />
            Daily Business Expenses
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Record, track, and categorize business operational overheads and store cash outflows.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={() => setIsCategoryDialogOpen(true)}
            className="flex items-center gap-2 border-slate-200 text-slate-700"
          >
            <Tag className="h-4 w-4 text-[#176B3A]" />
            Categories
          </Button>
          <Button
            onClick={handleOpenAdd}
            className="bg-[#176B3A] hover:bg-[#12532D] text-white flex items-center gap-2 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Record Expense
          </Button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-slate-200/80 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Today&apos;s Expenses</span>
              <Calendar className="h-4 w-4 text-emerald-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">
              {summary ? formatCurrency(summary.todayTotal) : "₹0.00"}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {summary ? summary.todayCount : 0} expense voucher(s) today
            </p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>This Month</span>
              <TrendingDown className="h-4 w-4 text-rose-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">
              {summary ? formatCurrency(summary.monthTotal) : "₹0.00"}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {summary ? summary.monthCount : 0} voucher(s) in current month
            </p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>This Year (YTD)</span>
              <Layers className="h-4 w-4 text-blue-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-extrabold text-slate-900">
              {summary ? formatCurrency(summary.yearTotal) : "₹0.00"}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {summary ? summary.yearCount : 0} total annual voucher(s)
            </p>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 shadow-xs">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <span>Top Category</span>
              <Tag className="h-4 w-4 text-amber-500" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-slate-800 truncate">
              {summary?.categoryBreakdown[0]?.categoryName || "None"}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {summary?.categoryBreakdown[0]
                ? `${formatCurrency(summary.categoryBreakdown[0].totalAmount)} (${summary.categoryBreakdown[0].percentage}%)`
                : "No expenses recorded"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by expense #, description, paid-to..."
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
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#176B3A]/20"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={selectedMethod}
              onChange={(e) => {
                setSelectedMethod(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#176B3A]/20"
            >
              <option value="">All Payment Modes</option>
              <option value="CASH">Cash</option>
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CHEQUE">Cheque</option>
            </select>
          </div>

          <div>
            <Input
              type="date"
              placeholder="From Date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
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
                setPage(1);
              }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span>Status filter:</span>
            <button
              type="button"
              onClick={() => {
                setSelectedStatus("RECORDED");
                setPage(1);
              }}
              className={`px-2 py-0.5 rounded font-medium ${
                selectedStatus === "RECORDED"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedStatus("REVERSED");
                setPage(1);
              }}
              className={`px-2 py-0.5 rounded font-medium ${
                selectedStatus === "REVERSED"
                  ? "bg-rose-100 text-rose-800"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Reversed
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedStatus("");
                setPage(1);
              }}
              className={`px-2 py-0.5 rounded font-medium ${
                selectedStatus === ""
                  ? "bg-slate-800 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span>Showing {expenses.length} of {total} records</span>
            {(search || selectedCategory || selectedMethod || startDate || endDate || selectedStatus !== "RECORDED") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setSelectedCategory("");
                  setSelectedMethod("");
                  setSelectedStatus("RECORDED");
                  setStartDate("");
                  setEndDate("");
                  setPage(1);
                }}
                className="text-xs h-6 text-slate-500 hover:text-slate-800 p-0"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Expenses Table */}
      <Card className="border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/75">
              <TableRow>
                <TableHead className="w-28">Date</TableHead>
                <TableHead className="w-36">Expense #</TableHead>
                <TableHead className="w-36">Category</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-36">Paid To</TableHead>
                <TableHead className="w-32">Payment Mode</TableHead>
                <TableHead className="w-32 text-right">Amount</TableHead>
                <TableHead className="w-24 text-center">Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : expenses.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-12 text-center">
                    <EmptyState
                      icon={<WalletCards className="h-6 w-6" />}
                      title="No expense records found"
                      description="Record your daily expenses to keep an accurate store cashbook."
                    />
                  </TableCell>
                </TableRow>
              ) : (
                expenses.map((exp) => (
                  <TableRow key={exp._id} className="hover:bg-slate-50/60 transition-colors">
                    <TableCell className="text-xs text-slate-600">
                      {formatDate(exp.expenseDate)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/expenses/${exp._id}`}
                        className="font-medium text-[#176B3A] hover:underline text-xs flex items-center gap-1"
                      >
                        {exp.expenseNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="neutral" className="text-[11px] font-normal">
                        {exp.categoryName}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-800 max-w-xs truncate">
                      {exp.description}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {exp.paidTo || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={exp.paymentMethod === "CASH" ? "agri" : "neutral"}
                        className="text-[10px]"
                      >
                        {exp.paymentMethod}
                      </Badge>
                      {exp.paymentReference && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[120px]">
                          {exp.paymentReference}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-slate-900 text-sm">
                      {formatCurrency(exp.amount)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={exp.status === "RECORDED" ? "agri" : "warning"}
                        className="text-[10px]"
                      >
                        {exp.status === "RECORDED" ? "Recorded" : "Reversed"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/expenses/${exp._id}`}>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        {exp.status === "RECORDED" && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(exp)}
                              className="h-7 w-7 p-0 text-slate-500 hover:text-amber-600"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenReverse(exp)}
                              className="h-7 w-7 p-0 text-slate-500 hover:text-rose-600"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
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
              Page {page} of {totalPages}
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

      {/* Dialogs */}
      <ExpenseDialog
        open={isExpenseDialogOpen}
        onClose={() => setIsExpenseDialogOpen(false)}
        onSuccess={triggerRefresh}
        categories={categories}
        expenseToEdit={expenseToEdit}
      />

      <CategoryDialog
        open={isCategoryDialogOpen}
        onClose={() => setIsCategoryDialogOpen(false)}
        categories={categories}
        onRefresh={triggerRefresh}
      />

      <ExpenseReversalDialog
        open={isReversalDialogOpen}
        onClose={() => setIsReversalDialogOpen(false)}
        onSuccess={triggerRefresh}
        expense={expenseToReverse}
      />
    </div>
  );
}

export default function ExpensesPage() {
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
      <ExpensesContent />
    </React.Suspense>
  );
}
