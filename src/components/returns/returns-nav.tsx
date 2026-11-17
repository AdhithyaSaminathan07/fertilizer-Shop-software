"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Truck,
  PlusCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    label: "Returns Overview",
    href: "/returns",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Customer Sales Returns",
    href: "/returns/sales",
    icon: Receipt,
  },
  {
    label: "Supplier Purchase Returns",
    href: "/returns/purchases",
    icon: Truck,
  },
];

export function ReturnsNav() {
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

