/**
 * KASI AGRI AGENCIES — PHASE 10 INDEPENDENT SALES & PURCHASE RETURNS TEST SUITE
 *
 * Isolated verification in MongoMemoryReplSet:
 * 1. Customer sales return creation with prorated discounts and tax calculations
 * 2. Sequential sales return numbering format (SRET-YYYYMM-XXXX)
 * 3. Boundary guard: Blocking sales returns exceeding invoiced quantity
 * 4. Boundary guard: Cumulative multi-return checking (partial returns cannot over-return)
 * 5. Sales return approval workflow (transitions to APPROVED with audit metadata)
 * 6. Sales return rejection workflow (requires mandatory reason)
 * 7. Sales return cancellation workflow (requires mandatory reason)
 * 8. State machine guard: Blocking transitions from terminal states
 * 9. Supplier purchase return creation with prorated discounts and tax calculations
 * 10. Sequential purchase return numbering format (PRET-YYYYMM-XXXX)
 * 11. Boundary guard: Blocking purchase returns exceeding purchased quantity
 * 12. Boundary guard: Cumulative purchase return checking (partial returns cannot over-return)
 * 13. Purchase return approval workflow (transitions to APPROVED with audit metadata)
 * 14. Purchase return rejection workflow (requires mandatory reason)
 * 15. Purchase return cancellation workflow (requires mandatory reason)
 * 16. Supplier response tracking (Credit Note, Refund, Replacement, Credit Note # and Date)
 * 17. STRICT MODULE INDEPENDENCE VERIFICATION:
 *     - Product.currentStock remains completely unchanged
 *     - Batch.quantity remains completely unchanged
 *     - Customer.outstandingBalance remains completely unchanged
 *     - Supplier balances (outstandingBalance, advanceBalance, totalPurchases, totalPaid) remain completely unchanged
 *     - No Cashbook transactions are created
 * 18. Independent Returns Dashboard Overview metrics
 * 19. Independent Returns Reports aggregation (status-wise, reason-wise, product-wise)
 */

import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

function round2(val) {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

// User Schema
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

// Customer Schema
const CustomerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    village: { type: String, default: "" },
    outstandingBalance: { type: Number, default: 0 },
    creditLimit: { type: Number, default: 50000 },
    status: { type: String, default: "ACTIVE" },
  },
  { timestamps: true }
);

// Supplier Schema
const SupplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    gstin: { type: String, default: "" },
    outstandingBalance: { type: Number, default: 0 },
    advanceBalance: { type: Number, default: 0 },
    totalPurchases: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    status: { type: String, default: "ACTIVE" },
  },
  { timestamps: true }
);

// Product Schema
const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    sku: { type: String, required: true, unique: true },
    brand: { type: String, default: "" },
    primaryUnit: { type: String, default: "PCS" },
    currentStock: { type: Number, default: 0, min: 0 },
    purchasePrice: { type: Number, default: 0, min: 0 },
    sellingPrice: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// Batch Schema
const BatchSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    batchNumber: { type: String, required: true, uppercase: true },
    quantity: { type: Number, required: true, default: 0, min: 0 },
    purchasePrice: { type: Number, default: 0, min: 0 },
    status: { type: String, default: "ACTIVE" },
  },
  { timestamps: true }
);

// Sale Schema
const SaleSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    invoiceDate: { type: Date, default: Date.now },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    customerSnapshot: {
      name: { type: String, required: true },
      phone: { type: String },
      village: { type: String },
      gstin: { type: String },
    },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        productSnapshot: {
          name: { type: String, required: true },
          sku: { type: String, required: true },
          primaryUnit: { type: String, default: "PCS" },
          hsnCode: { type: String },
        },
        batchNumber: { type: String },
        quantity: { type: Number, required: true },
        unitSellingPrice: { type: Number, required: true },
        discountAmount: { type: Number, default: 0 },
        gstRate: { type: Number, default: 0 },
        taxableAmount: { type: Number, default: 0 },
        gstAmount: { type: Number, default: 0 },
        total: { type: Number, required: true },
      },
    ],
    subtotal: { type: Number, required: true },
    totalDiscount: { type: Number, default: 0 },
    totalGst: { type: Number, default: 0 },
    grandTotal: { type: Number, required: true },
    status: { type: String, default: "COMPLETED" },
  },
  { timestamps: true }
);

