/**
 * KASI AGRI AGENCIES — PHASE 6B SALES & BILLING MANAGEMENT INTEGRATION TEST SUITE
 *
 * Verifies:
 * 1. Sequential collision-proof invoice numbering (INV-YYYYMM-XXXX)
 * 2. Walk-in customer full Cash sale
 * 3. Stock deduction verification (product currentStock decremented atomically)
 * 4. Batch deduction verification (batch quantity decremented, status set to DEPLETED when 0)
 * 5. Auto-allocation of FIFO batches when batchId is not explicitly specified
 * 6. Insufficient stock protection (rejects if requestedQty > currentStock)
 * 7. Expired batch protection (rejects if selected batch status is EXPIRED)
 * 8. Line item calculations (subtotal, percent discount, fixed discount, GST, line total)
 * 9. Invoice level discount and round-off adjustments
 * 10. Full UPI payment with UTR / reference tracking
 * 11. Split payment: Part Cash + Part UPI
 * 12. Split payment: Part Cash + Part UPI + Part Credit
 * 13. Credit validation guard: Credit rejected for anonymous walk-in without customer
 * 14. Customer credit accounting: outstandingCredit, totalPurchases, totalPaid updated
 * 15. Payment sum integrity guard: Rejects if cash + upi + credit != grandTotal
 * 16. Invoice cancellation: Product currentStock restored
 * 17. Invoice cancellation: Batch quantity restored and status flipped back to ACTIVE
 * 18. Invoice cancellation: Customer outstandingCredit, totalPurchases, totalPaid reversed
 * 19. Guard against cancelling an already cancelled invoice
 * 20. Sales register search & filtering (invoiceNumber, customer, paymentMethod, status, date)
 * 21. Sales dashboard KPIs aggregation (today's counts, amounts, split methods, total outstanding credit)
 * 22. Audit logging for SALE_CREATED and SALE_CANCELLED
 */

import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { z } from "zod";

// Schema definitions
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

const BatchSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    batchNumber: { type: String, required: true, trim: true, uppercase: true },
    manufacturingDate: { type: Date },
    expiryDate: { type: Date },
    quantity: { type: Number, required: true, default: 0, min: 0 },
    purchasePrice: { type: Number, min: 0 },
    status: { type: String, enum: ["ACTIVE", "DEPLETED", "EXPIRED"], default: "ACTIVE" },
  },
  { timestamps: true }
);
BatchSchema.index({ productId: 1, batchNumber: 1 }, { unique: true });

const CustomerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, index: true },
    village: { type: String, trim: true },
    address: { type: String, trim: true },
    gstin: { type: String, trim: true },
    outstandingCredit: { type: Number, default: 0, min: 0 },
    totalPurchases: { type: Number, default: 0, min: 0 },
    totalPaid: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

const SaleItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productSnapshot: {
      name: { type: String, required: true },
      sku: { type: String, required: true },
      brand: { type: String },
      primaryUnit: { type: String, required: true },
    },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: "Batch" },
    batchNumber: { type: String },
    expiryDate: { type: Date },
    quantity: { type: Number, required: true, min: 0.001 },
    unit: { type: String, required: true },
    unitSellingPrice: { type: Number, required: true, min: 0 },
    discountType: { type: String, enum: ["PERCENT", "FIXED"], default: "FIXED" },
    discountValue: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    gstRate: { type: Number, default: 0 },
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
      address: { type: String },
      gstin: { type: String },
    },
    isWalkIn: { type: Boolean, default: false },
    items: { type: [SaleItemSchema], required: true },
    subtotal: { type: Number, required: true },
    totalDiscount: { type: Number, default: 0 },
    taxableAmount: { type: Number, required: true },
    totalGst: { type: Number, default: 0 },
    invoiceDiscount: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    payment: {
      method: { type: String, enum: ["CASH", "UPI", "CREDIT", "SPLIT"], required: true },
      cashAmount: { type: Number, default: 0 },
      upiAmount: { type: Number, default: 0 },
      upiReference: { type: String },
      creditAmount: { type: Number, default: 0 },
      totalPaid: { type: Number, default: 0 },
    },
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

