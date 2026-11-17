"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Tag,
  CreditCard,
  User,
  RotateCcw,
  Edit2,
  FileText,
  AlertCircle,
  History,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { IExpense, IExpenseCategory } from "@/types/expense";
import { ExpenseDialog } from "@/components/expenses/expense-dialog";
import { ExpenseReversalDialog } from "@/components/expenses/expense-reversal-dialog";

export default function ExpenseDetailPage() {
  const params = useParams();
  const id = params?.id as string;

  const [expense, setExpense] = React.useState<IExpense | null>(null);
  const [categories, setCategories] = React.useState<IExpenseCategory[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);

  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [isReversalDialogOpen, setIsReversalDialogOpen] = React.useState(false);

  React.useEffect(() => {
    let ignore = false;
    async function loadData() {
      if (!id) return;
      try {
        const [resExp, resCat] = await Promise.all([
          fetch(`/api/expenses/${id}`),
          fetch("/api/expenses/categories?includeInactive=true"),
        ]);

        const dataExp = await resExp.json();
        const dataCat = await resCat.json();

        if (!ignore) {
          if (!resExp.ok) {
            setError(dataExp.error?.message || "Failed to load expense");
          } else {
            setExpense(dataExp.data);
          }
          if (resCat.ok && dataCat.data) {
            setCategories(dataCat.data);
          }
        }
      } catch (err) {
        if (!ignore) setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    loadData();
    return () => {
      ignore = true;
    };
  }, [id, refreshTrigger]);

  const handleRefresh = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !expense) {
    return (
      <div className="p-8 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-800">Expense Record Not Found</h2>
        <p className="text-sm text-slate-500">{error || "The requested expense could not be loaded."}</p>
        <Link href="/expenses">
          <Button variant="outline" className="mt-2">
            Back to Expenses
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Navigation */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <Link
          href="/expenses"
          className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Expenses Register
        </Link>

        {expense.status === "RECORDED" && (
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(true)}
              className="flex items-center gap-2 text-slate-700 border-slate-200"
            >
              <Edit2 className="h-4 w-4 text-amber-600" />
              Edit Expense
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsReversalDialogOpen(true)}
              className="flex items-center gap-2 text-rose-700 border-rose-200 hover:bg-rose-50"
            >
              <RotateCcw className="h-4 w-4 text-rose-600" />
              Reverse Expense
            </Button>
          </div>
        )}
      </div>

      {/* Main Voucher Card */}
      <Card className="border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {expense.expenseNumber}
              </span>
              <Badge
                variant={expense.status === "RECORDED" ? "agri" : "warning"}
                className="text-xs px-2.5 py-0.5"
              >
                {expense.status === "RECORDED" ? "Active Voucher" : "Reversed Voucher"}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              Incurred on {formatDate(expense.expenseDate)} • Recorded by {expense.createdByName}
            </p>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Expense Amount
            </span>
            <span className="text-3xl font-black text-slate-900">
              {formatCurrency(expense.amount)}
            </span>
          </div>
        </div>

        {/* Voucher Metadata Grid */}
        <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              Category
            </span>
            <div className="text-sm font-bold text-slate-800">{expense.categoryName}</div>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" />
              Payment Method
            </span>
            <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Badge variant={expense.paymentMethod === "CASH" ? "agri" : "neutral"}>
                {expense.paymentMethod}
              </Badge>
              {expense.paymentReference && (
                <span className="text-xs font-normal text-slate-500">
                  (Ref: {expense.paymentReference})
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              Paid To (Recipient)
            </span>
            <div className="text-sm font-semibold text-slate-800">
              {expense.paidTo || "— (Direct store expense)"}
            </div>
          </div>

          <div className="md:col-span-2 lg:col-span-3 space-y-1 pt-2 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Description & Purpose
            </span>
            <p className="text-sm text-slate-800 bg-slate-50 p-3 rounded-lg border border-slate-100">
              {expense.description}
            </p>
          </div>

          {expense.notes && (
            <div className="md:col-span-2 lg:col-span-3 space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Internal Remarks / Notes
              </span>
              <p className="text-xs text-slate-600 italic">{expense.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reversal Notice if Reversed */}
      {expense.status === "REVERSED" && expense.reversal && (
        <Card className="border border-rose-200 bg-rose-50/60 shadow-xs">
          <CardContent className="p-5 flex items-start gap-3">
            <RotateCcw className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-rose-900">
                This expense voucher was reversed on {formatDate(expense.reversal.reversedAt)}
              </h3>
              <p className="text-xs text-rose-800">
                <strong>Reversal Reason:</strong> &ldquo;{expense.reversal.reason}&rdquo;
              </p>
              <p className="text-[11px] text-rose-600">
                Reversed by {expense.reversal.reversedByName}. The outflow has been eliminated from the
                business cashbook.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit History Timeline */}
      <Card className="border border-slate-200 shadow-xs">
        <CardHeader className="pb-3 border-b border-slate-100">
          <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <History className="h-4 w-4 text-[#176B3A]" />
            Audit History & Financial Modifications
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
            {/* Creation event */}
            <div className="relative">
              <div className="absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full bg-emerald-500 ring-4 ring-white" />
              <div className="text-xs font-semibold text-slate-900">
                Voucher Created
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {formatDate(expense.createdAt)} by {expense.createdByName} for{" "}
                {formatCurrency(expense.amount)} via {expense.paymentMethod}
              </div>
            </div>

            {/* Modifications */}
            {(expense.auditHistory || []).map((audit, idx) => (
              <div key={idx} className="relative">
                <div className="absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full bg-amber-500 ring-4 ring-white" />
                <div className="text-xs font-semibold text-slate-900">
                  Modified by {audit.editedByName}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {formatDate(audit.editedAt)} • <strong>Reason:</strong> &ldquo;{audit.reason}&rdquo;
                </div>
                <div className="mt-2 text-xs bg-slate-50 p-2.5 rounded border border-slate-100 text-slate-600 space-y-1">
                  <div>Previous Amount: {formatCurrency(audit.previousData?.amount || 0)}</div>
                  {audit.previousData?.description && (
                    <div>Previous Description: {audit.previousData.description}</div>
                  )}
                  {audit.previousData?.paymentMethod && (
                    <div>Previous Mode: {audit.previousData.paymentMethod}</div>
                  )}
                </div>
              </div>
            ))}

            {/* Reversal event */}
            {expense.status === "REVERSED" && expense.reversal && (
              <div className="relative">
                <div className="absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full bg-rose-500 ring-4 ring-white" />
                <div className="text-xs font-semibold text-rose-900">
                  Voucher Reversed
                </div>
                <div className="text-[11px] text-rose-700 mt-0.5">
                  {formatDate(expense.reversal.reversedAt)} by {expense.reversal.reversedByName}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <ExpenseDialog
        open={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        onSuccess={handleRefresh}
        categories={categories}
        expenseToEdit={expense}
      />

      <ExpenseReversalDialog
        open={isReversalDialogOpen}
        onClose={() => setIsReversalDialogOpen(false)}
        onSuccess={handleRefresh}
        expense={expense}
      />
    </div>
  );
}
