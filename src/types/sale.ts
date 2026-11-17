export type SalePaymentMethod = "CASH" | "UPI" | "CREDIT" | "SPLIT";
export type SaleStatus = "COMPLETED" | "CANCELLED";
export type DiscountType = "PERCENT" | "FIXED";

export interface ISaleItemSnapshot {
  name: string;
  sku: string;
  brand?: string;
  primaryUnit: string;
}

export interface ISaleItem {
  productId: string;
  productSnapshot: ISaleItemSnapshot;
  batchId?: string;
  batchNumber?: string;
  expiryDate?: string | Date;
  quantity: number;
  unit: string;
  unitSellingPrice: number;
  discountType: DiscountType;
  discountValue: number;
  discountAmount: number;
  gstRate: number;
  taxableAmount: number;
  gstAmount: number;
  total: number;
}

export interface ISaleCustomerSnapshot {
  name: string;
  phone?: string;
  village?: string;
  address?: string;
  gstin?: string;
}

export interface ISalePayment {
  method: SalePaymentMethod;
  cashAmount: number;
  upiAmount: number;
  upiReference?: string;
  creditAmount: number;
  totalPaid: number;
}

export interface ISale {
  _id: string;
  invoiceNumber: string;
  invoiceDate: string | Date;
  customerId?: string;
  customerSnapshot?: ISaleCustomerSnapshot;
  isWalkIn: boolean;
  items: ISaleItem[];
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  totalGst: number;
  invoiceDiscount: number;
  roundOff: number;
  grandTotal: number;
  payment: ISalePayment;
  status: SaleStatus;
  notes?: string;
  cancelledAt?: string | Date;
  cancelledBy?: string;
  cancellationReason?: string;
  createdBy: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ISaleCreateItemInput {
  productId: string;
  batchId?: string;
  quantity: number;
  unit?: string;
  unitSellingPrice: number;
  discountType?: DiscountType;
  discountValue?: number;
  gstRate?: number;
}

export interface ISaleCreateInput {
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerVillage?: string;
  isWalkIn?: boolean;
  items: ISaleCreateItemInput[];
  invoiceDiscount?: number;
  roundOff?: number;
  payment: {
    method: SalePaymentMethod;
    cashAmount?: number;
    upiAmount?: number;
    upiReference?: string;
    creditAmount?: number;
  };
  notes?: string;
}

export interface ISalesFilterParams {
  search?: string;
  customerId?: string;
  paymentMethod?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface ISalesDashboardKPIs {
  todaySalesCount: number;
  todaySalesAmount: number;
  todayCashAmount: number;
  todayUpiAmount: number;
  todayCreditAmount: number;
  totalOutstandingCredit: number;
}

