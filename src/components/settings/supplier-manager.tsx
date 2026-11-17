"use client";

import * as React from "react";
import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  Truck,
  Plus,
  Search,
  Edit2,
  Archive,
  Phone,
  Mail,
  MapPin,
  Building2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  Filter,
  ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import type { ISupplier, SupplierStatus } from "@/types/supplier";

export function SupplierManager() {
  const [suppliers, setSuppliers] = useState<ISupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SupplierStatus | "ALL">("ACTIVE");
  const [refreshKey, setRefreshKey] = useState(0);

  // Summary stats
  const [stats, setStats] = useState({
    totalSuppliers: 0,
    activeSuppliers: 0,
    totalOutstanding: 0,
  });

  // Dialog states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<ISupplier | null>(null);

  // Form states
  const [formName, setFormName] = useState("");
  const [formContactPerson, setFormContactPerson] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formGstin, setFormGstin] = useState("");
  const [formStreet, setFormStreet] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formStateVal, setFormStateVal] = useState("Tamil Nadu");
  const [formPincode, setFormPincode] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formStatus, setFormStatus] = useState<SupplierStatus>("ACTIVE");
  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();

  // Load suppliers list
  useEffect(() => {
    let isMounted = true;
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter !== "ALL") params.set("status", statusFilter);

    fetch(`/api/suppliers?${params.toString()}`, {
      credentials: "same-origin",
    })
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          if (data.success && data.data) {
            setSuppliers(data.data.suppliers || []);
            if (data.data.summary) {
              setStats(data.data.summary);
            }
          }
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [search, statusFilter, refreshKey]);

  const resetForm = () => {
    setFormName("");
    setFormContactPerson("");
    setFormPhone("");
    setFormEmail("");
    setFormGstin("");
    setFormStreet("");
    setFormCity("");
    setFormStateVal("Tamil Nadu");
    setFormPincode("");
    setFormNotes("");
    setFormStatus("ACTIVE");
    setFormError("");
  };

  const handleOpenAdd = () => {
    resetForm();
    setIsAddOpen(true);
  };

  const handleOpenEdit = (sup: ISupplier) => {
    setSelectedSupplier(sup);
    setFormName(sup.name);
    setFormContactPerson(sup.contactPerson || "");
    setFormPhone(sup.phone);
    setFormEmail(sup.email || "");
    setFormGstin(sup.gstin || "");
    setFormStreet(sup.address?.street || "");
    setFormCity(sup.address?.city || "");
    setFormStateVal(sup.address?.state || "Tamil Nadu");
    setFormPincode(sup.address?.pincode || "");
    setFormNotes(sup.notes || "");
    setFormStatus(sup.status);
    setFormError("");
    setIsEditOpen(true);
  };

  const handleOpenArchive = (sup: ISupplier) => {
    setSelectedSupplier(sup);
    setFormError("");
    setIsArchiveOpen(true);
  };

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");

    startTransition(async () => {
      try {
        const payload = {
          name: formName,
          contactPerson: formContactPerson || undefined,
          phone: formPhone,
          email: formEmail || undefined,
          gstin: formGstin || undefined,
          address: {
            street: formStreet || undefined,
            city: formCity || undefined,
            state: formStateVal || undefined,
            pincode: formPincode || undefined,
          },
          notes: formNotes || undefined,
          status: formStatus,
        };

        const res = await fetch("/api/suppliers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          setFormError(data.error || "Failed to create supplier");
          return;
        }

        setIsAddOpen(false);
        resetForm();
        setRefreshKey((k) => k + 1);
      } catch {
        setFormError("A network error occurred while creating the supplier");
      }
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    setFormError("");

    startTransition(async () => {
      try {
        const payload = {
          name: formName,
          contactPerson: formContactPerson || undefined,
          phone: formPhone,
          email: formEmail || undefined,
          gstin: formGstin || undefined,
          address: {
            street: formStreet || undefined,
            city: formCity || undefined,
            state: formStateVal || undefined,
            pincode: formPincode || undefined,
          },
          notes: formNotes || undefined,
          status: formStatus,
        };

        const res = await fetch(`/api/suppliers/${selectedSupplier.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          setFormError(data.error || "Failed to update supplier");
          return;
        }

        setIsEditOpen(false);
        resetForm();
        setRefreshKey((k) => k + 1);
      } catch {
        setFormError("A network error occurred while updating the supplier");
      }
    });
  };

  const handleConfirmArchive = async () => {
    if (!selectedSupplier) return;
    setFormError("");

    startTransition(async () => {
      try {
        const res = await fetch(`/api/suppliers/${selectedSupplier.id}`, {
          method: "DELETE",
          credentials: "same-origin",
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          setFormError(data.error || "Failed to archive supplier");
          return;
        }

        setIsArchiveOpen(false);
        setSelectedSupplier(null);
        setRefreshKey((k) => k + 1);
      } catch {
        setFormError("A network error occurred while archiving the supplier");
      }
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 2,
    }).format(amount || 0);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Suppliers Directory
            </h1>
            <Badge variant="agri" size="sm" className="hidden sm:inline-flex">
              Phase 5A
            </Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Manage manufacturer accounts, distributor contact profiles, GSTIN details, and ledger balances.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/purchases">
            <Button variant="outline" size="md" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Purchase Orders</span>
            </Button>
          </Link>
          <Button
            onClick={() => setRefreshKey((k) => k + 1)}
            variant="outline"
            size="md"
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            onClick={handleOpenAdd}
            variant="primary"
            size="md"
            className="gap-2 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>Add Supplier</span>
          </Button>
        </div>
      </div>

      {/* KPI Metric Summary Cards - Responsive 2-column on mobile, 3-column on tablet/desktop */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-3">
        {/* Card 1: Active Suppliers */}
        <Card className="border-slate-200/80 bg-white shadow-xs">
          <CardContent className="flex h-full flex-col justify-between p-3 sm:p-5">
            <div>
              <div className="flex items-start justify-between gap-1.5 sm:items-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:text-xs">
                  Active Suppliers
                </p>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 sm:h-11 sm:w-11 sm:rounded-xl">
                  <Truck className="h-3.5 w-3.5 sm:h-6 sm:w-6" />
                </div>
              </div>
              <div className="mt-1 sm:mt-1.5">
                <p className="text-lg font-bold text-slate-900 sm:text-2xl">
                  {stats.activeSuppliers}
                </p>
              </div>
            </div>
            <p className="mt-1.5 text-[10px] text-slate-500 sm:mt-2 sm:text-xs">
              Total registered: <span className="font-semibold text-slate-700">{stats.totalSuppliers}</span>
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Total Outstanding Balance */}
        <Card className="border-slate-200/80 bg-white shadow-xs">
          <CardContent className="flex h-full flex-col justify-between p-3 sm:p-5">
            <div>
              <div className="flex items-start justify-between gap-1.5 sm:items-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:text-xs">
                  Total Outstanding
                </p>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700 sm:h-11 sm:w-11 sm:rounded-xl">
                  <Building2 className="h-3.5 w-3.5 sm:h-6 sm:w-6" />
                </div>
              </div>
              <div className="mt-1 sm:mt-1.5">
                <p className="truncate text-base font-bold text-amber-700 sm:text-2xl">
                  {formatCurrency(stats.totalOutstanding)}
                </p>
              </div>
            </div>
            <p className="mt-1.5 line-clamp-1 text-[10px] text-slate-500 sm:mt-2 sm:line-clamp-none sm:text-xs">
              Recognized payable balances against confirmed GRNs
            </p>
          </CardContent>
        </Card>

        {/* Card 3: GST Compliance (occupies col 1 of row 2 on mobile) */}
        <Card className="border-slate-200/80 bg-white shadow-xs">
          <CardContent className="flex h-full flex-col justify-between p-3 sm:p-5">
            <div>
              <div className="flex items-start justify-between gap-1.5 sm:items-center">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:text-xs">
                  GST Compliance
                </p>
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700 sm:h-11 sm:w-11 sm:rounded-xl">
                  <ShieldCheck className="h-3.5 w-3.5 sm:h-6 sm:w-6" />
                </div>
              </div>
              <div className="mt-1 sm:mt-1.5">
                <p className="text-lg font-bold text-slate-900 sm:text-2xl">
                  {suppliers.filter((s) => s.gstin).length}{" "}
                  <span className="text-xs font-normal text-slate-500 sm:text-sm">with GSTIN</span>
                </p>
              </div>
            </div>
            <p className="mt-1.5 text-[10px] text-slate-500 sm:mt-2 sm:text-xs">
              Tax-compliant verified vendors
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-slate-200/80 bg-white shadow-xs">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by company name, contact, phone, or GSTIN..."
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {(["ACTIVE", "ALL", "INACTIVE", "ARCHIVED"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    statusFilter === st
                      ? "bg-emerald-700 text-white shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {st === "ALL" ? "All Suppliers" : st === "ACTIVE" ? "Active" : st === "INACTIVE" ? "Inactive" : "Archived"}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suppliers Table & Mobile Cards */}
      {loading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-col items-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-emerald-700" />
            <p className="text-sm font-medium text-slate-500">Loading suppliers...</p>
          </div>
        </div>
      ) : suppliers.length === 0 ? (
        <Card className="border-slate-200 bg-white">
          <CardContent className="py-12">
            <EmptyState
              icon={<Truck className="h-12 w-12 text-slate-300" />}
              title="No suppliers found"
              description={
                search
                  ? `No suppliers matched your search query "${search}". Try adjusting your filters.`
                  : "No supplier records found in this category. Register your first fertilizer or pesticide vendor."
              }
              action={
                <Button onClick={handleOpenAdd} variant="primary" size="sm" className="mt-4 gap-2">
                  <Plus className="h-4 w-4" />
                  <span>Register First Supplier</span>
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile Card List (< sm) */}
          <div className="grid grid-cols-1 gap-3 sm:hidden">
            {suppliers.map((sup) => (
              <Card key={sup.id} className="border-slate-200 bg-white shadow-xs">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-slate-900">{sup.name}</h3>
                      {sup.contactPerson && (
                        <p className="text-xs text-slate-500">Contact: {sup.contactPerson}</p>
                      )}
                    </div>
                    <Badge
                      variant={
                        sup.status === "ACTIVE"
                          ? "success"
                          : sup.status === "INACTIVE"
                          ? "neutral"
                          : "danger"
                      }
                      size="sm"
                    >
                      {sup.status}
                    </Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />
                      <a href={`tel:${sup.phone}`} className="text-emerald-700 hover:underline">
                        {sup.phone}
                      </a>
                    </div>
                    {sup.gstin ? (
                      <div className="flex items-center gap-1.5 font-mono text-[11px]">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        <span>{sup.gstin}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">No GSTIN</span>
                    )}
                  </div>

                  {sup.address?.city && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" />
                      <span>
                        {sup.address.city}
                        {sup.address.state ? `, ${sup.address.state}` : ""}
                      </span>
                    </div>
                  )}

                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                    <div>
                      <p className="text-[11px] uppercase tracking-wider text-slate-400">Outstanding</p>
                      <p className="text-sm font-bold text-amber-700">
                        {formatCurrency(sup.outstandingBalance)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenEdit(sup)}
                        className="h-8 px-2 text-xs"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Link href={`/suppliers/${sup.id}`}>
                        <Button size="sm" variant="outline" className="h-8 gap-1 px-2.5 text-xs">
                          <span>Profile</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Desktop Table View (>= sm) */}
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs sm:block">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/80">
                  <TableHead className="font-semibold text-slate-700">Supplier Name & Contact</TableHead>
                  <TableHead className="font-semibold text-slate-700">Phone & Email</TableHead>
                  <TableHead className="font-semibold text-slate-700">GSTIN / City</TableHead>
                  <TableHead className="font-semibold text-slate-700">Status</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">Outstanding Balance</TableHead>
                  <TableHead className="text-right font-semibold text-slate-700">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suppliers.map((sup) => (
                  <TableRow key={sup.id} className="hover:bg-slate-50/60">
                    <TableCell>
                      <Link href={`/suppliers/${sup.id}`} className="group block">
                        <p className="font-semibold text-slate-900 group-hover:text-emerald-700">
                          {sup.name}
                        </p>
                        {sup.contactPerson && (
                          <p className="text-xs text-slate-500">Contact: {sup.contactPerson}</p>
                        )}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium text-slate-800">{sup.phone}</p>
                      {sup.email && (
                        <p className="text-xs text-slate-500">{sup.email}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      {sup.gstin ? (
                        <span className="font-mono text-xs font-semibold text-slate-800">
                          {sup.gstin}
                        </span>
                      ) : (
                        <span className="text-xs italic text-slate-400">Unregistered</span>
                      )}
                      {sup.address?.city && (
                        <p className="text-xs text-slate-500">{sup.address.city}, {sup.address.state || "TN"}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          sup.status === "ACTIVE"
                            ? "success"
                            : sup.status === "INACTIVE"
                            ? "neutral"
                            : "danger"
                        }
                        size="sm"
                      >
                        {sup.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-bold text-slate-900">
                        {formatCurrency(sup.outstandingBalance)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link href={`/suppliers/${sup.id}`}>
                          <Button size="sm" variant="outline" className="h-8 gap-1 px-2.5 text-xs">
                            <span>View</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEdit(sup)}
                          className="h-8 px-2 text-xs"
                          title="Edit Supplier"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        {sup.status !== "ARCHIVED" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenArchive(sup)}
                            className="h-8 px-2 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            title="Archive Supplier"
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {/* Add Supplier Modal */}
      <Dialog
        open={isAddOpen}
        onOpenChange={setIsAddOpen}
        title="Add New Supplier"
        description="Register a new manufacturer, authorized dealer, or agricultural goods distributor."
      >
        <form onSubmit={handleSaveAdd} className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Supplier Company Name *
              </label>
              <Input
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. IFFCO Limited / Coromandel International"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Contact Person Name
              </label>
              <Input
                value={formContactPerson}
                onChange={(e) => setFormContactPerson(e.target.value)}
                placeholder="e.g. K. Senthil Kumar"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Primary Phone Number *
              </label>
              <Input
                required
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="e.g. 9876543210"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Email Address
              </label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="e.g. accounts@supplier.com"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                GSTIN (15 Digits)
              </label>
              <Input
                value={formGstin}
                onChange={(e) => setFormGstin(e.target.value.toUpperCase())}
                placeholder="e.g. 33AAAAA0000A1Z5"
                maxLength={15}
                className="font-mono uppercase"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Street / Area Address
              </label>
              <Input
                value={formStreet}
                onChange={(e) => setFormStreet(e.target.value)}
                placeholder="e.g. 144, Agri Market Complex, Bypass Road"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                City / Town
              </label>
              <Input
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
                placeholder="e.g. Namakkal / Salem"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  State
                </label>
                <Input
                  value={formStateVal}
                  onChange={(e) => setFormStateVal(e.target.value)}
                  placeholder="Tamil Nadu"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Pincode
                </label>
                <Input
                  value={formPincode}
                  onChange={(e) => setFormPincode(e.target.value)}
                  placeholder="637001"
                  maxLength={6}
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Notes & Terms
              </label>
              <Input
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="e.g. Net 30 payment terms; Authorized distributor for Urea"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isPending}
            >
              {isPending ? "Registering..." : "Create Supplier"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Edit Supplier Modal */}
      <Dialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        title="Edit Supplier Details"
        description={`Update registration information for ${selectedSupplier?.name}.`}
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Supplier Company Name *
              </label>
              <Input
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Contact Person Name
              </label>
              <Input
                value={formContactPerson}
                onChange={(e) => setFormContactPerson(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Phone Number *
              </label>
              <Input
                required
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Email Address
              </label>
              <Input
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                GSTIN (15 Digits)
              </label>
              <Input
                value={formGstin}
                onChange={(e) => setFormGstin(e.target.value.toUpperCase())}
                maxLength={15}
                className="font-mono uppercase"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Supplier Status
              </label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as SupplierStatus)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-emerald-600 focus:outline-none"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Street Address
              </label>
              <Input
                value={formStreet}
                onChange={(e) => setFormStreet(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                City
              </label>
              <Input
                value={formCity}
                onChange={(e) => setFormCity(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  State
                </label>
                <Input
                  value={formStateVal}
                  onChange={(e) => setFormStateVal(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700">
                  Pincode
                </label>
                <Input
                  value={formPincode}
                  onChange={(e) => setFormPincode(e.target.value)}
                  maxLength={6}
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-semibold text-slate-700">
                Notes
              </label>
              <Input
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsEditOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isPending}
            >
              {isPending ? "Updating..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Archive Supplier Confirmation Modal */}
      <Dialog
        open={isArchiveOpen}
        onOpenChange={setIsArchiveOpen}
        title="Archive Supplier"
        description={`Are you sure you want to archive ${selectedSupplier?.name}?`}
      >
        <div className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            <p className="font-semibold">Important Archive Policy:</p>
            <p className="mt-1">
              Archiving hides the supplier from active purchase selection while preserving all historical order invoices.
              Suppliers with an outstanding payable balance cannot be archived until fully settled.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsArchiveOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={handleConfirmArchive}
            >
              {isPending ? "Archiving..." : "Confirm Archive"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
