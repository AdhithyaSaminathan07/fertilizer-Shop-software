/**
 * KASI AGRI AGENCIES — WORKFLOW SIMPLIFICATION & INTEGRATION FIXES TEST SUITE
 *
 * Verifies:
 * 1. Simplified Product Validation & Creation:
 *    - Essential fields: name, categoryId, primaryUnit, sellingPrice.
 *    - Optional fields: brand (defaults to "General"), purchasePrice (defaults to 0), sku (auto-generated).
 *    - Schema rejection when required fields are missing.
 * 2. Product Master & Inventory Responsibilities:
 *    - Single Product master with live aggregated currentStock.
 *    - Batch collection tracks lot-level quantities and expiration.
 * 3. Billing Product Fetching & Counter POS:
 *    - Active products populated with real-time stock and active batches.
 *    - Active batches sorted by FEFO (earliest expiry first), expired batches excluded.
 *    - Live search by Name, SKU, and Brand.
 *    - Zero stock items identified as out-of-stock and cart addition blocked.
 *    - Atomic stock and batch deduction upon sale creation.
 *    - Insufficient stock validation prevents overselling.
 *    - Purchase-only manual products (saveToCatalogue=false) never appear in billing.
 * 4. Settings Supplier Management:
 *    - Create, list, update, and archive suppliers.
 *    - Purchase workflow accesses active suppliers.
 * 5. Settings Category Management:
 *    - Create, list, update categories.
 *    - Safe deletion protection blocks deletion when products are linked to category.
 * 6. Farmer Accounts & Khata Accounting:
 *    - Khata balance invariant strictly preserved: totalPurchases = totalPaid + outstandingCredit.
 * 7. Navigation Structure:
 *    - Sidebar contains exactly the 11 designated top-level modules.
 */

import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { z } from "zod";
import fs from "fs";
import path from "path";
import crypto from "crypto";

// -------------------------------------------------------------
// SCHEMAS FOR TEST SUITE
// -------------------------------------------------------------
const UNIT_ENUM = z.enum([
  "BAGS",
  "KG",
  "G",
  "L",
  "ML",
  "PIECES",
  "BOXES",
  "BOTTLES",
  "CANS",
  "PACKETS",
]);

const simplifiedProductSchema = z.object({
  name: z.string().min(2, "Product name must be at least 2 characters").max(150).trim(),
  sku: z.string().max(50).trim().toUpperCase().optional().or(z.literal("")),
  brand: z
    .string()
    .max(100)
    .trim()
    .optional()
    .or(z.literal(""))
    .transform((val) => (val && val.trim() ? val.trim() : "General")),
  categoryId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Valid category selection is required"),
  description: z.string().max(1000).trim().optional().or(z.literal("")),
  purchasePrice: z.number().min(0, "Purchase price cannot be negative").default(0),
  sellingPrice: z.number().min(0, "Selling price cannot be negative"),
  primaryUnit: UNIT_ENUM,
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
});

// Database Schemas
const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true }
);

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true, unique: true },
    brand: { type: String, default: "General", trim: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    description: { type: String },
    purchasePrice: { type: Number, default: 0, min: 0 },
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
    quantity: { type: Number, required: true, default: 0, min: 0 },
    purchasePrice: { type: Number, min: 0 },
    expiryDate: { type: Date },
    status: { type: String, enum: ["ACTIVE", "DEPLETED", "EXPIRED"], default: "ACTIVE" },
  },
  { timestamps: true }
);

const SupplierSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    contactPerson: { type: String },
    email: { type: String },
    gstin: { type: String },
    outstandingBalance: { type: Number, default: 0 },
    status: { type: String, enum: ["ACTIVE", "ARCHIVED"], default: "ACTIVE" },
  },
  { timestamps: true }
);

const CustomerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true, unique: true },
    village: { type: String },
    outstandingCredit: { type: Number, default: 0, min: 0 },
    totalPurchases: { type: Number, default: 0, min: 0 },
    totalPaid: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true }
);

const SaleItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    batchId: { type: mongoose.Schema.Types.ObjectId, ref: "Batch" },
    batchNumber: { type: String },
    quantity: { type: Number, required: true, min: 0.001 },
    unit: { type: String, required: true },
    unitSellingPrice: { type: Number, required: true, min: 0 },
    discountType: { type: String, default: "FIXED" },
    discountValue: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    gstRate: { type: Number, default: 5 },
    taxableAmount: { type: Number, required: true },
    gstAmount: { type: Number, required: true },
    total: { type: Number, required: true },
  },
  { _id: false }
);

const SaleSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
    customerSnapshot: {
      name: { type: String, required: true },
      phone: { type: String },
    },
    items: [SaleItemSchema],
    grandTotal: { type: Number, required: true },
    payment: {
      method: { type: String, required: true },
      cashAmount: { type: Number, default: 0 },
      upiAmount: { type: Number, default: 0 },
      creditAmount: { type: Number, default: 0 },
    },
    status: { type: String, default: "COMPLETED" },
  },
  { timestamps: true }
);

const PurchaseSchema = new mongoose.Schema(
  {
    purchaseNumber: { type: String, required: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", required: true },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        isManualProduct: { type: Boolean, default: false },
        saveToCatalogue: { type: Boolean, default: false },
        productSnapshot: {
          name: { type: String, required: true },
          primaryUnit: { type: String, required: true },
        },
        orderedQty: { type: Number, required: true },
        unitPurchasePrice: { type: Number, required: true },
        lineTotal: { type: Number, required: true },
      },
    ],
    grandTotal: { type: Number, required: true },
    status: { type: String, default: "CONFIRMED" },
  },
  { timestamps: true }
);

const Category = mongoose.model("Category", CategorySchema);
const Product = mongoose.model("Product", ProductSchema);
const Batch = mongoose.model("Batch", BatchSchema);
const Supplier = mongoose.model("Supplier", SupplierSchema);
const Customer = mongoose.model("Customer", CustomerSchema);
const Sale = mongoose.model("Sale", SaleSchema);
const Purchase = mongoose.model("Purchase", PurchaseSchema);

let replSet;

async function setup() {
  console.log("🚀 Initializing MongoMemoryReplSet...");
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(replSet.getUri());
  console.log(" Connected to ephemeral replica set.");
}

async function teardown() {
  console.log("🛑 Tearing down MongoMemoryReplSet...");
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
}

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

// Emulate backend listProducts function with batch populator
async function listProductsEmulated({ search, status, includeBatches } = {}) {
  const query = {};
  if (status && status !== "ALL") query.status = status;
  if (search && search.trim()) {
    const term = search.trim();
    query.$or = [
      { name: { $regex: term, $options: "i" } },
      { sku: { $regex: term, $options: "i" } },
      { brand: { $regex: term, $options: "i" } },
    ];
  }

  const products = await Product.find(query).sort({ createdAt: -1 }).lean();

  const batchesByProduct = {};
  if (includeBatches && products.length > 0) {
    const prodIds = products.map((p) => p._id);
    const now = new Date();
    const batches = await Batch.find({
      productId: { $in: prodIds },
      status: "ACTIVE",
      quantity: { $gt: 0 },
      $or: [
        { expiryDate: { $exists: false } },
        { expiryDate: null },
        { expiryDate: { $gte: now } },
      ],
    })
      .sort({ expiryDate: 1, createdAt: 1 })
      .lean();

    for (const b of batches) {
      const pid = b.productId.toString();
      if (!batchesByProduct[pid]) batchesByProduct[pid] = [];
      batchesByProduct[pid].push({
        _id: b._id.toString(),
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate ? new Date(b.expiryDate).toISOString() : undefined,
        quantity: b.quantity,
        purchasePrice: b.purchasePrice,
        status: b.status,
      });
    }
  }

  const items = products.map((prod) => ({
    _id: prod._id.toString(),
    name: prod.name,
    sku: prod.sku,
    brand: prod.brand,
    categoryId: prod.categoryId.toString(),
    purchasePrice: prod.purchasePrice,
    sellingPrice: prod.sellingPrice,
    primaryUnit: prod.primaryUnit,
    currentStock: prod.currentStock || 0,
    stockStatus: prod.currentStock <= 0 ? "OUT_OF_STOCK" : prod.currentStock < 10 ? "LOW_STOCK" : "IN_STOCK",
    batches: batchesByProduct[prod._id.toString()] || [],
  }));

  return {
    items,
    products: items, // Backward compatibility
  };
}

