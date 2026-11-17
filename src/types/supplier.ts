export type SupplierStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

export interface SupplierAddress {
  street?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export interface ISupplier {
  id: string;
  _id?: string;
  name: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: SupplierAddress;
  gstin?: string;
  notes?: string;
  status: SupplierStatus;
  totalPurchases: number;
  totalPaid: number;
  outstandingBalance: number;
  advanceBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierFilterParams {
  search?: string;
  status?: SupplierStatus;
  page?: number;
  limit?: number;
  sortBy?: "name" | "outstandingBalance" | "createdAt" | "totalPurchases";
  sortOrder?: "asc" | "desc";
}

