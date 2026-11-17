import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { CashbookOpeningBalance, ICashbookOpeningBalanceDocument } from "@/models/cashbook-opening-balance";
import { Sale } from "@/models/sale";
import { CustomerPayment } from "@/models/customer-payment";
import { SupplierPayment } from "@/models/supplier-payment";
import { Purchase } from "@/models/purchase";
import { Expense } from "@/models/expense";
import { Settings } from "@/models/settings";
import { AuditLog } from "@/models/audit-log";
import type { SafeUser } from "@/types/auth";
import type {
  CashbookPaymentMethod,
  CashbookTransactionType,
  CashbookModule,
  ICashbookEntry,
  ICashbookBalances,
  ICashbookSummary,
  ICashbookReport,
  IDashboardFinancials,
  ICashbookOpeningBalanceConfig,
} from "@/types/expense";
import { round2 } from "./expense.service";

const OPENING_CONFIG_KEY = "DEFAULT_CASHBOOK_OPENING";

/**
 * Normalizes payment methods from various modules into CashbookPaymentMethod.
 */
function normalizeMethod(method: string | undefined): CashbookPaymentMethod {
  if (!method) return "CASH";
  const upper = method.toUpperCase();
  if (upper === "UPI") return "UPI";
  if (upper === "BANK_TRANSFER" || upper === "BANK" || upper === "NEFT" || upper === "RTGS" || upper === "IMPS")
    return "BANK_TRANSFER";
  if (upper === "CHEQUE" || upper === "CHECK") return "CHEQUE";
  return "CASH";
}

/**
 * Fetch or initialize the singleton opening balance configuration.
 */
export async function getOpeningBalanceConfig(): Promise<ICashbookOpeningBalanceConfig> {
  await connectDB();

  let config = await CashbookOpeningBalance.findOne({ configKey: OPENING_CONFIG_KEY });
  if (!config) {
    // Determine financial year start date (default April 1st)
    const settings = await Settings.findOne({ settingsKey: "DEFAULT_SETTINGS" });
    const fyMonth = (settings?.preferences?.financialYearStartMonth || 4) - 1; // 0-indexed
    const now = new Date();
    const currentYear = now.getMonth() >= fyMonth ? now.getFullYear() : now.getFullYear() - 1;
    const effectiveDate = new Date(currentYear, fyMonth, 1);

    // Create default with a system/bootstrap user ID placeholder
    const systemUserId = new mongoose.Types.ObjectId("000000000000000000000000");
    config = await CashbookOpeningBalance.create({
      configKey: OPENING_CONFIG_KEY,
      effectiveDate,
      cash: 0,
      upi: 0,
      bank: 0,
      cheque: 0,
      notes: "Initial business opening balances",
      history: [],
      createdById: systemUserId,
      createdByName: "System",
    });
  }

  return {
    effectiveDate: config.effectiveDate.toISOString(),
    cash: round2(config.cash),
    upi: round2(config.upi),
    bank: round2(config.bank),
    cheque: round2(config.cheque),
    notes: config.notes || "",
    history: (config.history || []).map((h) => ({
      adjustedAt: h.adjustedAt.toISOString(),
      adjustedById: h.adjustedById.toString(),
      adjustedByName: h.adjustedByName,
      reason: h.reason,
      previousBalances: {
        cash: round2(h.previousBalances.cash),
        upi: round2(h.previousBalances.upi),
        bank: round2(h.previousBalances.bank),
        cheque: round2(h.previousBalances.cheque),
      },
      newBalances: {
        cash: round2(h.newBalances.cash),
        upi: round2(h.newBalances.upi),
        bank: round2(h.newBalances.bank),
        cheque: round2(h.newBalances.cheque),
      },
    })),
    createdById: config.createdById?.toString(),
    createdByName: config.createdByName,
    createdAt: config.createdAt?.toISOString(),
    updatedAt: config.updatedAt?.toISOString(),
  };
}

/**
 * Configure or adjust opening balances with mandatory audit tracking.
 */