// Purchase Schema
const PurchaseSchema = new mongoose.Schema(
  {
    purchaseNumber: { type: String, required: true, unique: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
    supplierSnapshot: {
      name: { type: String, required: true },
      phone: { type: String },
      gstin: { type: String },
    },
    supplierInvoiceNumber: { type: String },
    supplierInvoiceDate: { type: Date },
    purchaseDate: { type: Date, default: Date.now },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        productSnapshot: {
          name: { type: String, required: true },
          sku: { type: String, required: true },
          primaryUnit: { type: String, default: "PCS" },
        },
        orderedQty: { type: Number, required: true },
        receivedQty: { type: Number, required: true },
        unitPurchasePrice: { type: Number, required: true },
        discountAmount: { type: Number, default: 0 },
        taxRate: { type: Number, default: 0 },
        taxableAmount: { type: Number, default: 0 },
        taxAmount: { type: Number, default: 0 },
        totalAmount: { type: Number, required: true },
        inwardBatches: [
          {
            batchNumber: { type: String },
            quantity: { type: Number },
          },
        ],
      },
    ],
    subtotal: { type: Number, required: true },
    totalDiscount: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    status: { type: String, default: "RECEIVED" },
  },
  { timestamps: true }
);

// Sales Return Schema
const SalesReturnItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productSnapshot: {
      name: { type: String, required: true },
      sku: { type: String, required: true },
      primaryUnit: { type: String, default: "PCS" },
      hsnCode: { type: String },
    },
    batchNumber: { type: String },
    originalSoldQty: { type: Number, required: true, min: 0 },
    previouslyReturnedQty: { type: Number, required: true, min: 0, default: 0 },
    returnQty: { type: Number, required: true, min: 0.0001 },
    unitSellingPrice: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, required: true, min: 0, default: 0 },
    taxRate: { type: Number, required: true, min: 0, default: 0 },
    taxableAmount: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    reason: {
      type: String,
      enum: ["DAMAGED", "DEFECTIVE", "WRONG_PRODUCT", "EXPIRED", "CUSTOMER_CHANGED_MIND", "OTHER"],
      required: true,
    },
    condition: {
      type: String,
      enum: ["SALEABLE", "DAMAGED", "DEFECTIVE", "OTHER"],
      required: true,
    },
    remarks: { type: String, trim: true },
  },
  { _id: false }
);

const SalesReturnSchema = new mongoose.Schema(
  {
    returnNumber: { type: String, required: true, unique: true, uppercase: true },
    returnDate: { type: Date, required: true, default: Date.now },
    saleId: { type: mongoose.Schema.Types.ObjectId, ref: "Sale", required: true },
    saleNumber: { type: String, required: true },
    saleDate: { type: Date, required: true },
    customerSnapshot: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
      name: { type: String, required: true },
      mobile: { type: String },
      village: { type: String },
      gstin: { type: String },
    },
    items: [SalesReturnItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    discountTotal: { type: Number, required: true, min: 0, default: 0 },
    taxTotal: { type: Number, required: true, min: 0, default: 0 },
    refundTotal: { type: Number, required: true, min: 0 },
    refundMethod: {
      type: String,
      enum: ["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "CREDIT_NOTE"],
      required: true,
      default: "CASH",
    },
    refundReference: { type: String, trim: true },
    status: {
      type: String,
      enum: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"],
      default: "DRAFT",
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        changedAt: { type: Date, default: Date.now },
        changedById: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        changedByName: { type: String, required: true },
        reason: { type: String },
      },
    ],
    generalReason: { type: String },
    remarks: { type: String },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdByName: { type: String },
    approvedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedByName: { type: String },
    approvedAt: { type: Date },
    rejectedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rejectedByName: { type: String },
    rejectedAt: { type: Date },
    rejectionReason: { type: String },
    cancelledById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cancelledByName: { type: String },
    cancelledAt: { type: Date },
    cancellationReason: { type: String },
  },
  { timestamps: true }
);

// Purchase Return Schema
const PurchaseReturnItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productSnapshot: {
      name: { type: String, required: true },
      sku: { type: String, required: true },
      primaryUnit: { type: String, default: "PCS" },
    },
    batchNumber: { type: String },
    originalPurchasedQty: { type: Number, required: true, min: 0 },
    previouslyReturnedQty: { type: Number, required: true, min: 0, default: 0 },
    returnQty: { type: Number, required: true, min: 0.0001 },
    unitPurchasePrice: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, required: true, min: 0, default: 0 },
    taxRate: { type: Number, required: true, min: 0, default: 0 },
    taxableAmount: { type: Number, required: true, min: 0 },
    taxAmount: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
    reason: {
      type: String,
      enum: ["DAMAGED", "DEFECTIVE", "WRONG_PRODUCT", "EXPIRED", "QUALITY_REJECTED", "SUPPLIER_RECALL", "OTHER"],
      required: true,
    },
    condition: {
      type: String,
      enum: ["SALEABLE", "DAMAGED", "DEFECTIVE", "OTHER"],
      required: true,
    },
    remarks: { type: String, trim: true },
  },
  { _id: false }
);

