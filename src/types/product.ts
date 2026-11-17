export type ProductUnit =
  | "BAGS"
  | "KG"
  | "G"
  | "L"
  | "ML"
  | "PIECES"
  | "BOXES"
  | "BOTTLES"
  | "CANS"
  | "PACKETS";

export type UnitDimension = "MASS" | "VOLUME" | "COUNT";

export interface UnitConversion {
  enabled: boolean;
  baseUnit?: ProductUnit;
  conversionRatio?: number; // 1 primaryUnit = conversionRatio baseUnits (e.g. 1 BAG = 50 KG)
}

export type CategoryStatus = "ACTIVE" | "INACTIVE";

export interface ICategory {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  status: CategoryStatus;
  productCount?: number;
  createdAt: string;
  updatedAt: string;
}

export type ProductStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";
export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export interface IProduct {
  _id: string;
  name: string;
  sku: string;
  barcode?: string;
  brand: string;
  categoryId: string;
  category?: {
    _id: string;
    name: string;
  };
  description?: string;
  purchasePrice: number;
  sellingPrice: number;
  margin?: number;
  marginPercent?: number;
  primaryUnit: ProductUnit;
  unitConversion?: UnitConversion;
  minStockThreshold: number;
  preferredReorderQty?: number;
  status: ProductStatus;
  currentStock: number;
  stockStatus: StockStatus;
  batches?: IBatch[];
  createdAt: string;
  updatedAt: string;
}

export type BatchStatus = "ACTIVE" | "DEPLETED" | "EXPIRED";

export interface IBatch {
  _id: string;
  productId: string;
  batchNumber: string;
  manufacturingDate?: string;
  expiryDate?: string;
  quantity: number;
  purchasePrice?: number;
  status: BatchStatus;
  createdAt: string;
  updatedAt: string;
}
