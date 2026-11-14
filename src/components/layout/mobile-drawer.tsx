"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sprout, Building2, ShieldCheck } from "lucide-react";
import { NAV_ITEMS } from "./sidebar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const pathname = usePathname();

  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 260 }}
            className="fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-white shadow-2xl flex flex-col z-10"
          >
            {/* Header */}
            <div className="flex h-16 items-center justify-between px-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#176B3A] to-[#2E9D59] text-white shadow-md shadow-[#176B3A]/20">
                  <Sprout className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 leading-tight">
                    KASI Agri Agencies
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    <span className="text-[#176B3A] font-semibold">Prop.</span> R. Balamurugan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                aria-label="Close navigation menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mobile Tag */}
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
              <div className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-[#176B3A]" />
                <span>Fertilizers • Seeds • Pesticides</span>
              </div>
            </div>

            {/* Navigation links */}
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider uppercase text-slate-400">
                Main Navigation
              </div>
              {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      "flex items-center justify-between rounded-lg px-3.5 py-2.5 text-xs font-medium transition-colors",
                      isActive
                        ? "bg-[#EAF5EE] text-[#176B3A] font-semibold"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          isActive ? "text-[#176B3A]" : "text-slate-400"
                        )}
                      />
                      <span>{item.title}</span>
                    </div>
                    {item.badge && (
                      <Badge
                        variant={item.badgeVariant || "agri"}
                        size="sm"
                        className="text-[10px]"
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50">
              <div className="rounded-lg bg-emerald-50/80 p-3 text-xs text-emerald-900 border border-emerald-100">
                <div className="flex items-center gap-1.5 font-semibold text-[#176B3A]">
                  <ShieldCheck className="h-4 w-4" />
                  <span>TN Agri Retail Licence</span>
                </div>
                <p className="mt-1 text-[11px] text-emerald-700">
                  KASI-AGRI-2026-GSTN33
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

