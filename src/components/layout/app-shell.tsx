"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./sidebar";
import { TopNav } from "./top-nav";
import { MobileDrawer } from "./mobile-drawer";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Receipt, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
}

const AppShellContext = React.createContext<boolean>(false);

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isInsideAppShell = React.useContext(AppShellContext);
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = React.useState(false);
  const [quickBillOpen, setQuickBillOpen] = React.useState(false);

  // If already inside an AppShell (e.g. from RootLayout), do not render duplicate chrome
  if (isInsideAppShell) {
    return <>{children}</>;
  }

  // If on login page, render clean standalone view without app chrome
  if (pathname === "/login") {
    return <div className="h-full h-[100dvh] overflow-y-auto">{children}</div>;
  }

  return (
    <AppShellContext.Provider value={true}>
      <div className="relative flex h-screen h-[100dvh] w-full overflow-hidden bg-[#F7F9F6] text-slate-900 font-sans antialiased">
        {/* Desktop Fixed Sidebar */}
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />

        {/* Mobile Drawer */}
        <MobileDrawer
          open={mobileDrawerOpen}
          onClose={() => setMobileDrawerOpen(false)}
        />

        {/* Main Content Area with responsive desktop offset */}
        <div
          className={cn(
            "flex flex-1 flex-col h-full h-[100dvh] min-w-0 overflow-hidden transition-[padding-left] duration-200 ease-in-out",
            sidebarCollapsed ? "lg:pl-20" : "lg:pl-[280px]"
          )}
        >
          {/* Top Navigation - fixed at top */}
          <TopNav
            onOpenMobileDrawer={() => setMobileDrawerOpen(true)}
            onOpenQuickBillModal={() => setQuickBillOpen(true)}
          />

          {/* Page Content Container - scrolls independently */}
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 overscroll-contain min-w-0">
            <div className="mx-auto max-w-7xl w-full min-w-0">{children}</div>
          </main>
        </div>

      {/* Reusable Quick Bill Dialog Preview */}
      <Dialog
        open={quickBillOpen}
        onOpenChange={setQuickBillOpen}
        title={
          <div className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-[#176B3A]" />
            <span>Generate New Agri Bill</span>
            <Badge variant="warning" size="sm">Design Preview</Badge>
          </div>
        }
        description="Quick billing modal for counter sales of Fertilizers, Pesticides, and Certified Seeds."
        footer={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuickBillOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setQuickBillOpen(false)}
            >
              Save & Print Bill
            </Button>
          </>
        }
      >
        <div className="space-y-4 pt-1">
          <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200/60 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Phase 2 Design Prototype:</span> Full inventory item selection, tax calculations, and database persistence will be connected in Phase 4.
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Farmer / Customer Name" placeholder="e.g. M. Senthil Kumar" required />
            <Input label="Mobile Number" placeholder="e.g. 9842100000" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">Category</label>
              <select className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-[#176B3A] focus:outline-none focus:ring-1 focus:ring-[#176B3A]">
                <option>Fertilizer (Urea/DAP/Potash)</option>
                <option>Seeds (Paddy/Maize/Cotton)</option>
                <option>Pesticides & Nutrients</option>
              </select>
            </div>
            <Input label="Quantity (Bags/Ltr)" placeholder="e.g. 10" type="number" />
            <Input label="Price per Unit (₹)" placeholder="e.g. 268.00" type="number" />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700">Payment Type</label>
            <div className="flex gap-2">
              <label className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 p-2 text-xs font-medium cursor-pointer hover:bg-slate-50 bg-[#EAF5EE] text-[#176B3A] border-[#176B3A]/30">
                <input type="radio" name="paymentType" defaultChecked className="accent-[#176B3A]" />
                Cash
              </label>
              <label className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 p-2 text-xs font-medium cursor-pointer hover:bg-slate-50 text-slate-700">
                <input type="radio" name="paymentType" className="accent-[#176B3A]" />
                UPI / QR
              </label>
              <label className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 p-2 text-xs font-medium cursor-pointer hover:bg-slate-50 text-slate-700">
                <input type="radio" name="paymentType" className="accent-[#176B3A]" />
                Credit (Khata)
              </label>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
    </AppShellContext.Provider>
  );
}
