import mongoose, { Document, Model, Schema } from "mongoose";
import { StockCountStatus, IStockCountItem } from "@/types/inventory";

export interface IStockCountSessionDocument extends Document {
  sessionNumber: string;
  title: string;
  status: StockCountStatus;
  notes?: string;
  categoryIds?: mongoose.Types.ObjectId[];
  items: IStockCountItem[];
  createdById: mongoose.Types.ObjectId;
  createdByName: string;
  submittedAt?: Date;
  approvedAt?: Date;
  approvedById?: mongoose.Types.ObjectId;
  approvedByName?: string;
  approvalNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StockCountItemSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    categoryName: { type: String, default: "" },
    unit: { type: String, default: "" },
    systemStockAtStart: { type: Number, required: true, min: 0 },
    countedStock: { type: Number, required: true, min: 0 },
    variance: { type: Number, required: true },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const StockCountSessionSchema = new Schema<IStockCountSessionDocument>(
  {
    sessionNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"],
      default: "DRAFT",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    categoryIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Category",
      },
    ],
    items: [StockCountItemSchema],
    createdById: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdByName: {
      type: String,
      required: true,
      trim: true,
    },
    submittedAt: { type: Date },
    approvedAt: { type: Date },
    approvedById: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    approvedByName: { type: String, trim: true },
    approvalNotes: { type: String, trim: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret: any) => {
        ret.id = ret._id.toString();
        ret.createdById = ret.createdById?.toString();
        if (ret.approvedById) ret.approvedById = ret.approvedById.toString();
        if (ret.categoryIds) {
          ret.categoryIds = ret.categoryIds.map((c: any) => c.toString());
        }
        if (ret.items) {
          ret.items = ret.items.map((item: any) => ({
            ...item,
            productId: item.productId?.toString(),
          }));
        }
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const StockCountSession: Model<IStockCountSessionDocument> =
  mongoose.models.StockCountSession ||
  mongoose.model<IStockCountSessionDocument>("StockCountSession", StockCountSessionSchema);

