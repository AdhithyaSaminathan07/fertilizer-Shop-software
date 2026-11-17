import mongoose from "mongoose";
import { Sale, ISaleDocument } from "@/models/sale";
import { Product } from "@/models/product";
import { Batch } from "@/models/batch";
import { Customer } from "@/models/customer";
import { AuditLog } from "@/models/audit-log";
import { ISaleCreateInput, ISalesFilterParams, ISalesDashboardKPIs } from "@/types/sale";

/**
 * High-precision two-decimal rounding (half-up)
 */
export function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Generates sequential collision-proof invoice number (INV-YYYYMM-XXXX)
 */
export async function generateInvoiceNumber(): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `INV-${yearMonth}-`;

  const lastSale = await Sale.findOne(
    { invoiceNumber: { $regex: `^${prefix}` } },
    { invoiceNumber: 1 }
  ).sort({ invoiceNumber: -1 });

  let seq = 1;
  if (lastSale && lastSale.invoiceNumber) {
    const parts = lastSale.invoiceNumber.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      seq = lastSeq + 1;
    }
  }

  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/**
 * Create a new sale with atomic stock deduction, customer credit accounting, and split payment
 */
export async function createSale(
  input: ISaleCreateInput,
  userId: string,
  userName?: string
): Promise<ISaleDocument> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!input.items || input.items.length === 0) {
      throw new Error("Sale must contain at least one product item");
    }

    // 1. Resolve Customer if provided or if credit is extended
    let resolvedCustomer: any = null;
    let customerSnapshot: any = undefined;

    if (input.customerId && mongoose.Types.ObjectId.isValid(input.customerId)) {
      resolvedCustomer = await Customer.findById(input.customerId).session(session);
      if (!resolvedCustomer) {
        throw new Error("Selected customer not found");
      }
    } else if (input.customerPhone && input.customerPhone.trim()) {
      const cleanPhone = input.customerPhone.trim().replace(/[\s-]/g, "");
      resolvedCustomer = await Customer.findOne({ phone: cleanPhone }).session(session);
      if (!resolvedCustomer && input.customerName && input.customerName.trim()) {
        const [newCust] = await Customer.create(
          [
            {
              name: input.customerName.trim(),
              phone: cleanPhone,
              village: input.customerVillage?.trim() || undefined,
              outstandingCredit: 0,
              totalPurchases: 0,
              totalPaid: 0,
              status: "ACTIVE",
            },
          ],
          { session }
        );
        resolvedCustomer = newCust;
      }
    }

    if (resolvedCustomer) {
      customerSnapshot = {
        name: resolvedCustomer.name,
        phone: resolvedCustomer.phone,
        village: resolvedCustomer.village,
        address: resolvedCustomer.address,
        gstin: resolvedCustomer.gstin,
      };
    } else if (input.customerName && input.customerName.trim()) {
      customerSnapshot = {
        name: input.customerName.trim(),
        phone: input.customerPhone?.trim() || undefined,
        village: input.customerVillage?.trim() || undefined,
      };
    } else {
      customerSnapshot = {
        name: "Walk-in Customer",
      };
    }

    // 2. Validate line items, prices, batches, and deduct stock
    const calculatedItems: any[] = [];

    for (const itemInput of input.items) {
      if (!mongoose.Types.ObjectId.isValid(itemInput.productId)) {
        throw new Error(`Invalid product ID: ${itemInput.productId}`);
      }

      const product = await Product.findById(itemInput.productId).session(session);
      if (!product) {
        throw new Error(`Product not found: ${itemInput.productId}`);
      }

      if (product.status !== "ACTIVE") {
        throw new Error(`Product '${product.name}' is not active`);
      }

      const requestedQty = round2(itemInput.quantity);
      if (requestedQty <= 0) {
        throw new Error(`Quantity for '${product.name}' must be greater than zero`);
      }

      if (round2(product.currentStock) < requestedQty) {
        throw new Error(
          `Insufficient stock for '${product.name}'. Available: ${product.currentStock}, Requested: ${requestedQty}`
        );
      }

      let selectedBatchId: mongoose.Types.ObjectId | undefined = undefined;
      let selectedBatchNumber: string | undefined = undefined;
      let selectedExpiryDate: Date | undefined = undefined;

      // Handle batch deduction
      if (itemInput.batchId && mongoose.Types.ObjectId.isValid(itemInput.batchId)) {
        const batch = await Batch.findById(itemInput.batchId).session(session);
        if (!batch) {
          throw new Error(`Batch not found for product '${product.name}'`);
        }
        if (batch.productId.toString() !== product._id.toString()) {
          throw new Error(`Batch '${batch.batchNumber}' does not belong to product '${product.name}'`);
        }
        if (batch.status === "EXPIRED" || (batch.expiryDate && new Date(batch.expiryDate) < new Date())) {
          throw new Error(`Batch '${batch.batchNumber}' has expired`);
        }
        if (round2(batch.quantity) < requestedQty) {
          throw new Error(
            `Insufficient batch stock for '${product.name}' (Batch: ${batch.batchNumber}). Available: ${batch.quantity}, Requested: ${requestedQty}`
          );
        }

        batch.quantity = round2(batch.quantity - requestedQty);
        if (batch.quantity <= 0.0001) {
          batch.quantity = 0;
          batch.status = "DEPLETED";
        }
        await batch.save({ session });

        selectedBatchId = batch._id as mongoose.Types.ObjectId;
        selectedBatchNumber = batch.batchNumber;
        selectedExpiryDate = batch.expiryDate;
      } else {
        // Auto-allocate batch if product has active batches (FEFO: earliest valid expiry date first, excluding expired batches)
        const now = new Date();
        const activeBatches = await Batch.find({
          productId: product._id,
          status: "ACTIVE",
          quantity: { $gt: 0 },
          $or: [
            { expiryDate: { $exists: false } },
            { expiryDate: null },
            { expiryDate: { $gte: now } },
          ],
        })
          .sort({ expiryDate: 1, createdAt: 1 })
          .session(session);

        if (activeBatches.length > 0) {
          const firstBatch = activeBatches[0];
          if (round2(firstBatch.quantity) >= requestedQty) {
            firstBatch.quantity = round2(firstBatch.quantity - requestedQty);
            if (firstBatch.quantity <= 0.0001) {
              firstBatch.quantity = 0;
              firstBatch.status = "DEPLETED";
            }
            await firstBatch.save({ session });
            selectedBatchId = firstBatch._id as mongoose.Types.ObjectId;
            selectedBatchNumber = firstBatch.batchNumber;
            selectedExpiryDate = firstBatch.expiryDate;
          }
        }
      }

      // Atomically decrement product stock
      product.currentStock = round2(product.currentStock - requestedQty);
      await product.save({ session });

      // Financial line item calculations
      const unitSellingPrice = round2(itemInput.unitSellingPrice);
      const lineSubtotal = round2(requestedQty * unitSellingPrice);

      let discountAmount = 0;
      const discountType = itemInput.discountType || "FIXED";
      const discountVal = round2(itemInput.discountValue || 0);

      if (discountType === "PERCENT") {
        discountAmount = round2((lineSubtotal * discountVal) / 100);
      } else {
        discountAmount = discountVal;
      }
      discountAmount = Math.min(discountAmount, lineSubtotal);

      const taxableAmount = round2(lineSubtotal - discountAmount);
      const gstRate = round2(itemInput.gstRate || 0);
      const gstAmount = round2((taxableAmount * gstRate) / 100);
      const lineTotal = round2(taxableAmount + gstAmount);

      calculatedItems.push({
        productId: product._id,
        productSnapshot: {
          name: product.name,
          sku: product.sku,
          brand: product.brand,
          primaryUnit: product.primaryUnit,
        },
        batchId: selectedBatchId,
        batchNumber: selectedBatchNumber,
        expiryDate: selectedExpiryDate,
        quantity: requestedQty,
        unit: itemInput.unit || product.primaryUnit,
        unitSellingPrice,
        discountType,
        discountValue: discountVal,
        discountAmount,
        gstRate,
        taxableAmount,
        gstAmount,
        total: lineTotal,
      });
    }

    // 3. Invoice Level Calculations
    const subtotal = round2(
      calculatedItems.reduce((acc, it) => acc + round2(it.quantity * it.unitSellingPrice), 0)
    );
    const totalItemDiscount = round2(calculatedItems.reduce((acc, it) => acc + it.discountAmount, 0));
    const taxableAmount = round2(calculatedItems.reduce((acc, it) => acc + it.taxableAmount, 0));
    const totalGst = round2(calculatedItems.reduce((acc, it) => acc + it.gstAmount, 0));
    const invoiceDiscount = round2(input.invoiceDiscount || 0);
    const roundOff = round2(input.roundOff || 0);
    const grandTotal = round2(taxableAmount + totalGst - invoiceDiscount + roundOff);

    // 4. Split Payment Validation
    const cashAmount = round2(input.payment.cashAmount || 0);
    const upiAmount = round2(input.payment.upiAmount || 0);
    const creditAmount = round2(input.payment.creditAmount || 0);
    const totalPaid = round2(cashAmount + upiAmount);
    const totalPaymentAllocated = round2(cashAmount + upiAmount + creditAmount);

    if (Math.abs(totalPaymentAllocated - grandTotal) > 0.01) {
      throw new Error(
        `Payment breakdown sum (₹${totalPaymentAllocated.toFixed(2)}) must equal invoice grand total (₹${grandTotal.toFixed(2)})`
      );
    }

    // If credit is extended, customer MUST be identified
    if (creditAmount > 0) {
      if (!resolvedCustomer) {
        throw new Error("A valid customer record is mandatory when credit is extended");
      }
    }

    // 5. Update Customer financial balances if customer exists
    if (resolvedCustomer) {
      resolvedCustomer.outstandingCredit = round2(resolvedCustomer.outstandingCredit + creditAmount);
      resolvedCustomer.totalPurchases = round2(resolvedCustomer.totalPurchases + grandTotal);
      resolvedCustomer.totalPaid = round2(resolvedCustomer.totalPaid + totalPaid);
      await resolvedCustomer.save({ session });
    }

    // 6. Generate Invoice Number & Create Sale Document
    const invoiceNumber = await generateInvoiceNumber();
    const isWalkIn = input.isWalkIn ?? (!resolvedCustomer && creditAmount === 0);

    const [createdSale] = await Sale.create(
      [
        {
          invoiceNumber,
          invoiceDate: new Date(),
          customerId: resolvedCustomer?._id,
          customerSnapshot,
          isWalkIn,
          items: calculatedItems,
          subtotal,
          totalDiscount: round2(totalItemDiscount + invoiceDiscount),
          taxableAmount,
          totalGst,
          invoiceDiscount,
          roundOff,
          grandTotal,
          payment: {
            method: input.payment.method,
            cashAmount,
            upiAmount,
            upiReference: input.payment.upiReference?.trim() || undefined,
            creditAmount,
            totalPaid,
          },
          outstandingAmount: creditAmount,
          repaidAmount: 0,
          status: "COMPLETED",
          notes: input.notes?.trim() || undefined,
          createdBy: new mongoose.Types.ObjectId(userId),
        },
      ],
      { session }
    );

    // 7. Audit Log
    await AuditLog.create(
      [
        {
          userId: new mongoose.Types.ObjectId(userId),
          userName: userName || "Staff",
          action: "SALE_CREATED",
          details: {
            invoiceNumber,
            grandTotal,
            paymentMethod: input.payment.method,
            creditAmount,
            customerId: resolvedCustomer?._id?.toString(),
            customerName: customerSnapshot.name,
          },
          timestamp: new Date(),
        },
      ],
      { session }
    );

    await session.commitTransaction();
    return createdSale;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Cancel an invoice: safely restores inventory batches, product stock, and reverses customer credit
 */
