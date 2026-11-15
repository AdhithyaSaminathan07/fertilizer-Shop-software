import mongoose, { Document, Model, Schema } from "mongoose";
import { SupplierStatus } from "@/types/supplier";

export interface ISupplierDocument extends Document {
  name: string;
  contactPerson?: string;
  phone: string;
  email?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    pincode?: string;
  };
  gstin?: string;
  notes?: string;
  status: SupplierStatus;
  totalPurchases: number;
  totalPaid: number;
  outstandingBalance: number;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema(
  {
    street: { type: String, trim: true, maxlength: 200 },
    city: { type: String, trim: true, maxlength: 100 },
    state: { type: String, trim: true, maxlength: 100 },
    pincode: { type: String, trim: true, maxlength: 10 },
  },
  { _id: false }
);

const SupplierSchema = new Schema<ISupplierDocument>(
  {
    name: {
      type: String,
      required: [true, "Supplier name is required"],
      trim: true,
      minlength: [2, "Supplier name must be at least 2 characters"],
      maxlength: [150, "Supplier name cannot exceed 150 characters"],
      index: true,
    },
    contactPerson: {
      type: String,
      trim: true,
      maxlength: [100, "Contact person name cannot exceed 100 characters"],
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: [150, "Email cannot exceed 150 characters"],
    },
    address: {
      type: AddressSchema,
      default: {},
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true,
      unique: true,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE", "ARCHIVED"],
      default: "ACTIVE",
      index: true,
    },
    totalPurchases: {
      type: Number,
      default: 0,
      min: [0, "Total purchases cannot be negative"],
    },
    totalPaid: {
      type: Number,
      default: 0,
      min: [0, "Total paid cannot be negative"],
    },
    outstandingBalance: {
      type: Number,
      default: 0,
      min: [0, "Outstanding balance cannot be negative"],
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

// Compound text index for fast search queries
SupplierSchema.index({
  name: "text",
  contactPerson: "text",
  phone: "text",
  gstin: "text",
});

export const Supplier: Model<ISupplierDocument> =
  mongoose.models.Supplier || mongoose.model<ISupplierDocument>("Supplier", SupplierSchema);

