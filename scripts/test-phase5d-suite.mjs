import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";

// Security & math helpers
function round2(val) {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

// Schemas matching src/models/
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

const PurchaseAdvanceAdjustmentSchema = new mongoose.Schema(
  {
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "SupplierPayment", required: true },
    paymentNumber: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    adjustedAt: { type: Date, default: Date.now },
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

const User = mongoose.model("User", UserSchema);
const Supplier = mongoose.model("Supplier", SupplierSchema);
const Purchase = mongoose.model("Purchase", PurchaseSchema);
const SupplierPayment = mongoose.model("SupplierPayment", SupplierPaymentSchema);

// Service Implementation mirroring Phase 5D logic with provenance
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

async function recordSupplierPayment(input, actor) {
  if (input.idempotencyKey && input.idempotencyKey.trim()) {
    const existing = await SupplierPayment.findOne({
      idempotencyKey: input.idempotencyKey.trim(),
    });
    if (existing) return existing;
  }

  const session = await mongoose.startSession();
  let createdPayment = null;

  try {
    await session.withTransaction(async () => {
      const supplier = await Supplier.findById(input.supplierId).session(session);
      if (!supplier) throw new Error("Supplier not found");
      if (supplier.status === "ARCHIVED") throw new Error("Cannot pay archived supplier");

      let totalAllocated = 0;
      const processedAllocations = [];

      if (input.allocations && input.allocations.length > 0) {
        const seenPurchases = new Set();
        for (const alloc of input.allocations) {
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
  } finally {
    await session.endSession();
  }

  return createdPayment;
}

async function reverseSupplierPayment(input, actor) {
  const session = await mongoose.startSession();
  let updatedPayment = null;

  try {
    await session.withTransaction(async () => {
      const payment = await SupplierPayment.findById(input.paymentId).session(session);
      if (!payment) throw new Error("Payment not found");
      if (payment.status === "REVERSED") throw new Error("Payment already reversed");

      const supplier = await Supplier.findById(payment.supplierId).session(session);
      if (!supplier) throw new Error("Supplier not found");

      // Provenance-based safety check: prohibit reversal if advance has been consumed
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

      // Revert only originating payment's remaining unused advance
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

  return updatedPayment;
}

// Inward simulation with Phase 5D Advance Absorption and FIFO provenance
async function confirmPurchaseInwardWithProvenance(purchaseId, newlyReceivedQty, actor) {
  const session = await mongoose.startSession();
  let updatedPurchase = null;

  try {
    await session.withTransaction(async () => {
      const purchase = await Purchase.findById(purchaseId).session(session);
      if (!purchase) throw new Error("Purchase not found");

      const item = purchase.items[0];
      const newlyRecognizedVal = round2(newlyReceivedQty * item.unitPurchasePrice);

      purchase.receivedQty = round2(purchase.receivedQty + newlyReceivedQty);
      purchase.recognizedInvoiceValue = round2(purchase.recognizedInvoiceValue + newlyRecognizedVal);

      const allFullyReceived = purchase.receivedQty >= item.orderedQty;
      purchase.status = allFullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";

      // 1. Upfront payment applied first
      const priorRecognized = round2(purchase.recognizedInvoiceValue - newlyRecognizedVal);
      const priorAppliedUpfront = Math.min(purchase.amountPaid, priorRecognized);
      const newAppliedUpfront = Math.min(purchase.amountPaid, purchase.recognizedInvoiceValue);
      const newlyAppliedUpfront = round2(newAppliedUpfront - priorAppliedUpfront);
      const netInwardLiability = round2(newlyRecognizedVal - newlyAppliedUpfront);

      // 2. Absorb supplier advance with FIFO provenance
      let absorbedSupplierAdvance = 0;
      if (netInwardLiability > 0) {
        const candidatePayments = await SupplierPayment.find({
          supplierId: purchase.supplierId,
          status: "RECORDED",
          advanceRemaining: { $gt: 0 },
        })
          .sort({ paymentDate: 1, createdAt: 1 })
          .session(session);

        let remainingLiability = netInwardLiability;
        for (const p of candidatePayments) {
          if (remainingLiability <= 0) break;
          const available = round2(p.advanceRemaining || 0);
          if (available <= 0) continue;
          const toAbsorb = round2(Math.min(available, remainingLiability));

          p.advanceRemaining = round2(p.advanceRemaining - toAbsorb);
          p.advanceConsumed = round2((p.advanceConsumed || 0) + toAbsorb);
          p.advanceAdjustments = p.advanceAdjustments || [];
          p.advanceAdjustments.push({
            purchaseId: purchase._id,
            purchaseNumber: purchase.purchaseNumber,
            supplierInvoiceNumber: purchase.supplierInvoiceNumber,
            amount: toAbsorb,
            adjustedAt: new Date(),
          });
          await p.save({ session });

          purchase.advanceAdjustments = purchase.advanceAdjustments || [];
          purchase.advanceAdjustments.push({
            paymentId: p._id,
            paymentNumber: p.paymentNumber,
            amount: toAbsorb,
            adjustedAt: new Date(),
          });

          absorbedSupplierAdvance = round2(absorbedSupplierAdvance + toAbsorb);
          remainingLiability = round2(remainingLiability - toAbsorb);
        }
      }

      const excessUpfrontToCredit =
        allFullyReceived && purchase.amountPaid > purchase.recognizedInvoiceValue
          ? round2(purchase.amountPaid - purchase.recognizedInvoiceValue)
          : 0;

      if (absorbedSupplierAdvance > 0) {
        purchase.amountPaid = round2(purchase.amountPaid + absorbedSupplierAdvance);
        purchase.outstandingAmount = Math.max(0, round2(purchase.recognizedInvoiceValue - purchase.amountPaid));
        purchase.paymentStatus =
          purchase.outstandingAmount === 0 && purchase.recognizedInvoiceValue > 0
            ? "PAID"
            : purchase.amountPaid > 0
            ? "PARTIALLY_PAID"
            : "UNPAID";
        await purchase.save({ session });
      } else if (excessUpfrontToCredit > 0) {
        purchase.amountPaid = purchase.recognizedInvoiceValue;
        purchase.outstandingAmount = 0;
        purchase.paymentStatus = "PAID";
        await purchase.save({ session });
      }

      const supplierOutstandingIncrement = round2(netInwardLiability - absorbedSupplierAdvance);
      const netAdvanceChange = round2(excessUpfrontToCredit - absorbedSupplierAdvance);

      await Supplier.findByIdAndUpdate(
        purchase.supplierId,
        {
          $inc: {
            totalPurchases: newlyRecognizedVal,
            totalPaid: round2(newlyAppliedUpfront + excessUpfrontToCredit),
            outstandingBalance: supplierOutstandingIncrement,
            advanceBalance: netAdvanceChange,
          },
        },
        { session }
      );

      if (excessUpfrontToCredit > 0) {
        const paymentNumber = await generatePaymentNumber(session);
        await SupplierPayment.create(
          [
            {
              paymentNumber,
              supplierId: purchase.supplierId,
              supplierSnapshot: {
                name: purchase.supplierSnapshot.name,
                phone: purchase.supplierSnapshot.phone,
                gstin: purchase.supplierSnapshot.gstin,
              },
              paymentDate: new Date(),
              amount: excessUpfrontToCredit,
              paymentMethod: purchase.paymentMethod || "CASH",
              paymentReference: purchase.paymentReference,
              allocations: [],
              unallocatedAmount: excessUpfrontToCredit,
              advanceRemaining: excessUpfrontToCredit,
              advanceConsumed: 0,
              advanceAdjustments: [],
              notes: `Excess advance credit from purchase bill ${purchase.purchaseNumber}`,
              status: "RECORDED",
              createdById: actor.id,
              createdByName: actor.name,
            },
          ],
          { session }
        );
      }

      updatedPurchase = purchase;
    });
  } finally {
    await session.endSession();
  }

  return updatedPurchase;
}

// TEST RUNNER
async function runPhase5DTestSuite() {
  console.log("==========================================================");
  console.log("KASI AGRI AGENCIES — PHASE 5D.1 BACKEND ACCOUNTING TEST SUITE");
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

  function assertSupplierInvariant(supplier, stepLabel) {
    const left = round2((supplier.totalPurchases || 0) + (supplier.advanceBalance || 0));
    const right = round2((supplier.totalPaid || 0) + (supplier.outstandingBalance || 0));
    assert(
      left === right,
      `[INVARIANT OK] ${stepLabel}: totalPurchases (${supplier.totalPurchases || 0}) + advanceBalance (${supplier.advanceBalance || 0}) [=${left}] === totalPaid (${supplier.totalPaid || 0}) + outstandingBalance (${supplier.outstandingBalance || 0}) [=${right}]`
    );
  }

  try {
    console.log("\nStarting isolated MongoDB Replica Set in-memory...");
    replSet = await MongoMemoryReplSet.create({
      replSet: { count: 1, storageEngine: "wiredTiger" },
    });
    const uri = replSet.getUri();
    await mongoose.connect(uri);
    console.log("Connected to in-memory replica set successfully.\n");

    const owner = await User.create({
      name: "Adhithya Kasi",
      email: "owner@kasiagri.test",
      username: "kasiowner",
      role: "OWNER",
      status: "ACTIVE",
    });
    const actor = { id: owner._id, name: owner.name };

    const supplierA = await Supplier.create({
      name: "Madras Fertilizers Ltd",
      phone: "9876543210",
      gstin: "33AAACM1234F1Z1",
      status: "ACTIVE",
      totalPurchases: 0,
      totalPaid: 0,
      outstandingBalance: 0,
      advanceBalance: 0,
    });

    const supplierB = await Supplier.create({
      name: "Coromandel International Ltd",
      phone: "9876543211",
      gstin: "33AAACC5678K1Z2",
      status: "ACTIVE",
      totalPurchases: 0,
      totalPaid: 0,
      outstandingBalance: 0,
      advanceBalance: 0,
    });

    console.log("----------------------------------------------------------");
    console.log("TEST 1: FULL INVOICE SETTLEMENT VIA SUPPLIER PAYMENT");
    console.log("----------------------------------------------------------");
    const purchase1 = await Purchase.create({
      purchaseNumber: "PUR-202611-0001",
      supplierId: supplierA._id,
      supplierSnapshot: { name: supplierA.name, phone: supplierA.phone, gstin: supplierA.gstin },
      supplierInvoiceNumber: "INV-MFL-001",
      supplierInvoiceDate: new Date(),
      items: [
        {
          productSnapshot: { name: "Urea 50kg", brand: "Vijay", primaryUnit: "BAG" },
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
      createdById: owner._id,
    });

    await Supplier.findByIdAndUpdate(supplierA._id, {
      $inc: { totalPurchases: 10000, outstandingBalance: 10000 },
    });

    const payment1 = await recordSupplierPayment(
      {
        supplierId: supplierA._id.toString(),
        amount: 10000,
        paymentMethod: "BANK_TRANSFER",
        paymentReference: "NEFT-ICICI-001",
        allocations: [{ purchaseId: purchase1._id.toString(), amount: 10000 }],
        notes: "Full settlement for invoice INV-MFL-001",
      },
      actor
    );

    const updatedP1 = await Purchase.findById(purchase1._id);
    const updatedSuppA1 = await Supplier.findById(supplierA._id);

    assert(payment1.paymentNumber.startsWith("PAY-"), `Sequential payment number generated: ${payment1.paymentNumber}`);
    assert(updatedP1.amountPaid === 10000, "Purchase 1 amountPaid equals ₹10,000.00");
    assert(updatedP1.outstandingAmount === 0, "Purchase 1 outstandingAmount is ₹0.00");
    assert(updatedP1.paymentStatus === "PAID", "Purchase 1 paymentStatus marked as PAID");
    assert(updatedSuppA1.totalPaid === 10000, "Supplier A totalPaid is ₹10,000.00");
    assert(updatedSuppA1.outstandingBalance === 0, "Supplier A outstandingBalance is ₹0.00");
    assert(updatedSuppA1.advanceBalance === 0, "Supplier A advanceBalance is ₹0.00");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 2: PARTIAL INVOICE SETTLEMENT");
    console.log("----------------------------------------------------------");
    const purchase2 = await Purchase.create({
      purchaseNumber: "PUR-202611-0002",
      supplierId: supplierA._id,
      supplierSnapshot: { name: supplierA.name, phone: supplierA.phone },
      supplierInvoiceNumber: "INV-MFL-002",
      supplierInvoiceDate: new Date(),
      items: [
        {
          productSnapshot: { name: "DAP 50kg", brand: "Vijay", primaryUnit: "BAG" },
          orderedQty: 25,
          receivedQty: 25,
          unit: "BAG",
          unitPurchasePrice: 1000,
          lineTotal: 25000,
          recognizedValue: 25000,
        },
      ],
      subtotal: 25000,
      grandTotal: 25000,
      receivedQty: 25,
      recognizedInvoiceValue: 25000,
      amountPaid: 0,
      outstandingAmount: 25000,
      paymentStatus: "UNPAID",
      status: "RECEIVED",
      createdById: owner._id,
    });

    await Supplier.findByIdAndUpdate(supplierA._id, {
      $inc: { totalPurchases: 25000, outstandingBalance: 25000 },
    });

    const payment2 = await recordSupplierPayment(
      {
        supplierId: supplierA._id.toString(),
        amount: 15000,
        paymentMethod: "UPI",
        paymentReference: "UPI-GPAY-002",
        allocations: [{ purchaseId: purchase2._id.toString(), amount: 15000 }],
      },
      actor
    );

    const updatedP2 = await Purchase.findById(purchase2._id);
    const updatedSuppA2 = await Supplier.findById(supplierA._id);

    assert(updatedP2.amountPaid === 15000, "Purchase 2 amountPaid is ₹15,000.00");
    assert(updatedP2.outstandingAmount === 10000, "Purchase 2 outstandingAmount is ₹10,000.00");
    assert(updatedP2.paymentStatus === "PARTIALLY_PAID", "Purchase 2 paymentStatus is PARTIALLY_PAID");
    assert(updatedSuppA2.totalPaid === 25000, "Supplier A totalPaid incremented to ₹25,000.00");
    assert(updatedSuppA2.outstandingBalance === 10000, "Supplier A outstandingBalance decremented to ₹10,000.00");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 3: MULTI-INVOICE PAYMENT ALLOCATION");
    console.log("----------------------------------------------------------");
    const purchase3 = await Purchase.create({
      purchaseNumber: "PUR-202611-0003",
      supplierId: supplierA._id,
      supplierSnapshot: { name: supplierA.name, phone: supplierA.phone },
      supplierInvoiceNumber: "INV-MFL-003",
      supplierInvoiceDate: new Date(),
      items: [
        {
          productSnapshot: { name: "Potash 50kg", brand: "Vijay", primaryUnit: "BAG" },
          orderedQty: 10,
          receivedQty: 10,
          unit: "BAG",
          unitPurchasePrice: 800,
          lineTotal: 8000,
          recognizedValue: 8000,
        },
      ],
      subtotal: 8000,
      grandTotal: 8000,
      receivedQty: 10,
      recognizedInvoiceValue: 8000,
      amountPaid: 0,
      outstandingAmount: 8000,
      paymentStatus: "UNPAID",
      status: "RECEIVED",
      createdById: owner._id,
    });

    await Supplier.findByIdAndUpdate(supplierA._id, {
      $inc: { totalPurchases: 8000, outstandingBalance: 8000 },
    });

    const payment3 = await recordSupplierPayment(
      {
        supplierId: supplierA._id.toString(),
        amount: 15000,
        paymentMethod: "CHEQUE",
        paymentReference: "CHQ-778899",
        allocations: [
          { purchaseId: purchase2._id.toString(), amount: 10000 },
          { purchaseId: purchase3._id.toString(), amount: 5000 },
        ],
      },
      actor
    );

    const updatedP2PostMulti = await Purchase.findById(purchase2._id);
    const updatedP3PostMulti = await Purchase.findById(purchase3._id);
    const updatedSuppA3 = await Supplier.findById(supplierA._id);

    assert(payment3.allocations.length === 2, "Payment 3 has exactly 2 allocations");
    assert(updatedP2PostMulti.outstandingAmount === 0 && updatedP2PostMulti.paymentStatus === "PAID", "Purchase 2 fully settled (₹0 outstanding, PAID)");
    assert(updatedP3PostMulti.outstandingAmount === 3000 && updatedP3PostMulti.paymentStatus === "PARTIALLY_PAID", "Purchase 3 partially settled (₹3,000 outstanding, PARTIALLY_PAID)");
    assert(updatedSuppA3.outstandingBalance === 3000, "Supplier A outstanding balance correctly reflects ₹3,000.00");
    assert(updatedSuppA3.totalPaid === 40000, "Supplier A totalPaid is ₹40,000.00 (10k + 15k + 15k)");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 4: UNALLOCATED PAYMENT WITH PROVENANCE TRACKING");
    console.log("----------------------------------------------------------");
    // Settle remaining ₹3,000 on purchase 3 + create ₹7,000 advance
    const payment4 = await recordSupplierPayment(
      {
        supplierId: supplierA._id.toString(),
        amount: 10000,
        paymentMethod: "BANK_TRANSFER",
        paymentReference: "RTGS-004",
        allocations: [{ purchaseId: purchase3._id.toString(), amount: 3000 }],
        notes: "Settled purchase 3 + Advance ₹7,000",
      },
      actor
    );

    const updatedP3Final = await Purchase.findById(purchase3._id);
    const updatedSuppA4 = await Supplier.findById(supplierA._id);

    assert(payment4.unallocatedAmount === 7000, "Payment unallocatedAmount is ₹7,000.00");
    assert(payment4.advanceRemaining === 7000, "Originating payment advanceRemaining initialized to ₹7,000.00");
    assert(payment4.advanceConsumed === 0, "Originating payment advanceConsumed initialized to ₹0.00");
    assert(updatedP3Final.outstandingAmount === 0 && updatedP3Final.paymentStatus === "PAID", "Purchase 3 is now fully PAID");
    assert(updatedSuppA4.outstandingBalance === 0, "Supplier A outstanding balance is ₹0.00");
    assert(updatedSuppA4.advanceBalance === 7000, "Supplier A advanceBalance increased to ₹7,000.00");
    assert(updatedSuppA4.totalPaid === 50000, "Supplier A totalPaid incremented by full ₹10,000 to ₹50,000.00");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 5: REJECT ALLOCATION TO WRONG SUPPLIER");
    console.log("----------------------------------------------------------");
    let rejectedSupplierMismatch = false;
    try {
      await recordSupplierPayment(
        {
          supplierId: supplierB._id.toString(),
          amount: 5000,
          paymentMethod: "CASH",
          allocations: [{ purchaseId: purchase3._id.toString(), amount: 1000 }],
        },
        actor
      );
    } catch (err) {
      rejectedSupplierMismatch = true;
    }
    assert(rejectedSupplierMismatch, "Rejected payment allocation against purchase belonging to a different supplier");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 6: REJECT ALLOCATION ABOVE ELIGIBLE OUTSTANDING");
    console.log("----------------------------------------------------------");
    let rejectedOverAllocation = false;
    try {
      await recordSupplierPayment(
        {
          supplierId: supplierA._id.toString(),
          amount: 500,
          paymentMethod: "CASH",
          allocations: [{ purchaseId: purchase3._id.toString(), amount: 500 }],
        },
        actor
      );
    } catch (err) {
      rejectedOverAllocation = true;
    }
    assert(rejectedOverAllocation, "Rejected allocation exceeding eligible outstanding amount");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 7: REJECT ALLOCATION TO PENDING_RECEIPT INVOICE");
    console.log("----------------------------------------------------------");
    const pendingPurchase = await Purchase.create({
      purchaseNumber: "PUR-202611-0004",
      supplierId: supplierA._id,
      supplierSnapshot: { name: supplierA.name, phone: supplierA.phone },
      supplierInvoiceNumber: "INV-MFL-004",
      supplierInvoiceDate: new Date(),
      items: [
        {
          productSnapshot: { name: "Micronutrients", brand: "Vijay", primaryUnit: "KG" },
          orderedQty: 50,
          receivedQty: 0,
          unit: "KG",
          unitPurchasePrice: 200,
          lineTotal: 10000,
          recognizedValue: 0,
        },
      ],
      subtotal: 10000,
      grandTotal: 10000,
      receivedQty: 0,
      recognizedInvoiceValue: 0,
      amountPaid: 0,
      outstandingAmount: 0,
      paymentStatus: "UNPAID",
      status: "PENDING_RECEIPT",
      createdById: owner._id,
    });

    let rejectedPendingReceiptAllocation = false;
    try {
      await recordSupplierPayment(
        {
          supplierId: supplierA._id.toString(),
          amount: 2000,
          paymentMethod: "CASH",
          allocations: [{ purchaseId: pendingPurchase._id.toString(), amount: 2000 }],
        },
        actor
      );
    } catch (err) {
      rejectedPendingReceiptAllocation = true;
    }
    assert(rejectedPendingReceiptAllocation, "Rejected allocation to PENDING_RECEIPT invoice (goods not yet inwarded)");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 8: IDEMPOTENCY KEY PROTECTION AGAINST DUPLICATES");
    console.log("----------------------------------------------------------");
    const idempotencyKey = "PAY-IDEMP-TEST-998877";
    const firstSubmission = await recordSupplierPayment(
      {
        supplierId: supplierA._id.toString(),
        amount: 3000,
        paymentMethod: "CASH",
        notes: "Pure advance payment with idempotency key",
        idempotencyKey,
      },
      actor
    );

    const suppBeforeSecond = await Supplier.findById(supplierA._id);

    const secondSubmission = await recordSupplierPayment(
      {
        supplierId: supplierA._id.toString(),
        amount: 3000,
        paymentMethod: "CASH",
        idempotencyKey,
      },
      actor
    );

    const suppAfterSecond = await Supplier.findById(supplierA._id);

    assert(firstSubmission._id.toString() === secondSubmission._id.toString(), "Idempotent submission returned identical payment document");
    assert(suppBeforeSecond.totalPaid === suppAfterSecond.totalPaid, "Supplier totalPaid was NOT double-counted on duplicate submission");
    assert(suppBeforeSecond.advanceBalance === suppAfterSecond.advanceBalance, "Supplier advanceBalance was NOT double-counted on duplicate submission");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 9: AUTOMATIC ADVANCE ABSORPTION WITH BIDIRECTIONAL PROVENANCE");
    console.log("----------------------------------------------------------");
    // Supplier A currently has:
    // Payment 4: advanceRemaining = ₹7,000, advanceConsumed = 0
    // Payment 8: advanceRemaining = ₹3,000, advanceConsumed = 0
    // Total advanceBalance = ₹10,000.
    // Create new purchase for ₹15,000, PENDING_RECEIPT, ₹0 upfront paid
    const newBill = await Purchase.create({
      purchaseNumber: "PUR-202611-0005",
      supplierId: supplierA._id,
      supplierSnapshot: { name: supplierA.name, phone: supplierA.phone },
      supplierInvoiceNumber: "INV-MFL-005",
      supplierInvoiceDate: new Date(),
      items: [
        {
          productSnapshot: { name: "Bio Fertilizer 25kg", brand: "Vijay", primaryUnit: "BAG" },
          orderedQty: 15,
          receivedQty: 0,
          unit: "BAG",
          unitPurchasePrice: 1000,
          lineTotal: 15000,
          recognizedValue: 0,
        },
      ],
      subtotal: 15000,
      grandTotal: 15000,
      receivedQty: 0,
      recognizedInvoiceValue: 0,
      amountPaid: 0,
      outstandingAmount: 0,
      paymentStatus: "UNPAID",
      status: "PENDING_RECEIPT",
      createdById: owner._id,
    });

    const suppPreInward = await Supplier.findById(supplierA._id);
    const inwardedBill = await confirmPurchaseInwardWithProvenance(newBill._id, 15, actor);
    const suppPostInward = await Supplier.findById(supplierA._id);

    // Verify originating payment provenance
    const updatedPayment4 = await SupplierPayment.findById(payment4._id);
    const updatedPayment8 = await SupplierPayment.findById(firstSubmission._id);

    assert(updatedPayment4.advanceRemaining === 0, "Payment 4 advanceRemaining drawn down to ₹0.00");
    assert(updatedPayment4.advanceConsumed === 7000, "Payment 4 advanceConsumed recorded as ₹7,000.00");
    assert(updatedPayment4.advanceAdjustments.length === 1, "Payment 4 tracks destination purchase in advanceAdjustments");
    assert(updatedPayment4.advanceAdjustments[0].purchaseNumber === "PUR-202611-0005", "Payment 4 records exact purchaseNumber link");

    assert(updatedPayment8.advanceRemaining === 0, "Payment 8 advanceRemaining drawn down to ₹0.00");
    assert(updatedPayment8.advanceConsumed === 3000, "Payment 8 advanceConsumed recorded as ₹3,000.00");

    // Verify destination purchase provenance
    assert(inwardedBill.advanceAdjustments.length === 2, "Destination purchase tracks both source advance payments");
    assert(inwardedBill.advanceAdjustments[0].paymentNumber === payment4.paymentNumber, "Purchase links first source payment");
    assert(inwardedBill.advanceAdjustments[0].amount === 7000, "Purchase links exact amount ₹7,000 from Payment 4");
    assert(inwardedBill.advanceAdjustments[1].paymentNumber === firstSubmission.paymentNumber, "Purchase links second source payment");
    assert(inwardedBill.advanceAdjustments[1].amount === 3000, "Purchase links exact amount ₹3,000 from Payment 8");

    assert(inwardedBill.amountPaid === 10000, "Purchase amountPaid equals absorbed advance (₹10,000.00)");
    assert(inwardedBill.outstandingAmount === 5000, "Purchase net payable is ₹5,000.00");
    assert(suppPostInward.advanceBalance === 0, "Supplier advance balance was completely utilized (₹0.00)");
    assert(suppPostInward.outstandingBalance === 5000, "Supplier outstanding balance increased by net unpaid amount (₹5,000.00)");
    assert(suppPostInward.totalPaid === suppPreInward.totalPaid, "Supplier totalPaid was NOT double-counted during advance absorption!");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 10: SAFE PAYMENT REVERSAL & FINANCIAL RESTORATION");
    console.log("----------------------------------------------------------");
    const payment5 = await recordSupplierPayment(
      {
        supplierId: supplierA._id.toString(),
        amount: 5000,
        paymentMethod: "CHEQUE",
        paymentReference: "CHQ-REVERSAL-TEST",
        allocations: [{ purchaseId: newBill._id.toString(), amount: 5000 }],
        notes: "To be reversed in test",
      },
      actor
    );

    const reversedPayment = await reverseSupplierPayment(
      {
        paymentId: payment5._id.toString(),
        reason: "Cheque bounced due to signature mismatch",
      },
      actor
    );

    const billPostReversal = await Purchase.findById(newBill._id);
    const suppPostReversal = await Supplier.findById(supplierA._id);

    assert(reversedPayment.status === "REVERSED", "Payment status changed to REVERSED");
    assert(reversedPayment.reversal.reason === "Cheque bounced due to signature mismatch", "Reversal reason recorded");
    assert(reversedPayment.reversal.reversedByName === actor.name, "Reversal actor name recorded");
    assert(reversedPayment.reversal.reversedAt instanceof Date, "Reversal timestamp recorded");
    assert(billPostReversal.amountPaid === 10000, "Bill amountPaid reverted back to ₹10,000.00");
    assert(billPostReversal.outstandingAmount === 5000, "Bill outstandingAmount restored to ₹5,000.00");
    assert(billPostReversal.paymentStatus === "PARTIALLY_PAID", "Bill paymentStatus reverted to PARTIALLY_PAID");
    assert(suppPostReversal.outstandingBalance === 5000, "Supplier outstanding restored to ₹5,000.00");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 11: PROHIBIT REVERSAL IF ADVANCE WAS ALREADY CONSUMED");
    console.log("----------------------------------------------------------");
    // Payment 4 had ₹7,000 unallocated advance, which was CONSUMED by PUR-202611-0005.
    // Originating payment has advanceConsumed = 7000 and advanceRemaining = 0.
    // Attempting reversal MUST fail via provenance check.
    let rejectedSpentAdvanceReversal = false;
    try {
      await reverseSupplierPayment(
        {
          paymentId: payment4._id.toString(),
          reason: "Attempting to reverse payment whose advance was already spent",
        },
        actor
      );
    } catch (err) {
      rejectedSpentAdvanceReversal = true;
    }
    assert(rejectedSpentAdvanceReversal, "Prohibited reversal of payment whose unallocated advance was consumed by a purchase");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 12: TRANSACTION ROLLBACK ON SIMULATED FAILURE");
    console.log("----------------------------------------------------------");
    const suppBeforeFail = await Supplier.findById(supplierA._id);
    let rollbackOccurred = false;

    try {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          await Supplier.findByIdAndUpdate(
            supplierA._id,
            { $inc: { totalPaid: 99999 } },
            { session }
          );
          throw new Error("Simulated transactional crash");
        });
      } finally {
        await session.endSession();
      }
    } catch (err) {
      rollbackOccurred = true;
    }

    const suppAfterFail = await Supplier.findById(supplierA._id);
    assert(rollbackOccurred, "Simulated error triggered catch block");
    assert(suppBeforeFail.totalPaid === suppAfterFail.totalPaid, "Transaction rolled back atomically: supplier totalPaid preserved without dirty state");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 13: COMBINED PAYMENT SCENARIO (UPFRONT + SEPARATE ADVANCE + INWARD)");
    console.log("----------------------------------------------------------");
    // New isolated supplier C for clean baseline testing
    const supplierC = await Supplier.create({
      name: "National Seeds Corporation",
      phone: "9876543299",
      gstin: "33AAACN9999Z1Z8",
      status: "ACTIVE",
      totalPurchases: 0,
      totalPaid: 0,
      outstandingBalance: 0,
      advanceBalance: 0,
    });

    // Step A: Record separate supplier-level advance of ₹4,000
    const separateAdvancePay = await recordSupplierPayment(
      {
        supplierId: supplierC._id.toString(),
        amount: 4000,
        paymentMethod: "BANK_TRANSFER",
        paymentReference: "NEFT-ADV-001",
        notes: "Advance deposit with supplier C",
      },
      actor
    );

    const suppCStepA = await Supplier.findById(supplierC._id);
    assert(separateAdvancePay.unallocatedAmount === 4000, "Separate advance payment created with ₹4,000.00 unallocated");
    assert(separateAdvancePay.advanceRemaining === 4000, "Separate advance payment advanceRemaining is ₹4,000.00");
    assert(suppCStepA.advanceBalance === 4000, "Supplier C advanceBalance is ₹4,000.00");
    assert(suppCStepA.totalPaid === 4000, "Supplier C totalPaid is ₹4,000.00");
    assert(suppCStepA.outstandingBalance === 0, "Supplier C outstandingBalance is ₹0.00");

    // Step B: Create Purchase bill with ₹3,000 purchase-level upfront payment (PENDING_RECEIPT)
    // 10 bags @ ₹1,000 = ₹10,000 grandTotal
    const combinedBill = await Purchase.create({
      purchaseNumber: "PUR-202611-0006",
      supplierId: supplierC._id,
      supplierSnapshot: { name: supplierC.name, phone: supplierC.phone },
      supplierInvoiceNumber: "INV-NSC-001",
      supplierInvoiceDate: new Date(),
      items: [
        {
          productSnapshot: { name: "Paddy Seed CO-51", brand: "NSC", primaryUnit: "BAG" },
          orderedQty: 10,
          receivedQty: 0,
          unit: "BAG",
          unitPurchasePrice: 1000,
          lineTotal: 10000,
          recognizedValue: 0,
        },
      ],
      subtotal: 10000,
      grandTotal: 10000,
      receivedQty: 0,
      recognizedInvoiceValue: 0,
      amountPaid: 3000, // Upfront payment on purchase
      paymentMethod: "UPI",
      paymentReference: "UPI-UPFRONT-001",
      outstandingAmount: 0,
      paymentStatus: "PARTIALLY_PAID",
      status: "PENDING_RECEIPT",
      createdById: owner._id,
    });

    // Supplier counters remain unchanged before goods arrive
    const suppCStepB = await Supplier.findById(supplierC._id);
    assert(suppCStepB.totalPaid === 4000, "Supplier C totalPaid untouched before goods inward (₹4,000.00)");
    assert(suppCStepB.totalPurchases === 0, "Supplier C totalPurchases untouched before goods inward (₹0.00)");
    assert(suppCStepB.outstandingBalance === 0, "Supplier C outstandingBalance untouched before goods inward (₹0.00)");

    // Step C: Subsequent Goods Inward (all 10 bags arrive, recognized value = ₹10,000)
    // Application order:
    // 1. Upfront payment (₹3,000) applied first -> remaining liability = ₹7,000
    // 2. Separate supplier advance (₹4,000) absorbed next -> remaining liability = ₹3,000
    const inwardedCombinedBill = await confirmPurchaseInwardWithProvenance(combinedBill._id, 10, actor);
    const suppCStepC = await Supplier.findById(supplierC._id);
    const updatedSeparateAdv = await SupplierPayment.findById(separateAdvancePay._id);

    // Verify correct application order & purchase state
    assert(inwardedCombinedBill.amountPaid === 7000, "Purchase total paid equals upfront (3k) + absorbed advance (4k) = ₹7,000.00");
    assert(inwardedCombinedBill.outstandingAmount === 3000, "Purchase outstandingAmount is exactly ₹3,000.00 (10k - 7k)");
    assert(inwardedCombinedBill.paymentStatus === "PARTIALLY_PAID", "Purchase paymentStatus is PARTIALLY_PAID");
    assert(inwardedCombinedBill.advanceAdjustments.length === 1, "Purchase records provenance adjustment from separate advance payment");
    assert(inwardedCombinedBill.advanceAdjustments[0].amount === 4000, "Purchase provenance records exact advance amount ₹4,000.00");

    // Verify supplier ledger state & NO DOUBLE-COUNTING
    // totalPaid = 4,000 (advance) + 3,000 (upfront) = 7,000 (NOT 11,000!)
    assert(suppCStepC.totalPurchases === 10000, "Supplier C totalPurchases is exactly ₹10,000.00");
    assert(suppCStepC.totalPaid === 7000, "Supplier C totalPaid is ₹7,000.00 (NO double-counting!)");
    assert(suppCStepC.advanceBalance === 0, "Supplier C advanceBalance successfully drawn down to ₹0.00");
    assert(suppCStepC.outstandingBalance === 3000, "Supplier C outstandingBalance is exactly ₹3,000.00");
    assert(round2(suppCStepC.totalPaid + suppCStepC.outstandingBalance) === suppCStepC.totalPurchases, "Balance Equation verified: totalPaid (7k) + outstanding (3k) === totalPurchases (10k)");

    // Verify originating separate advance payment state
    assert(updatedSeparateAdv.advanceRemaining === 0, "Separate advance payment advanceRemaining is ₹0.00");
    assert(updatedSeparateAdv.advanceConsumed === 4000, "Separate advance payment advanceConsumed is ₹4,000.00");
    assert(updatedSeparateAdv.advanceAdjustments.length === 1, "Separate advance payment records destination purchase link");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 14: EXISTING SUPPLIER COMPATIBILITY (NO advanceBalance FIELD)");
    console.log("----------------------------------------------------------");
    // Simulate legacy supplier document created before Phase 5D (without advanceBalance field)
    const rawLegacyDoc = await mongoose.connection.collection("suppliers").insertOne({
      name: "Legacy Agri Supplies",
      phone: "9123456780",
      status: "ACTIVE",
      totalPurchases: 50000,
      totalPaid: 45000,
      outstandingBalance: 5000,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const legacySupplierId = rawLegacyDoc.insertedId;

    // Check reading via Mongoose
    const loadedLegacy = await Supplier.findById(legacySupplierId);
    assert(loadedLegacy.totalPurchases === 50000, "Legacy supplier totalPurchases preserved (₹50,000.00)");
    assert(loadedLegacy.totalPaid === 45000, "Legacy supplier totalPaid preserved (₹45,000.00)");
    assert(loadedLegacy.outstandingBalance === 5000, "Legacy supplier outstandingBalance preserved (₹5,000.00)");
    assert(loadedLegacy.advanceBalance === 0, "Missing advanceBalance safely read as 0");

    // Check recording payment on legacy supplier
    const legacyPayment = await recordSupplierPayment(
      {
        supplierId: legacySupplierId.toString(),
        amount: 2000,
        paymentMethod: "CASH",
        notes: "Payment on legacy supplier",
      },
      actor
    );

    const updatedLegacy = await Supplier.findById(legacySupplierId);
    assert(legacyPayment.amount === 2000, "Payment on legacy supplier recorded successfully");
    assert(updatedLegacy.totalPurchases === 50000, "Legacy supplier totalPurchases preserved intact");
    assert(updatedLegacy.totalPaid === 47000, "Legacy supplier totalPaid incremented accurately (₹47,000.00)");
    assert(updatedLegacy.outstandingBalance === 5000, "Legacy supplier outstandingBalance preserved intact (₹5,000.00)");
    assert(updatedLegacy.advanceBalance === 2000, "Legacy supplier advanceBalance safely initialized and incremented (₹2,000.00)");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 15: MULTIPLE ADVANCE REVERSAL (ISOLATION & PRESERVATION)");
    console.log("----------------------------------------------------------");
    // New isolated supplier D
    const supplierD = await Supplier.create({
      name: "Tamil Nadu Seeds Corporation",
      phone: "9876543277",
      gstin: "33AAACT7777Z1Z9",
      status: "ACTIVE",
      totalPurchases: 0,
      totalPaid: 0,
      outstandingBalance: 0,
      advanceBalance: 0,
    });

    // Step A: Create Advance 1: ₹5,000
    const advance1 = await recordSupplierPayment(
      {
        supplierId: supplierD._id.toString(),
        amount: 5000,
        paymentMethod: "BANK_TRANSFER",
        paymentReference: "ADV-D-001",
        notes: "First advance payment",
      },
      actor
    );

    // Step B: Consume Advance 1 via purchase inward
    const purchaseD1 = await Purchase.create({
      purchaseNumber: "PUR-202611-0007",
      supplierId: supplierD._id,
      supplierSnapshot: { name: supplierD.name, phone: supplierD.phone },
      supplierInvoiceNumber: "INV-TNSC-001",
      supplierInvoiceDate: new Date(),
      items: [
        {
          productSnapshot: { name: "Millets 10kg", brand: "TNSC", primaryUnit: "BAG" },
          orderedQty: 5,
          receivedQty: 0,
          unit: "BAG",
          unitPurchasePrice: 1000,
          lineTotal: 5000,
          recognizedValue: 0,
        },
      ],
      subtotal: 5000,
      grandTotal: 5000,
      receivedQty: 0,
      recognizedInvoiceValue: 0,
      amountPaid: 0,
      outstandingAmount: 0,
      paymentStatus: "UNPAID",
      status: "PENDING_RECEIPT",
      createdById: owner._id,
    });

    await confirmPurchaseInwardWithProvenance(purchaseD1._id, 5, actor);

    // Supplier D now has advanceBalance = 0; advance 1 is fully consumed
    const suppDAfterConsumption = await Supplier.findById(supplierD._id);
    assert(suppDAfterConsumption.advanceBalance === 0, "Supplier D advanceBalance is ₹0 after consuming Advance 1");

    // Step C: Create Advance 2: ₹5,000
    const advance2 = await recordSupplierPayment(
      {
        supplierId: supplierD._id.toString(),
        amount: 5000,
        paymentMethod: "BANK_TRANSFER",
        paymentReference: "ADV-D-002",
        notes: "Second advance payment",
      },
      actor
    );

    // Supplier D now has advanceBalance = ₹5,000 (from Advance 2)
    const suppDAfterAdv2 = await Supplier.findById(supplierD._id);
    assert(suppDAfterAdv2.advanceBalance === 5000, "Supplier D advanceBalance is ₹5,000.00 from Advance 2");

    // Step D: Attempt to reverse Advance 1!
    // Notice: Supplier D's aggregate advanceBalance is ₹5,000.
    // If a naive check `supplier.advanceBalance >= advance1.unallocatedAmount` were used,
    // it would allow reversal and drain Advance 2's money!
    // But Advance 1's own advanceRemaining is 0 and advanceConsumed is 5,000!
    let rejectedMultipleAdvanceReversal = false;
    try {
      await reverseSupplierPayment(
        {
          paymentId: advance1._id.toString(),
          reason: "Attempting to reverse consumed Advance 1 while Advance 2 is active",
        },
        actor
      );
    } catch (err) {
      rejectedMultipleAdvanceReversal = true;
    }

    assert(rejectedMultipleAdvanceReversal, "Attempt to reverse Advance 1 was prohibited because its own advance was consumed");

    // Step E: Verify Advance 2 was NOT touched or consumed by the failed reversal!
    const suppDFinal = await Supplier.findById(supplierD._id);
    const updatedAdv2 = await SupplierPayment.findById(advance2._id);

    assert(suppDFinal.advanceBalance === 5000, "Supplier D advanceBalance remained intact at ₹5,000.00");
    assert(suppDFinal.totalPaid === 10000, "Supplier D totalPaid remained intact at ₹10,000.00");
    assert(updatedAdv2.advanceRemaining === 5000, "Advance 2 advanceRemaining remained intact at ₹5,000.00");
    assert(updatedAdv2.advanceConsumed === 0, "Advance 2 advanceConsumed remained intact at ₹0.00");
    assert(updatedAdv2.status === "RECORDED", "Advance 2 status remains RECORDED");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 16: AUDIT AND REVERSAL METADATA VERIFICATION");
    console.log("----------------------------------------------------------");
    // Create an unallocated payment on Supplier D to reverse cleanly
    const cleanPay = await recordSupplierPayment(
      {
        supplierId: supplierD._id.toString(),
        amount: 2500,
        paymentMethod: "UPI",
        paymentReference: "UPI-CLEAN-REV",
        notes: "Clean payment for audit test",
      },
      actor
    );

    const suppDBeforeCleanRev = await Supplier.findById(supplierD._id);
    assert(suppDBeforeCleanRev.advanceBalance === 7500, "Supplier D advance is 7500 (5k + 2.5k) before reversal");
    assert(suppDBeforeCleanRev.totalPaid === 12500, "Supplier D totalPaid is 12500 before reversal");

    const revTimestampStart = new Date();
    const cleanReversedPay = await reverseSupplierPayment(
      {
        paymentId: cleanPay._id.toString(),
        reason: "Duplicate transfer by account holder",
      },
      actor
    );
    const revTimestampEnd = new Date();

    const suppDAfterCleanRev = await Supplier.findById(supplierD._id);

    assert(cleanReversedPay.status === "REVERSED", "Reversed payment status is REVERSED");
    assert(cleanReversedPay.advanceRemaining === 0, "Reversed payment advanceRemaining reset to 0");
    assert(cleanReversedPay.reversal.reason === "Duplicate transfer by account holder", "Reversal reason exactly matched");
    assert(cleanReversedPay.reversal.reversedByName === actor.name, "Reversal actor name recorded");
    assert(cleanReversedPay.reversal.reversedById.toString() === actor.id.toString(), "Reversal actor ID recorded");
    assert(
      cleanReversedPay.reversal.reversedAt >= revTimestampStart &&
        cleanReversedPay.reversal.reversedAt <= revTimestampEnd,
      "Reversal timestamp accurately recorded within operation window"
    );
    assert(suppDAfterCleanRev.advanceBalance === 5000, "Supplier D advanceBalance restored to ₹5,000.00 (Advance 2 preserved)");
    assert(suppDAfterCleanRev.totalPaid === 10000, "Supplier D totalPaid restored to ₹10,000.00");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 17: COMPREHENSIVE SUPPLIER ACCOUNTING INVARIANT STRESS TEST");
    console.log("  INVARIANT: totalPurchases + advanceBalance === totalPaid + outstandingBalance");
    console.log("----------------------------------------------------------");

    const supplierE = await Supplier.create({
      name: "Southern Bio-Pesticides Ltd",
      phone: "9876543999",
      gstin: "33AAACS9999P1Z3",
      status: "ACTIVE",
      totalPurchases: 0,
      totalPaid: 0,
      outstandingBalance: 0,
      advanceBalance: 0,
    });

    // Step 0: Invariant at initial zero baseline
    let suppE = await Supplier.findById(supplierE._id);
    assertSupplierInvariant(suppE, "Step 0 - Initial zero state");

    // Step 1: Unallocated advance payment 1 (₹6,000)
    const advE1 = await recordSupplierPayment(
      {
        supplierId: supplierE._id.toString(),
        amount: 6000,
        paymentMethod: "BANK_TRANSFER",
        notes: "Advance payment 1 for invariant test",
      },
      actor
    );
    suppE = await Supplier.findById(supplierE._id);
    assertSupplierInvariant(suppE, "Step 1 - After first unallocated advance (₹6,000)");

    // Step 2: Unallocated advance payment 2 (₹4,000) - Multiple advances
    const advE2 = await recordSupplierPayment(
      {
        supplierId: supplierE._id.toString(),
        amount: 4000,
        paymentMethod: "UPI",
        notes: "Advance payment 2 for invariant test",
      },
      actor
    );
    suppE = await Supplier.findById(supplierE._id);
    assertSupplierInvariant(suppE, "Step 2 - After second unallocated advance (₹4,000)");

    // Step 3: Purchase Bill 1 with upfront payment (₹2,000) on ₹15,000 bill + FIFO advance absorption
    const billE1 = await Purchase.create({
      purchaseNumber: "PUR-202611-0008",
      supplierId: supplierE._id,
      supplierSnapshot: { name: supplierE.name, phone: supplierE.phone },
      supplierInvoiceNumber: "INV-SBP-001",
      supplierInvoiceDate: new Date(),
      items: [
        {
          productSnapshot: { name: "Neem Oil Extract 1L", brand: "SBP", primaryUnit: "BOTTLE" },
          orderedQty: 15,
          receivedQty: 0,
          unit: "BOTTLE",
          unitPurchasePrice: 1000,
          lineTotal: 15000,
          recognizedValue: 0,
        },
      ],
      subtotal: 15000,
      grandTotal: 15000,
      receivedQty: 0,
      recognizedInvoiceValue: 0,
      amountPaid: 2000,
      paymentMethod: "CASH",
      outstandingAmount: 0,
      paymentStatus: "PARTIALLY_PAID",
      status: "PENDING_RECEIPT",
      createdById: owner._id,
    });

    await confirmPurchaseInwardWithProvenance(billE1._id, 15, actor);
    suppE = await Supplier.findById(supplierE._id);
    assertSupplierInvariant(suppE, "Step 3 - After inward with upfront payment & FIFO advance absorption");

    // Step 4: Purchase Bill 2 with excess upfront payment (₹8,000 on ₹6,000 bill = ₹2,000 excess)
    // Simulate inward where excess upfront payment becomes advance credit
    const newlyReceivedQtyE2 = 6;
    const unitPriceE2 = 1000;
    const billE2GrandTotal = 6000;
    const upfrontPaidE2 = 8000;

    const billE2 = await Purchase.create({
      purchaseNumber: "PUR-202611-0009",
      supplierId: supplierE._id,
      supplierSnapshot: { name: supplierE.name, phone: supplierE.phone },
      supplierInvoiceNumber: "INV-SBP-002",
      supplierInvoiceDate: new Date(),
      items: [
        {
          productSnapshot: { name: "Trichoderma 1kg", brand: "SBP", primaryUnit: "PACKET" },
          orderedQty: 6,
          receivedQty: 0,
          unit: "PACKET",
          unitPurchasePrice: unitPriceE2,
          lineTotal: billE2GrandTotal,
          recognizedValue: 0,
        },
      ],
      subtotal: billE2GrandTotal,
      grandTotal: billE2GrandTotal,
      receivedQty: 0,
      recognizedInvoiceValue: 0,
      amountPaid: upfrontPaidE2,
      paymentMethod: "BANK_TRANSFER",
      outstandingAmount: 0,
      paymentStatus: "PAID",
      status: "PENDING_RECEIPT",
      createdById: owner._id,
    });

    // Inward Bill E2
    await confirmPurchaseInwardWithProvenance(billE2._id, 6, actor);
    suppE = await Supplier.findById(supplierE._id);
    assertSupplierInvariant(suppE, "Step 4 - After inward with excess upfront payment credit");

    // Step 5: Allocated supplier payment of ₹2,000 against Bill E1
    const allocatedPayE = await recordSupplierPayment(
      {
        supplierId: supplierE._id.toString(),
        amount: 2000,
        paymentMethod: "CHEQUE",
        paymentReference: "CHQ-ALLOC-E",
        allocations: [{ purchaseId: billE1._id.toString(), amount: 2000 }],
        notes: "Partial payment for Bill E1",
      },
      actor
    );
    suppE = await Supplier.findById(supplierE._id);
    assertSupplierInvariant(suppE, "Step 5 - After allocated payment against Bill E1");

    // Step 6: Reverse the allocated payment (₹2,000)
    await reverseSupplierPayment(
      {
        paymentId: allocatedPayE._id.toString(),
        reason: "Cheque damaged, reversing allocated payment",
      },
      actor
    );
    suppE = await Supplier.findById(supplierE._id);
    assertSupplierInvariant(suppE, "Step 6 - After reversal of allocated payment");

    // Step 7: Record another unallocated advance payment 3 (₹5,000)
    const advE3 = await recordSupplierPayment(
      {
        supplierId: supplierE._id.toString(),
        amount: 5000,
        paymentMethod: "UPI",
        notes: "Advance payment 3 for invariant test",
      },
      actor
    );
    suppE = await Supplier.findById(supplierE._id);
    assertSupplierInvariant(suppE, "Step 7 - After unallocated advance payment 3 (₹5,000)");

    // Step 8: Reverse unallocated advance payment 3 (₹5,000)
    await reverseSupplierPayment(
      {
        paymentId: advE3._id.toString(),
        reason: "Refund of unallocated advance 3",
      },
      actor
    );
    suppE = await Supplier.findById(supplierE._id);
    assertSupplierInvariant(suppE, "Step 8 - After clean reversal of unallocated advance 3");

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

runPhase5DTestSuite().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
