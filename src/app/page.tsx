"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Receipt,
  Boxes,
  Users,
  AlertTriangle,
  ArrowUpRight,
  Plus,
  FileSpreadsheet,
  Download,
  Filter,
  CheckCircle2,
  Clock,
  ChevronRight,
  Eye,
  RefreshCw,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export default function DashboardPage() {
  const [viewState, setViewState] = React.useState<"live" | "skeleton" | "empty">("live");
  const [selectedPeriod, setSelectedPeriod] = React.useState("Today");
  const [farmerModalOpen, setFarmerModalOpen] = React.useState(false);

  const kpis = [
    {
      id: "sales",
      title: "Today's Gross Sales",
      value: "₹1,48,250",
      change: "+14.8%",
      changeType: "positive" as const,
      subtext: "42 Bills issued across Counter & Field",
      icon: Receipt,
      accentColor: "#176B3A",
    },
    {
      id: "inventory",
      title: "Inventory Stock In Hand",
      value: "1,240 Bags",
      change: "3 Low Stock",
      changeType: "warning" as const,
      subtext: "Urea, DAP, Potash & Liquid Pesticides",
      icon: Boxes,
      accentColor: "#2E9D59",
    },
    {
      id: "credit",
      title: "Farmer Credit (Khata)",
      value: "₹3,82,400",
      change: "28 Accounts",
      changeType: "neutral" as const,
      subtext: "Outstanding credit receivables for collection",
      icon: Users,
      accentColor: "#0284C7",
    },
    {
      id: "orders",
      title: "Supplier Shipments",
      value: "4 Inbound POs",
      change: "IFFCO / Bayer",
      changeType: "positive" as const,
      subtext: "Expected delivery within 48 hours",
      icon: TrendingUp,
      accentColor: "#D97706",
    },
  ];

  const recentTransactions = [
    {
      id: "INV-2026-0891",
      farmer: "M. Senthil Kumar",
      village: "Thiruvallur West",
      items: "Neem Coated Urea (5 Bags) + Zinc Sulphate",
      category: "Fertilizers",
      amount: "₹1,850.00",
      paymentMode: "Cash",
      status: "Paid",
      statusVariant: "success" as const,
      time: "10 mins ago",
    },
    {
      id: "INV-2026-0890",
      farmer: "K. Rengasamy",
      village: "Alanganallur",
      items: "DAP 50kg (10 Bags) + Chlorpyrifos 20% EC",
      category: "Fertilizers & Pesticides",
      amount: "₹15,400.00",
      paymentMode: "Credit (Khata)",
      status: "Due in 15d",
      statusVariant: "warning" as const,
      time: "32 mins ago",
    },
    {
      id: "INV-2026-0889",
      farmer: "P. Muthuvel",
      village: "Kavundampalayam",
      items: "Certified Hybrid Paddy Seeds (ADT 53, 30kg)",
      category: "Seeds",
      amount: "₹3,200.00",
      paymentMode: "UPI / QR",
      status: "Paid",
      statusVariant: "success" as const,
      time: "1 hour ago",
    },
    {
      id: "INV-2026-0888",
      farmer: "S. Arumugam",
      village: "Samayanallur",
      items: "Bayer Confidor (500ml) + Bio-Stimulant",
      category: "Pesticides",
      amount: "₹2,150.00",
      paymentMode: "Cash",
      status: "Paid",
      statusVariant: "success" as const,
      time: "2 hours ago",
    },
    {
      id: "INV-2026-0887",
      farmer: "V. Thangavel",
      village: "Melur Road",
      items: "Muriate of Potash (MOP 50kg, 6 Bags)",
      category: "Fertilizers",
      amount: "₹10,200.00",
      paymentMode: "Credit (Khata)",
      status: "Overdue",
      statusVariant: "danger" as const,
      time: "3 hours ago",
    },
  ];

  const lowStockAlerts = [
    {
      name: "IFFCO Neem Coated Urea 50kg",
      stock: "14 Bags remaining",
      threshold: "Reorder level: 50 Bags",
      critical: true,
    },
    {
      name: "Coromandel Gromor DAP 50kg",
      stock: "18 Bags remaining",
      threshold: "Reorder level: 40 Bags",
      critical: true,
    },
    {
      name: "Syngenta Amistar Top (250ml)",
      stock: "6 Bottles remaining",
      threshold: "Reorder level: 15 Bottles",
      critical: false,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner & Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Agencies Operations Dashboard
            </h1>
            <Badge variant="agri" size="sm">
              Phase 2 UI Foundation
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            KASI Agri Agencies • Counter Sales, Fertilizer Quotas & Farmer Credit Management
          </p>
        </div>

        {/* View state selector & actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Component state toggler (allows checking Live, Loading Skeleton, and Empty States) */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs">
            <button
              type="button"
              onClick={() => setViewState("live")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                viewState === "live"
                  ? "bg-[#176B3A] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={() => setViewState("skeleton")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                viewState === "skeleton"
                  ? "bg-[#176B3A] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Loading State
            </button>
            <button
              type="button"
              onClick={() => setViewState("empty")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                viewState === "empty"
                  ? "bg-[#176B3A] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Empty State
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            leftIcon={<Users className="h-3.5 w-3.5 text-slate-500" />}
            onClick={() => setFarmerModalOpen(true)}
          >
            Add Farmer
          </Button>

          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => {}}
          >
            Receive Stock
          </Button>
        </div>
      </div>

      {/* Season Filters & Date bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-white p-3 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {["Today", "Yesterday", "This Week", "Current Month", "Rabi Season"].map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setSelectedPeriod(period)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                selectedPeriod === period
                  ? "bg-[#EAF5EE] text-[#176B3A] font-semibold"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {period}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto text-xs text-slate-500">
          <Badge variant="neutral" size="sm">
            FY 2026-27 • Q3
          </Badge>
          <span className="hidden sm:inline">•</span>
          <span className="hidden sm:inline">GST Registered (TN-33)</span>
        </div>
      </div>

      {/* ---------------- SKELETON STATE PREVIEW ---------------- */}
      {viewState === "skeleton" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="p-5 space-y-3">
                <div className="flex justify-between items-center">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-8 w-8 rounded-lg" />
                </div>
                <Skeleton className="h-7 w-36" />
                <Skeleton className="h-3 w-44" />
              </Card>
            ))}
          </div>
          <Card className="p-5 space-y-4">
            <Skeleton className="h-5 w-48" />
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </Card>
        </div>
      )}

      {/* ---------------- EMPTY STATE PREVIEW ---------------- */}
      {viewState === "empty" && (
        <Card className="p-6">
          <EmptyState
            icon={<FileSpreadsheet className="h-6 w-6 text-[#176B3A]" />}
            title="No Sales Invoices Recorded Today"
            description="Start by generating a new counter bill for fertilizers, seeds or agrochemicals using the Quick Bill button."
            action={
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => setViewState("live")}
              >
                Create First Bill
              </Button>
            }
          />
        </Card>
      )}

      {/* ---------------- LIVE DASHBOARD PREVIEW ---------------- */}
      {viewState === "live" && (
        <>
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpis.map((kpi, idx) => {
              const Icon = kpi.icon;

              return (
                <motion.div
                  key={kpi.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: idx * 0.05 }}
                >
                  <Card className="relative overflow-hidden hover:border-[#176B3A]/40 hover:shadow-md transition-all duration-200">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                      <div className="space-y-1">
                        <span className="text-xs font-medium text-slate-500">
                          {kpi.title}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Badge variant="neutral" size="sm" className="text-[10px] bg-slate-100 text-slate-500">
                            Design Placeholder
                          </Badge>
                        </div>
                      </div>
                      <div
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-white shadow-xs"
                        style={{ backgroundColor: kpi.accentColor }}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                    </CardHeader>
                    <CardContent className="pt-2">
                      <div className="text-2xl font-bold tracking-tight text-slate-900">
                        {kpi.value}
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 text-xs">
                        {kpi.changeType === "positive" ? (
                          <span className="inline-flex items-center font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                            <ArrowUpRight className="h-3 w-3 mr-0.5" />
                            {kpi.change}
                          </span>
                        ) : kpi.changeType === "warning" ? (
                          <span className="inline-flex items-center font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                            <AlertTriangle className="h-3 w-3 mr-0.5" />
                            {kpi.change}
                          </span>
                        ) : (
                          <span className="inline-flex items-center font-semibold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded">
                            {kpi.change}
                          </span>
                        )}
                        <span className="text-[11px] text-slate-500 truncate">
                          {kpi.subtext}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Quick Operations Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Fertilizer Sales (PoS)", icon: Receipt, desc: "Urea / DAP / MOP" },
              { label: "Seeds Counter", icon: Boxes, desc: "Paddy & Hybrid Seeds" },
              { label: "Farmer Ledger", icon: Users, desc: "Credit balance & Khata" },
              { label: "GST Summary", icon: FileSpreadsheet, desc: "Monthly tax report" },
            ].map((action, i) => {
              const ActionIcon = action.icon;
              return (
                <button
                  key={i}
                  type="button"
                  className="flex flex-col text-left p-3.5 rounded-xl border border-slate-200/80 bg-white hover:border-[#176B3A]/40 hover:bg-[#EAF5EE]/30 transition-all shadow-xs group"
                >
                  <div className="flex items-center justify-between w-full mb-1.5">
                    <div className="h-7 w-7 rounded-lg bg-emerald-50 flex items-center justify-center text-[#176B3A] group-hover:scale-110 transition-transform">
                      <ActionIcon className="h-4 w-4" />
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-[#176B3A] transition-colors" />
                  </div>
                  <span className="text-xs font-semibold text-slate-800">{action.label}</span>
                  <span className="text-[10px] text-slate-500">{action.desc}</span>
                </button>
              );
            })}
          </div>

          {/* Main Grid: Transactions & Stock Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Recent Transactions Table */}
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <CardTitle>Recent Counter Transactions</CardTitle>
                      <Badge variant="neutral" size="sm">Design Preview</Badge>
                    </div>
                    <CardDescription className="mt-1">
                      Live billing flow preview with farmer khata & cash settlements
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" leftIcon={<Filter className="h-3.5 w-3.5" />}>
                      Filter
                    </Button>
                    <Button variant="ghost" size="sm" leftIcon={<Download className="h-3.5 w-3.5" />}>
                      Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bill No & Farmer</TableHead>
                        <TableHead>Items Issued</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentTransactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell>
                            <div className="font-semibold text-slate-900">{tx.farmer}</div>
                            <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                              <span>{tx.id}</span> • <span>{tx.village}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[220px] truncate text-xs text-slate-700 font-medium">
                              {tx.items}
                            </div>
                            <div className="text-[10px] text-slate-400">{tx.time}</div>
                          </TableCell>
                          <TableCell className="font-semibold text-slate-900 font-mono">
                            {tx.amount}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-slate-600 font-medium">{tx.paymentMode}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant={tx.statusVariant} size="sm" dot>
                              {tx.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-700">
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* Right Col: Low Stock Alerts & Agency Profile Summary */}
            <div className="space-y-6">
              {/* Critical Inventory Reorder Alerts */}
              <Card>
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <CardTitle className="text-sm">Low Stock Alerts</CardTitle>
                    </div>
                    <Badge variant="warning" size="sm">3 Items</Badge>
                  </div>
                  <CardDescription>
                    Items below safety threshold requiring supplier purchase order
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {lowStockAlerts.map((alert, i) => (
                    <div
                      key={i}
                      className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-xs space-y-1 hover:border-slate-200 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">{alert.name}</span>
                        {alert.critical ? (
                          <Badge variant="danger" size="sm">Critical</Badge>
                        ) : (
                          <Badge variant="warning" size="sm">Low</Badge>
                        )}
                      </div>
                      <div className="text-slate-600 font-medium">{alert.stock}</div>
                      <div className="text-[10px] text-slate-400">{alert.threshold}</div>
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-2 text-xs"
                    leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
                  >
                    Generate Stock Reorder PO
                  </Button>
                </CardContent>
              </Card>

              {/* Verified Agency Metadata Card */}
              <Card className="bg-gradient-to-br from-[#176B3A]/5 to-[#2E9D59]/10 border-[#176B3A]/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#176B3A]" />
                    <CardTitle className="text-sm text-[#176B3A]">
                      Agency Information
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="text-xs space-y-2 text-slate-700">
                  <div className="flex justify-between py-1 border-b border-slate-200/50">
                    <span className="text-slate-500">Proprietor:</span>
                    <span className="font-semibold text-slate-900">R. Balamurugan</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/50">
                    <span className="text-slate-500">Retail Licence:</span>
                    <span className="font-mono text-slate-800">TN/AGRI/RETAIL/2026</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200/50">
                    <span className="text-slate-500">Fertilizer Reg:</span>
                    <span className="font-mono text-slate-800">FCO-ACT-TN-33</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Season:</span>
                    <span className="font-medium text-[#176B3A]">Rabi Season 2026-27</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* Reusable "Add Farmer Profile" Modal Prototype */}
      <Dialog
        open={farmerModalOpen}
        onOpenChange={setFarmerModalOpen}
        title="Register Farmer Profile"
        description="Add a new farmer account for counter billing and credit ledger tracking."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFarmerModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setFarmerModalOpen(false)}
            >
              Save Farmer Record
            </Button>
          </>
        }
      >
        <div className="space-y-3 pt-2">
          <Input label="Farmer Full Name" placeholder="e.g. S. Ramanathan" required />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Mobile Number" placeholder="10-digit mobile" type="tel" required />
            <Input label="Village / Taluk" placeholder="e.g. Alanganallur" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Aadhaar / Farmer ID" placeholder="Optional for subsidy quota" />
            <Input label="Initial Credit Limit (₹)" placeholder="e.g. 25000" type="number" />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