export async function cancelSale(
  saleId: string,
  reason: string,
  userId: string,
  userName?: string
): Promise<ISaleDocument> {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!mongoose.Types.ObjectId.isValid(saleId)) {
      throw new Error("Invalid sale ID");
    }

    const sale = await Sale.findById(saleId).session(session);
    if (!sale) {
      throw new Error("Sale invoice not found");
    }

    if (sale.status === "CANCELLED") {
      throw new Error(`Invoice ${sale.invoiceNumber} is already cancelled`);
    }

    if (sale.repaidAmount && sale.repaidAmount > 0) {
      throw new Error(
        `Cannot cancel invoice ${sale.invoiceNumber} with active repayments (₹${sale.repaidAmount.toFixed(2)}). Reverse repayment vouchers first.`
      );
    }

    // 1. Restore product stock and batches atomically
    for (const item of sale.items) {
      const restoredQty = round2(item.quantity);

      // Restore product current stock
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { currentStock: restoredQty } },
        { session }
      );

      // Restore batch stock if applicable
      if (item.batchId) {
        const batch = await Batch.findById(item.batchId).session(session);
        if (batch) {
          batch.quantity = round2(batch.quantity + restoredQty);
          if (batch.status === "DEPLETED" && batch.quantity > 0) {
            batch.status = "ACTIVE";
          }
          await batch.save({ session });
        }
      }
    }

    // 2. Reverse customer credit and balances
    if (sale.customerId) {
      const customer = await Customer.findById(sale.customerId).session(session);
      if (customer) {
        customer.outstandingCredit = Math.max(
          0,
          round2(customer.outstandingCredit - sale.payment.creditAmount)
        );
        customer.totalPurchases = Math.max(
          0,
          round2(customer.totalPurchases - sale.grandTotal)
        );
        customer.totalPaid = Math.max(
          0,
          round2(customer.totalPaid - sale.payment.totalPaid)
        );
        await customer.save({ session });
      }
    }

    // 3. Mark sale as CANCELLED
    sale.status = "CANCELLED";
    sale.cancelledAt = new Date();
    sale.cancelledBy = new mongoose.Types.ObjectId(userId);
    sale.cancellationReason = reason.trim();
    await sale.save({ session });

    // 4. Record Audit Log
    await AuditLog.create(
      [
        {
          userId: new mongoose.Types.ObjectId(userId),
          userName: userName || "Staff",
          action: "SALE_CANCELLED",
          details: {
            invoiceNumber: sale.invoiceNumber,
            reason: reason.trim(),
            grandTotal: sale.grandTotal,
            creditReversed: sale.payment.creditAmount,
            customerId: sale.customerId?.toString(),
          },
          timestamp: new Date(),
        },
      ],
      { session }
    );

    await session.commitTransaction();
    return sale;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Get sale by ID with populated references
 */
