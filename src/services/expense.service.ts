import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Expense, IExpenseDocument } from "@/models/expense";
import {
  ExpenseCategory,
  IExpenseCategoryDocument,
  DEFAULT_EXPENSE_CATEGORIES,
} from "@/models/expense-category";
import { AuditLog } from "@/models/audit-log";
import type { SafeUser } from "@/types/auth";
import type {
  IExpenseCategoryInput,
  IExpenseCreateInput,
  IExpenseUpdateInput,
  IExpenseFilter,
  IExpenseSummary,
  IExpense,
  IExpenseCategory,
} from "@/types/expense";

export function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Ensures default expense categories exist in the database.
 */
export async function ensureDefaultCategories(): Promise<void> {
  await connectDB();
  const count = await ExpenseCategory.countDocuments();
  if (count === 0) {
    const toInsert = DEFAULT_EXPENSE_CATEGORIES.map((cat) => ({
      name: cat.name,
      description: cat.description,
      isActive: true,
    }));
    await ExpenseCategory.insertMany(toInsert);
  }
}

/**
 * List expense categories with active status and aggregated usage counts.
 */
export async function getExpenseCategories(
  includeInactive: boolean = false
): Promise<IExpenseCategory[]> {
  await connectDB();
  await ensureDefaultCategories();

  const filter = includeInactive ? {} : { isActive: true };
  const categories = await ExpenseCategory.find(filter).sort({ name: 1 }).lean();

  // Aggregate active expense totals per category
  const aggregates = await Expense.aggregate([
    { $match: { status: "RECORDED" } },
    {
      $group: {
        _id: "$categoryId",
        count: { $sum: 1 },
        totalAmount: { $sum: "$amount" },
      },
    },
  ]);

  const statsMap = new Map<string, { count: number; totalAmount: number }>();
  for (const agg of aggregates) {
    if (agg._id) {
      statsMap.set(agg._id.toString(), {
        count: agg.count,
        totalAmount: round2(agg.totalAmount),
      });
    }
  }

  return categories.map((cat: any) => {
    const stats = statsMap.get(cat._id.toString()) || { count: 0, totalAmount: 0 };
    return {
      _id: cat._id.toString(),
      name: cat.name,
      description: cat.description || "",
      isActive: cat.isActive,
      expenseCount: stats.count,
      totalAmount: stats.totalAmount,
      createdAt: cat.createdAt ? new Date(cat.createdAt).toISOString() : "",
      updatedAt: cat.updatedAt ? new Date(cat.updatedAt).toISOString() : "",
    };
  });
}

/**
 * Create a new expense category.
 */
