import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import { z } from "zod";

function round2(val) {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

// Schemas matching application models
const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    role: { type: String, enum: ["OWNER", "EMPLOYEE"], default: "EMPLOYEE" },
    permissions: [{ type: String }],
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true }
);

const SupplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    contactPerson: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    gstin: { type: String, trim: true, uppercase: true, sparse: true, unique: true },
    notes: String,
    status: { type: String, enum: ["ACTIVE", "INACTIVE", "ARCHIVED"], default: "ACTIVE" },
    totalPurchases: { type: Number, default: 0, min: 0 },
    totalPaid: { type: Number, default: 0, min: 0 },
    outstandingBalance: { type: Number, default: 0, min: 0 },
    advanceBalance: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

const PurchaseItemBatchSchema = new mongoose.Schema(
  {
    batchNumber: { type: String, required: true, trim: true, uppercase: true },
    manufacturingDate: { type: Date },
    expiryDate: { type: Date },
    quantity: { type: Number, required: true, min: 0.001 },
  },
  { _id: false }
);

const PurchaseItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: false },
    isManualProduct: { type: Boolean, default: false },
    saveToCatalogue: { type: Boolean, default: false },
    productSnapshot: {
      name: { type: String, required: true },
      sku: { type: String },
      brand: { type: String, default: "Generic" },
      primaryUnit: { type: String, required: true },
      barcode: { type: String },
    },
    orderedQty: { type: Number, required: true, min: 0.001 },
    receivedQty: { type: Number, default: 0, min: 0 },
    unit: { type: String, required: true },
    unitPurchasePrice: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    taxAmount: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    recognizedValue: { type: Number, default: 0, min: 0 },
    batches: [PurchaseItemBatchSchema],
  },
  { _id: true }
);

const PurchaseAdvanceAdjustmentSchema = new mongoose.Schema(
  {
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "SupplierPayment", required: true },
    paymentNumber: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    adjustedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const PurchaseReceiptItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, required: false },
    itemId: { type: mongoose.Schema.Types.ObjectId, required: false },
    productName: { type: String },
    receivedQty: { type: Number, required: true },
    recognizedValue: { type: Number, required: true },
    batches: [PurchaseItemBatchSchema],
  },
  { _id: false }
);

const PurchaseReceiptSchema = new mongoose.Schema(
  {
    receiptNumber: { type: String, required: true },
    receiptDate: { type: Date, default: Date.now },
    receivedById: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receivedByName: { type: String, required: true },
    items: [PurchaseReceiptItemSchema],
    totalRecognizedValue: { type: Number, required: true },
    notes: String,
  },
  { _id: false }
);

const PurchaseSchema = new mongoose.Schema(
  {
    purchaseNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
    supplierSnapshot: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      gstin: String,
    },
    supplierInvoiceNumber: { type: String, required: true, trim: true },
    supplierInvoiceDate: { type: Date, required: true },
    purchaseDate: { type: Date, default: Date.now },
    items: [PurchaseItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    receivedQty: { type: Number, default: 0, min: 0 },
    recognizedInvoiceValue: { type: Number, default: 0, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    paymentMethod: { type: String, enum: ["CASH", "UPI", "BANK_TRANSFER", "CHEQUE"] },
    paymentReference: { type: String, trim: true },
    outstandingAmount: { type: Number, default: 0, min: 0 },
    paymentStatus: { type: String, enum: ["UNPAID", "PARTIALLY_PAID", "PAID"], default: "UNPAID" },
    status: {
      type: String,
      enum: ["DRAFT", "PENDING_RECEIPT", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"],
      default: "PENDING_RECEIPT",
    },
    advanceAdjustments: [PurchaseAdvanceAdjustmentSchema],
    receipts: [PurchaseReceiptSchema],
    amendments: [],
    notes: String,
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const PaymentAllocationSchema = new mongoose.Schema(
  {
    purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: "Purchase", required: true },
    purchaseNumber: { type: String, required: true, trim: true },
    supplierInvoiceNumber: { type: String, required: true, trim: true },
    allocatedAmount: { type: Number, required: true, min: 0.01 },
  },
  { _id: false }
);

const PaymentAdvanceAdjustmentSchema = new mongoose.Schema(
  {
    purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: "Purchase", required: true },
    purchaseNumber: { type: String, required: true, trim: true },
    supplierInvoiceNumber: { type: String, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    adjustedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const SupplierPaymentSchema = new mongoose.Schema(
  {
    paymentNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
    supplierSnapshot: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      gstin: String,
    },
    paymentDate: { type: Date, default: Date.now },
    amount: { type: Number, required: true, min: 0.01 },
    paymentMethod: { type: String, enum: ["CASH", "UPI", "BANK_TRANSFER", "CHEQUE"], required: true },
    paymentReference: { type: String, trim: true },
    allocations: [PaymentAllocationSchema],
    unallocatedAmount: { type: Number, default: 0, min: 0 },
    advanceRemaining: { type: Number, default: 0, min: 0 },
    advanceConsumed: { type: Number, default: 0, min: 0 },
    advanceAdjustments: [PaymentAdvanceAdjustmentSchema],
    notes: String,
    status: { type: String, enum: ["RECORDED", "REVERSED"], default: "RECORDED" },
    reversal: {
      reason: String,
      reversedAt: Date,
      reversedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      reversedByName: String,
    },
    idempotencyKey: { type: String, trim: true, sparse: true, unique: true },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true }
);

const AuditLogSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    ipAddress: String,
    details: mongoose.Schema.Types.Mixed,
  },
  { timestamps: true }
);

const User = mongoose.model("User", UserSchema);
const Supplier = mongoose.model("Supplier", SupplierSchema);
const Purchase = mongoose.model("Purchase", PurchaseSchema);
const SupplierPayment = mongoose.model("SupplierPayment", SupplierPaymentSchema);
const AuditLog = mongoose.model("AuditLog", AuditLogSchema);

// Security & RBAC helpers
function hasPermission(user, permission) {
  if (!user || user.status !== "ACTIVE") return false;
  if (user.role === "OWNER") return true;
  if (user.permissions && user.permissions.includes(permission)) return true;
  return false;
}

// Zod Validation Schemas
const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

const paymentAllocationInputSchema = z.object({
  purchaseId: z.string().regex(OBJECT_ID_REGEX, "Valid purchase ID is required"),
  amount: z.number().positive("Allocated amount must be greater than zero"),
});

const createSupplierPaymentSchema = z
  .object({
    supplierId: z.string().regex(OBJECT_ID_REGEX, "Valid supplier ID is required"),
    paymentDate: z
      .string()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: "Valid payment date is required",
      })
      .optional()
      .or(z.date().optional()),
    amount: z.number().positive("Payment amount must be greater than zero"),
    paymentMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE"]),
    paymentReference: z.string().trim().max(100).optional().or(z.literal("")),
    allocations: z.array(paymentAllocationInputSchema).optional().default([]),
    notes: z.string().trim().max(1000).optional().or(z.literal("")),
    idempotencyKey: z.string().trim().max(100).optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      if (!data.allocations || data.allocations.length === 0) return true;
      const totalAllocated = data.allocations.reduce((sum, a) => sum + (a.amount || 0), 0);
      return Math.round((totalAllocated - data.amount) * 100) / 100 <= 0;
    },
    {
      message: "Total allocated amount cannot exceed the payment amount",
      path: ["allocations"],
    }
  );

const reversePaymentBodySchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "Reversal reason must be at least 3 characters")
    .max(500, "Reversal reason cannot exceed 500 characters"),
});

const supplierPaymentFilterSchema = z.object({
  supplierId: z.string().regex(OBJECT_ID_REGEX).optional().or(z.literal("")),
  paymentMethod: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE"]).optional(),
  status: z.enum(["RECORDED", "REVERSED"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Service Logic
function formatSupplierPayment(doc) {
  return {
    id: doc._id.toString(),
    _id: doc._id.toString(),
    paymentNumber: doc.paymentNumber,
    supplierId: doc.supplierId.toString(),
    supplierSnapshot: doc.supplierSnapshot,
    paymentDate: doc.paymentDate instanceof Date ? doc.paymentDate.toISOString() : doc.paymentDate,
    amount: doc.amount,
    paymentMethod: doc.paymentMethod,
    paymentReference: doc.paymentReference,
    allocations: (doc.allocations || []).map((a) => ({
      purchaseId: a.purchaseId?.toString() || "",
      purchaseNumber: a.purchaseNumber,
      supplierInvoiceNumber: a.supplierInvoiceNumber,
      allocatedAmount: a.allocatedAmount,
    })),
    unallocatedAmount: doc.unallocatedAmount || 0,
    advanceRemaining: doc.advanceRemaining ?? doc.unallocatedAmount ?? 0,
    advanceConsumed: doc.advanceConsumed || 0,
    advanceAdjustments: (doc.advanceAdjustments || []).map((adj) => ({
      purchaseId: adj.purchaseId?.toString() || "",
      purchaseNumber: adj.purchaseNumber,
      supplierInvoiceNumber: adj.supplierInvoiceNumber,
      amount: adj.amount,
      adjustedAt: adj.adjustedAt instanceof Date ? adj.adjustedAt.toISOString() : adj.adjustedAt,
    })),
    isExcessUpfrontCredit: Boolean(
      doc.notes && typeof doc.notes === "string" && doc.notes.startsWith("Excess advance credit from purchase bill")
    ),
    notes: doc.notes,
    status: doc.status,
    reversal: doc.reversal
      ? {
          reason: doc.reversal.reason,
          reversedAt: doc.reversal.reversedAt instanceof Date ? doc.reversal.reversedAt.toISOString() : doc.reversal.reversedAt,
          reversedById: doc.reversal.reversedById?.toString(),
          reversedByName: doc.reversal.reversedByName,
        }
      : undefined,
    idempotencyKey: doc.idempotencyKey,
    createdById: doc.createdById?.toString(),
    createdByName: doc.createdByName,
    createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString() : doc.createdAt,
    updatedAt: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString() : doc.updatedAt,
  };
}

async function generatePaymentNumber(session) {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `PAY-${yearMonth}-`;

  let query = SupplierPayment.findOne(
    { paymentNumber: { $regex: `^${prefix}` } },
    { paymentNumber: 1 }
  ).sort({ paymentNumber: -1 });

  if (session) query = query.session(session);
  const lastPayment = await query;

  let seq = 1;
  if (lastPayment && lastPayment.paymentNumber) {
    const parts = lastPayment.paymentNumber.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

async function recordSupplierPaymentService(input, actor) {
  const parsed = createSupplierPaymentSchema.parse(input);

  if (parsed.idempotencyKey && parsed.idempotencyKey.trim()) {
    const existing = await SupplierPayment.findOne({
      idempotencyKey: parsed.idempotencyKey.trim(),
    });
    if (existing) return formatSupplierPayment(existing);
  }

  const session = await mongoose.startSession();
  let createdPayment = null;

  try {
    await session.withTransaction(async () => {
      const supplier = await Supplier.findById(parsed.supplierId).session(session);
      if (!supplier) throw new Error("Supplier not found");
      if (supplier.status === "ARCHIVED") throw new Error("Cannot pay archived supplier");

      let totalAllocated = 0;
      const processedAllocations = [];

      if (parsed.allocations && parsed.allocations.length > 0) {
        const seenPurchases = new Set();
        for (const alloc of parsed.allocations) {
          if (seenPurchases.has(alloc.purchaseId)) {
            throw new Error(`Duplicate allocation for purchase ID ${alloc.purchaseId}`);
          }
          seenPurchases.add(alloc.purchaseId);

          const purchase = await Purchase.findById(alloc.purchaseId).session(session);
          if (!purchase) throw new Error(`Purchase invoice not found: ${alloc.purchaseId}`);

          if (purchase.supplierId.toString() !== supplier._id.toString()) {
            throw new Error(`Purchase ${purchase.purchaseNumber} belongs to different supplier`);
          }

          if (purchase.status === "PENDING_RECEIPT" || purchase.status === "DRAFT") {
            throw new Error(
              `Cannot allocate payment to purchase ${purchase.purchaseNumber} with status ${purchase.status}. Goods must be inwarded first.`
            );
          }
          if (purchase.status === "CANCELLED") {
            throw new Error(`Cannot allocate payment to cancelled purchase ${purchase.purchaseNumber}`);
          }
          if (purchase.recognizedInvoiceValue <= 0) {
            throw new Error(`Cannot allocate payment to purchase with zero recognized value`);
          }

          if (purchase.outstandingAmount <= 0) {
            throw new Error(`Purchase ${purchase.purchaseNumber} has no outstanding balance`);
          }

          const allocAmount = round2(alloc.amount);
          if (allocAmount > purchase.outstandingAmount) {
            throw new Error(
              `Allocation amount ₹${allocAmount} exceeds eligible outstanding ₹${purchase.outstandingAmount}`
            );
          }

          purchase.amountPaid = round2(purchase.amountPaid + allocAmount);
          purchase.outstandingAmount = Math.max(0, round2(purchase.recognizedInvoiceValue - purchase.amountPaid));
          purchase.paymentStatus = purchase.outstandingAmount === 0 ? "PAID" : "PARTIALLY_PAID";
          purchase.updatedById = actor.id;
          await purchase.save({ session });

          processedAllocations.push({
            purchaseId: purchase._id,
            purchaseNumber: purchase.purchaseNumber,
            supplierInvoiceNumber: purchase.supplierInvoiceNumber,
            allocatedAmount: allocAmount,
          });

          totalAllocated = round2(totalAllocated + allocAmount);
        }
      }

      totalAllocated = round2(totalAllocated);
      const paymentAmount = round2(parsed.amount);
      if (totalAllocated > paymentAmount) {
        throw new Error(`Total allocated amount (${totalAllocated}) exceeds payment amount (${paymentAmount})`);
      }

      const unallocatedAmount = round2(paymentAmount - totalAllocated);

      await Supplier.findByIdAndUpdate(
        supplier._id,
        {
          $inc: {
            totalPaid: paymentAmount,
            outstandingBalance: -totalAllocated,
            advanceBalance: unallocatedAmount,
          },
        },
        { session }
      );

      const paymentNumber = await generatePaymentNumber(session);
      const [newPayment] = await SupplierPayment.create(
        [
          {
            paymentNumber,
            supplierId: supplier._id,
            supplierSnapshot: {
              name: supplier.name,
              phone: supplier.phone,
              gstin: supplier.gstin,
            },
            paymentDate: parsed.paymentDate ? new Date(parsed.paymentDate) : new Date(),
            amount: paymentAmount,
            paymentMethod: parsed.paymentMethod,
            paymentReference: parsed.paymentReference?.trim(),
            allocations: processedAllocations,
            unallocatedAmount,
            advanceRemaining: unallocatedAmount,
            advanceConsumed: 0,
            advanceAdjustments: [],
            notes: parsed.notes?.trim(),
            status: "RECORDED",
            idempotencyKey: parsed.idempotencyKey?.trim(),
            createdById: actor.id,
            createdByName: actor.name,
          },
        ],
        { session }
      );

      createdPayment = newPayment;
    });
  } finally {
    await session.endSession();
  }

  await AuditLog.create({
    action: "SUPPLIER_PAYMENT_RECORDED",
    userId: actor.id,
    userName: actor.name,
    ipAddress: actor.ip,
    details: {
      paymentId: createdPayment._id.toString(),
      paymentNumber: createdPayment.paymentNumber,
      supplierId: input.supplierId,
      amount: input.amount,
    },
  });

  return formatSupplierPayment(createdPayment);
}

async function reverseSupplierPaymentService(input, actor) {
  const session = await mongoose.startSession();
  let updatedPayment = null;

  try {
    await session.withTransaction(async () => {
      const payment = await SupplierPayment.findById(input.paymentId).session(session);
      if (!payment) throw new Error("Supplier payment record not found");
      if (payment.status === "REVERSED") throw new Error(`Supplier payment ${payment.paymentNumber} is already reversed`);

      const supplier = await Supplier.findById(payment.supplierId).session(session);
      if (!supplier) throw new Error("Supplier not found for this payment record");

      // Provenance safety guard
      if (payment.unallocatedAmount > 0) {
        const consumed = round2(payment.advanceConsumed || 0);
        const remaining = round2(payment.advanceRemaining ?? payment.unallocatedAmount);

        if (consumed > 0 || remaining < payment.unallocatedAmount) {
          const invoices = (payment.advanceAdjustments || []).map((a) => a.purchaseNumber).join(", ");
          throw new Error(
            `Cannot reverse payment ${payment.paymentNumber}: ₹${consumed} of its unallocated advance has already been consumed by purchase invoices (${invoices || "recorded purchases"}). Originating advance is no longer available.`
          );
        }
      }

      let totalRevertedAllocations = 0;
      for (const alloc of payment.allocations) {
        const purchase = await Purchase.findById(alloc.purchaseId).session(session);
        if (purchase) {
          purchase.amountPaid = Math.max(0, round2(purchase.amountPaid - alloc.allocatedAmount));
          purchase.outstandingAmount = Math.max(0, round2(purchase.recognizedInvoiceValue - purchase.amountPaid));
          purchase.paymentStatus =
            purchase.outstandingAmount === 0 && purchase.recognizedInvoiceValue > 0
              ? "PAID"
              : purchase.amountPaid > 0
              ? "PARTIALLY_PAID"
              : "UNPAID";
          purchase.updatedById = actor.id;
          await purchase.save({ session });
        }
        totalRevertedAllocations = round2(totalRevertedAllocations + alloc.allocatedAmount);
      }

      const advanceToDeduct = round2(payment.advanceRemaining ?? payment.unallocatedAmount ?? 0);

      await Supplier.findByIdAndUpdate(
        supplier._id,
        {
          $inc: {
            totalPaid: -payment.amount,
            outstandingBalance: totalRevertedAllocations,
            advanceBalance: -advanceToDeduct,
          },
        },
        { session }
      );

      payment.status = "REVERSED";
      payment.advanceRemaining = 0;
      payment.reversal = {
        reason: input.reason.trim(),
        reversedAt: new Date(),
        reversedById: actor.id,
        reversedByName: actor.name,
      };

      await payment.save({ session });
      updatedPayment = payment;
    });
  } finally {
    await session.endSession();
  }

  await AuditLog.create({
    action: "SUPPLIER_PAYMENT_REVERSED",
    userId: actor.id,
    userName: actor.name,
    ipAddress: actor.ip,
    details: {
      paymentId: updatedPayment._id.toString(),
      paymentNumber: updatedPayment.paymentNumber,
      supplierId: updatedPayment.supplierId.toString(),
      amount: updatedPayment.amount,
      reason: input.reason,
    },
  });

  return formatSupplierPayment(updatedPayment);
}

async function listSupplierPaymentsService(params = {}) {
  const { supplierId, paymentMethod, status, startDate, endDate, page = 1, limit = 20 } = params;
  const filter = {};

  if (supplierId && mongoose.Types.ObjectId.isValid(supplierId)) {
    filter.supplierId = new mongoose.Types.ObjectId(supplierId);
  }
  if (paymentMethod) filter.paymentMethod = paymentMethod;
  if (status) filter.status = status;
  if (startDate || endDate) {
    filter.paymentDate = {};
    if (startDate) filter.paymentDate.$gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.paymentDate.$lte = end;
    }
  }

  const skip = (Math.max(1, page) - 1) * limit;
  const [docs, totalCount, statsAgg] = await Promise.all([
    SupplierPayment.find(filter).sort({ paymentDate: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    SupplierPayment.countDocuments(filter),
    SupplierPayment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRecordedAmount: { $sum: { $cond: [{ $eq: ["$status", "RECORDED"] }, "$amount", 0] } },
          totalUnallocatedAdvance: { $sum: { $cond: [{ $eq: ["$status", "RECORDED"] }, "$unallocatedAmount", 0] } },
          reversedCount: { $sum: { $cond: [{ $eq: ["$status", "REVERSED"] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const rawStats = statsAgg[0] || { totalRecordedAmount: 0, totalUnallocatedAdvance: 0, reversedCount: 0 };
  const totalRecorded = round2(rawStats.totalRecordedAmount || 0);
  const totalAdvance = round2(rawStats.totalUnallocatedAdvance || 0);
  const totalAllocated = round2(Math.max(0, totalRecorded - totalAdvance));

  return {
    payments: docs.map((d) => formatSupplierPayment(d)),
    totalCount,
    page: Math.max(1, page),
    limit,
    totalPages: Math.ceil(totalCount / limit) || 1,
    stats: {
      totalRecordedAmount: totalRecorded,
      totalAllocatedAmount: totalAllocated,
      totalUnallocatedAdvance: totalAdvance,
      reversedCount: rawStats.reversedCount || 0,
    },
  };
}

async function getSupplierPaymentByIdService(id) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  const payment = await SupplierPayment.findById(id).lean();
  if (!payment) return null;
  return formatSupplierPayment(payment);
}

// API Route Simulation Handlers
async function handlePostPayments(request) {
  const { user, body, headers = {} } = request;
  if (!user) {
    return { status: 401, data: { success: false, message: "Authentication required" } };
  }
  if (!hasPermission(user, "suppliers:manage")) {
    return { status: 403, data: { success: false, message: "Forbidden: You lack permission to record supplier payments" } };
  }

  // Idempotency key from header or body
  const headerIdemp = headers["x-idempotency-key"] || headers["idempotency-key"];
  const payload = { ...body };
  if (headerIdemp && !payload.idempotencyKey) {
    payload.idempotencyKey = headerIdemp.trim();
  }

  const parsed = createSupplierPaymentSchema.safeParse(payload);
  if (!parsed.success) {
    return { status: 400, data: { success: false, message: parsed.error.issues.map((i) => i.message).join(", ") } };
  }

  try {
    const payment = await recordSupplierPaymentService(parsed.data, {
      id: user.id,
      name: user.name,
      ip: headers["x-forwarded-for"] || "127.0.0.1",
    });
    return { status: 201, data: { success: true, payment } };
  } catch (err) {
    const msg = err.message;
    const isConflict =
      msg.includes("exceeds eligible outstanding") ||
      msg.includes("belongs to different supplier") ||
      msg.includes("Goods must be inwarded") ||
      msg.includes("Duplicate allocation") ||
      msg.includes("has no outstanding balance");
    return { status: isConflict ? 409 : 400, data: { success: false, message: msg } };
  }
}

async function handleGetPayments(request) {
  const { user, query = {} } = request;
  if (!user) {
    return { status: 401, data: { success: false, message: "Authentication required" } };
  }
  if (!hasPermission(user, "suppliers:view")) {
    return { status: 403, data: { success: false, message: "Forbidden: You lack permission to view supplier payments" } };
  }

  const filterParsed = supplierPaymentFilterSchema.safeParse(query);
  if (!filterParsed.success) {
    return { status: 400, data: { success: false, message: filterParsed.error.issues.map((i) => i.message).join(", ") } };
  }

  try {
    const result = await listSupplierPaymentsService(filterParsed.data);
    return { status: 200, data: { success: true, ...result } };
  } catch (err) {
    return { status: 500, data: { success: false, message: err.message } };
  }
}

async function handleGetPaymentById(request) {
  const { user, id } = request;
  if (!user) {
    return { status: 401, data: { success: false, message: "Authentication required" } };
  }
  if (!hasPermission(user, "suppliers:view")) {
    return { status: 403, data: { success: false, message: "Forbidden: You lack permission to view supplier payment details" } };
  }

  try {
    const payment = await getSupplierPaymentByIdService(id);
    if (!payment) {
      return { status: 404, data: { success: false, message: "Supplier payment not found" } };
    }
    return { status: 200, data: { success: true, payment } };
  } catch (err) {
    return { status: 500, data: { success: false, message: err.message } };
  }
}

async function handleMethodNotAllowed() {
  return {
    status: 405,
    data: { success: false, message: "Editing or deleting historical supplier payments is prohibited. Use reversal instead." },
  };
}

async function handlePostReverse(request) {
  const { user, id, body = {}, headers = {} } = request;
  if (!user) {
    return { status: 401, data: { success: false, message: "Authentication required" } };
  }
  if (!hasPermission(user, "suppliers:manage")) {
    return { status: 403, data: { success: false, message: "Forbidden: You lack permission to reverse supplier payments" } };
  }

  const parsed = reversePaymentBodySchema.safeParse(body);
  if (!parsed.success) {
    return { status: 400, data: { success: false, message: parsed.error.issues.map((i) => i.message).join(", ") } };
  }

  try {
    const payment = await reverseSupplierPaymentService(
      { paymentId: id, reason: parsed.data.reason },
      { id: user.id, name: user.name, ip: headers["x-forwarded-for"] || "127.0.0.1" }
    );
    return { status: 200, data: { success: true, payment } };
  } catch (err) {
    const msg = err.message;
    const isConflict = msg.includes("already reversed") || msg.includes("already been consumed") || msg.includes("no longer available");
    return { status: isConflict ? 409 : 400, data: { success: false, message: msg } };
  }
}

// TEST RUNNER
async function runPhase5D2ApiTestSuite() {
  console.log("==========================================================");
  console.log("KASI AGRI AGENCIES — PHASE 5D.2 API & PERMISSIONS TEST SUITE");
  console.log("==========================================================");

  let replSet;
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  PASS: ${message}`);
      passed++;
    } else {
      console.error(`  FAIL: ${message}`);
      failed++;
    }
  }

  try {
    console.log("\nStarting isolated MongoDB Replica Set in-memory...");
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    const uri = replSet.getUri();
    await mongoose.connect(uri);
    console.log("Connected to in-memory replica set successfully.\n");

    // Seed test users with RBAC
    const ownerUser = {
      id: new mongoose.Types.ObjectId().toString(),
      name: "Adhithya Owner",
      role: "OWNER",
      status: "ACTIVE",
      permissions: ["suppliers:view", "suppliers:manage"],
    };

    const managerUser = {
      id: new mongoose.Types.ObjectId().toString(),
      name: "Ramesh Manager",
      role: "EMPLOYEE",
      status: "ACTIVE",
      permissions: ["suppliers:view", "suppliers:manage"],
    };

    const clerkUser = {
      id: new mongoose.Types.ObjectId().toString(),
      name: "Suresh Clerk (View Only)",
      role: "EMPLOYEE",
      status: "ACTIVE",
      permissions: ["suppliers:view"], // lacks suppliers:manage
    };

    // Seed Suppliers
    const supplier1 = await Supplier.create({
      name: "IFFCO India Ltd",
      phone: "9876543201",
      gstin: "33AAACI1234F1Z1",
      status: "ACTIVE",
      totalPurchases: 0,
      totalPaid: 0,
      outstandingBalance: 0,
      advanceBalance: 0,
    });

    const supplier2 = await Supplier.create({
      name: "Bayer CropScience",
      phone: "9876543202",
      gstin: "33AAACB5678K1Z2",
      status: "ACTIVE",
      totalPurchases: 0,
      totalPaid: 0,
      outstandingBalance: 0,
      advanceBalance: 0,
    });

    // Seed an inwarded purchase for Supplier 1 (₹10,000 recognized liability)
    const purchaseS1 = await Purchase.create({
      purchaseNumber: "PUR-202611-1001",
      supplierId: supplier1._id,
      supplierSnapshot: { name: supplier1.name, phone: supplier1.phone },
      supplierInvoiceNumber: "INV-IFFCO-101",
      supplierInvoiceDate: new Date(),
      items: [
        {
          productSnapshot: { name: "Urea 50kg", brand: "IFFCO", primaryUnit: "BAG" },
          orderedQty: 20,
          receivedQty: 20,
          unit: "BAG",
          unitPurchasePrice: 500,
          lineTotal: 10000,
          recognizedValue: 10000,
        },
      ],
      subtotal: 10000,
      grandTotal: 10000,
      receivedQty: 20,
      recognizedInvoiceValue: 10000,
      amountPaid: 0,
      outstandingAmount: 10000,
      paymentStatus: "UNPAID",
      status: "RECEIVED",
      createdById: ownerUser.id,
    });

    await Supplier.findByIdAndUpdate(supplier1._id, {
      $inc: { totalPurchases: 10000, outstandingBalance: 10000 },
    });

    // Seed an inwarded purchase for Supplier 2 (₹8,000 recognized liability)
    const purchaseS2 = await Purchase.create({
      purchaseNumber: "PUR-202611-1002",
      supplierId: supplier2._id,
      supplierSnapshot: { name: supplier2.name, phone: supplier2.phone },
      supplierInvoiceNumber: "INV-BAYER-201",
      supplierInvoiceDate: new Date(),
      items: [
        {
          productSnapshot: { name: "Confidor 100ml", brand: "Bayer", primaryUnit: "BOTTLE" },
          orderedQty: 8,
          receivedQty: 8,
          unit: "BOTTLE",
          unitPurchasePrice: 1000,
          lineTotal: 8000,
          recognizedValue: 8000,
        },
      ],
      subtotal: 8000,
      grandTotal: 8000,
      receivedQty: 8,
      recognizedInvoiceValue: 8000,
      amountPaid: 0,
      outstandingAmount: 8000,
      paymentStatus: "UNPAID",
      status: "RECEIVED",
      createdById: ownerUser.id,
    });

    await Supplier.findByIdAndUpdate(supplier2._id, {
      $inc: { totalPurchases: 8000, outstandingBalance: 8000 },
    });

    console.log("----------------------------------------------------------");
    console.log("TEST 1: AUTHENTICATION & AUTHORIZATION (RBAC) ENFORCEMENT");
    console.log("----------------------------------------------------------");
    // 1.1 Unauthorized POST (no user session)
    const unauthPost = await handlePostPayments({ user: null, body: { amount: 1000 } });
    assert(unauthPost.status === 401, "POST /api/supplier-payments: Unauthenticated returns 401 Unauthorized");

    // 1.2 Forbidden POST (Clerk without suppliers:manage)
    const forbiddenPost = await handlePostPayments({
      user: clerkUser,
      body: { supplierId: supplier1._id.toString(), amount: 1000, paymentMethod: "CASH" },
    });
    assert(forbiddenPost.status === 403, "POST /api/supplier-payments: User lacking 'suppliers:manage' returns 403 Forbidden");

    // 1.3 Unauthorized GET (no user session)
    const unauthGet = await handleGetPayments({ user: null });
    assert(unauthGet.status === 401, "GET /api/supplier-payments: Unauthenticated returns 401 Unauthorized");

    // 1.4 Forbidden GET (User lacking suppliers:view)
    const noViewUser = { id: "no-view", name: "No View", role: "EMPLOYEE", status: "ACTIVE", permissions: [] };
    const forbiddenGet = await handleGetPayments({ user: noViewUser });
    assert(forbiddenGet.status === 403, "GET /api/supplier-payments: User lacking 'suppliers:view' returns 403 Forbidden");

    // 1.5 Forbidden REVERSE (Clerk without suppliers:manage)
    const forbiddenReverse = await handlePostReverse({
      user: clerkUser,
      id: new mongoose.Types.ObjectId().toString(),
      body: { reason: "Testing unauthorized reversal" },
    });
    assert(forbiddenReverse.status === 403, "POST /api/supplier-payments/[id]/reverse: User lacking 'suppliers:manage' returns 403 Forbidden");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 2: INPUT VALIDATION & METHOD RESTRICTIONS");
    console.log("----------------------------------------------------------");
    // 2.1 Missing required fields
    const invalidBody = await handlePostPayments({
      user: managerUser,
      body: { amount: 1000 }, // missing supplierId and paymentMethod
    });
    assert(invalidBody.status === 400, "POST /api/supplier-payments: Missing required fields returns 400 Bad Request");

    // 2.2 Invalid payment amount (<= 0)
    const zeroAmount = await handlePostPayments({
      user: managerUser,
      body: { supplierId: supplier1._id.toString(), amount: 0, paymentMethod: "CASH" },
    });
    assert(zeroAmount.status === 400, "POST /api/supplier-payments: Non-positive amount returns 400 Bad Request");

    // 2.3 Invalid payment method
    const badMethod = await handlePostPayments({
      user: managerUser,
      body: { supplierId: supplier1._id.toString(), amount: 1000, paymentMethod: "BITCOIN" },
    });
    assert(badMethod.status === 400, "POST /api/supplier-payments: Invalid payment method returns 400 Bad Request");

    // 2.4 Allocation sum exceeding payment amount
    const overAllocatedBody = await handlePostPayments({
      user: managerUser,
      body: {
        supplierId: supplier1._id.toString(),
        amount: 5000,
        paymentMethod: "CASH",
        allocations: [{ purchaseId: purchaseS1._id.toString(), amount: 6000 }],
      },
    });
    assert(overAllocatedBody.status === 400, "POST /api/supplier-payments: Allocation sum exceeding payment returns 400 Bad Request");

    // 2.5 Methods not allowed on /api/supplier-payments/[id]
    const putRes = await handleMethodNotAllowed();
    assert(putRes.status === 405, "PUT /api/supplier-payments/[id] returns 405 Method Not Allowed");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 3: RECORDING FULL & PARTIAL PAYMENTS VIA API");
    console.log("----------------------------------------------------------");
    // 3.1 Partial payment of ₹6,000 against purchaseS1 (₹10,000 total)
    const partialPaymentRes = await handlePostPayments({
      user: managerUser,
      body: {
        supplierId: supplier1._id.toString(),
        amount: 6000,
        paymentMethod: "BANK_TRANSFER",
        paymentReference: "NEFT-IFFCO-01",
        allocations: [{ purchaseId: purchaseS1._id.toString(), amount: 6000 }],
        notes: "Partial payment for INV-IFFCO-101",
      },
    });

    assert(partialPaymentRes.status === 201, "POST /api/supplier-payments: Partial payment returns 201 Created");
    assert(partialPaymentRes.data.payment.paymentNumber.startsWith("PAY-"), "Sequential paymentNumber returned");
    assert(partialPaymentRes.data.payment.amount === 6000, "Payment amount is ₹6,000.00");
    assert(partialPaymentRes.data.payment.unallocatedAmount === 0, "Unallocated amount is ₹0.00");
    assert(partialPaymentRes.data.payment.allocations[0].allocatedAmount === 6000, "Allocation amount is ₹6,000.00");

    const pS1AfterPartial = await Purchase.findById(purchaseS1._id);
    assert(pS1AfterPartial.outstandingAmount === 4000, "Purchase 1 outstandingAmount decremented to ₹4,000.00");
    assert(pS1AfterPartial.paymentStatus === "PARTIALLY_PAID", "Purchase 1 status is PARTIALLY_PAID");

    // 3.2 Full settlement of remaining ₹4,000
    const fullSettlementRes = await handlePostPayments({
      user: ownerUser,
      body: {
        supplierId: supplier1._id.toString(),
        amount: 4000,
        paymentMethod: "UPI",
        paymentReference: "UPI-IFFCO-02",
        allocations: [{ purchaseId: purchaseS1._id.toString(), amount: 4000 }],
      },
    });

    assert(fullSettlementRes.status === 201, "POST /api/supplier-payments: Final settlement returns 201 Created");
    const pS1Final = await Purchase.findById(purchaseS1._id);
    assert(pS1Final.outstandingAmount === 0, "Purchase 1 outstandingAmount reached ₹0.00");
    assert(pS1Final.paymentStatus === "PAID", "Purchase 1 paymentStatus updated to PAID");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 4: MULTI-INVOICE ALLOCATIONS & SUPPLIER MISMATCH REJECTION");
    console.log("----------------------------------------------------------");
    // Create two purchases for Supplier 1
    const pS1_b = await Purchase.create({
      purchaseNumber: "PUR-202611-1003",
      supplierId: supplier1._id,
      supplierSnapshot: { name: supplier1.name, phone: supplier1.phone },
      supplierInvoiceNumber: "INV-IFFCO-103",
      supplierInvoiceDate: new Date(),
      items: [
        {
          productSnapshot: { name: "DAP 50kg", brand: "IFFCO", primaryUnit: "BAG" },
          orderedQty: 10,
          receivedQty: 10,
          unit: "BAG",
          unitPurchasePrice: 1000,
          lineTotal: 10000,
          recognizedValue: 10000,
        },
      ],
      subtotal: 10000,
      grandTotal: 10000,
      receivedQty: 10,
      recognizedInvoiceValue: 10000,
      amountPaid: 0,
      outstandingAmount: 10000,
      paymentStatus: "UNPAID",
      status: "RECEIVED",
      createdById: ownerUser.id,
    });

    const pS1_c = await Purchase.create({
      purchaseNumber: "PUR-202611-1004",
      supplierId: supplier1._id,
      supplierSnapshot: { name: supplier1.name, phone: supplier1.phone },
      supplierInvoiceNumber: "INV-IFFCO-104",
      supplierInvoiceDate: new Date(),
      items: [
        {
          productSnapshot: { name: "Potash 50kg", brand: "IFFCO", primaryUnit: "BAG" },
          orderedQty: 5,
          receivedQty: 5,
          unit: "BAG",
          unitPurchasePrice: 1000,
          lineTotal: 5000,
          recognizedValue: 5000,
        },
      ],
      subtotal: 5000,
      grandTotal: 5000,
      receivedQty: 5,
      recognizedInvoiceValue: 5000,
      amountPaid: 0,
      outstandingAmount: 5000,
      paymentStatus: "UNPAID",
      status: "RECEIVED",
      createdById: ownerUser.id,
    });

    await Supplier.findByIdAndUpdate(supplier1._id, {
      $inc: { totalPurchases: 15000, outstandingBalance: 15000 },
    });

    // 4.1 Reject cross-supplier allocation (allocating to purchaseS2 which belongs to Supplier 2)
    const crossSupplierRes = await handlePostPayments({
      user: managerUser,
      body: {
        supplierId: supplier1._id.toString(),
        amount: 8000,
        paymentMethod: "CASH",
        allocations: [{ purchaseId: purchaseS2._id.toString(), amount: 8000 }],
      },
    });
    assert(crossSupplierRes.status === 409, "POST /api/supplier-payments: Cross-supplier allocation rejected with 409 Conflict");

    // 4.2 Multi-invoice allocation: ₹12,000 paid across pS1_b (₹8,000) and pS1_c (₹4,000)
    const multiAllocRes = await handlePostPayments({
      user: managerUser,
      body: {
        supplierId: supplier1._id.toString(),
        amount: 12000,
        paymentMethod: "CHEQUE",
        paymentReference: "CHQ-MULTI-01",
        allocations: [
          { purchaseId: pS1_b._id.toString(), amount: 8000 },
          { purchaseId: pS1_c._id.toString(), amount: 4000 },
        ],
      },
    });

    assert(multiAllocRes.status === 201, "POST /api/supplier-payments: Multi-invoice allocation returns 201 Created");
    assert(multiAllocRes.data.payment.allocations.length === 2, "Payment contains exactly 2 allocations");

    const pS1_b_updated = await Purchase.findById(pS1_b._id);
    const pS1_c_updated = await Purchase.findById(pS1_c._id);
    assert(pS1_b_updated.outstandingAmount === 2000, "Purchase B outstandingAmount decremented to ₹2,000.00");
    assert(pS1_c_updated.outstandingAmount === 1000, "Purchase C outstandingAmount decremented to ₹1,000.00");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 5: IDEMPOTENCY & DUPLICATE SUBMISSION PROTECTION");
    console.log("----------------------------------------------------------");
    const idempotencyKey = "PAY-API-IDEMP-KEY-5544";

    const idempSubmission1 = await handlePostPayments({
      user: managerUser,
      body: {
        supplierId: supplier2._id.toString(),
        amount: 3000,
        paymentMethod: "UPI",
        notes: "Idempotent payment test",
      },
      headers: { "x-idempotency-key": idempotencyKey },
    });

    assert(idempSubmission1.status === 201, "First idempotent submission returns 201 Created");
    const supp2Mid = await Supplier.findById(supplier2._id);

    // Second submission with identical key
    const idempSubmission2 = await handlePostPayments({
      user: managerUser,
      body: {
        supplierId: supplier2._id.toString(),
        amount: 3000,
        paymentMethod: "UPI",
      },
      headers: { "x-idempotency-key": idempotencyKey },
    });

    const supp2Post = await Supplier.findById(supplier2._id);
    assert(idempSubmission1.data.payment.id === idempSubmission2.data.payment.id, "Second submission returns identical payment record");
    assert(supp2Mid.totalPaid === supp2Post.totalPaid, "Supplier totalPaid was NOT double-counted");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 6: ADVANCE PAYMENT & REVERSAL VIA API");
    console.log("----------------------------------------------------------");
    // 6.1 Create pure advance payment of ₹7,000 on Supplier 2
    const advancePayRes = await handlePostPayments({
      user: ownerUser,
      body: {
        supplierId: supplier2._id.toString(),
        amount: 7000,
        paymentMethod: "BANK_TRANSFER",
        paymentReference: "RTGS-ADV-7000",
        notes: "Advance deposit for upcoming orders",
      },
    });

    assert(advancePayRes.status === 201, "Advance payment created with 201 Created");
    assert(advancePayRes.data.payment.unallocatedAmount === 7000, "Payment unallocatedAmount is ₹7,000.00");
    assert(advancePayRes.data.payment.advanceRemaining === 7000, "Payment advanceRemaining is ₹7,000.00");
    assert(advancePayRes.data.payment.isExcessUpfrontCredit === false, "Manual payment correctly tagged isExcessUpfrontCredit = false");

    const paymentIdToReverse = advancePayRes.data.payment.id;

    // 6.2 Reverse without reason (< 3 chars) -> 400 Bad Request
    const badReasonRes = await handlePostReverse({
      user: ownerUser,
      id: paymentIdToReverse,
      body: { reason: "no" },
    });
    assert(badReasonRes.status === 400, "POST /api/supplier-payments/[id]/reverse: Short reason returns 400 Bad Request");

    // 6.3 Reverse with valid reason -> 200 OK
    const validReverseRes = await handlePostReverse({
      user: ownerUser,
      id: paymentIdToReverse,
      body: { reason: "Supplier cancelled the contract, refund processed" },
      headers: { "x-forwarded-for": "192.168.1.100" },
    });

    assert(validReverseRes.status === 200, "POST /api/supplier-payments/[id]/reverse: Valid reversal returns 200 OK");
    assert(validReverseRes.data.payment.status === "REVERSED", "Reversed payment status is REVERSED");
    assert(validReverseRes.data.payment.reversal.reason === "Supplier cancelled the contract, refund processed", "Reversal reason recorded");
    assert(validReverseRes.data.payment.reversal.reversedByName === ownerUser.name, "Reversal actor recorded");
    assert(validReverseRes.data.payment.advanceRemaining === 0, "Payment advanceRemaining reset to 0");

    // 6.4 Double reversal rejection -> 409 Conflict
    const doubleReverseRes = await handlePostReverse({
      user: ownerUser,
      id: paymentIdToReverse,
      body: { reason: "Attempting duplicate reversal" },
    });
    assert(doubleReverseRes.status === 409, "POST /api/supplier-payments/[id]/reverse: Already reversed returns 409 Conflict");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 7: REVERSAL OF CONSUMED ADVANCE REJECTION VIA API");
    console.log("----------------------------------------------------------");
    // Create advance of ₹5,000 on Supplier 2
    const advToConsumeRes = await handlePostPayments({
      user: ownerUser,
      body: {
        supplierId: supplier2._id.toString(),
        amount: 5000,
        paymentMethod: "CASH",
        notes: "Advance to be consumed by purchase",
      },
    });

    const advPaymentId = advToConsumeRes.data.payment.id;

    // Simulate purchase inward that consumes this ₹5,000 advance
    // Update payment record to reflect consumed state
    await SupplierPayment.findByIdAndUpdate(advPaymentId, {
      $set: {
        advanceRemaining: 0,
        advanceConsumed: 5000,
        advanceAdjustments: [
          {
            purchaseId: purchaseS2._id,
            purchaseNumber: "PUR-202611-1002",
            amount: 5000,
            adjustedAt: new Date(),
          },
        ],
      },
    });

    // Attempting reversal via API
    const consumedReverseRes = await handlePostReverse({
      user: ownerUser,
      id: advPaymentId,
      body: { reason: "Trying to reverse already consumed advance" },
    });

    assert(consumedReverseRes.status === 409, "POST /api/supplier-payments/[id]/reverse: Reversal of consumed advance rejected with 409 Conflict");
    assert(consumedReverseRes.data.message.includes("already been consumed"), "Error message cites that advance was already consumed");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 8: PAYMENT REGISTER FILTERS & PAGINATION VIA API");
    console.log("----------------------------------------------------------");
    // 8.1 Filter by supplierId
    const filterBySupplier = await handleGetPayments({
      user: clerkUser,
      query: { supplierId: supplier1._id.toString() },
    });
    assert(filterBySupplier.status === 200, "GET /api/supplier-payments: Filter by supplierId returns 200 OK");
    assert(filterBySupplier.data.payments.every((p) => p.supplierId === supplier1._id.toString()), "All returned payments belong to supplier 1");
    assert(filterBySupplier.data.stats !== undefined, "Aggregated KPI stats returned in response");

    // 8.2 Filter by paymentMethod
    const filterByMethod = await handleGetPayments({
      user: clerkUser,
      query: { paymentMethod: "UPI" },
    });
    assert(filterByMethod.status === 200, "GET /api/supplier-payments: Filter by paymentMethod returns 200 OK");
    assert(filterByMethod.data.payments.every((p) => p.paymentMethod === "UPI"), "All returned payments have paymentMethod UPI");

    // 8.3 Pagination check
    const paginatedRes = await handleGetPayments({
      user: clerkUser,
      query: { page: 1, limit: 2 },
    });
    assert(paginatedRes.status === 200, "GET /api/supplier-payments: Paginated list returns 200 OK");
    assert(paginatedRes.data.payments && paginatedRes.data.payments.length <= 2, "Pagination limit respected (<= 2 items)");
    assert(paginatedRes.data.totalPages >= 1, "totalPages calculated accurately");

    // 8.4 GET by ID
    const singlePayment = await handleGetPaymentById({
      user: clerkUser,
      id: partialPaymentRes.data.payment.id,
    });
    assert(singlePayment.status === 200, "GET /api/supplier-payments/[id]: Valid payment ID returns 200 OK");
    assert(singlePayment.data.payment.paymentNumber === partialPaymentRes.data.payment.paymentNumber, "Exact payment details returned");

    // 8.5 GET non-existent ID
    const notFoundPayment = await handleGetPaymentById({
      user: clerkUser,
      id: new mongoose.Types.ObjectId().toString(),
    });
    assert(notFoundPayment.status === 404, "GET /api/supplier-payments/[id]: Non-existent ID returns 404 Not Found");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 9: AUDIT LOG GENERATION ON PAYMENT & REVERSAL");
    console.log("----------------------------------------------------------");
    const paymentAudit = await AuditLog.findOne({ action: "SUPPLIER_PAYMENT_RECORDED" });
    assert(paymentAudit !== null, "AuditLog created for SUPPLIER_PAYMENT_RECORDED");
    assert(paymentAudit.userName === managerUser.name || paymentAudit.userName === ownerUser.name, "AuditLog records correct user name");

    const reversalAudit = await AuditLog.findOne({ action: "SUPPLIER_PAYMENT_REVERSED" });
    assert(reversalAudit !== null, "AuditLog created for SUPPLIER_PAYMENT_REVERSED");
    assert(reversalAudit.details.reason === "Supplier cancelled the contract, refund processed", "AuditLog records reversal reason in details");

    console.log("\n==========================================================");
    console.log(`TEST SUITE RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log("==========================================================\n");

    if (failed > 0) process.exit(1);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (replSet) {
      await replSet.stop();
    }
  }
}

runPhase5D2ApiTestSuite().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
