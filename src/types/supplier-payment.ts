export type SupplierPaymentMethod = "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE";

export type SupplierPaymentStatus = "RECORDED" | "REVERSED";

export interface IPaymentAllocation {
  purchaseId: string;
  purchaseNumber: string;
  supplierInvoiceNumber: string;
  allocatedAmount: number;
}

export interface IAdvanceAdjustmentRecord {
  purchaseId: string;
  purchaseNumber: string;
  supplierInvoiceNumber?: string;
  amount: number;
  adjustedAt: string | Date;
}

export interface ISupplierPayment {
  id: string;
  _id?: string;
  paymentNumber: string; // Sequential: PAY-YYYYMM-XXXX
  supplierId: string;
  supplierSnapshot: {
    name: string;
    phone: string;
    gstin?: string;
  };
  paymentDate: string | Date;
  amount: number;
  paymentMethod: SupplierPaymentMethod;
  paymentReference?: string;
  allocations: IPaymentAllocation[];
  unallocatedAmount: number; // Initial advance created from this payment
  advanceRemaining: number; // Remaining unused advance from this payment
  advanceConsumed: number; // Amount of this payment's advance absorbed by purchases
  advanceAdjustments?: IAdvanceAdjustmentRecord[];
  isExcessUpfrontCredit?: boolean; // True if automatically generated from excess purchase upfront payment
  notes?: string;
  status: SupplierPaymentStatus;
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

export interface CreatePaymentAllocationInput {
  purchaseId: string;
  amount: number;
}

export interface CreateSupplierPaymentInput {
  supplierId: string;
  paymentDate?: string | Date;
  amount: number;
  paymentMethod: SupplierPaymentMethod;
  paymentReference?: string;
  allocations?: CreatePaymentAllocationInput[];
  notes?: string;
  idempotencyKey?: string;
}

export interface ReverseSupplierPaymentInput {
  paymentId: string;
  reason: string;
}

export interface SupplierPaymentFilterParams {
  search?: string;
  supplierId?: string;
  paymentMethod?: SupplierPaymentMethod;
  status?: SupplierPaymentStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

