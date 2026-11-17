import mongoose, { Document, Model, Schema } from "mongoose";
import {
  CustomerPaymentMethod,
  CustomerPaymentStatus,
  ICustomerPaymentAllocation,
} from "@/types/customer";

export interface ICustomerPaymentDocument extends Document {
  paymentNumber: string;
  customerId: mongoose.Types.ObjectId;
  customerSnapshot: {
    name: string;
    phone: string;
    village?: string;
  };
  paymentDate: Date;
  amount: number;
  paymentMethod: CustomerPaymentMethod;
  transactionReference?: string;
  allocations: Array<{
    saleId: mongoose.Types.ObjectId;
    invoiceNumber: string;
    invoiceDate: Date;
    allocatedAmount: number;
  }>;
  notes?: string;
  status: CustomerPaymentStatus;
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

const CustomerPaymentAllocationSchema = new Schema(
  {
    saleId: {
      type: Schema.Types.ObjectId,
      ref: "Sale",
      required: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
    },
    invoiceDate: {
      type: Date,
      required: true,
    },
    allocatedAmount: {
      type: Number,
      required: true,
      min: [0.01, "Allocated amount must be positive"],
    },
  },
  { _id: false }
);

const CustomerPaymentSchema = new Schema<ICustomerPaymentDocument>(
  {
    paymentNumber: {
      type: String,
      required: [true, "Payment number is required"],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      required: [true, "Customer ID is required"],
      index: true,
    },
    customerSnapshot: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      village: { type: String },
    },
    paymentDate: {
      type: Date,
      required: true,
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
      required: true,
      index: true,
    },
    transactionReference: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    allocations: {
      type: [CustomerPaymentAllocationSchema],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
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
      reversedByName: { type: String },
    },
    idempotencyKey: {
      type: String,
      trim: true,
      sparse: true,
      unique: true,
    },
    createdById: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    createdByName: {
      type: String,
      required: true,
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

CustomerPaymentSchema.index({ customerId: 1, paymentDate: -1 });

export const CustomerPayment: Model<ICustomerPaymentDocument> =
  mongoose.models.CustomerPayment ||
  mongoose.model<ICustomerPaymentDocument>("CustomerPayment", CustomerPaymentSchema);

