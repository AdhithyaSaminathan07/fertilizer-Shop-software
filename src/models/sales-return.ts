import mongoose, { Document, Model, Schema } from "mongoose";
import type {
  ISalesReturnItem,
  IReturnStatusHistory,
  SalesReturnReason,
  ReturnItemCondition,
  SalesReturnRefundMethod,
  ReturnStatus,
} from "@/types/returns";

export interface ISalesReturnDocument extends Document {
  returnNumber: string;
  returnDate: Date;
  saleId: mongoose.Types.ObjectId;
  saleNumber: string;
  saleDate: Date;
  customerSnapshot: {
    id?: mongoose.Types.ObjectId;
    name: string;
    mobile?: string;
    village?: string;
    gstin?: string;
  };
  items: (ISalesReturnItem & {
    productId: mongoose.Types.ObjectId;
  })[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  refundTotal: number;
  refundMethod: SalesReturnRefundMethod;
  refundReference?: string;
  status: ReturnStatus;
  statusHistory: IReturnStatusHistory[];
  generalReason?: SalesReturnReason;
  remarks?: string;
  createdById: mongoose.Types.ObjectId;
  createdByName: string;
  approvedById?: mongoose.Types.ObjectId;
  approvedByName?: string;
  approvedAt?: Date;
  rejectedById?: mongoose.Types.ObjectId;
  rejectedByName?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  cancelledById?: mongoose.Types.ObjectId;
  cancelledByName?: string;
  cancelledAt?: Date;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SalesReturnItemSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productSnapshot: {
      name: { type: String, required: true },
      sku: { type: String, required: true },
      primaryUnit: { type: String, required: true },
      hsnCode: { type: String, default: "" },
    },
    batchNumber: { type: String, uppercase: true, trim: true },
    originalSoldQty: { type: Number, required: true, min: 0 },
    previouslyReturnedQty: { type: Number, required: true, default: 0, min: 0 },
    returnQty: { type: Number, required: true, min: 0.0001 },
    unitSellingPrice: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, required: true, default: 0, min: 0 },
    taxRate: { type: Number, required: true, default: 0, min: 0 },
    taxableAmount: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, default: 0, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    reason: {
      type: String,
      enum: [
        "DAMAGED",
        "DEFECTIVE",
        "WRONG_PRODUCT",
        "EXPIRED",
        "CUSTOMER_CHANGED_MIND",
        "OTHER",
      ],
      required: true,
    },
    condition: {
      type: String,
      enum: ["SALEABLE", "DAMAGED", "DEFECTIVE", "OTHER"],
      required: true,
      default: "SALEABLE",
    },
    remarks: { type: String, trim: true },
  },
  { _id: false }
);

const ReturnStatusHistorySchema = new Schema(
  {
    status: {
      type: String,
      enum: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"],
      required: true,
    },
    changedAt: { type: Date, required: true, default: Date.now },
    changedById: { type: Schema.Types.ObjectId, ref: "User", required: true },
    changedByName: { type: String, required: true },
    reason: { type: String, trim: true },
  },
  { _id: false }
);

const SalesReturnSchema = new Schema<ISalesReturnDocument>(
  {
    returnNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    returnDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    saleId: {
      type: Schema.Types.ObjectId,
      ref: "Sale",
      required: true,
      index: true,
    },
    saleNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    saleDate: {
      type: Date,
      required: true,
    },
    customerSnapshot: {
      id: { type: Schema.Types.ObjectId, ref: "Customer" },
      name: { type: String, required: true },
      mobile: { type: String, default: "" },
      village: { type: String, default: "" },
      gstin: { type: String, default: "" },
    },
    items: [SalesReturnItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    discountTotal: { type: Number, required: true, default: 0, min: 0 },
    taxTotal: { type: Number, required: true, default: 0, min: 0 },
    refundTotal: { type: Number, required: true, min: 0 },
    refundMethod: {
      type: String,
      enum: ["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "CREDIT_NOTE"],
      required: true,
      default: "CASH",
    },
    refundReference: { type: String, trim: true },
    status: {
      type: String,
      enum: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"],
      default: "DRAFT",
      index: true,
    },
    statusHistory: [ReturnStatusHistorySchema],
    generalReason: {
      type: String,
      enum: [
        "DAMAGED",
        "DEFECTIVE",
        "WRONG_PRODUCT",
        "EXPIRED",
        "CUSTOMER_CHANGED_MIND",
        "OTHER",
      ],
    },
    remarks: { type: String, trim: true },
    createdById: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdByName: { type: String, required: true, trim: true },
    approvedById: { type: Schema.Types.ObjectId, ref: "User" },
    approvedByName: { type: String, trim: true },
    approvedAt: { type: Date },
    rejectedById: { type: Schema.Types.ObjectId, ref: "User" },
    rejectedByName: { type: String, trim: true },
    rejectedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
    cancelledById: { type: Schema.Types.ObjectId, ref: "User" },
    cancelledByName: { type: String, trim: true },
    cancelledAt: { type: Date },
    cancellationReason: { type: String, trim: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret: any) => {
        ret.id = ret._id.toString();
        ret.saleId = ret.saleId?.toString();
        ret.createdById = ret.createdById?.toString();
        if (ret.customerSnapshot?.id) ret.customerSnapshot.id = ret.customerSnapshot.id.toString();
        if (ret.approvedById) ret.approvedById = ret.approvedById.toString();
        if (ret.rejectedById) ret.rejectedById = ret.rejectedById.toString();
        if (ret.cancelledById) ret.cancelledById = ret.cancelledById.toString();
        if (ret.items) {
          ret.items = ret.items.map((it: any) => ({
            ...it,
            productId: it.productId?.toString(),
          }));
        }
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const SalesReturn: Model<ISalesReturnDocument> =
  mongoose.models.SalesReturn ||
  mongoose.model<ISalesReturnDocument>("SalesReturn", SalesReturnSchema);

