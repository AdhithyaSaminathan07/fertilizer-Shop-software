"use client";

import * as React from "react";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Printer,
  Ban,
  Receipt,
  Building2,
  Calendar,
  Clock,
  User,
  Phone,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { CancelSaleDialog } from "@/components/billing/cancel-sale-dialog";
import type { ISale } from "@/types/sale";
import type { ISettings } from "@/types/settings";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SaleInvoiceDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { id } = use(params);

  const [sale, setSale] = useState<ISale | null>(null);
  const [shopSettings, setShopSettings] = useState<ISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      setLoading(true);
      setError("");
      try {
        const [saleRes, settingsRes] = await Promise.all([
          fetch(`/api/sales/${id}`),
          fetch("/api/settings"),
        ]);

        const saleData = await saleRes.json();
        const settingsData = await settingsRes.json();

        if (!ignore) {
          if (!saleRes.ok) {
            throw new Error(saleData.error?.message || "Invoice not found");
          }
          setSale(saleData.data.sale);
          if (settingsRes.ok && settingsData.data?.settings) {
            setShopSettings(settingsData.data.settings);
          }
        }
      } catch (err: any) {
        if (!ignore) setError(err.message || "Failed to load invoice details");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadData();
    return () => {
      ignore = true;
    };
  }, [id]);

  const handleConfirmCancel = async (reason: string) => {
    const res = await fetch(`/api/sales/${id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || "Failed to cancel invoice");
    }

    setSale(data.data.sale);
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-gray-500 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
        <p className="text-sm font-medium">Loading tax invoice...</p>
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <div className="p-4 bg-red-50 text-red-700 rounded-xl border border-red-200 text-sm font-semibold">
          {error || "Sales invoice could not be found"}
        </div>
        <Link
          href="/billing"
          className="inline-flex items-center text-xs font-semibold text-emerald-700 hover:underline"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Billing
        </Link>
      </div>
    );
  }

  const isCancelled = sale.status === "CANCELLED";
  const shop = shopSettings?.businessProfile;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Non-Printable Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white border border-gray-200 rounded-xl shadow-sm print:hidden">
        <Link
          href="/billing"
          className="inline-flex items-center text-xs font-semibold text-gray-600 hover:text-emerald-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Billing Counter
        </Link>

        <div className="flex items-center gap-2">
          {!isCancelled && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCancelModal(true)}
              className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
            >
              <Ban className="w-3.5 h-3.5 mr-1" />
              Cancel Invoice
            </Button>
          )}
          <Button
            size="sm"
            onClick={handlePrint}
            className="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Tax Invoice
          </Button>
        </div>
      </div>

      {/* Cancellation Banner */}
      {isCancelled && (
        <div className="p-4 bg-red-50 border-2 border-red-300 rounded-xl text-red-900 space-y-1 print:border-red-500">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
            <span>THIS INVOICE HAS BEEN CANCELLED</span>
          </div>
          <p className="text-xs text-red-700">
            Cancelled on: {new Date(sale.cancelledAt!).toLocaleString("en-IN")}
            {sale.cancellationReason && ` \u2022 Reason: ${sale.cancellationReason}`}
          </p>
          <p className="text-[11px] text-red-600">
            Stock quantities were restored to inventory and customer credit balance was reversed.
          </p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAX INVOICE DOCUMENT (PRINTABLE CONTAINER) */}
      {/* ========================================================================= */}
      <div className="bg-white border border-gray-300 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6 print:border-none print:shadow-none print:p-0">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b border-gray-200">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded-lg print:border print:border-emerald-800">
                <Receipt className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-black text-gray-900 tracking-tight">
                {shop?.shopName || "KASI AGRI AGENCIES"}
              </h2>
            </div>
            <p className="text-xs text-gray-600 font-medium">
              Proprietor: {shop?.proprietorName || "R. Balamurugan"}
            </p>
            <p className="text-xs text-gray-500">
              {shop?.address?.street || "Main Road"},{" "}
              {shop?.address?.villageTown || "Thiruvarur"},{" "}
              {shop?.address?.district || "Thiruvarur"} - {shop?.address?.pincode || "610001"}
            </p>
            <p className="text-xs text-gray-500">
              Phone: +91 {shop?.phone || "9876543210"}
              {shop?.gstin && ` \u2022 GSTIN: ${shop.gstin}`}
            </p>
          </div>

          <div className="sm:text-right space-y-1">
            <div className="text-xs font-bold text-emerald-700 uppercase tracking-widest">
              Retail Tax Invoice
            </div>
            <div className="text-lg font-black text-gray-900">{sale.invoiceNumber}</div>
            <div className="text-xs text-gray-500 flex items-center sm:justify-end gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(sale.invoiceDate).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </div>
            <div className="text-xs text-gray-500 flex items-center sm:justify-end gap-1">
              <Clock className="w-3.5 h-3.5" />
              {new Date(sale.invoiceDate).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        </div>

        {/* Billed To / Customer Snapshot */}
        <div className="p-4 bg-gray-50/70 border border-gray-200 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Customer / Farmer Details
            </div>
            <div className="font-bold text-sm text-gray-900">
              {sale.customerSnapshot?.name || "Walk-in Customer"}
            </div>
            {sale.customerSnapshot?.phone && (
              <div className="text-gray-600 mt-0.5">Mobile: +91 {sale.customerSnapshot.phone}</div>
            )}
            {sale.customerSnapshot?.village && (
              <div className="text-gray-600">Village: {sale.customerSnapshot.village}</div>
            )}
            {sale.customerSnapshot?.gstin && (
              <div className="text-gray-600">GSTIN: {sale.customerSnapshot.gstin}</div>
            )}
          </div>

          <div className="sm:text-right">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
              Payment Summary
            </div>
            <div className="font-bold text-xs text-gray-900">
              Payment Method: <span className="text-emerald-800">{sale.payment.method}</span>
            </div>
            <div className="text-gray-600 mt-0.5">
              Cash: ₹{sale.payment.cashAmount.toFixed(2)} | UPI: ₹{sale.payment.upiAmount.toFixed(2)}
            </div>
            {sale.payment.upiReference && (
              <div className="text-gray-500 text-[10px]">UTR: {sale.payment.upiReference}</div>
            )}
            {sale.payment.creditAmount > 0 && (
              <div className="font-bold text-amber-800 mt-0.5">
                Khata Credit Extended: ₹{sale.payment.creditAmount.toFixed(2)}
              </div>
            )}
          </div>
        </div>

        {/* Items Table */}
        <div className="overflow-x-auto border border-gray-200 rounded-xl">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-100/70 text-[11px] text-gray-700">
                <TableHead className="w-[5%] text-center">#</TableHead>
                <TableHead className="w-[35%]">Description of Goods</TableHead>
                <TableHead className="text-center w-[12%]">Batch</TableHead>
                <TableHead className="text-center w-[12%]">Quantity</TableHead>
                <TableHead className="text-right w-[12%]">Rate (₹)</TableHead>
                <TableHead className="text-right w-[10%]">GST</TableHead>
                <TableHead className="text-right w-[14%]">Amount (₹)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sale.items.map((item, idx) => (
                <TableRow key={idx} className="text-xs hover:bg-gray-50/50">
                  <TableCell className="text-center text-gray-400 font-medium">{idx + 1}</TableCell>
                  <TableCell>
                    <div className="font-semibold text-gray-900">{item.productSnapshot.name}</div>
                    <div className="text-[10px] text-gray-500">
                      SKU: {item.productSnapshot.sku}
                      {item.productSnapshot.brand && ` \u2022 ${item.productSnapshot.brand}`}
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-[11px] text-gray-600">
                    {item.batchNumber ? (
                      <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-[10px]">
                        {item.batchNumber}
                      </span>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    {item.quantity} {item.unit}
                  </TableCell>
                  <TableCell className="text-right">₹{item.unitSellingPrice.toFixed(2)}</TableCell>
                  <TableCell className="text-right text-[11px] text-gray-600">
                    {item.gstRate}%
                  </TableCell>
                  <TableCell className="text-right font-bold text-gray-900">
                    ₹{item.total.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Invoice Summary Totals */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2">
          <div className="text-xs text-gray-500 space-y-1 max-w-sm">
            <div className="font-semibold text-gray-700">Terms & Conditions:</div>
            <p className="text-[11px] leading-relaxed">
              1. Certified agricultural seeds, fertilizers and chemicals are supplied subject to manufacturer warranty.
              <br />
              2. Chemical usage must follow recommended safety dosage.
              <br />
              3. Goods once inwarded cannot be refunded without original bill.
            </p>
          </div>

          <div className="w-full sm:w-72 space-y-1.5 text-xs bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span className="font-semibold text-gray-900">₹{sale.subtotal.toFixed(2)}</span>
            </div>
            {sale.totalDiscount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Total Discount:</span>
                <span className="font-semibold">-₹{sale.totalDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-600">
              <span>Taxable Value:</span>
              <span className="font-semibold text-gray-900">₹{sale.taxableAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>Total GST:</span>
              <span className="font-semibold text-gray-900">₹{sale.totalGst.toFixed(2)}</span>
            </div>
            {sale.roundOff !== 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Round Off:</span>
                <span className="font-semibold text-gray-900">
                  {sale.roundOff > 0 ? `+₹${sale.roundOff.toFixed(2)}` : `-₹${Math.abs(sale.roundOff).toFixed(2)}`}
                </span>
              </div>
            )}
            <div className="pt-2 border-t border-gray-300 flex justify-between items-center text-sm">
              <span className="font-bold text-gray-900">Grand Total:</span>
              <span className="font-black text-emerald-800 text-base">
                ₹{sale.grandTotal.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Document Footer */}
        <div className="pt-8 border-t border-gray-200 flex justify-between items-end text-xs text-gray-500">
          <div>
            <p>Customer Signature</p>
          </div>
          <div className="text-right space-y-6">
            <p className="font-semibold text-gray-800">For {shop?.shopName || "KASI AGRI AGENCIES"}</p>
            <p className="text-[11px] text-gray-400">Authorized Signatory</p>
          </div>
        </div>
      </div>

      {/* Cancellation Dialog */}
      {showCancelModal && (
        <CancelSaleDialog
          open={showCancelModal}
          invoiceNumber={sale.invoiceNumber}
          grandTotal={sale.grandTotal}
          creditAmount={sale.payment.creditAmount}
          onClose={() => setShowCancelModal(false)}
          onConfirm={handleConfirmCancel}
        />
      )}
    </div>
  );
}

