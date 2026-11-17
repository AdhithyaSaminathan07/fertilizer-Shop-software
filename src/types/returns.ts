export type SalesReturnReason =
  | "DAMAGED"
  | "DEFECTIVE"
  | "WRONG_PRODUCT"
  | "EXPIRED"
  | "CUSTOMER_CHANGED_MIND"
  | "OTHER";

export type PurchaseReturnReason =
  | "DAMAGED"
  | "DEFECTIVE"
  | "WRONG_PRODUCT"
  | "EXPIRED"
  | "QUALITY_REJECTED"
  | "SUPPLIER_RECALL"
  | "OTHER";

export type ReturnItemCondition = "SALEABLE" | "DAMAGED" | "DEFECTIVE" | "OTHER";

export type SalesReturnRefundMethod =
  | "CASH"
  | "UPI"
  | "BANK_TRANSFER"
  | "CHEQUE"
  | "CREDIT_NOTE";

export type PurchaseReturnSupplierResponse =
  | "REFUND_EXPECTED"
  | "CREDIT_NOTE_EXPECTED"
  | "REPLACEMENT_EXPECTED"
  | "PENDING_CONFIRMATION"
  | "OTHER";

export type ReturnStatus =
  | "DRAFT"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export interface IReturnStatusHistory {
  status: ReturnStatus;
  changedAt: string;
  changedById: string;
  changedByName: string;
  reason?: string;
}

export interface ISalesReturnItem {
  productId: string;
  productSnapshot: {
    name: string;
    sku: string;
    primaryUnit: string;
    hsnCode?: string;
  };
  batchNumber?: string;
  originalSoldQty: number;
  previouslyReturnedQty: number;
  returnQty: number;
  unitSellingPrice: number;
  discountAmount: number;
  taxRate: number;
  taxableAmount: number;
  taxAmount: number;
  lineTotal: number;
  reason: SalesReturnReason;
  condition: ReturnItemCondition;
  remarks?: string;
}

export interface ISalesReturn {
  _id: string;
  id?: string;
  returnNumber: string; // SRET-YYYYMM-XXXX
  returnDate: string;
  saleId: string;
  saleNumber: string;
  saleDate: string;
  customerSnapshot: {
    id?: string;
    name: string;
    mobile?: string;
    village?: string;
    gstin?: string;
  };
  items: ISalesReturnItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  refundTotal: number;
  refundMethod: SalesReturnRefundMethod;
  refundReference?: string;
  status: ReturnStatus;
  statusHistory: IReturnStatusHistory[];
  generalReason?: SalesReturnReason;
  remarks?: string;
  createdById: string;
  createdByName: string;
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedById?: string;
  rejectedByName?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  cancelledById?: string;
  cancelledByName?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IPurchaseReturnItem {
  productId: string;
  productSnapshot: {
    name: string;
    sku: string;
    primaryUnit: string;
  };
  batchNumber?: string;
  originalPurchasedQty: number;
  previouslyReturnedQty: number;
  returnQty: number;
  unitPurchasePrice: number;
  discountAmount: number;
  taxRate: number;
  taxableAmount: number;
  taxAmount: number;
  lineTotal: number;
  reason: PurchaseReturnReason;
  condition: ReturnItemCondition;
  remarks?: string;
}

export interface IPurchaseReturn {
  _id: string;
  id?: string;
  returnNumber: string; // PRET-YYYYMM-XXXX
  returnDate: string;
  purchaseId: string;
  purchaseNumber: string;
  supplierInvoiceNumber: string;
  supplierInvoiceDate?: string;
  purchaseDate: string;
  supplierSnapshot: {
    id?: string;
    name: string;
    phone?: string;
    gstin?: string;
  };
  items: IPurchaseReturnItem[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  returnTotal: number;
  supplierResponse: PurchaseReturnSupplierResponse;
  supplierCreditNoteNumber?: string;
  supplierCreditNoteDate?: string;
  status: ReturnStatus;
  statusHistory: IReturnStatusHistory[];
  generalReason?: PurchaseReturnReason;
  remarks?: string;
  createdById: string;
  createdByName: string;
  approvedById?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectedById?: string;
  rejectedByName?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  cancelledById?: string;
  cancelledByName?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ICreateSalesReturnItemInput {
  productId: string;
  batchNumber?: string;
  returnQty: number;
  reason: SalesReturnReason;
  condition: ReturnItemCondition;
  remarks?: string;
}

export interface ICreateSalesReturnInput {
  saleId: string;
  returnDate?: string;
  items: ICreateSalesReturnItemInput[];
  refundMethod: SalesReturnRefundMethod;
  refundReference?: string;
  generalReason?: SalesReturnReason;
  remarks?: string;
  submitForApproval?: boolean;
}

export interface IUpdateSalesReturnInput {
  items?: ICreateSalesReturnItemInput[];
  refundMethod?: SalesReturnRefundMethod;
  refundReference?: string;
  generalReason?: SalesReturnReason;
  remarks?: string;
  submitForApproval?: boolean;
}

export interface ICreatePurchaseReturnItemInput {
  productId: string;
  batchNumber?: string;
  returnQty: number;
  reason: PurchaseReturnReason;
  condition: ReturnItemCondition;
  remarks?: string;
}

export interface ICreatePurchaseReturnInput {
  purchaseId: string;
  returnDate?: string;
  items: ICreatePurchaseReturnItemInput[];
  supplierResponse: PurchaseReturnSupplierResponse;
  supplierCreditNoteNumber?: string;
  supplierCreditNoteDate?: string;
  generalReason?: PurchaseReturnReason;
  remarks?: string;
  submitForApproval?: boolean;
}

export interface IUpdatePurchaseReturnInput {
  items?: ICreatePurchaseReturnItemInput[];
  supplierResponse?: PurchaseReturnSupplierResponse;
  supplierCreditNoteNumber?: string;
  supplierCreditNoteDate?: string;
  generalReason?: PurchaseReturnReason;
  remarks?: string;
  submitForApproval?: boolean;
}

export interface IReturnsOverview {
  totalSalesReturnsCount: number;
  totalSalesReturnsValue: number;
  totalPurchaseReturnsCount: number;
  totalPurchaseReturnsValue: number;
  pendingApprovalsCount: number;
  approvedReturnsCount: number;
  recentSalesReturns: ISalesReturn[];
  recentPurchaseReturns: IPurchaseReturn[];
}

export interface IReturnsReports {
  salesReturns: {
    totalCount: number;
    totalRefundAmount: number;
    byReason: Array<{ reason: string; count: number; amount: number }>;
    byStatus: Array<{ status: string; count: number; amount: number }>;
    byProduct: Array<{
      productId: string;
      productName: string;
      sku: string;
      quantity: number;
      amount: number;
    }>;
  };
  purchaseReturns: {
    totalCount: number;
    totalReturnValue: number;
    byReason: Array<{ reason: string; count: number; amount: number }>;
    byStatus: Array<{ status: string; count: number; amount: number }>;
    byProduct: Array<{
      productId: string;
      productName: string;
      sku: string;
      quantity: number;
      amount: number;
    }>;
  };
}

