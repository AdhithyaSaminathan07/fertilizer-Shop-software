import mongoose, { Document, Model, Schema } from "mongoose";
import { ProductUnit, ProductStatus, UnitConversion } from "@/types/product";

export interface IProductDocument extends Document {
  name: string;
  sku: string;
  barcode?: string;
  brand: string;
  categoryId: mongoose.Types.ObjectId;
  description?: string;
  purchasePrice: number;
  sellingPrice: number;
  primaryUnit: ProductUnit;
  unitConversion?: UnitConversion;
  minStockThreshold: number;
  status: ProductStatus;
  currentStock: number;
  createdAt: Date;
  updatedAt: Date;
}

const UnitConversionSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    baseUnit: {
      type: String,
      enum: ["BAGS", "KG", "G", "L", "ML", "PIECES", "BOXES", "BOTTLES", "CANS", "PACKETS"],
    },
    conversionRatio: { type: Number, min: 0.001 },
  },
  { _id: false }
);

const ProductSchema = new Schema<IProductDocument>(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      minlength: [2, "Product name must be at least 2 characters"],
      maxlength: [150, "Product name cannot exceed 150 characters"],
      index: true,
    },
    sku: {
      type: String,
      required: [true, "SKU is required"],
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
    },
    barcode: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
      index: true,
    },
    brand: {
      type: String,
      required: [true, "Brand/Manufacturer is required"],
      trim: true,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Category is required"],
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    purchasePrice: {
      type: Number,
      required: [true, "Purchase price is required"],
      min: [0, "Purchase price cannot be negative"],
    },
    sellingPrice: {
      type: Number,
      required: [true, "Selling price is required"],
      min: [0, "Selling price cannot be negative"],
    },
    primaryUnit: {
      type: String,
      required: [true, "Primary unit of measurement is required"],
      enum: ["BAGS", "KG", "G", "L", "ML", "PIECES", "BOXES", "BOTTLES", "CANS", "PACKETS"],
      default: "BAGS",
    },
    unitConversion: {
      type: UnitConversionSchema,
      default: { enabled: false },
    },
    minStockThreshold: {
      type: Number,
      default: 10,
      min: [0, "Minimum threshold cannot be negative"],
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "ARCHIVED"],
      default: "ACTIVE",
      index: true,
    },
    currentStock: {
      type: Number,
      default: 0,
      min: [0, "Stock cannot be negative"],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret: any) => {
        ret.id = ret._id.toString();
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound text search index for high-performance searching
ProductSchema.index({ name: "text", brand: "text", sku: "text" });

export const Product: Model<IProductDocument> =
  mongoose.models.Product || mongoose.model<IProductDocument>("Product", ProductSchema);
