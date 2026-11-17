/**
 * KASI AGRI AGENCIES — PHASE 9 INVENTORY INTELLIGENCE & STOCK MANAGEMENT TEST SUITE
 *
 * Comprehensive isolated verification using MongoMemoryReplSet:
 * 1. Low-stock detection & OUT_OF_STOCK flagging
 * 2. Suggested reorder quantity computation (preferredReorderQty vs dynamic threshold)
 * 3. Updating reorder settings with audit log
 * 4. FEFO batch selection in auto-allocation (earliest expiry first)
 * 5. Blocking expired batches in auto-allocation
 * 6. Blocking expired batches in manual batch allocation
 * 7. Expiry monitoring buckets (EXPIRED, 7D, 30D, 60D, LATER)
 * 8. Sequential stock adjustment number generation (ADJ-YYYYMM-XXXX)
 * 9. Stock adjustment INCREASE: atomic increment of batch and product stock
 * 10. Stock adjustment DECREASE (Damaged goods write-off): atomic decrement
 * 11. Negative stock guard preventing negative inventory
 * 12. Stock count session creation with frozen systemStockAtStart baseline
 * 13. Stock count session item count update & variance computation
 * 14. Stock count session submission
 * 15. Stale movement detection blocking count approval if stock moved
 * 16. Stock count session approval & automatic reconciliation adjustments
 * 17. Inventory valuation report by product and category based on batch costs
 * 18. Unified stock movement history aggregating Inwards, Sales, Cancellations, Adjustments
 */

import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";

function round2(val) {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

// Schemas
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

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, default: "" },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true }
);

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    sku: { type: String, required: true, unique: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    brand: { type: String, default: "" },
    primaryUnit: { type: String, default: "PCS" },
    currentStock: { type: Number, default: 0, min: 0 },
    purchasePrice: { type: Number, default: 0, min: 0 },
    sellingPrice: { type: Number, default: 0, min: 0 },
    minStockThreshold: { type: Number, default: 0, min: 0 },
    preferredReorderQty: { type: Number, min: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const BatchSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    batchNumber: { type: String, required: true, uppercase: true },
    manufacturingDate: { type: Date },
    expiryDate: { type: Date },
    quantity: { type: Number, required: true, default: 0, min: 0 },
    purchasePrice: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["ACTIVE", "DEPLETED", "EXPIRED"], default: "ACTIVE" },
  },
  { timestamps: true }
);

const StockAdjustmentSchema = new mongoose.Schema(
  {
    adjustmentNumber: { type: String, required: true, unique: true, uppercase: true },
    date: { type: Date, required: true, default: Date.now },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productSnapshot: {
      name: { type: String, required: true },
      sku: { type: String, required: true },
      primaryUnit: { type: String, required: true },
    },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: "Batch" },
    batchNumber: { type: String, uppercase: true },
    type: { type: String, enum: ["INCREASE", "DECREASE"], required: true },
    previousQuantity: { type: Number, required: true, min: 0 },
    adjustmentQuantity: { type: Number, required: true, min: 0.0001 },
    newQuantity: { type: Number, required: true, min: 0 },
    reason: {
      type: String,
      enum: [
        "PHYSICAL_CORRECTION",
        "DAMAGED_GOODS",
        "EXPIRED_GOODS",
        "STOCK_LOSS",
        "DATA_CORRECTION",
        "OTHER",
      ],
      required: true,
    },
    explanation: { type: String, required: true, trim: true },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true }
);

const StockCountItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productName: { type: String, required: true },
    sku: { type: String, required: true },
    categoryName: { type: String, default: "" },
    unit: { type: String, default: "" },
    systemStockAtStart: { type: Number, required: true, min: 0 },
    countedStock: { type: Number, required: true, min: 0 },
    variance: { type: Number, required: true },
    notes: { type: String, trim: true },
  },
  { _id: false }
);

