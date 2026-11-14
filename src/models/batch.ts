import mongoose, { Document, Model, Schema } from "mongoose";
import { BatchStatus } from "@/types/product";

export interface IBatchDocument extends Document {
  productId: mongoose.Types.ObjectId;
  batchNumber: string;
  manufacturingDate?: Date;
  expiryDate?: Date;
  quantity: number;
  purchasePrice?: number;
  status: BatchStatus;
  createdAt: Date;
  updatedAt: Date;
}

const BatchSchema = new Schema<IBatchDocument>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product ID is required"],
      index: true,
    },
    batchNumber: {
      type: String,
      required: [true, "Batch number is required"],
      trim: true,
      uppercase: true,
    },
    manufacturingDate: {
      type: Date,
    },
    expiryDate: {
      type: Date,
      index: true,
    },
    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Batch quantity cannot be negative"],
    },
    purchasePrice: {
      type: Number,
      min: [0, "Purchase price cannot be negative"],
    },
    status: {
      type: String,
      enum: ["ACTIVE", "DEPLETED", "EXPIRED"],
      default: "ACTIVE",
      index: true,
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

// Enforce unique batch number within the same product
BatchSchema.index({ productId: 1, batchNumber: 1 }, { unique: true });

export const Batch: Model<IBatchDocument> =
  mongoose.models.Batch || mongoose.model<IBatchDocument>("Batch", BatchSchema);
