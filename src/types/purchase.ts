import { ProductUnit } from "@/types/product";

export type PurchaseStatus =
  | "DRAFT"
  | "PENDING_RECEIPT"
  | "PARTIALLY_RECEIVED"
  | "RECEIVED"
  | "CANCELLED";

export type PurchasePaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID";

export interface PurchaseSupplierSnapshot {
  name: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  gstin?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
}

export interface PurchaseProductSnapshot {
  name: string;
  sku?: string;
  brand?: string;
  primaryUnit: ProductUnit | string;
  barcode?: string;
}

export interface IPurchaseItemBatch {
  batchNumber: string;
  manufacturingDate?: string | Date;
  expiryDate?: string | Date;
  quantity: number;
}

export interface IPurchaseItem {
  id?: string;
  _id?: string;
  productId?: string;
  isManualProduct?: boolean;
  saveToCatalogue?: boolean;
  productSnapshot: PurchaseProductSnapshot;
  orderedQty: number; // Invoiced quantity
  receivedQty: number; // Received quantity confirmed so far
  unit: ProductUnit | string;
  unitPurchasePrice: number;
  discountAmount: number;
  taxRate: number; // percentage e.g. 0, 5, 12, 18, 28
  taxAmount: number;
  lineTotal: number;
  recognizedValue: number; // Cumulative recognized value for received quantity
  batches?: IPurchaseItemBatch[];
}

export interface IPurchaseReceiptItem {
  productId?: string;
  itemId?: string;
  productName?: string;
  receivedQty: number;
  recognizedValue: number;
  batches: IPurchaseItemBatch[];
}

export interface IPurchaseReceipt {
  receiptNumber: string; // e.g., REC-001
  receiptDate: string | Date;
  receivedById: string;
  receivedByName: string;
  items: IPurchaseReceiptItem[];
  totalRecognizedValue: number;
  notes?: string;
}

export interface IPurchaseAmendment {
  amendmentNumber: number;
  amendedAt: string;
  amendedById: string;
  amendedByName: string;
  reason: string;
  previousItems: IPurchaseItem[];
  revisedItems: IPurchaseItem[];
  previousGrandTotal: number;
  revisedGrandTotal: number;
  newGrandTotal?: number;
}

export interface IPurchaseAdvanceAdjustment {
  paymentId: string;
  paymentNumber: string;
  amount: number;
  adjustedAt: string | Date;
}

export interface IPurchase {
  id: string;
  _id?: string;
  purchaseNumber: string; // e.g. PUR-202611-0001
  supplierId: string;
  supplierSnapshot: PurchaseSupplierSnapshot;
  supplierInvoiceNumber: string;
  supplierInvoiceDate: string;
  purchaseDate: string;
  items: IPurchaseItem[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  receivedQty: number;
  recognizedInvoiceValue: number; // Sum of recognized value for received items
  amountPaid: number; // Upfront payment recorded on invoice
  paymentMethod?: "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE";
  paymentReference?: string;
  outstandingAmount: number; // Math.max(0, recognizedInvoiceValue - amountPaid)
  paymentStatus: PurchasePaymentStatus;
  status: PurchaseStatus;
  advanceAdjustments?: IPurchaseAdvanceAdjustment[];
  receipts?: IPurchaseReceipt[];
  amendments: IPurchaseAmendment[];
  notes?: string;
  createdById?: string;
  updatedById?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PurchaseFilterParams {
  search?: string;
  supplierId?: string;
  status?: PurchaseStatus;
  paymentStatus?: PurchasePaymentStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  sortBy?:
    | "purchaseDate"
    | "grandTotal"
    | "purchaseNumber"
    | "createdAt"
    | "supplierInvoiceDate"
    | "outstandingAmount";
  sortOrder?: "asc" | "desc";
}
