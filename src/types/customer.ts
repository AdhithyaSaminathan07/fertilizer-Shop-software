export type CustomerStatus = "ACTIVE" | "INACTIVE";

export type CustomerPaymentMethod = "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE";
export type CustomerPaymentStatus = "RECORDED" | "REVERSED";

export interface ICustomer {
  _id: string;
  id?: string;
  name: string;
  phone: string;
  village?: string;
  address?: string;
  district?: string;
  state?: string;
  pincode?: string;
  email?: string;
  gstin?: string;
  outstandingCredit: number;
  totalPurchases: number;
  totalPaid: number;
  status: CustomerStatus;
  notes?: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ICustomerInput {
  name: string;
  phone: string;
  village?: string;
  address?: string;
  district?: string;
  state?: string;
  pincode?: string;
  email?: string;
  gstin?: string;
  notes?: string;
  status?: CustomerStatus;
}

export interface ICustomerPaymentAllocation {
  saleId: string;
  invoiceNumber: string;
  invoiceDate: string | Date;
  saleDate?: string | Date;
  allocatedAmount: number;
}

export interface ICustomerPayment {
  _id: string;
  id?: string;
  paymentNumber: string;
  customerId: string;
  customerSnapshot: {
    name: string;
    phone: string;
    village?: string;
  };
  paymentDate: string | Date;
  amount: number;
  paymentMethod: CustomerPaymentMethod;
  transactionReference?: string;
  allocations: ICustomerPaymentAllocation[];
  notes?: string;
  status: CustomerPaymentStatus;
  reversal?: {
    reason: string;
    reversedAt: string | Date;
    reversedById: string;
    reversedByName: string;
  };
  idempotencyKey?: string;
  createdById: string;
  createdByName: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ICustomerRepaymentInput {
  customerId: string;
  amount: number;
  paymentMethod: CustomerPaymentMethod;
  paymentDate?: string | Date;
  transactionReference?: string;
  allocations?: Array<{
    saleId: string;
    allocatedAmount: number;
  }>;
  notes?: string;
  idempotencyKey?: string;
}

export type KhataTransactionType = "CREDIT_SALE" | "REPAYMENT";

export interface IKhataLedgerEntry {
  id: string;
  date: string | Date;
  type: KhataTransactionType;
  label: "Credit Given" | "Payment Received";
  reference: string;
  referenceNumber?: string;
  description?: string;
  relatedId: string;
  paymentMethod?: string;
  transactionReference?: string;
  debitAmount: number; // Credit Given (increases customer receivable)
  creditAmount: number; // Payment Received (decreases customer debt)
  runningBalance: number;
  notes?: string;
  status?: string;
}

export interface IKhataLedger {
  customer: ICustomer;
  openingBalance: number;
  periodFrom?: string;
  periodTo?: string;
  transactions: IKhataLedgerEntry[];
  entries?: IKhataLedgerEntry[];
  totalCreditGiven: number;
  totalPaymentsReceived: number;
  closingBalance: number;
}

export type AgingBucket = "0-30" | "31-60" | "61-90" | "90+";

export interface ICustomerAgingItem {
  customerId: string;
  customerName: string;
  phone: string;
  village?: string;
  outstandingBalance: number;
  unpaidInvoicesCount: number;
  oldestUnpaidInvoiceDate?: string | Date;
  oldestUnpaidInvoiceNumber?: string;
  lastPaymentDate?: string | Date;
  lastPaymentAmount?: number;
  ageInDays: number;
  agingBucket: AgingBucket;
}

export interface ICustomerAgingSummary {
  totalOutstanding: number;
  totalPendingCustomers: number;
  bucket0to30: { count: number; amount: number };
  bucket31to60: { count: number; amount: number };
  bucket61to90: { count: number; amount: number };
  bucket90Plus: { count: number; amount: number };
  customers: ICustomerAgingItem[];
}

export interface ICreditCollectionDashboard {
  totalOutstandingCredit: number;
  totalPendingCustomers: number;
  totalCustomers?: number;
  collectedToday: number;
  collectedThisMonth: number;
  agingBuckets: {
    "0-30": number;
    "31-60": number;
    "61-90": number;
    "90+": number;
  };
  recentRepayments: Array<{
    _id: string;
    paymentNumber: string;
    customerId: string;
    customerName: string;
    phone: string;
    amount: number;
    paymentMethod: string;
    paymentDate: string | Date;
    status: string;
  }>;
  topDebtors: Array<{
    _id: string;
    name: string;
    phone: string;
    village?: string;
    outstandingCredit: number;
    unpaidInvoicesCount: number;
    oldestInvoiceDate?: string | Date;
  }>;
}

export interface ICustomerStatement {
  shop: any;
  customer: ICustomer;
  fromDate?: string;
  toDate?: string;
  period?: { fromDate?: string; toDate?: string };
  generatedAt?: string | Date;
  openingBalance: number;
  transactions: IKhataLedgerEntry[];
  entries?: IKhataLedgerEntry[];
  totalCreditGiven: number;
  totalPaymentsReceived: number;
  closingBalance: number;
}
