import mongoose, { Document, Model, Schema } from "mongoose";
import type {
  PurchaseStatus,
  PurchasePaymentStatus,
  PurchaseSupplierSnapshot,
  PurchaseProductSnapshot,
  IPurchaseItem,
  IPurchaseAmendment,
  IPurchaseReceipt,
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
  outstandingAmount: number;
  paymentStatus: PurchasePaymentStatus;
  status: PurchaseStatus;
  receipts: IPurchaseReceipt[];
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
    brand: { type: String, default: "Generic" },
    primaryUnit: { type: String, required: true },
    barcode: String,
  },
  { _id: false }
);

const PurchaseItemBatchSchema = new Schema(
  {
    batchNumber: { type: String, required: true, trim: true, uppercase: true },
    manufacturingDate: { type: Date },
    expiryDate: { type: Date },
    quantity: { type: Number, required: true, min: 0.001 },
  },
  { _id: false }
);

const PurchaseItemSchema = new Schema(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: false,
      index: true,
    },
    isManualProduct: {
      type: Boolean,
      default: false,
    },
    saveToCatalogue: {
      type: Boolean,
      default: false,
    },
    productSnapshot: {
      type: ProductSnapshotSchema,
      required: true,
    },
    orderedQty: {
      type: Number,
      required: true,
      min: [0.001, "Quantity must be greater than zero"],
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
    recognizedValue: {
      type: Number,
      default: 0,
      min: [0, "Recognized value cannot be negative"],
    },
    batches: [PurchaseItemBatchSchema],
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

const PurchaseReceiptItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: false },
    itemId: { type: Schema.Types.ObjectId, required: false },
    productName: { type: String },
    receivedQty: { type: Number, required: true },
    recognizedValue: { type: Number, required: true },
    batches: [PurchaseItemBatchSchema],
  },
  { _id: false }
);

const PurchaseReceiptSchema = new Schema(
  {
    receiptNumber: { type: String, required: true },
    receiptDate: { type: Date, default: Date.now },
    receivedById: { type: Schema.Types.ObjectId, ref: "User", required: true },
    receivedByName: { type: String, required: true },
    items: [PurchaseReceiptItemSchema],
    totalRecognizedValue: { type: Number, required: true },
    notes: String,
  },
  { _id: false }
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
        message: "At least one product item is required for a purchase entry",
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
    outstandingAmount: {
      type: Number,
      default: 0,
      min: [0, "Outstanding amount cannot be negative"],
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
      default: "PENDING_RECEIPT",
      index: true,
    },
    receipts: [PurchaseReceiptSchema],
    amendments: [AmendmentSchema],
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
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

// Compound unique index: supplierId + supplierInvoiceNumber
PurchaseSchema.index(
  { supplierId: 1, supplierInvoiceNumber: 1 },
  {
    unique: true,
    name: "idx_purchases_supplier_invoice_unique",
  }
);

// Text search index
PurchaseSchema.index(
  {
    purchaseNumber: "text",
    supplierInvoiceNumber: "text",
    "supplierSnapshot.name": "text",
  },
  {
    name: "idx_purchases_text_search",
  }
);

export const Purchase: Model<IPurchaseDocument> =
  mongoose.models.Purchase || mongoose.model<IPurchaseDocument>("Purchase", PurchaseSchema);