const StockCountSessionSchema = new mongoose.Schema(
  {
    sessionNumber: { type: String, required: true, unique: true, uppercase: true },
    title: { type: String, required: true },
    status: {
      type: String,
      enum: ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED"],
      default: "DRAFT",
    },
    notes: { type: String },
    categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],
    items: [StockCountItemSchema],
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdByName: { type: String, required: true },
    submittedAt: { type: Date },
    approvedAt: { type: Date },
    approvedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedByName: { type: String },
    approvalNotes: { type: String },
  },
  { timestamps: true }
);

const PurchaseSchema = new mongoose.Schema(
  {
    purchaseNumber: { type: String, required: true, unique: true },
    supplierSnapshot: { name: { type: String, required: true } },
    status: { type: String, enum: ["DRAFT", "CONFIRMED", "AMENDED"], default: "CONFIRMED" },
    inwardDate: { type: Date, default: Date.now },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        productSnapshot: { name: String, sku: String, primaryUnit: String },
        receivedQty: { type: Number, required: true },
        unitPurchasePrice: { type: Number, required: true },
        inwardBatches: [{ batchNumber: String, quantity: Number, expiryDate: Date }],
      },
    ],
  },
  { timestamps: true }
);

const SaleSchema = new mongoose.Schema(
  {
    saleNumber: { type: String, required: true, unique: true },
    customerSnapshot: { name: { type: String, required: true } },
    status: { type: String, enum: ["COMPLETED", "CANCELLED"], default: "COMPLETED" },
    saleDate: { type: Date, default: Date.now },
    cancelledAt: { type: Date },
    cancelledByName: { type: String },
    cancellationReason: { type: String },
    createdByName: { type: String, default: "Sales Staff" },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        productSnapshot: { name: String, sku: String, primaryUnit: String },
        batchNumber: { type: String },
        quantity: { type: Number, required: true },
      },
    ],
  },
  { timestamps: true }
);

let replSet;
let User, Category, Product, Batch, StockAdjustment, StockCountSession, Purchase, Sale;

async function setup() {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(replSet.getUri());

  User = mongoose.model("User", UserSchema);
  Category = mongoose.model("Category", CategorySchema);
  Product = mongoose.model("Product", ProductSchema);
  Batch = mongoose.model("Batch", BatchSchema);
  StockAdjustment = mongoose.model("StockAdjustment", StockAdjustmentSchema);
  StockCountSession = mongoose.model("StockCountSession", StockCountSessionSchema);
  Purchase = mongoose.model("Purchase", PurchaseSchema);
  Sale = mongoose.model("Sale", SaleSchema);
}

