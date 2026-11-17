"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Printer,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Coins,
  Tag,
  Clock,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { ICashbookReport } from "@/types/expense";

function CashbookReportsContent() {
  const [startDate, setStartDate] = React.useState<string>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = React.useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [report, setReport] = React.useState<ICashbookReport | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let ignore = false;
    async function fetchReport() {
      if (!startDate || !endDate) return;
      try {
        const params = new URLSearchParams();
        params.set("startDate", startDate);
        params.set("endDate", endDate);

        const res = await fetch(`/api/cashbook/reports?${params.toString()}`);
        const data = await res.json();
        if (!ignore && res.ok && data.data) {
          setReport(data.data);
        }
      } catch (e) {
        console.error("Failed to load cashbook report:", e);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchReport();
    return () => {
      ignore = true;
    };
  }, [startDate, endDate]);

  const handlePrint = () => {
    window.print();
  };

  const netIncome = report
    ? report.summary.periodInflows.total - report.summary.periodOutflows.total
    : 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto print:max-w-none print:m-0 print:p-0">
      {/* Top Header & Actions (hidden in print) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-200 print:hidden">
        <div className="flex items-center gap-3">
          <Link href="/cashbook">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-500">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="h-6 w-6 text-[#176B3A]" />
              Cashbook & Operations Financial Reports
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive statement of business money receipts, payments, and category breakdowns.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            onClick={handlePrint}
            variant="outline"
            className="flex items-center gap-2 border-slate-200 text-slate-700"
          >
            <Printer className="h-4 w-4" />
            Print Report
          </Button>
        </div>
      </div>

      {/* Report Filter Controls (hidden in print) */}
      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-600">Select Date Period:</span>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-40"
          />
          <span className="text-slate-400 text-xs">to</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-40"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const now = new Date();
              const todayStr = now.toISOString().split("T")[0];
              setStartDate(todayStr);
              setEndDate(todayStr);
            }}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const now = new Date();
              const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
              const todayStr = now.toISOString().split("T")[0];
              setStartDate(firstDay);
              setEndDate(todayStr);
            }}
          >
            This Month
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const now = new Date();
              const startFy = new Date(now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1, 3, 1).toISOString().split("T")[0];
              const todayStr = now.toISOString().split("T")[0];
              setStartDate(startFy);
              setEndDate(todayStr);
            }}
          >
            Financial Year
          </Button>
        </div>
      </div>

      {/* Printable Report Header */}
      <div className="hidden print:block mb-6 border-b border-slate-800 pb-4">
        <h2 className="text-2xl font-black text-slate-900">KASI AGRI AGENCIES</h2>
        <p className="text-xs text-slate-600">
          Certified Fertilizers, Hybrid Seeds & Plant Protection Chemicals • Thiruvarur, Tamil Nadu
        </p>
        <h3 className="text-base font-bold text-slate-800 mt-2">
          Business Cashbook & Financial Movement Report
        </h3>
        <p className="text-xs text-slate-500">
          Period: {formatDate(startDate)} to {formatDate(endDate)} • Generated on{" "}
          {new Date().toLocaleString("en-IN")}
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : !report ? (
        <div className="p-12 text-center text-slate-500">No report data available for this range.</div>
      ) : (
        <div className="space-y-6">
          {/* Income vs Expense Financial Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="border border-slate-200/90 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Total Inflows (Money In)</span>
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-emerald-700">
                  +{formatCurrency(report.summary.periodInflows.total)}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Cash Sales, UPI, and Customer repayments
                </p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200/90 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Total Outflows (Money Out)</span>
                  <TrendingDown className="h-4 w-4 text-rose-600" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-rose-700">
                  -{formatCurrency(report.summary.periodOutflows.total)}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Store expenses, supplier & purchase settlements
                </p>
              </CardContent>
            </Card>

            <Card className="border border-slate-200/90 shadow-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>Net Movement in Period</span>
                  <Coins className="h-4 w-4 text-slate-700" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-black ${
                    netIncome >= 0 ? "text-[#176B3A]" : "text-rose-600"
                  }`}
                >
                  {netIncome >= 0 ? `+${formatCurrency(netIncome)}` : formatCurrency(netIncome)}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Closing Balance: {formatCurrency(report.summary.closingBalances.total)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Payment Method / Account Separation Breakdown */}
          <Card className="border border-slate-200 shadow-xs overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-sm font-bold text-slate-800">
                Payment Account & Method Breakdown
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/75">
                  <TableRow>
                    <TableHead>Payment Account</TableHead>
                    <TableHead className="text-right">Opening Balance</TableHead>
                    <TableHead className="text-right text-emerald-700">Inflows (+)</TableHead>
                    <TableHead className="text-right text-rose-700">Outflows (-)</TableHead>
                    <TableHead className="text-right">Net Movement</TableHead>
                    <TableHead className="text-right font-bold">Closing Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE"] as const).map((method) => {
                    const row = report.methodBreakdown[method];
                    return (
                      <TableRow key={method} className="hover:bg-slate-50/50">
                        <TableCell className="font-semibold text-slate-800 text-xs">
                          {method === "CASH"
                            ? "Cash In Hand"
                            : method === "UPI"
                            ? "UPI / QR Account"
                            : method === "BANK_TRANSFER"
                            ? "Bank Account (NEFT/RTGS)"
                            : "Cheques Register"}
                        </TableCell>
                        <TableCell className="text-right text-xs text-slate-600">
                          {formatCurrency(row.opening)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold text-emerald-700">
                          +{formatCurrency(row.inflow)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold text-rose-700">
                          -{formatCurrency(row.outflow)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-medium text-slate-700">
                          {row.net >= 0 ? `+${formatCurrency(row.net)}` : formatCurrency(row.net)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-bold text-slate-900">
                          {formatCurrency(row.closing)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-slate-50 font-black border-t-2 border-slate-200">
                    <TableCell className="text-xs text-slate-900">TOTAL CONSOLIDATED</TableCell>
                    <TableCell className="text-right text-xs text-slate-900">
                      {formatCurrency(report.summary.openingBalances.total)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-emerald-700">
                      +{formatCurrency(report.summary.periodInflows.total)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-rose-700">
                      -{formatCurrency(report.summary.periodOutflows.total)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-slate-900">
                      {netIncome >= 0 ? `+${formatCurrency(netIncome)}` : formatCurrency(netIncome)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-slate-900">
                      {formatCurrency(report.summary.closingBalances.total)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Category-wise Expense Breakdown */}
          <Card className="border border-slate-200 shadow-xs overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
              <CardTitle className="text-sm font-bold text-slate-800 flex items-center justify-between">
                <span>Category-wise Expense Breakdown</span>
                <Tag className="h-4 w-4 text-slate-500" />
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50/75">
                  <TableRow>
                    <TableHead>Category Name</TableHead>
                    <TableHead className="text-center w-28">Vouchers</TableHead>
                    <TableHead className="text-right w-36">Total Amount</TableHead>
                    <TableHead className="text-right w-28">% of Expenses</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.categoryBreakdown.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-xs text-slate-500">
                        No expenses incurred during this period.
                      </TableCell>
                    </TableRow>
                  ) : (
                    report.categoryBreakdown.map((cat) => (
                      <TableRow key={cat.categoryId} className="hover:bg-slate-50/50">
                        <TableCell className="font-semibold text-slate-800 text-xs">
                          {cat.categoryName}
                        </TableCell>
                        <TableCell className="text-center text-xs text-slate-600">
                          {cat.count}
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold text-slate-900">
                          {formatCurrency(cat.totalAmount)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-slate-600">
                          {cat.percentage}%
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          {/* Daily Timeline Table */}
          {report.dailyTimeline.length > 0 && (
            <Card className="border border-slate-200 shadow-xs overflow-hidden">
              <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
                <CardTitle className="text-sm font-bold text-slate-800 flex items-center justify-between">
                  <span>Daily Balances Timeline</span>
                  <Clock className="h-4 w-4 text-slate-500" />
                </CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-50/75">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Opening Balance</TableHead>
                      <TableHead className="text-right text-emerald-700">Inflows (+)</TableHead>
                      <TableHead className="text-right text-rose-700">Outflows (-)</TableHead>
                      <TableHead className="text-right font-bold">Closing Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.dailyTimeline.map((day) => (
                      <TableRow key={day.date} className="hover:bg-slate-50/50">
                        <TableCell className="text-xs font-semibold text-slate-800">
                          {formatDate(day.date)}
                        </TableCell>
                        <TableCell className="text-right text-xs text-slate-600">
                          {formatCurrency(day.openingBalance)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold text-emerald-700">
                          +{formatCurrency(day.inflow)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold text-rose-700">
                          -{formatCurrency(day.outflow)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-black text-slate-900">
                          {formatCurrency(day.closingBalance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}

          {/* Footer certification in print */}
          <div className="hidden print:flex justify-between items-end pt-12 border-t border-slate-400 mt-12 text-xs text-slate-600">
            <div>
              <p>Generated by KASI Agri Agencies Management System</p>
              <p>Accounting records reconciled from verified electronic vouchers.</p>
            </div>
            <div className="text-right">
              <div className="border-t border-slate-800 w-44 pt-1 font-semibold text-slate-900">
                Authorized Signature
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CashbookReportsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <CashbookReportsContent />
    </React.Suspense>
  );
}
