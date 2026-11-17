import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { SupplierPayment, type ISupplierPaymentDocument } from "@/models/supplier-payment";
import { Supplier } from "@/models/supplier";
import { Purchase } from "@/models/purchase";
import { logAuditEvent } from "@/lib/auth";
import type {
  ISupplierPayment,
  CreateSupplierPaymentInput,
  ReverseSupplierPaymentInput,
  SupplierPaymentFilterParams,
} from "@/types/supplier-payment";
import {
  createSupplierPaymentSchema,
  reverseSupplierPaymentSchema,
} from "@/validations/supplier-payment";

export interface ActorContext {
  id: string;
  name: string;
  ip?: string;
}

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

function formatSupplierPayment(doc: any): ISupplierPayment {
  return {
    id: doc._id.toString(),
    _id: doc._id.toString(),
    paymentNumber: doc.paymentNumber,
    supplierId: doc.supplierId.toString(),
    supplierSnapshot: {
      name: doc.supplierSnapshot.name,
      phone: doc.supplierSnapshot.phone,
      gstin: doc.supplierSnapshot.gstin,
    },
    paymentDate: doc.paymentDate instanceof Date ? doc.paymentDate.toISOString() : doc.paymentDate,
    amount: doc.amount,
    paymentMethod: doc.paymentMethod,
    paymentReference: doc.paymentReference,
    allocations: (doc.allocations || []).map((a: any) => ({
      purchaseId: a.purchaseId?.toString() || "",
      purchaseNumber: a.purchaseNumber,
      supplierInvoiceNumber: a.supplierInvoiceNumber,
      allocatedAmount: a.allocatedAmount,
    })),
    unallocatedAmount: doc.unallocatedAmount || 0,
    advanceRemaining: doc.advanceRemaining ?? doc.unallocatedAmount ?? 0,
    advanceConsumed: doc.advanceConsumed || 0,
    advanceAdjustments: (doc.advanceAdjustments || []).map((adj: any) => ({
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
          reversedAt:
            doc.reversal.reversedAt instanceof Date
              ? doc.reversal.reversedAt.toISOString()
              : doc.reversal.reversedAt,
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

/**
 * Absorbs available supplier advances using FIFO ordering and records complete
 * bidirectional provenance between originating SupplierPayment and destination Purchase.
 */
export async function absorbSupplierAdvanceWithProvenance(params: {
  supplierId: mongoose.Types.ObjectId | string;
  purchaseId: mongoose.Types.ObjectId | string;
  purchaseNumber: string;
  supplierInvoiceNumber?: string;
  liabilityAmount: number;
  session: mongoose.ClientSession;
}): Promise<{
  totalAbsorbed: number;
  adjustments: Array<{
    paymentId: mongoose.Types.ObjectId;
    paymentNumber: string;
    amount: number;
    adjustedAt: Date;
  }>;
}> {
  const { supplierId, purchaseId, purchaseNumber, supplierInvoiceNumber, liabilityAmount, session } = params;

  if (liabilityAmount <= 0) {
    return { totalAbsorbed: 0, adjustments: [] };
  }

  // Find all active payments for this supplier that hold available advance, ordered FIFO
  const candidatePayments = await SupplierPayment.find({
    supplierId: new mongoose.Types.ObjectId(supplierId),
    status: "RECORDED",
    advanceRemaining: { $gt: 0 },
  })
    .sort({ paymentDate: 1, createdAt: 1 })
    .session(session);

  let remainingLiabilityToAbsorb = round2(liabilityAmount);
  let totalAbsorbed = 0;
  const adjustments: Array<{
    paymentId: mongoose.Types.ObjectId;
    paymentNumber: string;
    amount: number;
    adjustedAt: Date;
  }> = [];

  const now = new Date();

  for (const payment of candidatePayments) {
    if (remainingLiabilityToAbsorb <= 0) break;

    const available = round2(payment.advanceRemaining || 0);
    if (available <= 0) continue;

    const toAbsorb = round2(Math.min(available, remainingLiabilityToAbsorb));

    // Update payment counters and provenance record
    payment.advanceRemaining = round2(payment.advanceRemaining - toAbsorb);
    payment.advanceConsumed = round2((payment.advanceConsumed || 0) + toAbsorb);
    payment.advanceAdjustments = payment.advanceAdjustments || [];
    payment.advanceAdjustments.push({
      purchaseId: new mongoose.Types.ObjectId(purchaseId),
      purchaseNumber,
      supplierInvoiceNumber,
      amount: toAbsorb,
      adjustedAt: now,
    });

    await payment.save({ session });

    adjustments.push({
      paymentId: payment._id as mongoose.Types.ObjectId,
      paymentNumber: payment.paymentNumber,
      amount: toAbsorb,
      adjustedAt: now,
    });

    totalAbsorbed = round2(totalAbsorbed + toAbsorb);
    remainingLiabilityToAbsorb = round2(remainingLiabilityToAbsorb - toAbsorb);
  }

  return { totalAbsorbed, adjustments };
}

/**
 * Generates sequential collision-proof supplier payment number: PAY-YYYYMM-XXXX
 */
export async function generatePaymentNumber(session?: mongoose.ClientSession): Promise<string> {
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
    if (!isNaN(lastSeq)) {
      seq = lastSeq + 1;
    }
  }

  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/**
 * Records a supplier payment with multi-invoice allocation and unallocated advance retention.
 * Executes atomically in a native MongoDB transaction with strict idempotency and validation.
 */
export async function recordSupplierPayment(
  input: CreateSupplierPaymentInput,
  actor: ActorContext
): Promise<ISupplierPayment> {
  await connectDB();

  // Validate input schema
  const parsed = createSupplierPaymentSchema.parse(input);

  // Idempotency check: Return existing payment if idempotencyKey matches
  if (parsed.idempotencyKey && parsed.idempotencyKey.trim()) {
    const existingPayment = await SupplierPayment.findOne({
      idempotencyKey: parsed.idempotencyKey.trim(),
    });
    if (existingPayment) {
      return formatSupplierPayment(existingPayment);
    }
  }

  const session = await mongoose.startSession();
  let createdPaymentDoc: any = null;

  try {
    await session.withTransaction(async () => {
      // 1. Validate Supplier
      const supplier = await Supplier.findById(parsed.supplierId).session(session);
      if (!supplier) {
        throw new Error("Supplier not found");
      }
      if (supplier.status === "ARCHIVED") {
        throw new Error("Cannot record payment for an archived supplier");
      }

      // 2. Validate and apply invoice allocations
      let totalAllocated = 0;
      const processedAllocations: Array<{
        purchaseId: mongoose.Types.ObjectId;
        purchaseNumber: string;
        supplierInvoiceNumber: string;
        allocatedAmount: number;
      }> = [];

      if (parsed.allocations && parsed.allocations.length > 0) {
        // Prevent duplicate purchaseId allocations in single payment request
        const seenPurchases = new Set<string>();

        for (const alloc of parsed.allocations) {
          if (seenPurchases.has(alloc.purchaseId)) {
            throw new Error(`Duplicate allocation for purchase ID ${alloc.purchaseId} in the same payment`);
          }
          seenPurchases.add(alloc.purchaseId);

          const purchase = await Purchase.findById(alloc.purchaseId).session(session);
          if (!purchase) {
            throw new Error(`Purchase invoice not found: ${alloc.purchaseId}`);
          }

          // Supplier ownership check
          if (purchase.supplierId.toString() !== supplier._id.toString()) {
            throw new Error(
              `Purchase invoice ${purchase.purchaseNumber} belongs to a different supplier, not '${supplier.name}'`
            );
          }

          // Goods inward check: Allocation is only permitted for received goods
          if (purchase.status === "PENDING_RECEIPT" || purchase.status === "DRAFT") {
            throw new Error(
              `Cannot allocate payment to purchase ${purchase.purchaseNumber} with status '${purchase.status}'. Goods must be inwarded/received first.`
            );
          }
          if (purchase.status === "CANCELLED") {
            throw new Error(
              `Cannot allocate payment to cancelled purchase ${purchase.purchaseNumber}`
            );
          }
          if (purchase.recognizedInvoiceValue <= 0) {
            throw new Error(
              `Cannot allocate payment to purchase ${purchase.purchaseNumber} with zero recognized goods receipt value`
            );
          }

          // Outstanding balance check
          if (purchase.outstandingAmount <= 0) {
            throw new Error(
              `Purchase invoice ${purchase.purchaseNumber} has no outstanding balance to pay`
            );
          }

          const allocAmount = round2(alloc.amount);
          if (allocAmount > purchase.outstandingAmount) {
            throw new Error(
              `Allocation amount ₹${allocAmount} exceeds eligible outstanding balance ₹${purchase.outstandingAmount} on purchase ${purchase.purchaseNumber}`
            );
          }

          // Update purchase balances
          purchase.amountPaid = round2(purchase.amountPaid + allocAmount);
          purchase.outstandingAmount = Math.max(
            0,
            round2(purchase.recognizedInvoiceValue - purchase.amountPaid)
          );
          purchase.paymentStatus =
            purchase.outstandingAmount === 0 ? "PAID" : "PARTIALLY_PAID";
          purchase.updatedById = new mongoose.Types.ObjectId(actor.id);

          await purchase.save({ session });

          processedAllocations.push({
            purchaseId: purchase._id as mongoose.Types.ObjectId,
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
        throw new Error(
          `Total allocated amount (₹${totalAllocated}) exceeds payment amount (₹${paymentAmount})`
        );
      }

      const unallocatedAmount = round2(paymentAmount - totalAllocated);

      // 3. Atomic Supplier Ledger Update
      // - totalPaid increments by full payment disbursement
      // - outstandingBalance decrements by allocated amount
      // - advanceBalance increments by unallocated amount
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

      // 4. Sequential Payment Number Generation
      const paymentNumber = await generatePaymentNumber(session);

      // 5. Create SupplierPayment record
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
            paymentReference: parsed.paymentReference?.trim() || undefined,
            allocations: processedAllocations,
            unallocatedAmount,
            advanceRemaining: unallocatedAmount,
            advanceConsumed: 0,
            advanceAdjustments: [],
            notes: parsed.notes?.trim() || undefined,
            status: "RECORDED",
            idempotencyKey: parsed.idempotencyKey?.trim() || undefined,
            createdById: new mongoose.Types.ObjectId(actor.id),
            createdByName: actor.name,
          },
        ],
        { session }
      );

      createdPaymentDoc = newPayment;
    });
  } finally {
    await session.endSession();
  }

  if (!createdPaymentDoc) {
    throw new Error("Failed to record supplier payment");
  }

  // Audit event logging
  await logAuditEvent({
    action: "SUPPLIER_PAYMENT_RECORDED" as any,
    userId: actor.id,
    userName: actor.name,
    ipAddress: actor.ip,
    details: {
      paymentId: createdPaymentDoc._id.toString(),
      paymentNumber: createdPaymentDoc.paymentNumber,
      supplierId: input.supplierId,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      unallocatedAmount: createdPaymentDoc.unallocatedAmount,
      allocationsCount: createdPaymentDoc.allocations?.length || 0,
    },
  });

  return formatSupplierPayment(createdPaymentDoc);
}

/**
 * Reverses a supplier payment safely with full rollback of purchase and supplier counters.
 * Prohibits reversal if unallocated advance has already been absorbed/drawn down by subsequent purchases.
 */
export async function reverseSupplierPayment(
  input: ReverseSupplierPaymentInput,
  actor: ActorContext
): Promise<ISupplierPayment> {
  await connectDB();

  const parsed = reverseSupplierPaymentSchema.parse(input);

  const session = await mongoose.startSession();
  let updatedPaymentDoc: any = null;

  try {
    await session.withTransaction(async () => {
      // 1. Fetch payment
      const payment = await SupplierPayment.findById(parsed.paymentId).session(session);
      if (!payment) {
        throw new Error("Supplier payment record not found");
      }

      if (payment.status === "REVERSED") {
        throw new Error(`Supplier payment ${payment.paymentNumber} is already reversed`);
      }

      // 2. Fetch supplier
      const supplier = await Supplier.findById(payment.supplierId).session(session);
      if (!supplier) {
        throw new Error("Supplier not found for this payment record");
      }

      // 3. Provenance-Based Safety Guard: Check if originating payment's advance was already consumed
      if (payment.unallocatedAmount > 0) {
        const consumed = round2(payment.advanceConsumed || 0);
        const remaining = round2(payment.advanceRemaining ?? payment.unallocatedAmount);

        if (consumed > 0 || remaining < payment.unallocatedAmount) {
          const invoices = (payment.advanceAdjustments || []).map((a: any) => a.purchaseNumber).join(", ");
          throw new Error(
            `Cannot reverse payment ${payment.paymentNumber}: ₹${consumed} of its unallocated advance has already been consumed by purchase invoices (${invoices || "recorded purchases"}). Originating advance is no longer available.`
          );
        }
      }

      // 4. Revert allocations on each purchase invoice
      let totalRevertedAllocations = 0;
      for (const alloc of payment.allocations) {
        const purchase = await Purchase.findById(alloc.purchaseId).session(session);
        if (purchase) {
          purchase.amountPaid = Math.max(0, round2(purchase.amountPaid - alloc.allocatedAmount));
          purchase.outstandingAmount = Math.max(
            0,
            round2(purchase.recognizedInvoiceValue - purchase.amountPaid)
          );
          purchase.paymentStatus =
            purchase.outstandingAmount === 0 && purchase.recognizedInvoiceValue > 0
              ? "PAID"
              : purchase.amountPaid > 0
              ? "PARTIALLY_PAID"
              : "UNPAID";
          purchase.updatedById = new mongoose.Types.ObjectId(actor.id);

          await purchase.save({ session });
        }
        totalRevertedAllocations = round2(totalRevertedAllocations + alloc.allocatedAmount);
      }

      // 5. Revert supplier financial ledger counters
      // - totalPaid decrements by full payment amount
      // - outstandingBalance increments by the reverted allocations
      // - advanceBalance decrements ONLY by this payment's remaining unused advance
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

      // 6. Update payment document with reversal metadata (append-only audit trace)
      payment.status = "REVERSED";
      payment.advanceRemaining = 0;
      payment.reversal = {
        reason: parsed.reason.trim(),
        reversedAt: new Date(),
        reversedById: new mongoose.Types.ObjectId(actor.id),
        reversedByName: actor.name,
      };

      await payment.save({ session });
      updatedPaymentDoc = payment;
    });
  } finally {
    await session.endSession();
  }

  if (!updatedPaymentDoc) {
    throw new Error("Failed to reverse supplier payment");
  }

  // Audit event logging
  await logAuditEvent({
    action: "SUPPLIER_PAYMENT_REVERSED" as any,
    userId: actor.id,
    userName: actor.name,
    ipAddress: actor.ip,
    details: {
      paymentId: updatedPaymentDoc._id.toString(),
      paymentNumber: updatedPaymentDoc.paymentNumber,
      supplierId: updatedPaymentDoc.supplierId.toString(),
      amount: updatedPaymentDoc.amount,
      reason: parsed.reason,
    },
  });

  return formatSupplierPayment(updatedPaymentDoc);
}

/**
 * Retrieves a single supplier payment by ID.
 */
export async function getSupplierPaymentById(id: string): Promise<ISupplierPayment | null> {
  await connectDB();

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  const payment = await SupplierPayment.findById(id).lean();
  if (!payment) return null;

  return formatSupplierPayment(payment);
}

/**
 * Lists supplier payments with filtering, pagination, and KPI aggregation stats.
 */
export async function listSupplierPayments(params: SupplierPaymentFilterParams = {}): Promise<{
  payments: ISupplierPayment[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: {
    totalRecordedAmount: number;
    totalAllocatedAmount: number;
    totalUnallocatedAdvance: number;
    reversedCount: number;
  };
}> {
  await connectDB();

  const {
    search,
    supplierId,
    paymentMethod,
    status,
    startDate,
    endDate,
    page = 1,
    limit = 20,
  } = params;

  const filter: Record<string, any> = {};

  if (search && search.trim()) {
    const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    filter.$or = [
      { paymentNumber: { $regex: escaped, $options: "i" } },
      { paymentReference: { $regex: escaped, $options: "i" } },
      { "supplierSnapshot.name": { $regex: escaped, $options: "i" } },
    ];
  }

  if (supplierId && mongoose.Types.ObjectId.isValid(supplierId)) {
    filter.supplierId = new mongoose.Types.ObjectId(supplierId);
  }

  if (paymentMethod) {
    filter.paymentMethod = paymentMethod;
  }

  if (status) {
    filter.status = status;
  }

  if (startDate || endDate) {
    filter.paymentDate = {};
    if (startDate) {
      filter.paymentDate.$gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.paymentDate.$lte = end;
    }
  }

  const skip = (Math.max(1, page) - 1) * limit;

  const [docs, totalCount, statsAgg] = await Promise.all([
    SupplierPayment.find(filter)
      .sort({ paymentDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    SupplierPayment.countDocuments(filter),
    SupplierPayment.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRecordedAmount: {
            $sum: { $cond: [{ $eq: ["$status", "RECORDED"] }, "$amount", 0] },
          },
          totalUnallocatedAdvance: {
            $sum: { $cond: [{ $eq: ["$status", "RECORDED"] }, "$unallocatedAmount", 0] },
          },
          reversedCount: {
            $sum: { $cond: [{ $eq: ["$status", "REVERSED"] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  const rawStats = statsAgg[0] || {
    totalRecordedAmount: 0,
    totalUnallocatedAdvance: 0,
    reversedCount: 0,
  };

  const totalRecorded = round2(rawStats.totalRecordedAmount || 0);
  const totalAdvance = round2(rawStats.totalUnallocatedAdvance || 0);
  const totalAllocated = round2(Math.max(0, totalRecorded - totalAdvance));

  return {
    payments: docs.map((d: any) => formatSupplierPayment(d)),
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
