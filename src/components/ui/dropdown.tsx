"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export interface DropdownItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export interface DropdownProps {
  trigger: React.ReactNode;
  items: (DropdownItem | "divider")[];
  align?: "left" | "right";
  className?: string;
}

export function Dropdown({
  trigger,
  items,
  align = "right",
  className,
}: DropdownProps) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <div onClick={() => setOpen(!open)} className="cursor-pointer">
        {trigger}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className={cn(
              "absolute z-40 mt-1.5 w-56 rounded-xl border border-slate-200/90 bg-white py-1.5 shadow-xl focus:outline-none",
              align === "right" ? "right-0" : "left-0",
              className
            )}
          >
            {items.map((item, idx) => {
              if (item === "divider") {
                return (
                  <div
                    key={`div-${idx}`}
                    className="my-1 border-t border-slate-100"
                  />
                );
              }

              return (
                <button
                  key={item.id}
                  disabled={item.disabled}
                  onClick={() => {
                    if (!item.disabled && item.onClick) {
                      item.onClick();
                    }
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between px-3.5 py-2 text-xs font-medium transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed",
                    item.destructive
                      ? "text-rose-600 hover:bg-rose-50"
                      : "text-slate-700 hover:text-slate-900"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {item.icon && (
                      <span className="shrink-0 text-slate-400 group-hover:text-slate-600">
                        {item.icon}
                      </span>
                    )}
                    <span>{item.label}</span>
                  </div>
                  {item.badge}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

