"use client";

import * as React from "react";
import { useState } from "react";
import {
  UserPlus,
  Edit2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ICustomer, CustomerStatus } from "@/types/customer";

interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: ICustomer | null;
  onSuccess: (customer: ICustomer) => void;
}

export function CustomerFormDialog(props: CustomerFormDialogProps) {
  if (!props.open) return null;
  return (
    <CustomerFormContent
      key={props.customer?._id || "new-customer"}
      {...props}
    />
  );
}

function CustomerFormContent({
  open,
  onOpenChange,
  customer,
  onSuccess,
}: CustomerFormDialogProps) {
  const isEdit = !!customer;

  const [name, setName] = useState(customer?.name || "");
  const [phone, setPhone] = useState(customer?.phone || "");
  const [village, setVillage] = useState(customer?.village || "");
  const [address, setAddress] = useState(customer?.address || "");
  const [district, setDistrict] = useState(customer?.district || "Salem");
  const [stateVal, setStateVal] = useState(customer?.state || "Tamil Nadu");
  const [pincode, setPincode] = useState(customer?.pincode || "");
  const [email, setEmail] = useState(customer?.email || "");
  const [gstin, setGstin] = useState(customer?.gstin || "");
  const [notes, setNotes] = useState(customer?.notes || "");
  const [status, setStatus] = useState<CustomerStatus>(customer?.status || "ACTIVE");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Please enter customer name.");
      return;
    }

    const cleanPhone = phone.trim().replace(/\D/g, "");
    if (!cleanPhone || cleanPhone.length < 10) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }

    setSubmitting(true);

    try {
      const payload: any = {
        name: name.trim(),
        phone: cleanPhone,
        village: village.trim() || undefined,
        address: address.trim() || undefined,
        district: district.trim() || undefined,
        state: stateVal.trim() || undefined,
        pincode: pincode.trim() || undefined,
        email: email.trim() || undefined,
        gstin: gstin.trim() ? gstin.trim().toUpperCase() : undefined,
        notes: notes.trim() || undefined,
        status,
      };

      const url = isEdit ? `/api/customers/${customer!._id}` : `/api/customers`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.error || `Failed to ${isEdit ? "update" : "create"} customer.`);
      }

      onSuccess(data.data);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={
        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400">
          {isEdit ? <Edit2 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
          <span>{isEdit ? "Edit Farmer / Customer Account" : "Add New Farmer / Customer"}</span>
        </div>
      }
      description={
        <span>
          {isEdit
            ? `Update details and Khata preferences for ${customer?.name}.`
            : "Register a new farmer or rural customer for billing and credit ledger tracking."}
        </span>
      }
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg flex items-start gap-2 text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Primary Contact Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Customer / Farmer Name <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Shanmugam or Periyasamy"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Phone Number <span className="text-red-500">*</span>
            </label>
            <Input
              type="tel"
              required
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9876543210"
            />
          </div>
        </div>

        {/* Village & Address */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Village / Town
            </label>
            <Input
              type="text"
              value={village}
              onChange={(e) => setVillage(e.target.value)}
              placeholder="e.g. Attur or Omalur"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Street / Area Address
            </label>
            <Input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. West Street, Near Mariamman Temple"
            />
          </div>
        </div>

        {/* District & Pincode */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              District
            </label>
            <Input
              type="text"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              placeholder="e.g. Salem"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              State
            </label>
            <Input
              type="text"
              value={stateVal}
              onChange={(e) => setStateVal(e.target.value)}
              placeholder="Tamil Nadu"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              PIN Code
            </label>
            <Input
              type="text"
              maxLength={6}
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              placeholder="e.g. 636102"
            />
          </div>
        </div>

        {/* Email & GSTIN */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Email Address (Optional)
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. customer@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              GSTIN (Optional)
            </label>
            <Input
              type="text"
              maxLength={15}
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              placeholder="e.g. 33AAAAA0000A1Z5"
              className="uppercase font-mono text-xs"
            />
          </div>
        </div>

        {/* Status & Notes */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Account Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as CustomerStatus)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Notes / Special Instructions
            </label>
            <Input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Regular farmer for paddy & groundnut inputs"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={submitting || !name.trim() || !phone.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]"
          >
            {submitting ? (
              <span className="flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 animate-spin" />
                Saving...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                {isEdit ? "Update Customer" : "Save Customer"}
              </span>
            )}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
