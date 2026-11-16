"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Boxes,
  Users,
  Receipt,
  Truck,
  BookOpenText,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Sprout,
  ShieldCheck,
  Building2,
  UserCheck,
  Tag,
  Package,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeVariant?: "agri" | "warning" | "neutral";
}

export const NAV_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Products & Catalog",
    href: "/products",
    icon: Package,
  },
  {
    title: "Categories",
    href: "/categories",
    icon: Tag,
  },
  {
    title: "Inventory Overview",
    href: "/inventory",
    icon: Boxes,
  },
  {
    title: "Farmer Accounts",
    href: "/farmers",
    icon: Users,
  },
  {
    title: "Billing & Invoicing",
    href: "/billing",
    icon: Receipt,
  },
  {
    title: "Suppliers",
    href: "/suppliers",
    icon: Truck,
  },
  {
    title: "Purchase Register",
    href: "/purchases",
    icon: ClipboardList,
  },
  {
    title: "Credit Ledger (Khata)",
    href: "/ledger",
    icon: BookOpenText,
    badge: "Due Alert",
    badgeVariant: "warning",
  },
  {
    title: "Employee Staff",
    href: "/employees",
    icon: UserCheck,
    badge: "RBAC",
    badgeVariant: "agri",
  },
  {
    title: "Reports & GST",
    href: "/reports",
    icon: BarChart3,
  },
  {
    title: "System Settings",
    href: "/settings",
    icon: Settings,
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  className?: string;
}

export function Sidebar({ collapsed, onToggleCollapse, className }: SidebarProps) {
  const pathname = usePathname();

  return (
    <motion.aside
      animate={{ width: collapsed ? 80 : 280 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden lg:flex flex-col h-screen h-[100dvh] border-r border-slate-200/90 bg-white select-none shrink-0 overflow-hidden shadow-xs",
        className
      )}
    >
      {/* Brand Header */}
      <div className="flex h-16 shrink-0 items-center px-4 border-b border-slate-100 justify-between">
        <Link
          href="/"
          className="flex items-center gap-3 overflow-hidden text-left focus-visible:outline-none"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#176B3A] to-[#2E9D59] text-white shadow-md shadow-[#176B3A]/20">
            <Sprout className="h-5 w-5" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="flex flex-col whitespace-nowrap overflow-hidden"
              >
                <span className="text-sm font-bold tracking-tight text-slate-900 leading-tight">
                  KASI Agri Agencies
                </span>
                <span className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
                  <span className="text-[#176B3A] font-semibold">Prop.</span> R. Balamurugan
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Link>
      </div>

      {/* Agency Sub-info badge */}
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-2 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-600"
          >
            <div className="flex items-center gap-1.5 truncate">
              <Building2 className="h-3 w-3 text-[#176B3A] shrink-0" />
              <span className="truncate font-medium">Fertilizers • Seeds • Pesticides</span>
            </div>
            <span className="text-[10px] text-emerald-700 bg-emerald-100/70 px-1.5 py-0.5 rounded font-mono font-medium shrink-0">
              Active
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Items */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 overscroll-contain">
        <div className={cn("px-3 pb-2 text-[11px] font-semibold tracking-wider uppercase text-slate-400", collapsed && "text-center")}>
          {collapsed ? "•••" : "Menu"}
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.title : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#176B3A]",
                isActive
                  ? "bg-[#EAF5EE] text-[#176B3A] shadow-xs font-semibold"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              {/* Active Bar indicator */}
              {isActive && (
                <motion.div
                  layoutId="activeNavIndicator"
                  className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#176B3A]"
                />
              )}

              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  isActive
                    ? "text-[#176B3A]"
                    : "text-slate-400 group-hover:text-slate-700"
                )}
              />

              {!collapsed && (
                <div className="flex flex-1 items-center justify-between overflow-hidden">
                  <span className="truncate">{item.title}</span>
                  {item.badge && (
                    <Badge
                      variant={item.badgeVariant || "agri"}
                      size="sm"
                      className="ml-auto text-[10px]"
                    >
                      {item.badge}
                    </Badge>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* Footer / Collapse Toggle */}
      <div className="shrink-0 border-t border-slate-100 p-3 bg-white">
        {!collapsed && (
          <div className="mb-3 rounded-lg bg-emerald-50/60 p-2.5 text-[11px] text-emerald-900 border border-emerald-100/60">
            <div className="flex items-center gap-1.5 font-semibold text-[#176B3A]">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>TN Agri Licence Verified</span>
            </div>
            <p className="mt-0.5 text-[10px] text-emerald-700">
              KASI-AGRI-2026-GSTN33
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={onToggleCollapse}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg p-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400",
            collapsed ? "justify-center" : "justify-between"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {!collapsed && <span>Collapse Sidebar</span>}
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
    </motion.aside>
  );
}
