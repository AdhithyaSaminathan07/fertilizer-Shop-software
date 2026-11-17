import { connectDB } from "@/lib/db";
import { SalesReturn } from "@/models/sales-return";
import { PurchaseReturn } from "@/models/purchase-return";
import { round2 } from "@/services/purchase.service";
import type { IReturnsOverview, IReturnsReports } from "@/types/returns";

export async function getReturnsDashboardOverview(): Promise<IReturnsOverview> {
  await connectDB();

  const [
    salesReturns,
    purchaseReturns,
    recentSalesReturns,
    recentPurchaseReturns,
  ] = await Promise.all([
    SalesReturn.find().lean(),
    PurchaseReturn.find().lean(),
    SalesReturn.find().sort({ returnDate: -1, createdAt: -1 }).limit(5).lean(),
    PurchaseReturn.find().sort({ returnDate: -1, createdAt: -1 }).limit(5).lean(),
  ]);

  let totalSalesReturnsValue = 0;
  let totalPurchaseReturnsValue = 0;
  let pendingApprovalsCount = 0;
  let approvedReturnsCount = 0;

  salesReturns.forEach((sr: any) => {
    if (sr.status === "APPROVED") {
      totalSalesReturnsValue = round2(totalSalesReturnsValue + (sr.refundTotal || 0));
      approvedReturnsCount++;
    } else if (sr.status === "PENDING_APPROVAL") {
      pendingApprovalsCount++;
    }
  });

  purchaseReturns.forEach((pr: any) => {
    if (pr.status === "APPROVED") {
      totalPurchaseReturnsValue = round2(totalPurchaseReturnsValue + (pr.returnTotal || 0));
      approvedReturnsCount++;
    } else if (pr.status === "PENDING_APPROVAL") {
      pendingApprovalsCount++;
    }
  });

  return {
    totalSalesReturnsCount: salesReturns.length,
    totalSalesReturnsValue,
    totalPurchaseReturnsCount: purchaseReturns.length,
    totalPurchaseReturnsValue,
    pendingApprovalsCount,
    approvedReturnsCount,
    recentSalesReturns: recentSalesReturns.map((r: any) => ({
      ...r,
      id: r._id.toString(),
      _id: r._id.toString(),
      saleId: r.saleId?.toString(),
    })),
    recentPurchaseReturns: recentPurchaseReturns.map((r: any) => ({
      ...r,
      id: r._id.toString(),
      _id: r._id.toString(),
      purchaseId: r.purchaseId?.toString(),
    })),
  };
}

export async function getReturnsReports(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<IReturnsReports> {
  await connectDB();

  const query: any = {};
  if (params?.startDate || params?.endDate) {
    query.returnDate = {};
    if (params.startDate) query.returnDate.$gte = new Date(params.startDate);
    if (params.endDate) query.returnDate.$lte = new Date(params.endDate);
  }

  const [salesReturns, purchaseReturns] = await Promise.all([
    SalesReturn.find(query).lean(),
    PurchaseReturn.find(query).lean(),
  ]);

  // Aggregate Sales Returns
  let totalSalesRefund = 0;
  const salesByReasonMap = new Map<string, { count: number; amount: number }>();
  const salesByStatusMap = new Map<string, { count: number; amount: number }>();
  const salesByProductMap = new Map<
    string,
    { productId: string; productName: string; sku: string; quantity: number; amount: number }
  >();

  salesReturns.forEach((sr: any) => {
    const refund = round2(sr.refundTotal || 0);
    totalSalesRefund = round2(totalSalesRefund + refund);

    // Reason
    const r = sr.generalReason || "OTHER";
    const rEntry = salesByReasonMap.get(r) || { count: 0, amount: 0 };
    salesByReasonMap.set(r, {
      count: rEntry.count + 1,
      amount: round2(rEntry.amount + refund),
    });

    // Status
    const s = sr.status || "DRAFT";
    const sEntry = salesByStatusMap.get(s) || { count: 0, amount: 0 };
    salesByStatusMap.set(s, {
      count: sEntry.count + 1,
      amount: round2(sEntry.amount + refund),
    });

    // Items
    (sr.items || []).forEach((it: any) => {
      const pId = it.productId?.toString();
      const pEntry = salesByProductMap.get(pId) || {
        productId: pId,
        productName: it.productSnapshot?.name || "Product",
        sku: it.productSnapshot?.sku || "",
        quantity: 0,
        amount: 0,
      };
      salesByProductMap.set(pId, {
        ...pEntry,
        quantity: round2(pEntry.quantity + (it.returnQty || 0)),
        amount: round2(pEntry.amount + (it.lineTotal || 0)),
      });
    });
  });

  // Aggregate Purchase Returns
  let totalPurchaseValue = 0;
  const purchaseByReasonMap = new Map<string, { count: number; amount: number }>();
  const purchaseByStatusMap = new Map<string, { count: number; amount: number }>();
  const purchaseByProductMap = new Map<
    string,
    { productId: string; productName: string; sku: string; quantity: number; amount: number }
  >();

  purchaseReturns.forEach((pr: any) => {
    const val = round2(pr.returnTotal || 0);
    totalPurchaseValue = round2(totalPurchaseValue + val);

    // Reason
    const r = pr.generalReason || "OTHER";
    const rEntry = purchaseByReasonMap.get(r) || { count: 0, amount: 0 };
    purchaseByReasonMap.set(r, {
      count: rEntry.count + 1,
      amount: round2(rEntry.amount + val),
    });

    // Status
    const s = pr.status || "DRAFT";
    const sEntry = purchaseByStatusMap.get(s) || { count: 0, amount: 0 };
    purchaseByStatusMap.set(s, {
      count: sEntry.count + 1,
      amount: round2(sEntry.amount + val),
    });

    // Items
    (pr.items || []).forEach((it: any) => {
      const pId = it.productId?.toString();
      const pEntry = purchaseByProductMap.get(pId) || {
        productId: pId,
        productName: it.productSnapshot?.name || "Product",
        sku: it.productSnapshot?.sku || "",
        quantity: 0,
        amount: 0,
      };
      purchaseByProductMap.set(pId, {
        ...pEntry,
        quantity: round2(pEntry.quantity + (it.returnQty || 0)),
        amount: round2(pEntry.amount + (it.lineTotal || 0)),
      });
    });
  });

  return {
    salesReturns: {
      totalCount: salesReturns.length,
      totalRefundAmount: totalSalesRefund,
      byReason: Array.from(salesByReasonMap.entries()).map(([reason, d]) => ({
        reason,
        count: d.count,
        amount: d.amount,
      })),
      byStatus: Array.from(salesByStatusMap.entries()).map(([status, d]) => ({
        status,
        count: d.count,
        amount: d.amount,
      })),
      byProduct: Array.from(salesByProductMap.values()).sort((a, b) => b.amount - a.amount),
    },
    purchaseReturns: {
      totalCount: purchaseReturns.length,
      totalReturnValue: totalPurchaseValue,
      byReason: Array.from(purchaseByReasonMap.entries()).map(([reason, d]) => ({
        reason,
        count: d.count,
        amount: d.amount,
      })),
      byStatus: Array.from(purchaseByStatusMap.entries()).map(([status, d]) => ({
        status,
        count: d.count,
        amount: d.amount,
      })),
      byProduct: Array.from(purchaseByProductMap.values()).sort((a, b) => b.amount - a.amount),
    },
  };
}