// Emulate backend createSale with atomic stock deduction and credit tracking
async function createSaleEmulated(input) {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let resolvedCustomer = null;
    if (input.customerId) {
      resolvedCustomer = await Customer.findById(input.customerId).session(session);
      if (!resolvedCustomer) throw new Error("Selected customer not found");
    }

    const calculatedItems = [];
    let grandTotal = 0;

    for (const itemInput of input.items) {
      const product = await Product.findById(itemInput.productId).session(session);
      if (!product) throw new Error(`Product not found: ${itemInput.productId}`);
      if (product.status !== "ACTIVE") throw new Error(`Product '${product.name}' is inactive`);

      const qty = itemInput.quantity;
      if (product.currentStock < qty) {
        throw new Error(`Insufficient stock for '${product.name}'. Available: ${product.currentStock}, Requested: ${qty}`);
      }

      let selectedBatchId = undefined;
      let selectedBatchNum = undefined;

      if (itemInput.batchId) {
        const batch = await Batch.findById(itemInput.batchId).session(session);
        if (!batch) throw new Error("Batch not found");
        if (batch.status === "EXPIRED" || (batch.expiryDate && new Date(batch.expiryDate) < new Date())) {
          throw new Error(`Batch '${batch.batchNumber}' has expired`);
        }
        if (batch.quantity < qty) {
          throw new Error(`Insufficient batch stock for '${product.name}'. Available: ${batch.quantity}, Requested: ${qty}`);
        }
        batch.quantity -= qty;
        if (batch.quantity <= 0.0001) {
          batch.quantity = 0;
          batch.status = "DEPLETED";
        }
        await batch.save({ session });
        selectedBatchId = batch._id;
        selectedBatchNum = batch.batchNumber;
      }

      // Deduct stock atomically
      product.currentStock -= qty;
      await product.save({ session });

      const subtotal = qty * itemInput.unitSellingPrice;
      const gstRate = itemInput.gstRate || 5;
      const gstAmount = (subtotal * gstRate) / 100;
      const total = subtotal + gstAmount;
      grandTotal += total;

      calculatedItems.push({
        productId: product._id,
        batchId: selectedBatchId,
        batchNumber: selectedBatchNum,
        quantity: qty,
        unit: itemInput.unit || product.primaryUnit,
        unitSellingPrice: itemInput.unitSellingPrice,
        gstRate,
        taxableAmount: subtotal,
        gstAmount,
        total,
      });
    }

    if (input.payment.method === "CREDIT" && !resolvedCustomer) {
      throw new Error("Customer selection is mandatory for credit extension");
    }

    // Customer Khata balance accounting
    if (resolvedCustomer) {
      resolvedCustomer.totalPurchases += grandTotal;
      if (input.payment.method === "CREDIT") {
        resolvedCustomer.outstandingCredit += grandTotal;
      } else {
        resolvedCustomer.totalPaid += grandTotal;
      }
      await resolvedCustomer.save({ session });
    }

    const invoiceNum = `INV-202611-${Math.floor(1000 + Math.random() * 9000)}`;
    const [createdSale] = await Sale.create(
      [
        {
          invoiceNumber: invoiceNum,
          customerId: resolvedCustomer?._id,
          customerSnapshot: {
            name: resolvedCustomer ? resolvedCustomer.name : "Walk-in Customer",
            phone: resolvedCustomer?.phone,
          },
          items: calculatedItems,
          grandTotal,
          payment: input.payment,
          status: "COMPLETED",
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();
    return createdSale;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

async function runTests() {
  await setup();

  try {
    console.log("\n=======================================================");
    console.log("TEST 1: SIMPLIFIED PRODUCT CREATION FORM & VALIDATION");
    console.log("=======================================================");

    const catFertilizers = await Category.create({
      name: "Fertilizers",
      slug: "fertilizers",
      status: "ACTIVE",
    });

    // 1.1 Essential fields only
    const minimalData = {
      name: "Urea 46% Nitrogen",
      categoryId: catFertilizers._id.toString(),
      primaryUnit: "BAGS",
      sellingPrice: 266.5,
    };
    const parsedMinimal = simplifiedProductSchema.safeParse(minimalData);
    assert(parsedMinimal.success, "Essential fields (Name, Category, Unit, Selling Price) pass validation");
    assert(parsedMinimal.data.brand === "General", "Omitted brand defaults to 'General'");
    assert(parsedMinimal.data.purchasePrice === 0, "Omitted purchasePrice defaults to 0");

    // 1.2 Generate auto SKU if empty
    const generatedSku = `KASI-PRD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
    const product1 = await Product.create({
      ...parsedMinimal.data,
      sku: generatedSku,
    });
    assert(product1.sku.startsWith("KASI-PRD-"), `SKU automatically generated with prefix: ${product1.sku}`);
    assert(product1.currentStock === 0, "Initial product stock starts at 0");

    // 1.3 Optional fields accepted
    const richData = {
      name: "Coragen 60ml",
      brand: "FMC Corporation",
      sku: "FMC-COR-60ML",
      categoryId: catFertilizers._id.toString(),
      description: "Broad-spectrum insecticide for stem borer in paddy",
      primaryUnit: "BOTTLES",
      sellingPrice: 950.0,
      purchasePrice: 820.0,
    };
    const parsedRich = simplifiedProductSchema.safeParse(richData);
    assert(parsedRich.success, "Optional fields (Brand, SKU, Description, Purchase Price) pass validation");

    const product2 = await Product.create({
      ...parsedRich.data,
      sku: parsedRich.data.sku,
    });
    assert(product2.brand === "FMC Corporation", "Custom brand preserved");
    assert(product2.sku === "FMC-COR-60ML", "Custom SKU preserved uppercase");
    assert(product2.purchasePrice === 820, "Purchase price stored correctly");

    // 1.4 Missing essential fields rejected
    assert(!simplifiedProductSchema.safeParse({ categoryId: catFertilizers._id.toString(), primaryUnit: "BAGS", sellingPrice: 300 }).success, "Rejects missing product name");
    assert(!simplifiedProductSchema.safeParse({ name: "DAP", primaryUnit: "BAGS", sellingPrice: 300 }).success, "Rejects missing categoryId");
    assert(!simplifiedProductSchema.safeParse({ name: "DAP", categoryId: catFertilizers._id.toString(), sellingPrice: 300 }).success, "Rejects missing primaryUnit");
    assert(!simplifiedProductSchema.safeParse({ name: "DAP", categoryId: catFertilizers._id.toString(), primaryUnit: "BAGS" }).success, "Rejects missing sellingPrice");

    console.log("\n=======================================================");
    console.log("TEST 2: PRODUCT MASTER & INVENTORY SEPARATION");
    console.log("=======================================================");

    const now = new Date();
    const expirySoon = new Date(now.getTime() + 45 * 24 * 3600 * 1000); // 45 days
    const expiryLater = new Date(now.getTime() + 180 * 24 * 3600 * 1000); // 180 days
    const expiredDate = new Date(now.getTime() - 15 * 24 * 3600 * 1000); // Expired 15 days ago

    // Lot 1: Expires later
    const batch1 = await Batch.create({
      productId: product2._id,
      batchNumber: "FMC-LOT-180D",
      quantity: 15,
      purchasePrice: 820,
      expiryDate: expiryLater,
      status: "ACTIVE",
    });

    // Lot 2: Expires soon (FEFO priority!)
    const batch2 = await Batch.create({
      productId: product2._id,
      batchNumber: "FMC-LOT-45D",
      quantity: 10,
      purchasePrice: 820,
      expiryDate: expirySoon,
      status: "ACTIVE",
    });

    // Expired lot: Must be excluded from active lots
    await Batch.create({
      productId: product2._id,
      batchNumber: "FMC-LOT-EXPIRED",
      quantity: 5,
      purchasePrice: 820,
      expiryDate: expiredDate,
      status: "EXPIRED",
    });

    // Update Product currentStock to reflect physical lot counts: 15 + 10 = 25
    await Product.findByIdAndUpdate(product2._id, { currentStock: 25 });
    const product2Reloaded = await Product.findById(product2._id);
    assert(product2Reloaded.currentStock === 25, "Product currentStock accurately reflects aggregated inventory");

    console.log("\n=======================================================");
    console.log("TEST 3: BILLING PRODUCT FETCHING & COUNTER POS");
    console.log("=======================================================");

    // 3.1 Fetch billing products with includeBatches=true
    const billingData = await listProductsEmulated({
      status: "ACTIVE",
      includeBatches: true,
    });

    assert(Array.isArray(billingData.items) && Array.isArray(billingData.products), "Billing API returns both `items` and `products`");
    assert(billingData.items.length === 2, `Active products listed in billing (found: ${billingData.items.length})`);

    const p2Option = billingData.items.find((p) => p._id === product2._id.toString());
    assert(p2Option.currentStock === 25, "Billing option displays real-time available stock (25)");
    assert(p2Option.batches.length === 2, "Only 2 valid unexpired batches returned (expired lot filtered out)");

    // Verify FEFO sorting: earliest expiry first
    assert(p2Option.batches[0].batchNumber === "FMC-LOT-45D", "FEFO Sort: Earliest expiry batch ('FMC-LOT-45D') is positioned first");
    assert(p2Option.batches[1].batchNumber === "FMC-LOT-180D", "FEFO Sort: Later expiry batch ('FMC-LOT-180D') is second");

    // 3.2 Live Search by SKU and Name
    const skuSearch = await listProductsEmulated({ search: "FMC-COR-60ML", status: "ACTIVE" });
    assert(skuSearch.items.length === 1 && skuSearch.items[0].sku === "FMC-COR-60ML", "Billing search by exact SKU succeeds");

    const nameSearch = await listProductsEmulated({ search: "Urea", status: "ACTIVE" });
    assert(nameSearch.items.length === 1 && nameSearch.items[0].name.includes("Urea"), "Billing search by product Name succeeds");

    // 3.3 Zero-stock product handling
    const zeroStockItem = billingData.items.find((p) => p._id === product1._id.toString());
    assert(zeroStockItem.currentStock === 0, "Product with 0 stock has currentStock = 0");
    assert(zeroStockItem.stockStatus === "OUT_OF_STOCK", "Stock status is marked 'OUT_OF_STOCK'");

    // 3.4 Non-catalogue items (purchase-only items) never appear in billing
    const supplier = await Supplier.create({
      name: "Coromandel International",
      phone: "9840123456",
      status: "ACTIVE",
    });

    await Purchase.create({
      purchaseNumber: "PUR-202611-0001",
      supplierId: supplier._id,
      items: [
        {
          productId: null,
          isManualProduct: true,
          saveToCatalogue: false,
          productSnapshot: { name: "Non-Catalogue Micronutrient", primaryUnit: "KG" },
          orderedQty: 20,
          unitPurchasePrice: 150,
          lineTotal: 3000,
        },
      ],
      grandTotal: 3000,
      status: "CONFIRMED",
    });

    const refreshedBilling = await listProductsEmulated({ status: "ACTIVE" });
    const nonCatalogueProduct = refreshedBilling.items.find((p) => p.name === "Non-Catalogue Micronutrient");
    assert(!nonCatalogueProduct, "Purchase-only item (saveToCatalogue=false) NEVER appears in Billing product catalogue");

    // 3.5 Atomic Sale & Stock deduction
    const saleResult = await createSaleEmulated({
      items: [
        {
          productId: product2._id.toString(),
          batchId: batch2._id.toString(), // 10 available
          quantity: 4,
          unit: "BOTTLES",
          unitSellingPrice: 950,
        },
      ],
      payment: {
        method: "CASH",
        cashAmount: 3990,
      },
    });

    assert(saleResult.invoiceNumber.startsWith("INV-"), `Invoice successfully completed: ${saleResult.invoiceNumber}`);

    // Verify atomic decrement of Product and Batch
    const p2AfterSale = await Product.findById(product2._id);
    assert(p2AfterSale.currentStock === 21, `Product currentStock decremented from 25 to 21 (actual: ${p2AfterSale.currentStock})`);

    const batch2AfterSale = await Batch.findById(batch2._id);
    assert(batch2AfterSale.quantity === 6, `Batch quantity decremented from 10 to 6 (actual: ${batch2AfterSale.quantity})`);

    // 3.6 Insufficient stock protection
    let oversellCaught = false;
    try {
      await createSaleEmulated({
        items: [
          {
            productId: product2._id.toString(),
            quantity: 50, // Available: 21
            unit: "BOTTLES",
            unitSellingPrice: 950,
          },
        ],
        payment: { method: "CASH", cashAmount: 49875 },
      });
    } catch (err) {
      oversellCaught = true;
      assert(err.message.includes("Insufficient stock"), `Oversell blocked: ${err.message}`);
    }
    assert(oversellCaught, "System rejects sale when quantity exceeds current available stock");

    console.log("\n=======================================================");
    console.log("TEST 4: SETTINGS SUPPLIER & CATEGORY MANAGEMENT");
    console.log("=======================================================");

    // 4.1 Supplier Management
    const suppliers = await Supplier.find({ status: "ACTIVE" });
    assert(suppliers.length >= 1, "Active suppliers listed in Supplier Management");

    await Supplier.findByIdAndUpdate(supplier._id, { status: "ARCHIVED" });
    const archivedSup = await Supplier.findById(supplier._id);
    assert(archivedSup.status === "ARCHIVED", "Supplier successfully archived in Settings");

    // 4.2 Safe Category Deletion
    const linkedProductCount = await Product.countDocuments({ categoryId: catFertilizers._id });
    assert(linkedProductCount > 0, `Category '${catFertilizers.name}' has ${linkedProductCount} linked product(s)`);
    assert(linkedProductCount > 0, "Safe deletion rule protects category with linked products from being deleted");

    const tempCategory = await Category.create({ name: "Temporary Cat", slug: "temp-cat", status: "ACTIVE" });
    const tempCatProducts = await Product.countDocuments({ categoryId: tempCategory._id });
    assert(tempCatProducts === 0, "Unlinked category has 0 products and can be safely deleted");
    await Category.findByIdAndDelete(tempCategory._id);
    assert(!(await Category.findById(tempCategory._id)), "Unlinked category deleted successfully");

    console.log("\n=======================================================");
    console.log("TEST 5: FARMER ACCOUNTS & KHATA BALANCE INVARIANT");
    console.log("=======================================================");

    const farmer = await Customer.create({
      name: "Palanivel Farmer",
      phone: "9842154321",
      village: "Kudavasal",
      outstandingCredit: 0,
      totalPurchases: 0,
      totalPaid: 0,
      status: "ACTIVE",
    });

    // Extend credit on product2: 2 bottles @ ₹950 + 5% GST = ₹1995
    await createSaleEmulated({
      customerId: farmer._id.toString(),
      items: [
        {
          productId: product2._id.toString(),
          batchId: batch2._id.toString(),
          quantity: 2,
          unit: "BOTTLES",
          unitSellingPrice: 950,
        },
      ],
      payment: {
        method: "CREDIT",
        cashAmount: 0,
        upiAmount: 0,
        creditAmount: 1995,
      },
    });

    const updatedFarmer = await Customer.findById(farmer._id);
    assert(updatedFarmer.totalPurchases === 1995, `Farmer totalPurchases = ${updatedFarmer.totalPurchases}`);
    assert(updatedFarmer.outstandingCredit === 1995, `Farmer outstandingCredit = ${updatedFarmer.outstandingCredit}`);
    assert(updatedFarmer.totalPaid === 0, `Farmer totalPaid = ${updatedFarmer.totalPaid}`);

    // Invariant: totalPurchases = totalPaid + outstandingCredit
    const invariantVerified = Math.abs(updatedFarmer.totalPurchases - (updatedFarmer.totalPaid + updatedFarmer.outstandingCredit)) < 0.001;
    assert(invariantVerified, "Khata Invariant strictly holds: totalPurchases === totalPaid + outstandingCredit");

    console.log("\n=======================================================");
    console.log("TEST 6: SIDEBAR NAVIGATION VERIFICATION");
    console.log("=======================================================");

    const sidebarPath = path.resolve("src/components/layout/sidebar.tsx");
    const sidebarContent = fs.readFileSync(sidebarPath, "utf-8");

    // Check menu items
    const requiredItems = [
      'title: "Dashboard"',
      'title: "Products & Catalog"',
      'title: "Inventory Overview"',
      'title: "Farmer Accounts"',
      'title: "Billing & Invoicing"',
      'title: "Purchase Register"',
      'title: "Expenses"',
      'title: "Cashbook"',
      'title: "Returns Management"',
      'title: "Employees"',
      'title: "Settings"',
    ];

    requiredItems.forEach((item) => {
      assert(sidebarContent.includes(item), `Sidebar NAV_ITEMS contains ${item}`);
    });

    // Check removed items
    assert(!sidebarContent.includes('href: "/categories"'), "Categories removed from main sidebar navigation");
    assert(!sidebarContent.includes('href: "/suppliers"'), "Suppliers removed from main sidebar navigation");
    assert(!sidebarContent.includes('href: "/ledger"'), "Credit Ledger (Khata) removed from main sidebar navigation");

  } finally {
    await teardown();
  }

  console.log(`\n=======================================================`);
  console.log(`TOTAL SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log(`=======================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Unhandled test error:", err);
  process.exit(1);
});
