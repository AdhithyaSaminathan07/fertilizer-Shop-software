"use client";

import * as React from "react";
import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Truck,
  Edit2,
  Archive,
  Phone,
  Mail,
  MapPin,
  Building2,
  Clock,
  ShieldCheck,
  AlertCircle,
  Receipt,
  CreditCard,
  FileText,
  Calendar,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import type { ISupplier, SupplierStatus } from "@/types/supplier";

export default function SupplierProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [supplier, setSupplier] = useState<ISupplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "purchases" | "payments">("overview");

  // Edit dialog state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
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
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    fetch(`/api/suppliers/${id}`, {
      credentials: "same-origin",
    })
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          if (data.success && data.data?.supplier) {
            setSupplier(data.data.supplier);
          } else {
            setError(data.error || "Supplier profile not found");
          }
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setError("Network error while loading supplier profile");
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [id, refreshKey]);

  const handleOpenEdit = () => {
    if (!supplier) return;
    setFormName(supplier.name);
    setFormContactPerson(supplier.contactPerson || "");
    setFormPhone(supplier.phone);
    setFormEmail(supplier.email || "");
    setFormGstin(supplier.gstin || "");
    setFormStreet(supplier.address?.street || "");
    setFormCity(supplier.address?.city || "");
    setFormStateVal(supplier.address?.state || "Tamil Nadu");
    setFormPincode(supplier.address?.pincode || "");
    setFormNotes(supplier.notes || "");
    setFormStatus(supplier.status);
    setFormError("");
    setIsEditOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier) return;
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

        const res = await fetch(`/api/suppliers/${supplier.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          setFormError(data.error || "Failed to update supplier profile");
          return;
        }

        setIsEditOpen(false);
        setRefreshKey((k) => k + 1);
      } catch {
        setFormError("A network error occurred while updating the supplier");
      }
    });
  };

  const handleConfirmArchive = async () => {
    if (!supplier) return;
    setFormError("");

    startTransition(async () => {
      try {
        const res = await fetch(`/api/suppliers/${supplier.id}`, {
          method: "DELETE",
          credentials: "same-origin",
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          setFormError(data.error || "Failed to archive supplier");
          return;
        }

        setIsArchiveOpen(false);
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

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-6 w-6 animate-spin text-emerald-700" />
          <p className="text-sm font-medium text-slate-500">Loading supplier profile...</p>
        </div>
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="space-y-4">
        <Link href="/suppliers">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Suppliers Directory</span>
          </Button>
        </Link>
        <Card className="border-rose-200 bg-rose-50/50 p-6 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-rose-600" />
          <h3 className="mt-2 text-lg font-bold text-slate-900">Supplier Not Found</h3>
          <p className="mt-1 text-sm text-slate-600">{error || "The requested supplier does not exist."}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back button & Action Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href="/suppliers" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-emerald-700">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Suppliers Directory</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenEdit}
            className="gap-1.5 shadow-xs"
          >
            <Edit2 className="h-3.5 w-3.5" />
            <span>Edit Profile</span>
          </Button>

          {supplier.status !== "ARCHIVED" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsArchiveOpen(true)}
              className="gap-1.5 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            >
              <Archive className="h-3.5 w-3.5" />
              <span>Archive</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Profile Header Banner */}
      <Card className="overflow-hidden border-slate-200/90 bg-white shadow-xs">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white sm:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-emerald-400 backdrop-blur-md">
                <Truck className="h-8 w-8" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-bold sm:text-3xl">{supplier.name}</h1>
                  <Badge
                    variant={
                      supplier.status === "ACTIVE"
                        ? "success"
                        : supplier.status === "INACTIVE"
                        ? "neutral"
                        : "danger"
                    }
                    size="sm"
                  >
                    {supplier.status}
                  </Badge>
                </div>
                {supplier.contactPerson && (
                  <p className="mt-1 text-sm text-slate-300">
                    Contact Person: <span className="font-semibold text-white">{supplier.contactPerson}</span>
                  </p>
                )}
                {supplier.gstin && (
                  <p className="mt-1 font-mono text-xs text-emerald-300">
                    GSTIN: {supplier.gstin}
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-white/10 p-4 text-left sm:text-right backdrop-blur-md">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-300">
                Outstanding Balance
              </p>
              <p className="mt-1 text-2xl font-bold text-amber-400">
                {formatCurrency(supplier.outstandingBalance)}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-300">
                Net recognized payable balance
              </p>
            </div>
          </div>
        </div>

        {/* Financial Summary Grid (Accurate Phase 5A initialized balances) */}
        <div className="grid grid-cols-1 divide-y divide-slate-100 border-b border-slate-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Recognized Purchases
            </p>
            <p className="mt-1 text-xl font-bold text-slate-900">
              {formatCurrency(supplier.totalPurchases)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Cumulative inward goods received value
            </p>
          </div>

          <div className="p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Payments Settled
            </p>
            <p className="mt-1 text-xl font-bold text-emerald-700">
              {formatCurrency(supplier.totalPaid)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Cumulative payment vouchers issued
            </p>
          </div>

          <div className="p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Net Payable (Outstanding)
            </p>
            <p className="mt-1 text-xl font-bold text-amber-700">
              {formatCurrency(supplier.outstandingBalance)}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              Pending invoice settlement
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setActiveTab("overview")}
            className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
              activeTab === "overview"
                ? "border-emerald-700 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Overview & Contact Info
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("purchases")}
            className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
              activeTab === "purchases"
                ? "border-emerald-700 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Purchase Orders & Invoices (Phase 5B)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("payments")}
            className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${
              activeTab === "payments"
                ? "border-emerald-700 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Payment Vouchers (Phase 5D)
          </button>
        </div>

        {/* Tab Content */}
        <CardContent className="p-6">
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                  Communication & Location
                </h3>
                <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-sm text-slate-700">
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-emerald-700" />
                    <span className="font-medium">Phone:</span>
                    <a href={`tel:${supplier.phone}`} className="text-emerald-700 hover:underline">
                      {supplier.phone}
                    </a>
                  </div>
                  {supplier.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-emerald-700" />
                      <span className="font-medium">Email:</span>
                      <a href={`mailto:${supplier.email}`} className="text-emerald-700 hover:underline">
                        {supplier.email}
                      </a>
                    </div>
                  )}
                  <div className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                    <div>
                      <span className="font-medium">Billing & Delivery Address:</span>
                      <p className="mt-0.5 text-slate-600">
                        {supplier.address?.street && `${supplier.address.street}, `}
                        {supplier.address?.city && `${supplier.address.city}, `}
                        {supplier.address?.state || "Tamil Nadu"}
                        {supplier.address?.pincode && ` - ${supplier.address.pincode}`}
                        {!supplier.address?.city && !supplier.address?.street && (
                          <span className="text-slate-400 italic">No street address configured</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                  Tax Registration & Profile Notes
                </h3>
                <div className="space-y-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4 text-sm text-slate-700">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-emerald-700" />
                    <span className="font-medium">GST Identification Number:</span>
                    <span className="font-mono font-semibold text-slate-900">
                      {supplier.gstin || "Unregistered / Composition"}
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <FileText className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                    <div>
                      <span className="font-medium">Vendor Notes & Payment Terms:</span>
                      <p className="mt-0.5 text-slate-600">
                        {supplier.notes || "No special payment notes or terms recorded for this vendor."}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pt-2 text-xs text-slate-400 border-t border-slate-200/60">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Registered on {new Date(supplier.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "purchases" && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
              <Receipt className="mx-auto h-12 w-12 text-slate-300" />
              <h4 className="mt-3 text-base font-semibold text-slate-800">
                Purchase Management Ready for Phase 5B
              </h4>
              <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
                Inward Purchase Orders, supplier invoices, line-item taxes, and discounts will be connected in Phase 5B.
                No historical purchases exist yet for this supplier.
              </p>
            </div>
          )}

          {activeTab === "payments" && (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
              <CreditCard className="mx-auto h-12 w-12 text-slate-300" />
              <h4 className="mt-3 text-base font-semibold text-slate-800">
                Payment Settlements Ready for Phase 5D
              </h4>
              <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
                Supplier payment vouchers, bank transfers, UPI settlements, and invoice reconciliations will be connected in Phase 5D.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Supplier Modal */}
      <Dialog
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        title="Edit Supplier Details"
        description={`Update registration information for ${supplier.name}.`}
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

      {/* Archive Modal */}
      <Dialog
        open={isArchiveOpen}
        onOpenChange={setIsArchiveOpen}
        title="Archive Supplier"
        description={`Are you sure you want to archive ${supplier.name}?`}
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
              Archiving hides the supplier from active purchase selection while preserving historical records.
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
