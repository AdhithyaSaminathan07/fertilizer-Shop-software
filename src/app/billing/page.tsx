"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Receipt,
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  UserCheck,
  UserPlus,
  CreditCard,
  Banknote,
  Smartphone,
  BookOpenText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Calendar,
  Filter,
  Eye,
  Ban,
  Clock,
  Layers,
  Sparkles,
  ArrowRight,
  RefreshCw,
  X,
  FileText,
  IndianRupee,
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
import { QuickCustomerDialog } from "@/components/billing/quick-customer-dialog";
import { CancelSaleDialog } from "@/components/billing/cancel-sale-dialog";
import type { ICustomer } from "@/types/customer";
import type { ISale, SalePaymentMethod, ISalesDashboardKPIs } from "@/types/sale";

interface ProductOption {
  _id: string;
  name: string;
  sku: string;
  brand: string;
  primaryUnit: string;
  sellingPrice: number;
  currentStock: number;
  batches?: Array<{
    _id: string;
    batchNumber: string;
    quantity: number;
    expiryDate?: string;
    status: string;
  }>;
}

interface CartItem {
  productId: string;
  name: string;
  sku: string;
  brand: string;
  primaryUnit: string;
  currentStock: number;
  batchId?: string;
  batchNumber?: string;
  availableBatches: Array<{
    _id: string;
    batchNumber: string;
    quantity: number;
    expiryDate?: string;
    status: string;
  }>;
  quantity: number;
  unit: string;
  unitSellingPrice: number;
  discountType: "PERCENT" | "FIXED";
  discountValue: number;
  gstRate: number;
}

function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