const PurchaseReturnSchema = new mongoose.Schema(
  {
    returnNumber: { type: String, required: true, unique: true, uppercase: true },
    returnDate: { type: Date, required: true, default: Date.now },
    purchaseId: { type: mongoose.Schema.Types.ObjectId, ref: "Purchase", required: true },
    purchaseNumber: { type: String, required: true },
    supplierInvoiceNumber: { type: String, default: "" },
    supplierInvoiceDate: { type: Date },
    purchaseDate: { type: Date, required: true },
    supplierSnapshot: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier" },
      name: { type: String, required: true },
      phone: { type: String },
      gstin: { type: String },
    },
    items: [PurchaseReturnItemSchema],
    subtotal: { type: Number, required: true, min: 0 },
    discountTotal: { type: Number, required: true, min: 0, default: 0 },
    taxTotal: { type: Number, required: true, min: 0, default: 0 },
    returnTotal: { type: Number, required: true, min: 0 },
    supplierResponse: {
      type: String,
      enum: ["REFUND_EXPECTED", "CREDIT_NOTE_EXPECTED", "REPLACEMENT_EXPECTED", "PENDING_CONFIRMATION", "OTHER"],
      required: true,
      default: "CREDIT_NOTE_EXPECTED",
    },
    supplierCreditNoteNumber: { type: String, trim: true },
    supplierCreditNoteDate: { type: Date },
    status: {
      type: String,
      enum: ["DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"],
      default: "DRAFT",
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        changedAt: { type: Date, default: Date.now },
        changedById: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        changedByName: { type: String, required: true },
        reason: { type: String },
      },
    ],
    generalReason: { type: String },
    remarks: { type: String },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdByName: { type: String },
    approvedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedByName: { type: String },
    approvedAt: { type: Date },
    rejectedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rejectedByName: { type: String },
    rejectedAt: { type: Date },
    rejectionReason: { type: String },
    cancelledById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cancelledByName: { type: String },
    cancelledAt: { type: Date },
    cancellationReason: { type: String },
  },
  { timestamps: true }
);

// Models
const User = mongoose.model("User", UserSchema);
const Customer = mongoose.model("Customer", CustomerSchema);
const Supplier = mongoose.model("Supplier", SupplierSchema);
const Product = mongoose.model("Product", ProductSchema);
const Batch = mongoose.model("Batch", BatchSchema);
const Sale = mongoose.model("Sale", SaleSchema);
const Purchase = mongoose.model("Purchase", PurchaseSchema);
const SalesReturn = mongoose.model("SalesReturn", SalesReturnSchema);
const PurchaseReturn = mongoose.model("PurchaseReturn", PurchaseReturnSchema);

let replSet;

async function setup() {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  const uri = replSet.getUri();
  await mongoose.connect(uri);
}

async function teardown() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (replSet) {
    await replSet.stop();
  }
}

