"use client";

import * as React from "react";
import {
  ClipboardCheck,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronRight,
  Save,
  Send,
  AlertTriangle,
} from "lucide-react";
import { InventoryNav } from "@/components/inventory/inventory-nav";
import { StockCountDialog } from "@/components/inventory/stock-count-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import type { IStockCountSession, IStockCountItem } from "@/types/inventory";

export default function StockCountPage() {
  const [sessions, setSessions] = React.useState<IStockCountSession[]>([]);
  const [activeSession, setActiveSession] = React.useState<IStockCountSession | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionMessage, setActionMessage] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [refreshTrigger, setRefreshTrigger] = React.useState(0);
  const [autoSelectSessionId, setAutoSelectSessionId] = React.useState<string | null>(null);

  // Editable items state for active session
  const [countedItems, setCountedItems] = React.useState<
    Array<{ productId: string; countedStock: number; notes?: string }>
  >([]);

  const selectSession = React.useCallback((sess: IStockCountSession) => {
    setActiveSession(sess);
    setCountedItems(
      sess.items.map((it) => ({
        productId: it.productId,
        countedStock: it.countedStock,
        notes: it.notes,
      }))
    );
    setActionMessage(null);
    setError(null);
  }, []);

  React.useEffect(() => {
    let ignore = false;
    async function loadSessions() {
      try {
        const res = await fetch("/api/inventory/stock-count");
        const json = await res.json();
        if (!ignore && res.ok) {
          const list = json.data?.sessions || [];
          setSessions(list);
          setError(null);

          if (autoSelectSessionId) {
            const found = list.find((s: IStockCountSession) => s._id === autoSelectSessionId);
            if (found) {
              selectSession(found);
            }
          } else if (list.length > 0 && !activeSession) {
            selectSession(list[0]);
          }
        } else if (!ignore) {
          setError(json.error?.message || json.message || "Failed to load count sessions");
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load count sessions");
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadSessions();
    return () => {
      ignore = true;
    };
  }, [refreshTrigger, autoSelectSessionId, selectSession, activeSession]);

  const handleCountChange = (productId: string, val: number) => {
    setCountedItems((prev) =>
      prev.map((item) => (item.productId === productId ? { ...item, countedStock: val } : item))
    );
  };

  const handleSaveDraft = async () => {
    if (!activeSession) return;
    setIsSaving(true);
    setError(null);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/inventory/stock-count/${activeSession._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: countedItems }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.message || "Failed to save count");
      }
      setActiveSession(data.data?.session);
      setActionMessage("Session draft counts saved successfully");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft counts");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSubmitForApproval = async () => {
    if (!activeSession) return;
    if (!confirm("Are you sure you want to submit this count session for manager approval?")) return;

    setIsSaving(true);
    setError(null);
    setActionMessage(null);

    try {
      // First save latest counts
      await fetch(`/api/inventory/stock-count/${activeSession._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: countedItems }),
      });

      // Then submit
      const res = await fetch(`/api/inventory/stock-count/${activeSession._id}/submit`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.message || "Failed to submit session");
      }
      setActiveSession(data.data?.session);
      setActionMessage("Session submitted for approval!");
      setAutoSelectSessionId(activeSession._id);
      setRefreshTrigger((p) => p + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit session");
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!activeSession) return;
    if (
      !confirm(
        "Approving will reconcile stock variances by automatically recording stock adjustments. Continue?"
      )
    )
      return;

    setIsSaving(true);
    setError(null);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/inventory/stock-count/${activeSession._id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "APPROVE", notes: "Count verified and approved by manager" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.message || "Approval failed");
      }
      setActiveSession(data.data?.session);
      setActionMessage("Session approved and inventory balances successfully reconciled!");
      setAutoSelectSessionId(activeSession._id);
      setRefreshTrigger((p) => p + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!activeSession) return;
    const reason = prompt("Enter rejection reason:");
    if (!reason || !reason.trim()) return;

    setIsSaving(true);
    setError(null);
    setActionMessage(null);

    try {
      const res = await fetch(`/api/inventory/stock-count/${activeSession._id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REJECT", notes: reason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.message || "Rejection failed");
      }
      setActiveSession(data.data?.session);
      setActionMessage("Count session rejected.");
      setAutoSelectSessionId(activeSession._id);
      setRefreshTrigger((p) => p + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rejection failed");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6 text-emerald-600" />
              Physical Stock Reconciliation
            </h1>
            <p className="text-sm text-slate-500">
              Audit warehouse stocks, record variances and reconcile system inventory atomically
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setLoading(true);
                setRefreshTrigger((p) => p + 1);
              }}
              disabled={loading}
              className="gap-1.5"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="h-4 w-4" />
              Start Count Session
            </Button>
          </div>
        </div>

        {/* Tab Subnavigation */}
        <InventoryNav />

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600 mt-0.5" />
            <div>{error}</div>
          </div>
        )}

        {actionMessage && (
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <div>{actionMessage}</div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Sessions List */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Reconciliation Sessions ({sessions.length})
            </h2>

            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : sessions.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No count sessions started yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {sessions.map((sess) => {
                  const isSelected = activeSession?._id === sess._id;
                  const isDraft = sess.status === "DRAFT";
                  const isSubmitted = sess.status === "SUBMITTED";
                  const isApproved = sess.status === "APPROVED";
                  const isRejected = sess.status === "REJECTED";

                  return (
                    <div
                      key={sess._id}
                      onClick={() => selectSession(sess)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? "border-emerald-600 bg-emerald-50/40 shadow-sm ring-1 ring-emerald-500"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-slate-900">
                          {sess.sessionNumber}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                            isDraft
                              ? "bg-slate-100 text-slate-700"
                              : isSubmitted
                              ? "bg-amber-100 text-amber-800"
                              : isApproved
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {sess.status}
                        </span>
                      </div>
                      <div className="font-medium text-slate-800 mt-1 truncate">{sess.title}</div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                        <span>{sess.items?.length || 0} Products</span>
                        <span>
                          {new Date(sess.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column: Active Session Details & Count Table */}
          <div className="lg:col-span-2 bg-white rounded-lg border border-slate-200 shadow-sm p-5 space-y-4">
            {!activeSession ? (
              <div className="py-16 text-center text-xs text-slate-500">
                Select a session from the left or create a new count session.
              </div>
            ) : (
              <>
                {/* Active Session Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-500">
                        {activeSession.sessionNumber}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          activeSession.status === "DRAFT"
                            ? "bg-slate-100 text-slate-700"
                            : activeSession.status === "SUBMITTED"
                            ? "bg-amber-100 text-amber-800"
                            : activeSession.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {activeSession.status}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mt-0.5">{activeSession.title}</h3>
                    {activeSession.notes && (
                      <p className="text-xs text-slate-600 mt-0.5">{activeSession.notes}</p>
                    )}
                  </div>

                  {/* Actions based on session status */}
                  <div className="flex items-center gap-2">
                    {activeSession.status === "DRAFT" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleSaveDraft}
                          disabled={isSaving}
                          className="gap-1 text-xs"
                        >
                          <Save className="h-3.5 w-3.5" />
                          Save Draft
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleSubmitForApproval}
                          disabled={isSaving}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 text-xs"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Submit Count
                        </Button>
                      </>
                    )}

                    {activeSession.status === "SUBMITTED" && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleReject}
                          disabled={isSaving}
                          className="border-rose-300 text-rose-700 hover:bg-rose-50 text-xs"
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleApprove}
                          disabled={isSaving}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          Approve & Reconcile
                        </Button>
                      </>
                    )}

                    {activeSession.status === "APPROVED" && (
                      <div className="text-right text-xs text-emerald-700 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Approved by {activeSession.approvedByName || "Manager"}
                      </div>
                    )}
                  </div>
                </div>

                {/* Items Audit Table */}
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <Table>
                    <TableHeader className="bg-slate-50/75">
                      <TableRow>
                        <TableHead className="w-56">Product & SKU</TableHead>
                        <TableHead className="w-28 text-right">System Baseline</TableHead>
                        <TableHead className="w-36 text-center">Physical Count</TableHead>
                        <TableHead className="w-28 text-right">Variance</TableHead>
                        <TableHead className="w-28 text-center">Audit Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeSession.items.map((item) => {
                        const countEntry = countedItems.find((c) => c.productId === item.productId);
                        const countedVal =
                          countEntry !== undefined ? countEntry.countedStock : item.countedStock;
                        const variance = Math.round((countedVal - item.systemStockAtStart) * 100) / 100;
                        const isMismatch = variance !== 0;

                        return (
                          <TableRow key={item.productId} className="hover:bg-slate-50/60 transition-colors">
                            <TableCell>
                              <div className="font-semibold text-slate-900 text-xs">
                                {item.productName}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {item.sku} • {item.categoryName}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-slate-700">
                              {item.systemStockAtStart} {item.unit}
                            </TableCell>
                            <TableCell className="text-center">
                              {activeSession.status === "DRAFT" ? (
                                <Input
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={countedVal}
                                  onChange={(e) =>
                                    handleCountChange(item.productId, parseFloat(e.target.value) || 0)
                                  }
                                  className="w-28 mx-auto text-xs text-center font-bold"
                                />
                              ) : (
                                <span className="font-bold text-xs text-slate-900">
                                  {countedVal} {item.unit}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <span
                                className={`font-mono text-xs font-bold ${
                                  variance > 0
                                    ? "text-emerald-700"
                                    : variance < 0
                                    ? "text-rose-600"
                                    : "text-slate-500"
                                }`}
                              >
                                {variance > 0 ? `+${variance}` : variance} {item.unit}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                  !isMismatch
                                    ? "bg-slate-100 text-slate-700"
                                    : variance > 0
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-rose-100 text-rose-800"
                                }`}
                              >
                                {isMismatch
                                  ? variance > 0
                                    ? "SURPLUS"
                                    : "SHORTAGE"
                                  : "MATCHED"}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Dialog for starting new count session */}
        <StockCountDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSuccess={(newId) => {
            setDialogOpen(false);
            setAutoSelectSessionId(newId);
            setLoading(true);
            setRefreshTrigger((p) => p + 1);
          }}
        />
      </div>
  );
}
