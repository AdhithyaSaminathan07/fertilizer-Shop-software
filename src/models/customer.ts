import mongoose, { Document, Model, Schema } from "mongoose";
import { CustomerStatus } from "@/types/customer";

export interface ICustomerDocument extends Document {
  name: string;
  phone: string;
  village?: string;
  address?: string;
  district?: string;
  state?: string;
  pincode?: string;
  email?: string;
  gstin?: string;
  outstandingCredit: number;
  totalPurchases: number;
  totalPaid: number;
  status: CustomerStatus;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema<ICustomerDocument>(
  {
    name: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
      minlength: [2, "Customer name must be at least 2 characters"],
      maxlength: [150, "Customer name cannot exceed 150 characters"],
      index: true,
    },
    phone: {
      type: String,
      required: [true, "Customer phone number is required"],
      trim: true,
      index: true,
    },
    village: {
      type: String,
      trim: true,
      maxlength: [100, "Village cannot exceed 100 characters"],
      index: true,
    },
    address: {
      type: String,
      trim: true,
      maxlength: [250, "Address cannot exceed 250 characters"],
    },
    district: {
      type: String,
      trim: true,
      maxlength: [100, "District cannot exceed 100 characters"],
    },
    state: {
      type: String,
      trim: true,
      default: "Tamil Nadu",
      maxlength: [100, "State cannot exceed 100 characters"],
    },
    pincode: {
      type: String,
      trim: true,
      maxlength: [10, "Pincode cannot exceed 10 characters"],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true,
    },
    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      sparse: true,
    },
    outstandingCredit: {
      type: Number,
      default: 0,
      min: [0, "Outstanding credit cannot be negative"],
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
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
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

// Compound search index for quick lookup by phone or name
CustomerSchema.index({ phone: 1, name: 1 });

export const Customer: Model<ICustomerDocument> =
  mongoose.models.Customer || mongoose.model<ICustomerDocument>("Customer", CustomerSchema);

