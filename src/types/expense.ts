export type ExpensePaymentMethod = "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE";

export type ExpenseStatus = "RECORDED" | "REVERSED";

export interface IExpenseCategory {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
  expenseCount?: number;
  totalAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface IExpenseCategoryInput {
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface IExpenseAuditEntry {
  editedAt: Date | string;
  editedById: string;
  editedByName: string;
  reason: string;
  previousData: {
    expenseDate?: Date | string;
    categoryId?: string;
    categoryName?: string;
    description?: string;
    amount?: number;
    paymentMethod?: ExpensePaymentMethod;
    paymentReference?: string;
    paidTo?: string;
    notes?: string;
  };
}

export interface IExpenseReversal {
  reason: string;
  reversedAt: Date | string;
  reversedById: string;
  reversedByName: string;
}

export interface IExpense {
  _id: string;
  expenseNumber: string;
  expenseDate: string;
  categoryId: string;
  categoryName: string;
  description: string;
  amount: number;
  paymentMethod: ExpensePaymentMethod;
  paymentReference?: string;
  paidTo?: string;
  notes?: string;
  attachmentUrl?: string;
  status: ExpenseStatus;
  reversal?: IExpenseReversal;
  auditHistory?: IExpenseAuditEntry[];
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface IExpenseCreateInput {
  expenseDate?: string | Date;
  categoryId: string;
  description: string;
  amount: number;
  paymentMethod: ExpensePaymentMethod;
  paymentReference?: string;
  paidTo?: string;
  notes?: string;
  attachmentUrl?: string;
}

export interface IExpenseUpdateInput {
  expenseDate?: string | Date;
  categoryId?: string;
  description?: string;
  amount?: number;
  paymentMethod?: ExpensePaymentMethod;
  paymentReference?: string;
  paidTo?: string;
  notes?: string;
  attachmentUrl?: string;
  reason: string;
}

export interface IExpenseFilter {
  search?: string;
  categoryId?: string;
  paymentMethod?: ExpensePaymentMethod;
  startDate?: string;
  endDate?: string;
  createdById?: string;
  status?: ExpenseStatus;
  page?: number;
  limit?: number;
}

export interface IExpenseSummary {
  todayTotal: number;
  todayCount: number;
  monthTotal: number;
  monthCount: number;
  yearTotal: number;
  yearCount: number;
  categoryBreakdown: Array<{
    categoryId: string;
    categoryName: string;
    totalAmount: number;
    count: number;
    percentage: number;
  }>;
  recentExpenses: IExpense[];
}

export type CashbookPaymentMethod = "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE";

export type CashbookTransactionType =
  | "SALE_CASH"
  | "SALE_UPI"
  | "CUSTOMER_REPAYMENT"
  | "EXPENSE"
  | "SUPPLIER_PAYMENT"
  | "PURCHASE_PAYMENT"
  | "OPENING_BALANCE";

export type CashbookModule =
  | "SALES"
  | "CUSTOMER_KHATA"
  | "EXPENSES"
  | "SUPPLIERS"
  | "PURCHASES"
  | "CASHBOOK";

export interface ICashbookEntry {
  id: string;
  date: string;
  reference: string;
  description: string;
  type: CashbookTransactionType;
  module: CashbookModule;
  sourceId: string;
  paymentMethod: CashbookPaymentMethod;
  inflow: number;
  outflow: number;
  runningBalance: number;
  recordedByName: string;
  notes?: string;
}

export interface ICashbookBalances {
  cash: number;
  upi: number;
  bank: number;
  cheque: number;
  total: number;
}

export interface IOpeningBalanceAdjustment {
  adjustedAt: string | Date;
  adjustedById: string;
  adjustedByName: string;
  reason: string;
  previousBalances: {
    cash: number;
    upi: number;
    bank: number;
    cheque: number;
  };
  newBalances: {
    cash: number;
    upi: number;
    bank: number;
    cheque: number;
  };
}

export interface ICashbookOpeningBalanceConfig {
  effectiveDate: string | Date;
  cash: number;
  upi: number;
  bank: number;
  cheque: number;
  notes?: string;
  history: IOpeningBalanceAdjustment[];
  createdById?: string;
  createdByName?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface ICashbookSummary {
  openingBalances: ICashbookBalances;
  periodInflows: ICashbookBalances;
  periodOutflows: ICashbookBalances;
  closingBalances: ICashbookBalances;
  totalTransactionsCount: number;
}

export interface ICashbookReport {
  startDate: string;
  endDate: string;
  summary: ICashbookSummary;
  methodBreakdown: Record<
    CashbookPaymentMethod,
    {
      inflow: number;
      outflow: number;
      net: number;
      opening: number;
      closing: number;
    }
  >;
  categoryBreakdown: Array<{
    categoryId: string;
    categoryName: string;
    count: number;
    totalAmount: number;
    percentage: number;
  }>;
  dailyTimeline: Array<{
    date: string;
    openingBalance: number;
    inflow: number;
    outflow: number;
    closingBalance: number;
  }>;
}

export interface IDashboardFinancials {
  todayExpenses: number;
  thisMonthExpenses: number;
  todayCashReceived: number;
  todayCashPaid: number;
  currentCashBalance: number;
  currentUpiBalance: number;
  currentBankBalance: number;
  thisMonthIncome: number;
  recentExpenses: IExpense[];
}