export async function configureOpeningBalance(
  input: {
    effectiveDate?: string | Date;
    cash: number;
    upi: number;
    bank: number;
    cheque: number;
    notes?: string;
    reason?: string;
  },
  user: SafeUser
): Promise<ICashbookOpeningBalanceConfig> {
  await connectDB();

  let config = await CashbookOpeningBalance.findOne({ configKey: OPENING_CONFIG_KEY });

  const newCash = round2(Math.max(0, input.cash));
  const newUpi = round2(Math.max(0, input.upi));
  const newBank = round2(Math.max(0, input.bank));
  const newCheque = round2(Math.max(0, input.cheque));
  const effectiveDate = input.effectiveDate ? new Date(input.effectiveDate) : undefined;

  if (!config) {
    config = await CashbookOpeningBalance.create({
      configKey: OPENING_CONFIG_KEY,
      effectiveDate: effectiveDate || new Date(new Date().getFullYear(), 3, 1),
      cash: newCash,
      upi: newUpi,
      bank: newBank,
      cheque: newCheque,
      notes: input.notes?.trim() || "",
      history: [],
      createdById: new mongoose.Types.ObjectId(user.id),
      createdByName: user.name,
    });
  } else {
    const reason =
      input.reason?.trim() ||
      `Adjustment of opening balances by ${user.name}`;

    const prev = {
      cash: config.cash,
      upi: config.upi,
      bank: config.bank,
      cheque: config.cheque,
    };

    config.history.push({
      adjustedAt: new Date(),
      adjustedById: new mongoose.Types.ObjectId(user.id),
      adjustedByName: user.name,
      reason,
      previousBalances: prev,
      newBalances: { cash: newCash, upi: newUpi, bank: newBank, cheque: newCheque },
    });

    config.cash = newCash;
    config.upi = newUpi;
    config.bank = newBank;
    config.cheque = newCheque;
    if (effectiveDate) config.effectiveDate = effectiveDate;
    if (input.notes !== undefined) config.notes = input.notes.trim();

    await config.save();
  }

  await AuditLog.create({
    userId: new mongoose.Types.ObjectId(user.id),
    userName: user.name,
    action: "CASHBOOK_OPENING_BALANCE_CONFIGURED",
    details: {
      cash: newCash,
      upi: newUpi,
      bank: newBank,
      cheque: newCheque,
      effectiveDate: config.effectiveDate.toISOString(),
      reason: input.reason,
    },
    timestamp: new Date().toISOString(),
  });

  return getOpeningBalanceConfig();
}

/**
 * Unified Raw Cashbook Transaction representation derived directly from authoritative models.
 */
interface IRawTransaction {
  id: string;
  date: Date;
  reference: string;
  description: string;
  type: CashbookTransactionType;
  module: CashbookModule;
  sourceId: string;
  paymentMethod: CashbookPaymentMethod;
  inflow: number;
  outflow: number;
  recordedByName: string;
  notes?: string;
}

/**
 * Loads and harmonizes all financial transactions across all authoritative collections.
 */
