"use client";

import * as React from "react";
import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Users,
  Edit2,
  Phone,
  Mail,
  MapPin,
  Building2,
  Clock,
  AlertCircle,
  Receipt,
  CreditCard,
  FileText,
  Calendar,
  CheckCircle2,
  RefreshCw,
  Search,
  Plus,
  RotateCcw,
  Printer,
  ChevronRight,
  Eye,
  Layers,
  BookOpenText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  RecordRepaymentDialog,
  ReversalDialog,
  PaymentDetailsDialog,
  CustomerFormDialog,
} from "@/components/customers";
import type {
  ICustomer,
  IKhataLedger,
  IKhataLedgerEntry,
  ICustomerPayment,
  ICustomerStatement,
} from "@/types/customer";

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function formatINR(val: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(val || 0);
}

function formatDate(dateStr: string | Date | undefined): string {
  if (!dateStr) return "-";
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(dateStr);
  }
}

function CustomerProfileContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params?.id as string;

  const initialTab =
    (searchParams.get("tab") as "khata" | "invoices" | "payments" | "statement") || "khata";
  const [activeTab, setActiveTab] = useState<"khata" | "invoices" | "payments" | "statement">(
    ["khata", "invoices", "payments", "statement"].includes(initialTab) ? initialTab : "khata"
  );

  // Profile data
  const [customer, setCustomer] = useState<ICustomer | null>(null);
  const [profileStats, setProfileStats] = useState<{
    totalInvoices: number;
    unpaidInvoices: number;
    totalRepayments: number;
  }>({ totalInvoices: 0, unpaidInvoices: 0, totalRepayments: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Khata ledger state
  const [ledger, setLedger] = useState<IKhataLedger | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Invoices state
  const [invoices, setInvoices] = useState<any[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  // Repayments state
  const [payments, setPayments] = useState<ICustomerPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  // Statement state
  const [statement, setStatement] = useState<ICustomerStatement | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);

  // Dialogs
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
  const [isRecordRepaymentOpen, setIsRecordRepaymentOpen] = useState(false);
  const [selectedPaymentForDetails, setSelectedPaymentForDetails] =
    useState<ICustomerPayment | null>(null);
  const [isPaymentDetailsOpen, setIsPaymentDetailsOpen] = useState(false);
  const [paymentForReversal, setPaymentForReversal] = useState<ICustomerPayment | null>(null);
  const [isReversalOpen, setIsReversalOpen] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  // 1. Load customer profile
  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    fetch(`/api/customers/${id}`, { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        setLoading(false);
        if (data.success && data.data) {
          setCustomer(data.data.customer);
          if (data.data.stats) {
            setProfileStats(data.data.stats);
          }
        } else {
          setError(data.error?.message || "Customer not found");
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setLoading(false);
        setError("Failed to load customer profile");
      });

    return () => {
      isMounted = false;
    };
  }, [id, refreshKey]);

  // 2. Load Khata Ledger when tab is active
  useEffect(() => {
    if (!id || activeTab !== "khata") return;
    let isMounted = true;

    const q = new URLSearchParams();
    if (fromDate) q.set("fromDate", fromDate);
    if (toDate) q.set("toDate", toDate);

    fetch(`/api/customers/${id}/ledger?${q.toString()}`, { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && data.data) {
          setLedger(data.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLedgerLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id, activeTab, fromDate, toDate, refreshKey]);

  // 3. Load Invoices when tab is active
  useEffect(() => {
    if (!id || activeTab !== "invoices") return;
    let isMounted = true;

    fetch(`/api/sales?customer=${id}&limit=100`, { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && data.data) {
          setInvoices(data.data.sales || []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setInvoicesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id, activeTab, refreshKey]);

  // 4. Load Repayments when tab is active
  useEffect(() => {
    if (!id || activeTab !== "payments") return;
    let isMounted = true;

    fetch(`/api/customers/payments?customerId=${id}&limit=100`, { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && data.data) {
          setPayments(data.data.payments || []);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setPaymentsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id, activeTab, refreshKey]);

  // 5. Load Statement when tab is active
  useEffect(() => {
    if (!id || activeTab !== "statement") return;
    let isMounted = true;

    const q = new URLSearchParams();
    if (fromDate) q.set("fromDate", fromDate);
    if (toDate) q.set("toDate", toDate);

    fetch(`/api/customers/${id}/statement?${q.toString()}`, { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && data.data) {
          setStatement(data.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setStatementLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [id, activeTab, fromDate, toDate, refreshKey]);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-500">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-600" />
        <p className="text-sm">Loading customer Khata profile...</p>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="py-20 text-center space-y-4">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          {error || "Customer Not Found"}
        </h2>
        <Button onClick={() => router.push("/customers")} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Customers
        </Button>
      </div>
    );
  }

  const hasCredit = (customer.outstandingCredit || 0) > 0;

  return (
    <div className="space-y-6">
      {/* Print stylesheet override for clean statement printing */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-statement,
          #printable-statement * {
            visibility: visible;
          }
          #printable-statement {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 20px;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Top Navigation & Profile Header (Hidden in Print) */}
      <div className="no-print space-y-4">
        <div className="flex items-center gap-2">
          <Link
            href="/customers"
            className="text-xs text-slate-500 hover:text-emerald-600 flex items-center gap-1 font-medium"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Customer Directory</span>
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold">
            {customer.name}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold text-lg shrink-0">
              {customer.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                  {customer.name}
                </h1>
                <Badge
                  variant={customer.status === "ACTIVE" ? "agri" : "neutral"}
                  className="text-xs"
                >
                  {customer.status}
                </Badge>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-500 mt-1 flex-wrap">
                <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{customer.phone}</span>
                </div>
                {customer.village && (
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{customer.village}</span>
                    {customer.district && <span>, {customer.district}</span>}
                  </div>
                )}
                {customer.gstin && (
                  <div className="flex items-center gap-1 font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    GSTIN: {customer.gstin}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {hasCredit && (
              <Button
                onClick={() => setIsRecordRepaymentOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                <CreditCard className="w-4 h-4 mr-1.5" />
                Record Repayment
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => setIsEditCustomerOpen(true)}
              className="text-xs"
            >
              <Edit2 className="w-3.5 h-3.5 mr-1.5" />
              Edit Profile
            </Button>

            <Button
              variant="outline"
              onClick={() => {
                setActiveTab("statement");
              }}
              className="text-xs"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Statement
            </Button>
          </div>
        </div>

        {/* Customer Balance KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-amber-200 dark:border-amber-900/50 bg-amber-50/20">
            <CardContent className="p-4">
              <div className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center justify-between">
                <span>Outstanding Khata Balance</span>
                {hasCredit && <AlertCircle className="w-4 h-4 text-amber-600" />}
              </div>
              <div className="text-2xl font-bold text-amber-900 dark:text-amber-200 mt-1">
                {formatINR(customer.outstandingCredit || 0)}
              </div>
              <div className="text-[11px] text-amber-700/80 mt-0.5">
                {profileStats.unpaidInvoices} unsettled invoice(s)
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-slate-500 font-medium">Cumulative Purchases</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                {formatINR(customer.totalPurchases || 0)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {profileStats.totalInvoices} sales invoices
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-slate-500 font-medium">Total Paid / Repaid</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">
                {formatINR(customer.totalPaid || 0)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {profileStats.totalRepayments} repayment voucher(s)
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-slate-500 font-medium">Khata Status</div>
              <div className="text-lg font-bold mt-1.5 flex items-center gap-1.5">
                {hasCredit ? (
                  <span className="text-amber-600 flex items-center gap-1">
                    <Clock className="w-4 h-4" /> Credit Active
                  </span>
                ) : (
                  <span className="text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> All Settled
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Purchases = Paid + Outstanding
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-slate-200 dark:border-slate-800">
          <nav className="flex space-x-6">
            <button
              onClick={() => setActiveTab("khata")}
              className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
                activeTab === "khata"
                  ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <BookOpenText className="w-4 h-4" />
              <span>Khata Ledger</span>
            </button>

            <button
              onClick={() => setActiveTab("invoices")}
              className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
                activeTab === "invoices"
                  ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Receipt className="w-4 h-4" />
              <span>Sales Invoices</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600">
                {profileStats.totalInvoices}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("payments")}
              className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
                activeTab === "payments"
                  ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>Repayment Vouchers</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600">
                {profileStats.totalRepayments}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("statement")}
              className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
                activeTab === "statement"
                  ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>Statement View</span>
            </button>
          </nav>
        </div>
      </div>

      {/* TAB 1: KHATA LEDGER */}
      {activeTab === "khata" && (
        <div className="space-y-4 no-print">
          {/* Ledger Date Filter */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-700 dark:text-slate-300">Period:</span>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">From:</span>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-8 text-xs w-36"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">To:</span>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-8 text-xs w-36"
                />
              </div>
              {(fromDate || toDate) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFromDate("");
                    setToDate("");
                  }}
                  className="h-8 text-xs"
                >
                  Reset Period
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRefreshKey((k) => k + 1)}
                className="h-8"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Ledger Content */}
          {ledgerLoading ? (
            <div className="py-12 text-center text-sm text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
              Reconciling Khata ledger transactions...
            </div>
          ) : !ledger ? (
            <div className="py-12 text-center text-sm text-slate-500">
              No ledger data available.
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Transaction Particulars</TableHead>
                    <TableHead>Reference #</TableHead>
                    <TableHead className="text-right">Debit (Credit Given)</TableHead>
                    <TableHead className="text-right">Credit (Repaid)</TableHead>
                    <TableHead className="text-right">Running Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Opening Balance Row */}
                  <TableRow className="bg-slate-50/80 dark:bg-slate-900/80 font-medium">
                    <TableCell className="text-slate-500 text-xs">
                      {formatDate(ledger.periodFrom || "—")}
                    </TableCell>
                    <TableCell colSpan={2} className="text-slate-700 dark:text-slate-300 font-semibold">
                      Opening Balance as of {formatDate(ledger.periodFrom || "beginning")}
                    </TableCell>
                    <TableCell className="text-right text-slate-400">—</TableCell>
                    <TableCell className="text-right text-slate-400">—</TableCell>
                    <TableCell className="text-right font-bold text-slate-900 dark:text-slate-100">
                      {formatINR(ledger.openingBalance)}
                    </TableCell>
                  </TableRow>

                  {/* Ledger Entries */}
                  {ledger.transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-8 text-center text-xs text-slate-500">
                        No transactions recorded in this date range.
                      </TableCell>
                    </TableRow>
                  ) : (
                    ledger.transactions.map((entry) => {
                      const isReversed = entry.status === "REVERSED";

                      return (
                        <TableRow
                          key={entry.id}
                          className={`hover:bg-slate-50/50 ${
                            isReversed ? "opacity-50 line-through" : ""
                          }`}
                        >
                          <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                            {formatDate(entry.date)}
                          </TableCell>

                          <TableCell>
                            <div className="font-medium text-slate-900 dark:text-slate-100 text-xs">
                              {entry.label}
                            </div>
                            {isReversed && (
                              <Badge variant="danger" className="text-[9px] text-red-600 border-red-300">
                                REVERSED
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell>
                            <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                              {entry.reference}
                            </span>
                          </TableCell>

                          <TableCell className="text-right font-medium text-amber-700 dark:text-amber-400">
                            {entry.debitAmount > 0 ? formatINR(entry.debitAmount) : "—"}
                          </TableCell>

                          <TableCell className="text-right font-medium text-emerald-700 dark:text-emerald-400">
                            {entry.creditAmount > 0 ? formatINR(entry.creditAmount) : "—"}
                          </TableCell>

                          <TableCell className="text-right font-bold text-slate-900 dark:text-slate-100">
                            {formatINR(entry.runningBalance)}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>

              {/* Ledger Summary Footer */}
              <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500 block">Total Credit Given:</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400 text-sm">
                    {formatINR(ledger.totalCreditGiven)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Total Repayments:</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                    {formatINR(ledger.totalPaymentsReceived)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">Net Period Change:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">
                    {formatINR(ledger.totalCreditGiven - ledger.totalPaymentsReceived)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block font-semibold">Closing Balance:</span>
                  <span className="font-bold text-emerald-800 dark:text-emerald-300 text-base">
                    {formatINR(ledger.closingBalance)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SALES INVOICES */}
      {activeTab === "invoices" && (
        <div className="space-y-4 no-print">
          {invoicesLoading ? (
            <div className="py-12 text-center text-sm text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
              Loading customer sales invoices...
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-12 text-center text-slate-500 border border-dashed rounded-xl">
              No sales invoices found for this customer.
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Billing Type</TableHead>
                    <TableHead className="text-right">Grand Total</TableHead>
                    <TableHead className="text-right">Repaid Amount</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Payment Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv) => {
                    const statusColors: Record<string, string> = {
                      PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
                      PARTIALLY_PAID: "bg-amber-50 text-amber-700 border-amber-200",
                      UNPAID: "bg-red-50 text-red-700 border-red-200",
                    };

                    const due =
                      inv.outstandingAmount !== undefined
                        ? inv.outstandingAmount
                        : round2((inv.creditAmount ?? inv.grandTotal) - (inv.repaidAmount ?? 0));

                    return (
                      <TableRow key={inv._id || inv.id} className="hover:bg-slate-50/50">
                        <TableCell className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                          {inv.invoiceNumber}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                          {formatDate(inv.saleDate || inv.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="neutral" className="text-[10px]">
                            {inv.paymentType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium text-slate-900 dark:text-slate-100">
                          {formatINR(inv.grandTotal)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-emerald-600">
                          {formatINR(inv.repaidAmount || 0)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-amber-600">
                          {formatINR(due)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="neutral"
                            className={`text-[10px] ${
                              statusColors[inv.paymentStatus] || "bg-slate-50 text-slate-700"
                            }`}
                          >
                            {inv.paymentStatus}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: REPAYMENT VOUCHERS */}
      {activeTab === "payments" && (
        <div className="space-y-4 no-print">
          {paymentsLoading ? (
            <div className="py-12 text-center text-sm text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
              Loading customer repayment vouchers...
            </div>
          ) : payments.length === 0 ? (
            <div className="py-12 text-center text-slate-500 border border-dashed rounded-xl">
              No repayment vouchers recorded for this customer yet.
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Voucher #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Reference / Cheque</TableHead>
                    <TableHead className="text-right">Repayment Amount</TableHead>
                    <TableHead>Allocations</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payments.map((p) => {
                    const isReversed = p.status === "REVERSED";

                    return (
                      <TableRow key={p._id} className="hover:bg-slate-50/50">
                        <TableCell className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                          {p.paymentNumber}
                        </TableCell>

                        <TableCell className="text-xs text-slate-600 dark:text-slate-400">
                          {formatDate(p.paymentDate)}
                        </TableCell>

                        <TableCell className="text-xs text-slate-700 dark:text-slate-300">
                          {p.paymentMethod}
                        </TableCell>

                        <TableCell className="text-xs text-slate-500 font-mono">
                          {p.transactionReference || "—"}
                        </TableCell>

                        <TableCell className="text-right font-bold text-emerald-600">
                          {formatINR(p.amount)}
                        </TableCell>

                        <TableCell className="text-xs text-slate-500">
                          {p.allocations?.length || 0} invoice(s)
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant="neutral"
                            className={`text-[10px] ${
                              isReversed
                                ? "bg-red-50 text-red-700 border-red-200"
                                : "bg-emerald-50 text-emerald-700 border-emerald-200"
                            }`}
                          >
                            {p.status}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => {
                                setSelectedPaymentForDetails(p);
                                setIsPaymentDetailsOpen(true);
                              }}
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              Details
                            </Button>

                            {!isReversed && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-amber-700 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                onClick={() => {
                                  setPaymentForReversal(p);
                                  setIsReversalOpen(true);
                                }}
                              >
                                <RotateCcw className="w-3 h-3 mr-1" />
                                Reverse
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: PRINTABLE STATEMENT VIEW */}
      {activeTab === "statement" && (
        <div className="space-y-4">
          <div className="no-print flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
            <span className="text-slate-600 dark:text-slate-400">
              Print-friendly customer Khata passbook / statement formatted for A4 print and audit records.
            </span>
            <Button
              onClick={handlePrint}
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-8 text-xs font-semibold"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5" />
              Print Statement
            </Button>
          </div>

          {statementLoading ? (
            <div className="py-12 text-center text-sm text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
              Generating printable statement...
            </div>
          ) : !statement ? (
            <div className="py-12 text-center text-slate-500">Failed to load statement.</div>
          ) : (
            <div
              id="printable-statement"
              className="p-8 bg-white text-slate-900 rounded-xl border border-slate-200 shadow-sm max-w-4xl mx-auto space-y-6"
            >
              {/* Shop Header */}
              <div className="border-b-2 border-slate-900 pb-4 flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold uppercase tracking-wide text-slate-900">
                    {statement.shop.shopName || "KASI AGRI AGENCIES"}
                  </h2>
                  <div className="text-xs text-slate-600 space-y-0.5 mt-1">
                    {statement.shop.address && <p>{statement.shop.address}</p>}
                    <p>
                      {[
                        statement.shop.village,
                        statement.shop.district,
                        statement.shop.state,
                        statement.shop.pincode,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                    <p>Phone: {statement.shop.phone || "—"}</p>
                    {statement.shop.gstin && (
                      <p className="font-semibold text-slate-800">GSTIN: {statement.shop.gstin}</p>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-bold uppercase bg-slate-100 px-3 py-1 border border-slate-300 rounded inline-block">
                    KHATA STATEMENT
                  </div>
                  <div className="text-xs text-slate-500 mt-2">
                    Date: {formatDate(statement.generatedAt)}
                  </div>
                </div>
              </div>

              {/* Customer Info & Statement Period */}
              <div className="grid grid-cols-2 gap-4 text-xs p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 font-semibold block uppercase text-[10px]">
                    Customer Details:
                  </span>
                  <div className="font-bold text-sm text-slate-900 mt-0.5">
                    {statement.customer.name}
                  </div>
                  <div className="text-slate-600">Phone: {statement.customer.phone}</div>
                  {statement.customer.village && (
                    <div className="text-slate-600">Village: {statement.customer.village}</div>
                  )}
                  {statement.customer.gstin && (
                    <div className="text-slate-700 font-mono">GSTIN: {statement.customer.gstin}</div>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-slate-500 font-semibold block uppercase text-[10px]">
                    Statement Period:
                  </span>
                  <div className="font-semibold text-slate-900 mt-0.5">
                    {statement.fromDate ? formatDate(statement.fromDate) : "Beginning"} to{" "}
                    {statement.toDate ? formatDate(statement.toDate) : "Present"}
                  </div>
                  <div className="mt-2 text-slate-500">
                    Net Outstanding:{" "}
                    <span className="font-bold text-amber-700 text-sm">
                      {formatINR(statement.closingBalance)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Statement Ledger Table */}
              <div>
                <table className="w-full text-xs text-left border-collapse border border-slate-300">
                  <thead className="bg-slate-100 font-semibold text-slate-800 border-b border-slate-300">
                    <tr>
                      <th className="py-2 px-2.5 border-r border-slate-300">Date</th>
                      <th className="py-2 px-2.5 border-r border-slate-300">Particulars</th>
                      <th className="py-2 px-2.5 border-r border-slate-300">Ref #</th>
                      <th className="py-2 px-2.5 text-right border-r border-slate-300">
                        Debit (Credit Given)
                      </th>
                      <th className="py-2 px-2.5 text-right border-r border-slate-300">
                        Credit (Repaid)
                      </th>
                      <th className="py-2 px-2.5 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr className="bg-slate-50 font-semibold">
                      <td className="py-1.5 px-2.5 border-r border-slate-300">
                        {formatDate(statement.fromDate)}
                      </td>
                      <td colSpan={2} className="py-1.5 px-2.5 border-r border-slate-300">
                        Opening Balance
                      </td>
                      <td className="py-1.5 px-2.5 text-right border-r border-slate-300">—</td>
                      <td className="py-1.5 px-2.5 text-right border-r border-slate-300">—</td>
                      <td className="py-1.5 px-2.5 text-right font-bold">
                        {formatINR(statement.openingBalance)}
                      </td>
                    </tr>

                    {statement.transactions.map((entry) => (
                      <tr key={entry.id}>
                        <td className="py-1.5 px-2.5 border-r border-slate-300">
                          {formatDate(entry.date)}
                        </td>
                        <td className="py-1.5 px-2.5 border-r border-slate-300">
                          {entry.label}
                        </td>
                        <td className="py-1.5 px-2.5 border-r border-slate-300 font-mono">
                          {entry.reference}
                        </td>
                        <td className="py-1.5 px-2.5 text-right border-r border-slate-300">
                          {entry.debitAmount > 0 ? formatINR(entry.debitAmount) : "—"}
                        </td>
                        <td className="py-1.5 px-2.5 text-right border-r border-slate-300">
                          {entry.creditAmount > 0 ? formatINR(entry.creditAmount) : "—"}
                        </td>
                        <td className="py-1.5 px-2.5 text-right font-semibold">
                          {formatINR(entry.runningBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-300">
                    <tr>
                      <td colSpan={3} className="py-2 px-2.5 border-r border-slate-300">
                        Totals
                      </td>
                      <td className="py-2 px-2.5 text-right border-r border-slate-300">
                        {formatINR(statement.totalCreditGiven)}
                      </td>
                      <td className="py-2 px-2.5 text-right border-r border-slate-300">
                        {formatINR(statement.totalPaymentsReceived)}
                      </td>
                      <td className="py-2 px-2.5 text-right font-bold text-amber-800">
                        {formatINR(statement.closingBalance)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Statement Footer & Signatures */}
              <div className="pt-8 flex justify-between items-end text-xs text-slate-600">
                <div>
                  <p>Customer Signature: _________________________</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Thank you for your business with KASI AGRI AGENCIES.
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-semibold">For {statement.shop.shopName || "KASI AGRI AGENCIES"}</p>
                  <div className="h-12"></div>
                  <p>Authorized Signatory</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* DIALOGS */}
      {/* 1. Edit Customer Form */}
      <CustomerFormDialog
        open={isEditCustomerOpen}
        onOpenChange={setIsEditCustomerOpen}
        customer={customer}
        onSuccess={(updated) => {
          setCustomer(updated);
          setRefreshKey((k) => k + 1);
        }}
      />

      {/* 2. Record Customer Repayment Dialog */}
      <RecordRepaymentDialog
        open={isRecordRepaymentOpen}
        onOpenChange={setIsRecordRepaymentOpen}
        customerId={customer._id || id}
        customerName={customer.name}
        customerPhone={customer.phone}
        currentOutstanding={customer.outstandingCredit || 0}
        onSuccess={() => {
          setRefreshKey((k) => k + 1);
        }}
      />

      {/* 3. Payment Details Dialog */}
      <PaymentDetailsDialog
        open={isPaymentDetailsOpen}
        onOpenChange={setIsPaymentDetailsOpen}
        payment={selectedPaymentForDetails}
        onReverseClick={(p) => {
          setPaymentForReversal(p);
          setIsReversalOpen(true);
        }}
      />

      {/* 4. Payment Reversal Dialog */}
      <ReversalDialog
        open={isReversalOpen}
        onOpenChange={setIsReversalOpen}
        payment={paymentForReversal}
        onSuccess={() => {
          setRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
}

export default function CustomerProfilePage() {
  return (
    <React.Suspense
      fallback={
        <div className="py-20 text-center text-slate-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-600" />
          <p className="text-sm">Loading customer Khata profile...</p>
        </div>
      }
    >
      <CustomerProfileContent />
    </React.Suspense>
  );
}

