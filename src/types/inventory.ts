export type StockAdjustmentReason =
  | "PHYSICAL_CORRECTION"
  | "DAMAGED_GOODS"
  | "EXPIRED_GOODS"
  | "STOCK_LOSS"
  | "DATA_CORRECTION"
  | "OTHER";

export type StockAdjustmentType = "INCREASE" | "DECREASE";

export interface IStockAdjustment {
  _id: string;
  id?: string;
  adjustmentNumber: string;
  date: string;
  productId: string;
  productSnapshot: {
    name: string;
    sku: string;
    primaryUnit: string;
  };
  batchId?: string;
  batchNumber?: string;
  type: StockAdjustmentType;
  previousQuantity: number;
  adjustmentQuantity: number;
  newQuantity: number;
  reason: StockAdjustmentReason;
  explanation: string;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface IStockAdjustmentInput {
  productId: string;
  batchId?: string;
  type: StockAdjustmentType;
  adjustmentQuantity: number;
  reason: StockAdjustmentReason;
  explanation: string;
}

export interface IStockCountItem {
  productId: string;
  productName: string;
  sku: string;
  categoryName: string;
  unit: string;
  systemStockAtStart: number;
  countedStock: number;
  variance: number;
  notes?: string;
}

export type StockCountStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";

export interface IStockCountSession {
  _id: string;
  id?: string;
  sessionNumber: string;
  title: string;
  status: StockCountStatus;
  notes?: string;
  categoryIds?: string[];
  items: IStockCountItem[];
  createdById: string;
  createdByName: string;
  submittedAt?: string;
  approvedAt?: string;
  approvedById?: string;
  approvedByName?: string;
  approvalNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IStockCountCreateInput {
  title: string;
  notes?: string;
  categoryIds?: string[];
}

export interface IStockCountUpdateInput {
  title?: string;
  notes?: string;
  items: Array<{
    productId: string;
    countedStock: number;
    notes?: string;
  }>;
}

export interface ILowStockItem {
  productId: string;
  name: string;
  sku: string;
  brand: string;
  categoryName: string;
  primaryUnit: string;
  currentStock: number;
  minStockThreshold: number;
  preferredReorderQty?: number;
  stockStatus: "OUT_OF_STOCK" | "LOW_STOCK" | "ADEQUATE";
  suggestedReorderQty: number;
}

export type ExpiryBucket =
  | "EXPIRED"
  | "EXPIRING_7D"
  | "EXPIRING_30D"
  | "EXPIRING_60D"
  | "EXPIRING_LATER";

export interface IExpiryBatchItem {
  batchId: string;
  batchNumber: string;
  productId: string;
  productName: string;
  sku: string;
  brand: string;
  categoryName: string;
  primaryUnit: string;
  quantity: number;
  unitCost: number;
  totalValuation: number;
  manufacturingDate?: string;
  expiryDate: string;
  expiryBucket: ExpiryBucket;
  daysRemaining: number;
}

export interface IInventoryValuation {
  totalValuation: number;
  totalQuantity: number;
  byCategory: Array<{
    categoryId: string;
    categoryName: string;
    productCount: number;
    quantity: number;
    valuation: number;
  }>;
  byProduct: Array<{
    productId: string;
    name: string;
    sku: string;
    categoryName: string;
    primaryUnit: string;
    currentStock: number;
    averageUnitCost: number;
    valuation: number;
  }>;
}

export type StockMovementType =
  | "PURCHASE_INWARD"
  | "SALE_DEDUCTION"
  | "SALE_CANCELLATION_RESTORE"
  | "STOCK_ADJUSTMENT_INCREASE"
  | "STOCK_ADJUSTMENT_DECREASE"
  | "DAMAGE_WRITEOFF"
  | "EXPIRED_WRITEOFF"
  | "STOCK_COUNT_RECONCILIATION";

export interface IStockMovement {
  id: string;
  date: string;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  batchNumber?: string;
  movementType: StockMovementType;
  quantityIn: number;
  quantityOut: number;
  resultingQuantity?: number;
  sourceReference: string;
  recordedByName: string;
  notes?: string;
}

export interface IInventoryOverview {
  totalActiveProducts: number;
  totalStockQuantity: number;
  totalInventoryValuation: number;
  lowStockCount: number;
  outOfStockCount: number;
  nearExpiryBatchesCount: number;
  expiredBatchesCount: number;
  recentlyReceivedStock: Array<{
    purchaseNumber: string;
    supplierName: string;
    inwardDate: string;
    itemCount: number;
    totalQuantity: number;
  }>;
  recentMovements: IStockMovement[];
}
