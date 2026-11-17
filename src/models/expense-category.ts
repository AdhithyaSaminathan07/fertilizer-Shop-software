import mongoose, { Document, Model, Schema } from "mongoose";

export interface IExpenseCategoryDocument extends Document {
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Shop Rent", description: "Monthly premises lease and rent" },
  { name: "Electricity", description: "Power, electricity, and EB utility bills" },
  { name: "Water", description: "Water supply and drinking water cans" },
  { name: "Staff Salary", description: "Employee salaries, daily wages, and allowances" },
  { name: "Transport", description: "Freight, tempo, and lorry goods haulage" },
  { name: "Fuel", description: "Diesel and petrol expenses for delivery and generator" },
  { name: "Loading and Unloading", description: "Hamali and manual labour charges for stock handling" },
  { name: "Telephone and Internet", description: "Broadband, landline, and mobile recharges" },
  { name: "Office Supplies", description: "Bill books, register stationery, and printer ink" },
  { name: "Repairs and Maintenance", description: "Electrical, weighing scale, and premises repairs" },
  { name: "Packaging", description: "Gunny bags, twine, and packing materials" },
  { name: "Travel", description: "Field travel and distributor visit expenses" },
  { name: "Bank Charges", description: "Bank account service charges and DD/NEFT fees" },
  { name: "Miscellaneous", description: "General sundry and petty store expenses" },
];

const ExpenseCategorySchema = new Schema<IExpenseCategoryDocument>(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      maxlength: [50, "Category name cannot exceed 50 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [250, "Description cannot exceed 250 characters"],
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Enforce unique case-insensitive category name
ExpenseCategorySchema.index(
  { name: 1 },
  {
    unique: true,
    collation: { locale: "en", strength: 2 },
  }
);

export const ExpenseCategory: Model<IExpenseCategoryDocument> =
  mongoose.models.ExpenseCategory ||
  mongoose.model<IExpenseCategoryDocument>("ExpenseCategory", ExpenseCategorySchema);

