import mongoose, { Document, Model, Schema } from "mongoose";
import { SalePaymentMethod, SaleStatus, DiscountType } from "@/types/sale";

export interface ISaleDocument extends Document {
  invoiceNumber: string;
  invoiceDate: Date;
  customerId?: mongoose.Types.ObjectId;
  customerSnapshot?: {
    name: string;
    phone?: string;
    village?: string;
    address?: string;
    gstin?: string;
  };
  isWalkIn: boolean;
  items: Array<{
    productId: mongoose.Types.ObjectId;
    productSnapshot: {
      name: string;
      sku: string;
      brand?: string;
      primaryUnit: string;
    };
    batchId?: mongoose.Types.ObjectId;
    batchNumber?: string;
    expiryDate?: Date;
    quantity: number;
    unit: string;
    unitSellingPrice: number;
    discountType: DiscountType;
    discountValue: number;
    discountAmount: number;
    gstRate: number;
    taxableAmount: number;
    gstAmount: number;
    total: number;
  }>;
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  totalGst: number;
  invoiceDiscount: number;
  roundOff: number;
  grandTotal: number;
  payment: {
    method: SalePaymentMethod;
    cashAmount: number;
    upiAmount: number;
    upiReference?: string;
    creditAmount: number;
    totalPaid: number;
  };
  outstandingAmount: number;
  repaidAmount: number;
  status: SaleStatus;
  notes?: string;
  cancelledAt?: Date;
  cancelledBy?: mongoose.Types.ObjectId;
  cancellationReason?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SaleItemSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product ID is required"],
    },
    productSnapshot: {
      name: { type: String, required: true },
      sku: { type: String, required: true },
      brand: { type: String },
      primaryUnit: { type: String, required: true },
    },
    batchId: {
      type: Schema.Types.ObjectId,
      ref: "Batch",
    },
    batchNumber: {
      type: String,
    },
    expiryDate: {
      type: Date,
    },
    quantity: {
      type: Number,
      required: true,
      min: [0.001, "Quantity must be greater than zero"],
    },
    unit: {
      type: String,
      required: true,
    },
    unitSellingPrice: {
      type: Number,
      required: true,
      min: [0, "Selling price cannot be negative"],
    },
    discountType: {
      type: String,
      enum: ["PERCENT", "FIXED"],
      default: "FIXED",
    },
    discountValue: {
      type: Number,
      default: 0,
      min: [0, "Discount value cannot be negative"],
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: [0, "Discount amount cannot be negative"],
    },
    gstRate: {
      type: Number,
      default: 0,
      min: [0, "GST rate cannot be negative"],
    },
    taxableAmount: {
      type: Number,
      required: true,
    },
    gstAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
    },
  },
  { _id: false }
);

const SalePaymentSchema = new Schema(
  {
    method: {
      type: String,
      enum: ["CASH", "UPI", "CREDIT", "SPLIT"],
      required: true,
      index: true,
    },
    cashAmount: {
      type: Number,
      default: 0,
      min: [0, "Cash amount cannot be negative"],
    },
    upiAmount: {
      type: Number,
      default: 0,
      min: [0, "UPI amount cannot be negative"],
    },
    upiReference: {
      type: String,
      trim: true,
    },
    creditAmount: {
      type: Number,
      default: 0,
      min: [0, "Credit amount cannot be negative"],
    },
    totalPaid: {
      type: Number,
      default: 0,
      min: [0, "Total paid cannot be negative"],
    },
  },
  { _id: false }
);

const SaleSchema = new Schema<ISaleDocument>(
  {
    invoiceNumber: {
      type: String,
      required: [true, "Invoice number is required"],
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    invoiceDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    customerId: {
      type: Schema.Types.ObjectId,
      ref: "Customer",
      index: true,
    },
    customerSnapshot: {
      name: { type: String, required: true },
      phone: { type: String },
      village: { type: String },
      address: { type: String },
      gstin: { type: String },
    },
    isWalkIn: {
      type: Boolean,
      default: false,
      index: true,
    },
    items: {
      type: [SaleItemSchema],
      required: [true, "Sale must contain at least one item"],
      validate: {
        validator: (v: any[]) => Array.isArray(v) && v.length > 0,
        message: "Invoice must have at least one product item",
      },
    },
    subtotal: {
      type: Number,
      required: true,
    },
    totalDiscount: {
      type: Number,
      default: 0,
    },
    taxableAmount: {
      type: Number,
      required: true,
    },
    totalGst: {
      type: Number,
      default: 0,
    },
    invoiceDiscount: {
      type: Number,
      default: 0,
    },
    roundOff: {
      type: Number,
      default: 0,
    },
    grandTotal: {
      type: Number,
      required: true,
      index: true,
    },
    payment: {
      type: SalePaymentSchema,
      required: true,
    },
    outstandingAmount: {
      type: Number,
      default: 0,
      min: [0, "Outstanding amount cannot be negative"],
      index: true,
    },
    repaidAmount: {
      type: Number,
      default: 0,
      min: [0, "Repaid amount cannot be negative"],
    },
    status: {
      type: String,
      enum: ["COMPLETED", "CANCELLED"],
      default: "COMPLETED",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
    cancelledAt: {
      type: Date,
    },
    cancelledBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    cancellationReason: {
      type: String,
      trim: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
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

// Compound indexes for searching and filtering
SaleSchema.index({ invoiceDate: -1, status: 1 });
SaleSchema.index({ customerId: 1, invoiceDate: -1 });

export const Sale: Model<ISaleDocument> =
  mongoose.models.Sale || mongoose.model<ISaleDocument>("Sale", SaleSchema);

