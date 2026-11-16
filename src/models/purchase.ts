import mongoose, { Document, Model, Schema } from "mongoose";
import type {
  PurchaseStatus,
  PurchasePaymentStatus,
  PurchaseSupplierSnapshot,
  PurchaseProductSnapshot,
  IPurchaseItem,
  IPurchaseAmendment,
} from "@/types/purchase";

export interface IPurchaseDocument extends Document {
  purchaseNumber: string;
  supplierId: mongoose.Types.ObjectId;
  supplierSnapshot: PurchaseSupplierSnapshot;
  supplierInvoiceNumber: string;
  supplierInvoiceDate: Date;
  purchaseDate: Date;
  items: (IPurchaseItem & { _id: mongoose.Types.ObjectId })[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  grandTotal: number;
  receivedQty: number;
  recognizedInvoiceValue: number;
  amountPaid: number;
  paymentStatus: PurchasePaymentStatus;
  status: PurchaseStatus;
  amendments: IPurchaseAmendment[];
  notes?: string;
  createdById?: mongoose.Types.ObjectId;
  updatedById?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SupplierSnapshotSchema = new Schema(
  {
    name: { type: String, required: true },
    contactPerson: String,
    phone: { type: String, required: true },
    email: String,
    gstin: String,
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
    },
  },
  { _id: false }
);

const ProductSnapshotSchema = new Schema(
  {
    name: { type: String, required: true },
    sku: String,
    brand: { type: String, required: true },
    primaryUnit: { type: String, required: true },
    barcode: String,
  },
  { _id: false }
);

const PurchaseItemSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    productSnapshot: {
      type: ProductSnapshotSchema,
      required: true,
    },
    orderedQty: {
      type: Number,
      required: true,
      min: [0.001, "Ordered quantity must be greater than zero"],
    },
    receivedQty: {
      type: Number,
      default: 0,
      min: [0, "Received quantity cannot be negative"],
    },
    unit: {
      type: String,
      required: true,
    },
    unitPurchasePrice: {
      type: Number,
      required: true,
      min: [0, "Unit purchase price cannot be negative"],
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"],
    },
    taxRate: {
      type: Number,
      default: 0,
      min: [0, "Tax rate cannot be negative"],
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: [0, "Tax amount cannot be negative"],
    },
    lineTotal: {
      type: Number,
      required: true,
      min: [0, "Line total cannot be negative"],
    },
  },
  {
    _id: true,
    toJSON: {
      transform: (_, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : undefined;
        return ret;
      },
    },
  }
);

const AmendmentSchema = new Schema(
  {
    amendmentNumber: { type: Number, required: true },
    amendedAt: { type: Date, default: Date.now },
    amendedById: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amendedByName: { type: String, required: true },
    reason: { type: String, required: true },
    previousItems: [PurchaseItemSchema],
    revisedItems: [PurchaseItemSchema],
    previousGrandTotal: { type: Number, required: true },
    revisedGrandTotal: { type: Number, required: true },
  },
  { _id: false }
);

const PurchaseSchema = new Schema<IPurchaseDocument>(
  {
    purchaseNumber: {
      type: String,
      required: [true, "Purchase number is required"],
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
      type: SupplierSnapshotSchema,
      required: true,
    },
    supplierInvoiceNumber: {
      type: String,
      required: [true, "Supplier invoice number is required"],
      trim: true,
    },
    supplierInvoiceDate: {
      type: Date,
      required: [true, "Supplier invoice date is required"],
    },
    purchaseDate: {
      type: Date,
      default: Date.now,
      index: true,
    },
    items: {
      type: [PurchaseItemSchema],
      required: true,
      validate: {
        validator: (items: any[]) => items && items.length > 0,
        message: "At least one product item is required for a purchase",
      },
    },
    subtotal: {
      type: Number,
      required: true,
      min: [0, "Subtotal cannot be negative"],
    },
    discountAmount: {
      type: Number,
      default: 0,
      min: [0, "Total discount cannot be negative"],
    },
    taxAmount: {
      type: Number,
      default: 0,
      min: [0, "Total tax cannot be negative"],
    },
    grandTotal: {
      type: Number,
      required: true,
      min: [0, "Grand total cannot be negative"],
    },
    receivedQty: {
      type: Number,
      default: 0,
      min: [0, "Received quantity cannot be negative"],
    },
    recognizedInvoiceValue: {
      type: Number,
      default: 0,
      min: [0, "Recognized invoice value cannot be negative"],
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: [0, "Amount paid cannot be negative"],
    },
    paymentStatus: {
      type: String,
      enum: ["UNPAID", "PARTIALLY_PAID", "PAID"],
      default: "UNPAID",
      index: true,
    },
    status: {
      type: String,
      enum: ["DRAFT", "PENDING_RECEIPT", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"],
      default: "DRAFT",
      index: true,
    },
    amendments: {
      type: [AmendmentSchema],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
    createdById: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    updatedById: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : undefined;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Enforce unique invoice number per supplier
PurchaseSchema.index(
  { supplierId: 1, supplierInvoiceNumber: 1 },
  { unique: true }
);

// Compound search index
PurchaseSchema.index({
  purchaseNumber: "text",
  supplierInvoiceNumber: "text",
  "supplierSnapshot.name": "text",
});

export const Purchase: Model<IPurchaseDocument> =
  mongoose.models.Purchase || mongoose.model<IPurchaseDocument>("Purchase", PurchaseSchema);