export async function createExpenseCategory(
  input: IExpenseCategoryInput,
  user: SafeUser
): Promise<IExpenseCategory> {
  await connectDB();

  const trimmedName = input.name.trim();
  const existing = await ExpenseCategory.findOne({
    name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
  });

  if (existing) {
    throw new Error(`Expense category '${trimmedName}' already exists`);
  }

  const category = await ExpenseCategory.create({
    name: trimmedName,
    description: input.description?.trim() || "",
    isActive: input.isActive !== undefined ? input.isActive : true,
  });

  await AuditLog.create({
    userId: new mongoose.Types.ObjectId(user.id),
    userName: user.name,
    action: "EXPENSE_CATEGORY_CREATED",
    details: {
      categoryId: category._id.toString(),
      name: category.name,
    },
    timestamp: new Date().toISOString(),
  });

  return {
    _id: category._id.toString(),
    name: category.name,
    description: category.description,
    isActive: category.isActive,
    expenseCount: 0,
    totalAmount: 0,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

/**
 * Update an existing expense category.
 */
export async function updateExpenseCategory(
  id: string,
  input: Partial<IExpenseCategoryInput>,
  user: SafeUser
): Promise<IExpenseCategory> {
  await connectDB();

  const category = await ExpenseCategory.findById(id);
  if (!category) {
    throw new Error("Expense category not found");
  }

  if (input.name && input.name.trim() !== category.name) {
    const trimmedName = input.name.trim();
    const existing = await ExpenseCategory.findOne({
      _id: { $ne: category._id },
      name: { $regex: new RegExp(`^${trimmedName}$`, "i") },
    });
    if (existing) {
      throw new Error(`Expense category '${trimmedName}' already exists`);
    }
    category.name = trimmedName;
  }

  if (input.description !== undefined) {
    category.description = input.description.trim();
  }

  if (input.isActive !== undefined) {
    category.isActive = input.isActive;
  }

  await category.save();

  await AuditLog.create({
    userId: new mongoose.Types.ObjectId(user.id),
    userName: user.name,
    action: "EXPENSE_CATEGORY_UPDATED",
    details: {
      categoryId: category._id.toString(),
      name: category.name,
      isActive: category.isActive,
    },
    timestamp: new Date().toISOString(),
  });

  return {
    _id: category._id.toString(),
    name: category.name,
    description: category.description,
    isActive: category.isActive,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

/**
 * Safely delete an expense category.
 * Prevents deletion if any expense records reference it; advises deactivation instead.
 */
export async function deleteExpenseCategory(id: string): Promise<void> {
  await connectDB();

  const category = await ExpenseCategory.findById(id);
  if (!category) {
    throw new Error("Expense category not found");
  }

  const inUseCount = await Expense.countDocuments({ categoryId: category._id });
  if (inUseCount > 0) {
    throw new Error(
      `Cannot delete category '${category.name}' because it is in use by ${inUseCount} expense record(s). Deactivate the category instead.`
    );
  }

  await ExpenseCategory.findByIdAndDelete(id);
}

/**
 * Generates sequential collision-proof expense number (EXP-YYYYMM-XXXX)
 */
export async function generateExpenseNumber(session?: mongoose.ClientSession): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `EXP-${yearMonth}-`;

  const query = Expense.findOne(
    { expenseNumber: { $regex: `^${prefix}` } },
    { expenseNumber: 1 }
  ).sort({ expenseNumber: -1 });

  if (session) {
    query.session(session);
  }

  const lastExpense = await query;
  let seq = 1;
  if (lastExpense && lastExpense.expenseNumber) {
    const parts = lastExpense.expenseNumber.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      seq = lastSeq + 1;
    }
  }

  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/**
 * Record a new daily business expense.
 */
export async function createExpense(
  input: IExpenseCreateInput,
  user: SafeUser
): Promise<IExpenseDocument> {
  await connectDB();

  const category = await ExpenseCategory.findById(input.categoryId);
  if (!category) {
    throw new Error("Invalid expense category: Category not found");
  }
  if (!category.isActive) {
    throw new Error(`Expense category '${category.name}' is inactive and cannot receive new expenses`);
  }

  const amount = round2(input.amount);
  if (amount <= 0) {
    throw new Error("Expense amount must be greater than zero");
  }

  const expenseDate = input.expenseDate ? new Date(input.expenseDate) : new Date();
  const expenseNumber = await generateExpenseNumber();

  const expense = await Expense.create({
    expenseNumber,
    expenseDate,
    categoryId: category._id,
    categoryName: category.name,
    description: input.description.trim(),
    amount,
    paymentMethod: input.paymentMethod,
    paymentReference: input.paymentReference?.trim() || "",
    paidTo: input.paidTo?.trim() || "",
    notes: input.notes?.trim() || "",
    attachmentUrl: input.attachmentUrl?.trim() || "",
    status: "RECORDED",
    createdById: new mongoose.Types.ObjectId(user.id),
    createdByName: user.name,
    auditHistory: [],
  });

  await AuditLog.create({
    userId: new mongoose.Types.ObjectId(user.id),
    userName: user.name,
    action: "EXPENSE_CREATED",
    details: {
      expenseId: expense._id.toString(),
      expenseNumber: expense.expenseNumber,
      amount: expense.amount,
      categoryName: category.name,
      paymentMethod: expense.paymentMethod,
    },
    timestamp: new Date().toISOString(),
  });

  return expense;
}

/**
 * Edit an existing expense with required reason and full audit trail preservation.
 */
export async function updateExpense(
  id: string,
  input: IExpenseUpdateInput,
  user: SafeUser
): Promise<IExpenseDocument> {
  await connectDB();

  const expense = await Expense.findById(id);
  if (!expense) {
    throw new Error("Expense record not found");
  }
  if (expense.status === "REVERSED") {
    throw new Error("Cannot edit a reversed expense record");
  }

  const reason = input.reason.trim();
  if (!reason || reason.length < 3) {
    throw new Error("A valid reason is required to modify this financial expense record");
  }

  // Snapshot current state for audit history
  const previousData = {
    expenseDate: expense.expenseDate,
    categoryId: expense.categoryId,
    categoryName: expense.categoryName,
    description: expense.description,
    amount: expense.amount,
    paymentMethod: expense.paymentMethod,
    paymentReference: expense.paymentReference,
    paidTo: expense.paidTo,
    notes: expense.notes,
  };

  if (input.categoryId && input.categoryId !== expense.categoryId.toString()) {
    const category = await ExpenseCategory.findById(input.categoryId);
    if (!category) {
      throw new Error("Target expense category not found");
    }
    expense.categoryId = category._id;
    expense.categoryName = category.name;
  }

  if (input.expenseDate) {
    expense.expenseDate = new Date(input.expenseDate);
  }
  if (input.description) {
    expense.description = input.description.trim();
  }
  if (input.amount !== undefined) {
    const amt = round2(input.amount);
    if (amt <= 0) throw new Error("Amount must be greater than zero");
    expense.amount = amt;
  }
  if (input.paymentMethod) {
    expense.paymentMethod = input.paymentMethod;
  }
  if (input.paymentReference !== undefined) {
    expense.paymentReference = input.paymentReference.trim();
  }
  if (input.paidTo !== undefined) {
    expense.paidTo = input.paidTo.trim();
  }
  if (input.notes !== undefined) {
    expense.notes = input.notes.trim();
  }
  if (input.attachmentUrl !== undefined) {
    expense.attachmentUrl = input.attachmentUrl.trim();
  }

  expense.auditHistory.push({
    editedAt: new Date(),
    editedById: new mongoose.Types.ObjectId(user.id),
    editedByName: user.name,
    reason,
    previousData,
  });

  await expense.save();

  await AuditLog.create({
    userId: new mongoose.Types.ObjectId(user.id),
    userName: user.name,
    action: "EXPENSE_UPDATED",
    details: {
      expenseId: expense._id.toString(),
      expenseNumber: expense.expenseNumber,
      reason,
      newAmount: expense.amount,
    },
    timestamp: new Date().toISOString(),
  });

  return expense;
}

/**
 * Reverses an expense record with mandatory reason.
 * Financial records are NEVER silently deleted.
 */
export async function reverseExpense(
  id: string,
  reason: string,
  user: SafeUser
): Promise<IExpenseDocument> {
  await connectDB();

  const trimmedReason = reason.trim();
  if (!trimmedReason || trimmedReason.length < 5) {
    throw new Error("A detailed reversal reason (at least 5 characters) is required");
  }

  const expense = await Expense.findOneAndUpdate(
    { _id: id, status: "RECORDED" },
    {
      $set: {
        status: "REVERSED",
        reversal: {
          reason: trimmedReason,
          reversedAt: new Date(),
          reversedById: new mongoose.Types.ObjectId(user.id),
          reversedByName: user.name,
        },
      },
    },
    { new: true }
  );

  if (!expense) {
    const existing = await Expense.findById(id);
    if (!existing) throw new Error("Expense record not found");
    if (existing.status === "REVERSED") throw new Error("Expense record is already reversed");
    throw new Error("Failed to reverse expense");
  }

  await AuditLog.create({
    userId: new mongoose.Types.ObjectId(user.id),
    userName: user.name,
    action: "EXPENSE_REVERSED",
    details: {
      expenseId: expense._id.toString(),
      expenseNumber: expense.expenseNumber,
      amount: expense.amount,
      reason: trimmedReason,
    },
    timestamp: new Date().toISOString(),
  });

  return expense;
}

/**
 * Fetch a single expense by ID with full details.
 */
export async function getExpenseById(id: string): Promise<IExpense | null> {
  await connectDB();
  const expense = await Expense.findById(id).lean();
  if (!expense) return null;

  return {
    _id: (expense as any)._id.toString(),
    expenseNumber: (expense as any).expenseNumber,
    expenseDate: new Date((expense as any).expenseDate).toISOString(),
    categoryId: (expense as any).categoryId.toString(),
    categoryName: (expense as any).categoryName,
    description: (expense as any).description,
    amount: (expense as any).amount,
    paymentMethod: (expense as any).paymentMethod,
    paymentReference: (expense as any).paymentReference || "",
    paidTo: (expense as any).paidTo || "",
    notes: (expense as any).notes || "",
    attachmentUrl: (expense as any).attachmentUrl || "",
    status: (expense as any).status,
    reversal: (expense as any).reversal
      ? {
          reason: (expense as any).reversal.reason,
          reversedAt: new Date((expense as any).reversal.reversedAt).toISOString(),
          reversedById: (expense as any).reversal.reversedById.toString(),
          reversedByName: (expense as any).reversal.reversedByName,
        }
      : undefined,
    auditHistory: ((expense as any).auditHistory || []).map((h: any) => ({
      editedAt: new Date(h.editedAt).toISOString(),
      editedById: h.editedById.toString(),
      editedByName: h.editedByName,
      reason: h.reason,
      previousData: h.previousData,
    })),
    createdById: (expense as any).createdById.toString(),
    createdByName: (expense as any).createdByName,
    createdAt: new Date((expense as any).createdAt).toISOString(),
    updatedAt: new Date((expense as any).updatedAt).toISOString(),
  };
}

/**
 * Filtered, paginated listing of expenses.
 */
export async function getExpenses(filter: IExpenseFilter): Promise<{
  expenses: IExpense[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  await connectDB();

  const query: any = {};

  if (filter.search && filter.search.trim()) {
    const s = filter.search.trim();
    query.$or = [
      { expenseNumber: { $regex: s, $options: "i" } },
      { description: { $regex: s, $options: "i" } },
      { paidTo: { $regex: s, $options: "i" } },
      { paymentReference: { $regex: s, $options: "i" } },
      { categoryName: { $regex: s, $options: "i" } },
    ];
  }

  if (filter.categoryId) {
    query.categoryId = new mongoose.Types.ObjectId(filter.categoryId);
  }

  if (filter.paymentMethod) {
    query.paymentMethod = filter.paymentMethod;
  }

  if (filter.status) {
    query.status = filter.status;
  }

  if (filter.createdById) {
    query.createdById = new mongoose.Types.ObjectId(filter.createdById);
  }

  if (filter.startDate || filter.endDate) {
    query.expenseDate = {};
    if (filter.startDate) {
      query.expenseDate.$gte = new Date(filter.startDate);
    }
    if (filter.endDate) {
      const eod = new Date(filter.endDate);
      eod.setHours(23, 59, 59, 999);
      query.expenseDate.$lte = eod;
    }
  }

  const page = filter.page && filter.page > 0 ? filter.page : 1;
  const limit = filter.limit && filter.limit > 0 ? filter.limit : 20;
  const skip = (page - 1) * limit;

  const [expenses, total] = await Promise.all([
    Expense.find(query).sort({ expenseDate: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    Expense.countDocuments(query),
  ]);

  const mapped: IExpense[] = expenses.map((e: any) => ({
    _id: e._id.toString(),
    expenseNumber: e.expenseNumber,
    expenseDate: new Date(e.expenseDate).toISOString(),
    categoryId: e.categoryId.toString(),
    categoryName: e.categoryName,
    description: e.description,
    amount: e.amount,
    paymentMethod: e.paymentMethod,
    paymentReference: e.paymentReference || "",
    paidTo: e.paidTo || "",
    notes: e.notes || "",
    attachmentUrl: e.attachmentUrl || "",
    status: e.status,
    reversal: e.reversal
      ? {
          reason: e.reversal.reason,
          reversedAt: new Date(e.reversal.reversedAt).toISOString(),
          reversedById: e.reversal.reversedById.toString(),
          reversedByName: e.reversal.reversedByName,
        }
      : undefined,
    auditHistory: (e.auditHistory || []).map((h: any) => ({
      editedAt: new Date(h.editedAt).toISOString(),
      editedById: h.editedById.toString(),
      editedByName: h.editedByName,
      reason: h.reason,
      previousData: h.previousData,
    })),
    createdById: e.createdById.toString(),
    createdByName: e.createdByName,
    createdAt: new Date(e.createdAt).toISOString(),
    updatedAt: new Date(e.updatedAt).toISOString(),
  }));

  return {
    expenses: mapped,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  };
}

/**
 * Summary calculations: daily, monthly, yearly, category breakdown, recent expenses.
 */
export async function getExpenseSummary(
  startDate?: string,
  endDate?: string
): Promise<IExpenseSummary> {
  await connectDB();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const [todayAgg, monthAgg, yearAgg, catAgg, recent] = await Promise.all([
    Expense.aggregate([
      {
        $match: {
          status: "RECORDED",
          expenseDate: { $gte: startOfToday, $lte: endOfToday },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]),
    Expense.aggregate([
      {
        $match: {
          status: "RECORDED",
          expenseDate: { $gte: startOfMonth },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]),
    Expense.aggregate([
      {
        $match: {
          status: "RECORDED",
          expenseDate: { $gte: startOfYear },
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]),
    Expense.aggregate([
      {
        $match: {
          status: "RECORDED",
          ...(startDate || endDate
            ? {
                expenseDate: {
                  ...(startDate ? { $gte: new Date(startDate) } : {}),
                  ...(endDate
                    ? {
                        $lte: (() => {
                          const e = new Date(endDate);
                          e.setHours(23, 59, 59, 999);
                          return e;
                        })(),
                      }
                    : {}),
                },
              }
            : { expenseDate: { $gte: startOfMonth } }),
        },
      },
      {
        $group: {
          _id: { categoryId: "$categoryId", categoryName: "$categoryName" },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalAmount: -1 } },
    ]),
    Expense.find({ status: "RECORDED" })
      .sort({ expenseDate: -1, createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  const todayTotal = todayAgg[0] ? round2(todayAgg[0].total) : 0;
  const todayCount = todayAgg[0] ? todayAgg[0].count : 0;
  const monthTotal = monthAgg[0] ? round2(monthAgg[0].total) : 0;
  const monthCount = monthAgg[0] ? monthAgg[0].count : 0;
  const yearTotal = yearAgg[0] ? round2(yearAgg[0].total) : 0;
  const yearCount = yearAgg[0] ? yearAgg[0].count : 0;

  const totalFilteredMonth = catAgg.reduce((acc, curr) => acc + curr.totalAmount, 0);

  const categoryBreakdown = catAgg.map((c) => ({
    categoryId: c._id.categoryId.toString(),
    categoryName: c._id.categoryName,
    totalAmount: round2(c.totalAmount),
    count: c.count,
    percentage:
      totalFilteredMonth > 0 ? round2((c.totalAmount / totalFilteredMonth) * 100) : 0,
  }));

  const recentExpenses: IExpense[] = recent.map((e: any) => ({
    _id: e._id.toString(),
    expenseNumber: e.expenseNumber,
    expenseDate: new Date(e.expenseDate).toISOString(),
    categoryId: e.categoryId.toString(),
    categoryName: e.categoryName,
    description: e.description,
    amount: e.amount,
    paymentMethod: e.paymentMethod,
    paymentReference: e.paymentReference || "",
    paidTo: e.paidTo || "",
    notes: e.notes || "",
    attachmentUrl: e.attachmentUrl || "",
    status: e.status,
    createdById: e.createdById.toString(),
    createdByName: e.createdByName,
    createdAt: new Date(e.createdAt).toISOString(),
    updatedAt: new Date(e.updatedAt).toISOString(),
  }));

  return {
    todayTotal,
    todayCount,
    monthTotal,
    monthCount,
    yearTotal,
    yearCount,
    categoryBreakdown,
    recentExpenses,
  };
}