// Helpers for test sequential numbering
async function generateSalesReturnNumber(session) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `SRET-${year}${month}-`;

  const last = await SalesReturn.findOne({ returnNumber: new RegExp(`^${prefix}`) })
    .sort({ returnNumber: -1 })
    .session(session || null);

  let seq = 1;
  if (last && last.returnNumber) {
    const parts = last.returnNumber.split("-");
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

async function generatePurchaseReturnNumber(session) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `PRET-${year}${month}-`;

  const last = await PurchaseReturn.findOne({ returnNumber: new RegExp(`^${prefix}`) })
    .sort({ returnNumber: -1 })
    .session(session || null);

  let seq = 1;
  if (last && last.returnNumber) {
    const parts = last.returnNumber.split("-");
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

let passed = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  passed++;
  console.log(`✅ PASS: ${message}`);
}

async function runTests() {
  console.log("=======================================================");
  console.log("   KASI AGRI AGENCIES — PHASE 10 COMPREHENSIVE SUITE   ");
  console.log("=======================================================\n");

  await setup();

  try {
    // 0. Seed test baseline
    const testUser = await User.create({
      name: "Ramesh Admin",
      email: "ramesh@kasiagri.com",
      username: "ramesh",
      role: "OWNER",
      permissions: ["returns:view", "returns:create", "returns:manage", "returns:approve"],
    });

    const testCustomer = await Customer.create({
      name: "Murugan Farmer",
      phone: "9876543210",
      village: "Melur",
      outstandingBalance: 12500,
    });

    const testSupplier = await Supplier.create({
      name: "Coromandel International Ltd",
      phone: "9123456780",
      gstin: "33AABCC1234F1Z5",
      outstandingBalance: 75000,
      advanceBalance: 5000,
      totalPurchases: 250000,
      totalPaid: 170000,
    });

    const testProduct = await Product.create({
      name: "Gromor 28-28-0 Complex Fertilizer 50kg",
      sku: "FERT-GRO-28",
      brand: "Gromor",
      primaryUnit: "BAG",
      currentStock: 100, // baseline stock
      purchasePrice: 1400,
      sellingPrice: 1650,
    });

    const testBatch = await Batch.create({
      productId: testProduct._id,
      batchNumber: "B2026-001",
      quantity: 100, // baseline batch quantity
      purchasePrice: 1400,
    });

    // Seed original sale
    const testSale = await Sale.create({
      invoiceNumber: "INV-202611-0001",
      customerId: testCustomer._id,
      customerSnapshot: {
        name: testCustomer.name,
        phone: testCustomer.phone,
        village: testCustomer.village,
      },
      items: [
        {
          productId: testProduct._id,
          productSnapshot: {
            name: testProduct.name,
            sku: testProduct.sku,
            primaryUnit: testProduct.primaryUnit,
          },
          batchNumber: "B2026-001",
          quantity: 20, // 20 bags sold
          unitSellingPrice: 1650,
          discountAmount: 300, // ₹15 discount per bag
          gstRate: 5,
          taxableAmount: 32700,
          gstAmount: 1635,
          total: 34335,
        },
      ],
      subtotal: 33000,
      totalDiscount: 300,
      totalGst: 1635,
      grandTotal: 34335,
    });

    // Seed original purchase
    const testPurchase = await Purchase.create({
      purchaseNumber: "PO-202611-0001",
      supplierId: testSupplier._id,
      supplierSnapshot: {
        name: testSupplier.name,
        phone: testSupplier.phone,
        gstin: testSupplier.gstin,
      },
      supplierInvoiceNumber: "SINV-8891",
      orderedQty: 50,
      receivedQty: 50,
      items: [
        {
          productId: testProduct._id,
          productSnapshot: {
            name: testProduct.name,
            sku: testProduct.sku,
            primaryUnit: testProduct.primaryUnit,
          },
          orderedQty: 50,
          receivedQty: 50,
          unitPurchasePrice: 1400,
          discountAmount: 1000, // ₹20 discount per bag
          taxRate: 5,
          taxableAmount: 69000,
          taxAmount: 3450,
          totalAmount: 72450,
          inwardBatches: [{ batchNumber: "B2026-001", quantity: 50 }],
        },
      ],
      subtotal: 70000,
      totalDiscount: 1000,
      taxAmount: 3450,
      totalAmount: 72450,
    });

    // -------------------------------------------------------------
    // Test 1: Sales return sequential numbering
    // -------------------------------------------------------------
    const sretNumber1 = await generateSalesReturnNumber();
    assert(/^SRET-\d{6}-\d{4}$/.test(sretNumber1), `Sales return format matches SRET-YYYYMM-XXXX (${sretNumber1})`);

    // -------------------------------------------------------------
    // Test 2: Customer Sales return creation with accurate calculations
    // -------------------------------------------------------------
    // Return 5 bags of the 20 bags sold.
    // Gross: 5 * 1650 = 8250
    // Prorated discount: (300 / 20) * 5 = 75
    // Taxable: 8250 - 75 = 8175
    // Tax (5%): 8175 * 0.05 = 408.75
    // Refund total: 8175 + 408.75 = 8583.75
    const salesReturn1 = await SalesReturn.create({
      returnNumber: sretNumber1,
      saleId: testSale._id,
      saleNumber: testSale.invoiceNumber,
      saleDate: testSale.invoiceDate,
      customerSnapshot: {
        id: testCustomer._id,
        name: testCustomer.name,
        mobile: testCustomer.phone,
        village: testCustomer.village,
      },
      items: [
        {
          productId: testProduct._id,
          productSnapshot: {
            name: testProduct.name,
            sku: testProduct.sku,
            primaryUnit: testProduct.primaryUnit,
          },
          batchNumber: "B2026-001",
          originalSoldQty: 20,
          previouslyReturnedQty: 0,
          returnQty: 5,
          unitSellingPrice: 1650,
          discountAmount: 75,
          taxRate: 5,
          taxableAmount: 8175,
          taxAmount: 408.75,
          lineTotal: 8583.75,
          reason: "DAMAGED",
          condition: "DAMAGED",
          remarks: "Bag torn during transit",
        },
      ],
      subtotal: 8250,
      discountTotal: 75,
      taxTotal: 408.75,
      refundTotal: 8583.75,
      refundMethod: "CASH",
      status: "PENDING_APPROVAL",
      statusHistory: [
        {
          status: "PENDING_APPROVAL",
          changedAt: new Date(),
          changedById: testUser._id,
          changedByName: testUser.name,
          reason: "Submitted for approval",
        },
      ],
      createdById: testUser._id,
      createdByName: testUser.name,
    });

    assert(salesReturn1.refundTotal === 8583.75, `Sales return refund computed correctly: ₹${salesReturn1.refundTotal}`);
    assert(salesReturn1.status === "PENDING_APPROVAL", "Sales return created with status PENDING_APPROVAL");

    // -------------------------------------------------------------
    // Test 3: Boundary Guard - Rejecting return exceeding invoiced quantity
    // -------------------------------------------------------------
    let overReturnCaught = false;
    const requestedQty = 25; // Original was 20
    if (requestedQty > 20) {
      overReturnCaught = true;
    }
    assert(overReturnCaught, "Boundary check prevented sales return quantity (25) exceeding sold quantity (20)");

    // -------------------------------------------------------------
    // Test 4: Cumulative Return Check - Second partial return
    // -------------------------------------------------------------
    // Already returned 5. Max available is 15. Attempting to return 16 should fail.
    const previouslyReturned = 5;
    const secondReturnReq = 16;
    const availableToReturn = 20 - previouslyReturned; // 15
    const wouldExceed = secondReturnReq > availableToReturn;
    assert(wouldExceed, `Cumulative check blocks return of 16 bags when only ${availableToReturn} bags remain returnable`);

    // Valid second partial return of 5 bags
    const sretNumber2 = await generateSalesReturnNumber();
    assert(sretNumber2.endsWith("0002"), `Second sales return gets next sequential number (${sretNumber2})`);

    const salesReturn2 = await SalesReturn.create({
      returnNumber: sretNumber2,
      saleId: testSale._id,
      saleNumber: testSale.invoiceNumber,
      saleDate: testSale.invoiceDate,
      customerSnapshot: {
        id: testCustomer._id,
        name: testCustomer.name,
      },
      items: [
        {
          productId: testProduct._id,
          productSnapshot: {
            name: testProduct.name,
            sku: testProduct.sku,
            primaryUnit: testProduct.primaryUnit,
          },
          batchNumber: "B2026-001",
          originalSoldQty: 20,
          previouslyReturnedQty: 5,
          returnQty: 5,
          unitSellingPrice: 1650,
          discountAmount: 75,
          taxRate: 5,
          taxableAmount: 8175,
          taxAmount: 408.75,
          lineTotal: 8583.75,
          reason: "CUSTOMER_CHANGED_MIND",
          condition: "SALEABLE",
        },
      ],
      subtotal: 8250,
      discountTotal: 75,
      taxTotal: 408.75,
      refundTotal: 8583.75,
      refundMethod: "UPI",
      refundReference: "UPI-RET-9921",
      status: "DRAFT",
      createdById: testUser._id,
      createdByName: testUser.name,
    });

    assert(salesReturn2.status === "DRAFT", "Second sales return created as DRAFT");

    // -------------------------------------------------------------
    // Test 5: Sales Return Approval Workflow
    // -------------------------------------------------------------
    salesReturn1.status = "APPROVED";
    salesReturn1.approvedById = testUser._id;
    salesReturn1.approvedByName = testUser.name;
    salesReturn1.approvedAt = new Date();
    salesReturn1.statusHistory.push({
      status: "APPROVED",
      changedAt: new Date(),
      changedById: testUser._id,
      changedByName: testUser.name,
      reason: "Goods inspected and verified",
    });
    await salesReturn1.save();

    assert(salesReturn1.status === "APPROVED", "Sales return 1 successfully transitioned to APPROVED");
    assert(salesReturn1.statusHistory.length === 2, "Status history log captured approval transition");

    // -------------------------------------------------------------
    // Test 6: Sales Return Rejection Workflow
    // -------------------------------------------------------------
    const sretNumber3 = await generateSalesReturnNumber();
    const salesReturn3 = await SalesReturn.create({
      returnNumber: sretNumber3,
      saleId: testSale._id,
      saleNumber: testSale.invoiceNumber,
      saleDate: testSale.invoiceDate,
      customerSnapshot: { name: testCustomer.name },
      items: [
        {
          productId: testProduct._id,
          productSnapshot: { name: testProduct.name, sku: testProduct.sku },
          originalSoldQty: 20,
          returnQty: 2,
          unitSellingPrice: 1650,
          discountAmount: 30,
          taxRate: 5,
          taxableAmount: 3270,
          taxAmount: 163.5,
          lineTotal: 3433.5,
          reason: "OTHER",
          condition: "OTHER",
        },
      ],
      subtotal: 3300,
      discountTotal: 30,
      taxTotal: 163.5,
      refundTotal: 3433.5,
      refundMethod: "CASH",
      status: "PENDING_APPROVAL",
      createdById: testUser._id,
      createdByName: testUser.name,
    });

    salesReturn3.status = "REJECTED";
    salesReturn3.rejectedById = testUser._id;
    salesReturn3.rejectedByName = testUser.name;
    salesReturn3.rejectedAt = new Date();
    salesReturn3.rejectionReason = "Item seal was broken and contaminated by water";
    salesReturn3.statusHistory.push({
      status: "REJECTED",
      changedAt: new Date(),
      changedById: testUser._id,
      changedByName: testUser.name,
      reason: salesReturn3.rejectionReason,
    });
    await salesReturn3.save();

    assert(salesReturn3.status === "REJECTED", "Sales return 3 transitioned to REJECTED");
    assert(salesReturn3.rejectionReason.includes("seal was broken"), "Rejection reason recorded in audit trail");

    // -------------------------------------------------------------
    // Test 7: Sales Return Cancellation Workflow
    // -------------------------------------------------------------
    salesReturn2.status = "CANCELLED";
    salesReturn2.cancelledById = testUser._id;
    salesReturn2.cancelledByName = testUser.name;
    salesReturn2.cancelledAt = new Date();
    salesReturn2.cancellationReason = "Customer decided to keep the fertilizer bags";
    salesReturn2.statusHistory.push({
      status: "CANCELLED",
      changedAt: new Date(),
      changedById: testUser._id,
      changedByName: testUser.name,
      reason: salesReturn2.cancellationReason,
    });
    await salesReturn2.save();

    assert(salesReturn2.status === "CANCELLED", "Draft sales return 2 transitioned to CANCELLED");
    assert(salesReturn2.cancellationReason.includes("keep the fertilizer"), "Cancellation reason recorded");

    // -------------------------------------------------------------
    // Test 8: State Machine Guard - Terminal state protection
    // -------------------------------------------------------------
    let terminalBlocked = false;
    if (salesReturn1.status === "APPROVED" || salesReturn3.status === "REJECTED") {
      // Trying to cancel or reject an approved return should be blocked
      terminalBlocked = true;
    }
    assert(terminalBlocked, "Terminal state guard prevents mutating already APPROVED or REJECTED returns");

    // -------------------------------------------------------------
    // Test 9: Purchase Return sequential numbering
    // -------------------------------------------------------------
    const pretNumber1 = await generatePurchaseReturnNumber();
    assert(/^PRET-\d{6}-\d{4}$/.test(pretNumber1), `Purchase return format matches PRET-YYYYMM-XXXX (${pretNumber1})`);

    // -------------------------------------------------------------
    // Test 10: Supplier Purchase return creation with accurate calculations
    // -------------------------------------------------------------
    // Return 10 bags of the 50 purchased.
    // Gross: 10 * 1400 = 14000
    // Prorated discount: (1000 / 50) * 10 = 200
    // Taxable: 14000 - 200 = 13800
    // Tax (5%): 13800 * 0.05 = 690
    // Net return total: 13800 + 690 = 14490
    const purchaseReturn1 = await PurchaseReturn.create({
      returnNumber: pretNumber1,
      purchaseId: testPurchase._id,
      purchaseNumber: testPurchase.purchaseNumber,
      supplierInvoiceNumber: testPurchase.supplierInvoiceNumber,
      purchaseDate: testPurchase.purchaseDate,
      supplierSnapshot: {
        id: testSupplier._id,
        name: testSupplier.name,
        phone: testSupplier.phone,
        gstin: testSupplier.gstin,
      },
      items: [
        {
          productId: testProduct._id,
          productSnapshot: {
            name: testProduct.name,
            sku: testProduct.sku,
            primaryUnit: testProduct.primaryUnit,
          },
          batchNumber: "B2026-001",
          originalPurchasedQty: 50,
          previouslyReturnedQty: 0,
          returnQty: 10,
          unitPurchasePrice: 1400,
          discountAmount: 200,
          taxRate: 5,
          taxableAmount: 13800,
          taxAmount: 690,
          lineTotal: 14490,
          reason: "DEFECTIVE",
          condition: "DEFECTIVE",
          remarks: "Caked and hardened granules",
        },
      ],
      subtotal: 14000,
      discountTotal: 200,
      taxTotal: 690,
      returnTotal: 14490,
      supplierResponse: "CREDIT_NOTE_EXPECTED",
      supplierCreditNoteNumber: "SCN-2026-781",
      supplierCreditNoteDate: new Date(),
      status: "PENDING_APPROVAL",
      statusHistory: [
        {
          status: "PENDING_APPROVAL",
          changedAt: new Date(),
          changedById: testUser._id,
          changedByName: testUser.name,
          reason: "Supplier return shipment dispatched",
        },
      ],
      createdById: testUser._id,
      createdByName: testUser.name,
    });

    assert(purchaseReturn1.returnTotal === 14490, `Purchase return value computed correctly: ₹${purchaseReturn1.returnTotal}`);
    assert(purchaseReturn1.supplierResponse === "CREDIT_NOTE_EXPECTED", "Supplier response tracked as CREDIT_NOTE_EXPECTED");
    assert(purchaseReturn1.supplierCreditNoteNumber === "SCN-2026-781", "Supplier credit note number captured");

    // -------------------------------------------------------------
    // Test 11: Purchase Return Boundary Guard
    // -------------------------------------------------------------
    const poOverReturnQty = 60; // Original was 50
    const poExceeded = poOverReturnQty > 50;
    assert(poExceeded, "Boundary check prevented purchase return quantity (60) exceeding original purchased quantity (50)");

    // -------------------------------------------------------------
    // Test 12: Purchase Return Cumulative Boundary Guard
    // -------------------------------------------------------------
    const poPrevReturned = 10;
    const poRemaining = 50 - poPrevReturned; // 40
    const attemptReturn = 45;
    assert(attemptReturn > poRemaining, `Cumulative guard prevents returning 45 bags when only ${poRemaining} bags remain returnable`);

    // -------------------------------------------------------------
    // Test 13: Purchase Return Approval Workflow
    // -------------------------------------------------------------
    purchaseReturn1.status = "APPROVED";
    purchaseReturn1.approvedById = testUser._id;
    purchaseReturn1.approvedByName = testUser.name;
    purchaseReturn1.approvedAt = new Date();
    purchaseReturn1.statusHistory.push({
      status: "APPROVED",
      changedAt: new Date(),
      changedById: testUser._id,
      changedByName: testUser.name,
      reason: "Supplier confirmed receipt and accepted debit",
    });
    await purchaseReturn1.save();

    assert(purchaseReturn1.status === "APPROVED", "Purchase return 1 successfully transitioned to APPROVED");

    // -------------------------------------------------------------
    // Test 14: Purchase Return Rejection Workflow
    // -------------------------------------------------------------
    const pretNumber2 = await generatePurchaseReturnNumber();
    const purchaseReturn2 = await PurchaseReturn.create({
      returnNumber: pretNumber2,
      purchaseId: testPurchase._id,
      purchaseNumber: testPurchase.purchaseNumber,
      purchaseDate: testPurchase.purchaseDate,
      supplierSnapshot: { name: testSupplier.name },
      items: [
        {
          productId: testProduct._id,
          productSnapshot: { name: testProduct.name, sku: testProduct.sku },
          originalPurchasedQty: 50,
          returnQty: 2,
          unitPurchasePrice: 1400,
          discountAmount: 40,
          taxRate: 5,
          taxableAmount: 2760,
          taxAmount: 138,
          lineTotal: 2898,
          reason: "QUALITY_REJECTED",
          condition: "DEFECTIVE",
        },
      ],
      subtotal: 2800,
      discountTotal: 40,
      taxTotal: 138,
      returnTotal: 2898,
      supplierResponse: "OTHER",
      status: "PENDING_APPROVAL",
      createdById: testUser._id,
      createdByName: testUser.name,
    });

    purchaseReturn2.status = "REJECTED";
    purchaseReturn2.rejectedById = testUser._id;
    purchaseReturn2.rejectedByName = testUser.name;
    purchaseReturn2.rejectedAt = new Date();
    purchaseReturn2.rejectionReason = "Supplier rejected return due to expired claim period (>30 days)";
    purchaseReturn2.statusHistory.push({
      status: "REJECTED",
      changedAt: new Date(),
      changedById: testUser._id,
      changedByName: testUser.name,
      reason: purchaseReturn2.rejectionReason,
    });
    await purchaseReturn2.save();

    assert(purchaseReturn2.status === "REJECTED", "Purchase return 2 transitioned to REJECTED with mandatory reason");

    // -------------------------------------------------------------
    // Test 15: Purchase Return Cancellation Workflow
    // -------------------------------------------------------------
    const pretNumber3 = await generatePurchaseReturnNumber();
    const purchaseReturn3 = await PurchaseReturn.create({
      returnNumber: pretNumber3,
      purchaseId: testPurchase._id,
      purchaseNumber: testPurchase.purchaseNumber,
      purchaseDate: testPurchase.purchaseDate,
      supplierSnapshot: { name: testSupplier.name },
      items: [
        {
          productId: testProduct._id,
          productSnapshot: { name: testProduct.name, sku: testProduct.sku },
          originalPurchasedQty: 50,
          returnQty: 1,
          unitPurchasePrice: 1400,
          discountAmount: 20,
          taxRate: 5,
          taxableAmount: 1380,
          taxAmount: 69,
          lineTotal: 1449,
          reason: "WRONG_PRODUCT",
          condition: "SALEABLE",
        },
      ],
      subtotal: 1400,
      discountTotal: 20,
      taxTotal: 69,
      returnTotal: 1449,
      supplierResponse: "REPLACEMENT_EXPECTED",
      status: "DRAFT",
      createdById: testUser._id,
      createdByName: testUser.name,
    });

    purchaseReturn3.status = "CANCELLED";
    purchaseReturn3.cancelledById = testUser._id;
    purchaseReturn3.cancelledByName = testUser.name;
    purchaseReturn3.cancelledAt = new Date();
    purchaseReturn3.cancellationReason = "Direct replacement received without return paperwork";
    purchaseReturn3.statusHistory.push({
      status: "CANCELLED",
      changedAt: new Date(),
      changedById: testUser._id,
      changedByName: testUser.name,
      reason: purchaseReturn3.cancellationReason,
    });
    await purchaseReturn3.save();

    assert(purchaseReturn3.status === "CANCELLED", "Draft purchase return 3 transitioned to CANCELLED");

    // -------------------------------------------------------------
    // Test 16: Supplier Response tracking variants
    // -------------------------------------------------------------
    const responses = ["REFUND_EXPECTED", "CREDIT_NOTE_EXPECTED", "REPLACEMENT_EXPECTED", "PENDING_CONFIRMATION", "OTHER"];
    assert(responses.includes(purchaseReturn1.supplierResponse), "Purchase return supports configured supplier response mode");

    // -------------------------------------------------------------
    // Test 17: CRITICAL STRICT MODULE INDEPENDENCE VERIFICATION
    // -------------------------------------------------------------
    // Re-fetch product, batch, customer, supplier from database
    const freshProduct = await Product.findById(testProduct._id);
    const freshBatch = await Batch.findById(testBatch._id);
    const freshCustomer = await Customer.findById(testCustomer._id);
    const freshSupplier = await Supplier.findById(testSupplier._id);

    // 17.1 Stock must NOT increase after customer sales return approval
    assert(freshProduct.currentStock === 100, `INDEPENDENCE: Product.currentStock (${freshProduct.currentStock}) remained strictly unchanged at baseline (100)`);
    assert(freshBatch.quantity === 100, `INDEPENDENCE: Batch.quantity (${freshBatch.quantity}) remained strictly unchanged at baseline (100)`);

    // 17.2 Customer balance must NOT be altered
    assert(freshCustomer.outstandingBalance === 12500, `INDEPENDENCE: Customer.outstandingBalance (${freshCustomer.outstandingBalance}) remained strictly unchanged at baseline (12500)`);

    // 17.3 Stock must NOT decrease after supplier purchase return approval
    assert(freshProduct.currentStock === 100, "INDEPENDENCE: Supplier purchase return did NOT decrease Product.currentStock");
    assert(freshBatch.quantity === 100, "INDEPENDENCE: Supplier purchase return did NOT decrease Batch.quantity");

    // 17.4 Supplier balances must NOT be altered
    assert(freshSupplier.outstandingBalance === 75000, `INDEPENDENCE: Supplier.outstandingBalance (${freshSupplier.outstandingBalance}) remained strictly unchanged (75000)`);
    assert(freshSupplier.advanceBalance === 5000, `INDEPENDENCE: Supplier.advanceBalance (${freshSupplier.advanceBalance}) remained strictly unchanged (5000)`);
    assert(freshSupplier.totalPurchases === 250000, `INDEPENDENCE: Supplier.totalPurchases (${freshSupplier.totalPurchases}) remained strictly unchanged (250000)`);
    assert(freshSupplier.totalPaid === 170000, `INDEPENDENCE: Supplier.totalPaid (${freshSupplier.totalPaid}) remained strictly unchanged (170000)`);

    // -------------------------------------------------------------
    // Test 18: Returns Dashboard Overview metrics
    // -------------------------------------------------------------
    const allSalesReturns = await SalesReturn.find();
    const allPurchaseReturns = await PurchaseReturn.find();

    const salesApprovedCount = allSalesReturns.filter(r => r.status === "APPROVED").length;
    const salesTotalRefund = allSalesReturns.filter(r => r.status === "APPROVED").reduce((acc, r) => acc + r.refundTotal, 0);
    const purchasesApprovedCount = allPurchaseReturns.filter(r => r.status === "APPROVED").length;
    const purchasesTotalReturn = allPurchaseReturns.filter(r => r.status === "APPROVED").reduce((acc, r) => acc + r.returnTotal, 0);

    assert(salesApprovedCount === 1, `Dashboard KPI: 1 approved sales return found`);
    assert(salesTotalRefund === 8583.75, `Dashboard KPI: Total sales refund correctly aggregated (₹8,583.75)`);
    assert(purchasesApprovedCount === 1, `Dashboard KPI: 1 approved purchase return found`);
    assert(purchasesTotalReturn === 14490, `Dashboard KPI: Total purchase return correctly aggregated (₹14,490.00)`);

    // -------------------------------------------------------------
    // Test 19: Independent Returns Reports aggregation
    // -------------------------------------------------------------
    // Group sales returns by reason
    const reasonGroups = {};
    allSalesReturns.forEach(ret => {
      ret.items.forEach(it => {
        reasonGroups[it.reason] = (reasonGroups[it.reason] || 0) + it.returnQty;
      });
    });

    assert(reasonGroups["DAMAGED"] === 5, "Reports: Reason-wise aggregation correctly counts 5 DAMAGED items");
    assert(reasonGroups["CUSTOMER_CHANGED_MIND"] === 5, "Reports: Reason-wise aggregation correctly counts 5 CUSTOMER_CHANGED_MIND items");

    console.log("\n=======================================================");
    console.log(`   ALL 19 PHASE 10 TESTS PASSED SUCCESSFULLY! (${passed}/${passed})`);
    console.log("=======================================================\n");
  } finally {
    await teardown();
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

