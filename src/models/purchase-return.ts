import mongoose, { Document, Model, Schema } from "mongoose";
import type {
  IPurchaseReturnItem,
  IReturnStatusHistory,
  PurchaseReturnReason,
  ReturnItemCondition,
  PurchaseReturnSupplierResponse,
  ReturnStatus,
} from "@/types/returns";

export interface IPurchaseReturnDocument extends Document {
  returnNumber: string;
  returnDate: Date;
  purchaseId: mongoose.Types.ObjectId;
  purchaseNumber: string;
  supplierInvoiceNumber: string;
  supplierInvoiceDate?: Date;
  purchaseDate: Date;
  supplierSnapshot: {
    id?: mongoose.Types.ObjectId;
    name: string;
    phone?: string;
    gstin?: string;
  };
  items: (IPurchaseReturnItem & {
    productId: mongoose.Types.ObjectId;
  })[];
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  returnTotal: number;
  supplierResponse: PurchaseReturnSupplierResponse;
  supplierCreditNoteNumber?: string;
  supplierCreditNoteDate?: Date;
  status: ReturnStatus;
  statusHistory: IReturnStatusHistory[];
  generalReason?: PurchaseReturnReason;
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

const PurchaseReturnItemSchema = new Schema(
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
    },
    batchNumber: { type: String, uppercase: true, trim: true },
    originalPurchasedQty: { type: Number, required: true, min: 0 },
    previouslyReturnedQty: { type: Number, required: true, default: 0, min: 0 },
    returnQty: { type: Number, required: true, min: 0.0001 },
    unitPurchasePrice: { type: Number, required: true, min: 0 },
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
        "QUALITY_REJECTED",
        "SUPPLIER_RECALL",
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

const PurchaseReturnSchema = new Schema<IPurchaseReturnDocument>(
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
    purchaseId: {
      type: Schema.Types.ObjectId,
      ref: "Purchase",
      required: true,
      index: true,
    },
    purchaseNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    supplierInvoiceNumber: {
      type: String,
      required: true,
      trim: true,
    },
    supplierInvoiceDate: {
      type: Date,
    },
    purchaseDate: {
      type: Date,
      required: true,
    },
    supplierSnapshot: {
      id: { type: Schema.Types.ObjectId, ref: "Supplier" },
      name: { type: String, required: true },
      phone: { type: String, default: "" },
      gstin: { type: String, default: "" },
    },
    items: [PurchaseReturnItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    discountTotal: { type: Number, required: true, default: 0, min: 0 },
    taxTotal: { type: Number, required: true, default: 0, min: 0 },
    returnTotal: { type: Number, required: true, min: 0 },
    supplierResponse: {
      type: String,
      enum: [
        "REFUND_EXPECTED",
        "CREDIT_NOTE_EXPECTED",
        "REPLACEMENT_EXPECTED",
        "PENDING_CONFIRMATION",
        "OTHER",
      ],
      required: true,
      default: "PENDING_CONFIRMATION",
    },
    supplierCreditNoteNumber: { type: String, trim: true },
    supplierCreditNoteDate: { type: Date },
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
        "QUALITY_REJECTED",
        "SUPPLIER_RECALL",
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
        ret.purchaseId = ret.purchaseId?.toString();
        ret.createdById = ret.createdById?.toString();
        if (ret.supplierSnapshot?.id) ret.supplierSnapshot.id = ret.supplierSnapshot.id.toString();
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

export const PurchaseReturn: Model<IPurchaseReturnDocument> =
  mongoose.models.PurchaseReturn ||
  mongoose.model<IPurchaseReturnDocument>("PurchaseReturn", PurchaseReturnSchema);