async function loadAllAuthoritativeTransactions(): Promise<{
  transactions: IRawTransaction[];
  openingBase: { cash: number; upi: number; bank: number; cheque: number; effectiveDate: Date };
}> {
  await connectDB();

  const openingConfig = await getOpeningBalanceConfig();
  const effectiveDate = new Date(openingConfig.effectiveDate);

  const [sales, customerPayments, expenses, supplierPayments, purchases] = await Promise.all([
    // 1. Sales (exclude cancelled)
    Sale.find({
      status: "COMPLETED",
      invoiceDate: { $gte: effectiveDate },
    })
      .select("invoiceNumber invoiceDate customerSnapshot isWalkIn payment notes createdBy")
      .lean(),

    // 2. Customer Repayments (exclude reversed)
    CustomerPayment.find({
      status: "RECORDED",
      paymentDate: { $gte: effectiveDate },
    })
      .select("paymentNumber paymentDate customerSnapshot amount paymentMethod transactionReference notes createdByName")
      .lean(),

    // 3. Daily Expenses (exclude reversed)
    Expense.find({
      status: "RECORDED",
      expenseDate: { $gte: effectiveDate },
    })
      .select("expenseNumber expenseDate categoryName description amount paymentMethod paymentReference paidTo notes createdByName")
      .lean(),

    // 4. Supplier Payments (exclude reversed)
    SupplierPayment.find({
      status: "RECORDED",
      paymentDate: { $gte: effectiveDate },
    })
      .select("paymentNumber paymentDate supplierSnapshot amount paymentMethod paymentReference notes createdByName")
      .lean(),

    // 5. Purchases with upfront cash payments
    Purchase.find({
      amountPaid: { $gt: 0 },
      purchaseDate: { $gte: effectiveDate },
    })
      .select("purchaseNumber purchaseDate supplierSnapshot amountPaid paymentMethod paymentReference advanceAdjustments notes")
      .lean(),
  ]);

  const rawTxns: IRawTransaction[] = [];

  // Transform Sales (Split payments produce separate entries for Cash and UPI)
  for (const s of sales as any[]) {
    const custName = s.customerSnapshot?.name || (s.isWalkIn ? "Walk-in Customer" : "Customer");
    if (s.payment?.cashAmount && s.payment.cashAmount > 0) {
      rawTxns.push({
        id: `sale-cash-${s._id}`,
        date: new Date(s.invoiceDate),
        reference: s.invoiceNumber,
        description: `Cash Sale Invoice #${s.invoiceNumber} - ${custName}`,
        type: "SALE_CASH",
        module: "SALES",
        sourceId: s._id.toString(),
        paymentMethod: "CASH",
        inflow: round2(s.payment.cashAmount),
        outflow: 0,
        recordedByName: "Billing Staff",
        notes: s.notes,
      });
    }
    if (s.payment?.upiAmount && s.payment.upiAmount > 0) {
      rawTxns.push({
        id: `sale-upi-${s._id}`,
        date: new Date(s.invoiceDate),
        reference: s.invoiceNumber,
        description: `UPI Sale Invoice #${s.invoiceNumber}${s.payment.upiReference ? ` (Ref: ${s.payment.upiReference})` : ""} - ${custName}`,
        type: "SALE_UPI",
        module: "SALES",
        sourceId: s._id.toString(),
        paymentMethod: "UPI",
        inflow: round2(s.payment.upiAmount),
        outflow: 0,
        recordedByName: "Billing Staff",
        notes: s.notes,
      });
    }
  }

  // Transform Customer Payments (Money In)
  for (const cp of customerPayments as any[]) {
    const custName = cp.customerSnapshot?.name || "Customer";
    const method = normalizeMethod(cp.paymentMethod);
    rawTxns.push({
      id: `cust-pay-${cp._id}`,
      date: new Date(cp.paymentDate),
      reference: cp.paymentNumber,
      description: `Khata Repayment #${cp.paymentNumber} - ${custName}${cp.transactionReference ? ` (Ref: ${cp.transactionReference})` : ""}`,
      type: "CUSTOMER_REPAYMENT",
      module: "CUSTOMER_KHATA",
      sourceId: cp._id.toString(),
      paymentMethod: method,
      inflow: round2(cp.amount),
      outflow: 0,
      recordedByName: cp.createdByName || "Staff",
      notes: cp.notes,
    });
  }

  // Transform Expenses (Money Out)
  for (const exp of expenses as any[]) {
    const method = normalizeMethod(exp.paymentMethod);
    rawTxns.push({
      id: `exp-${exp._id}`,
      date: new Date(exp.expenseDate),
      reference: exp.expenseNumber,
      description: `Expense #${exp.expenseNumber} [${exp.categoryName}] - ${exp.description}${exp.paidTo ? ` (Paid to: ${exp.paidTo})` : ""}`,
      type: "EXPENSE",
      module: "EXPENSES",
      sourceId: exp._id.toString(),
      paymentMethod: method,
      inflow: 0,
      outflow: round2(exp.amount),
      recordedByName: exp.createdByName || "Staff",
      notes: exp.notes,
    });
  }

  // Transform Supplier Payments (Money Out)
  for (const sp of supplierPayments as any[]) {
    const suppName = sp.supplierSnapshot?.name || "Supplier";
    const method = normalizeMethod(sp.paymentMethod);
    rawTxns.push({
      id: `supp-pay-${sp._id}`,
      date: new Date(sp.paymentDate),
      reference: sp.paymentNumber,
      description: `Supplier Payment #${sp.paymentNumber} - ${suppName}${sp.paymentReference ? ` (Ref: ${sp.paymentReference})` : ""}`,
      type: "SUPPLIER_PAYMENT",
      module: "SUPPLIERS",
      sourceId: sp._id.toString(),
      paymentMethod: method,
      inflow: 0,
      outflow: round2(sp.amount),
      recordedByName: sp.createdByName || "Staff",
      notes: sp.notes,
    });
  }

  // Transform Purchase Upfront Payments (Money Out, excluding absorbed advances to prevent double-counting)
  for (const p of purchases as any[]) {
    const absorbedAdvances = (p.advanceAdjustments || []).reduce(
      (sum: number, adj: any) => sum + (adj.amount || 0),
      0
    );
    const actualDirectCashPaid = round2(p.amountPaid - absorbedAdvances);
    if (actualDirectCashPaid > 0) {
      const suppName = p.supplierSnapshot?.name || "Supplier";
      const method = normalizeMethod(p.paymentMethod);
      rawTxns.push({
        id: `purchase-pay-${p._id}`,
        date: new Date(p.purchaseDate),
        reference: p.purchaseNumber,
        description: `Purchase Bill #${p.purchaseNumber} upfront settlement - ${suppName}${p.paymentReference ? ` (Ref: ${p.paymentReference})` : ""}`,
        type: "PURCHASE_PAYMENT",
        module: "PURCHASES",
        sourceId: p._id.toString(),
        paymentMethod: method,
        inflow: 0,
        outflow: actualDirectCashPaid,
        recordedByName: "Purchase Staff",
        notes: p.notes,
      });
    }
  }

  // Sort chronologically ascending for precise running balance accumulation
  rawTxns.sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    transactions: rawTxns,
    openingBase: {
      cash: openingConfig.cash,
      upi: openingConfig.upi,
      bank: openingConfig.bank,
      cheque: openingConfig.cheque,
      effectiveDate,
    },
  };
}

