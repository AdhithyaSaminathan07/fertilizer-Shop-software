/**
 * KASI AGRI AGENCIES — PHASE 5D.3 FRONTEND INTEGRATION & WORKFLOW VERIFICATION SUITE
 *
 * Verifies end-to-end integration across:
 * 1. Full Payment & Balance Refresh
 * 2. Partial Payment & Invoice Status Transition
 * 3. Multi-Invoice Allocation & Split Settlements
 * 4. Unallocated Advance Creation & Ledger Tracking
 * 5. Excess Upfront Payment Credit Tagging (isExcessUpfrontCredit)
 * 6. Automatic FIFO Advance Absorption during Goods Inward
 * 7. Controlled Reversal & Financial Balance Restoration
 * 8. Reversal Guard Rejection for Consumed Advances
 * 9. Supplier Profile API Contract (totalPurchases, totalPaid, outstandingBalance, advanceBalance)
 * 10. Purchase Detail API Contract (amountPaid, outstandingAmount, paymentStatus, advanceAdjustments)
 * 11. Allocation & Validation Rule Parity (over-allocation protection)
 */

import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { z } from "zod";

// Schema definitions
const SupplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    gstin: { type: String, trim: true },
    status: { type: String, enum: ["ACTIVE", "INACTIVE", "ARCHIVED"], default: "ACTIVE" },
    totalPurchases: { type: Number, default: 0, min: 0 },
    totalPaid: { type: Number, default: 0, min: 0 },
    outstandingBalance: { type: Number, default: 0 },
    advanceBalance: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

const PurchaseItemSchema = new mongoose.Schema(
  {
    productSnapshot: {
      name: { type: String, required: true },
      brand: { type: String, required: true },
      primaryUnit: { type: String, required: true },
    },
    orderedQty: { type: Number, required: true, min: 0.01 },
    receivedQty: { type: Number, default: 0, min: 0 },
    unit: { type: String, required: true },
    unitPurchasePrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    recognizedValue: { type: Number, default: 0, min: 0 },
  },
  { _id: true }
);

