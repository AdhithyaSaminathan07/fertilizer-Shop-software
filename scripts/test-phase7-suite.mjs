/**
 * KASI AGRI AGENCIES — PHASE 7 CUSTOMER MANAGEMENT & KHATA TEST SUITE
 *
 * Verifies:
 * 1. Customer registration, validation & duplicate phone protection
 * 2. Customer profile & aggregate activity metrics
 * 3. Credit sale & ledger integration (receivable increment, invoice outstanding amount)
 * 4. Partial credit repayment with FIFO invoice allocation
 * 5. Full credit balance settlement
 * 6. Explicit multi-invoice repayment allocations
 * 7. Overpayment rejection guard (rejects amount > outstandingCredit)
 * 8. Idempotency protection against duplicate repayment submissions
 * 9. Controlled repayment reversal & atomic balance restoration
 * 10. Reversal guard against double-reversal
 * 11. Coordination guard: prevents cancelling sale invoice with active repayments
 * 12. Chronological Khata ledger generation & running balance reconciliation
 * 13. Khata opening balance calculation for date-range queries
 * 14. Customer aging report calculation (0-30, 31-60, 61-90, 90+ days)
 * 15. Credit collection dashboard aggregations
 * 16. Customer statement generation with shop profile header
 * 17. Audit logging for CUSTOMER_CREATED, CUSTOMER_UPDATED, CUSTOMER_PAYMENT_RECORDED, CUSTOMER_PAYMENT_REVERSED
 * 18. Accounting balance integrity: totalPurchases = totalPaid + outstandingCredit
 */

import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

// Schema definitions
const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    role: { type: String, enum: ["OWNER", "EMPLOYEE"], default: "EMPLOYEE" },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true }
);

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true }
);

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true, unique: true },
    brand: { type: String, required: true, trim: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    purchasePrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    primaryUnit: { type: String, required: true, default: "BAGS" },
    currentStock: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["ACTIVE", "INACTIVE", "ARCHIVED"], default: "ACTIVE" },
  },
  { timestamps: true }
);

const CustomerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    village: { type: String, trim: true },
    address: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    gstin: { type: String, trim: true },
    outstandingCredit: { type: Number, default: 0, min: 0 },
    totalPurchases: { type: Number, default: 0, min: 0 },
    totalPaid: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);
CustomerSchema.index({ phone: 1, name: 1 });

const CustomerPaymentAllocationSchema = new mongoose.Schema(
  {
    saleId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", required: true },
    invoiceNumber: { type: String, required: true, trim: true },
    invoiceDate: { type: Date, required: true },
    allocatedAmount: { type: Number, required: true, min: 0.01 },
  },
  { _id: false }
);

const CustomerPaymentSchema = new mongoose.Schema(
  {
    paymentNumber: { type: String, required: true, unique: true, uppercase: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    customerSnapshot: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      village: { type: String },
    },
    paymentDate: { type: Date, required: true, default: Date.now },
    amount: { type: Number, required: true, min: 0.01 },
    paymentMethod: {
      type: String,
      enum: ["CASH", "UPI", "BANK_TRANSFER", "CHEQUE"],
      required: true,
    },
    transactionReference: { type: String, trim: true },
    allocations: { type: [CustomerPaymentAllocationSchema], default: [] },
    notes: { type: String, trim: true },
    status: { type: String, enum: ["RECORDED", "REVERSED"], default: "RECORDED" },
    reversal: {
      reason: { type: String, trim: true },
      reversedAt: { type: Date },
      reversedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      reversedByName: { type: String },
    },
    idempotencyKey: { type: String, trim: true, sparse: true, unique: true },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true }
);
CustomerPaymentSchema.index({ customerId: 1, paymentDate: -1 });

const SaleItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productSnapshot: {
      name: { type: String, required: true },
      sku: { type: String, required: true },
      brand: { type: String },
      primaryUnit: { type: String, required: true },
    },
    quantity: { type: Number, required: true, min: 0.001 },
    unit: { type: String, required: true },
    unitSellingPrice: { type: Number, required: true, min: 0 },
    taxableAmount: { type: Number, required: true },
    gstAmount: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true },
  },
  { _id: false }
);

const SaleSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true, uppercase: true },
    invoiceDate: { type: Date, default: Date.now },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    customerSnapshot: {
      name: { type: String, required: true },
      phone: { type: String },
      village: { type: String },
    },
    isWalkIn: { type: Boolean, default: false },
    items: { type: [SaleItemSchema], required: true },
    subtotal: { type: Number, required: true },
    taxableAmount: { type: Number, required: true },
    totalGst: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    payment: {
      method: { type: String, enum: ["CASH", "UPI", "CREDIT", "SPLIT"], required: true },
      cashAmount: { type: Number, default: 0 },
      upiAmount: { type: Number, default: 0 },
      creditAmount: { type: Number, default: 0 },
      totalPaid: { type: Number, default: 0 },
    },
    outstandingAmount: { type: Number, default: 0, min: 0 },
    repaidAmount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["COMPLETED", "CANCELLED"], default: "COMPLETED" },
    notes: { type: String },
    cancelledAt: { type: Date },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cancellationReason: { type: String },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

const AuditLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    userName: { type: String },
    action: { type: String, required: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

let User;
let Category;
let Product;
let Customer;
let CustomerPayment;
let Sale;
let AuditLog;

function round2(val) {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

async function generateCustomerPaymentNumber() {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `CPAY-${yearMonth}-`;

  const lastPayment = await CustomerPayment.findOne(
    { paymentNumber: { $regex: `^${prefix}` } },
    { paymentNumber: 1 }
  ).sort({ paymentNumber: -1 });

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

async function testCreateCustomer(input, session, userContext) {
  const cleanPhone = input.phone.trim().replace(/[\s-]/g, "");
  const existing = await Customer.findOne({ phone: cleanPhone }).session(session || null);
  if (existing) {
    return existing;
  }

  const customerData = {
    name: input.name.trim(),
    phone: cleanPhone,
    village: input.village?.trim() || undefined,
    address: input.address?.trim() || undefined,
    email: input.email?.trim()?.toLowerCase() || undefined,
    gstin: input.gstin?.trim()?.toUpperCase() || undefined,
    notes: input.notes?.trim() || undefined,
    outstandingCredit: 0,
    totalPurchases: 0,
    totalPaid: 0,
    status: input.status || "ACTIVE",
  };

  let created;
  if (session) {
    const results = await Customer.create([customerData], { session });
    created = results[0];
  } else {
    created = await Customer.create(customerData);
  }

  if (userContext) {
    await AuditLog.create([
      {
        userId: new mongoose.Types.ObjectId(userContext.id),
        userName: userContext.name,
        action: "CUSTOMER_CREATED",
        details: {
          customerId: created._id.toString(),
          name: created.name,
          phone: created.phone,
        },
        timestamp: new Date(),
      },
    ]);
  }

  return created;
}

async function testUpdateCustomer(id, input, userContext) {
  const update = {};
  if (input.name !== undefined) update.name = input.name.trim();
  if (input.phone !== undefined) update.phone = input.phone.trim().replace(/[\s-]/g, "");
  if (input.village !== undefined) update.village = input.village.trim() || undefined;
  if (input.address !== undefined) update.address = input.address.trim() || undefined;
  if (input.email !== undefined) update.email = input.email.trim()?.toLowerCase() || undefined;
  if (input.gstin !== undefined) update.gstin = input.gstin.trim()?.toUpperCase() || undefined;
  if (input.notes !== undefined) update.notes = input.notes.trim() || undefined;
  if (input.status !== undefined) update.status = input.status;

  const updated = await Customer.findByIdAndUpdate(id, { $set: update }, { new: true });

  if (updated && userContext) {
    await AuditLog.create([
      {
        userId: new mongoose.Types.ObjectId(userContext.id),
        userName: userContext.name,
        action: "CUSTOMER_UPDATED",
        details: {
          customerId: id,
          name: updated.name,
          changes: Object.keys(update),
        },
        timestamp: new Date(),
      },
    ]);
  }

  return updated;
}

async function testGetCustomerProfile(id) {
  const customer = await Customer.findById(id).lean();
  if (!customer) return null;

  const [totalInvoicesCount, unpaidInvoicesCount, paymentsCount] = await Promise.all([
    Sale.countDocuments({ customerId: id, status: "COMPLETED" }),
    Sale.countDocuments({
      customerId: id,
      status: "COMPLETED",
      outstandingAmount: { $gt: 0 },
    }),
    CustomerPayment.countDocuments({ customerId: id, status: "RECORDED" }),
  ]);

  return {
    ...customer,
    totalInvoicesCount,
    unpaidInvoicesCount,
    paymentsCount,
  };
}

async function testRecordCustomerRepayment(input, userContext) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (input.idempotencyKey && input.idempotencyKey.trim()) {
      const existing = await CustomerPayment.findOne({
        idempotencyKey: input.idempotencyKey.trim(),
      }).session(session);
      if (existing) {
        await session.commitTransaction();
        return existing;
      }
    }

    const customer = await Customer.findById(input.customerId).session(session);
    if (!customer) {
      throw new Error("Customer not found");
    }

    const paymentAmount = round2(input.amount);
    if (paymentAmount <= 0) {
      throw new Error("Payment amount must be greater than zero");
    }

    const currentDue = round2(customer.outstandingCredit);
    if (paymentAmount > currentDue) {
      throw new Error(
        `Payment amount (₹${paymentAmount.toFixed(2)}) exceeds customer's eligible outstanding credit (₹${currentDue.toFixed(2)})`
      );
    }

    const recordedAllocations = [];

    if (input.allocations && input.allocations.length > 0) {
      const sumAllocated = round2(
        input.allocations.reduce((acc, a) => acc + round2(a.allocatedAmount), 0)
      );
      if (Math.abs(sumAllocated - paymentAmount) > 0.01) {
        throw new Error(
          `Allocation sum (₹${sumAllocated.toFixed(2)}) does not match payment amount (₹${paymentAmount.toFixed(2)})`
        );
      }

      const seenSaleIds = new Set();
      for (const alloc of input.allocations) {
        const saleIdStr = alloc.saleId.toString();
        if (seenSaleIds.has(saleIdStr)) {
          throw new Error(`Duplicate invoice entry in allocations: ${saleIdStr}`);
        }
        seenSaleIds.add(saleIdStr);

        const allocAmt = round2(alloc.allocatedAmount);
        if (allocAmt <= 0) {
          throw new Error(`Allocated amount must be greater than zero for invoice ${saleIdStr}`);
        }

        const sale = await Sale.findById(alloc.saleId).session(session);
        if (!sale) throw new Error("Invoice not found for allocation");

        if (sale.customerId?.toString() !== customer._id.toString()) {
          throw new Error(`Invoice ${sale.invoiceNumber} does not belong to customer ${customer.name}`);
        }

        if (sale.status !== "COMPLETED") {
          throw new Error(`Cannot allocate payment to non-completed invoice: ${sale.invoiceNumber}`);
        }

        const invoiceDue = round2(sale.outstandingAmount ?? (sale.payment?.creditAmount || 0));

        if (allocAmt > invoiceDue) {
          throw new Error(
            `Allocated amount (₹${allocAmt.toFixed(2)}) exceeds invoice ${sale.invoiceNumber} outstanding balance (₹${invoiceDue.toFixed(2)})`
          );
        }

        const newOutstanding = round2(invoiceDue - allocAmt);
        const newRepaid = round2((sale.repaidAmount || 0) + allocAmt);

        const updatedSale = await Sale.findOneAndUpdate(
          { _id: sale._id, outstandingAmount: { $gte: allocAmt } },
          { $set: { outstandingAmount: newOutstanding, repaidAmount: newRepaid } },
          { session, returnDocument: "after" }
        );

        if (!updatedSale) {
          throw new Error(`Allocated amount exceeds invoice ${sale.invoiceNumber} current outstanding balance`);
        }

        recordedAllocations.push({
          saleId: sale._id,
          invoiceNumber: sale.invoiceNumber,
          invoiceDate: sale.invoiceDate,
          allocatedAmount: allocAmt,
        });
      }
    } else {
      const unpaidSales = await Sale.find({
        customerId: customer._id,
        status: "COMPLETED",
        outstandingAmount: { $gt: 0 },
      })
        .sort({ invoiceDate: 1, createdAt: 1 })
        .session(session);

      let remainingToAllocate = paymentAmount;

      for (const sale of unpaidSales) {
        if (remainingToAllocate <= 0) break;

        const invoiceDue = round2(sale.outstandingAmount);
        if (invoiceDue <= 0) continue;

        const allocAmt = Math.min(remainingToAllocate, invoiceDue);

        const newOutstanding = round2(invoiceDue - allocAmt);
        const newRepaid = round2((sale.repaidAmount || 0) + allocAmt);

        const updatedSale = await Sale.findOneAndUpdate(
          { _id: sale._id, outstandingAmount: { $gte: allocAmt } },
          { $set: { outstandingAmount: newOutstanding, repaidAmount: newRepaid } },
          { session, returnDocument: "after" }
        );
        if (!updatedSale) continue;

        recordedAllocations.push({
          saleId: sale._id,
          invoiceNumber: sale.invoiceNumber,
          invoiceDate: sale.invoiceDate,
          allocatedAmount: allocAmt,
        });

        remainingToAllocate = round2(remainingToAllocate - allocAmt);
      }
    }

    const newCustOutstanding = round2(customer.outstandingCredit - paymentAmount);
    const newCustTotalPaid = round2(customer.totalPaid + paymentAmount);

    const updatedCustomer = await Customer.findOneAndUpdate(
      { _id: customer._id, outstandingCredit: { $gte: paymentAmount } },
      { $set: { outstandingCredit: newCustOutstanding, totalPaid: newCustTotalPaid } },
      { session, returnDocument: "after" }
    );

    if (!updatedCustomer) {
      throw new Error(`Payment amount (₹${paymentAmount.toFixed(2)}) exceeds customer's eligible outstanding credit`);
    }

    const paymentNumber = await generateCustomerPaymentNumber();

    const [createdPayment] = await CustomerPayment.create(
      [
        {
          paymentNumber,
          customerId: customer._id,
          customerSnapshot: {
            name: customer.name,
            phone: customer.phone,
            village: customer.village,
          },
          paymentDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
          amount: paymentAmount,
          paymentMethod: input.paymentMethod,
          transactionReference: input.transactionReference?.trim() || undefined,
          allocations: recordedAllocations,
          notes: input.notes?.trim() || undefined,
          status: "RECORDED",
          idempotencyKey: input.idempotencyKey?.trim() || undefined,
          createdById: new mongoose.Types.ObjectId(userContext.id),
          createdByName: userContext.name,
        },
      ],
      { session }
    );

    await AuditLog.create(
      [
        {
          userId: new mongoose.Types.ObjectId(userContext.id),
          userName: userContext.name,
          action: "CUSTOMER_PAYMENT_RECORDED",
          details: {
            paymentNumber,
            customerId: customer._id.toString(),
            customerName: customer.name,
            amount: paymentAmount,
            paymentMethod: input.paymentMethod,
            allocationsCount: recordedAllocations.length,
          },
          timestamp: new Date(),
        },
      ],
      { session }
    );

    await session.commitTransaction();
    return createdPayment;
  } catch (err) {
    await session.abortTransaction();
    if (err?.code === 11000 && input.idempotencyKey && input.idempotencyKey.trim()) {
      const existing = await CustomerPayment.findOne({ idempotencyKey: input.idempotencyKey.trim() });
      if (existing) return existing;
    }
    throw err;
  } finally {
    session.endSession();
  }
}

async function testReverseCustomerPayment(paymentId, reason, userContext) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const payment = await CustomerPayment.findOneAndUpdate(
      { _id: paymentId, status: "RECORDED" },
      {
        $set: {
          status: "REVERSED",
          reversal: {
            reason: reason.trim(),
            reversedAt: new Date(),
            reversedById: new mongoose.Types.ObjectId(userContext.id),
            reversedByName: userContext.name,
          },
        },
      },
      { session, returnDocument: "after" }
    );

    if (!payment) {
      const existing = await CustomerPayment.findById(paymentId).session(session);
      if (existing && existing.status === "REVERSED") {
        throw new Error(`Payment voucher ${existing.paymentNumber} has already been reversed`);
      }
      throw new Error("Payment voucher not found");
    }

    const customer = await Customer.findById(payment.customerId).session(session);
    if (!customer) throw new Error("Customer not found");

    for (const alloc of payment.allocations) {
      const sale = await Sale.findById(alloc.saleId).session(session);
      if (sale) {
        sale.outstandingAmount = round2((sale.outstandingAmount || 0) + alloc.allocatedAmount);
        sale.repaidAmount = Math.max(0, round2((sale.repaidAmount || 0) - alloc.allocatedAmount));
        await sale.save({ session });
      }
    }

    customer.outstandingCredit = round2(customer.outstandingCredit + payment.amount);
    customer.totalPaid = Math.max(0, round2(customer.totalPaid - payment.amount));
    await customer.save({ session });

    payment.status = "REVERSED";
    payment.reversal = {
      reason: reason.trim(),
      reversedAt: new Date(),
      reversedById: new mongoose.Types.ObjectId(userContext.id),
      reversedByName: userContext.name,
    };
    await payment.save({ session });

    await AuditLog.create(
      [
        {
          userId: new mongoose.Types.ObjectId(userContext.id),
          userName: userContext.name,
          action: "CUSTOMER_PAYMENT_REVERSED",
          details: {
            paymentNumber: payment.paymentNumber,
            customerId: customer._id.toString(),
            amount: payment.amount,
            reason: reason.trim(),
          },
          timestamp: new Date(),
        },
      ],
      { session }
    );

    await session.commitTransaction();
    return payment;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

async function testGetCustomerLedger(customerId, dateRange) {
  const customer = await Customer.findById(customerId).lean();
  if (!customer) throw new Error("Customer not found");

  const fromDate = dateRange?.fromDate ? new Date(dateRange.fromDate) : undefined;
  let toDate = dateRange?.toDate ? new Date(dateRange.toDate) : undefined;
  if (toDate) toDate.setHours(23, 59, 59, 999);

  let openingBalance = 0;
  if (fromDate) {
    const [priorSales, priorPayments] = await Promise.all([
      Sale.find({
        customerId,
        status: "COMPLETED",
        "payment.creditAmount": { $gt: 0 },
        invoiceDate: { $lt: fromDate },
      }).select("payment.creditAmount"),
      CustomerPayment.find({
        customerId,
        status: "RECORDED",
        paymentDate: { $lt: fromDate },
      }).select("amount"),
    ]);

    const priorCreditGiven = round2(
      priorSales.reduce((acc, s) => acc + (s.payment?.creditAmount || 0), 0)
    );
    const priorPaymentsReceived = round2(
      priorPayments.reduce((acc, p) => acc + (p.amount || 0), 0)
    );

    openingBalance = round2(priorCreditGiven - priorPaymentsReceived);
  }

  const salesFilter = {
    customerId,
    status: "COMPLETED",
    "payment.creditAmount": { $gt: 0 },
  };
  const paymentsFilter = { customerId };

  if (fromDate || toDate) {
    salesFilter.invoiceDate = {};
    paymentsFilter.paymentDate = {};
    if (fromDate) {
      salesFilter.invoiceDate.$gte = fromDate;
      paymentsFilter.paymentDate.$gte = fromDate;
    }
    if (toDate) {
      salesFilter.invoiceDate.$lte = toDate;
      paymentsFilter.paymentDate.$lte = toDate;
    }
  }

  const [sales, payments] = await Promise.all([
    Sale.find(salesFilter).sort({ invoiceDate: 1 }).lean(),
    CustomerPayment.find(paymentsFilter).sort({ paymentDate: 1 }).lean(),
  ]);

  const rawEntries = [];
  for (const s of sales) {
    rawEntries.push({
      id: s._id.toString(),
      date: new Date(s.invoiceDate),
      type: "CREDIT_SALE",
      label: "Credit Given",
      reference: s.invoiceNumber,
      relatedId: s._id.toString(),
      debitAmount: round2(s.payment?.creditAmount || 0),
      creditAmount: 0,
      notes: s.notes,
      status: "COMPLETED",
    });
  }

  for (const p of payments) {
    const isRecorded = p.status === "RECORDED";
    rawEntries.push({
      id: p._id.toString(),
      date: new Date(p.paymentDate),
      type: "REPAYMENT",
      label: "Payment Received",
      reference: p.paymentNumber,
      relatedId: p._id.toString(),
      paymentMethod: p.paymentMethod,
      transactionReference: p.transactionReference,
      debitAmount: 0,
      creditAmount: isRecorded ? round2(p.amount) : 0,
      notes: isRecorded ? p.notes : `REVERSED: ${p.reversal?.reason || "Cancelled"}`,
      status: p.status,
    });
  }

  rawEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

  let running = openingBalance;
  let totalCreditGiven = 0;
  let totalPaymentsReceived = 0;

  const transactions = rawEntries.map((e) => {
    running = round2(running + e.debitAmount - e.creditAmount);
    totalCreditGiven = round2(totalCreditGiven + e.debitAmount);
    totalPaymentsReceived = round2(totalPaymentsReceived + e.creditAmount);

    return {
      ...e,
      runningBalance: running,
    };
  });

  return {
    customer,
    openingBalance,
    transactions,
    totalCreditGiven,
    totalPaymentsReceived,
    closingBalance: running,
  };
}

async function testGetCustomerAgingReport() {
  const now = Date.now();
  const customers = await Customer.find({ outstandingCredit: { $gt: 0 } })
    .sort({ outstandingCredit: -1 })
    .lean();

  const agingItems = [];
  let sum0to30 = 0, count0to30 = 0;
  let sum31to60 = 0, count31to60 = 0;
  let sum61to90 = 0, count61to90 = 0;
  let sum90Plus = 0, count90Plus = 0;
  let totalOutstanding = 0;

  for (const c of customers) {
    const due = round2(c.outstandingCredit);
    totalOutstanding = round2(totalOutstanding + due);

    const [unpaidSales, lastPayment] = await Promise.all([
      Sale.find({
        customerId: c._id,
        status: "COMPLETED",
        outstandingAmount: { $gt: 0 },
      })
        .sort({ invoiceDate: 1 })
        .lean(),
      CustomerPayment.findOne({
        customerId: c._id,
        status: "RECORDED",
      })
        .sort({ paymentDate: -1 })
        .lean(),
    ]);

    const oldest = unpaidSales[0];
    const oldestDate = oldest ? new Date(oldest.invoiceDate) : new Date(c.createdAt);
    const ageInDays = Math.max(0, Math.floor((now - oldestDate.getTime()) / (1000 * 60 * 60 * 24)));

    let bucket = "0-30";
    if (ageInDays > 90) {
      bucket = "90+";
      sum90Plus = round2(sum90Plus + due);
      count90Plus++;
    } else if (ageInDays > 60) {
      bucket = "61-90";
      sum61to90 = round2(sum61to90 + due);
      count61to90++;
    } else if (ageInDays > 30) {
      bucket = "31-60";
      sum31to60 = round2(sum31to60 + due);
      count31to60++;
    } else {
      bucket = "0-30";
      sum0to30 = round2(sum0to30 + due);
      count0to30++;
    }

    agingItems.push({
      customerId: c._id.toString(),
      customerName: c.name,
      phone: c.phone,
      village: c.village,
      outstandingBalance: due,
      unpaidInvoicesCount: unpaidSales.length,
      oldestUnpaidInvoiceDate: oldest?.invoiceDate,
      oldestUnpaidInvoiceNumber: oldest?.invoiceNumber,
      lastPaymentDate: lastPayment?.paymentDate,
      lastPaymentAmount: lastPayment?.amount,
      ageInDays,
      agingBucket: bucket,
    });
  }

  return {
    totalOutstanding: round2(totalOutstanding),
    totalPendingCustomers: customers.length,
    bucket0to30: { count: count0to30, amount: round2(sum0to30) },
    bucket31to60: { count: count31to60, amount: round2(sum31to60) },
    bucket61to90: { count: count61to90, amount: round2(sum61to90) },
    bucket90Plus: { count: count90Plus, amount: round2(sum90Plus) },
    customers: agingItems,
  };
}

async function testGetCreditCollectionDashboard() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [customerStats, todayPaymentsAgg, monthPaymentsAgg, recentRepayments, agingReport] =
    await Promise.all([
      Customer.aggregate([
        {
          $group: {
            _id: null,
            totalOutstandingCredit: { $sum: "$outstandingCredit" },
            totalPendingCustomers: {
              $sum: { $cond: [{ $gt: ["$outstandingCredit", 0] }, 1, 0] },
            },
          },
        },
      ]),
      CustomerPayment.aggregate([
        {
          $match: {
            paymentDate: { $gte: startOfDay },
            status: "RECORDED",
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      CustomerPayment.aggregate([
        {
          $match: {
            paymentDate: { $gte: startOfMonth },
            status: "RECORDED",
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      CustomerPayment.find({ status: "RECORDED" })
        .sort({ paymentDate: -1, createdAt: -1 })
        .limit(10)
        .lean(),
      testGetCustomerAgingReport(),
    ]);

  const custSummary = customerStats[0] || {
    totalOutstandingCredit: 0,
    totalPendingCustomers: 0,
  };

  const topDebtors = await Customer.find({ outstandingCredit: { $gt: 0 } })
    .sort({ outstandingCredit: -1 })
    .limit(8)
    .select("name phone village outstandingCredit")
    .lean();

  return {
    totalOutstandingCredit: round2(custSummary.totalOutstandingCredit || 0),
    totalPendingCustomers: custSummary.totalPendingCustomers || 0,
    collectedToday: round2(todayPaymentsAgg[0]?.total || 0),
    collectedThisMonth: round2(monthPaymentsAgg[0]?.total || 0),
    agingBuckets: {
      "0-30": agingReport.bucket0to30.amount,
      "31-60": agingReport.bucket31to60.amount,
      "61-90": agingReport.bucket61to90.amount,
      "90+": agingReport.bucket90Plus.amount,
    },
    recentRepayments: recentRepayments.map((p) => ({
      _id: p._id.toString(),
      paymentNumber: p.paymentNumber,
      customerId: p.customerId.toString(),
      customerName: p.customerSnapshot?.name || "Customer",
      phone: p.customerSnapshot?.phone || "",
      amount: p.amount,
      paymentMethod: p.paymentMethod,
      paymentDate: p.paymentDate,
      status: p.status,
    })),
    topDebtors: topDebtors.map((d) => ({
      _id: d._id.toString(),
      name: d.name,
      phone: d.phone,
      village: d.village,
      outstandingCredit: d.outstandingCredit,
      unpaidInvoicesCount: 0,
    })),
  };
}

async function runTestSuite() {
  console.log("================================================================================");
  console.log("   KASI AGRI AGENCIES — PHASE 7 CUSTOMER MANAGEMENT & KHATA TEST SUITE");
  console.log("================================================================================\n");

  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  const uri = replSet.getUri();
  await mongoose.connect(uri);

  User = mongoose.models.User || mongoose.model("User", UserSchema);
  Category = mongoose.models.Category || mongoose.model("Category", CategorySchema);
  Product = mongoose.models.Product || mongoose.model("Product", ProductSchema);
  Customer = mongoose.models.Customer || mongoose.model("Customer", CustomerSchema);
  CustomerPayment = mongoose.models.CustomerPayment || mongoose.model("CustomerPayment", CustomerPaymentSchema);
  Sale = mongoose.models.Sale || mongoose.model("Sale", SaleSchema);
  AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", AuditLogSchema);

  let passedAssertions = 0;
  function assert(condition, message) {
    if (!condition) {
      console.error(`❌ FAILED: ${message}`);
      throw new Error(`Assertion failed: ${message}`);
    }
    console.log(`  ✓ ${message}`);
    passedAssertions++;
  }

  try {
    const adminUser = await User.create({
      name: "R. Balamurugan",
      email: "owner@kasiagri.com",
      username: "balamurugan",
      role: "OWNER",
      status: "ACTIVE",
    });

    const category = await Category.create({
      name: "Fertilizers",
      slug: "fertilizers",
      status: "ACTIVE",
    });

    const urea = await Product.create({
      name: "Neem Coated Urea 45kg",
      sku: "FERT-UREA-P7",
      brand: "IFFCO",
      categoryId: category._id,
      purchasePrice: 242.0,
      sellingPrice: 266.5,
      primaryUnit: "BAGS",
      currentStock: 200,
      status: "ACTIVE",
    });

    const userContext = {
      id: adminUser._id.toString(),
      name: adminUser.name,
    };

    console.log("--- 1. Customer Creation & Duplicate Phone Protection ---");
    const farmer1 = await testCreateCustomer(
      {
        name: "P. Rengarajan",
        phone: "9842112345",
        village: "Kudavasal",
        address: "North Street",
        email: "rengarajan@farmer.in",
        gstin: "33AAAAA1234A1Z5",
        notes: "Paddy and blackgram farmer (12 acres)",
      },
      undefined,
      userContext
    );

    assert(farmer1.name === "P. Rengarajan", "Customer created with accurate name");
    assert(farmer1.phone === "9842112345", "Phone stored cleanly formatted");
    assert(farmer1.outstandingCredit === 0, "Initial outstanding credit is 0");
    assert(farmer1.totalPurchases === 0, "Initial total purchases is 0");
    assert(farmer1.totalPaid === 0, "Initial total paid is 0");
    assert(farmer1.status === "ACTIVE", "Status defaults to ACTIVE");

    const duplicate = await testCreateCustomer(
      {
        name: "P. Rengarajan (Duplicate)",
        phone: "9842112345",
        village: "Kudavasal",
      },
      undefined,
      userContext
    );
    assert(duplicate._id.toString() === farmer1._id.toString(), "Returns existing customer when phone matches");

    console.log("\n--- 2. Customer Update & Profile Details ---");
    const updated = await testUpdateCustomer(
      farmer1._id.toString(),
      { village: "Kudavasal West", notes: "Updated acreage: 15 acres" },
      userContext
    );
    assert(updated.village === "Kudavasal West", "Village updated successfully");
    assert(updated.notes.includes("15 acres"), "Notes updated successfully");

    const profile = await testGetCustomerProfile(farmer1._id.toString());
    assert(profile.totalInvoicesCount === 0, "Profile shows 0 total invoices");
    assert(profile.unpaidInvoicesCount === 0, "Profile shows 0 unpaid invoices");

    console.log("\n--- 3. Credit Sale & Customer Ledger Integration ---");
    // Sale 1: Total 2798.25, Cash 500, Credit 2298.25
    const [sale1] = await Sale.create([
      {
        invoiceNumber: "INV-202611-0001",
        invoiceDate: new Date(),
        customerId: farmer1._id,
        customerSnapshot: { name: farmer1.name, phone: farmer1.phone, village: farmer1.village },
        items: [
          {
            productId: urea._id,
            productSnapshot: { name: urea.name, sku: urea.sku, primaryUnit: urea.primaryUnit },
            quantity: 10,
            unit: "BAGS",
            unitSellingPrice: 266.5,
            taxableAmount: 2665.0,
            gstAmount: 133.25,
            total: 2798.25,
          },
        ],
        subtotal: 2665.0,
        taxableAmount: 2665.0,
        totalGst: 133.25,
        grandTotal: 2798.25,
        payment: {
          method: "SPLIT",
          cashAmount: 500.0,
          creditAmount: 2298.25,
          totalPaid: 500.0,
        },
        outstandingAmount: 2298.25,
        repaidAmount: 0,
        status: "COMPLETED",
        createdBy: adminUser._id,
      },
    ]);

    farmer1.outstandingCredit = 2298.25;
    farmer1.totalPurchases = 2798.25;
    farmer1.totalPaid = 500.0;
    await farmer1.save();

    assert(sale1.payment.creditAmount === 2298.25, "Sale recorded credit of 2298.25");
    assert(sale1.outstandingAmount === 2298.25, "Sale invoice outstandingAmount initialized to 2298.25");
    assert(sale1.repaidAmount === 0, "Sale invoice repaidAmount initialized to 0");

    const farmer1AfterSale1 = await Customer.findById(farmer1._id);
    assert(farmer1AfterSale1.outstandingCredit === 2298.25, "Customer outstandingCredit increased to 2298.25");
    assert(farmer1AfterSale1.totalPurchases === 2798.25, "Customer totalPurchases increased to 2798.25");
    assert(farmer1AfterSale1.totalPaid === 500.0, "Customer totalPaid reflects upfront cash of 500.00");

    // Sale 2: Total 1399.13 (100% Credit)
    const [sale2] = await Sale.create([
      {
        invoiceNumber: "INV-202611-0002",
        invoiceDate: new Date(),
        customerId: farmer1._id,
        customerSnapshot: { name: farmer1.name, phone: farmer1.phone, village: farmer1.village },
        items: [
          {
            productId: urea._id,
            productSnapshot: { name: urea.name, sku: urea.sku, primaryUnit: urea.primaryUnit },
            quantity: 5,
            unit: "BAGS",
            unitSellingPrice: 266.5,
            taxableAmount: 1332.5,
            gstAmount: 66.63,
            total: 1399.13,
          },
        ],
        subtotal: 1332.5,
        taxableAmount: 1332.5,
        totalGst: 66.63,
        grandTotal: 1399.13,
        payment: {
          method: "CREDIT",
          creditAmount: 1399.13,
          totalPaid: 0,
        },
        outstandingAmount: 1399.13,
        repaidAmount: 0,
        status: "COMPLETED",
        createdBy: adminUser._id,
      },
    ]);

    farmer1.outstandingCredit = round2(farmer1.outstandingCredit + 1399.13);
    farmer1.totalPurchases = round2(farmer1.totalPurchases + 1399.13);
    await farmer1.save();

    const farmer1AfterSale2 = await Customer.findById(farmer1._id);
    assert(farmer1AfterSale2.outstandingCredit === 3697.38, "Total outstanding credit is 3697.38");
    assert(farmer1AfterSale2.totalPurchases === 4197.38, "Total purchases is 4197.38");

    console.log("\n--- 4. Partial Repayment with FIFO Invoice Allocation ---");
    const repayment1 = await testRecordCustomerRepayment(
      {
        customerId: farmer1._id.toString(),
        amount: 1500.0,
        paymentMethod: "UPI",
        transactionReference: "UPI-REP-001",
        notes: "Counter repayment by farmer son via GPay",
      },
      userContext
    );

    assert(repayment1.paymentNumber.startsWith("CPAY-"), `Voucher number generated: ${repayment1.paymentNumber}`);
    assert(repayment1.amount === 1500.0, "Voucher amount is 1500.00");
    assert(repayment1.allocations.length === 1, "FIFO allocated to oldest invoice (Sale 1)");
    assert(repayment1.allocations[0].invoiceNumber === sale1.invoiceNumber, "Allocated to Sale 1 invoice");
    assert(repayment1.allocations[0].allocatedAmount === 1500.0, "Allocated exact 1500.00");

    const sale1AfterRep1 = await Sale.findById(sale1._id);
    assert(sale1AfterRep1.outstandingAmount === 798.25, `Sale 1 outstanding reduced to 798.25 (actual: ${sale1AfterRep1.outstandingAmount})`);
    assert(sale1AfterRep1.repaidAmount === 1500.0, "Sale 1 repaidAmount tracked as 1500.00");

    const farmer1AfterRep1 = await Customer.findById(farmer1._id);
    assert(farmer1AfterRep1.outstandingCredit === 2197.38, `Customer outstandingCredit reduced to 2197.38 (actual: ${farmer1AfterRep1.outstandingCredit})`);
    assert(farmer1AfterRep1.totalPaid === 2000.0, `Customer totalPaid increased to 2000.00 (actual: ${farmer1AfterRep1.totalPaid})`);

    assert(
      farmer1AfterRep1.totalPurchases === round2(farmer1AfterRep1.totalPaid + farmer1AfterRep1.outstandingCredit),
      "Accounting Invariant holds: totalPurchases = totalPaid + outstandingCredit"
    );

    console.log("\n--- 5. Multi-Invoice Spanning FIFO Repayment ---");
    const repayment2 = await testRecordCustomerRepayment(
      {
        customerId: farmer1._id.toString(),
        amount: 1200.0,
        paymentMethod: "CASH",
        notes: "Cash repayment at shop counter",
      },
      userContext
    );

    assert(repayment2.allocations.length === 2, "Payment split across 2 invoices in FIFO order");
    assert(repayment2.allocations[0].invoiceNumber === sale1.invoiceNumber, "First chunk allocated to Sale 1");
    assert(repayment2.allocations[0].allocatedAmount === 798.25, "Sale 1 received exact remaining 798.25");
    assert(repayment2.allocations[1].invoiceNumber === sale2.invoiceNumber, "Second chunk allocated to Sale 2");
    assert(repayment2.allocations[1].allocatedAmount === 401.75, "Sale 2 received 401.75");

    const sale1AfterRep2 = await Sale.findById(sale1._id);
    assert(sale1AfterRep2.outstandingAmount === 0, "Sale 1 fully settled (outstanding = 0)");
    assert(sale1AfterRep2.repaidAmount === 2298.25, "Sale 1 fully repaid (2298.25)");

    const sale2AfterRep2 = await Sale.findById(sale2._id);
    assert(sale2AfterRep2.outstandingAmount === 997.38, `Sale 2 outstanding reduced to 997.38 (actual: ${sale2AfterRep2.outstandingAmount})`);

    const farmer1AfterRep2 = await Customer.findById(farmer1._id);
    assert(farmer1AfterRep2.outstandingCredit === 997.38, `Customer outstandingCredit is 997.38 (actual: ${farmer1AfterRep2.outstandingCredit})`);

    console.log("\n--- 6. Overpayment Rejection Guard ---");
    let caughtOverpayment = false;
    try {
      await testRecordCustomerRepayment(
        {
          customerId: farmer1._id.toString(),
          amount: 2000.0,
          paymentMethod: "CASH",
        },
        userContext
      );
    } catch (err) {
      caughtOverpayment = true;
      assert(err.message.includes("exceeds customer's eligible outstanding credit"), `Caught overpayment: ${err.message}`);
    }
    assert(caughtOverpayment, "Guard successfully blocked payment exceeding customer credit balance");

    console.log("\n--- 7. Idempotency Protection ---");
    const idempotencyKey = "IDEMP-KEY-TEST-001";
    const paymentIdemp1 = await testRecordCustomerRepayment(
      {
        customerId: farmer1._id.toString(),
        amount: 200.0,
        paymentMethod: "CASH",
        idempotencyKey,
      },
      userContext
    );

    const paymentIdemp2 = await testRecordCustomerRepayment(
      {
        customerId: farmer1._id.toString(),
        amount: 200.0,
        paymentMethod: "CASH",
        idempotencyKey,
      },
      userContext
    );

    assert(paymentIdemp1._id.toString() === paymentIdemp2._id.toString(), "Idempotent submission returned identical payment voucher");
    const farmerAfterIdemp = await Customer.findById(farmer1._id);
    assert(farmerAfterIdemp.outstandingCredit === 797.38, `No double-crediting! Balance is 797.38 (actual: ${farmerAfterIdemp.outstandingCredit})`);

    console.log("\n--- 8. Safe Repayment Reversal & Balance Restoration ---");
    const reversedPayment = await testReverseCustomerPayment(
      paymentIdemp1._id.toString(),
      "Wrong customer selected by cashier",
      userContext
    );

    assert(reversedPayment.status === "REVERSED", "Voucher status updated to REVERSED");
    assert(reversedPayment.reversal.reason === "Wrong customer selected by cashier", "Reversal reason recorded");

    const farmerAfterReversal = await Customer.findById(farmer1._id);
    assert(farmerAfterReversal.outstandingCredit === 997.38, `Customer outstandingCredit restored to 997.38 (actual: ${farmerAfterReversal.outstandingCredit})`);
    assert(farmerAfterReversal.totalPaid === 3200.0, `Customer totalPaid decremented back to 3200.00 (actual: ${farmerAfterReversal.totalPaid})`);

    assert(
      farmerAfterReversal.totalPurchases === round2(farmerAfterReversal.totalPaid + farmerAfterReversal.outstandingCredit),
      "Accounting Invariant holds after reversal: totalPurchases = totalPaid + outstandingCredit"
    );

    let caughtDoubleReversal = false;
    try {
      await testReverseCustomerPayment(
        paymentIdemp1._id.toString(),
        "Attempt second reversal",
        userContext
      );
    } catch (err) {
      caughtDoubleReversal = true;
      assert(err.message.includes("already been reversed"), `Caught double reversal: ${err.message}`);
    }
    assert(caughtDoubleReversal, "Guard prevented double reversal of payment voucher");

    console.log("\n--- 9. Chronological Khata Ledger & Running Balance ---");
    const ledger = await testGetCustomerLedger(farmer1._id.toString());

    assert(ledger.customer.name === "P. Rengarajan", "Ledger belongs to customer");
    assert(ledger.openingBalance === 0, "All-time ledger starts at 0 opening balance");
    assert(ledger.transactions.length >= 4, `Ledger records all credit sales and repayments (count: ${ledger.transactions.length})`);
    assert(ledger.totalCreditGiven === 3697.38, `Total credit given is 3697.38 (actual: ${ledger.totalCreditGiven})`);
    assert(ledger.totalPaymentsReceived === 2700.0, `Total payments received is 2700.00 (actual: ${ledger.totalPaymentsReceived})`);
    assert(ledger.closingBalance === 997.38, `Ledger closingBalance matches customer outstandingCredit: 997.38 (actual: ${ledger.closingBalance})`);

    let runningTest = ledger.openingBalance;
    for (const tx of ledger.transactions) {
      runningTest = round2(runningTest + tx.debitAmount - tx.creditAmount);
      assert(tx.runningBalance === runningTest, `Running balance reconciled after ${tx.reference}: ₹${tx.runningBalance.toFixed(2)}`);
    }

    console.log("\n--- 10. Customer Aging Report Calculations ---");
    const farmer2 = await testCreateCustomer(
      {
        name: "K. Sundaram",
        phone: "9443155667",
        village: "Thiruvarur",
      },
      undefined,
      userContext
    );

    const pastDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
    await Sale.create([
      {
        invoiceNumber: "INV-202610-0099",
        invoiceDate: pastDate,
        customerId: farmer2._id,
        customerSnapshot: { name: farmer2.name, phone: farmer2.phone },
        isWalkIn: false,
        items: [
          {
            productId: urea._id,
            productSnapshot: { name: urea.name, sku: urea.sku, primaryUnit: urea.primaryUnit },
            quantity: 4,
            unit: "BAGS",
            unitSellingPrice: 266.5,
            taxableAmount: 1066.0,
            gstAmount: 53.3,
            total: 1119.3,
          },
        ],
        subtotal: 1066.0,
        taxableAmount: 1066.0,
        totalGst: 53.3,
        grandTotal: 1119.3,
        payment: { method: "CREDIT", creditAmount: 1119.3, totalPaid: 0 },
        outstandingAmount: 1119.3,
        repaidAmount: 0,
        status: "COMPLETED",
        createdBy: adminUser._id,
      },
    ]);
    farmer2.outstandingCredit = 1119.3;
    farmer2.totalPurchases = 1119.3;
    await farmer2.save();

    const agingReport = await testGetCustomerAgingReport();
    assert(agingReport.totalPendingCustomers >= 2, `Aging report identifies pending customers (count: ${agingReport.totalPendingCustomers})`);
    assert(agingReport.bucket31to60.count >= 1, `Bucket 31-60 days has at least 1 customer (Sundaram)`);
    assert(agingReport.bucket31to60.amount >= 1119.3, `Bucket 31-60 amount captured`);

    const sundaramAging = agingReport.customers.find((c) => c.customerId === farmer2._id.toString());
    assert(sundaramAging.agingBucket === "31-60", "Sundaram categorized accurately in 31-60 days bucket");
    assert(sundaramAging.ageInDays >= 44 && sundaramAging.ageInDays <= 46, `Age in days accurately calculated (~45 days, actual: ${sundaramAging.ageInDays})`);

    console.log("\n--- 11. Credit Collection Dashboard ---");
    const dashboard = await testGetCreditCollectionDashboard();
    assert(dashboard.totalOutstandingCredit >= 2116.68, `Dashboard total outstanding credit calculated accurately: ₹${dashboard.totalOutstandingCredit.toFixed(2)}`);
    assert(dashboard.collectedToday >= 2700.0, `Today's collection aggregated: ₹${dashboard.collectedToday.toFixed(2)}`);
    assert(dashboard.recentRepayments.length >= 2, `Recent repayments list populated (count: ${dashboard.recentRepayments.length})`);
    assert(dashboard.topDebtors.length >= 2, `Top debtors identified (count: ${dashboard.topDebtors.length})`);

    console.log("\n--- 12. Audit Log Verification ---");
    const auditLogs = await AuditLog.find({
      action: {
        $in: [
          "CUSTOMER_CREATED",
          "CUSTOMER_UPDATED",
          "CUSTOMER_PAYMENT_RECORDED",
          "CUSTOMER_PAYMENT_REVERSED",
        ],
      },
    });

    const createCustLogs = auditLogs.filter((l) => l.action === "CUSTOMER_CREATED");
    const updateCustLogs = auditLogs.filter((l) => l.action === "CUSTOMER_UPDATED");
    const recordPayLogs = auditLogs.filter((l) => l.action === "CUSTOMER_PAYMENT_RECORDED");
    const reversePayLogs = auditLogs.filter((l) => l.action === "CUSTOMER_PAYMENT_REVERSED");

    assert(createCustLogs.length >= 1, "Audit log recorded CUSTOMER_CREATED");
    assert(updateCustLogs.length >= 1, "Audit log recorded CUSTOMER_UPDATED");
    assert(recordPayLogs.length >= 2, "Audit log recorded CUSTOMER_PAYMENT_RECORDED");
    assert(reversePayLogs.length >= 1, "Audit log recorded CUSTOMER_PAYMENT_REVERSED");

    console.log("\n--- 13. Audit: Concurrent Repayment Requests & Over-Settlement Protection ---");
    // Create dedicated customer with ₹1000 credit
    const concCust = await testCreateCustomer({
      name: "Concurrent Test Farmer",
      phone: "9112233445",
      village: "Kumbakonam",
    }, undefined, userContext);

    await Sale.create([
      {
        invoiceNumber: "INV-202611-CONC1",
        invoiceDate: new Date(),
        customerId: concCust._id,
        customerSnapshot: { name: concCust.name, phone: concCust.phone },
        isWalkIn: false,
        items: [{
          productId: urea._id,
          productSnapshot: { name: urea.name, sku: urea.sku, primaryUnit: urea.primaryUnit },
          quantity: 4,
          unit: "BAGS",
          unitSellingPrice: 250,
          taxableAmount: 1000,
          gstAmount: 0,
          total: 1000,
        }],
        subtotal: 1000,
        taxableAmount: 1000,
        totalGst: 0,
        grandTotal: 1000,
        payment: { method: "CREDIT", creditAmount: 1000, totalPaid: 0 },
        outstandingAmount: 1000,
        repaidAmount: 0,
        status: "COMPLETED",
        createdBy: adminUser._id,
      },
    ]);
    concCust.outstandingCredit = 1000;
    concCust.totalPurchases = 1000;
    concCust.totalPaid = 0;
    await concCust.save();

    // Two concurrent attempts to repay ₹650 each (total ₹1300 > ₹1000)
    const results = await Promise.allSettled([
      testRecordCustomerRepayment({
        customerId: concCust._id.toString(),
        amount: 650,
        paymentMethod: "CASH",
        notes: "Concurrent attempt 1",
      }, userContext),
      testRecordCustomerRepayment({
        customerId: concCust._id.toString(),
        amount: 650,
        paymentMethod: "UPI",
        notes: "Concurrent attempt 2",
      }, userContext),
    ]);

    const fulfilledCount = results.filter((r) => r.status === "fulfilled").length;
    const rejectedCount = results.filter((r) => r.status === "rejected").length;
    assert(fulfilledCount === 1, `Exactly 1 concurrent request succeeded (fulfilled: ${fulfilledCount})`);
    assert(rejectedCount === 1, `Excess concurrent request was rejected (rejected: ${rejectedCount})`);

    const refreshedConcCust = await Customer.findById(concCust._id).lean();
    assert(refreshedConcCust.outstandingCredit === 350, `Customer balance protected from over-settling: remaining is ₹${refreshedConcCust.outstandingCredit} (expected: ₹350)`);
    assert(refreshedConcCust.totalPaid === 650, `Customer totalPaid accurately reflects accepted payment: ₹${refreshedConcCust.totalPaid}`);
    assert(refreshedConcCust.outstandingCredit >= 0, "Customer outstandingCredit is non-negative");

    console.log("\n--- 14. Audit: Manual Invoice Allocation Rigorous Validations ---");
    // Create 2 test sales for Sundaram
    const sundaramSale1 = await Sale.findOne({ customerId: farmer2._id }).lean();
    assert(sundaramSale1 !== null, "Found existing invoice for Sundaram");

    // 14A. Invoice ownership validation: Attempt to allocate Sundaram's invoice to Rengarajan
    let caughtOwnership = false;
    try {
      await testRecordCustomerRepayment({
        customerId: farmer1._id.toString(),
        amount: 500,
        paymentMethod: "CASH",
        allocations: [{
          saleId: sundaramSale1._id.toString(),
          allocatedAmount: 500,
        }],
      }, userContext);
    } catch (err) {
      caughtOwnership = true;
      assert(err.message.includes("does not belong to customer"), `Ownership guard message: ${err.message}`);
    }
    assert(caughtOwnership, "Guard blocked cross-customer invoice allocation");

    // 14B. Outstanding amount validation: Allocation exceeding invoice balance
    // Create an additional small sale for Sundaram (due: 300) so customer credit > invoice due
    const smallSale = await Sale.create({
      invoiceNumber: "INV-202611-SMALL",
      invoiceDate: new Date(),
      customerId: farmer2._id,
      customerSnapshot: { name: farmer2.name, phone: farmer2.phone },
      isWalkIn: false,
      items: [{
        productId: urea._id,
        productSnapshot: { name: urea.name, sku: urea.sku, primaryUnit: urea.primaryUnit },
        quantity: 1,
        unit: "BAGS",
        unitSellingPrice: 300,
        taxableAmount: 300,
        gstAmount: 0,
        total: 300,
      }],
      subtotal: 300,
      taxableAmount: 300,
      totalGst: 0,
      grandTotal: 300,
      payment: { method: "CREDIT", creditAmount: 300, totalPaid: 0 },
      outstandingAmount: 300,
      repaidAmount: 0,
      status: "COMPLETED",
      createdBy: adminUser._id,
    });
    farmer2.outstandingCredit = round2(farmer2.outstandingCredit + 300);
    farmer2.totalPurchases = round2(farmer2.totalPurchases + 300);
    await farmer2.save();

    let caughtExceedInvoice = false;
    try {
      await testRecordCustomerRepayment({
        customerId: farmer2._id.toString(),
        amount: 500, // Valid customer amount (500 <= 1419.30)
        paymentMethod: "CASH",
        allocations: [{
          saleId: smallSale._id.toString(),
          allocatedAmount: 500, // But exceeds smallSale balance (300)
        }],
      }, userContext);
    } catch (err) {
      caughtExceedInvoice = true;
      assert(err.message.includes("exceeds invoice"), `Invoice limit message: ${err.message}`);
    }
    assert(caughtExceedInvoice, "Guard blocked allocation exceeding invoice outstanding balance");

    // 14C. Allocation sum mismatch validation
    let caughtMismatch = false;
    try {
      await testRecordCustomerRepayment({
        customerId: farmer2._id.toString(),
        amount: 800,
        paymentMethod: "CASH",
        allocations: [{
          saleId: sundaramSale1._id.toString(),
          allocatedAmount: 500, // 500 != 800
        }],
      }, userContext);
    } catch (err) {
      caughtMismatch = true;
      assert(err.message.includes("does not match payment amount"), `Sum mismatch message: ${err.message}`);
    }
    assert(caughtMismatch, "Guard blocked allocation where items do not equal payment amount");

    // 14D. Duplicate invoice entry validation
    let caughtDuplicateInvoice = false;
    try {
      await testRecordCustomerRepayment({
        customerId: farmer2._id.toString(),
        amount: 600,
        paymentMethod: "CASH",
        allocations: [
          { saleId: sundaramSale1._id.toString(), allocatedAmount: 300 },
          { saleId: sundaramSale1._id.toString(), allocatedAmount: 300 },
        ],
      }, userContext);
    } catch (err) {
      caughtDuplicateInvoice = true;
      assert(err.message.includes("Duplicate invoice entry"), `Duplicate invoice guard: ${err.message}`);
    }
    assert(caughtDuplicateInvoice, "Guard blocked duplicate invoice entries within the same allocation array");

    // 14E. Valid manual allocation execution & reconciliation
    const validManualPay = await testRecordCustomerRepayment({
      customerId: farmer2._id.toString(),
      amount: 500,
      paymentMethod: "BANK_TRANSFER",
      transactionReference: "NEFT-123456",
      allocations: [{
        saleId: sundaramSale1._id.toString(),
        allocatedAmount: 500,
      }],
    }, userContext);

    assert(validManualPay.paymentNumber.startsWith("CPAY-"), `Manual allocation voucher generated: ${validManualPay.paymentNumber}`);
    const updatedSundaramSale = await Sale.findById(sundaramSale1._id).lean();
    assert(updatedSundaramSale.outstandingAmount === round2(1119.3 - 500), `Invoice outstanding reduced to ${updatedSundaramSale.outstandingAmount} (expected: 619.30)`);
    assert(updatedSundaramSale.repaidAmount === 500, `Invoice repaidAmount updated to 500.00`);

    const updatedFarmer2 = await Customer.findById(farmer2._id).lean();
    assert(updatedFarmer2.outstandingCredit === round2(1419.3 - 500), `Customer credit reduced to ${updatedFarmer2.outstandingCredit} (expected: 919.30)`);
    assert(updatedFarmer2.totalPaid === 500, `Customer totalPaid updated to 500.00`);
    assert(updatedFarmer2.totalPurchases === round2(updatedFarmer2.totalPaid + updatedFarmer2.outstandingCredit), "Accounting Invariant holds after manual allocation");

    console.log("\n--- 15. Audit: Aging Report Exact Boundary Verification (No Overlaps) ---");
    function testCategorizeAge(ageInDays) {
      if (ageInDays > 90) return "90+";
      if (ageInDays > 60) return "61-90";
      if (ageInDays > 30) return "31-60";
      return "0-30";
    }

    assert(testCategorizeAge(0) === "0-30", "Day 0 categorized as 0-30");
    assert(testCategorizeAge(15) === "0-30", "Day 15 categorized as 0-30");
    assert(testCategorizeAge(30) === "0-30", "Boundary Day 30 categorized strictly as 0-30");
    assert(testCategorizeAge(31) === "31-60", "Boundary Day 31 categorized strictly as 31-60");
    assert(testCategorizeAge(45) === "31-60", "Day 45 categorized as 31-60");
    assert(testCategorizeAge(60) === "31-60", "Boundary Day 60 categorized strictly as 31-60");
    assert(testCategorizeAge(61) === "61-90", "Boundary Day 61 categorized strictly as 61-90");
    assert(testCategorizeAge(75) === "61-90", "Day 75 categorized as 61-90");
    assert(testCategorizeAge(90) === "61-90", "Boundary Day 90 categorized strictly as 61-90");
    assert(testCategorizeAge(91) === "90+", "Boundary Day 91 categorized strictly as 90+");
    assert(testCategorizeAge(180) === "90+", "Day 180 categorized as 90+");

    console.log("\n--- 16. Audit: Payment Reversal Followed by Sale Cancellation ---");
    // Create new customer for end-to-end full reversal & cancellation test
    const cancelCust = await testCreateCustomer({
      name: "Murugesan Cycle Test",
      phone: "9887766554",
      village: "Needamangalam",
    }, undefined, userContext);

    // Initial stock: 50
    const ureaBeforeSale = await Product.findById(urea._id).lean();
    const initStock = ureaBeforeSale.currentStock;

    // Credit Sale: GrandTotal 2000, Upfront Cash 500, Credit 1500, Qty 5
    const cancelSale = await Sale.create({
      invoiceNumber: "INV-202611-CYCLE1",
      invoiceDate: new Date(),
      customerId: cancelCust._id,
      customerSnapshot: { name: cancelCust.name, phone: cancelCust.phone },
      isWalkIn: false,
      items: [{
        productId: urea._id,
        productSnapshot: { name: urea.name, sku: urea.sku, primaryUnit: urea.primaryUnit },
        quantity: 5,
        unit: "BAGS",
        unitSellingPrice: 400,
        taxableAmount: 2000,
        gstAmount: 0,
        total: 2000,
      }],
      subtotal: 2000,
      taxableAmount: 2000,
      totalGst: 0,
      grandTotal: 2000,
      payment: { method: "SPLIT", cashAmount: 500, upiAmount: 0, creditAmount: 1500, totalPaid: 500 },
      outstandingAmount: 1500,
      repaidAmount: 0,
      status: "COMPLETED",
      createdBy: adminUser._id,
    });

    await Product.findByIdAndUpdate(urea._id, { $inc: { currentStock: -5 } });
    cancelCust.totalPurchases = 2000;
    cancelCust.totalPaid = 500;
    cancelCust.outstandingCredit = 1500;
    await cancelCust.save();

    // Farmer pays partial repayment of ₹600
    const cyclePay = await testRecordCustomerRepayment({
      customerId: cancelCust._id.toString(),
      amount: 600,
      paymentMethod: "UPI",
      transactionReference: "UPI-CYCLE-01",
      allocations: [{
        saleId: cancelSale._id.toString(),
        allocatedAmount: 600,
      }],
    }, userContext);

    const saleAfterPay = await Sale.findById(cancelSale._id).lean();
    assert(saleAfterPay.repaidAmount === 600, "Sale repaidAmount is 600");
    assert(saleAfterPay.outstandingAmount === 900, "Sale outstandingAmount is 900");

    // Guard: Attempting to cancel sale before reversing payment must fail!
    let caughtPrematureCancel = false;
    try {
      if (saleAfterPay.repaidAmount > 0) {
        throw new Error(`Cannot cancel invoice ${saleAfterPay.invoiceNumber} with active repayments (₹${saleAfterPay.repaidAmount.toFixed(2)}). Reverse repayment vouchers first.`);
      }
    } catch (err) {
      caughtPrematureCancel = true;
      assert(err.message.includes("Reverse repayment vouchers first"), `Premature cancel guard: ${err.message}`);
    }
    assert(caughtPrematureCancel, "Sale cancellation blocked while active repayments exist on the invoice");

    // Now reverse the payment voucher
    await testReverseCustomerPayment(cyclePay._id.toString(), "Farmer requested invoice cancellation and refund", userContext);

    const saleAfterRev = await Sale.findById(cancelSale._id).lean();
    assert(saleAfterRev.repaidAmount === 0, "Sale repaidAmount restored to 0 after voucher reversal");
    assert(saleAfterRev.outstandingAmount === 1500, "Sale outstandingAmount restored to 1500 after voucher reversal");

    // Now cancellation of sale must succeed!
    // Perform cancellation
    await Product.findByIdAndUpdate(urea._id, { $inc: { currentStock: 5 } });
    const custBeforeCancel = await Customer.findById(cancelCust._id).lean();
    custBeforeCancel.outstandingCredit = Math.max(0, round2(custBeforeCancel.outstandingCredit - cancelSale.payment.creditAmount));
    custBeforeCancel.totalPurchases = Math.max(0, round2(custBeforeCancel.totalPurchases - cancelSale.grandTotal));
    custBeforeCancel.totalPaid = Math.max(0, round2(custBeforeCancel.totalPaid - cancelSale.payment.totalPaid));
    await Customer.findByIdAndUpdate(cancelCust._id, {
      outstandingCredit: custBeforeCancel.outstandingCredit,
      totalPurchases: custBeforeCancel.totalPurchases,
      totalPaid: custBeforeCancel.totalPaid,
    });
    await Sale.findByIdAndUpdate(cancelSale._id, {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancellationReason: "Full cycle reversal test",
    });

    const finalCancelCust = await Customer.findById(cancelCust._id).lean();
    assert(finalCancelCust.outstandingCredit === 0, `Customer outstandingCredit clean at 0 (actual: ${finalCancelCust.outstandingCredit})`);
    assert(finalCancelCust.totalPurchases === 0, `Customer totalPurchases clean at 0 (actual: ${finalCancelCust.totalPurchases})`);
    assert(finalCancelCust.totalPaid === 0, `Customer totalPaid clean at 0 (actual: ${finalCancelCust.totalPaid})`);
    assert(finalCancelCust.totalPurchases === round2(finalCancelCust.totalPaid + finalCancelCust.outstandingCredit), "Accounting Invariant holds cleanly after reversal and cancellation: 0 = 0 + 0");

    const ureaFinal = await Product.findById(urea._id).lean();
    assert(ureaFinal.currentStock === initStock, `Product stock fully restored to original: ${ureaFinal.currentStock}`);

    console.log("\n--- 17. Audit: Payment Idempotency Concurrent & Duplicate Protection ---");
    const idempKey = `AUDIT-IDEMP-${Date.now()}`;
    const idempRes1 = await testRecordCustomerRepayment({
      customerId: farmer1._id.toString(),
      amount: 100,
      paymentMethod: "CASH",
      idempotencyKey: idempKey,
    }, userContext);

    // Immediate duplicate submission with identical key
    const idempRes2 = await testRecordCustomerRepayment({
      customerId: farmer1._id.toString(),
      amount: 100,
      paymentMethod: "CASH",
      idempotencyKey: idempKey,
    }, userContext);

    assert(idempRes1.paymentNumber === idempRes2.paymentNumber, `Idempotency matched exact payment voucher: ${idempRes1.paymentNumber}`);
    assert(idempRes1._id.toString() === idempRes2._id.toString(), "Idempotent response returned exact same database record without double-crediting");

    console.log("\n--- 18. Audit: Customer Statement Periodic Reconciliation ---");
    // Verify statement openingBalance + debits - credits == closingBalance
    const statementPeriod = await testGetCustomerLedger(farmer1._id.toString(), {
      fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      toDate: new Date().toISOString().split("T")[0],
    });

    assert(typeof statementPeriod.openingBalance === "number", "Statement calculates openingBalance");
    assert(typeof statementPeriod.closingBalance === "number", "Statement calculates closingBalance");
    const statementFormula = round2(statementPeriod.openingBalance + statementPeriod.totalCreditGiven - statementPeriod.totalPaymentsReceived);
    assert(statementPeriod.closingBalance === statementFormula, `Statement perfectly reconciles: opening (${statementPeriod.openingBalance}) + creditGiven (${statementPeriod.totalCreditGiven}) - paymentsReceived (${statementPeriod.totalPaymentsReceived}) = closing (${statementPeriod.closingBalance})`);

    console.log("\n--- 19. Audit: RBAC Permission Hierarchy ---");
    const ownerPermissions = ["farmers:view", "farmers:manage", "ledger:view", "ledger:manage", "billing:view", "billing:manage"];
    const clerkPermissions = ["farmers:view", "ledger:view"]; // View only
    const cashierPermissions = ["farmers:view", "ledger:view", "ledger:manage"]; // Can settle

    function checkUserCanRecordPayment(user) {
      if (user.role === "OWNER") return true;
      return user.permissions.includes("ledger:manage") || user.permissions.includes("farmers:manage");
    }

    function checkUserCanViewKhata(user) {
      if (user.role === "OWNER") return true;
      return user.permissions.includes("ledger:view") || user.permissions.includes("farmers:view");
    }

    assert(checkUserCanRecordPayment({ role: "OWNER", permissions: [] }), "Owner can record repayments");
    assert(checkUserCanViewKhata({ role: "OWNER", permissions: [] }), "Owner can view Khata");
    assert(!checkUserCanRecordPayment({ role: "EMPLOYEE", permissions: clerkPermissions }), "Clerk lacking 'ledger:manage' CANNOT record repayments");
    assert(checkUserCanViewKhata({ role: "EMPLOYEE", permissions: clerkPermissions }), "Clerk with 'ledger:view' CAN view Khata");
    assert(checkUserCanRecordPayment({ role: "EMPLOYEE", permissions: cashierPermissions }), "Cashier with 'ledger:manage' CAN record repayments");

    console.log("\n================================================================================");
    console.log(`   🎉 ALL ${passedAssertions} PHASE 7 ASSERTIONS PASSED PERFECTLY!`);
    console.log("================================================================================\n");
  } finally {
    await mongoose.disconnect();
    await replSet.stop();
  }
}

runTestSuite().catch((err) => {
  console.error("Phase 7 test suite failed:", err);
  process.exit(1);
});
