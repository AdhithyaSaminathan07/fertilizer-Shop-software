import mongoose from "mongoose";
import { Customer, ICustomerDocument } from "@/models/customer";
import { CustomerPayment, ICustomerPaymentDocument } from "@/models/customer-payment";
import { Sale } from "@/models/sale";
import { AuditLog } from "@/models/audit-log";
import { getShopSettings } from "@/services/settings.service";
import {
  ICustomerInput,
  CustomerStatus,
  ICustomerRepaymentInput,
  IKhataLedger,
  IKhataLedgerEntry,
  ICustomerAgingSummary,
  ICustomerAgingItem,
  AgingBucket,
  ICreditCollectionDashboard,
  ICustomerStatement,
} from "@/types/customer";

export function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Sequential customer repayment voucher number (CPAY-YYYYMM-XXXX)
 */
export async function generateCustomerPaymentNumber(): Promise<string> {
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

/**
 * Create a new customer profile
 */
export async function createCustomer(
  input: ICustomerInput,
  session?: mongoose.ClientSession,
  userContext?: { id: string; name: string }
): Promise<ICustomerDocument> {
  const cleanPhone = input.phone.trim().replace(/[\s-]/g, "");

  // Check if customer with phone already exists
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
    status: (input.status || "ACTIVE") as CustomerStatus,
  };

  let created: ICustomerDocument;
  if (session) {
    const results = await Customer.create([customerData], { session });
    created = results[0] as ICustomerDocument;
  } else {
    created = (await Customer.create(customerData)) as ICustomerDocument;
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

/**
 * Update an existing customer profile
 */
export async function updateCustomer(
  id: string,
  input: Partial<ICustomerInput>,
  userContext?: { id: string; name: string }
): Promise<ICustomerDocument | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  const existingCustomer = await Customer.findById(id);
  if (!existingCustomer) {
    return null;
  }

  const update: any = {};
  if (input.name !== undefined) update.name = input.name.trim();
  if (input.phone !== undefined) {
    const cleanPhone = input.phone.trim().replace(/[\s-]/g, "");
    if (cleanPhone !== existingCustomer.phone) {
      const duplicate = await Customer.findOne({ phone: cleanPhone, _id: { $ne: id } });
      if (duplicate) {
        throw new Error(`Another customer with phone ${cleanPhone} already exists`);
      }
      update.phone = cleanPhone;
    }
  }
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

/**
 * Filtered, paginated customer listing with summary metrics
 */
export async function getCustomers(params: {
  search?: string;
  status?: string;
  hasCredit?: boolean;
  page?: number;
  limit?: number;
}) {
  const { search, status, hasCredit, page = 1, limit = 20 } = params;
  const filter: any = {};

  if (search && search.trim()) {
    const term = search.trim();
    filter.$or = [
      { name: { $regex: term, $options: "i" } },
      { phone: { $regex: term, $options: "i" } },
      { village: { $regex: term, $options: "i" } },
    ];
  }

  if (status && status !== "ALL") {
    filter.status = status;
  }

  if (hasCredit === true) {
    filter.outstandingCredit = { $gt: 0 };
  }

  const skip = (page - 1) * limit;

  const [customers, total, statsAgg] = await Promise.all([
    Customer.find(filter)
      .sort({ outstandingCredit: -1, name: 1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Customer.countDocuments(filter),
    Customer.aggregate([
      {
        $group: {
          _id: null,
          totalCustomers: { $sum: 1 },
          activeCustomers: {
            $sum: { $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0] },
          },
          totalOutstandingCredit: { $sum: "$outstandingCredit" },
          customersWithCredit: {
            $sum: { $cond: [{ $gt: ["$outstandingCredit", 0] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  const stats = statsAgg[0] || {
    totalCustomers: 0,
    activeCustomers: 0,
    totalOutstandingCredit: 0,
    customersWithCredit: 0,
  };

  return {
    customers,
    summary: {
      totalCustomers: stats.totalCustomers,
      activeCustomers: stats.activeCustomers,
      totalOutstandingCredit: round2(stats.totalOutstandingCredit || 0),
      customersWithCredit: stats.customersWithCredit,
    },
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

/**
 * Autocomplete search for POS and forms
 */
export async function searchCustomers(term: string, limit = 10) {
  if (!term || !term.trim()) {
    return Customer.find({ status: "ACTIVE" })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();
  }

  const trimmed = term.trim();
  return Customer.find({
    status: "ACTIVE",
    $or: [
      { name: { $regex: trimmed, $options: "i" } },
      { phone: { $regex: trimmed, $options: "i" } },
      { village: { $regex: trimmed, $options: "i" } },
    ],
  })
    .sort({ outstandingCredit: -1, name: 1 })
    .limit(limit)
    .lean();
}

export async function getCustomerById(id: string): Promise<ICustomerDocument | null> {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }
  return Customer.findById(id);
}

/**
 * Detailed profile with aggregate activity counts
 */
export async function getCustomerProfile(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  const customer = await Customer.findById(id).lean();
  if (!customer) return null;

  const [totalInvoicesCount, unpaidInvoicesCount, paymentsCount, lastSale, lastPayment] =
    await Promise.all([
      Sale.countDocuments({ customerId: id, status: "COMPLETED" }),
      Sale.countDocuments({
        customerId: id,
        status: "COMPLETED",
        outstandingAmount: { $gt: 0 },
      }),
      CustomerPayment.countDocuments({ customerId: id, status: "RECORDED" }),
      Sale.findOne({ customerId: id, status: "COMPLETED" })
        .sort({ invoiceDate: -1 })
        .select("invoiceNumber invoiceDate grandTotal")
        .lean(),
      CustomerPayment.findOne({ customerId: id, status: "RECORDED" })
        .sort({ paymentDate: -1 })
        .select("paymentNumber paymentDate amount")
        .lean(),
    ]);

  return {
    ...customer,
    totalInvoicesCount,
    unpaidInvoicesCount,
    paymentsCount,
    lastSale: lastSale
      ? {
          invoiceNumber: lastSale.invoiceNumber,
          date: lastSale.invoiceDate,
          amount: lastSale.grandTotal,
        }
      : null,
    lastPayment: lastPayment
      ? {
          paymentNumber: lastPayment.paymentNumber,
          date: lastPayment.paymentDate,
          amount: lastPayment.amount,
        }
      : null,
  };
}

/**
 * Record a full or partial customer credit repayment with FIFO or explicit invoice allocations
 */
export async function recordCustomerRepayment(
  input: ICustomerRepaymentInput,
  userContext: { id: string; name: string }
): Promise<ICustomerPaymentDocument> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!mongoose.Types.ObjectId.isValid(input.customerId)) {
      throw new Error("Invalid customer ID");
    }

    // Idempotency guard: prevent duplicate payment submissions
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

    const recordedAllocations: Array<{
      saleId: mongoose.Types.ObjectId;
      invoiceNumber: string;
      invoiceDate: Date;
      allocatedAmount: number;
    }> = [];

    // 1. Process Invoice Allocations
    if (input.allocations && input.allocations.length > 0) {
      const sumAllocated = round2(
        input.allocations.reduce((acc, a) => acc + round2(a.allocatedAmount), 0)
      );
      if (Math.abs(sumAllocated - paymentAmount) > 0.01) {
        throw new Error(
          `Allocation sum (₹${sumAllocated.toFixed(2)}) does not match payment amount (₹${paymentAmount.toFixed(2)})`
        );
      }

      const seenSaleIds = new Set<string>();
      for (const alloc of input.allocations) {
        if (!mongoose.Types.ObjectId.isValid(alloc.saleId)) {
          throw new Error(`Invalid sale ID in allocation: ${alloc.saleId}`);
        }
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
        if (!sale) {
          throw new Error(`Invoice not found for allocation: ${alloc.saleId}`);
        }
        if (sale.customerId?.toString() !== customer._id.toString()) {
          throw new Error(
            `Invoice ${sale.invoiceNumber} does not belong to customer ${customer.name}`
          );
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
          {
            _id: sale._id,
            outstandingAmount: { $gte: allocAmt },
          },
          {
            $set: {
              outstandingAmount: newOutstanding,
              repaidAmount: newRepaid,
            },
          },
          { session, returnDocument: "after" }
        );

        if (!updatedSale) {
          throw new Error(
            `Allocated amount (₹${allocAmt.toFixed(2)}) exceeds invoice ${sale.invoiceNumber} current outstanding balance`
          );
        }

        recordedAllocations.push({
          saleId: sale._id as mongoose.Types.ObjectId,
          invoiceNumber: sale.invoiceNumber,
          invoiceDate: sale.invoiceDate,
          allocatedAmount: allocAmt,
        });
      }
    } else {
      // Automatic FIFO Allocation across oldest outstanding invoices
      const unpaidSales = await Sale.find({
        customerId: customer._id,
        status: "COMPLETED",
        $or: [
          { outstandingAmount: { $gt: 0 } },
          { outstandingAmount: { $exists: false }, "payment.creditAmount": { $gt: 0 } },
        ],
      })
        .sort({ invoiceDate: 1, createdAt: 1 })
        .session(session);

      let remainingToAllocate = paymentAmount;

      for (const sale of unpaidSales) {
        if (remainingToAllocate <= 0) break;

        const invoiceDue = round2(sale.outstandingAmount ?? (sale.payment?.creditAmount || 0));
        if (invoiceDue <= 0) continue;

        const allocAmt = Math.min(remainingToAllocate, invoiceDue);

        sale.outstandingAmount = round2(invoiceDue - allocAmt);
        sale.repaidAmount = round2((sale.repaidAmount || 0) + allocAmt);
        await sale.save({ session });

        recordedAllocations.push({
          saleId: sale._id as mongoose.Types.ObjectId,
          invoiceNumber: sale.invoiceNumber,
          invoiceDate: sale.invoiceDate,
          allocatedAmount: allocAmt,
        });

        remainingToAllocate = round2(remainingToAllocate - allocAmt);
      }
    }

    // 2. Atomically update Customer balances with over-settlement guard
    const newCustOutstanding = round2(customer.outstandingCredit - paymentAmount);
    const newCustTotalPaid = round2(customer.totalPaid + paymentAmount);

    const updatedCustomer = await Customer.findOneAndUpdate(
      {
        _id: customer._id,
        outstandingCredit: { $gte: paymentAmount },
      },
      {
        $set: {
          outstandingCredit: newCustOutstanding,
          totalPaid: newCustTotalPaid,
        },
      },
      { session, returnDocument: "after" }
    );

    if (!updatedCustomer) {
      throw new Error(
        `Payment amount (₹${paymentAmount.toFixed(2)}) exceeds customer's eligible outstanding credit`
      );
    }

    // 3. Generate sequential payment number & create CustomerPayment
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

    // 4. Audit Log
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
  } catch (error: any) {
    await session.abortTransaction();
    if (error?.code === 11000 && input.idempotencyKey && input.idempotencyKey.trim()) {
      const existing = await CustomerPayment.findOne({
        idempotencyKey: input.idempotencyKey.trim(),
      });
      if (existing) {
        return existing;
      }
    }
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Safely reverse a customer repayment voucher and restore invoice/customer outstanding balances
 */
export async function reverseCustomerPayment(
  paymentId: string,
  reason: string,
  userContext: { id: string; name: string }
): Promise<ICustomerPaymentDocument> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!mongoose.Types.ObjectId.isValid(paymentId)) {
      throw new Error("Invalid payment voucher ID");
    }

    if (!reason || reason.trim().length < 3) {
      throw new Error("A valid reversal reason of at least 3 characters is required");
    }

    // Atomically transition status from RECORDED to REVERSED
    const payment = await CustomerPayment.findOneAndUpdate(
      {
        _id: paymentId,
        status: "RECORDED",
      },
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
    if (!customer) {
      throw new Error("Customer record linked to this payment was not found");
    }

    // 1. Restore invoice allocations
    for (const alloc of payment.allocations) {
      const sale = await Sale.findById(alloc.saleId).session(session);
      if (sale) {
        sale.outstandingAmount = round2(
          (sale.outstandingAmount || 0) + alloc.allocatedAmount
        );
        sale.repaidAmount = Math.max(0, round2((sale.repaidAmount || 0) - alloc.allocatedAmount));
        await sale.save({ session });
      }
    }

    // 2. Restore customer balances
    customer.outstandingCredit = round2(customer.outstandingCredit + payment.amount);
    customer.totalPaid = Math.max(0, round2(customer.totalPaid - payment.amount));
    await customer.save({ session });

    // 4. Audit Log
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
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Customer Khata / Ledger with accurate running balance and opening balance
 */
export async function getCustomerLedger(
  customerId: string,
  dateRange?: { fromDate?: string; toDate?: string }
): Promise<IKhataLedger> {
  if (!mongoose.Types.ObjectId.isValid(customerId)) {
    throw new Error("Invalid customer ID");
  }

  const customer = await Customer.findById(customerId).lean();
  if (!customer) {
    throw new Error("Customer not found");
  }

  const fromDate = dateRange?.fromDate ? new Date(dateRange.fromDate) : undefined;
  let toDate = dateRange?.toDate ? new Date(dateRange.toDate) : undefined;
  if (toDate) {
    toDate.setHours(23, 59, 59, 999);
  }

  // 1. Calculate opening balance if fromDate is provided
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

  // 2. Fetch sales and payments within period
  const salesFilter: any = {
    customerId,
    status: "COMPLETED",
    "payment.creditAmount": { $gt: 0 },
  };
  const paymentsFilter: any = {
    customerId,
  };

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
    Sale.find(salesFilter)
      .sort({ invoiceDate: 1, createdAt: 1 })
      .select("invoiceNumber invoiceDate payment notes grandTotal outstandingAmount")
      .lean(),
    CustomerPayment.find(paymentsFilter)
      .sort({ paymentDate: 1, createdAt: 1 })
      .select("paymentNumber paymentDate amount paymentMethod transactionReference notes status reversal")
      .lean(),
  ]);

  // 3. Build unified chronological entries
  const rawEntries: Array<{
    id: string;
    date: Date;
    type: "CREDIT_SALE" | "REPAYMENT";
    label: "Credit Given" | "Payment Received";
    reference: string;
    relatedId: string;
    paymentMethod?: string;
    transactionReference?: string;
    debitAmount: number;
    creditAmount: number;
    notes?: string;
    status?: string;
  }> = [];

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

  // Sort chronological ascending
  rawEntries.sort((a, b) => a.date.getTime() - b.date.getTime());

  // Compute running balance
  let running = openingBalance;
  let totalCreditGiven = 0;
  let totalPaymentsReceived = 0;

  const transactions: IKhataLedgerEntry[] = rawEntries.map((e) => {
    running = round2(running + e.debitAmount - e.creditAmount);
    totalCreditGiven = round2(totalCreditGiven + e.debitAmount);
    totalPaymentsReceived = round2(totalPaymentsReceived + e.creditAmount);

    return {
      id: e.id,
      date: e.date,
      type: e.type,
      label: e.label,
      reference: e.reference,
      relatedId: e.relatedId,
      paymentMethod: e.paymentMethod,
      transactionReference: e.transactionReference,
      debitAmount: e.debitAmount,
      creditAmount: e.creditAmount,
      runningBalance: running,
      notes: e.notes,
      status: e.status,
    };
  });

  return {
    customer: {
      ...customer,
      _id: customer._id.toString(),
    },
    openingBalance,
    transactions,
    totalCreditGiven,
    totalPaymentsReceived,
    closingBalance: running,
  };
}

/**
 * Customer Aging Report (0-30, 31-60, 61-90, 90+ days)
 */
export async function getCustomerAgingReport(params: {
  search?: string;
  bucket?: string;
  page?: number;
  limit?: number;
}): Promise<ICustomerAgingSummary & { pagination: { page: number; limit: number; total: number; pages: number } }> {
  const { search, bucket = "ALL", page = 1, limit = 20 } = params;
  const now = Date.now();

  // Find all customers with outstanding credit
  const query: any = {
    outstandingCredit: { $gt: 0 },
  };

  if (search && search.trim()) {
    const term = search.trim();
    query.$or = [
      { name: { $regex: term, $options: "i" } },
      { phone: { $regex: term, $options: "i" } },
      { village: { $regex: term, $options: "i" } },
    ];
  }

  const customers = await Customer.find(query)
    .sort({ outstandingCredit: -1 })
    .lean();

  const agingItems: ICustomerAgingItem[] = [];

  let sum0to30 = 0;
  let count0to30 = 0;
  let sum31to60 = 0;
  let count31to60 = 0;
  let sum61to90 = 0;
  let count61to90 = 0;
  let sum90Plus = 0;
  let count90Plus = 0;
  let totalOutstanding = 0;

  for (const c of customers) {
    const customerDue = round2(c.outstandingCredit);
    totalOutstanding = round2(totalOutstanding + customerDue);

    // Fetch unpaid invoices and last payment for customer
    const [unpaidSales, lastPayment] = await Promise.all([
      Sale.find({
        customerId: c._id,
        status: "COMPLETED",
        $or: [
          { outstandingAmount: { $gt: 0 } },
          { outstandingAmount: { $exists: false }, "payment.creditAmount": { $gt: 0 } },
        ],
      })
        .sort({ invoiceDate: 1 })
        .select("invoiceNumber invoiceDate outstandingAmount payment.creditAmount")
        .lean(),
      CustomerPayment.findOne({
        customerId: c._id,
        status: "RECORDED",
      })
        .sort({ paymentDate: -1 })
        .select("paymentDate amount")
        .lean(),
    ]);

    const oldestInvoice = unpaidSales[0];
    const oldestDate = oldestInvoice ? new Date(oldestInvoice.invoiceDate) : new Date(c.createdAt);
    const ageInDays = Math.max(0, Math.floor((now - oldestDate.getTime()) / (1000 * 60 * 60 * 24)));

    let agingBucket: AgingBucket = "0-30";
    if (ageInDays > 90) {
      agingBucket = "90+";
      sum90Plus = round2(sum90Plus + customerDue);
      count90Plus++;
    } else if (ageInDays > 60) {
      agingBucket = "61-90";
      sum61to90 = round2(sum61to90 + customerDue);
      count61to90++;
    } else if (ageInDays > 30) {
      agingBucket = "31-60";
      sum31to60 = round2(sum31to60 + customerDue);
      count31to60++;
    } else {
      agingBucket = "0-30";
      sum0to30 = round2(sum0to30 + customerDue);
      count0to30++;
    }

    agingItems.push({
      customerId: c._id.toString(),
      customerName: c.name,
      phone: c.phone,
      village: c.village,
      outstandingBalance: customerDue,
      unpaidInvoicesCount: unpaidSales.length,
      oldestUnpaidInvoiceDate: oldestInvoice?.invoiceDate,
      oldestUnpaidInvoiceNumber: oldestInvoice?.invoiceNumber,
      lastPaymentDate: lastPayment?.paymentDate,
      lastPaymentAmount: lastPayment?.amount,
      ageInDays,
      agingBucket,
    });
  }

  // Filter by bucket if specified
  const filtered =
    bucket && bucket !== "ALL"
      ? agingItems.filter((item) => item.agingBucket === bucket)
      : agingItems;

  const totalFiltered = filtered.length;
  const skip = (page - 1) * limit;
  const paginated = filtered.slice(skip, skip + limit);

  return {
    totalOutstanding: round2(totalOutstanding),
    totalPendingCustomers: customers.length,
    bucket0to30: { count: count0to30, amount: round2(sum0to30) },
    bucket31to60: { count: count31to60, amount: round2(sum31to60) },
    bucket61to90: { count: count61to90, amount: round2(sum61to90) },
    bucket90Plus: { count: count90Plus, amount: round2(sum90Plus) },
    customers: paginated,
    pagination: {
      page,
      limit,
      total: totalFiltered,
      pages: Math.ceil(totalFiltered / limit),
    },
  };
}

/**
 * Credit Collection Dashboard Metrics
 */
export async function getCreditCollectionDashboard(): Promise<ICreditCollectionDashboard> {
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
      getCustomerAgingReport({ limit: 10 }),
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

/**
 * Customer Statement with Shop Profile Header
 */
export async function getCustomerStatement(
  customerId: string,
  params?: { fromDate?: string; toDate?: string }
): Promise<ICustomerStatement> {
  const [ledger, settings] = await Promise.all([
    getCustomerLedger(customerId, params),
    getShopSettings(),
  ]);

  return {
    shop: settings.businessProfile,
    customer: ledger.customer,
    fromDate: params?.fromDate,
    toDate: params?.toDate,
    openingBalance: ledger.openingBalance,
    transactions: ledger.transactions,
    totalCreditGiven: ledger.totalCreditGiven,
    totalPaymentsReceived: ledger.totalPaymentsReceived,
    closingBalance: ledger.closingBalance,
  };
}

/**
 * Paginated Customer Payments Register
 */
export async function getCustomerPayments(params: {
  customerId?: string;
  paymentMethod?: string;
  status?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}) {
  const { customerId, paymentMethod, status, fromDate, toDate, page = 1, limit = 20 } = params;
  const filter: any = {};

  if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
    filter.customerId = new mongoose.Types.ObjectId(customerId);
  }

  if (paymentMethod && paymentMethod !== "ALL") {
    filter.paymentMethod = paymentMethod;
  }

  if (status && status !== "ALL") {
    filter.status = status;
  }

  if (fromDate || toDate) {
    filter.paymentDate = {};
    if (fromDate) filter.paymentDate.$gte = new Date(fromDate);
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      filter.paymentDate.$lte = end;
    }
  }

  const skip = (page - 1) * limit;

  const [payments, total] = await Promise.all([
    CustomerPayment.find(filter)
      .sort({ paymentDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CustomerPayment.countDocuments(filter),
  ]);

  return {
    payments,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

/**
 * Single payment voucher details
 */
export async function getCustomerPaymentById(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return null;
  }

  return CustomerPayment.findById(id)
    .populate("customerId")
    .populate("allocations.saleId", "invoiceNumber invoiceDate grandTotal")
    .populate("createdById", "name username role")
    .populate("reversal.reversedById", "name username role")
    .lean();
}
