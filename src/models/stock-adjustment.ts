import mongoose, { Document, Model, Schema } from "mongoose";
import { StockAdjustmentReason, StockAdjustmentType } from "@/types/inventory";

export interface IStockAdjustmentDocument extends Document {
  adjustmentNumber: string;
  date: Date;
  productId: mongoose.Types.ObjectId;
  productSnapshot: {
    name: string;
    sku: string;
    primaryUnit: string;
  };
  batchId?: mongoose.Types.ObjectId;
  batchNumber?: string;
  type: StockAdjustmentType;
  previousQuantity: number;
  adjustmentQuantity: number;
  newQuantity: number;
  reason: StockAdjustmentReason;
  explanation: string;
  createdById: mongoose.Types.ObjectId;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const StockAdjustmentSchema = new Schema<IStockAdjustmentDocument>(
  {
    adjustmentNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product is required"],
      index: true,
    },
    productSnapshot: {
      name: { type: String, required: true },
      sku: { type: String, required: true },
      primaryUnit: { type: String, required: true },
    },
    batchId: {
      type: Schema.Types.ObjectId,
      ref: "Batch",
      index: true,
    },
    batchNumber: {
      type: String,
      trim: true,
      uppercase: true,
    },
    type: {
      type: String,
      enum: ["INCREASE", "DECREASE"],
      required: true,
      index: true,
    },
    previousQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    adjustmentQuantity: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    newQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      enum: [
        "PHYSICAL_CORRECTION",
        "DAMAGED_GOODS",
        "EXPIRED_GOODS",
        "STOCK_LOSS",
        "DATA_CORRECTION",
        "OTHER",
      ],
      required: true,
      index: true,
    },
    explanation: {
      type: String,
      required: [true, "Detailed explanation is mandatory"],
      trim: true,
    },
    createdById: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    createdByName: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret: any) => {
        ret.id = ret._id.toString();
        ret.productId = ret.productId?.toString();
        if (ret.batchId) ret.batchId = ret.batchId.toString();
        ret.createdById = ret.createdById?.toString();
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const StockAdjustment: Model<IStockAdjustmentDocument> =
  mongoose.models.StockAdjustment ||
  mongoose.model<IStockAdjustmentDocument>("StockAdjustment", StockAdjustmentSchema);

