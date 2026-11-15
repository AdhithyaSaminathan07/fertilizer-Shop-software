"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Eye,
  RefreshCw,
  Boxes,
  ArrowUpRight,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { IProduct, ICategory } from "@/types/product";

export default function ProductsPage() {
  const [products, setProducts] = useState<IProduct[]>([]);
  const [categories, setCategories] = useState<ICategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [stockFilter, setStockFilter] = useState("ALL");
  const [refreshIndex, setRefreshIndex] = useState(0);

  // Load categories for filter dropdown
  useEffect(() => {
    fetch("/api/categories", { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.data?.categories) {
          setCategories(data.data.categories);
        }
      })
      .catch(() => {});
  }, []);

  // Load products
  useEffect(() => {
    let isMounted = true;
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (selectedCategory !== "ALL") params.set("categoryId", selectedCategory);
    if (stockFilter !== "ALL") params.set("stockStatus", stockFilter);

    fetch(`/api/products?${params.toString()}`, { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data) => {
        if (isMounted) {
          if (data.success && data.data?.items) {
            setProducts(data.data.items);
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
  }, [search, selectedCategory, stockFilter, refreshIndex]);

  const activeProducts = products.filter((p) => p.status === "ACTIVE").length;
  const outOfStockCount = products.filter((p) => p.stockStatus === "OUT_OF_STOCK").length;
  const lowStockCount = products.filter((p) => p.stockStatus === "LOW_STOCK").length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Package className="w-6 h-6 text-[#176B3A]" />
            Products & Inventory Catalog
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Fertilizers, seeds, agrochemicals, pesticides, and tools with configurable unit conversions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRefreshIndex((p) => p + 1)}
            disabled={loading}
            className="min-h-[40px] sm:min-h-[36px] flex-1 sm:flex-initial"
          >
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Link href="/products/new" className="flex-1 sm:flex-initial">
            <Button size="sm" className="bg-[#176B3A] hover:bg-[#12542D] text-white w-full min-h-[40px] sm:min-h-[36px]">
              <Plus className="w-4 h-4 mr-1.5" />
              Add New Product
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-[#EBF5EE] text-[#176B3A] flex items-center justify-center">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Products</p>
              <p className="text-xl font-bold text-slate-900">{products.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Items</p>
              <p className="text-xl font-bold text-emerald-700">{activeProducts}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Low Stock Alerts</p>
              <p className="text-xl font-bold text-amber-700">{lowStockCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-xs">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Out of Stock</p>
              <p className="text-xl font-bold text-rose-700">{outOfStockCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Table Card */}
      <Card className="border-slate-200 shadow-xs">
        <CardHeader className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Search name, SKU, brand..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            {/* Category Dropdown Filter */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="text-sm border border-slate-300 rounded-md px-3 h-9 bg-white text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#176B3A]"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Status Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            <button
              type="button"
              onClick={() => setStockFilter("ALL")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                stockFilter === "ALL"
                  ? "bg-[#176B3A] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStockFilter("IN_STOCK")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                stockFilter === "IN_STOCK"
                  ? "bg-emerald-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              In Stock
            </button>
            <button
              type="button"
              onClick={() => setStockFilter("OUT_OF_STOCK")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                stockFilter === "OUT_OF_STOCK"
                  ? "bg-rose-700 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Zero Stock
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#176B3A] mb-2" />
              Loading products...
            </div>
          ) : products.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Package className="w-8 h-8" />}
                title="No products registered"
                description={
                  search || selectedCategory !== "ALL" || stockFilter !== "ALL"
                    ? "No products matching your search filters."
                    : "Add your first fertilizer, seed or pesticide product to the inventory catalog."
                }
                action={
                  <Link href="/products/new">
                    <Button size="sm" className="bg-[#176B3A] text-white">
                      <Plus className="w-4 h-4 mr-1" />
                      Add First Product
                    </Button>
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-700">Product & Brand</TableHead>
                    <TableHead className="font-semibold text-slate-700">SKU / Code</TableHead>
                    <TableHead className="font-semibold text-slate-700">Category</TableHead>
                    <TableHead className="font-semibold text-slate-700">Unit & Ratio</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right">Pricing (₹)</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right">Margin</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-center">Stock Status</TableHead>
                    <TableHead className="text-right font-semibold text-slate-700">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((p) => {
                    const isSubsidized = (p.margin || 0) < 0;
                    return (
                      <TableRow key={p._id} className="border-b border-slate-100 hover:bg-slate-50/60">
                        <TableCell className="py-3.5">
                          <div className="font-semibold text-slate-900">{p.name}</div>
                          <div className="text-xs text-slate-500 font-medium">{p.brand}</div>
                        </TableCell>
                        <TableCell className="py-3.5 font-mono text-xs text-slate-700">
                          <div>{p.sku}</div>
                          {p.barcode && <div className="text-slate-400">{p.barcode}</div>}
                        </TableCell>
                        <TableCell className="py-3.5">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                            {p.category?.name || "Uncategorized"}
                          </span>
                        </TableCell>
                        <TableCell className="py-3.5 text-xs text-slate-600">
                          <span className="font-semibold text-slate-800">{p.primaryUnit}</span>
                          {p.unitConversion?.enabled && (
                            <span className="block text-slate-400 font-mono mt-0.5">
                              (1 {p.primaryUnit} = {p.unitConversion.conversionRatio} {p.unitConversion.baseUnit})
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="py-3.5 text-right text-xs">
                          <div className="font-semibold text-slate-900">₹{p.sellingPrice.toFixed(2)}</div>
                          <div className="text-slate-400">Buy: ₹{p.purchasePrice.toFixed(2)}</div>
                        </TableCell>
                        <TableCell className="py-3.5 text-right text-xs">
                          {isSubsidized ? (
                            <span className="inline-flex items-center text-rose-600 font-semibold gap-0.5">
                              <TrendingDown className="w-3 h-3" />
                              -₹{Math.abs(p.margin || 0).toFixed(2)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-emerald-700 font-semibold gap-0.5">
                              <TrendingUp className="w-3 h-3" />
                              +₹{(p.margin || 0).toFixed(2)}
                            </span>
                          )}
                          <div className="text-slate-400 text-[10px]">
                            {p.marginPercent ? `${p.marginPercent.toFixed(1)}%` : "0%"}
                          </div>
                        </TableCell>
                        <TableCell className="py-3.5 text-center">
                          {p.stockStatus === "OUT_OF_STOCK" ? (
                            <Badge variant="neutral" className="bg-slate-100 text-slate-600 text-xs">
                              0 {p.primaryUnit} (Inward Pending)
                            </Badge>
                          ) : p.stockStatus === "LOW_STOCK" ? (
                            <Badge variant="warning" className="text-xs">
                              Low: {p.currentStock} {p.primaryUnit}
                            </Badge>
                          ) : (
                            <Badge variant="agri" className="text-xs">
                              {p.currentStock} {p.primaryUnit}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="py-3.5 text-right">
                          <Link href={`/products/${p._id}`}>
                            <Button variant="ghost" size="sm" className="h-8 text-[#176B3A] hover:bg-[#EBF5EE]">
                              <Eye className="w-4 h-4 mr-1" />
                              View
                            </Button>
                          </Link>
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
  );
}