/**
 * Filtered, paginated cashbook ledger with mathematical running balances.
 */
export async function getCashbookLedger(filter: {
  startDate?: string;
  endDate?: string;
  paymentMethod?: string;
  module?: string;
  search?: string;
  page?: number;
  limit?: number;
}): Promise<{
  entries: ICashbookEntry[];
  summary: ICashbookSummary;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const { transactions, openingBase } = await loadAllAuthoritativeTransactions();

  const startBound = filter.startDate ? new Date(filter.startDate) : null;
  const endBound = filter.endDate
    ? (() => {
        const d = new Date(filter.endDate);
        d.setHours(23, 59, 59, 999);
        return d;
      })()
    : null;

  // 1. Calculate opening balances at the start of the filter window
  const openingBalances: ICashbookBalances = {
    cash: openingBase.cash,
    upi: openingBase.upi,
    bank: openingBase.bank,
    cheque: openingBase.cheque,
    total: round2(openingBase.cash + openingBase.upi + openingBase.bank + openingBase.cheque),
  };

  const periodInflows: ICashbookBalances = { cash: 0, upi: 0, bank: 0, cheque: 0, total: 0 };
  const periodOutflows: ICashbookBalances = { cash: 0, upi: 0, bank: 0, cheque: 0, total: 0 };

  const entriesWithRunningBalance: ICashbookEntry[] = [];
  let currentRunningTotal = openingBalances.total;

  for (const txn of transactions) {
    const isBeforeStart = startBound && txn.date < startBound;
    const isAfterEnd = endBound && txn.date > endBound;

    if (isBeforeStart) {
      // Accumulate prior transactions into opening balance of the requested window
      if (txn.paymentMethod === "CASH") openingBalances.cash = round2(openingBalances.cash + txn.inflow - txn.outflow);
      else if (txn.paymentMethod === "UPI") openingBalances.upi = round2(openingBalances.upi + txn.inflow - txn.outflow);
      else if (txn.paymentMethod === "BANK_TRANSFER") openingBalances.bank = round2(openingBalances.bank + txn.inflow - txn.outflow);
      else if (txn.paymentMethod === "CHEQUE") openingBalances.cheque = round2(openingBalances.cheque + txn.inflow - txn.outflow);
      openingBalances.total = round2(openingBalances.total + txn.inflow - txn.outflow);
      currentRunningTotal = openingBalances.total;
      continue;
    }

    if (isAfterEnd) {
      continue;
    }

    // Accumulate period totals
    if (txn.paymentMethod === "CASH") {
      periodInflows.cash = round2(periodInflows.cash + txn.inflow);
      periodOutflows.cash = round2(periodOutflows.cash + txn.outflow);
    } else if (txn.paymentMethod === "UPI") {
      periodInflows.upi = round2(periodInflows.upi + txn.inflow);
      periodOutflows.upi = round2(periodOutflows.upi + txn.outflow);
    } else if (txn.paymentMethod === "BANK_TRANSFER") {
      periodInflows.bank = round2(periodInflows.bank + txn.inflow);
      periodOutflows.bank = round2(periodOutflows.bank + txn.outflow);
    } else if (txn.paymentMethod === "CHEQUE") {
      periodInflows.cheque = round2(periodInflows.cheque + txn.inflow);
      periodOutflows.cheque = round2(periodOutflows.cheque + txn.outflow);
    }

    periodInflows.total = round2(periodInflows.total + txn.inflow);
    periodOutflows.total = round2(periodOutflows.total + txn.outflow);

    currentRunningTotal = round2(currentRunningTotal + txn.inflow - txn.outflow);

    // Apply filters for listing view
    let matchesMethod = true;
    if (filter.paymentMethod && filter.paymentMethod !== "ALL") {
      matchesMethod = txn.paymentMethod === filter.paymentMethod;
    }

    let matchesModule = true;
    if (filter.module && filter.module !== "ALL") {
      matchesModule = txn.module === filter.module;
    }

    let matchesSearch = true;
    if (filter.search && filter.search.trim()) {
      const s = filter.search.trim().toLowerCase();
      matchesSearch =
        txn.reference.toLowerCase().includes(s) ||
        txn.description.toLowerCase().includes(s) ||
        txn.paymentMethod.toLowerCase().includes(s);
    }

    if (matchesMethod && matchesModule && matchesSearch) {
      entriesWithRunningBalance.push({
        id: txn.id,
        date: txn.date.toISOString(),
        reference: txn.reference,
        description: txn.description,
        type: txn.type,
        module: txn.module,
        sourceId: txn.sourceId,
        paymentMethod: txn.paymentMethod,
        inflow: txn.inflow,
        outflow: txn.outflow,
        runningBalance: currentRunningTotal,
        recordedByName: txn.recordedByName,
        notes: txn.notes,
      });
    }
  }

  const closingBalances: ICashbookBalances = {
    cash: round2(openingBalances.cash + periodInflows.cash - periodOutflows.cash),
    upi: round2(openingBalances.upi + periodInflows.upi - periodOutflows.upi),
    bank: round2(openingBalances.bank + periodInflows.bank - periodOutflows.bank),
    cheque: round2(openingBalances.cheque + periodInflows.cheque - periodOutflows.cheque),
    total: round2(openingBalances.total + periodInflows.total - periodOutflows.total),
  };

  const summary: ICashbookSummary = {
    openingBalances,
    periodInflows,
    periodOutflows,
    closingBalances,
    totalTransactionsCount: entriesWithRunningBalance.length,
  };

  // Default display is reverse chronological for ledger readability (latest on top)
  const sortedEntries = [...entriesWithRunningBalance].reverse();

  const page = filter.page && filter.page > 0 ? filter.page : 1;
  const limit = filter.limit && filter.limit > 0 ? filter.limit : 50;
  const skip = (page - 1) * limit;
  const paginatedEntries = sortedEntries.slice(skip, skip + limit);

  return {
    entries: paginatedEntries,
    summary,
    total: sortedEntries.length,
    page,
    limit,
    totalPages: Math.ceil(sortedEntries.length / limit) || 1,
  };
}