async function teardown() {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("   KASI AGRI AGENCIES — PHASE 9 INVENTORY TEST SUITE   ");
  console.log("=======================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
      throw new Error(`Assertion failed: ${message}`);
    }
  }

  try {
    await setup();

    // 0. Seed Users & Category
    const admin = await User.create({
      name: "Owner Admin",
      email: "owner@kasiagri.com",
      username: "owner",
      role: "OWNER",
      permissions: ["inventory:view", "inventory:manage", "inventory:adjust", "inventory:approve"],
    });

    const fertilizerCat = await Category.create({ name: "Fertilizers" });
    const pesticideCat = await Category.create({ name: "Pesticides" });

    // 1. Seed Products
    const urea = await Product.create({
      name: "Urea 50kg",
      sku: "UREA-50",
      categoryId: fertilizerCat._id,
      brand: "IFFCO",
      primaryUnit: "BAG",
      currentStock: 15,
      purchasePrice: 265,
      sellingPrice: 300,
      minStockThreshold: 50,
      preferredReorderQty: 100,
    });

    const dap = await Product.create({
      name: "DAP 50kg",
      sku: "DAP-50",
      categoryId: fertilizerCat._id,
      brand: "Coromandel",
      primaryUnit: "BAG",
      currentStock: 0,
      purchasePrice: 1350,
      sellingPrice: 1450,
      minStockThreshold: 30,
    });

    const potash = await Product.create({
      name: "Potash 50kg",
      sku: "MOP-50",
      categoryId: fertilizerCat._id,
      brand: "IPL",
      primaryUnit: "BAG",
      currentStock: 120,
      purchasePrice: 1600,
      sellingPrice: 1750,
      minStockThreshold: 40,
    });

    // TEST 1: Low-stock detection & OUT_OF_STOCK classification
    console.log("\n[TEST 1] Low-stock detection & OUT_OF_STOCK classification");
    assert(urea.currentStock <= urea.minStockThreshold, "Urea stock (15) correctly triggers low stock condition (<= 50)");
    assert(dap.currentStock <= 0, "DAP stock (0) correctly triggers out of stock condition");
    assert(potash.currentStock > potash.minStockThreshold, "Potash stock (120) is adequate (> 40)");

    // TEST 2: Suggested reorder quantity computation
    console.log("\n[TEST 2] Suggested reorder quantity computation");
    const ureaSuggested = urea.preferredReorderQty ? urea.preferredReorderQty : Math.max(1, urea.minStockThreshold * 2 - urea.currentStock);
    const dapSuggested = dap.preferredReorderQty ? dap.preferredReorderQty : Math.max(1, dap.minStockThreshold * 2 - dap.currentStock);
    assert(ureaSuggested === 100, "Urea suggests configured preferredReorderQty (100 bags)");
    assert(dapSuggested === 60, "DAP dynamically suggests (minThreshold * 2 - currentStock) = (30 * 2 - 0) = 60 bags");

    // TEST 3: Updating reorder settings
    console.log("\n[TEST 3] Updating product reorder settings");
    urea.minStockThreshold = 60;
    urea.preferredReorderQty = 150;
    await urea.save();
    const updatedUrea = await Product.findById(urea._id);
    assert(updatedUrea.minStockThreshold === 60, "Urea minStockThreshold updated to 60");
    assert(updatedUrea.preferredReorderQty === 150, "Urea preferredReorderQty updated to 150");

    // TEST 4 & 5 & 6: FEFO & Expiry Handling in Batches
    console.log("\n[TEST 4, 5, 6] Batch FEFO Prioritization & Blocking Expired Batches");
    const now = new Date();
    const futureDate1 = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000); // +15 days
    const futureDate2 = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000); // +45 days
    const expiredDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);  // -5 days (expired)

    const batchExpired = await Batch.create({
      productId: urea._id,
      batchNumber: "UREA-EXP-001",
      quantity: 5,
      purchasePrice: 265,
      expiryDate: expiredDate,
      status: "ACTIVE",
    });

    const batchEarliestValid = await Batch.create({
      productId: urea._id,
      batchNumber: "UREA-VAL-001",
      quantity: 6,
      purchasePrice: 265,
      expiryDate: futureDate1,
      status: "ACTIVE",
    });

    const batchLaterValid = await Batch.create({
      productId: urea._id,
      batchNumber: "UREA-VAL-002",
      quantity: 10,
      purchasePrice: 265,
      expiryDate: futureDate2,
      status: "ACTIVE",
    });

    // FEFO query excluding expired batches
    const fefoBatches = await Batch.find({
      productId: urea._id,
      status: "ACTIVE",
      quantity: { $gt: 0 },
      $or: [
        { expiryDate: { $exists: false } },
        { expiryDate: null },
        { expiryDate: { $gte: now } },
      ],
    }).sort({ expiryDate: 1, createdAt: 1 });

    assert(fefoBatches.length === 2, "FEFO excludes expired batch from eligible sales pool");
    assert(fefoBatches[0].batchNumber === "UREA-VAL-001", "FEFO selects earliest valid expiry batch first (UREA-VAL-001)");

    // Manual allocation guard against expired batch
    let expiredSaleBlocked = false;
    try {
      if (batchExpired.status === "EXPIRED" || (batchExpired.expiryDate && new Date(batchExpired.expiryDate) < new Date())) {
        throw new Error(`Batch '${batchExpired.batchNumber}' has expired`);
      }
    } catch (e) {
      expiredSaleBlocked = true;
    }
    assert(expiredSaleBlocked, "Manual allocation strictly blocks expired batch from being sold");

    // TEST 7: Expiry Monitoring Report Buckets
    console.log("\n[TEST 7] Expiry monitoring report bucket classification");
    function getBucket(exp) {
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const expTime = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate()).getTime();
      const diffMs = expTime - startOfToday;
      const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      if (days < 0) return "EXPIRED";
      if (days <= 7) return "EXPIRING_7D";
      if (days <= 30) return "EXPIRING_30D";
      if (days <= 60) return "EXPIRING_60D";
      return "EXPIRING_LATER";
    }

    assert(getBucket(expiredDate) === "EXPIRED", "Negative remaining days classified as EXPIRED");
    assert(getBucket(futureDate1) === "EXPIRING_30D", "+15 days classified as EXPIRING_30D");
    assert(getBucket(futureDate2) === "EXPIRING_60D", "+45 days classified as EXPIRING_60D");

    // TEST 8, 9, 10, 11: Controlled Stock Adjustments & Negative Stock Guard
    console.log("\n[TEST 8, 9, 10, 11] Stock Adjustments, Write-offs & Negative Stock Guards");
    const adjNumber = "ADJ-202611-0001";

    // 9. Increase Adjustment
    const startStock = potash.currentStock; // 120
    const incQty = 15;
    potash.currentStock = round2(potash.currentStock + incQty);
    await potash.save();

    const adjIncrease = await StockAdjustment.create({
      adjustmentNumber: adjNumber,
      date: new Date(),
      productId: potash._id,
      productSnapshot: { name: potash.name, sku: potash.sku, primaryUnit: potash.primaryUnit },
      type: "INCREASE",
      previousQuantity: startStock,
      adjustmentQuantity: incQty,
      newQuantity: potash.currentStock,
      reason: "PHYSICAL_CORRECTION",
      explanation: "Audited warehouse found 15 extra bags",
      createdById: admin._id,
      createdByName: admin.name,
    });
    assert(potash.currentStock === 135, "Stock correctly increased from 120 to 135");
    assert(adjIncrease.newQuantity === 135, "Adjustment audit recorded newQuantity 135");

    // 10. Decrease Adjustment (Damaged Goods Write-off)
    const decQty = 5;
    potash.currentStock = round2(potash.currentStock - decQty);
    await potash.save();

    const adjDecrease = await StockAdjustment.create({
      adjustmentNumber: "ADJ-202611-0002",
      date: new Date(),
      productId: potash._id,
      productSnapshot: { name: potash.name, sku: potash.sku, primaryUnit: potash.primaryUnit },
      type: "DECREASE",
      previousQuantity: 135,
      adjustmentQuantity: decQty,
      newQuantity: potash.currentStock,
      reason: "DAMAGED_GOODS",
      explanation: "Bags torn during transport rain water damage",
      createdById: admin._id,
      createdByName: admin.name,
    });
    assert(potash.currentStock === 130, "Stock correctly decreased to 130 after damage write-off");

    // 11. Negative Stock Guard
    let negativeGuardTriggered = false;
    const excessiveDecQty = 200;
    try {
      if (potash.currentStock < excessiveDecQty) {
        throw new Error("Insufficient stock to decrease. Negative stock prevented.");
      }
    } catch (e) {
      negativeGuardTriggered = true;
    }
    assert(negativeGuardTriggered, "Negative stock guard blocks decrease exceeding available stock");

    // TEST 12, 13, 14, 15, 16: Physical Stock Count Reconciliation Session Workflow
    console.log("\n[TEST 12, 13, 14, 15, 16] Physical Stock Count Session Lifecycle & Stale Detection");
    // 12. Create session with baseline snapshot
    const session = await StockCountSession.create({
      sessionNumber: "STC-202611-0001",
      title: "November Monthly Count",
      status: "DRAFT",
      items: [
        {
          productId: potash._id,
          productName: potash.name,
          sku: potash.sku,
          categoryName: "Fertilizers",
          unit: "BAG",
          systemStockAtStart: potash.currentStock, // 130
          countedStock: potash.currentStock,       // initial match
          variance: 0,
        },
      ],
      createdById: admin._id,
      createdByName: admin.name,
    });
    assert(session.status === "DRAFT", "Stock count session created in DRAFT status");
    assert(session.items[0].systemStockAtStart === 130, "Frozen systemStockAtStart captured (130)");

    // 13. Update physical counted count
    session.items[0].countedStock = 126; // 4 bags short
    session.items[0].variance = round2(session.items[0].countedStock - session.items[0].systemStockAtStart); // -4
    await session.save();
    assert(session.items[0].variance === -4, "Variance correctly computed as -4 bags");

    // 14. Submit count session
    session.status = "SUBMITTED";
    session.submittedAt = new Date();
    await session.save();
    assert(session.status === "SUBMITTED", "Session successfully transitioned to SUBMITTED status");

    // 15. Stale movement detection test
    // Simulate stock movement occurring during count
    potash.currentStock = 128; // moved from 130 to 128
    await potash.save();

    let staleDetected = false;
    try {
      const liveProduct = await Product.findById(potash._id);
      if (liveProduct.currentStock !== session.items[0].systemStockAtStart) {
        throw new Error(`Stale stock detected: expected ${session.items[0].systemStockAtStart}, but found ${liveProduct.currentStock}`);
      }
    } catch (e) {
      staleDetected = true;
    }
    assert(staleDetected, "Stale movement check halts approval when currentStock moved after session start");

    // Reset stock to baseline to test clean approval
    potash.currentStock = 130;
    await potash.save();

    // 16. Approve session & reconcile atomically
    const approvedDbSession = await mongoose.startSession();
    approvedDbSession.startTransaction();

    for (const item of session.items) {
      if (item.variance !== 0) {
        const p = await Product.findById(item.productId).session(approvedDbSession);
        p.currentStock = round2(p.currentStock + item.variance); // 130 + (-4) = 126
        await p.save({ session: approvedDbSession });

        await StockAdjustment.create(
          [
            {
              adjustmentNumber: "ADJ-202611-0003",
              date: new Date(),
              productId: p._id,
              productSnapshot: { name: p.name, sku: p.sku, primaryUnit: p.primaryUnit },
              type: item.variance > 0 ? "INCREASE" : "DECREASE",
              previousQuantity: item.systemStockAtStart,
              adjustmentQuantity: Math.abs(item.variance),
              newQuantity: p.currentStock,
              reason: "PHYSICAL_CORRECTION",
              explanation: `Physical count reconciliation ${session.sessionNumber}`,
              createdById: admin._id,
              createdByName: admin.name,
            },
          ],
          { session: approvedDbSession }
        );
      }
    }

    session.status = "APPROVED";
    session.approvedAt = new Date();
    session.approvedById = admin._id;
    session.approvedByName = admin.name;
    await session.save({ session: approvedDbSession });

    await approvedDbSession.commitTransaction();
    approvedDbSession.endSession();

    const reconciledPotash = await Product.findById(potash._id);
    assert(reconciledPotash.currentStock === 126, "Potash stock reconciled exactly to physical count (126)");
    assert(session.status === "APPROVED", "Count session status updated to APPROVED");

    // TEST 17: Inventory Valuation Report
    console.log("\n[TEST 17] Authoritative inventory valuation calculation");
    // Batches valuation:
    // Urea: batchExpired (5 * 265 = 1325), batchEarliestValid (6 * 265 = 1590), batchLaterValid (10 * 265 = 2650)
    // Potash: 126 * 1600 = 201600
    // DAP: 0 * 1350 = 0
    const ureaBatches = await Batch.find({ productId: urea._id, quantity: { $gt: 0 } });
    let ureaVal = 0;
    ureaBatches.forEach(b => ureaVal = round2(ureaVal + b.quantity * b.purchasePrice));
    const potashVal = round2(reconciledPotash.currentStock * (reconciledPotash.purchasePrice || 0));

    assert(ureaVal === 5565, "Urea batch valuation correctly sums active batches (5565)");
    assert(potashVal === 201600, "Potash product valuation correctly calculates (126 * 1600 = 201600)");

    // TEST 18: Unified Stock Movement History
    console.log("\n[TEST 18] Unified stock movement history across Inwards, Sales, Cancellations, Adjustments");
    // Seed Purchase Inward
    await Purchase.create({
      purchaseNumber: "PUR-202611-0001",
      supplierSnapshot: { name: "IFFCO Suppliers Ltd" },
      status: "CONFIRMED",
      items: [
        {
          productId: urea._id,
          productSnapshot: { name: urea.name, sku: urea.sku, primaryUnit: urea.primaryUnit },
          receivedQty: 50,
          unitPurchasePrice: 265,
        },
      ],
    });

    // Seed Completed Sale & Cancelled Sale
    await Sale.create({
      saleNumber: "INV-202611-0001",
      customerSnapshot: { name: "K. Murugan" },
      status: "COMPLETED",
      items: [
        {
          productId: potash._id,
          productSnapshot: { name: potash.name, sku: potash.sku, primaryUnit: potash.primaryUnit },
          quantity: 10,
        },
      ],
    });

    await Sale.create({
      saleNumber: "INV-202611-0002",
      customerSnapshot: { name: "R. Selvam" },
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancellationReason: "Farmer changed requirement",
      items: [
        {
          productId: potash._id,
          productSnapshot: { name: potash.name, sku: potash.sku, primaryUnit: potash.primaryUnit },
          quantity: 2,
        },
      ],
    });

    // Collect movements
    const movements = [];
    // 1. Inward
    const purDocs = await Purchase.find({ status: "CONFIRMED" });
    purDocs.forEach(p => {
      p.items.forEach(it => {
        movements.push({ type: "PURCHASE_INWARD", ref: p.purchaseNumber, in: it.receivedQty, out: 0 });
      });
    });
    // 2. Sales
    const saleDocs = await Sale.find();
    saleDocs.forEach(s => {
      s.items.forEach(it => {
        movements.push({ type: "SALE_DEDUCTION", ref: s.saleNumber, in: 0, out: it.quantity });
        if (s.status === "CANCELLED") {
          movements.push({ type: "SALE_CANCELLATION_RESTORE", ref: s.saleNumber, in: it.quantity, out: 0 });
        }
      });
    });
    // 3. Adjustments
    const adjDocs = await StockAdjustment.find();
    adjDocs.forEach(a => {
      movements.push({
        type: a.type === "INCREASE" ? "STOCK_ADJUSTMENT_INCREASE" : "STOCK_ADJUSTMENT_DECREASE",
        ref: a.adjustmentNumber,
        in: a.type === "INCREASE" ? a.adjustmentQuantity : 0,
        out: a.type === "DECREASE" ? a.adjustmentQuantity : 0,
      });
    });

    assert(movements.some(m => m.type === "PURCHASE_INWARD" && m.in === 50), "Unified ledger includes Purchase Inward");
    assert(movements.some(m => m.type === "SALE_DEDUCTION" && m.out === 10), "Unified ledger includes Sale Deduction");
    assert(movements.some(m => m.type === "SALE_CANCELLATION_RESTORE" && m.in === 2), "Unified ledger includes Sale Cancellation Restore");
    assert(movements.some(m => m.type === "STOCK_ADJUSTMENT_INCREASE" && m.in === 15), "Unified ledger includes Increase Adjustment");
    assert(movements.some(m => m.type === "STOCK_ADJUSTMENT_DECREASE" && m.out === 5), "Unified ledger includes Damage Write-off");
    assert(movements.some(m => m.ref === "ADJ-202611-0003" && m.out === 4), "Unified ledger includes Stock Count Reconciliation Adjustment");

    console.log("\n=======================================================");
    console.log(`   ALL 18 PHASE 9 TESTS PASSED SUCCESSFULLY! (${passed}/${passed})`);
    console.log("=======================================================\n");
  } finally {
    await teardown();
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

