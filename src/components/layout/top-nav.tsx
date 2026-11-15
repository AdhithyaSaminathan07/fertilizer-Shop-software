"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Menu,
  Search,
  Bell,
  Plus,
  HelpCircle,
  User,
  Settings,
  LogOut,
  Calendar,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dropdown } from "@/components/ui/dropdown";
import type { SafeUser } from "@/types/auth";

interface TopNavProps {
  onOpenMobileDrawer: () => void;
  onOpenQuickBillModal: () => void;
  className?: string;
}

export function TopNav({
  onOpenMobileDrawer,
  onOpenQuickBillModal,
}: TopNavProps) {
  const router = useRouter();
  const [dbStatus, setDbStatus] = React.useState<"healthy" | "connecting" | "offline">("healthy");
  const [currentUser, setCurrentUser] = React.useState<SafeUser | null>(null);

  React.useEffect(() => {
    // Check real health check endpoint from Phase 1
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data?.data?.status === "healthy") {
          setDbStatus("healthy");
        } else {
          setDbStatus("connecting");
        }
      })
      .catch(() => {
        setDbStatus("offline");
      });

    // Check current authenticated user session
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data?.data?.user) {
          setCurrentUser(data.data.user);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  };

  const userMenuItems = [
    {
      id: "profile",
      label: currentUser?.role === "OWNER" ? "Proprietor Profile" : "Employee Profile",
      icon: <User className="h-4 w-4" />,
      onClick: () => router.push("/employees"),
    },
    {
      id: "employees",
      label: "Employee Staff & RBAC",
      icon: <Shield className="h-4 w-4" />,
      onClick: () => router.push("/employees"),
    },
    {
      id: "settings",
      label: "Shop & GST Settings",
      icon: <Settings className="h-4 w-4" />,
      onClick: () => {},
    },
    {
      id: "help",
      label: "Support & Help",
      icon: <HelpCircle className="h-4 w-4" />,
      onClick: () => {},
    },
    "divider" as const,
    {
      id: "logout",
      label: "Sign Out",
      icon: <LogOut className="h-4 w-4" />,
      destructive: true,
      onClick: handleLogout,
    },
  ];

  const notificationItems = [
    {
      id: "notif-1",
      label: "Urea 50kg stock low (14 bags remaining)",
      badge: <Badge variant="warning" size="sm">Low Stock</Badge>,
      onClick: () => {},
    },
    {
      id: "notif-2",
      label: "Payment due from Farmer M. Senthil",
      badge: <Badge variant="danger" size="sm">Credit</Badge>,
      onClick: () => {},
    },
    {
      id: "notif-3",
      label: "System backup completed successfully",
      badge: <Badge variant="success" size="sm">OK</Badge>,
      onClick: () => {},
    },
  ];

  const initials = currentUser?.name
    ? currentUser.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "RB";

  return (
    <header className="sticky top-0 z-20 flex h-16 w-full shrink-0 items-center justify-between border-b border-slate-200/90 bg-white/95 px-4 backdrop-blur-md sm:px-6">
      {/* Left: Mobile trigger & Search */}
      <div className="flex items-center gap-3">
        {/* Mobile menu button */}
        <button
          type="button"
          onClick={onOpenMobileDrawer}
          className="inline-flex lg:hidden items-center justify-center rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Global Search Bar */}
        <div className="relative hidden sm:block w-64 md:w-80">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            placeholder="Search bills, farmers, stocks..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50/70 py-1.5 pl-9 pr-14 text-xs text-slate-800 placeholder:text-slate-400 transition-colors focus:border-[#176B3A] focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#176B3A]"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-2">
            <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 shadow-2xs">
              Ctrl K
            </kbd>
          </div>
        </div>
      </div>

      {/* Right: Actions, Badges & Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Season & Year Badge */}
        <div className="hidden md:flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1 text-xs text-slate-600 font-medium">
          <Calendar className="h-3.5 w-3.5 text-[#176B3A]" />
          <span>Rabi 2026-27</span>
        </div>

        {/* System & DB Status Pill */}
        <Badge
          variant={dbStatus === "healthy" ? "agri" : dbStatus === "connecting" ? "warning" : "danger"}
          size="sm"
          dot
          className="hidden xl:inline-flex"
        >
          {dbStatus === "healthy" ? "MongoDB Live" : dbStatus === "connecting" ? "Connecting" : "Offline"}
        </Badge>

        {/* Quick New Bill Button */}
        <Button
          onClick={onOpenQuickBillModal}
          size="sm"
          variant="primary"
          leftIcon={<Plus className="h-4 w-4" />}
          className="shadow-sm"
        >
          <span className="hidden sm:inline">New Bill</span>
          <span className="sm:hidden">Bill</span>
        </Button>

        {/* Notification Bell */}
        <Dropdown
          trigger={
            <button
              type="button"
              className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              aria-label="View notifications"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
            </button>
          }
          items={notificationItems}
        />

        {/* User Profile Menu */}
        <Dropdown
          trigger={
            <div className="flex items-center gap-2.5 pl-1.5 cursor-pointer">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-[#176B3A] to-[#2E9D59] text-xs font-bold text-white shadow-xs">
                {initials}
              </div>
              <div className="hidden lg:flex flex-col text-left">
                <span className="text-xs font-semibold text-slate-800 leading-tight">
                  {currentUser?.name || "R. Balamurugan"}
                </span>
                <span className="text-[10px] text-slate-500 leading-tight flex items-center gap-1">
                  <span>{currentUser?.role === "OWNER" ? "Proprietor" : "Staff"}</span>
                  {currentUser?.role === "OWNER" && (
                    <span className="text-emerald-700 font-bold">• Owner</span>
                  )}
                </span>
              </div>
            </div>
          }
          items={userMenuItems}
        />
      </div>
    </header>
  );
}
