"use client";

import * as React from "react";
import { useState } from "react";
import { UserPlus, AlertCircle, Loader2, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ICustomer } from "@/types/customer";

interface QuickCustomerDialogProps {
  open: boolean;
  onClose: () => void;
  onCustomerCreated: (customer: ICustomer) => void;
}

export function QuickCustomerDialog({
  open,
  onClose,
  onCustomerCreated,
}: QuickCustomerDialogProps) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [village, setVillage] = useState("");
  const [address, setAddress] = useState("");
  const [gstin, setGstin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const resetForm = () => {
    setName("");
    setPhone("");
    setVillage("");
    setAddress("");
    setGstin("");
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanPhone = phone.trim().replace(/[\s-]/g, "");
    if (!name.trim()) {
      setError("Customer name is required");
      return;
    }
    if (!cleanPhone || !/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError("Please enter a valid 10-digit Indian phone number");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: cleanPhone,
          village: village.trim() || undefined,
          address: address.trim() || undefined,
          gstin: gstin.trim()?.toUpperCase() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.message || "Failed to create customer");
      }

      const created: ICustomer = data.data.customer;
      onCustomerCreated(created);
      resetForm();
      onClose();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()} title="Register New Customer / Farmer">
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
            Customer / Farmer Name <span className="text-red-500">*</span>
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. R. Subramanian"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
            Mobile Number <span className="text-red-500">*</span>
          </label>
          <div className="flex">
            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
              +91
            </span>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="9876543210"
              maxLength={10}
              className="rounded-l-none"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              Village / Town
            </label>
            <Input
              value={village}
              onChange={(e) => setVillage(e.target.value)}
              placeholder="e.g. Kudavasal"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
              GSTIN (Optional)
            </label>
            <Input
              value={gstin}
              onChange={(e) => setGstin(e.target.value.toUpperCase())}
              placeholder="33AAAAA0000A1Z5"
              maxLength={15}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
            Address / Landmark (Optional)
          </label>
          <Input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. North Street, Near Temple"
          />
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-gray-100">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4 mr-2" />
                Register & Select
              </>
            )}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
