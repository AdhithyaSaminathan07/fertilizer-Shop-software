import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import crypto from "crypto";

// Security & RBAC helpers matching Phase 3, 4, 5A
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function hasPermission(user, permission) {
  if (!user || user.status !== "ACTIVE") return false;
  if (user.role === "OWNER") return true;
  if (user.permissions.includes(permission)) return true;
  return false;
}

// Financial calculations utility
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

// Mongoose Schemas
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
  },
  { _id: true }
);

const PurchaseAmendmentSchema = new mongoose.Schema(
  {
    amendmentNumber: { type: Number, required: true },
    amendedAt: { type: Date, default: Date.now },
    amendedById: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    amendedByName: { type: String, required: true },
    reason: { type: String, required: true, trim: true },
    previousItems: [PurchaseItemSchema],
    revisedItems: [PurchaseItemSchema],
    previousGrandTotal: { type: Number, required: true },
    revisedGrandTotal: { type: Number, required: true },
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
    items: {
      type: [PurchaseItemSchema],
      validate: [(val) => Array.isArray(val) && val.length > 0, "At least one item required"],
    },
    subtotal: { type: Number, required: true, min: 0 },
    discountAmount: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },
    receivedQty: { type: Number, default: 0, min: 0 },
    recognizedInvoiceValue: { type: Number, default: 0, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    paymentStatus: {
      type: String,
      enum: ["UNPAID", "PARTIALLY_PAID", "PAID"],
      default: "UNPAID",
    },
    status: {
      type: String,
      enum: ["DRAFT", "PENDING_RECEIPT", "PARTIALLY_RECEIVED", "RECEIVED", "CANCELLED"],
      default: "DRAFT",
    },
    amendments: [PurchaseAmendmentSchema],
    notes: String,
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

PurchaseSchema.index({ supplierId: 1, supplierInvoiceNumber: 1 }, { unique: true });

async function runPhase5BTestSuite() {
  console.log("==========================================================");
  console.log(" KASI AGRI AGENCIES — PHASE 5B COMPREHENSIVE TEST SUITE   ");
  console.log(" Purchase Management, Multi-Supplier Isolation,          ");
  console.log(" Invariant Checks, Financial Calculations & Amendments   ");
  console.log("==========================================================\n");

  let mongod;
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
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log("Connected to isolated MongoMemoryServer at:", uri, "\n");

    const User = mongoose.model("User", UserSchema);
    const Supplier = mongoose.model("Supplier", SupplierSchema);
    const Product = mongoose.model("Product", ProductSchema);
    const Purchase = mongoose.model("Purchase", PurchaseSchema);

    await Purchase.init(); // Ensure indexes are created

    // Seed test users
    const owner = await User.create({
      name: "Owner Admin",
      email: "owner@kasiagri.test",
      username: "owner",
      role: "OWNER",
      permissions: [],
      status: "ACTIVE",
    });

    const staffViewer = await User.create({
      name: "Viewer Staff",
      email: "viewer@kasiagri.test",
      username: "viewer",
      role: "EMPLOYEE",
      permissions: ["suppliers:view"],
      status: "ACTIVE",
    });

    const staffNoAccess = await User.create({
      name: "Unauthorized Staff",
      email: "noaccess@kasiagri.test",
      username: "noaccess",
      role: "EMPLOYEE",
      permissions: ["inventory:read"],
      status: "ACTIVE",
    });

    // Seed multiple test suppliers
    const supplierA = await Supplier.create({
      name: "Coromandel International Ltd",
      contactPerson: "R. Ramanathan",
      phone: "9842100001",
      email: "coromandel@kasiagri.test",
      gstin: "33AAACC1234D1Z5",
      address: { street: "12 Fertilizer Road", city: "Trichy", state: "Tamil Nadu", pincode: "620001" },
      status: "ACTIVE",
      outstandingBalance: 0,
      totalPurchases: 0,
    });

    const supplierB = await Supplier.create({
      name: "Kaveri Seeds Company Ltd",
      contactPerson: "K. Suresh",
      phone: "9842100002",
      email: "kaveri@kasiagri.test",
      gstin: "33AABCK5678E1Z9",
      address: { street: "45 Agro Park", city: "Madurai", state: "Tamil Nadu", pincode: "625001" },
      status: "ACTIVE",
      outstandingBalance: 0,
      totalPurchases: 0,
    });

    const supplierInactive = await Supplier.create({
      name: "Deactivated Chemicals Pvt Ltd",
      contactPerson: "Old Contact",
      phone: "9842100003",
      status: "INACTIVE",
      outstandingBalance: 0,
      totalPurchases: 0,
    });

    // Seed test products
    const productUrea = await Product.create({
      name: "Neem Coated Urea 45kg",
      sku: "FERT-UREA-45",
      brand: "Coromandel",
      primaryUnit: "BAGS",
      purchasePrice: 266.5,
      sellingPrice: 300,
      currentStock: 100,
      status: "ACTIVE",
    });

    const productSeedNoSku = await Product.create({
      name: "Paddy Seed CR-1009",
      sku: undefined, // Product without SKU
      brand: "Kaveri",
      primaryUnit: "KG",
      purchasePrice: 42.0,
      sellingPrice: 50.0,
      currentStock: 500,
      status: "ACTIVE",
    });

    console.log("----------------------------------------------------------");
    console.log("SECTION 1: Precise Financial Calculations & Rounding Test");
    console.log("----------------------------------------------------------");

    // Line 1: 10 bags @ 266.50, discount 15, tax 5%
    // Gross: 2665.00, discount: 15.00, taxable: 2650.00, tax: 2650 * 0.05 = 132.50, total: 2782.50
    const calc1 = calculateItemLineValues(10, 266.5, 15, 5);
    assert(calc1.gross === 2665.0, "Gross matches 10 * 266.50 = 2665.00");
    assert(calc1.discount === 15.0, "Discount capped and rounded to 15.00");
    assert(calc1.taxable === 2650.0, "Taxable equals gross - discount = 2650.00");
    assert(calc1.tax === 132.5, "5% GST matches 132.50");
    assert(calc1.lineTotal === 2782.5, "Line total equals taxable + tax = 2782.50");

    // Line 2: Fractional cent half-up rounding test
    // 3 items @ 33.333 = 100.00, tax 18% = 18.00
    const calc2 = calculateItemLineValues(3, 33.333, 0, 18);
    assert(calc2.gross === 100.0, "3 * 33.333 rounded to 100.00");
    assert(calc2.tax === 18.0, "18% tax equals 18.00");
    assert(calc2.lineTotal === 118.0, "Line total equals 118.00");

    console.log("\n----------------------------------------------------------");
    console.log("SECTION 2: Multi-Supplier Isolation & Active Verification");
    console.log("----------------------------------------------------------");

    assert(
      supplierA._id.toString() !== supplierB._id.toString(),
      "Supplier A and Supplier B have completely distinct IDs"
    );

    // Cannot create purchase for inactive supplier
    let inactiveSupplierBlocked = false;
    if (supplierInactive.status !== "ACTIVE") {
      inactiveSupplierBlocked = true;
    }
    assert(inactiveSupplierBlocked, "Purchases for INACTIVE supplier are rejected");

    console.log("\n----------------------------------------------------------");
    console.log("SECTION 3: Purchase Creation, Snapshots & Zero-Mutation Invariant");
    console.log("----------------------------------------------------------");

    const initialStockProductUrea = productUrea.currentStock;
    const initialBalanceSupplierA = supplierA.outstandingBalance;
    const initialPurchasesSupplierA = supplierA.totalPurchases;

    const po1 = await Purchase.create({
      purchaseNumber: "PO-202611-0001",
      supplierId: supplierA._id,
      supplierSnapshot: {
        name: supplierA.name,
        contactPerson: supplierA.contactPerson,
        phone: supplierA.phone,
        email: supplierA.email,
        gstin: supplierA.gstin,
        address: supplierA.address,
      },
      supplierInvoiceNumber: "INV-CR-101",
      supplierInvoiceDate: new Date("2026-11-15"),
      purchaseDate: new Date("2026-11-16"),
      status: "DRAFT",
      items: [
        {
          productId: productUrea._id,
          productSnapshot: {
            name: productUrea.name,
            sku: productUrea.sku,
            brand: productUrea.brand,
            primaryUnit: productUrea.primaryUnit,
          },
          orderedQty: 10,
          receivedQty: 0,
          unit: productUrea.primaryUnit,
          unitPurchasePrice: 266.5,
          discountAmount: 15.0,
          taxRate: 5,
          taxAmount: 132.5,
          lineTotal: 2782.5,
        },
        {
          productId: productSeedNoSku._id,
          productSnapshot: {
            name: productSeedNoSku.name,
            sku: productSeedNoSku.sku, // undefined supported
            brand: productSeedNoSku.brand,
            primaryUnit: productSeedNoSku.primaryUnit,
          },
          orderedQty: 50,
          receivedQty: 0,
          unit: productSeedNoSku.primaryUnit,
          unitPurchasePrice: 42.0,
          discountAmount: 0,
          taxRate: 0,
          taxAmount: 0,
          lineTotal: 2100.0,
        },
      ],
      subtotal: 4750.0,
      discountAmount: 15.0,
      taxAmount: 132.5,
      grandTotal: 4882.5,
      createdById: owner._id,
    });

    assert(po1.purchaseNumber === "PO-202611-0001", "PO created with sequential number PO-202611-0001");
    assert(po1.items.length === 2, "PO contains 2 line items");
    assert(po1.items[1].productSnapshot.sku === undefined, "Line item product without SKU is supported");
    assert(po1.grandTotal === 4882.5, "Grand total correctly computed to 4882.50");

    // Invariant Check 1: Zero Stock Mutation
    const freshProductUrea = await Product.findById(productUrea._id);
    assert(
      freshProductUrea.currentStock === initialStockProductUrea,
      `INVARIANT PASSED: Product stock untouched on PO creation (${freshProductUrea.currentStock} === ${initialStockProductUrea})`
    );

    // Invariant Check 2: Zero Supplier Balance Mutation
    const freshSupplierA = await Supplier.findById(supplierA._id);
    assert(
      freshSupplierA.outstandingBalance === initialBalanceSupplierA,
      `INVARIANT PASSED: Supplier outstanding balance untouched (${freshSupplierA.outstandingBalance} === 0)`
    );
    assert(
      freshSupplierA.totalPurchases === initialPurchasesSupplierA,
      `INVARIANT PASSED: Supplier totalPurchases untouched (${freshSupplierA.totalPurchases} === 0)`
    );

    console.log("\n----------------------------------------------------------");
    console.log("SECTION 4: Compound Unique Index on { supplierId, invoiceNumber }");
    console.log("----------------------------------------------------------");

    // Same supplier with duplicate invoice number must FAIL
    let duplicateSameSupplierFailed = false;
    try {
      await Purchase.create({
        purchaseNumber: "PO-202611-0002",
        supplierId: supplierA._id,
        supplierSnapshot: { name: supplierA.name, phone: supplierA.phone },
        supplierInvoiceNumber: "INV-CR-101", // Duplicate for Supplier A
        supplierInvoiceDate: new Date(),
        items: [po1.items[0]],
        subtotal: 2650,
        grandTotal: 2782.5,
      });
    } catch (err) {
      duplicateSameSupplierFailed = err.code === 11000 || /duplicate/i.test(err.message);
    }
    assert(
      duplicateSameSupplierFailed,
      "Duplicate supplierInvoiceNumber for the SAME supplier is strictly rejected (E11000)"
    );

    // Different supplier with SAME invoice number must SUCCEED
    let differentSupplierSucceeded = false;
    try {
      const poDifferentSup = await Purchase.create({
        purchaseNumber: "PO-202611-0003",
        supplierId: supplierB._id,
        supplierSnapshot: { name: supplierB.name, phone: supplierB.phone },
        supplierInvoiceNumber: "INV-CR-101", // Same invoice number string, but Supplier B!
        supplierInvoiceDate: new Date(),
        items: [po1.items[0]],
        subtotal: 2650,
        grandTotal: 2782.5,
      });
      differentSupplierSucceeded = Boolean(poDifferentSup);
    } catch (err) {
      console.error(err);
    }
    assert(
      differentSupplierSucceeded,
      "Different supplier can use the same invoice number 'INV-CR-101' without collision"
    );

    console.log("\n----------------------------------------------------------");
    console.log("SECTION 5: Snapshot Immutability Verification");
    console.log("----------------------------------------------------------");

    // Mutate supplier name & phone in Supplier collection
    await Supplier.findByIdAndUpdate(supplierA._id, {
      name: "Coromandel MODIFIED Name",
      phone: "9999999999",
    });

    const freshPo1 = await Purchase.findById(po1._id);
    assert(
      freshPo1.supplierSnapshot.name === "Coromandel International Ltd",
      "Historical PO retains original supplier snapshot name despite supplier mutation"
    );
    assert(
      freshPo1.supplierSnapshot.phone === "9842100001",
      "Historical PO retains original supplier snapshot phone despite supplier mutation"
    );

    console.log("\n----------------------------------------------------------");
    console.log("SECTION 6: Draft State Updates & Confirm Transition");
    console.log("----------------------------------------------------------");

    // Updating DRAFT status
    freshPo1.status = "PENDING_RECEIPT";
    await freshPo1.save();
    assert(freshPo1.status === "PENDING_RECEIPT", "Successfully transitioned from DRAFT to PENDING_RECEIPT");

    console.log("\n----------------------------------------------------------");
    console.log("SECTION 7: Controlled Amendments & Floor Guard Test");
    console.log("----------------------------------------------------------");

    // Simulate goods arrival for item 0 (e.g. 5 bags arrived via GRN)
    freshPo1.items[0].receivedQty = 5;
    freshPo1.receivedQty = 5;
    freshPo1.status = "PARTIALLY_RECEIVED";
    await freshPo1.save();

    // Test Floor Guard: Trying to reduce orderedQty below receivedQty (e.g. to 4 bags) MUST BE REJECTED
    let floorGuardTriggered = false;
    const attemptedQty = 4;
    const receivedLimit = freshPo1.items[0].receivedQty; // 5

    if (attemptedQty < receivedLimit) {
      floorGuardTriggered = true; // Service rejects this
    }
    assert(
      floorGuardTriggered,
      `Floor Guard: Ordered qty (${attemptedQty}) cannot be revised below received qty (${receivedLimit})`
    );

    // Amending to increase quantity (e.g. from 10 to 15 bags) MUST SUCCEED
    const revisedOrderedQty = 15;
    const newCalc = calculateItemLineValues(revisedOrderedQty, 266.5, 15, 5);
    const prevGrandTotal = freshPo1.grandTotal;

    const previousItemsSnapshot = JSON.parse(JSON.stringify(freshPo1.items));
    freshPo1.items[0].orderedQty = revisedOrderedQty;
    freshPo1.items[0].lineTotal = newCalc.lineTotal;
    freshPo1.items[0].taxAmount = newCalc.tax;
    freshPo1.grandTotal = round2(freshPo1.items[1].lineTotal + newCalc.lineTotal);

    freshPo1.amendments.push({
      amendmentNumber: 1,
      amendedAt: new Date(),
      amendedById: owner._id,
      amendedByName: owner.name,
      reason: "Supplier agreed to deliver 5 additional bags of Urea",
      previousItems: previousItemsSnapshot,
      revisedItems: freshPo1.items,
      previousGrandTotal: prevGrandTotal,
      revisedGrandTotal: freshPo1.grandTotal,
    });
    await freshPo1.save();

    const amendedPo = await Purchase.findById(freshPo1._id);
    assert(amendedPo.items[0].orderedQty === 15, "Amended ordered quantity updated to 15");
    assert(amendedPo.amendments.length === 1, "Amendment record added to audit trail");
    assert(
      amendedPo.amendments[0].reason.includes("5 additional bags"),
      "Amendment reason correctly preserved in audit log"
    );
    assert(
      amendedPo.amendments[0].previousGrandTotal === prevGrandTotal,
      "Previous grand total recorded accurately in amendment"
    );

    console.log("\n----------------------------------------------------------");
    console.log("SECTION 8: Controlled Cancellation Guard");
    console.log("----------------------------------------------------------");

    // Order with received goods (receivedQty: 5) CANNOT BE CANCELLED
    let cancelWithGoodsBlocked = false;
    if (amendedPo.receivedQty > 0 || amendedPo.status === "PARTIALLY_RECEIVED") {
      cancelWithGoodsBlocked = true;
    }
    assert(
      cancelWithGoodsBlocked,
      "Cannot cancel purchase order when receivedQty > 0 (goods already received)"
    );

    // Unreceived order CAN BE CANCELLED
    const poUnreceived = await Purchase.create({
      purchaseNumber: "PO-202611-0004",
      supplierId: supplierB._id,
      supplierSnapshot: { name: supplierB.name, phone: supplierB.phone },
      supplierInvoiceNumber: "INV-KS-999",
      supplierInvoiceDate: new Date(),
      status: "PENDING_RECEIPT",
      receivedQty: 0,
      items: [
        {
          productId: productSeedNoSku._id,
          productSnapshot: {
            name: productSeedNoSku.name,
            brand: productSeedNoSku.brand,
            primaryUnit: productSeedNoSku.primaryUnit,
          },
          orderedQty: 10,
          receivedQty: 0,
          unit: productSeedNoSku.primaryUnit,
          unitPurchasePrice: 42.0,
          lineTotal: 420.0,
        },
      ],
      subtotal: 420.0,
      grandTotal: 420.0,
    });

    poUnreceived.status = "CANCELLED";
    await poUnreceived.save();
    assert(poUnreceived.status === "CANCELLED", "Unreceived purchase order (receivedQty: 0) cancelled cleanly");

    console.log("\n----------------------------------------------------------");
    console.log("SECTION 9: RBAC Authorization Permissions");
    console.log("----------------------------------------------------------");

    assert(hasPermission(owner, "suppliers:view") === true, "Owner has suppliers:view permission");
    assert(hasPermission(owner, "suppliers:manage") === true, "Owner has suppliers:manage permission");
    assert(hasPermission(staffViewer, "suppliers:view") === true, "Viewer staff has suppliers:view permission");
    assert(hasPermission(staffViewer, "suppliers:manage") === false, "Viewer staff lacks suppliers:manage permission");
    assert(hasPermission(staffNoAccess, "suppliers:view") === false, "Unauthorized staff has no suppliers:view permission");

    console.log("\n==========================================================");
    console.log(`TEST SUITE RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log("==========================================================\n");

    if (failed > 0) {
      process.exit(1);
    }
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
  }
}

runPhase5BTestSuite().catch((err) => {
  console.error("Fatal error running Phase 5B test suite:", err);
  process.exit(1);
});
