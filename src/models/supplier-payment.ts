import mongoose, { Document, Model, Schema } from "mongoose";
import type {
  SupplierPaymentMethod,
  SupplierPaymentStatus,
  IPaymentAllocation,
} from "@/types/supplier-payment";

export interface ISupplierPaymentAllocationDoc {
  purchaseId: mongoose.Types.ObjectId | string;
  purchaseNumber: string;
  supplierInvoiceNumber: string;
  allocatedAmount: number;
}

export interface IAdvanceAdjustmentDoc {
  purchaseId: mongoose.Types.ObjectId | string;
  purchaseNumber: string;
  supplierInvoiceNumber?: string;
  amount: number;
  adjustedAt: Date;
}

export interface ISupplierPaymentDocument extends Document {
  paymentNumber: string;
  supplierId: mongoose.Types.ObjectId;
  supplierSnapshot: {
    name: string;
    phone: string;
    gstin?: string;
  };
  paymentDate: Date;
  amount: number;
  paymentMethod: SupplierPaymentMethod;
  paymentReference?: string;
  allocations: ISupplierPaymentAllocationDoc[];
  unallocatedAmount: number;
  advanceRemaining: number;
  advanceConsumed: number;
  advanceAdjustments: IAdvanceAdjustmentDoc[];
  notes?: string;
  status: SupplierPaymentStatus;
  reversal?: {
    reason: string;
    reversedAt: Date;
    reversedById: mongoose.Types.ObjectId;
    reversedByName: string;
  };
  idempotencyKey?: string;
  createdById: mongoose.Types.ObjectId;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentAllocationSchema = new Schema(
  {
    purchaseId: {
      type: Schema.Types.ObjectId,
      ref: "Purchase",
      required: true,
    },
    purchaseNumber: {
      type: String,
      required: true,
      trim: true,
    },
    supplierInvoiceNumber: {
      type: String,
      required: true,
      trim: true,
    },
    allocatedAmount: {
      type: Number,
      required: true,
      min: [0.01, "Allocated amount must be positive"],
    },
  },
  { _id: false }
);

const AdvanceAdjustmentSchema = new Schema(
  {
    purchaseId: {
      type: Schema.Types.ObjectId,
      ref: "Purchase",
      required: true,
    },
    purchaseNumber: {
      type: String,
      required: true,
      trim: true,
    },
    supplierInvoiceNumber: {
      type: String,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0.01, "Adjustment amount must be positive"],
    },
    adjustedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const SupplierPaymentSchema = new Schema<ISupplierPaymentDocument>(
  {
    paymentNumber: {
      type: String,
      required: [true, "Payment number is required"],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: [true, "Supplier is mandatory"],
      index: true,
    },
    supplierSnapshot: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      gstin: { type: String },
    },
    paymentDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, "Payment amount is required"],
      min: [0.01, "Payment amount must be greater than zero"],
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "UPI", "BANK_TRANSFER", "CHEQUE"],
      required: [true, "Payment method is required"],
      index: true,
    },
    paymentReference: {
      type: String,
      trim: true,
      maxlength: [100, "Payment reference cannot exceed 100 characters"],
    },
    allocations: {
      type: [PaymentAllocationSchema],
      default: [],
    },
    unallocatedAmount: {
      type: Number,
      default: 0,
      min: [0, "Unallocated amount cannot be negative"],
    },
    advanceRemaining: {
      type: Number,
      default: 0,
      min: [0, "Remaining advance cannot be negative"],
      index: true,
    },
    advanceConsumed: {
      type: Number,
      default: 0,
      min: [0, "Consumed advance cannot be negative"],
    },
    advanceAdjustments: {
      type: [AdvanceAdjustmentSchema],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
    status: {
      type: String,
      enum: ["RECORDED", "REVERSED"],
      default: "RECORDED",
      index: true,
    },
    reversal: {
      reason: { type: String, trim: true },
      reversedAt: { type: Date },
      reversedById: { type: Schema.Types.ObjectId, ref: "User" },
      reversedByName: { type: String, trim: true },
    },
    idempotencyKey: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
      index: true,
    },
    createdById: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Created by user ID is required"],
    },
    createdByName: {
      type: String,
      required: [true, "Created by user name is required"],
      trim: true,
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

SupplierPaymentSchema.index({ supplierId: 1, paymentDate: -1 });
SupplierPaymentSchema.index({ supplierId: 1, status: 1, advanceRemaining: 1 });
SupplierPaymentSchema.index({ status: 1, paymentDate: -1 });

export const SupplierPayment: Model<ISupplierPaymentDocument> =
  mongoose.models.SupplierPayment ||
  mongoose.model<ISupplierPaymentDocument>("SupplierPayment", SupplierPaymentSchema);
