"use client";

import * as React from "react";
import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Users,
  Plus,
  Search,
  Edit2,
  Phone,
  MapPin,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Eye,
  CreditCard,
  BookOpenText,
  Clock,
  TrendingUp,
  Receipt,
  RotateCcw,
  Calendar,
  Layers,
  ChevronRight,
  Filter,
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
import { EmptyState } from "@/components/ui/empty-state";
import {
  RecordRepaymentDialog,
  ReversalDialog,
  PaymentDetailsDialog,
  CustomerFormDialog,
} from "@/components/customers";
import type {
  ICustomer,
  CustomerStatus,
  ICustomerAgingItem,
  ICustomerAgingSummary,
  ICreditCollectionDashboard,
  ICustomerPayment,
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

function CustomersContent() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as "directory" | "aging" | "dashboard") || "directory";

  const [activeTab, setActiveTab] = useState<"directory" | "aging" | "dashboard">(
    ["directory", "aging", "dashboard"].includes(initialTab) ? initialTab : "directory"
  );

  // Tab 1: Directory State
  const [customers, setCustomers] = useState<ICustomer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CustomerStatus | "ALL">("ACTIVE");
  const [hasCreditFilter, setHasCreditFilter] = useState<"ALL" | "HAS_CREDIT" | "NO_CREDIT">("ALL");
  const [summaryStats, setSummaryStats] = useState({
    totalCustomers: 0,
    activeCustomers: 0,
    totalOutstanding: 0,
    totalPurchases: 0,
  });

  // Tab 2: Aging State
  const [agingItems, setAgingItems] = useState<ICustomerAgingItem[]>([]);
  const [agingSummary, setAgingSummary] = useState<ICustomerAgingSummary | null>(null);
  const [agingLoading, setAgingLoading] = useState(false);
  const [agingBucketFilter, setAgingBucketFilter] = useState<string>("ALL");

  // Tab 3: Dashboard State
  const [dashboardData, setDashboardData] = useState<ICreditCollectionDashboard | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);

  // Dialogs State
  const [isCustomerFormOpen, setIsCustomerFormOpen] = useState(false);
  const [selectedCustomerForEdit, setSelectedCustomerForEdit] = useState<ICustomer | null>(null);

  const [isRepaymentOpen, setIsRepaymentOpen] = useState(false);
  const [targetCustomerForRepayment, setTargetCustomerForRepayment] = useState<{
    id: string;
    name: string;
    phone?: string;
    outstanding: number;
  } | null>(null);

  const [selectedPaymentForDetails, setSelectedPaymentForDetails] = useState<ICustomerPayment | null>(null);
  const [isPaymentDetailsOpen, setIsPaymentDetailsOpen] = useState(false);

  const [paymentForReversal, setPaymentForReversal] = useState<ICustomerPayment | null>(null);
  const [isReversalOpen, setIsReversalOpen] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  // 1. Fetch Customers Directory
  useEffect(() => {
    let isMounted = true;

    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    if (hasCreditFilter === "HAS_CREDIT") params.set("hasCredit", "true");
    if (hasCreditFilter === "NO_CREDIT") params.set("hasCredit", "false");
    params.set("limit", "100");

    fetch(`/api/customers?${params.toString()}`, { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && data.data) {
          setCustomers(data.data.customers || []);
          if (data.data.summary) {
            setSummaryStats(data.data.summary);
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setCustomersLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [search, statusFilter, hasCreditFilter, refreshKey]);

  // 2. Fetch Aging Report when Aging tab is selected
  useEffect(() => {
    if (activeTab !== "aging") return;
    let isMounted = true;

    const params = new URLSearchParams();
    if (agingBucketFilter !== "ALL") params.set("bucket", agingBucketFilter);

    fetch(`/api/customers/aging?${params.toString()}`, { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && data.data) {
          setAgingItems(data.data.items || []);
          setAgingSummary(data.data.summary || null);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setAgingLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab, agingBucketFilter, refreshKey]);

  // 3. Fetch Collection Dashboard when Dashboard tab is selected
  useEffect(() => {
    if (activeTab !== "dashboard") return;
    let isMounted = true;

    fetch(`/api/customers/dashboard`, { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data) => {
        if (!isMounted) return;
        if (data.success && data.data) {
          setDashboardData(data.data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setDashboardLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeTab, refreshKey]);

  const handleOpenRepayment = (c: {
    _id?: string;
    id?: string;
    name: string;
    phone?: string;
    outstandingCredit?: number;
    outstandingBalance?: number;
  }) => {
    const custId = (c._id || c.id) as string;
    const balance = c.outstandingCredit ?? c.outstandingBalance ?? 0;
    setTargetCustomerForRepayment({
      id: custId,
      name: c.name,
      phone: c.phone,
      outstanding: balance,
    });
    setIsRepaymentOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-7 h-7 text-emerald-600" />
            <span>Customer & Farmer Accounts</span>
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage customer directories, rural Khata credit balances, and payment collections.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setSelectedCustomerForEdit(null);
              setIsCustomerFormOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Customer
          </Button>
        </div>
      </div>

      {/* Primary Module Navigation Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab("directory")}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === "directory"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Customer Directory</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {summaryStats.totalCustomers}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("aging")}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === "aging"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Aging & Khata Ledger</span>
            {summaryStats.totalOutstanding > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold">
                Due
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("dashboard")}
            className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
              activeTab === "dashboard"
                ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Credit Collection Dashboard</span>
          </button>
        </nav>
      </div>

      {/* TAB 1: CUSTOMER DIRECTORY */}
      {activeTab === "directory" && (
        <div className="space-y-5">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-slate-500 font-medium">Total Registered</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                  {summaryStats.totalCustomers}
                </div>
                <div className="text-[11px] text-emerald-600 mt-0.5">
                  {summaryStats.activeCustomers} active accounts
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-200/70 dark:border-amber-900/50 bg-amber-50/20">
              <CardContent className="p-4">
                <div className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
                  Total Outstanding Khata Credit
                </div>
                <div className="text-2xl font-bold text-amber-900 dark:text-amber-200 mt-1">
                  {formatINR(summaryStats.totalOutstanding)}
                </div>
                <div className="text-[11px] text-amber-700/80 mt-0.5">
                  Across all credit sales
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-slate-500 font-medium">Cumulative Purchases</div>
                <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                  {formatINR(summaryStats.totalPurchases)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">All customer billings</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-slate-500 font-medium">Collection Recovery</div>
                <div className="text-2xl font-bold text-emerald-600 mt-1">
                  {summaryStats.totalPurchases > 0
                    ? `${(
                        ((summaryStats.totalPurchases - summaryStats.totalOutstanding) /
                          summaryStats.totalPurchases) *
                        100
                      ).toFixed(1)}%`
                    : "100%"}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Paid vs total billed</div>
              </CardContent>
            </Card>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <Input
                type="text"
                placeholder="Search by name, phone, or village..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value="ACTIVE">Active Only</option>
                <option value="ALL">All Status</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>

              <select
                value={hasCreditFilter}
                onChange={(e) => setHasCreditFilter(e.target.value as any)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
              >
                <option value="ALL">All Balances</option>
                <option value="HAS_CREDIT">With Outstanding Credit</option>
                <option value="NO_CREDIT">Zero Balance</option>
              </select>

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

          {/* Customer Table */}
          {customersLoading ? (
            <div className="py-12 text-center text-sm text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
              Loading customer accounts...
            </div>
          ) : customers.length === 0 ? (
            <EmptyState
              icon={<Users className="w-6 h-6" />}
              title="No customer accounts found"
              description="No customers match your search criteria. Add a new customer to start recording sales and Khata ledger."
              action={
                <Button
                  onClick={() => {
                    setSelectedCustomerForEdit(null);
                    setIsCustomerFormOpen(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Customer
                </Button>
              }
            />
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer / Farmer</TableHead>
                    <TableHead>Phone & Village</TableHead>
                    <TableHead className="text-right">Total Purchases</TableHead>
                    <TableHead className="text-right">Total Paid</TableHead>
                    <TableHead className="text-right">Outstanding Khata</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((c) => {
                    const custId = c._id;
                    const hasCredit = (c.outstandingCredit || 0) > 0;

                    return (
                      <TableRow key={custId} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/60">
                        <TableCell>
                          <Link
                            href={`/customers/${custId}`}
                            className="font-semibold text-slate-900 dark:text-slate-100 hover:text-emerald-600 flex items-center gap-1.5"
                          >
                            <span>{c.name}</span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-400 opacity-60" />
                          </Link>
                          {c.notes && (
                            <span className="text-[11px] text-slate-500 block truncate max-w-xs">
                              {c.notes}
                            </span>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{c.phone}</span>
                          </div>
                          {c.village && (
                            <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span>{c.village}</span>
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="text-right font-medium text-slate-700 dark:text-slate-300">
                          {formatINR(c.totalPurchases || 0)}
                        </TableCell>

                        <TableCell className="text-right font-medium text-emerald-700 dark:text-emerald-400">
                          {formatINR(c.totalPaid || 0)}
                        </TableCell>

                        <TableCell className="text-right">
                          <span
                            className={`font-bold text-sm ${
                              hasCredit
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-slate-600 dark:text-slate-400"
                            }`}
                          >
                            {formatINR(c.outstandingCredit || 0)}
                          </span>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant={c.status === "ACTIVE" ? "agri" : "neutral"}
                            className="text-[10px]"
                          >
                            {c.status}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {hasCredit && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                onClick={() => handleOpenRepayment(c)}
                              >
                                <CreditCard className="w-3 h-3 mr-1" />
                                Collect
                              </Button>
                            )}

                            <Link href={`/customers/${custId}`}>
                              <Button size="sm" variant="outline" className="h-7 text-xs">
                                <BookOpenText className="w-3 h-3 mr-1" />
                                Khata
                              </Button>
                            </Link>

                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => {
                                setSelectedCustomerForEdit(c);
                                setIsCustomerFormOpen(true);
                              }}
                            >
                              <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                            </Button>
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

      {/* TAB 2: AGING & KHATA LEDGER */}
      {activeTab === "aging" && (
        <div className="space-y-5">
          {/* Aging Buckets Banner */}
          {agingSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <Card
                className={`cursor-pointer transition-all ${
                  agingBucketFilter === "ALL" ? "ring-2 ring-emerald-500 bg-emerald-50/20" : ""
                }`}
                onClick={() => setAgingBucketFilter("ALL")}
              >
                <CardContent className="p-3.5">
                  <div className="text-xs text-slate-500 font-medium">Total Khata Due</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
                    {formatINR(agingSummary.totalOutstanding)}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {agingSummary.totalPendingCustomers} debtors
                  </div>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-all border-emerald-200 dark:border-emerald-800 ${
                  agingBucketFilter === "0-30" ? "ring-2 ring-emerald-500 bg-emerald-50/30" : ""
                }`}
                onClick={() => setAgingBucketFilter("0-30")}
              >
                <CardContent className="p-3.5">
                  <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                    0–30 Days (Current)
                  </div>
                  <div className="text-lg font-bold text-emerald-900 dark:text-emerald-200 mt-1">
                    {formatINR(agingSummary.bucket0to30.amount)}
                  </div>
                  <div className="text-[11px] text-emerald-600 mt-0.5">On Schedule</div>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-all border-amber-200 dark:border-amber-800 ${
                  agingBucketFilter === "31-60" ? "ring-2 ring-amber-500 bg-amber-50/30" : ""
                }`}
                onClick={() => setAgingBucketFilter("31-60")}
              >
                <CardContent className="p-3.5">
                  <div className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
                    31–60 Days
                  </div>
                  <div className="text-lg font-bold text-amber-900 dark:text-amber-200 mt-1">
                    {formatINR(agingSummary.bucket31to60.amount)}
                  </div>
                  <div className="text-[11px] text-amber-600 mt-0.5">Follow-up Due</div>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-all border-orange-200 dark:border-orange-800 ${
                  agingBucketFilter === "61-90" ? "ring-2 ring-orange-500 bg-orange-50/30" : ""
                }`}
                onClick={() => setAgingBucketFilter("61-90")}
              >
                <CardContent className="p-3.5">
                  <div className="text-xs text-orange-700 dark:text-orange-400 font-semibold">
                    61–90 Days
                  </div>
                  <div className="text-lg font-bold text-orange-900 dark:text-orange-200 mt-1">
                    {formatINR(agingSummary.bucket61to90.amount)}
                  </div>
                  <div className="text-[11px] text-orange-600 mt-0.5">Overdue Action</div>
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-all border-red-200 dark:border-red-800 ${
                  agingBucketFilter === "90+" ? "ring-2 ring-red-500 bg-red-50/30" : ""
                }`}
                onClick={() => setAgingBucketFilter("90+")}
              >
                <CardContent className="p-3.5">
                  <div className="text-xs text-red-700 dark:text-red-400 font-semibold">
                    90+ Days (Critical)
                  </div>
                  <div className="text-lg font-bold text-red-900 dark:text-red-200 mt-1">
                    {formatINR(agingSummary.bucket90Plus.amount)}
                  </div>
                  <div className="text-[11px] text-red-600 mt-0.5">High Risk</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Aging Filter & Controls */}
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>Outstanding Balances by Aging Category</span>
              {agingBucketFilter !== "ALL" && (
                <Badge variant="neutral" className="text-xs">
                  Filter: {agingBucketFilter} Days
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-2">
              {agingBucketFilter !== "ALL" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAgingBucketFilter("ALL")}
                  className="text-xs"
                >
                  Clear Filter
                </Button>
              )}
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

          {/* Aging Table */}
          {agingLoading ? (
            <div className="py-12 text-center text-sm text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
              Calculating credit aging...
            </div>
          ) : agingItems.length === 0 ? (
            <div className="py-12 text-center text-slate-500 border border-dashed rounded-xl bg-white dark:bg-slate-950">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                No Outstanding Credit Found!
              </div>
              <p className="text-xs text-slate-500 mt-1">
                All customer accounts are fully settled for this filter category.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950 shadow-sm">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer / Farmer</TableHead>
                    <TableHead>Phone & Village</TableHead>
                    <TableHead>Oldest Unpaid Invoice</TableHead>
                    <TableHead>Aging Bucket</TableHead>
                    <TableHead className="text-right">Outstanding Credit</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agingItems.map((item) => {
                    const bucketColors: Record<string, string> = {
                      "0-30": "bg-emerald-50 text-emerald-700 border-emerald-200",
                      "31-60": "bg-amber-50 text-amber-700 border-amber-200",
                      "61-90": "bg-orange-50 text-orange-700 border-orange-200",
                      "90+": "bg-red-50 text-red-700 border-red-200",
                    };

                    return (
                      <TableRow key={item.customerId} className="hover:bg-slate-50/60 dark:hover:bg-slate-900/60">
                        <TableCell>
                          <Link
                            href={`/customers/${item.customerId}`}
                            className="font-semibold text-slate-900 dark:text-slate-100 hover:text-emerald-600"
                          >
                            {item.customerName}
                          </Link>
                        </TableCell>

                        <TableCell>
                          <div className="text-xs text-slate-700 dark:text-slate-300">
                            {item.phone}
                          </div>
                          {item.village && (
                            <div className="text-[11px] text-slate-500">{item.village}</div>
                          )}
                        </TableCell>

                        <TableCell>
                          <div className="text-xs font-mono font-medium text-slate-800 dark:text-slate-200">
                            {item.oldestUnpaidInvoiceNumber || "—"}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {formatDate(item.oldestUnpaidInvoiceDate)} ({item.ageInDays} days ago)
                          </div>
                        </TableCell>

                        <TableCell>
                          <Badge
                            variant="neutral"
                            className={`text-xs font-semibold ${
                              bucketColors[item.agingBucket] || "bg-slate-50 text-slate-700"
                            }`}
                          >
                            {item.agingBucket} Days
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right font-bold text-amber-600 dark:text-amber-400">
                          {formatINR(item.outstandingBalance)}
                        </TableCell>

                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() =>
                                handleOpenRepayment({
                                  id: item.customerId,
                                  name: item.customerName,
                                  phone: item.phone,
                                  outstandingBalance: item.outstandingBalance,
                                })
                              }
                            >
                              <CreditCard className="w-3 h-3 mr-1" />
                              Collect
                            </Button>

                            <Link href={`/customers/${item.customerId}`}>
                              <Button size="sm" variant="outline" className="h-7 text-xs">
                                <BookOpenText className="w-3 h-3 mr-1" />
                                Ledger
                              </Button>
                            </Link>
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

      {/* TAB 3: CREDIT COLLECTION DASHBOARD */}
      {activeTab === "dashboard" && (
        <div className="space-y-6">
          {dashboardLoading ? (
            <div className="py-12 text-center text-sm text-slate-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
              Loading collection metrics...
            </div>
          ) : !dashboardData ? (
            <div className="py-12 text-center text-slate-500">
              Failed to load collection dashboard data.
            </div>
          ) : (
            <>
              {/* Dashboard Metric Highlights */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/20">
                  <CardContent className="p-4">
                    <div className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                      Today&apos;s Cash & UPI Inflow
                    </div>
                    <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-200 mt-1">
                      {formatINR(dashboardData.collectedToday)}
                    </div>
                    <div className="text-[11px] text-emerald-600 mt-0.5">
                      Repayments collected today
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="text-xs text-slate-500 font-medium">This Month&apos;s Collection</div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                      {formatINR(dashboardData.collectedThisMonth)}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Current billing cycle</div>
                  </CardContent>
                </Card>

                <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/20">
                  <CardContent className="p-4">
                    <div className="text-xs text-amber-700 dark:text-amber-400 font-semibold">
                      Total Outstanding Khata
                    </div>
                    <div className="text-2xl font-bold text-amber-900 dark:text-amber-200 mt-1">
                      {formatINR(dashboardData.totalOutstandingCredit)}
                    </div>
                    <div className="text-[11px] text-amber-700/80 mt-0.5">
                      {dashboardData.totalPendingCustomers} pending debtor accounts
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4">
                    <div className="text-xs text-slate-500 font-medium">Total Credit Customers</div>
                    <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
                      {dashboardData.totalCustomers || summaryStats.totalCustomers}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Registered farmer accounts</div>
                  </CardContent>
                </Card>
              </div>

              {/* Two Column Layout: Top Debtors & Recent Repayments */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Debtors */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <span>Top Customers by Due Balance</span>
                    </h3>
                    <Link
                      href="/customers?tab=aging"
                      className="text-xs text-emerald-600 hover:underline"
                    >
                      View all aging &rarr;
                    </Link>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950">
                    {dashboardData.topDebtors.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        No outstanding balances recorded!
                      </div>
                    ) : (
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">Customer</th>
                            <th className="py-2.5 px-3">Village</th>
                            <th className="py-2.5 px-3 text-right">Outstanding</th>
                            <th className="py-2.5 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {dashboardData.topDebtors.map((d) => (
                            <tr key={d._id} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-slate-100">
                                <Link
                                  href={`/customers/${d._id}`}
                                  className="hover:text-emerald-600"
                                >
                                  {d.name}
                                </Link>
                                <div className="text-[10px] text-slate-500">{d.phone}</div>
                              </td>
                              <td className="py-2.5 px-3 text-slate-500">{d.village || "—"}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-amber-600">
                                {formatINR(d.outstandingCredit)}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <Button
                                  size="sm"
                                  className="h-6 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white"
                                  onClick={() =>
                                    handleOpenRepayment({
                                      id: d._id,
                                      name: d.name,
                                      phone: d.phone,
                                      outstandingBalance: d.outstandingCredit,
                                    })
                                  }
                                >
                                  Collect
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                {/* Recent Repayments */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-emerald-600" />
                      <span>Recent Repayments Received</span>
                    </h3>
                  </div>

                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-950">
                    {dashboardData.recentRepayments.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500">
                        No repayments recorded recently.
                      </div>
                    ) : (
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                          <tr>
                            <th className="py-2.5 px-3">Voucher #</th>
                            <th className="py-2.5 px-3">Customer</th>
                            <th className="py-2.5 px-3">Method</th>
                            <th className="py-2.5 px-3 text-right">Amount</th>
                            <th className="py-2.5 px-3 text-right">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {dashboardData.recentRepayments.map((p) => {
                            const isRev = p.status === "REVERSED";
                            return (
                              <tr
                                key={p._id}
                                className="hover:bg-slate-50/50 cursor-pointer"
                                onClick={() => {
                                  setSelectedPaymentForDetails(p as any);
                                  setIsPaymentDetailsOpen(true);
                                }}
                              >
                                <td className="py-2.5 px-3 font-mono font-medium text-emerald-700 dark:text-emerald-400">
                                  {p.paymentNumber}
                                  <div className="text-[10px] text-slate-500">
                                    {formatDate(p.paymentDate)}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                                  {p.customerName || "Customer"}
                                </td>
                                <td className="py-2.5 px-3 text-slate-500">{p.paymentMethod}</td>
                                <td className="py-2.5 px-3 text-right font-bold text-slate-900 dark:text-slate-100">
                                  {formatINR(p.amount)}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  <Badge
                                    variant="neutral"
                                    className={`text-[10px] ${
                                      isRev
                                        ? "bg-red-50 text-red-700 border-red-200"
                                        : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                    }`}
                                  >
                                    {p.status}
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* DIALOGS */}
      {/* 1. Add / Edit Customer Dialog */}
      <CustomerFormDialog
        open={isCustomerFormOpen}
        onOpenChange={setIsCustomerFormOpen}
        customer={selectedCustomerForEdit}
        onSuccess={() => {
          setRefreshKey((k) => k + 1);
        }}
      />

      {/* 2. Record Repayment Dialog */}
      {targetCustomerForRepayment && (
        <RecordRepaymentDialog
          open={isRepaymentOpen}
          onOpenChange={setIsRepaymentOpen}
          customerId={targetCustomerForRepayment.id}
          customerName={targetCustomerForRepayment.name}
          customerPhone={targetCustomerForRepayment.phone}
          currentOutstanding={targetCustomerForRepayment.outstanding}
          onSuccess={() => {
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

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

export default function CustomersPage() {
  return (
    <React.Suspense
      fallback={
        <div className="py-20 text-center text-slate-500">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-600" />
          <p className="text-sm">Loading customer directory...</p>
        </div>
      }
    >
      <CustomersContent />
    </React.Suspense>
  );
}