/**
 * Returns instantaneous cashbook summary & balance separation.
 */
export async function getCashbookSummary(
  startDate?: string,
  endDate?: string
): Promise<ICashbookSummary> {
  const ledger = await getCashbookLedger({
    startDate,
    endDate,
    limit: 1, // Summary is computed over the full period regardless of pagination
  });
  return ledger.summary;
}

/**
 * Generates detailed multi-dimensional Cashbook Report.
 */
export async function getCashbookReports(params: {
  startDate?: string;
  endDate?: string;
  year?: number;
  month?: number;
}): Promise<ICashbookReport> {
  await connectDB();

  let start = params.startDate;
  let end = params.endDate;

  if (params.year && params.month) {
    const y = params.year;
    const m = params.month - 1;
    const sDate = new Date(y, m, 1);
    const eDate = new Date(y, m + 1, 0, 23, 59, 59, 999);
    start = sDate.toISOString();
    end = eDate.toISOString();
  }

  const { transactions, openingBase } = await loadAllAuthoritativeTransactions();

  const startBound = start ? new Date(start) : null;
  const endBound = end
    ? (() => {
        const d = new Date(end);
        d.setHours(23, 59, 59, 999);
        return d;
      })()
    : null;

  const openingBalances: ICashbookBalances = {
    cash: openingBase.cash,
    upi: openingBase.upi,
    bank: openingBase.bank,
    cheque: openingBase.cheque,
    total: round2(openingBase.cash + openingBase.upi + openingBase.bank + openingBase.cheque),
  };

  const periodInflows: ICashbookBalances = { cash: 0, upi: 0, bank: 0, cheque: 0, total: 0 };
  const periodOutflows: ICashbookBalances = { cash: 0, upi: 0, bank: 0, cheque: 0, total: 0 };

  const dailyMap = new Map<string, { inflow: number; outflow: number }>();

  for (const txn of transactions) {
    const isBeforeStart = startBound && txn.date < startBound;
    const isAfterEnd = endBound && txn.date > endBound;

    if (isBeforeStart) {
      if (txn.paymentMethod === "CASH") openingBalances.cash = round2(openingBalances.cash + txn.inflow - txn.outflow);
      else if (txn.paymentMethod === "UPI") openingBalances.upi = round2(openingBalances.upi + txn.inflow - txn.outflow);
      else if (txn.paymentMethod === "BANK_TRANSFER") openingBalances.bank = round2(openingBalances.bank + txn.inflow - txn.outflow);
      else if (txn.paymentMethod === "CHEQUE") openingBalances.cheque = round2(openingBalances.cheque + txn.inflow - txn.outflow);
      openingBalances.total = round2(openingBalances.total + txn.inflow - txn.outflow);
      continue;
    }

    if (isAfterEnd) continue;

    if (txn.paymentMethod === "CASH") {
      periodInflows.cash = round2(periodInflows.cash + txn.inflow);
      periodOutflows.cash = round2(periodOutflows.cash + txn.outflow);
    } else if (txn.paymentMethod === "UPI") {
      periodInflows.upi = round2(periodInflows.upi + txn.inflow);
      periodOutflows.upi = round2(periodOutflows.upi + txn.outflow);
    } else if (txn.paymentMethod === "BANK_TRANSFER") {
      periodInflows.bank = round2(periodInflows.bank + txn.inflow);
      periodOutflows.bank = round2(periodOutflows.bank + txn.outflow);
    } else if (txn.paymentMethod === "CHEQUE") {
      periodInflows.cheque = round2(periodInflows.cheque + txn.inflow);
      periodOutflows.cheque = round2(periodOutflows.cheque + txn.outflow);
    }

    periodInflows.total = round2(periodInflows.total + txn.inflow);
    periodOutflows.total = round2(periodOutflows.total + txn.outflow);

    // Group by day YYYY-MM-DD
    const dayKey = txn.date.toISOString().split("T")[0];
    const dayStat = dailyMap.get(dayKey) || { inflow: 0, outflow: 0 };
    dayStat.inflow = round2(dayStat.inflow + txn.inflow);
    dayStat.outflow = round2(dayStat.outflow + txn.outflow);
    dailyMap.set(dayKey, dayStat);
  }

  const closingBalances: ICashbookBalances = {
    cash: round2(openingBalances.cash + periodInflows.cash - periodOutflows.cash),
    upi: round2(openingBalances.upi + periodInflows.upi - periodOutflows.upi),
    bank: round2(openingBalances.bank + periodInflows.bank - periodOutflows.bank),
    cheque: round2(openingBalances.cheque + periodInflows.cheque - periodOutflows.cheque),
    total: round2(openingBalances.total + periodInflows.total - periodOutflows.total),
  };

  const summary: ICashbookSummary = {
    openingBalances,
    periodInflows,
    periodOutflows,
    closingBalances,
    totalTransactionsCount: Array.from(dailyMap.values()).reduce((a, b) => a + 1, 0),
  };

  const methodBreakdown = {
    CASH: {
      inflow: periodInflows.cash,
      outflow: periodOutflows.cash,
      net: round2(periodInflows.cash - periodOutflows.cash),
      opening: openingBalances.cash,
      closing: closingBalances.cash,
    },
    UPI: {
      inflow: periodInflows.upi,
      outflow: periodOutflows.upi,
      net: round2(periodInflows.upi - periodOutflows.upi),
      opening: openingBalances.upi,
      closing: closingBalances.upi,
    },
    BANK_TRANSFER: {
      inflow: periodInflows.bank,
      outflow: periodOutflows.bank,
      net: round2(periodInflows.bank - periodOutflows.bank),
      opening: openingBalances.bank,
      closing: closingBalances.bank,
    },
    CHEQUE: {
      inflow: periodInflows.cheque,
      outflow: periodOutflows.cheque,
      net: round2(periodInflows.cheque - periodOutflows.cheque),
      opening: openingBalances.cheque,
      closing: closingBalances.cheque,
    },
  };

  // Category breakdown for expenses in this period
  const catAgg = await Expense.aggregate([
    {
      $match: {
        status: "RECORDED",
        ...(startBound || endBound
          ? {
              expenseDate: {
                ...(startBound ? { $gte: startBound } : {}),
                ...(endBound ? { $lte: endBound } : {}),
              },
            }
          : {}),
      },
    },
    {
      $group: {
        _id: { categoryId: "$categoryId", categoryName: "$categoryName" },
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { totalAmount: -1 } },
  ]);

  const totalCatExpenses = catAgg.reduce((acc, curr) => acc + curr.totalAmount, 0);
  const categoryBreakdown = catAgg.map((c) => ({
    categoryId: c._id.categoryId.toString(),
    categoryName: c._id.categoryName,
    count: c.count,
    totalAmount: round2(c.totalAmount),
    percentage: totalCatExpenses > 0 ? round2((c.totalAmount / totalCatExpenses) * 100) : 0,
  }));

  // Build sequential daily timeline
  const sortedDays = Array.from(dailyMap.keys()).sort();
  let dayRunning = openingBalances.total;
  const dailyTimeline = sortedDays.map((dateStr) => {
    const d = dailyMap.get(dateStr)!;
    const dayOpen = dayRunning;
    const dayClose = round2(dayOpen + d.inflow - d.outflow);
    dayRunning = dayClose;
    return {
      date: dateStr,
      openingBalance: dayOpen,
      inflow: d.inflow,
      outflow: d.outflow,
      closingBalance: dayClose,
    };
  });

  return {
    startDate: start || (transactions[0]?.date ? transactions[0].date.toISOString() : new Date().toISOString()),
    endDate: end || new Date().toISOString(),
    summary,
    methodBreakdown,
    categoryBreakdown,
    dailyTimeline,
  };
}

/**
 * Financial overview for the dashboard cards.
 */
export async function getDashboardFinancials(): Promise<IDashboardFinancials> {
  await connectDB();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todaySummary, monthSummary, fullSummary, recentExp] = await Promise.all([
    getCashbookSummary(startOfToday.toISOString(), endOfToday.toISOString()),
    getCashbookSummary(startOfMonth.toISOString(), endOfToday.toISOString()),
    getCashbookSummary(),
    Expense.find({ status: "RECORDED" })
      .sort({ expenseDate: -1, createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  const recentExpenses: any[] = recentExp.map((e: any) => ({
    _id: e._id.toString(),
    expenseNumber: e.expenseNumber,
    expenseDate: new Date(e.expenseDate).toISOString(),
    categoryId: e.categoryId.toString(),
    categoryName: e.categoryName,
    description: e.description,
    amount: e.amount,
    paymentMethod: e.paymentMethod,
    paidTo: e.paidTo || "",
    status: e.status,
  }));

  return {
    todayExpenses: todaySummary.periodOutflows.total,
    thisMonthExpenses: monthSummary.periodOutflows.total,
    todayCashReceived: todaySummary.periodInflows.cash,
    todayCashPaid: todaySummary.periodOutflows.cash,
    currentCashBalance: fullSummary.closingBalances.cash,
    currentUpiBalance: fullSummary.closingBalances.upi,
    currentBankBalance: fullSummary.closingBalances.bank,
    thisMonthIncome: monthSummary.periodInflows.total,
    recentExpenses,
  };
}

