"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  AlertTriangle,
  ClockAlert,
  SlidersHorizontal,
  ClipboardCheck,
  TrendingUp,
  History,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    label: "Overview",
    href: "/inventory",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Low Stock & Reorders",
    href: "/inventory/low-stock",
    icon: AlertTriangle,
  },
  {
    label: "Batch Expiry",
    href: "/inventory/expiry",
    icon: ClockAlert,
  },
  {
    label: "Adjustments & Write-offs",
    href: "/inventory/adjustments",
    icon: SlidersHorizontal,
  },
  {
    label: "Stock Reconciliation",
    href: "/inventory/stock-count",
    icon: ClipboardCheck,
  },
  {
    label: "Valuation Report",
    href: "/inventory/valuation",
    icon: TrendingUp,
  },
  {
    label: "Movement History",
    href: "/inventory/movements",
    icon: History,
  },
];

export function InventoryNav() {
  const pathname = usePathname();

  return (
    <div className="flex border-b border-slate-200 overflow-x-auto no-scrollbar gap-1 mb-6">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = item.exact
          ? pathname === item.href
          : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors",
              isActive
                ? "border-emerald-600 text-emerald-700 font-semibold bg-emerald-50/50"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

