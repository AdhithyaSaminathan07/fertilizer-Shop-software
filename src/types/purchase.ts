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
  brand: string;
  primaryUnit: ProductUnit | string;
  barcode?: string;
}

export interface IPurchaseItem {
  id?: string;
  productId: string;
  productSnapshot: PurchaseProductSnapshot;
  orderedQty: number;
  receivedQty: number;
  unit: ProductUnit | string;
  unitPurchasePrice: number;
  discountAmount: number;
  taxRate: number; // percentage e.g. 0, 5, 12, 18, 28
  taxAmount: number;
  lineTotal: number;
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

export interface IPurchase {
  id: string;
  _id?: string;
  purchaseNumber: string;
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
  recognizedInvoiceValue: number;
  amountPaid: number;
  paymentStatus: PurchasePaymentStatus;
  status: PurchaseStatus;
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
  sortBy?: "purchaseDate" | "grandTotal" | "purchaseNumber" | "createdAt" | "supplierInvoiceDate";
  sortOrder?: "asc" | "desc";
}