export default function BillingPage() {
  const router = useRouter();

  // Active Tab: "pos" | "history" | "analytics"
  const [activeTab, setActiveTab] = useState<"pos" | "history" | "analytics">("pos");

  // -------------------------------------------------------------
  // POS COUNTER BILLING STATE
  // -------------------------------------------------------------
  const [productSearch, setProductSearch] = useState("");
  const [productsList, setProductsList] = useState<ProductOption[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [invoiceDiscount, setInvoiceDiscount] = useState<number>(0);
  const [roundOff, setRoundOff] = useState<number>(0);

  // Customer Selection
  const [isWalkIn, setIsWalkIn] = useState(true);
  const [customerSearch, setCustomerSearch] = useState("");
  const [matchingCustomers, setMatchingCustomers] = useState<ICustomer[]>([]);
  const [searchingCustomers, setSearchingCustomers] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<ICustomer | null>(null);
  const [showQuickCustomerModal, setShowQuickCustomerModal] = useState(false);

  // Payment Breakdown
  const [paymentMode, setPaymentMode] = useState<SalePaymentMethod>("CASH");
  const [splitCash, setSplitCash] = useState<number>(0);
  const [splitUpi, setSplitUpi] = useState<number>(0);
  const [upiReference, setUpiReference] = useState<string>("");
  const [splitCredit, setSplitCredit] = useState<number>(0);
  const [saleNotes, setSaleNotes] = useState<string>("");

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [posError, setPosError] = useState("");
  const [posSuccessInvoice, setPosSuccessInvoice] = useState<ISale | null>(null);

  // -------------------------------------------------------------
  // SALES REGISTER / HISTORY STATE
  // -------------------------------------------------------------
  const [sales, setSales] = useState<ISale[]>([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("ALL");
  const [fromDateFilter, setFromDateFilter] = useState("");
  const [toDateFilter, setToDateFilter] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSalesCount, setTotalSalesCount] = useState(0);

  // Cancellation State
  const [saleToCancel, setSaleToCancel] = useState<ISale | null>(null);

  // -------------------------------------------------------------
  // ANALYTICS / KPIS STATE
  // -------------------------------------------------------------
  const [dashboardKPIs, setDashboardKPIs] = useState<ISalesDashboardKPIs | null>(null);
  const [loadingKPIs, setLoadingKPIs] = useState(false);

  // Load products for counter billing
  const loadProducts = useCallback(async (queryStr = "") => {
    setLoadingProducts(true);
    try {
      const q = queryStr.trim();
      const url = q
        ? `/api/products?search=${encodeURIComponent(q)}&status=ACTIVE&includeBatches=true&limit=50`
        : "/api/products?limit=100&status=ACTIVE&includeBatches=true";
      const res = await fetch(url);
      const data = await res.json();
      if (res.ok && data.data) {
        const list = data.data.items || data.data.products || [];
        setProductsList(list);
      }
    } catch (err) {
      console.error("Failed to load products for billing:", err);
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  // Debounced counter search & initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      loadProducts(productSearch);
    }, productSearch ? 250 : 0);
    return () => clearTimeout(timer);
  }, [productSearch, loadProducts]);

  // Search customers debounced
  useEffect(() => {
    if (isWalkIn || !customerSearch.trim() || customerSearch.trim().length < 2) {
      return;
    }

    let ignore = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/customers?autocomplete=true&search=${encodeURIComponent(customerSearch.trim())}`
        );
        const data = await res.json();
        if (!ignore && res.ok && data.data?.customers) {
          setMatchingCustomers(data.data.customers);
        }
      } catch (err) {
        console.error("Failed to search customers:", err);
      }
    }, 250);

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [customerSearch, isWalkIn]);

  // Load Sales History
  const fetchSalesHistory = useCallback(async () => {
    setLoadingSales(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(historyPage));
      params.set("limit", "15");
      if (historySearch.trim()) params.set("search", historySearch.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (paymentMethodFilter !== "ALL") params.set("paymentMethod", paymentMethodFilter);
      if (fromDateFilter) params.set("fromDate", fromDateFilter);
      if (toDateFilter) params.set("toDate", toDateFilter);

      const res = await fetch(`/api/sales?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.data) {
        setSales(data.data.sales || []);
        setTotalPages(data.data.pagination?.pages || 1);
        setTotalSalesCount(data.data.pagination?.total || 0);
      }
    } catch (err) {
      console.error("Failed to load sales history:", err);
    } finally {
      setLoadingSales(false);
    }
  }, [historyPage, historySearch, statusFilter, paymentMethodFilter, fromDateFilter, toDateFilter]);

  // Load KPIs
  const fetchKPIs = useCallback(async () => {
    setLoadingKPIs(true);
    try {
      const res = await fetch("/api/sales/dashboard");
      const data = await res.json();
      if (res.ok && data.data?.kpis) {
        setDashboardKPIs(data.data.kpis);
      }
    } catch (err) {
      console.error("Failed to load sales dashboard KPIs:", err);
    } finally {
      setLoadingKPIs(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    if (activeTab === "history") {
      (async () => {
        try {
          const params = new URLSearchParams();
          params.set("page", String(historyPage));
          params.set("limit", "15");
          if (historySearch.trim()) params.set("search", historySearch.trim());
          if (statusFilter !== "ALL") params.set("status", statusFilter);
          if (paymentMethodFilter !== "ALL") params.set("paymentMethod", paymentMethodFilter);
          if (fromDateFilter) params.set("fromDate", fromDateFilter);
          if (toDateFilter) params.set("toDate", toDateFilter);

          const res = await fetch(`/api/sales?${params.toString()}`);
          const data = await res.json();
          if (!ignore && res.ok && data.data) {
            setSales(data.data.sales || []);
            setTotalPages(data.data.pagination?.pages || 1);
            setTotalSalesCount(data.data.pagination?.total || 0);
          }
        } catch (err) {
          console.error("Failed to load sales history:", err);
        }
      })();
    } else if (activeTab === "analytics") {
      (async () => {
        try {
          const res = await fetch("/api/sales/dashboard");
          const data = await res.json();
          if (!ignore && res.ok && data.data?.kpis) {
            setDashboardKPIs(data.data.kpis);
          }
        } catch (err) {
          console.error("Failed to load sales dashboard KPIs:", err);
        }
      })();
    }

    return () => {
      ignore = true;
    };
  }, [activeTab, historyPage, historySearch, statusFilter, paymentMethodFilter, fromDateFilter, toDateFilter]);

  // -------------------------------------------------------------
  // CART FINANCIAL CALCULATIONS
  // -------------------------------------------------------------
  const { subtotal, totalDiscount, taxableAmount, totalGst, calculatedGrandTotal } =
    useMemo(() => {
      let sub = 0;
      let disc = 0;
      let tax = 0;
      let gst = 0;

      cart.forEach((item) => {
        const lineSub = round2(item.quantity * item.unitSellingPrice);
        let itemDisc = 0;
        if (item.discountType === "PERCENT") {
          itemDisc = round2((lineSub * item.discountValue) / 100);
        } else {
          itemDisc = round2(item.discountValue);
        }
        itemDisc = Math.min(itemDisc, lineSub);

        const lineTaxable = round2(lineSub - itemDisc);
        const lineGst = round2((lineTaxable * item.gstRate) / 100);

        sub = round2(sub + lineSub);
        disc = round2(disc + itemDisc);
        tax = round2(tax + lineTaxable);
        gst = round2(gst + lineGst);
      });

      const grand = round2(tax + gst - invoiceDiscount + roundOff);

      return {
        subtotal: sub,
        totalDiscount: round2(disc + invoiceDiscount),
        taxableAmount: tax,
        totalGst: gst,
        calculatedGrandTotal: Math.max(0, grand),
      };
    }, [cart, invoiceDiscount, roundOff]);

  // Derived effective payment amounts
  const cashAmount =
    paymentMode === "CASH"
      ? calculatedGrandTotal
      : paymentMode === "SPLIT"
      ? splitCash
      : 0;
  const upiAmount =
    paymentMode === "UPI"
      ? calculatedGrandTotal
      : paymentMode === "SPLIT"
      ? splitUpi
      : 0;
  const creditAmount =
    paymentMode === "CREDIT"
      ? calculatedGrandTotal
      : paymentMode === "SPLIT"
      ? splitCredit
      : 0;

  const allocatedPaymentSum = round2(cashAmount + upiAmount + creditAmount);
  const paymentRemaining = round2(calculatedGrandTotal - allocatedPaymentSum);
  const isPaymentBalanced = Math.abs(paymentRemaining) <= 0.01;

  // -------------------------------------------------------------
  // CART ACTIONS
  // -------------------------------------------------------------
  const addToCart = (product: ProductOption) => {
    setPosError("");
    setPosSuccessInvoice(null);

    const activeBatches = (product.batches || []).filter(
      (b) => b.status === "ACTIVE" && b.quantity > 0
    );

    setCart((prev) => {
      const existingIndex = prev.findIndex((i) => i.productId === product._id);
      if (existingIndex >= 0) {
        const item = prev[existingIndex];
        const newQty = item.quantity + 1;
        if (newQty > product.currentStock) {
          setPosError(`Cannot add more than available stock (${product.currentStock}) for ${product.name}`);
          return prev;
        }
        const updated = [...prev];
        updated[existingIndex] = { ...item, quantity: newQty };
        return updated;
      }

      if (product.currentStock <= 0) {
        setPosError(`"${product.name}" is currently out of stock`);
        return prev;
      }

      const initialBatch = activeBatches.length > 0 ? activeBatches[0] : undefined;

      const newItem: CartItem = {
        productId: product._id,
        name: product.name,
        sku: product.sku,
        brand: product.brand,
        primaryUnit: product.primaryUnit,
        currentStock: product.currentStock,
        batchId: initialBatch?._id,
        batchNumber: initialBatch?.batchNumber,
        availableBatches: activeBatches,
        quantity: 1,
        unit: product.primaryUnit,
        unitSellingPrice: product.sellingPrice,
        discountType: "FIXED",
        discountValue: 0,
        gstRate: 5, // Default 5% for agri fertilizers/seeds
      };

      return [...prev, newItem];
    });
  };

  const updateCartItem = (index: number, updates: Partial<CartItem>) => {
    setCart((prev) => {
      const updated = [...prev];
      const current = updated[index];
      const merged = { ...current, ...updates };

      if (merged.quantity > merged.currentStock) {
        setPosError(`Requested quantity (${merged.quantity}) exceeds available stock (${merged.currentStock})`);
        merged.quantity = merged.currentStock;
      }
      if (merged.quantity <= 0) {
        merged.quantity = 0.1;
      }

      updated[index] = merged;
      return updated;
    });
  };

  const removeFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
    setInvoiceDiscount(0);
    setRoundOff(0);
    setSelectedCustomer(null);
    setIsWalkIn(true);
    setPosError("");
    setPosSuccessInvoice(null);
  };

  // -------------------------------------------------------------
  // COMPLETE SALE / SUBMIT INVOICE
  // -------------------------------------------------------------
  const handleCompleteSale = async () => {
    setPosError("");

    if (cart.length === 0) {
      setPosError("Cart is empty. Please add products to issue an invoice.");
      return;
    }

    if (!isPaymentBalanced) {
      setPosError(
        `Payment breakdown (₹${allocatedPaymentSum.toFixed(2)}) must exactly match invoice total (₹${calculatedGrandTotal.toFixed(2)}). Difference: ₹${paymentRemaining.toFixed(2)}`
      );
      return;
    }

    if (creditAmount > 0 && !selectedCustomer) {
      setPosError("Customer selection is mandatory when credit is extended");
      return;
    }

    // Verify stock availability before submission
    for (const item of cart) {
      if (item.quantity > item.currentStock) {
        setPosError(
          `Cannot sell ${item.quantity} ${item.unit} of "${item.name}". Only ${item.currentStock} ${item.unit} available in stock.`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        customerId: selectedCustomer?._id || undefined,
        customerName: selectedCustomer ? selectedCustomer.name : undefined,
        customerPhone: selectedCustomer ? selectedCustomer.phone : undefined,
        customerVillage: selectedCustomer?.village || undefined,
        isWalkIn: isWalkIn && !selectedCustomer,
        items: cart.map((item) => ({
          productId: item.productId,
          batchId: item.batchId || undefined,
          quantity: item.quantity,
          unit: item.unit,
          unitSellingPrice: item.unitSellingPrice,
          discountType: item.discountType,
          discountValue: item.discountValue,
          gstRate: item.gstRate,
        })),
        invoiceDiscount,
        roundOff,
        payment: {
          method: paymentMode,
          cashAmount,
          upiAmount,
          upiReference: upiReference.trim() || undefined,
          creditAmount,
        },
        notes: saleNotes.trim() || undefined,
      };

      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.message || "Failed to complete sales invoice");
      }

      const created: ISale = data.data.sale;
      setPosSuccessInvoice(created);
      clearCart();
      loadProducts(productSearch);
    } catch (err: any) {
      setPosError(err.message || "An error occurred while creating invoice");
      loadProducts(productSearch);
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // INVOICE CANCELLATION
  // -------------------------------------------------------------
  const handleConfirmCancel = async (reason: string) => {
    if (!saleToCancel) return;

    const res = await fetch(`/api/sales/${saleToCancel._id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error?.message || data.message || "Failed to cancel invoice");
    }

    // Refresh history and stock
    fetchSalesHistory();
    loadProducts(productSearch);
  };

  // Filter products for live counter search
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return productsList.slice(0, 12);
    const q = productSearch.toLowerCase().trim();
    return productsList
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.brand && p.brand.toLowerCase().includes(q))
      )
      .slice(0, 20);
  }, [productsList, productSearch]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 p-6 rounded-2xl text-white shadow-lg">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-emerald-700/60 rounded-lg backdrop-blur-sm">
              <Receipt className="w-6 h-6 text-emerald-300" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight">Billing & Counter PoS</h1>
            <Badge className="bg-emerald-600/60 border border-emerald-400/40 text-emerald-100 text-xs">
              Phase 6B
            </Badge>
          </div>
          <p className="text-emerald-100 text-sm">
            High-speed billing counter, split cash/UPI/credit settlements, inventory auto-deduction, and customer khata tracking
          </p>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex items-center gap-1 bg-emerald-950/60 p-1.5 rounded-xl border border-emerald-700/50 backdrop-blur-sm self-start md:self-auto">
          <button
            onClick={() => setActiveTab("pos")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "pos"
                ? "bg-white text-emerald-950 shadow-md font-bold"
                : "text-emerald-200 hover:text-white"
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            Counter PoS
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "history"
                ? "bg-white text-emerald-950 shadow-md font-bold"
                : "text-emerald-200 hover:text-white"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            Invoices Register
          </button>
          <button
            onClick={() => setActiveTab("analytics")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 ${
              activeTab === "analytics"
                ? "bg-white text-emerald-950 shadow-md font-bold"
                : "text-emerald-200 hover:text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Daily Analytics
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: COUNTER BILLING (POS) */}
      {/* ========================================================================= */}
      {activeTab === "pos" && (
        <div className="space-y-6">
          {/* Success Banner if invoice just issued */}
          {posSuccessInvoice && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-emerald-900 shadow-sm animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="font-bold text-sm">
                    Invoice #{posSuccessInvoice.invoiceNumber} Issued Successfully!
                  </h4>
                  <p className="text-xs text-emerald-700">
                    Grand Total: ₹{posSuccessInvoice.grandTotal.toFixed(2)} | Method:{" "}
                    {posSuccessInvoice.payment.method} | Customer:{" "}
                    {posSuccessInvoice.customerSnapshot?.name}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/billing/${posSuccessInvoice._id}`}
                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1"
                >
                  <Eye className="w-3.5 h-3.5" />
                  View & Print Bill
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPosSuccessInvoice(null)}
                  className="text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* POS Layout: Left 65% Cart & Product Search, Right 35% Customer & Payment */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* LEFT COLUMN: Product Catalog & Live Cart Table */}
            <div className="lg:col-span-8 space-y-6">
              {/* Product Lookup Card */}
              <Card className="border-gray-200 shadow-sm">
                <CardHeader className="pb-3 border-b border-gray-100 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-800">
                    <Search className="w-4 h-4 text-emerald-600" />
                    Quick Product Selection
                  </CardTitle>
                  <span className="text-xs text-gray-500">
                    {productsList.length} products in catalogue
                  </span>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                    <Input
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Search products by Name, Brand or SKU (e.g. Urea, DAP, Coromandel)..."
                      className="pl-9 text-sm"
                    />
                    {productSearch && (
                      <button
                        onClick={() => setProductSearch("")}
                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Quick Product Pills / Results Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                    {loadingProducts ? (
                      <div className="col-span-full py-4 text-center text-xs text-gray-500">
                        <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-emerald-600" />
                        Loading catalogue...
                      </div>
                    ) : filteredProducts.length === 0 ? (
                      <div className="col-span-full py-3 text-center text-xs text-gray-400">
                        No products found matching &quot;{productSearch}&quot;
                      </div>
                    ) : (
                      filteredProducts.map((p) => {
                        const inStock = p.currentStock > 0;
                        return (
                          <button
                            key={p._id}
                            type="button"
                            onClick={() => addToCart(p)}
                            disabled={!inStock}
                            className={`p-2 rounded-lg border text-left flex flex-col justify-between transition-all ${
                              inStock
                                ? "border-gray-200 hover:border-emerald-500 hover:bg-emerald-50/50 cursor-pointer bg-white"
                                : "border-gray-100 bg-gray-50/80 opacity-60 cursor-not-allowed"
                            }`}
                          >
                            <div>
                              <div className="font-semibold text-xs text-gray-900 line-clamp-1">
                                {p.name}
                              </div>
                              <div className="text-[10px] text-gray-500">
                                {p.brand} &bull; {p.sku}
                              </div>
                            </div>
                            <div className="flex items-center justify-between mt-2 pt-1 border-t border-gray-100">
                              <span className="text-xs font-bold text-emerald-800">
                                ₹{p.sellingPrice.toFixed(2)}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                  inStock
                                    ? p.currentStock < 10
                                      ? "bg-amber-100 text-amber-800"
                                      : "bg-emerald-100 text-emerald-800"
                                    : "bg-red-100 text-red-700 font-bold"
                                }`}
                              >
                                {inStock ? `${p.currentStock} ${p.primaryUnit}` : "Out of Stock"}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Live Cart Table */}
              <Card className="border-gray-200 shadow-sm">
                <CardHeader className="pb-3 border-b border-gray-100 flex flex-row items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-emerald-600" />
                    <CardTitle className="text-sm font-semibold text-gray-800">
                      Invoice Items ({cart.length})
                    </CardTitle>
                  </div>
                  {cart.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearCart}
                      className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1" />
                      Clear Cart
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  {cart.length === 0 ? (
                    <div className="py-12 text-center text-gray-400 space-y-2">
                      <ShoppingCart className="w-10 h-10 mx-auto text-gray-300 stroke-[1.5]" />
                      <p className="text-sm font-medium text-gray-500">No items added to bill yet</p>
                      <p className="text-xs text-gray-400">
                        Search and click on any product above to start billing
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50/70 text-[11px] text-gray-600">
                            <TableHead className="w-[30%]">Product & Batch</TableHead>
                            <TableHead className="text-center w-[18%]">Quantity</TableHead>
                            <TableHead className="text-right w-[15%]">Rate (₹)</TableHead>
                            <TableHead className="text-right w-[15%]">Disc (₹/%)</TableHead>
                            <TableHead className="text-right w-[10%]">GST %</TableHead>
                            <TableHead className="text-right w-[12%]">Total (₹)</TableHead>
                            <TableHead className="w-[5%]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cart.map((item, idx) => {
                            const lineSub = round2(item.quantity * item.unitSellingPrice);
                            let discAmt = 0;
                            if (item.discountType === "PERCENT") {
                              discAmt = round2((lineSub * item.discountValue) / 100);
                            } else {
                              discAmt = round2(item.discountValue);
                            }
                            discAmt = Math.min(discAmt, lineSub);
                            const taxable = round2(lineSub - discAmt);
                            const lineGst = round2((taxable * item.gstRate) / 100);
                            const lineTot = round2(taxable + lineGst);

                            return (
                              <TableRow key={item.productId} className="hover:bg-gray-50/50">
                                <TableCell className="py-2.5">
                                  <div className="font-medium text-xs text-gray-900">{item.name}</div>
                                  <div className="text-[10px] text-gray-500">
                                    {item.sku} &bull; Stock: {item.currentStock} {item.primaryUnit}
                                  </div>
                                  {item.availableBatches.length > 0 && (
                                    <select
                                      value={item.batchId || ""}
                                      onChange={(e) => {
                                        const b = item.availableBatches.find(
                                          (x) => x._id === e.target.value
                                        );
                                        updateCartItem(idx, {
                                          batchId: b?._id,
                                          batchNumber: b?.batchNumber,
                                        });
                                      }}
                                      className="mt-1 text-[10px] border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50 text-gray-700"
                                    >
                                      {item.availableBatches.map((b) => (
                                        <option key={b._id} value={b._id}>
                                          Batch: {b.batchNumber} ({b.quantity} left)
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </TableCell>
                                <TableCell className="py-2.5">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateCartItem(idx, {
                                          quantity: Math.max(0.1, round2(item.quantity - 1)),
                                        })
                                      }
                                      className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <input
                                      type="number"
                                      step="any"
                                      value={item.quantity}
                                      onChange={(e) =>
                                        updateCartItem(idx, {
                                          quantity: parseFloat(e.target.value) || 0,
                                        })
                                      }
                                      className="w-14 text-center text-xs font-semibold border border-gray-200 rounded py-0.5"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateCartItem(idx, {
                                          quantity: round2(item.quantity + 1),
                                        })
                                      }
                                      className="w-6 h-6 rounded border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>
                                </TableCell>
                                <TableCell className="py-2.5 text-right">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={item.unitSellingPrice}
                                    onChange={(e) =>
                                      updateCartItem(idx, {
                                        unitSellingPrice: parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    className="w-18 text-right text-xs font-semibold border border-gray-200 rounded px-1 py-0.5"
                                  />
                                </TableCell>
                                <TableCell className="py-2.5 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <input
                                      type="number"
                                      step="any"
                                      value={item.discountValue}
                                      onChange={(e) =>
                                        updateCartItem(idx, {
                                          discountValue: parseFloat(e.target.value) || 0,
                                        })
                                      }
                                      className="w-12 text-right text-xs border border-gray-200 rounded px-1 py-0.5"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateCartItem(idx, {
                                          discountType:
                                            item.discountType === "PERCENT" ? "FIXED" : "PERCENT",
                                        })
                                      }
                                      className="text-[10px] px-1 py-0.5 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 font-semibold"
                                    >
                                      {item.discountType === "PERCENT" ? "%" : "₹"}
                                    </button>
                                  </div>
                                </TableCell>
                                <TableCell className="py-2.5 text-right">
                                  <select
                                    value={item.gstRate}
                                    onChange={(e) =>
                                      updateCartItem(idx, {
                                        gstRate: parseFloat(e.target.value) || 0,
                                      })
                                    }
                                    className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white"
                                  >
                                    <option value="0">0%</option>
                                    <option value="5">5%</option>
                                    <option value="12">12%</option>
                                    <option value="18">18%</option>
                                    <option value="28">28%</option>
                                  </select>
                                </TableCell>
                                <TableCell className="py-2.5 text-right font-bold text-xs text-gray-900">
                                  ₹{lineTot.toFixed(2)}
                                </TableCell>
                                <TableCell className="py-2.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => removeFromCart(idx)}
                                    className="text-gray-400 hover:text-red-600 p-1 rounded"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* RIGHT COLUMN: Customer Details, Totals & Payment Settlement */}
            <div className="lg:col-span-4 space-y-6">
              {/* Customer Selector Card */}
              <Card className="border-gray-200 shadow-sm">
                <CardHeader className="pb-3 border-b border-gray-100 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-800">
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    Customer Details
                  </CardTitle>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setShowQuickCustomerModal(true)}
                    className="text-xs h-7 px-2 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                  >
                    <UserPlus className="w-3.5 h-3.5 mr-1" />
                    + New
                  </Button>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  {/* Walk-in vs Registered Toggle */}
                  <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setIsWalkIn(true);
                        setSelectedCustomer(null);
                        setCustomerSearch("");
                        if (paymentMode === "CREDIT") setPaymentMode("CASH");
                      }}
                      className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${
                        isWalkIn && !selectedCustomer
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      Walk-in Retail Buyer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsWalkIn(false);
                      }}
                      className={`flex-1 py-1 text-xs font-semibold rounded-md transition-all ${
                        !isWalkIn || selectedCustomer
                          ? "bg-white text-emerald-800 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      Registered Farmer
                    </button>
                  </div>

                  {/* Customer Search & Selected Customer View */}
                  {selectedCustomer ? (
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg space-y-1 relative">
                      <button
                        onClick={() => setSelectedCustomer(null)}
                        className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      <div className="font-bold text-xs text-emerald-950">
                        {selectedCustomer.name}
                      </div>
                      <div className="text-[11px] text-emerald-800">
                        Phone: {selectedCustomer.phone}
                        {selectedCustomer.village && ` \u2022 ${selectedCustomer.village}`}
                      </div>
                      <div className="text-[11px] font-semibold text-amber-800 pt-1">
                        Outstanding Credit: ₹{selectedCustomer.outstandingCredit.toFixed(2)}
                      </div>
                    </div>
                  ) : !isWalkIn ? (
                    <div className="space-y-2 relative">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
                        <Input
                          value={customerSearch}
                          onChange={(e) => setCustomerSearch(e.target.value)}
                          placeholder="Search farmer by phone or name..."
                          className="pl-8 text-xs"
                        />
                      </div>

                      {/* Dropdown search results */}
                      {searchingCustomers ? (
                        <div className="text-center py-2 text-xs text-gray-400">Searching...</div>
                      ) : matchingCustomers.length > 0 ? (
                        <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto mt-1 divide-y divide-gray-100">
                          {matchingCustomers.map((c) => (
                            <button
                              key={c._id}
                              type="button"
                              onClick={() => {
                                setSelectedCustomer(c);
                                setIsWalkIn(false);
                                setMatchingCustomers([]);
                                setCustomerSearch("");
                              }}
                              className="w-full text-left p-2 hover:bg-emerald-50 text-xs flex justify-between items-center"
                            >
                              <div>
                                <div className="font-semibold text-gray-900">{c.name}</div>
                                <div className="text-[10px] text-gray-500">
                                  {c.phone} {c.village && `\u2022 ${c.village}`}
                                </div>
                              </div>
                              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                Due: ₹{c.outstandingCredit.toFixed(2)}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : customerSearch.length >= 2 ? (
                        <div className="p-2 text-center text-xs text-gray-400">
                          No registered customer found. Click &quot;+ New&quot; above to register.
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-500 italic p-1">
                      Cash/UPI billing without credit ledger tracking.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Financial Totals Card */}
              <Card className="border-gray-200 shadow-sm bg-gradient-to-b from-white to-gray-50/50">
                <CardHeader className="pb-3 border-b border-gray-100">
                  <CardTitle className="text-sm font-semibold text-gray-800">
                    Bill Calculation
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-2 text-xs">
                  <div className="flex justify-between text-gray-600">
                    <span>Items Subtotal:</span>
                    <span className="font-semibold text-gray-900">₹{subtotal.toFixed(2)}</span>
                  </div>
                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Item Discounts:</span>
                      <span className="font-semibold">-₹{totalDiscount.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-600">
                    <span>Taxable Amount:</span>
                    <span className="font-semibold text-gray-900">₹{taxableAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Total GST (CGST + SGST):</span>
                    <span className="font-semibold text-gray-900">₹{totalGst.toFixed(2)}</span>
                  </div>

                  {/* Overall Bill Discount & Round-off Controls */}
                  <div className="pt-2 border-t border-gray-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Bill Discount (₹):</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={invoiceDiscount}
                        onChange={(e) => setInvoiceDiscount(parseFloat(e.target.value) || 0)}
                        className="w-20 text-right text-xs font-semibold border border-gray-200 rounded px-1.5 py-0.5"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Round Off (₹):</span>
                      <input
                        type="number"
                        step="0.01"
                        value={roundOff}
                        onChange={(e) => setRoundOff(parseFloat(e.target.value) || 0)}
                        className="w-20 text-right text-xs font-semibold border border-gray-200 rounded px-1.5 py-0.5"
                      />
                    </div>
                  </div>

                  {/* Highlighted Grand Total */}
                  <div className="pt-3 border-t-2 border-gray-200 flex items-center justify-between">
                    <span className="font-bold text-sm text-gray-900">Grand Total:</span>
                    <span className="text-lg font-black text-emerald-800">
                      ₹{calculatedGrandTotal.toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Settlement Card */}
              <Card className="border-gray-200 shadow-sm">
                <CardHeader className="pb-3 border-b border-gray-100">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-gray-800">
                    <CreditCard className="w-4 h-4 text-emerald-600" />
                    Payment Settlement
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  {/* Payment Method Pills */}
                  <div className="grid grid-cols-4 gap-1 bg-gray-100 p-1 rounded-lg text-center text-xs">
                    <button
                      type="button"
                      onClick={() => setPaymentMode("CASH")}
                      className={`py-1.5 font-bold rounded-md transition-all ${
                        paymentMode === "CASH"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMode("UPI")}
                      className={`py-1.5 font-bold rounded-md transition-all ${
                        paymentMode === "UPI"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      UPI
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (isWalkIn && !selectedCustomer) {
                          setPosError("Select a registered farmer before issuing Credit bills");
                          return;
                        }
                        setPaymentMode("CREDIT");
                      }}
                      className={`py-1.5 font-bold rounded-md transition-all ${
                        paymentMode === "CREDIT"
                          ? "bg-amber-600 text-white shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      Credit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMode("SPLIT");
                        setSplitCash(calculatedGrandTotal);
                        setSplitUpi(0);
                        setSplitCredit(0);
                      }}
                      className={`py-1.5 font-bold rounded-md transition-all ${
                        paymentMode === "SPLIT"
                          ? "bg-indigo-600 text-white shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      Split
                    </button>
                  </div>

                  {/* Payment Breakdown Inputs */}
                  <div className="space-y-2 pt-1 text-xs">
                    {(paymentMode === "CASH" || paymentMode === "SPLIT") && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-gray-700 font-medium">
                          <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                          Cash Amount:
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={cashAmount}
                          disabled={paymentMode === "CASH"}
                          onChange={(e) => setSplitCash(parseFloat(e.target.value) || 0)}
                          className="w-24 text-right text-xs font-semibold border border-gray-200 rounded px-1.5 py-1 bg-white"
                        />
                      </div>
                    )}

                    {(paymentMode === "UPI" || paymentMode === "SPLIT") && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-gray-700 font-medium">
                            <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
                            UPI Amount:
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={upiAmount}
                            disabled={paymentMode === "UPI"}
                            onChange={(e) => setSplitUpi(parseFloat(e.target.value) || 0)}
                            className="w-24 text-right text-xs font-semibold border border-gray-200 rounded px-1.5 py-1 bg-white"
                          />
                        </div>
                        <input
                          type="text"
                          value={upiReference}
                          onChange={(e) => setUpiReference(e.target.value)}
                          placeholder="UPI Reference / UTR (Optional)"
                          className="w-full text-xs border border-gray-200 rounded px-2 py-1 placeholder:text-gray-400"
                        />
                      </div>
                    )}

                    {(paymentMode === "CREDIT" || paymentMode === "SPLIT") && (
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-amber-800 font-medium">
                          <BookOpenText className="w-3.5 h-3.5 text-amber-600" />
                          Credit (Khata):
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={creditAmount}
                          disabled={paymentMode === "CREDIT"}
                          onChange={(e) => {
                            if (isWalkIn && !selectedCustomer) {
                              setPosError("Customer selection required for credit");
                              return;
                            }
                            setSplitCredit(parseFloat(e.target.value) || 0);
                          }}
                          className="w-24 text-right text-xs font-semibold border border-gray-200 rounded px-1.5 py-1 bg-white"
                        />
                      </div>
                    )}
                  </div>

                  {/* Live Settlement Balance Badge */}
                  <div
                    className={`p-2 rounded-lg text-xs font-semibold flex items-center justify-between ${
                      isPaymentBalanced
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-red-50 text-red-800 border border-red-200"
                    }`}
                  >
                    <span>Allocated: ₹{allocatedPaymentSum.toFixed(2)}</span>
                    <span>
                      {isPaymentBalanced
                        ? "✓ Fully Balanced"
                        : paymentRemaining > 0
                        ? `₹${paymentRemaining.toFixed(2)} Remaining`
                        : `₹${Math.abs(paymentRemaining).toFixed(2)} Over`}
                    </span>
                  </div>

                  {/* Validation Error Message */}
                  {posError && (
                    <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-1.5">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <span>{posError}</span>
                    </div>
                  )}

                  {/* Big Checkout Action Button */}
                  <Button
                    type="button"
                    onClick={handleCompleteSale}
                    disabled={submitting || cart.length === 0 || !isPaymentBalanced}
                    className="w-full py-2.5 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating Bill...
                      </>
                    ) : (
                      <>
                        <Receipt className="w-4 h-4" />
                        Complete Sale & Issue Bill
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: INVOICES & SALES REGISTER */}
      {/* ========================================================================= */}
      {activeTab === "history" && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                {/* Search */}
                <div className="relative md:col-span-2">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                  <Input
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Search by Invoice #, Customer or Phone..."
                    className="pl-9 text-xs"
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-700"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>

                {/* Payment Method Filter */}
                <select
                  value={paymentMethodFilter}
                  onChange={(e) => {
                    setPaymentMethodFilter(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="text-xs border border-gray-200 rounded-md px-2 py-1.5 bg-white text-gray-700"
                >
                  <option value="ALL">All Payment Methods</option>
                  <option value="CASH">Cash Only</option>
                  <option value="UPI">UPI Digital</option>
                  <option value="CREDIT">Khata Credit</option>
                  <option value="SPLIT">Split Payments</option>
                </select>

                {/* Refresh Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={fetchSalesHistory}
                  disabled={loadingSales}
                  className="text-xs text-gray-700"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loadingSales ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
              </div>

              {/* Date Filters */}
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100 text-xs">
                <span className="text-gray-500 font-medium flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  Date Range:
                </span>
                <input
                  type="date"
                  value={fromDateFilter}
                  onChange={(e) => {
                    setFromDateFilter(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="border border-gray-200 rounded px-2 py-1 text-xs"
                />
                <span className="text-gray-400">to</span>
                <input
                  type="date"
                  value={toDateFilter}
                  onChange={(e) => {
                    setToDateFilter(e.target.value);
                    setHistoryPage(1);
                  }}
                  className="border border-gray-200 rounded px-2 py-1 text-xs"
                />
                {(fromDateFilter || toDateFilter || historySearch || statusFilter !== "ALL" || paymentMethodFilter !== "ALL") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFromDateFilter("");
                      setToDateFilter("");
                      setHistorySearch("");
                      setStatusFilter("ALL");
                      setPaymentMethodFilter("ALL");
                      setHistoryPage(1);
                    }}
                    className="text-xs text-red-600 hover:text-red-700 h-7 px-2"
                  >
                    Reset Filters
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Sales Register Table */}
          <Card className="border-gray-200 shadow-sm">
            <CardHeader className="pb-3 border-b border-gray-100 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold text-gray-800">
                Invoices History ({totalSalesCount})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingSales ? (
                <div className="py-16 text-center text-gray-400 space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto text-emerald-600" />
                  <p className="text-xs">Loading sales register...</p>
                </div>
              ) : sales.length === 0 ? (
                <div className="py-16 text-center text-gray-400 space-y-2">
                  <Receipt className="w-10 h-10 mx-auto text-gray-300 stroke-[1.5]" />
                  <p className="text-sm font-medium text-gray-500">No invoices found</p>
                  <p className="text-xs text-gray-400">Try adjusting your search terms or filters</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/70 text-[11px] text-gray-600">
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Date & Time</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-center">Items</TableHead>
                        <TableHead className="text-right">Grand Total</TableHead>
                        <TableHead>Payment Mode</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.map((sale) => {
                        const isCancelled = sale.status === "CANCELLED";
                        return (
                          <TableRow key={sale._id} className="hover:bg-gray-50/50 text-xs">
                            <TableCell className="font-bold text-emerald-900">
                              <Link
                                href={`/billing/${sale._id}`}
                                className="hover:underline flex items-center gap-1"
                              >
                                {sale.invoiceNumber}
                              </Link>
                            </TableCell>
                            <TableCell className="text-gray-600">
                              {new Date(sale.invoiceDate).toLocaleDateString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })}{" "}
                              <span className="text-[10px] text-gray-400">
                                {new Date(sale.invoiceDate).toLocaleTimeString("en-IN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </TableCell>
                            <TableCell>
                              <div className="font-semibold text-gray-900">
                                {sale.customerSnapshot?.name || "Walk-in Customer"}
                              </div>
                              {sale.customerSnapshot?.phone && (
                                <div className="text-[10px] text-gray-500">
                                  {sale.customerSnapshot.phone}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-center text-gray-700">
                              {sale.items.length}
                            </TableCell>
                            <TableCell className="text-right font-bold text-gray-900">
                              ₹{sale.grandTotal.toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                  sale.payment.method === "CASH"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : sale.payment.method === "UPI"
                                    ? "bg-indigo-100 text-indigo-800"
                                    : sale.payment.method === "CREDIT"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-purple-100 text-purple-800"
                                }`}
                              >
                                {sale.payment.method}
                              </span>
                              {sale.payment.creditAmount > 0 && (
                                <div className="text-[10px] text-amber-700 font-medium mt-0.5">
                                  Credit: ₹{sale.payment.creditAmount.toFixed(2)}
                                </div>
                              )}
                            </TableCell>
                            <TableCell>
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                  isCancelled
                                    ? "bg-red-100 text-red-800"
                                    : "bg-emerald-100 text-emerald-800"
                                }`}
                              >
                                {sale.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-right space-x-1">
                              <Link
                                href={`/billing/${sale._id}`}
                                className="inline-flex items-center px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 rounded"
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                View
                              </Link>
                              {!isCancelled && (
                                <button
                                  type="button"
                                  onClick={() => setSaleToCancel(sale)}
                                  className="inline-flex items-center px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 rounded"
                                >
                                  <Ban className="w-3 h-3 mr-1" />
                                  Cancel
                                </button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between p-3 border-t border-gray-100 text-xs">
                  <span className="text-gray-500">
                    Page {historyPage} of {totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={historyPage <= 1}
                      onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      className="text-xs h-7 px-2"
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={historyPage >= totalPages}
                      onClick={() => setHistoryPage((p) => p + 1)}
                      className="text-xs h-7 px-2"
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: DAILY SALES ANALYTICS & KPIS */}
      {/* ========================================================================= */}
      {activeTab === "analytics" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Card 1: Today's Total Sales */}
            <Card className="border-gray-200 shadow-sm bg-gradient-to-br from-emerald-50 to-white">
              <CardContent className="p-5 space-y-1">
                <div className="flex items-center justify-between text-emerald-800">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Today&apos;s Gross Sales
                  </span>
                  <Receipt className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-emerald-950">
                  ₹{dashboardKPIs?.todaySalesAmount.toFixed(2) || "0.00"}
                </div>
                <div className="text-xs text-emerald-700 font-medium">
                  {dashboardKPIs?.todaySalesCount || 0} invoices issued today
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Cash Collected */}
            <Card className="border-gray-200 shadow-sm bg-gradient-to-br from-green-50 to-white">
              <CardContent className="p-5 space-y-1">
                <div className="flex items-center justify-between text-green-800">
                  <span className="text-xs font-bold uppercase tracking-wider">Cash Collected</span>
                  <Banknote className="w-5 h-5 text-green-600" />
                </div>
                <div className="text-2xl font-black text-green-950">
                  ₹{dashboardKPIs?.todayCashAmount.toFixed(2) || "0.00"}
                </div>
                <div className="text-xs text-green-700 font-medium">Drawer cash received</div>
              </CardContent>
            </Card>

            {/* Card 3: UPI Collected */}
            <Card className="border-gray-200 shadow-sm bg-gradient-to-br from-blue-50 to-white">
              <CardContent className="p-5 space-y-1">
                <div className="flex items-center justify-between text-blue-800">
                  <span className="text-xs font-bold uppercase tracking-wider">UPI Digital Paid</span>
                  <Smartphone className="w-5 h-5 text-blue-600" />
                </div>
                <div className="text-2xl font-black text-blue-950">
                  ₹{dashboardKPIs?.todayUpiAmount.toFixed(2) || "0.00"}
                </div>
                <div className="text-xs text-blue-700 font-medium">Instant bank settlement</div>
              </CardContent>
            </Card>

            {/* Card 4: New Credit Extended Today */}
            <Card className="border-gray-200 shadow-sm bg-gradient-to-br from-amber-50 to-white">
              <CardContent className="p-5 space-y-1">
                <div className="flex items-center justify-between text-amber-800">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Today&apos;s Credit Given
                  </span>
                  <BookOpenText className="w-5 h-5 text-amber-600" />
                </div>
                <div className="text-2xl font-black text-amber-950">
                  ₹{dashboardKPIs?.todayCreditAmount.toFixed(2) || "0.00"}
                </div>
                <div className="text-xs text-amber-700 font-medium">Added to farmer khata</div>
              </CardContent>
            </Card>

            {/* Card 5: Total Shop Outstanding Credit */}
            <Card className="border-gray-200 shadow-sm bg-gradient-to-br from-red-50 to-white">
              <CardContent className="p-5 space-y-1">
                <div className="flex items-center justify-between text-red-800">
                  <span className="text-xs font-bold uppercase tracking-wider">
                    Total Customer Credit Due
                  </span>
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div className="text-2xl font-black text-red-950">
                  ₹{dashboardKPIs?.totalOutstandingCredit.toFixed(2) || "0.00"}
                </div>
                <div className="text-xs text-red-700 font-medium">Total outstanding across all farmers</div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Quick Customer Dialog */}
      <QuickCustomerDialog
        open={showQuickCustomerModal}
        onClose={() => setShowQuickCustomerModal(false)}
        onCustomerCreated={(cust) => {
          setSelectedCustomer(cust);
          setIsWalkIn(false);
        }}
      />

      {/* Cancellation Dialog */}
      {saleToCancel && (
        <CancelSaleDialog
          open={Boolean(saleToCancel)}
          invoiceNumber={saleToCancel.invoiceNumber}
          grandTotal={saleToCancel.grandTotal}
          creditAmount={saleToCancel.payment.creditAmount}
          onClose={() => setSaleToCancel(null)}
          onConfirm={handleConfirmCancel}
        />
      )}
    </div>
  );
}