export async function getSaleById(saleId: string) {
  if (!mongoose.Types.ObjectId.isValid(saleId)) {
    return null;
  }

  return Sale.findById(saleId)
    .populate("customerId")
    .populate("createdBy", "name username role")
    .populate("cancelledBy", "name username role")
    .lean();
}

/**
 * Filtered, paginated sales register
 */
export async function getSales(params: ISalesFilterParams) {
  const {
    search,
    customerId,
    paymentMethod,
    status,
    fromDate,
    toDate,
    page = 1,
    limit = 20,
  } = params;

  const filter: any = {};

  if (search && search.trim()) {
    const term = search.trim();
    filter.$or = [
      { invoiceNumber: { $regex: term, $options: "i" } },
      { "customerSnapshot.name": { $regex: term, $options: "i" } },
      { "customerSnapshot.phone": { $regex: term, $options: "i" } },
      { "payment.upiReference": { $regex: term, $options: "i" } },
    ];
  }

  if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
    filter.customerId = new mongoose.Types.ObjectId(customerId);
  }

  if (paymentMethod && paymentMethod !== "ALL") {
    filter["payment.method"] = paymentMethod;
  }

  if (status && status !== "ALL") {
    filter.status = status;
  }

  if (fromDate || toDate) {
    filter.invoiceDate = {};
    if (fromDate) {
      filter.invoiceDate.$gte = new Date(fromDate);
    }
    if (toDate) {
      const end = new Date(toDate);
      end.setHours(23, 59, 59, 999);
      filter.invoiceDate.$lte = end;
    }
  }

  const skip = (page - 1) * limit;

  const [sales, total] = await Promise.all([
    Sale.find(filter)
      .sort({ invoiceDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("customerId", "name phone village")
      .populate("createdBy", "name username")
      .lean(),
    Sale.countDocuments(filter),
  ]);

  return {
    sales,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

/**
 * Sales Dashboard KPIs (Today's statistics & overall credit)
 */
export async function getSalesDashboardKPIs(): Promise<ISalesDashboardKPIs> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const [todayAgg, creditAgg] = await Promise.all([
    Sale.aggregate([
      {
        $match: {
          invoiceDate: { $gte: startOfDay, $lte: endOfDay },
          status: "COMPLETED",
        },
      },
      {
        $group: {
          _id: null,
          todaySalesCount: { $sum: 1 },
          todaySalesAmount: { $sum: "$grandTotal" },
          todayCashAmount: { $sum: "$payment.cashAmount" },
          todayUpiAmount: { $sum: "$payment.upiAmount" },
          todayCreditAmount: { $sum: "$payment.creditAmount" },
        },
      },
    ]),
    Customer.aggregate([
      {
        $group: {
          _id: null,
          totalOutstandingCredit: { $sum: "$outstandingCredit" },
        },
      },
    ]),
  ]);

  const todayStats = todayAgg[0] || {
    todaySalesCount: 0,
    todaySalesAmount: 0,
    todayCashAmount: 0,
    todayUpiAmount: 0,
    todayCreditAmount: 0,
  };

  const totalOutstandingCredit = creditAgg[0]?.totalOutstandingCredit || 0;

  return {
    todaySalesCount: todayStats.todaySalesCount || 0,
    todaySalesAmount: round2(todayStats.todaySalesAmount || 0),
    todayCashAmount: round2(todayStats.todayCashAmount || 0),
    todayUpiAmount: round2(todayStats.todayUpiAmount || 0),
    todayCreditAmount: round2(todayStats.todayCreditAmount || 0),
    totalOutstandingCredit: round2(totalOutstandingCredit),
  };
}

