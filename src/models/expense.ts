import mongoose, { Document, Model, Schema } from "mongoose";
import type { ExpensePaymentMethod, ExpenseStatus } from "@/types/expense";

export interface IExpenseDocument extends Document {
  expenseNumber: string;
  expenseDate: Date;
  categoryId: mongoose.Types.ObjectId;
  categoryName: string;
  description: string;
  amount: number;
  paymentMethod: ExpensePaymentMethod;
  paymentReference?: string;
  paidTo?: string;
  notes?: string;
  attachmentUrl?: string;
  status: ExpenseStatus;
  reversal?: {
    reason: string;
    reversedAt: Date;
    reversedById: mongoose.Types.ObjectId;
    reversedByName: string;
  };
  auditHistory: Array<{
    editedAt: Date;
    editedById: mongoose.Types.ObjectId;
    editedByName: string;
    reason: string;
    previousData: {
      expenseDate?: Date;
      categoryId?: mongoose.Types.ObjectId;
      categoryName?: string;
      description?: string;
      amount?: number;
      paymentMethod?: ExpensePaymentMethod;
      paymentReference?: string;
      paidTo?: string;
      notes?: string;
    };
  }>;
  createdById: mongoose.Types.ObjectId;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseAuditSchema = new Schema(
  {
    editedAt: { type: Date, required: true, default: Date.now },
    editedById: { type: Schema.Types.ObjectId, ref: "User", required: true },
    editedByName: { type: String, required: true },
    reason: { type: String, required: true, trim: true },
    previousData: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  { _id: false }
);

const ExpenseReversalSchema = new Schema(
  {
    reason: { type: String, required: true, trim: true },
    reversedAt: { type: Date, required: true, default: Date.now },
    reversedById: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reversedByName: { type: String, required: true },
  },
  { _id: false }
);

const ExpenseSchema = new Schema<IExpenseDocument>(
  {
    expenseNumber: {
      type: String,
      required: [true, "Expense number is required"],
      unique: true,
      trim: true,
      index: true,
    },
    expenseDate: {
      type: Date,
      required: [true, "Expense date is required"],
      default: Date.now,
      index: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "ExpenseCategory",
      required: [true, "Expense category is required"],
      index: true,
    },
    categoryName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Amount must be greater than 0"],
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
      default: "",
    },
    paidTo: {
      type: String,
      trim: true,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    attachmentUrl: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: ["RECORDED", "REVERSED"],
      default: "RECORDED",
      index: true,
    },
    reversal: {
      type: ExpenseReversalSchema,
      default: null,
    },
    auditHistory: {
      type: [ExpenseAuditSchema],
      default: [],
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
  }
);

ExpenseSchema.index({ expenseDate: -1, status: 1 });
ExpenseSchema.index({ categoryId: 1, status: 1 });
ExpenseSchema.index({ paymentMethod: 1, status: 1 });

export const Expense: Model<IExpenseDocument> =
  mongoose.models.Expense || mongoose.model<IExpenseDocument>("Expense", ExpenseSchema);

