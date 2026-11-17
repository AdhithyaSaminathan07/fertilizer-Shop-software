import mongoose, { Document, Model, Schema } from "mongoose";

export interface ICashbookOpeningBalanceDocument extends Document {
  configKey: string;
  effectiveDate: Date;
  cash: number;
  upi: number;
  bank: number;
  cheque: number;
  notes?: string;
  history: Array<{
    adjustedAt: Date;
    adjustedById: mongoose.Types.ObjectId;
    adjustedByName: string;
    reason: string;
    previousBalances: {
      cash: number;
      upi: number;
      bank: number;
      cheque: number;
    };
    newBalances: {
      cash: number;
      upi: number;
      bank: number;
      cheque: number;
    };
  }>;
  createdById: mongoose.Types.ObjectId;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}

const HistorySchema = new Schema(
  {
    adjustedAt: { type: Date, required: true, default: Date.now },
    adjustedById: { type: Schema.Types.ObjectId, ref: "User", required: true },
    adjustedByName: { type: String, required: true },
    reason: { type: String, required: true, trim: true },
    previousBalances: {
      cash: { type: Number, required: true, default: 0 },
      upi: { type: Number, required: true, default: 0 },
      bank: { type: Number, required: true, default: 0 },
      cheque: { type: Number, required: true, default: 0 },
    },
    newBalances: {
      cash: { type: Number, required: true, default: 0 },
      upi: { type: Number, required: true, default: 0 },
      bank: { type: Number, required: true, default: 0 },
      cheque: { type: Number, required: true, default: 0 },
    },
  },
  { _id: false }
);

const CashbookOpeningBalanceSchema = new Schema<ICashbookOpeningBalanceDocument>(
  {
    configKey: {
      type: String,
      required: true,
      unique: true,
      default: "DEFAULT_CASHBOOK_OPENING",
    },
    effectiveDate: {
      type: Date,
      required: true,
      default: () => new Date(new Date().getFullYear(), 3, 1), // April 1st of current calendar year
    },
    cash: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Cash opening balance cannot be negative"],
    },
    upi: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "UPI opening balance cannot be negative"],
    },
    bank: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Bank opening balance cannot be negative"],
    },
    cheque: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Cheque opening balance cannot be negative"],
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    history: {
      type: [HistorySchema],
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

export const CashbookOpeningBalance: Model<ICashbookOpeningBalanceDocument> =
  mongoose.models.CashbookOpeningBalance ||
  mongoose.model<ICashbookOpeningBalanceDocument>(
    "CashbookOpeningBalance",
    CashbookOpeningBalanceSchema
  );

