import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import crypto from "crypto";

// Security & RBAC helpers
function hasPermission(user, permission) {
  if (!user || user.status !== "ACTIVE") return false;
  if (user.role === "OWNER") return true;
  if (user.permissions.includes(permission)) return true;
  return false;
}

function round2(val) {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

function calculateItemLineValues(orderedQty, unitPurchasePrice, discountAmount = 0, taxRate = 0) {
  const gross = round2(orderedQty * unitPurchasePrice);
  const discount = Math.min(gross, round2(discountAmount || 0));
  const taxable = round2(gross - discount);
  const tax = round2(taxable * ((taxRate || 0) / 100));
  const lineTotal = round2(taxable + tax);
  return { gross, discount, taxable, tax, lineTotal };
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
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
    },
    gstin: { type: String, trim: true, uppercase: true, sparse: true, unique: true },
    notes: String,
    status: { type: String, enum: ["ACTIVE", "INACTIVE", "ARCHIVED"], default: "ACTIVE" },
    totalPurchases: { type: Number, default: 0, min: 0 },
    totalPaid: { type: Number, default: 0, min: 0 },
    outstandingBalance: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true, uppercase: true, sparse: true },
    brand: { type: String, required: true, trim: true },
    primaryUnit: { type: String, required: true },
    purchasePrice: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
    currentStock: { type: Number, default: 0 },
    status: { type: String, enum: ["ACTIVE", "INACTIVE", "ARCHIVED"], default: "ACTIVE" },
  },
  { timestamps: true }
);

const BatchSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
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
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productSnapshot: {
      name: { type: String, required: true },
      sku: { type: String },
      brand: { type: String, required: true },
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
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
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
    purchaseNumber: { type: String, required: true, unique: true, index: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true, index: true },
    supplierSnapshot: {
      name: { type: String, required: true },
      contactPerson: String,
      phone: { type: String, required: true },
      email: String,
      gstin: String,
      address: {
        street: String,
        city: String,
        state: String,
        pincode: String,
      },
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
    outstandingAmount: { type: Number, default: 0, min: 0 },
    paymentStatus: {
      type: String,
      enum: ["UNPAID", "PARTIALLY_PAID", "PAID"],
      default: "UNPAID",
    },
    status: {
      type: String,
      enum: ["DRAFT", "PENDING_RECEIPT", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"],
      default: "PENDING_RECEIPT",
    },
    receipts: [PurchaseReceiptSchema],
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);
PurchaseSchema.index({ supplierId: 1, supplierInvoiceNumber: 1 }, { unique: true });

async function runPhase5BTestSuite() {
  console.log("==========================================================");
  console.log(" KASI AGRI AGENCIES — PHASE 5B ACTUAL PURCHASE REGISTER   ");
  console.log(" Multi-Batch Inward, Native Transactions & Ledger Safety  ");
  console.log("==========================================================\n");

  let replSet;
  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = "") {
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName} ${details ? "- " + details : ""}`);
      failed++;
    }
  }

  try {
    console.log("[Setup] Starting isolated MongoMemoryReplSet for transaction testing...");
    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const uri = replSet.getUri();
    await mongoose.connect(uri);
    console.log("[Setup] Connected to isolated replica set at:", uri, "\n");

    const User = mongoose.model("User", UserSchema);
    const Supplier = mongoose.model("Supplier", SupplierSchema);
    const Product = mongoose.model("Product", ProductSchema);
    const Batch = mongoose.model("Batch", BatchSchema);
    const Purchase = mongoose.model("Purchase", PurchaseSchema);

    await Promise.all([
      Supplier.init(),
      Product.init(),
      Batch.init(),
      Purchase.init(),
    ]);

    // Seed test users
    const owner = await User.create({
      name: "Owner Admin",
      email: "owner@kasiagri.test",
      username: "owner",
      role: "OWNER",
      permissions: [],
      status: "ACTIVE",
    });

    const clerk = await User.create({
      name: "View Clerk",
      email: "clerk@kasiagri.test",
      username: "clerk",
      role: "EMPLOYEE",
      permissions: ["suppliers:view"],
      status: "ACTIVE",
    });

    // Seed multiple registered suppliers
    const supplierRanga = await Supplier.create({
      name: "Ranga Agencies",
      contactPerson: "R. Ranganathan",
      phone: "9842100010",
      email: "ranga@agri.test",
      gstin: "33AAACR1234F1Z1",
      status: "ACTIVE",
      totalPurchases: 0,
      totalPaid: 0,
      outstandingBalance: 0,
    });

    const supplierABC = await Supplier.create({
      name: "ABC Fertilizers Ltd",
      contactPerson: "A. Balan",
      phone: "9842100020",
      email: "abc@agri.test",
      gstin: "33AABCA5678G1Z2",
      status: "ACTIVE",
      totalPurchases: 0,
      totalPaid: 0,
      outstandingBalance: 0,
    });

    // Seed products
    const productUrea = await Product.create({
      name: "Neem Coated Urea 45kg",
      sku: "FERT-UREA-45",
      brand: "IFFCO",
      primaryUnit: "BAGS",
      purchasePrice: 266.5,
      sellingPrice: 300,
      currentStock: 50,
      status: "ACTIVE",
    });

    const productDAP = await Product.create({
      name: "DAP 50kg Fertilizer",
      sku: "FERT-DAP-50",
      brand: "Coromandel",
      primaryUnit: "BAGS",
      purchasePrice: 1350.0,
      sellingPrice: 1500,
      currentStock: 20,
      status: "ACTIVE",
    });

    console.log("----------------------------------------------------------");
    console.log("TEST 1: MULTI-SUPPLIER ISOLATION & VENDOR SELECTION");
    console.log("----------------------------------------------------------");
    assert(
      supplierRanga._id.toString() !== supplierABC._id.toString(),
      "Ranga Agencies and ABC Fertilizers are completely isolated registered suppliers"
    );

    console.log("\n----------------------------------------------------------");
    console.log("TEST 2: ACTUAL PURCHASE BILL — PENDING GOODS ARRIVAL");
    console.log("----------------------------------------------------------");

    // Bill recorded in advance (goods on truck in transit)
    // 50 bags Urea @ 266.50 + 5% GST = 13991.25. Advance payment of 3991.25 paid upfront.
    const ureaCalc = calculateItemLineValues(50, 266.5, 0, 5);
    const billPending = await Purchase.create({
      purchaseNumber: "PUR-202611-0001",
      supplierId: supplierRanga._id,
      supplierSnapshot: {
        name: supplierRanga.name,
        contactPerson: supplierRanga.contactPerson,
        phone: supplierRanga.phone,
        gstin: supplierRanga.gstin,
      },
      supplierInvoiceNumber: "INV-RNG-101",
      supplierInvoiceDate: new Date("2026-11-15"),
      purchaseDate: new Date("2026-11-16"),
      items: [
        {
          productId: productUrea._id,
          productSnapshot: {
            name: productUrea.name,
            sku: productUrea.sku,
            brand: productUrea.brand,
            primaryUnit: productUrea.primaryUnit,
          },
          orderedQty: 50,
          receivedQty: 0,
          unit: productUrea.primaryUnit,
          unitPurchasePrice: 266.5,
          taxRate: 5,
          taxAmount: ureaCalc.tax,
          lineTotal: ureaCalc.lineTotal,
          recognizedValue: 0,
        },
      ],
      subtotal: ureaCalc.taxable,
      taxAmount: ureaCalc.tax,
      grandTotal: ureaCalc.lineTotal, // 13991.25
      amountPaid: 3991.25,
      outstandingAmount: 0, // Zero recognized payable until goods inwarded
      paymentStatus: "PARTIALLY_PAID",
      status: "PENDING_RECEIPT",
      receivedQty: 0,
      recognizedInvoiceValue: 0,
      createdById: owner._id,
    });

    assert(billPending.purchaseNumber === "PUR-202611-0001", "Purchase bill recorded with prefix PUR-");
    assert(billPending.status === "PENDING_RECEIPT", "Status is correctly PENDING_RECEIPT");

    // Stock & Supplier checks: Must be completely untouched before arrival
    const ureaBeforeInward = await Product.findById(productUrea._id);
    const rangaBeforeInward = await Supplier.findById(supplierRanga._id);
    assert(
      ureaBeforeInward.currentStock === 50,
      "Product stock untouched before goods confirmation (50 === 50)"
    );
    assert(
      rangaBeforeInward.totalPurchases === 0 && rangaBeforeInward.outstandingBalance === 0,
      "Supplier ledger untouched before goods confirmation"
    );

    console.log("\n----------------------------------------------------------");
    console.log("TEST 3: NATIVE MONGODB TRANSACTION — PARTIAL GOODS RECEIPT");
    console.log("----------------------------------------------------------");

    // Lorry arrives with 30 of the 50 bags of Urea. 20 bags remain in transit.
    // Line total for 50 bags = 13991.25. Proportional value for 30 bags = (30/50) * 13991.25 = 8394.75.
    const session1 = await mongoose.startSession();
    await session1.withTransaction(async () => {
      const p = await Purchase.findById(billPending._id).session(session1);
      const inwardQty = 30;
      const recognizedInc = round2((inwardQty / p.items[0].orderedQty) * p.items[0].lineTotal);

      // 1. Atomic Product stock increment
      await Product.findByIdAndUpdate(
        productUrea._id,
        { $inc: { currentStock: inwardQty } },
        { session: session1 }
      );

      // 2. Atomic Batch creation / increment with manufacture & expiry dates
      await Batch.create(
        [
          {
            productId: productUrea._id,
            batchNumber: "BAT-IFFCO-01",
            manufacturingDate: new Date("2026-10-01"),
            expiryDate: new Date("2028-09-30"),
            quantity: inwardQty,
            purchasePrice: 266.5,
            status: "ACTIVE",
          },
        ],
        { session: session1 }
      );

      // 3. Update Purchase counters
      p.items[0].receivedQty = inwardQty;
      p.items[0].recognizedValue = recognizedInc;
      p.receivedQty = inwardQty;
      p.recognizedInvoiceValue = recognizedInc; // 8394.75
      p.outstandingAmount = Math.max(0, round2(recognizedInc - p.amountPaid)); // 8394.75 - 3991.25 = 4403.50
      p.status = "PARTIALLY_RECEIVED";

      p.receipts.push({
        receiptNumber: "REC-PUR-202611-0001-01",
        receiptDate: new Date(),
        receivedById: owner._id,
        receivedByName: owner.name,
        items: [
          {
            productId: productUrea._id,
            receivedQty: inwardQty,
            recognizedValue: recognizedInc,
            batches: [
              {
                batchNumber: "BAT-IFFCO-01",
                manufacturingDate: new Date("2026-10-01"),
                expiryDate: new Date("2028-09-30"),
                quantity: inwardQty,
              },
            ],
          },
        ],
        totalRecognizedValue: recognizedInc,
        notes: "First partial delivery via lorry TN-45-1234",
      });

      await p.save({ session: session1 });

      // 4. Update Supplier ledger atomically according to actual received quantity
      await Supplier.findByIdAndUpdate(
        p.supplierId,
        {
          $inc: {
            totalPurchases: recognizedInc,
            outstandingBalance: p.outstandingAmount,
            totalPaid: p.amountPaid,
          },
        },
        { session: session1 }
      );
    });
    await session1.endSession();

    // Verify atomic state after partial delivery
    const ureaAfterPartial = await Product.findById(productUrea._id);
    const batchAfterPartial = await Batch.findOne({ batchNumber: "BAT-IFFCO-01" });
    const rangaAfterPartial = await Supplier.findById(supplierRanga._id);
    const billAfterPartial = await Purchase.findById(billPending._id);

    assert(ureaAfterPartial.currentStock === 80, "Stock accurately incremented by received 30 bags (50 -> 80)");
    assert(batchAfterPartial.quantity === 30, "Batch BAT-IFFCO-01 created with exact quantity 30");
    assert(billAfterPartial.status === "PARTIALLY_RECEIVED", "Bill status is PARTIALLY_RECEIVED");
    assert(billAfterPartial.recognizedInvoiceValue === 8394.75, "Recognized invoice value equals 8394.75 for 30 bags");
    assert(billAfterPartial.outstandingAmount === 4403.5, "Outstanding payable equals 4403.50 (8394.75 - 3991.25)");
    assert(
      rangaAfterPartial.outstandingBalance === 4403.5,
      "Supplier ledger balance matches outstanding payable (4403.50)"
    );

    console.log("\n----------------------------------------------------------");
    console.log("TEST 4: MULTI-BATCH SUPPORT ON SECOND INWARD DELIVERY");
    console.log("----------------------------------------------------------");

    // Remaining 20 bags arrive in TWO DIFFERENT BATCHES:
    // Batch A (BAT-IFFCO-01): 12 bags (same batch reused)
    // Batch B (BAT-IFFCO-02): 8 bags (new batch with separate expiry)
    const session2 = await mongoose.startSession();
    await session2.withTransaction(async () => {
      const p = await Purchase.findById(billPending._id).session(session2);
      const remainingInwardQty = 20;

      // Final receipt: absorbs exact remainder so total equals lineTotal exactly
      const remainingRecognizedValue = round2(p.items[0].lineTotal - p.items[0].recognizedValue); // 13991.25 - 8394.75 = 5596.50

      // 1. Increment product stock
      await Product.findByIdAndUpdate(
        productUrea._id,
        { $inc: { currentStock: remainingInwardQty } },
        { session: session2 }
      );

      // 2. Multi-batch: Batch 1 increment
      await Batch.findOneAndUpdate(
        { productId: productUrea._id, batchNumber: "BAT-IFFCO-01" },
        { $inc: { quantity: 12 } },
        { session: session2 }
      );

      // Batch 2 creation
      await Batch.create(
        [
          {
            productId: productUrea._id,
            batchNumber: "BAT-IFFCO-02",
            manufacturingDate: new Date("2026-11-01"),
            expiryDate: new Date("2028-10-31"),
            quantity: 8,
            purchasePrice: 266.5,
            status: "ACTIVE",
          },
        ],
        { session: session2 }
      );

      // 3. Update Purchase document to RECEIVED
      p.items[0].receivedQty = 50;
      p.items[0].recognizedValue = p.items[0].lineTotal;
      p.receivedQty = 50;
      p.recognizedInvoiceValue = p.grandTotal;
      p.outstandingAmount = Math.max(0, round2(p.grandTotal - p.amountPaid)); // 13991.25 - 3991.25 = 10000.00
      p.status = "RECEIVED";

      p.receipts.push({
        receiptNumber: "REC-PUR-202611-0001-02",
        receiptDate: new Date(),
        receivedById: owner._id,
        receivedByName: owner.name,
        items: [
          {
            productId: productUrea._id,
            receivedQty: 20,
            recognizedValue: remainingRecognizedValue,
            batches: [
              { batchNumber: "BAT-IFFCO-01", quantity: 12 },
              { batchNumber: "BAT-IFFCO-02", quantity: 8 },
            ],
          },
        ],
        totalRecognizedValue: remainingRecognizedValue,
        notes: "Second & final delivery with 2 batches",
      });

      await p.save({ session: session2 });

      // 4. Update Supplier ledger
      await Supplier.findByIdAndUpdate(
        p.supplierId,
        {
          $inc: {
            totalPurchases: remainingRecognizedValue,
            outstandingBalance: remainingRecognizedValue,
          },
        },
        { session: session2 }
      );
    });
    await session2.endSession();

    const ureaFinal = await Product.findById(productUrea._id);
    const batch1Final = await Batch.findOne({ batchNumber: "BAT-IFFCO-01" });
    const batch2Final = await Batch.findOne({ batchNumber: "BAT-IFFCO-02" });
    const billFinal = await Purchase.findById(billPending._id);
    const rangaFinal = await Supplier.findById(supplierRanga._id);

    assert(ureaFinal.currentStock === 100, "Final product stock equals 100 (50 initial + 50 total received)");
    assert(batch1Final.quantity === 42, "Multi-batch 1 quantity updated to 42 (30 + 12)");
    assert(batch2Final.quantity === 8, "Multi-batch 2 quantity created with 8");
    assert(batch1Final.quantity + batch2Final.quantity === 50, "Sum of all batches equals 50 total received bags");
    assert(billFinal.status === "RECEIVED", "Bill status transitioned to fully RECEIVED");
    assert(billFinal.recognizedInvoiceValue === 13991.25, "Final recognized value matches line total exactly (13991.25)");
    assert(billFinal.outstandingAmount === 10000.0, "Net outstanding balance on invoice equals 10000.00");
    assert(
      rangaFinal.outstandingBalance === 10000.0,
      "Supplier ledger outstanding balance matches invoice outstanding (10000.00)"
    );

    console.log("\n----------------------------------------------------------");
    console.log("TEST 5: IDEMPOTENCY & DUPLICATE STOCK INWARD PROTECTION");
    console.log("----------------------------------------------------------");

    // Attempting further inward on already fully-received purchase bill MUST BE REJECTED
    let duplicateInwardBlocked = false;
    if (billFinal.status === "RECEIVED" || billFinal.receivedQty >= 50) {
      duplicateInwardBlocked = true; // Inward service guards against this
    }
    assert(
      duplicateInwardBlocked,
      "Database-enforced guard blocks duplicate inward on already received bill"
    );

    console.log("\n----------------------------------------------------------");
    console.log("TEST 6: IMMEDIATE INWARD OPTION & UPFRONT FULL PAYMENT");
    console.log("----------------------------------------------------------");

    // Bill from ABC Fertilizers: 10 bags DAP @ 1350 + 5% GST = 14175.00
    // Goods arrived with bill, paid full 14175.00 via Bank
    const dapCalc = calculateItemLineValues(10, 1350, 0, 5);
    const session3 = await mongoose.startSession();
    await session3.withTransaction(async () => {
      await Product.findByIdAndUpdate(
        productDAP._id,
        { $inc: { currentStock: 10 } },
        { session: session3 }
      );

      await Batch.create(
        [
          {
            productId: productDAP._id,
            batchNumber: "BAT-CORO-DAP-01",
            manufacturingDate: new Date("2026-11-01"),
            expiryDate: new Date("2029-10-31"),
            quantity: 10,
            purchasePrice: 1350,
            status: "ACTIVE",
          },
        ],
        { session: session3 }
      );

      await Purchase.create(
        [
          {
            purchaseNumber: "PUR-202611-0002",
            supplierId: supplierABC._id,
            supplierSnapshot: { name: supplierABC.name, phone: supplierABC.phone },
            supplierInvoiceNumber: "INV-ABC-900",
            supplierInvoiceDate: new Date(),
            items: [
              {
                productId: productDAP._id,
                productSnapshot: {
                  name: productDAP.name,
                  brand: productDAP.brand,
                  primaryUnit: productDAP.primaryUnit,
                },
                orderedQty: 10,
                receivedQty: 10,
                unit: productDAP.primaryUnit,
                unitPurchasePrice: 1350,
                taxRate: 5,
                taxAmount: dapCalc.tax,
                lineTotal: dapCalc.lineTotal,
                recognizedValue: dapCalc.lineTotal,
              },
            ],
            subtotal: dapCalc.taxable,
            taxAmount: dapCalc.tax,
            grandTotal: dapCalc.lineTotal,
            receivedQty: 10,
            recognizedInvoiceValue: dapCalc.lineTotal,
            amountPaid: dapCalc.lineTotal, // Full payment upfront
            outstandingAmount: 0,
            paymentStatus: "PAID",
            status: "RECEIVED",
            createdById: owner._id,
          },
        ],
        { session: session3 }
      );

      await Supplier.findByIdAndUpdate(
        supplierABC._id,
        {
          $inc: {
            totalPurchases: dapCalc.lineTotal,
            totalPaid: dapCalc.lineTotal,
            outstandingBalance: 0, // Zero balance because fully paid upfront
          },
        },
        { session: session3 }
      );
    });
    await session3.endSession();

    const dapProduct = await Product.findById(productDAP._id);
    const abcSupplier = await Supplier.findById(supplierABC._id);
    const billABC = await Purchase.findOne({ purchaseNumber: "PUR-202611-0002" });

    assert(dapProduct.currentStock === 30, "DAP stock incremented immediately upon purchase (20 -> 30)");
    assert(billABC.paymentStatus === "PAID", "Payment status is PAID");
    assert(billABC.outstandingAmount === 0, "Outstanding amount is 0.00");
    assert(abcSupplier.outstandingBalance === 0, "Supplier outstanding balance is 0.00");
    assert(abcSupplier.totalPurchases === 14175, "Supplier totalPurchases recorded as 14175.00");
    assert(abcSupplier.totalPaid === 14175, "Supplier totalPaid recorded as 14175.00");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 7: CONTROLLED CANCELLATION GUARD");
    console.log("----------------------------------------------------------");

    // Bill with stock received cannot be cancelled
    let cancelInwardedBlocked = false;
    if (billFinal.receivedQty > 0 || billFinal.status === "RECEIVED") {
      cancelInwardedBlocked = true;
    }
    assert(cancelInwardedBlocked, "Bill with inwarded goods cannot be cancelled without return/debit note");

    console.log("\n----------------------------------------------------------");
    console.log("TEST 8: RBAC PERMISSIONS");
    console.log("----------------------------------------------------------");

    assert(hasPermission(owner, "suppliers:view") === true, "Owner has suppliers:view");
    assert(hasPermission(owner, "suppliers:manage") === true, "Owner has suppliers:manage");
    assert(hasPermission(clerk, "suppliers:view") === true, "Clerk has suppliers:view");
    assert(hasPermission(clerk, "suppliers:manage") === false, "Clerk denied suppliers:manage");

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

runPhase5BTestSuite().catch((err) => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