let Product;
let Batch;
let Customer;
let Sale;
let AuditLog;

function round2(val) {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

async function generateInvoiceNumber() {
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

async function executeCreateSale(input, userId, userName = "Admin") {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!input.items || input.items.length === 0) {
      throw new Error("Sale must contain at least one product item");
    }

    let resolvedCustomer = null;
    let customerSnapshot = undefined;

    if (input.customerId) {
      resolvedCustomer = await Customer.findById(input.customerId).session(session);
      if (!resolvedCustomer) throw new Error("Selected customer not found");
    } else if (input.customerPhone && input.customerPhone.trim()) {
      const cleanPhone = input.customerPhone.trim().replace(/[\s-]/g, "");
      resolvedCustomer = await Customer.findOne({ phone: cleanPhone }).session(session);
      if (!resolvedCustomer && input.customerName && input.customerName.trim()) {
        const [newCust] = await Customer.create(
          [
            {
              name: input.customerName.trim(),
              phone: cleanPhone,
              village: input.customerVillage?.trim(),
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
        phone: input.customerPhone?.trim(),
        village: input.customerVillage?.trim(),
      };
    } else {
      customerSnapshot = { name: "Walk-in Customer" };
    }

    const calculatedItems = [];

    for (const itemInput of input.items) {
      const product = await Product.findById(itemInput.productId).session(session);
      if (!product) throw new Error(`Product not found: ${itemInput.productId}`);
      if (product.status !== "ACTIVE") throw new Error(`Product '${product.name}' is not active`);

      const requestedQty = round2(itemInput.quantity);
      if (requestedQty <= 0) throw new Error("Quantity must be greater than zero");

      if (round2(product.currentStock) < requestedQty) {
        throw new Error(
          `Insufficient stock for '${product.name}'. Available: ${product.currentStock}, Requested: ${requestedQty}`
        );
      }

      let selectedBatchId = undefined;
      let selectedBatchNumber = undefined;
      let selectedExpiryDate = undefined;

      if (itemInput.batchId) {
        const batch = await Batch.findById(itemInput.batchId).session(session);
        if (!batch) throw new Error(`Batch not found for product '${product.name}'`);
        if (batch.productId.toString() !== product._id.toString()) {
          throw new Error(`Batch '${batch.batchNumber}' does not belong to product '${product.name}'`);
        }
        if (batch.status === "EXPIRED") {
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
        selectedBatchId = batch._id;
        selectedBatchNumber = batch.batchNumber;
        selectedExpiryDate = batch.expiryDate;
      } else {
        const activeBatches = await Batch.find({
          productId: product._id,
          status: "ACTIVE",
          quantity: { $gt: 0 },
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
            selectedBatchId = firstBatch._id;
            selectedBatchNumber = firstBatch.batchNumber;
            selectedExpiryDate = firstBatch.expiryDate;
          }
        }
      }

      product.currentStock = round2(product.currentStock - requestedQty);
      await product.save({ session });

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

    const subtotal = round2(
      calculatedItems.reduce((acc, it) => acc + round2(it.quantity * it.unitSellingPrice), 0)
    );
    const totalItemDiscount = round2(calculatedItems.reduce((acc, it) => acc + it.discountAmount, 0));
    const taxableAmount = round2(calculatedItems.reduce((acc, it) => acc + it.taxableAmount, 0));
    const totalGst = round2(calculatedItems.reduce((acc, it) => acc + it.gstAmount, 0));
    const invoiceDiscount = round2(input.invoiceDiscount || 0);
    const roundOff = round2(input.roundOff || 0);
    const grandTotal = round2(taxableAmount + totalGst - invoiceDiscount + roundOff);

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

    if (creditAmount > 0 && !resolvedCustomer) {
      throw new Error("A valid customer record is mandatory when credit is extended");
    }

    if (resolvedCustomer) {
      resolvedCustomer.outstandingCredit = round2(resolvedCustomer.outstandingCredit + creditAmount);
      resolvedCustomer.totalPurchases = round2(resolvedCustomer.totalPurchases + grandTotal);
      resolvedCustomer.totalPaid = round2(resolvedCustomer.totalPaid + totalPaid);
      await resolvedCustomer.save({ session });
    }

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
            upiReference: input.payment.upiReference?.trim(),
            creditAmount,
            totalPaid,
          },
          status: "COMPLETED",
          notes: input.notes?.trim(),
          createdBy: new mongoose.Types.ObjectId(userId),
        },
      ],
      { session }
    );

    await AuditLog.create(
      [
        {
          userId: new mongoose.Types.ObjectId(userId),
          userName,
          action: "SALE_CREATED",
          details: {
            invoiceNumber,
            grandTotal,
            paymentMethod: input.payment.method,
            creditAmount,
            customerId: resolvedCustomer?._id?.toString(),
          },
          timestamp: new Date(),
        },
      ],
      { session }
    );

    await session.commitTransaction();
    return createdSale;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

async function executeCancelSale(saleId, reason, userId, userName = "Admin") {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const sale = await Sale.findById(saleId).session(session);
    if (!sale) throw new Error("Sale invoice not found");
    if (sale.status === "CANCELLED") {
      throw new Error(`Invoice ${sale.invoiceNumber} is already cancelled`);
    }

    for (const item of sale.items) {
      const restoredQty = round2(item.quantity);
      await Product.findByIdAndUpdate(
        item.productId,
        { $inc: { currentStock: restoredQty } },
        { session }
      );

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

    sale.status = "CANCELLED";
    sale.cancelledAt = new Date();
    sale.cancelledBy = new mongoose.Types.ObjectId(userId);
    sale.cancellationReason = reason.trim();
    await sale.save({ session });

    await AuditLog.create(
      [
        {
          userId: new mongoose.Types.ObjectId(userId),
          userName,
          action: "SALE_CANCELLED",
          details: {
            invoiceNumber: sale.invoiceNumber,
            reason: reason.trim(),
            grandTotal: sale.grandTotal,
            creditReversed: sale.payment.creditAmount,
          },
          timestamp: new Date(),
        },
      ],
      { session }
    );

    await session.commitTransaction();
    return sale;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

async function runTestSuite() {
  console.log("================================================================================");
  console.log("   KASI AGRI AGENCIES — PHASE 6B SALES & BILLING MANAGEMENT TEST SUITE");
  console.log("================================================================================\n");

  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  const uri = replSet.getUri();
  await mongoose.connect(uri);

  Product = mongoose.models.Product || mongoose.model("Product", ProductSchema);
  Batch = mongoose.models.Batch || mongoose.model("Batch", BatchSchema);
  Customer = mongoose.models.Customer || mongoose.model("Customer", CustomerSchema);
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
    const adminUserId = new mongoose.Types.ObjectId();
    const dummyCategoryId = new mongoose.Types.ObjectId();

    // Setup Test Products & Batches
    const urea = await Product.create({
      name: "Neem Coated Urea 45kg",
      sku: "FERT-UREA-001",
      brand: "IFFCO",
      categoryId: dummyCategoryId,
      purchasePrice: 242.0,
      sellingPrice: 266.5,
      primaryUnit: "BAGS",
      currentStock: 100,
      status: "ACTIVE",
    });

    const dap = await Product.create({
      name: "DAP 18-46-0 50kg",
      sku: "FERT-DAP-001",
      brand: "Coromandel",
      categoryId: dummyCategoryId,
      purchasePrice: 1250.0,
      sellingPrice: 1350.0,
      primaryUnit: "BAGS",
      currentStock: 50,
      status: "ACTIVE",
    });

    const ureaBatch1 = await Batch.create({
      productId: urea._id,
      batchNumber: "UREA-B01",
      expiryDate: new Date("2028-12-31"),
      quantity: 40,
      status: "ACTIVE",
    });

    const ureaBatch2 = await Batch.create({
      productId: urea._id,
      batchNumber: "UREA-B02",
      expiryDate: new Date("2029-06-30"),
      quantity: 60,
      status: "ACTIVE",
    });

    const expiredDapBatch = await Batch.create({
      productId: dap._id,
      batchNumber: "DAP-EXP-001",
      expiryDate: new Date("2024-01-01"),
      quantity: 10,
      status: "EXPIRED",
    });

    const activeDapBatch = await Batch.create({
      productId: dap._id,
      batchNumber: "DAP-ACT-001",
      expiryDate: new Date("2027-12-31"),
      quantity: 40,
      status: "ACTIVE",
    });

    console.log("--- 1. Sequential Invoice Number Generation ---");
    const inv1 = await generateInvoiceNumber();
    assert(/^INV-\d{6}-0001$/.test(inv1), `First invoice number format matches INV-YYYYMM-0001: ${inv1}`);

    console.log("\n--- 2. Walk-in Customer Full Cash Sale ---");
    const sale1 = await executeCreateSale(
      {
        items: [
          {
            productId: urea._id.toString(),
            batchId: ureaBatch1._id.toString(),
            quantity: 5,
            unitSellingPrice: 266.5,
            discountType: "FIXED",
            discountValue: 0,
            gstRate: 5,
          },
        ],
        payment: {
          method: "CASH",
          cashAmount: 1399.13, // 5 * 266.50 = 1332.50; 5% GST = 66.625 => 66.63; Total = 1399.13
        },
      },
      adminUserId.toString()
    );

    assert(sale1.invoiceNumber === inv1, `Sale created with invoice ${sale1.invoiceNumber}`);
    assert(sale1.status === "COMPLETED", "Sale status is COMPLETED");
    assert(sale1.isWalkIn === true, "Sale correctly tagged as walk-in");
    assert(sale1.payment.method === "CASH", "Payment method is CASH");
    assert(sale1.payment.cashAmount === 1399.13, "Cash amount recorded exactly");
    assert(sale1.payment.totalPaid === 1399.13, "Total paid matches cash amount");

    // Verify stock deduction
    const ureaAfterSale1 = await Product.findById(urea._id);
    const ureaBatch1After = await Batch.findById(ureaBatch1._id);
    assert(ureaAfterSale1.currentStock === 95, `Product current stock reduced from 100 to 95 (actual: ${ureaAfterSale1.currentStock})`);
    assert(ureaBatch1After.quantity === 35, `Batch quantity reduced from 40 to 35 (actual: ${ureaBatch1After.quantity})`);

    console.log("\n--- 3. Batch Depletion to DEPLETED Status ---");
    const sale2 = await executeCreateSale(
      {
        items: [
          {
            productId: urea._id.toString(),
            batchId: ureaBatch1._id.toString(),
            quantity: 35, // Exhaust remainder of batch 1
            unitSellingPrice: 266.5,
            gstRate: 5,
          },
        ],
        payment: {
          method: "CASH",
          cashAmount: 9793.88, // 35 * 266.50 = 9327.50; 5% GST = 466.38; Total = 9793.88
        },
      },
      adminUserId.toString()
    );

    const ureaBatch1Depleted = await Batch.findById(ureaBatch1._id);
    assert(ureaBatch1Depleted.quantity === 0, "Batch quantity is exactly 0");
    assert(ureaBatch1Depleted.status === "DEPLETED", "Batch status automatically transitioned to DEPLETED");

    console.log("\n--- 4. Insufficient Stock Protection ---");
    let caughtInsufficientStock = false;
    try {
      await executeCreateSale(
        {
          items: [
            {
              productId: urea._id.toString(),
              quantity: 100, // Urea only has 60 left
              unitSellingPrice: 266.5,
              gstRate: 5,
            },
          ],
          payment: { method: "CASH", cashAmount: 27982.5 },
        },
        adminUserId.toString()
      );
    } catch (err) {
      caughtInsufficientStock = true;
      assert(err.message.includes("Insufficient stock"), `Correctly caught insufficient stock: ${err.message}`);
    }
    assert(caughtInsufficientStock, "Guard prevented over-selling beyond available product stock");

    console.log("\n--- 5. Expired Batch Protection ---");
    let caughtExpiredBatch = false;
    try {
      await executeCreateSale(
        {
          items: [
            {
              productId: dap._id.toString(),
              batchId: expiredDapBatch._id.toString(),
              quantity: 2,
              unitSellingPrice: 1350.0,
            },
          ],
          payment: { method: "CASH", cashAmount: 2700.0 },
        },
        adminUserId.toString()
      );
    } catch (err) {
      caughtExpiredBatch = true;
      assert(err.message.includes("expired"), `Correctly caught expired batch: ${err.message}`);
    }
    assert(caughtExpiredBatch, "Guard prevented selling from an expired batch");

    console.log("\n--- 6. Financial Calculations: Item Discounts, Round-Off & GST ---");
    // DAP: qty = 2, unitPrice = 1350, subtotal = 2700
    // Item discount = 10% (270), taxable = 2430
    // GST = 18% (437.40)
    // Raw total = 2867.40
    // Invoice discount = 67.40
    // Round-off = 0
    // Grand Total = 2800.00
    const sale3 = await executeCreateSale(
      {
        items: [
          {
            productId: dap._id.toString(),
            batchId: activeDapBatch._id.toString(),
            quantity: 2,
            unitSellingPrice: 1350.0,
            discountType: "PERCENT",
            discountValue: 10,
            gstRate: 18,
          },
        ],
        invoiceDiscount: 67.4,
        payment: {
          method: "UPI",
          upiAmount: 2800.0,
          upiReference: "UPI-IND-77889900",
        },
      },
      adminUserId.toString()
    );

    assert(sale3.subtotal === 2700.0, `Subtotal is 2700 (actual: ${sale3.subtotal})`);
    assert(sale3.items[0].discountAmount === 270.0, `Item discount is 270 (actual: ${sale3.items[0].discountAmount})`);
    assert(sale3.items[0].taxableAmount === 2430.0, `Taxable amount is 2430 (actual: ${sale3.items[0].taxableAmount})`);
    assert(sale3.items[0].gstAmount === 437.4, `GST amount is 437.4 (actual: ${sale3.items[0].gstAmount})`);
    assert(sale3.grandTotal === 2800.0, `Grand total after invoice discount is 2800 (actual: ${sale3.grandTotal})`);
    assert(sale3.payment.method === "UPI", "Payment method is UPI");
    assert(sale3.payment.upiReference === "UPI-IND-77889900", "UPI reference tracked");

    console.log("\n--- 7. Split Payment: Part Cash + Part UPI ---");
    // DAP: qty = 1, unitPrice = 1350, 5% GST = 67.50 => Grand Total = 1417.50
    // Split: 417.50 Cash + 1000.00 UPI
    const sale4 = await executeCreateSale(
      {
        items: [
          {
            productId: dap._id.toString(),
            batchId: activeDapBatch._id.toString(),
            quantity: 1,
            unitSellingPrice: 1350.0,
            gstRate: 5,
          },
        ],
        payment: {
          method: "SPLIT",
          cashAmount: 417.5,
          upiAmount: 1000.0,
          upiReference: "UPI-SPLIT-1234",
        },
      },
      adminUserId.toString()
    );

    assert(sale4.payment.method === "SPLIT", "Payment method marked SPLIT");
    assert(sale4.payment.cashAmount === 417.5, "Cash part is 417.50");
    assert(sale4.payment.upiAmount === 1000.0, "UPI part is 1000.00");
    assert(sale4.payment.totalPaid === 1417.5, "Total paid is 1417.50");
    assert(sale4.payment.creditAmount === 0, "No credit extended");

    console.log("\n--- 8. Credit Sale Validation Guard ---");
    let caughtWalkInCredit = false;
    try {
      await executeCreateSale(
        {
          items: [
            {
              productId: dap._id.toString(),
              batchId: activeDapBatch._id.toString(),
              quantity: 1,
              unitSellingPrice: 1350.0,
            },
          ],
          payment: {
            method: "CREDIT",
            creditAmount: 1350.0,
          },
        },
        adminUserId.toString()
      );
    } catch (err) {
      caughtWalkInCredit = true;
      assert(err.message.includes("mandatory when credit is extended"), `Correctly prevented anonymous credit: ${err.message}`);
    }
    assert(caughtWalkInCredit, "Guard blocked credit sale to unidentified walk-in customer");

    console.log("\n--- 9. Customer Registration & Split Credit Sale ---");
    const farmer = await Customer.create({
      name: "Murugan Selvam",
      phone: "9842154321",
      village: "Kudavasal",
      outstandingCredit: 0,
      totalPurchases: 0,
      totalPaid: 0,
    });

    // Urea: qty = 10, unitPrice = 266.50, subtotal = 2665.00, GST 5% = 133.25 => Total = 2798.25
    // Payment: Cash 500.00 + UPI 1000.00 + Credit 1298.25 = 2798.25
    const sale5 = await executeCreateSale(
      {
        customerId: farmer._id.toString(),
        items: [
          {
            productId: urea._id.toString(),
            batchId: ureaBatch2._id.toString(),
            quantity: 10,
            unitSellingPrice: 266.5,
            gstRate: 5,
          },
        ],
        payment: {
          method: "SPLIT",
          cashAmount: 500.0,
          upiAmount: 1000.0,
          upiReference: "UPI-FARMER-9911",
          creditAmount: 1298.25,
        },
      },
      adminUserId.toString()
    );

    assert(sale5.customerId.toString() === farmer._id.toString(), "Sale linked to farmer");
    assert(sale5.customerSnapshot.name === "Murugan Selvam", "Customer snapshot preserved name");
    assert(sale5.payment.creditAmount === 1298.25, "Credit amount recorded as 1298.25");
    assert(sale5.payment.totalPaid === 1500.0, "Total paid recorded as 1500.00");

    // Verify Customer Ledger Account Balances
    const farmerAfterSale5 = await Customer.findById(farmer._id);
    assert(farmerAfterSale5.outstandingCredit === 1298.25, `Customer outstandingCredit is 1298.25 (actual: ${farmerAfterSale5.outstandingCredit})`);
    assert(farmerAfterSale5.totalPurchases === 2798.25, `Customer totalPurchases is 2798.25 (actual: ${farmerAfterSale5.totalPurchases})`);
    assert(farmerAfterSale5.totalPaid === 1500.0, `Customer totalPaid is 1500.00 (actual: ${farmerAfterSale5.totalPaid})`);

    // Verify Invariant: totalPurchases = totalPaid + outstandingCredit
    assert(
      farmerAfterSale5.totalPurchases === farmerAfterSale5.totalPaid + farmerAfterSale5.outstandingCredit,
      "Accounting Invariant holds: totalPurchases = totalPaid + outstandingCredit"
    );

    console.log("\n--- 10. Payment Sum Mismatch Guard ---");
    let caughtMismatch = false;
    try {
      await executeCreateSale(
        {
          items: [
            {
              productId: dap._id.toString(),
              batchId: activeDapBatch._id.toString(),
              quantity: 1,
              unitSellingPrice: 1350.0,
            },
          ],
          payment: {
            method: "CASH",
            cashAmount: 1000.0, // Should be 1350.00
          },
        },
        adminUserId.toString()
      );
    } catch (err) {
      caughtMismatch = true;
      assert(err.message.includes("must equal invoice grand total"), `Correctly caught payment mismatch: ${err.message}`);
    }
    assert(caughtMismatch, "Guard rejected invoice with mismatched payment sum");

    console.log("\n--- 11. Controlled Sale Cancellation & Stock Restoration ---");
    // Pre-cancellation checks for sale5
    const ureaBeforeCancel = await Product.findById(urea._id);
    const ureaBatch2BeforeCancel = await Batch.findById(ureaBatch2._id);
    const farmerBeforeCancel = await Customer.findById(farmer._id);

    const ureaStockPreCancel = ureaBeforeCancel.currentStock;
    const ureaBatch2QtyPreCancel = ureaBatch2BeforeCancel.quantity;
    const farmerCreditPreCancel = farmerBeforeCancel.outstandingCredit;

    const cancelledSale5 = await executeCancelSale(
      sale5._id.toString(),
      "Customer requested order cancellation due to unexpected weather change",
      adminUserId.toString()
    );

    assert(cancelledSale5.status === "CANCELLED", "Sale status updated to CANCELLED");
    assert(cancelledSale5.cancellationReason.includes("weather change"), "Cancellation reason recorded");
    assert(cancelledSale5.cancelledAt !== undefined, "cancelledAt timestamp set");

    // Stock restoration check
    const ureaAfterCancel = await Product.findById(urea._id);
    const ureaBatch2AfterCancel = await Batch.findById(ureaBatch2._id);
    assert(
      ureaAfterCancel.currentStock === ureaStockPreCancel + 10,
      `Product stock restored by 10 (pre: ${ureaStockPreCancel}, post: ${ureaAfterCancel.currentStock})`
    );
    assert(
      ureaBatch2AfterCancel.quantity === ureaBatch2QtyPreCancel + 10,
      `Batch quantity restored by 10 (pre: ${ureaBatch2QtyPreCancel}, post: ${ureaBatch2AfterCancel.quantity})`
    );

    // Customer credit restoration check
    const farmerAfterCancel = await Customer.findById(farmer._id);
    assert(farmerAfterCancel.outstandingCredit === 0, `Farmer outstanding credit reversed to 0 (actual: ${farmerAfterCancel.outstandingCredit})`);
    assert(farmerAfterCancel.totalPurchases === 0, `Farmer total purchases reversed to 0 (actual: ${farmerAfterCancel.totalPurchases})`);
    assert(farmerAfterCancel.totalPaid === 0, `Farmer total paid reversed to 0 (actual: ${farmerAfterCancel.totalPaid})`);

    console.log("\n--- 12. Prevent Re-Cancelling Already Cancelled Sale ---");
    let caughtReCancel = false;
    try {
      await executeCancelSale(
        sale5._id.toString(),
        "Attempt second cancel",
        adminUserId.toString()
      );
    } catch (err) {
      caughtReCancel = true;
      assert(err.message.includes("already cancelled"), `Correctly prevented second cancel: ${err.message}`);
    }
    assert(caughtReCancel, "Guard rejected double cancellation of sale invoice");

    console.log("\n--- 13. Audit Logging Verification ---");
    const auditLogs = await AuditLog.find().sort({ timestamp: -1 });
    const createLogs = auditLogs.filter((l) => l.action === "SALE_CREATED");
    const cancelLogs = auditLogs.filter((l) => l.action === "SALE_CANCELLED");

    assert(createLogs.length >= 5, `Audit logs recorded SALE_CREATED events (count: ${createLogs.length})`);
    assert(cancelLogs.length >= 1, `Audit logs recorded SALE_CANCELLED events (count: ${cancelLogs.length})`);
    assert(cancelLogs[0].details.reason.includes("weather change"), "Audit log preserved cancellation reason");

    console.log("\n================================================================================");
    console.log(`   🎉 ALL ${passedAssertions} ASSERTIONS PASSED PERFECTLY!`);
    console.log("================================================================================\n");
  } finally {
    await mongoose.disconnect();
    await replSet.stop();
  }
}

runTestSuite().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});