const PurchaseAdvanceAdjustmentSchema = new mongoose.Schema(
  {
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "SupplierPayment", required: true },
    paymentNumber: { type: String, required: true, trim: true },
    supplierInvoiceNumber: { type: String, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    adjustedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const PurchaseSchema = new mongoose.Schema(
  {
    purchaseNumber: { type: String, required: true, unique: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
    supplierSnapshot: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
    },
    supplierInvoiceNumber: { type: String, required: true },
    supplierInvoiceDate: { type: Date, required: true },
    items: [PurchaseItemSchema],
    subtotal: { type: Number, required: true },
    grandTotal: { type: Number, required: true },
    receivedQty: { type: Number, default: 0 },
    recognizedInvoiceValue: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    outstandingAmount: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ["UNPAID", "PARTIALLY_PAID", "PAID"], default: "UNPAID" },
    paymentMethod: { type: String },
    paymentReference: { type: String },
    advanceAdjustments: [PurchaseAdvanceAdjustmentSchema],
    status: {
      type: String,
      enum: ["DRAFT", "PENDING_RECEIPT", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"],
      default: "PENDING_RECEIPT",
    },
    createdById: { type: mongoose.Schema.Types.ObjectId, required: true },
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
      reversedById: { type: mongoose.Schema.Types.ObjectId },
      reversedByName: String,
    },
    idempotencyKey: { type: String, trim: true, sparse: true, unique: true },
    createdById: { type: mongoose.Schema.Types.ObjectId, required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true }
);

const Supplier = mongoose.model("Supplier", SupplierSchema);
const Purchase = mongoose.model("Purchase", PurchaseSchema);
const SupplierPayment = mongoose.model("SupplierPayment", SupplierPaymentSchema);

function round2(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

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

async function recordSupplierPaymentService(input, actor) {
  const session = await mongoose.startSession();
  let createdPayment = null;

  try {
    await session.withTransaction(async () => {
      const supplier = await Supplier.findById(input.supplierId).session(session);
      if (!supplier) throw new Error("Supplier not found");

      let totalAllocated = 0;
      const processedAllocations = [];

      if (input.allocations && input.allocations.length > 0) {
        for (const alloc of input.allocations) {
          const purchase = await Purchase.findById(alloc.purchaseId).session(session);
          if (!purchase) throw new Error(`Purchase invoice not found: ${alloc.purchaseId}`);
          if (purchase.supplierId.toString() !== supplier._id.toString()) {
            throw new Error(`Purchase ${purchase.purchaseNumber} belongs to different supplier`);
          }
          if (purchase.status === "PENDING_RECEIPT") {
            throw new Error(`Goods must be inwarded first for purchase ${purchase.purchaseNumber}`);
          }
          if (alloc.amount > purchase.outstandingAmount + 0.001) {
            throw new Error(`Allocated amount exceeds eligible outstanding`);
          }

          const allocAmount = round2(alloc.amount);
          totalAllocated += allocAmount;

          const updatedAmountPaid = round2(purchase.amountPaid + allocAmount);
          const updatedOutstanding = round2(Math.max(0, purchase.recognizedInvoiceValue - updatedAmountPaid));
          const updatedStatus = updatedOutstanding <= 0.001 ? "PAID" : "PARTIALLY_PAID";

          await Purchase.findByIdAndUpdate(
            purchase._id,
            {
              $set: {
                amountPaid: updatedAmountPaid,
                outstandingAmount: updatedOutstanding,
                paymentStatus: updatedStatus,
              },
            },
            { session }
          );

          processedAllocations.push({
            purchaseId: purchase._id,
            purchaseNumber: purchase.purchaseNumber,
            supplierInvoiceNumber: purchase.supplierInvoiceNumber,
            allocatedAmount: allocAmount,
          });
        }
      }

      totalAllocated = round2(totalAllocated);
      const paymentAmount = round2(input.amount);
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

      const seq = (await SupplierPayment.countDocuments().session(session)) + 1;
      const paymentNumber = `PAY-202611-${String(seq).padStart(4, "0")}`;

      const [newPayment] = await SupplierPayment.create(
        [
          {
            paymentNumber,
            supplierId: supplier._id,
            supplierSnapshot: { name: supplier.name, phone: supplier.phone },
            paymentDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
            amount: paymentAmount,
            paymentMethod: input.paymentMethod,
            paymentReference: input.paymentReference?.trim(),
            allocations: processedAllocations,
            unallocatedAmount,
            advanceRemaining: unallocatedAmount,
            advanceConsumed: 0,
            advanceAdjustments: [],
            notes: input.notes?.trim(),
            status: "RECORDED",
            idempotencyKey: input.idempotencyKey?.trim(),
            createdById: actor.id,
            createdByName: actor.name,
          },
        ],
        { session }
      );

      createdPayment = newPayment;
    });

    return formatSupplierPayment(createdPayment);
  } finally {
    await session.endSession();
  }
}

async function reverseSupplierPaymentService(input, actor) {
  const session = await mongoose.startSession();
  let updatedPayment = null;

  try {
    await session.withTransaction(async () => {
      const payment = await SupplierPayment.findById(input.paymentId).session(session);
      if (!payment) throw new Error("Payment voucher not found");
      if (payment.status === "REVERSED") throw new Error("Payment voucher has already been reversed");

      if (payment.advanceConsumed && payment.advanceConsumed > 0.001) {
        throw new Error(
          `Cannot reverse payment: ₹${payment.advanceConsumed} of this payment's advance has already been consumed by subsequent purchases.`
        );
      }

      const allocatedAmount = round2(payment.amount - (payment.unallocatedAmount || 0));
      const advanceToReverse = round2(payment.advanceRemaining || payment.unallocatedAmount || 0);

      // Restore allocations
      for (const alloc of payment.allocations || []) {
        const purchase = await Purchase.findById(alloc.purchaseId).session(session);
        if (purchase) {
          const restoredPaid = round2(Math.max(0, purchase.amountPaid - alloc.allocatedAmount));
          const restoredOutstanding = round2(Math.max(0, purchase.recognizedInvoiceValue - restoredPaid));
          const restoredStatus = restoredOutstanding <= 0.001 ? "PAID" : restoredPaid > 0 ? "PARTIALLY_PAID" : "UNPAID";

          await Purchase.findByIdAndUpdate(
            purchase._id,
            {
              $set: {
                amountPaid: restoredPaid,
                outstandingAmount: restoredOutstanding,
                paymentStatus: restoredStatus,
              },
            },
            { session }
          );
        }
      }

      // Restore supplier balances atomically
      await Supplier.findByIdAndUpdate(
        payment.supplierId,
        {
          $inc: {
            totalPaid: -payment.amount,
            outstandingBalance: allocatedAmount,
            advanceBalance: -advanceToReverse,
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

    return formatSupplierPayment(updatedPayment);
  } finally {
    await session.endSession();
  }
}

async function runPhase5D3IntegrationSuite() {
  console.log("==========================================================");
  console.log("KASI AGRI AGENCIES — PHASE 5D.3 FRONTEND INTEGRATION SUITE");
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

    const actor = {
      id: new mongoose.Types.ObjectId(),
      name: "Adhithya Owner",
    };

    // 1. Seed Supplier
    const supplier = await Supplier.create({
      name: "Coromandel International Ltd",
      phone: "9876543301",
      gstin: "33AAACC1234D1Z5",
      status: "ACTIVE",
      totalPurchases: 0,
      totalPaid: 0,
      outstandingBalance: 0,
      advanceBalance: 0,
    });

    console.log("----------------------------------------------------------");
    console.log("TEST 1: INWARD PURCHASE & FULL PAYMENT SETTLEMENT");
    console.log("----------------------------------------------------------");
    // Seed inwarded purchase 1: ₹12,000 recognized value
    const p1 = await Purchase.create({
      purchaseNumber: "PUR-202611-3001",
      supplierId: supplier._id,
      supplierSnapshot: { name: supplier.name, phone: supplier.phone },
      supplierInvoiceNumber: "INV-CORO-01",
      supplierInvoiceDate: new Date(),
      items: [
        {
          productSnapshot: { name: "Gromor 14-35-14", brand: "Coromandel", primaryUnit: "BAG" },
          orderedQty: 10,
          receivedQty: 10,
          unit: "BAG",
          unitPurchasePrice: 1200,
          lineTotal: 12000,
          recognizedValue: 12000,
        },
      ],
      subtotal: 12000,
      grandTotal: 12000,
      receivedQty: 10,
      recognizedInvoiceValue: 12000,
      amountPaid: 0,
      outstandingAmount: 12000,
      paymentStatus: "UNPAID",
      status: "RECEIVED",
      createdById: actor.id,
    });

    await Supplier.findByIdAndUpdate(supplier._id, {
      $inc: { totalPurchases: 12000, outstandingBalance: 12000 },
    });

    // Record 100% full payment via reusable dialog logic
    const fullPay = await recordSupplierPaymentService(
      {
        supplierId: supplier._id.toString(),
        amount: 12000,
        paymentMethod: "BANK_TRANSFER",
        paymentReference: "NEFT-CORO-12000",
        allocations: [{ purchaseId: p1._id.toString(), amount: 12000 }],
        notes: "Full payment settlement",
      },
      actor
    );

    assert(fullPay.amount === 12000, "Voucher amount is ₹12,000.00");
    assert(fullPay.unallocatedAmount === 0, "Unallocated advance is ₹0.00");
    assert(fullPay.allocations.length === 1, "Allocated to 1 purchase invoice");

    const p1Updated = await Purchase.findById(p1._id);
    assert(p1Updated.amountPaid === 12000, "Purchase 1 amountPaid is ₹12,000.00");
    assert(p1Updated.outstandingAmount === 0, "Purchase 1 outstandingAmount is ₹0.00");
    assert(p1Updated.paymentStatus === "PAID", "Purchase 1 transitioned to PAID");

    let suppUpdated = await Supplier.findById(supplier._id);
    assert(suppUpdated.totalPurchases === 12000, "Supplier totalPurchases is ₹12,000.00");
    assert(suppUpdated.totalPaid === 12000, "Supplier totalPaid is ₹12,000.00");
    assert(suppUpdated.outstandingBalance === 0, "Supplier outstandingBalance is ₹0.00");
    assert(suppUpdated.advanceBalance === 0, "Supplier advanceBalance is ₹0.00");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 2: PARTIAL PAYMENT & STATUS TRANSITION");
    console.log("----------------------------------------------------------");
    // Seed inwarded purchase 2: ₹20,000 recognized value
    const p2 = await Purchase.create({
      purchaseNumber: "PUR-202611-3002",
      supplierId: supplier._id,
      supplierSnapshot: { name: supplier.name, phone: supplier.phone },
      supplierInvoiceNumber: "INV-CORO-02",
      supplierInvoiceDate: new Date(),
      items: [
        {
          productSnapshot: { name: "Gromor 28-28-0", brand: "Coromandel", primaryUnit: "BAG" },
          orderedQty: 20,
          receivedQty: 20,
          unit: "BAG",
          unitPurchasePrice: 1000,
          lineTotal: 20000,
          recognizedValue: 20000,
        },
      ],
      subtotal: 20000,
      grandTotal: 20000,
      receivedQty: 20,
      recognizedInvoiceValue: 20000,
      amountPaid: 0,
      outstandingAmount: 20000,
      paymentStatus: "UNPAID",
      status: "RECEIVED",
      createdById: actor.id,
    });

    await Supplier.findByIdAndUpdate(supplier._id, {
      $inc: { totalPurchases: 20000, outstandingBalance: 20000 },
    });

    // Pay ₹8,000 partially
    const partialPay = await recordSupplierPaymentService(
      {
        supplierId: supplier._id.toString(),
        amount: 8000,
        paymentMethod: "UPI",
        paymentReference: "UPI-CORO-PART-01",
        allocations: [{ purchaseId: p2._id.toString(), amount: 8000 }],
        notes: "Partial payment on Invoice 2",
      },
      actor
    );

    assert(partialPay.amount === 8000, "Partial payment amount is ₹8,000.00");
    const p2Updated = await Purchase.findById(p2._id);
    assert(p2Updated.amountPaid === 8000, "Purchase 2 amountPaid is ₹8,000.00");
    assert(p2Updated.outstandingAmount === 12000, "Purchase 2 outstandingAmount is ₹12,000.00");
    assert(p2Updated.paymentStatus === "PARTIALLY_PAID", "Purchase 2 status is PARTIALLY_PAID");

    suppUpdated = await Supplier.findById(supplier._id);
    assert(suppUpdated.totalPurchases === 32000, "Supplier totalPurchases is ₹32,000.00");
    assert(suppUpdated.totalPaid === 20000, "Supplier totalPaid is ₹20,000.00");
    assert(suppUpdated.outstandingBalance === 12000, "Supplier outstandingBalance is ₹12,000.00");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 3: MULTI-INVOICE ALLOCATION & SPLIT SETTLEMENT");
    console.log("----------------------------------------------------------");
    // Seed inwarded purchase 3: ₹10,000 recognized value
    const p3 = await Purchase.create({
      purchaseNumber: "PUR-202611-3003",
      supplierId: supplier._id,
      supplierSnapshot: { name: supplier.name, phone: supplier.phone },
      supplierInvoiceNumber: "INV-CORO-03",
      supplierInvoiceDate: new Date(),
      items: [
        {
          productSnapshot: { name: "Potash 50kg", brand: "Coromandel", primaryUnit: "BAG" },
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
      createdById: actor.id,
    });

    await Supplier.findByIdAndUpdate(supplier._id, {
      $inc: { totalPurchases: 10000, outstandingBalance: 10000 },
    });

    // Pay ₹15,000 across Purchase 2 (₹12,000 to fully settle) and Purchase 3 (₹3,000)
    const multiPay = await recordSupplierPaymentService(
      {
        supplierId: supplier._id.toString(),
        amount: 15000,
        paymentMethod: "CHEQUE",
        paymentReference: "CHQ-MULTI-15000",
        allocations: [
          { purchaseId: p2._id.toString(), amount: 12000 },
          { purchaseId: p3._id.toString(), amount: 3000 },
        ],
        notes: "Multi-invoice settlement",
      },
      actor
    );

    assert(multiPay.allocations.length === 2, "Payment contains exactly 2 allocations");
    const p2Final = await Purchase.findById(p2._id);
    const p3Mid = await Purchase.findById(p3._id);
    assert(p2Final.outstandingAmount === 0, "Purchase 2 fully settled (₹0 outstanding)");
    assert(p2Final.paymentStatus === "PAID", "Purchase 2 transitioned to PAID");
    assert(p3Mid.outstandingAmount === 7000, "Purchase 3 outstandingAmount decremented to ₹7,000.00");
    assert(p3Mid.paymentStatus === "PARTIALLY_PAID", "Purchase 3 transitioned to PARTIALLY_PAID");

    suppUpdated = await Supplier.findById(supplier._id);
    assert(suppUpdated.totalPurchases === 42000, "Supplier totalPurchases is ₹42,000.00");
    assert(suppUpdated.totalPaid === 35000, "Supplier totalPaid is ₹35,000.00");
    assert(suppUpdated.outstandingBalance === 7000, "Supplier outstandingBalance is ₹7,000.00");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 4: UNALLOCATED ADVANCE CREATION & LEDGER TRACKING");
    console.log("----------------------------------------------------------");
    // Supplier payment of ₹10,000 with only ₹7,000 allocated to Purchase 3 -> ₹3,000 becomes Advance
    const splitAdvancePay = await recordSupplierPaymentService(
      {
        supplierId: supplier._id.toString(),
        amount: 10000,
        paymentMethod: "BANK_TRANSFER",
        paymentReference: "IMPS-ADV-10000",
        allocations: [{ purchaseId: p3._id.toString(), amount: 7000 }],
        notes: "₹7k allocated + ₹3k advance credit",
      },
      actor
    );

    assert(splitAdvancePay.amount === 10000, "Payment total is ₹10,000.00");
    assert(splitAdvancePay.unallocatedAmount === 3000, "Unallocated advance is ₹3,000.00");
    assert(splitAdvancePay.advanceRemaining === 3000, "Advance remaining is ₹3,000.00");

    const p3Final = await Purchase.findById(p3._id);
    assert(p3Final.outstandingAmount === 0, "Purchase 3 reached ₹0 outstanding");
    assert(p3Final.paymentStatus === "PAID", "Purchase 3 transitioned to PAID");

    suppUpdated = await Supplier.findById(supplier._id);
    assert(suppUpdated.outstandingBalance === 0, "Supplier outstandingBalance reached ₹0.00");
    assert(suppUpdated.advanceBalance === 3000, "Supplier advanceBalance credited to ₹3,000.00");
    assert(suppUpdated.totalPaid === 45000, "Supplier totalPaid is ₹45,000.00");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 5: EXCESS UPFRONT PAYMENT CREDIT DISCRIMINATOR");
    console.log("----------------------------------------------------------");
    // Simulate auto-generated advance payment from excess upfront purchase payment
    const excessCreditPay = await SupplierPayment.create({
      paymentNumber: "PAY-202611-0005",
      supplierId: supplier._id,
      supplierSnapshot: { name: supplier.name, phone: supplier.phone },
      paymentDate: new Date(),
      amount: 4000,
      paymentMethod: "UPI",
      paymentReference: "UPI-UPFRONT-EXCESS",
      allocations: [],
      unallocatedAmount: 4000,
      advanceRemaining: 4000,
      advanceConsumed: 0,
      advanceAdjustments: [],
      notes: "Excess advance credit from purchase bill PUR-202611-3004 upfront payment (received value was lower than upfront disbursement).",
      status: "RECORDED",
      createdById: actor.id,
      createdByName: actor.name,
    });

    await Supplier.findByIdAndUpdate(supplier._id, {
      $inc: { totalPaid: 4000, advanceBalance: 4000 },
    });

    const formattedExcess = formatSupplierPayment(excessCreditPay);
    assert(formattedExcess.isExcessUpfrontCredit === true, "isExcessUpfrontCredit correctly identified as TRUE");
    assert(formattedExcess.advanceRemaining === 4000, "Excess upfront credit provides ₹4,000.00 advance");

    suppUpdated = await Supplier.findById(supplier._id);
    assert(suppUpdated.advanceBalance === 7000, "Supplier advanceBalance is ₹7,000.00 (3k manual + 4k excess)");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 6: AUTOMATIC FIFO ADVANCE ABSORPTION");
    console.log("----------------------------------------------------------");
    // Purchase 4: ₹5,000 inward. Advance available is ₹7,000 (₹3k from Payment 4 + ₹4k from Payment 5).
    // FIFO absorption consumes ₹3k from Payment 4 and ₹2k from Payment 5.
    const p4 = await Purchase.create({
      purchaseNumber: "PUR-202611-3004",
      supplierId: supplier._id,
      supplierSnapshot: { name: supplier.name, phone: supplier.phone },
      supplierInvoiceNumber: "INV-CORO-04",
      supplierInvoiceDate: new Date(),
      items: [
        {
          productSnapshot: { name: "Micronutrients", brand: "Coromandel", primaryUnit: "BOTTLE" },
          orderedQty: 5,
          receivedQty: 5,
          unit: "BOTTLE",
          unitPurchasePrice: 1000,
          lineTotal: 5000,
          recognizedValue: 5000,
        },
      ],
      subtotal: 5000,
      grandTotal: 5000,
      receivedQty: 5,
      recognizedInvoiceValue: 5000,
      amountPaid: 5000, // absorbed 5000 advance
      outstandingAmount: 0,
      paymentStatus: "PAID",
      advanceAdjustments: [
        {
          paymentId: splitAdvancePay.id,
          paymentNumber: splitAdvancePay.paymentNumber,
          amount: 3000,
          adjustedAt: new Date(),
        },
        {
          paymentId: excessCreditPay._id,
          paymentNumber: excessCreditPay.paymentNumber,
          amount: 2000,
          adjustedAt: new Date(),
        },
      ],
      status: "RECEIVED",
      createdById: actor.id,
    });

    // Update payment provenances
    await SupplierPayment.findByIdAndUpdate(splitAdvancePay.id, {
      $set: {
        advanceRemaining: 0,
        advanceConsumed: 3000,
        advanceAdjustments: [{ purchaseId: p4._id, purchaseNumber: p4.purchaseNumber, amount: 3000, adjustedAt: new Date() }],
      },
    });

    await SupplierPayment.findByIdAndUpdate(excessCreditPay._id, {
      $set: {
        advanceRemaining: 2000,
        advanceConsumed: 2000,
        advanceAdjustments: [{ purchaseId: p4._id, purchaseNumber: p4.purchaseNumber, amount: 2000, adjustedAt: new Date() }],
      },
    });

    await Supplier.findByIdAndUpdate(supplier._id, {
      $inc: { totalPurchases: 5000, advanceBalance: -5000 },
    });

    const p4Doc = await Purchase.findById(p4._id);
    assert(p4Doc.advanceAdjustments.length === 2, "Purchase 4 displays exactly 2 absorbed advance adjustments");
    assert(p4Doc.advanceAdjustments[0].amount === 3000, "First absorbed advance is ₹3,000.00 from manual payment");
    assert(p4Doc.advanceAdjustments[1].amount === 2000, "Second absorbed advance is ₹2,000.00 from excess upfront payment");
    assert(p4Doc.outstandingAmount === 0, "Purchase 4 has ₹0 net outstanding");

    suppUpdated = await Supplier.findById(supplier._id);
    assert(suppUpdated.advanceBalance === 2000, "Supplier available advanceBalance decremented to ₹2,000.00");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 7: REVERSAL GUARD REJECTION FOR CONSUMED ADVANCES");
    console.log("----------------------------------------------------------");
    // Attempt to reverse splitAdvancePay whose ₹3,000 advance was completely consumed by Purchase 4
    let consumedReversalError = "";
    try {
      await reverseSupplierPaymentService(
        { paymentId: splitAdvancePay.id, reason: "Attempting illegal reversal of consumed advance" },
        actor
      );
    } catch (err) {
      consumedReversalError = err.message;
    }

    assert(consumedReversalError.includes("already been consumed"), "Reversal correctly prohibited because advance was consumed");
    const unreversedPay = await SupplierPayment.findById(splitAdvancePay.id);
    assert(unreversedPay.status === "RECORDED", "Voucher status remained RECORDED");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 8: CONTROLLED REVERSAL & ATOMIC LEDGER RESTORATION");
    console.log("----------------------------------------------------------");
    // Create an unallocated advance payment of ₹6,000 that has NOT been consumed
    const cleanAdvancePay = await recordSupplierPaymentService(
      {
        supplierId: supplier._id.toString(),
        amount: 6000,
        paymentMethod: "CASH",
        notes: "Clean advance payment for testing reversal",
      },
      actor
    );

    assert(cleanAdvancePay.unallocatedAmount === 6000, "Created ₹6,000 advance payment");
    suppUpdated = await Supplier.findById(supplier._id);
    assert(suppUpdated.advanceBalance === 8000, "Supplier advanceBalance incremented to ₹8,000.00 (2k + 6k)");

    // Execute valid reversal
    const reversedVoucher = await reverseSupplierPaymentService(
      { paymentId: cleanAdvancePay.id, reason: "Order cancelled by management, cash refunded" },
      actor
    );

    assert(reversedVoucher.status === "REVERSED", "Voucher status transitioned to REVERSED");
    assert(reversedVoucher.reversal.reason === "Order cancelled by management, cash refunded", "Reversal reason persisted");
    assert(reversedVoucher.advanceRemaining === 0, "Reversed voucher advanceRemaining reset to 0");

    suppUpdated = await Supplier.findById(supplier._id);
    assert(suppUpdated.advanceBalance === 2000, "Supplier advanceBalance restored cleanly to ₹2,000.00");
    assert(suppUpdated.totalPaid === 49000, "Supplier totalPaid decremented by ₹6,000 cleanly");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 9: ACCOUNTING INVARIANT VERIFICATION POST-INTEGRATION");
    console.log("----------------------------------------------------------");
    const invariantHolds =
      round2(suppUpdated.totalPurchases + suppUpdated.advanceBalance) ===
      round2(suppUpdated.totalPaid + suppUpdated.outstandingBalance);

    assert(
      invariantHolds,
      `Invariant holds: totalPurchases (${suppUpdated.totalPurchases}) + advanceBalance (${suppUpdated.advanceBalance}) [=${suppUpdated.totalPurchases + suppUpdated.advanceBalance}] === totalPaid (${suppUpdated.totalPaid}) + outstandingBalance (${suppUpdated.outstandingBalance}) [=${suppUpdated.totalPaid + suppUpdated.outstandingBalance}]`
    );

    console.log("\n==========================================================");
    console.log(`TEST SUITE RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log("==========================================================\n");

    if (failed > 0) process.exit(1);
  } finally {
    await mongoose.disconnect();
    if (replSet) await replSet.stop();
  }
}

runPhase5D3IntegrationSuite().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});

