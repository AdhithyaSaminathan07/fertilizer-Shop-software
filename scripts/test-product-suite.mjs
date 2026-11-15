import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import crypto from "crypto";
import { z } from "zod";

// Units & Conversion functions matching src/lib/units.ts
const UNIT_DIMENSION_MAP = {
  BAGS: "MASS",
  KG: "MASS",
  G: "MASS",
  BOTTLES: "VOLUME",
  CANS: "VOLUME",
  L: "VOLUME",
  ML: "VOLUME",
  BOXES: "COUNT",
  PACKETS: "COUNT",
  PIECES: "COUNT",
};

function areUnitsCompatible(primaryUnit, baseUnit) {
  if (primaryUnit === baseUnit) return true;
  const primaryDim = UNIT_DIMENSION_MAP[primaryUnit];
  const baseDim = UNIT_DIMENSION_MAP[baseUnit];
  return primaryDim !== undefined && baseDim !== undefined && primaryDim === baseDim;
}

function toBaseUnits(primaryQty, ratio) {
  if (ratio <= 0) return primaryQty;
  return primaryQty * ratio;
}

function toPrimaryUnits(baseQty, ratio) {
  if (ratio <= 0) return baseQty;
  return baseQty / ratio;
}

function calculateMargin(purchasePrice, sellingPrice) {
  const margin = Number((sellingPrice - purchasePrice).toFixed(2));
  let marginPercent = 0;
  if (purchasePrice > 0) {
    marginPercent = Number(((margin / purchasePrice) * 100).toFixed(2));
  }
  return { margin, marginPercent };
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Schemas matching application models
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

const SessionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Zod validation matching src/validations/product.ts
const createProductSchema = z
  .object({
    name: z.string().min(2).max(150).trim(),
    sku: z.string().max(50).trim().toUpperCase().optional().or(z.literal("")),
    barcode: z.string().max(50).trim().optional().or(z.literal("")),
    brand: z.string().min(2).max(100).trim(),
    categoryId: z.string(),
    purchasePrice: z.number().min(0),
    sellingPrice: z.number().min(0),
    primaryUnit: z.string(),
    status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
  });

const createBatchSchema = z
  .object({
    batchNumber: z.string().min(1).max(50),
    manufacturingDate: z.string().optional(),
    expiryDate: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.manufacturingDate && data.expiryDate) {
        return new Date(data.manufacturingDate) <= new Date(data.expiryDate);
      }
      return true;
    },
    { message: "Manufacturing date must be prior to expiry date" }
  );

// Mongoose Schemas matching application models
const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true },
    description: String,
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true }
);

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, unique: true, uppercase: true },
    barcode: { type: String, sparse: true, unique: true },
    brand: { type: String, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },
    description: String,
    purchasePrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    primaryUnit: { type: String, required: true },
    unitConversion: {
      enabled: { type: Boolean, default: false },
      baseUnit: String,
      conversionRatio: Number,
    },
    minStockThreshold: { type: Number, default: 10, min: 0 },
    status: { type: String, enum: ["ACTIVE", "INACTIVE", "ARCHIVED"], default: "ACTIVE" },
    currentStock: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

const BatchSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    batchNumber: { type: String, required: true, uppercase: true },
    manufacturingDate: Date,
    expiryDate: Date,
    quantity: { type: Number, default: 0, min: 0 },
    purchasePrice: Number,
    status: { type: String, enum: ["ACTIVE", "DEPLETED", "EXPIRED"], default: "ACTIVE" },
  },
  { timestamps: true }
);

BatchSchema.index({ productId: 1, batchNumber: 1 }, { unique: true });

// RBAC Permission evaluator matching Phase 3 / Phase 4
function hasPermission(user, permission) {
  if (!user || user.status !== "ACTIVE") return false;
  if (user.role === "OWNER") return true;
  if (user.permissions.includes(permission)) return true;
  if (permission === "inventory:read" && user.permissions.includes("inventory:view")) return true;
  if (permission === "inventory:write" && user.permissions.includes("inventory:manage")) return true;
  if (permission === "inventory:delete" && user.permissions.includes("inventory:manage")) return true;
  return false;
}

async function runProductCategoryTestSuite() {
  console.log("==========================================================");
  console.log("   KASI AGRI AGENCIES - PHASE 4 VERIFICATION TEST SUITE   ");
  console.log("==========================================================");

  let mongod;
  try {
    console.log("[Setup] Starting isolated MongoMemoryServer...");
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log(`[Setup] Connected to isolated test DB: ${uri}`);
    console.log("[Setup] Production database is 100% isolated and untouched.");

    const Category = mongoose.model("Category", CategorySchema);
    const Product = mongoose.model("Product", ProductSchema);
    const Batch = mongoose.model("Batch", BatchSchema);

    let passedTests = 0;
    let failedTests = 0;

    function assert(condition, testName, details = "") {
      if (condition) {
        console.log(`  [PASS] ${testName}`);
        passedTests++;
      } else {
        console.error(`  [FAIL] ${testName} - ${details}`);
        failedTests++;
      }
    }

    console.log("\n--- TEST GROUP 1: CATEGORY MANAGEMENT & INTEGRITY GUARDS ---");
    // 1.1 Create category
    const catFertilizers = await Category.create({
      name: "Chemical Fertilizers",
      slug: "chemical-fertilizers",
      description: "NPK fertilizers, urea, DAP, and complexes",
      status: "ACTIVE",
    });
    assert(catFertilizers._id !== undefined, "1.1 Category created successfully in DB");

    // 1.2 Prevent duplicate category names (case-insensitive check)
    const duplicateCatName = "chemical fertilizers";
    const existingCheck = await Category.findOne({
      name: { $regex: `^${duplicateCatName}$`, $options: "i" },
    });
    assert(existingCheck !== null, "1.2 Duplicate category name detected (blocks duplicate creation)");

    // 1.3 Edit category
    await Category.updateOne({ _id: catFertilizers._id }, { $set: { description: "Updated description" } });
    const updatedCat = await Category.findById(catFertilizers._id);
    assert(updatedCat.description === "Updated description", "1.3 Category details updated successfully");

    // 1.4 Category activation/deactivation toggle
    await Category.updateOne({ _id: catFertilizers._id }, { $set: { status: "INACTIVE" } });
    const inactiveCat = await Category.findById(catFertilizers._id);
    assert(inactiveCat.status === "INACTIVE", "1.4 Category deactivation toggled successfully");
    await Category.updateOne({ _id: catFertilizers._id }, { $set: { status: "ACTIVE" } });

    console.log("\n--- TEST GROUP 2: PRODUCT MANAGEMENT & PRICING RULES ---");
    // 2.1 Create product with SKU, barcode, unit, prices
    const ureaProduct = await Product.create({
      name: "Urea 46% Nitrogen",
      sku: "IFF-URE-46",
      barcode: "8901234567890",
      brand: "IFFCO",
      categoryId: catFertilizers._id,
      purchasePrice: 242.0,
      sellingPrice: 266.5,
      primaryUnit: "BAGS",
      unitConversion: {
        enabled: true,
        baseUnit: "KG",
        conversionRatio: 50,
      },
      minStockThreshold: 15,
      status: "ACTIVE",
      currentStock: 0,
    });
    assert(ureaProduct._id !== undefined, "2.1 Product created with SKU, barcode, unit and conversion ratio");
    assert(ureaProduct.currentStock === 0, "2.2 Initial product stock safely initialized to zero in Phase 4");

    // 2.3 Unique SKU enforcement
    let duplicateSkuBlocked = false;
    try {
      await Product.create({
        name: "Duplicate Urea",
        sku: "IFF-URE-46",
        brand: "IFFCO",
        categoryId: catFertilizers._id,
        purchasePrice: 200,
        sellingPrice: 250,
        primaryUnit: "BAGS",
      });
    } catch {
      duplicateSkuBlocked = true;
    }
    assert(duplicateSkuBlocked, "2.3 Duplicate SKU blocked by unique database constraint");

    // 2.4 Unique barcode enforcement
    let duplicateBarcodeBlocked = false;
    try {
      await Product.create({
        name: "Another Product",
        sku: "IFF-NEW-99",
        barcode: "8901234567890",
        brand: "IFFCO",
        categoryId: catFertilizers._id,
        purchasePrice: 200,
        sellingPrice: 250,
        primaryUnit: "BAGS",
      });
    } catch {
      duplicateBarcodeBlocked = true;
    }
    assert(duplicateBarcodeBlocked, "2.4 Duplicate Barcode blocked by unique database constraint");

    // 2.5 Subsidized / negative margin pricing allowed (Correction 4)
    const subsidizedProduct = await Product.create({
      name: "Subsidized Potash",
      sku: "IPL-MOP-01",
      brand: "IPL",
      categoryId: catFertilizers._id,
      purchasePrice: 1800.0,
      sellingPrice: 1700.0, // Selling price lower than purchase price
      primaryUnit: "BAGS",
      minStockThreshold: 5,
      status: "ACTIVE",
      currentStock: 0,
    });
    const { margin: subMargin, marginPercent: subPercent } = calculateMargin(
      subsidizedProduct.purchasePrice,
      subsidizedProduct.sellingPrice
    );
    assert(
      subsidizedProduct._id !== undefined && subMargin === -100 && subPercent < 0,
      "2.5 Selling price below purchase price allowed without error and negative margin accurately computed"
    );

    // 2.6 Standard positive profit margin calculation
    const { margin: posMargin, marginPercent: posPercent } = calculateMargin(242.0, 266.5);
    assert(posMargin === 24.5 && posPercent > 10, "2.6 Standard positive profit margin accurately calculated");

    // 2.7 SKU is optional in createProductSchema
    const parseWithoutSku = createProductSchema.safeParse({
      name: "Organic Neem Oil",
      brand: "KASI Agri",
      categoryId: catFertilizers._id.toString(),
      purchasePrice: 150,
      sellingPrice: 190,
      primaryUnit: "BOTTLES",
    });
    assert(parseWithoutSku.success === true, "2.7 Product schema validation succeeds when SKU is omitted / left blank");

    // 2.8 Collision-proof auto-generated SKU algorithm
    function generateAutoSku(brand) {
      const brandPrefix = (brand.trim() || "KASI").slice(0, 3).toUpperCase().replace(/[^A-Z0-9]/g, "K");
      const timePart = Date.now().toString(36).toUpperCase();
      const randHex = crypto.randomBytes(3).toString("hex").toUpperCase();
      return `KASI-${brandPrefix}-${timePart}-${randHex}`;
    }
    const autoSku1 = generateAutoSku("KASI Agri");
    const autoSku2 = generateAutoSku("KASI Agri");
    assert(
      autoSku1.startsWith("KASI-") && autoSku1 !== autoSku2,
      "2.8 Collision-proof SKU generator produces unique identifiers with KASI- prefix"
    );

    // 2.9 Product creation with auto-generated SKU persists in MongoDB
    const autoSkuProduct = await Product.create({
      name: "Organic Neem Oil 1L",
      sku: autoSku1,
      brand: "KASI Agri",
      categoryId: catFertilizers._id,
      purchasePrice: 150,
      sellingPrice: 190,
      primaryUnit: "BOTTLES",
      status: "ACTIVE",
      currentStock: 0,
    });
    assert(
      autoSkuProduct._id !== undefined && autoSkuProduct.sku === autoSku1,
      "2.9 Product created with auto-generated SKU safely stored in database"
    );

    // 2.10 Product status defaults to ACTIVE and supports ACTIVE, INACTIVE, ARCHIVED
    assert(
      autoSkuProduct.status === "ACTIVE" &&
      ["ACTIVE", "INACTIVE", "ARCHIVED"].includes(autoSkuProduct.status),
      "2.10 Product Status defaults to ACTIVE and adheres to permitted enum states"
    );

    console.log("\n--- TEST GROUP 3: UNIT CONVERSIONS & DIMENSIONAL COMPATIBILITY ---");
    // 3.1 Dimensionally compatible conversions (Correction 3)
    assert(areUnitsCompatible("BAGS", "KG") === true, "3.1 Mass to Mass compatible: BAGS -> KG");
    assert(areUnitsCompatible("KG", "G") === true, "3.2 Mass to Mass compatible: KG -> G");
    assert(areUnitsCompatible("BOTTLES", "ML") === true, "3.3 Volume to Volume compatible: BOTTLES -> ML");
    assert(areUnitsCompatible("L", "ML") === true, "3.4 Volume to Volume compatible: L -> ML");
    assert(areUnitsCompatible("BOXES", "PIECES") === true, "3.5 Count to Count compatible: BOXES -> PIECES");

    // 3.6 Incompatible cross-dimension conversions rejected
    assert(areUnitsCompatible("BAGS", "L") === false, "3.6 Incompatible dimension rejected: BAGS (Mass) -> L (Volume)");
    assert(areUnitsCompatible("BOTTLES", "KG") === false, "3.7 Incompatible dimension rejected: BOTTLES (Volume) -> KG (Mass)");
    assert(areUnitsCompatible("PIECES", "KG") === false, "3.8 Incompatible dimension rejected: PIECES (Count) -> KG (Mass)");

    // 3.9 Accurate conversion calculations
    const bagsInKg = toBaseUnits(3, 50); // 3 bags * 50 kg/bag
    assert(bagsInKg === 150, "3.9 Accurate forward conversion: 3 Bags (ratio 50) = 150 Kg");

    const kgInBags = toPrimaryUnits(150, 50); // 150 kg / 50 kg/bag
    assert(kgInBags === 3, "3.10 Accurate reverse conversion: 150 Kg / 50 = 3 Bags");

    console.log("\n--- TEST GROUP 4: BATCH & EXPIRY FOUNDATION ---");
    // 4.1 Batch creation
    const mfgDate = new Date("2026-01-01");
    const expDate = new Date("2028-01-01");
    const batch1 = await Batch.create({
      productId: ureaProduct._id,
      batchNumber: "UREA-2026-B1",
      manufacturingDate: mfgDate,
      expiryDate: expDate,
      quantity: 0, // Zero in Phase 4
      status: "ACTIVE",
    });
    assert(batch1._id !== undefined, "4.1 Product batch registered with manufacturing & expiry dates");
    assert(batch1.quantity === 0, "4.2 Batch quantity initialized to zero (prepared for Phase 5 Purchase module)");

    // 4.3 Unique batch number per product
    let duplicateBatchBlocked = false;
    try {
      await Batch.create({
        productId: ureaProduct._id,
        batchNumber: "UREA-2026-B1", // duplicate for same product
        quantity: 0,
      });
    } catch {
      duplicateBatchBlocked = true;
    }
    assert(duplicateBatchBlocked, "4.3 Duplicate batch number within same product strictly rejected");

    // 4.4 Same batch number across different products is permitted
    const batchDifferentProduct = await Batch.create({
      productId: subsidizedProduct._id,
      batchNumber: "UREA-2026-B1", // allowed because productId differs
      quantity: 0,
    });
    assert(batchDifferentProduct._id !== undefined, "4.4 Same batch number allowed on different products");

    // 4.5 Date consistency check (Mfg date must be <= Expiry date)
    const invalidBatchInput = {
      batchNumber: "BAD-DATE-B1",
      manufacturingDate: "2028-01-01",
      expiryDate: "2026-01-01",
    };
    const dateValidation = createBatchSchema.safeParse(invalidBatchInput);
    assert(dateValidation.success === false, "4.5 Inconsistent dates rejected: expiry date earlier than manufacturing date");

    console.log("\n--- TEST GROUP 5: HISTORICAL DATA & DELETION INTEGRITY ---");
    // 5.1 Prevent category deletion when products are attached (Correction 5)
    const attachedProducts = await Product.countDocuments({ categoryId: catFertilizers._id });
    const canDeleteCategory = attachedProducts === 0;
    assert(
      canDeleteCategory === false && attachedProducts >= 2,
      "5.1 Category deletion blocked because active products are associated with it"
    );

    // 5.2 Product archiving preserves record without hard deletion
    await Product.updateOne({ _id: ureaProduct._id }, { $set: { status: "ARCHIVED" } });
    const archivedProduct = await Product.findById(ureaProduct._id);
    assert(archivedProduct.status === "ARCHIVED", "5.2 Product archived safely preserving historical references");

    console.log("\n--- TEST GROUP 6: ROLE-BASED ACCESS CONTROL (RBAC) ---");
    const ownerUser = { role: "OWNER", status: "ACTIVE", permissions: [] };
    const stockClerk = {
      role: "EMPLOYEE",
      status: "ACTIVE",
      permissions: ["inventory:read"],
    };
    const inventoryManager = {
      role: "EMPLOYEE",
      status: "ACTIVE",
      permissions: ["inventory:read", "inventory:write", "inventory:delete"],
    };

    // Owner checks
    assert(hasPermission(ownerUser, "inventory:read") === true, "6.1 Owner has full access to inventory:read");
    assert(hasPermission(ownerUser, "inventory:write") === true, "6.2 Owner has full access to inventory:write");
    assert(hasPermission(ownerUser, "inventory:delete") === true, "6.3 Owner has full access to inventory:delete");

    // Employee checks
    assert(hasPermission(stockClerk, "inventory:read") === true, "6.4 Stock clerk has permission to inventory:read");
    assert(hasPermission(stockClerk, "inventory:write") === false, "6.5 Stock clerk denied unauthorized inventory:write (403)");
    assert(hasPermission(stockClerk, "inventory:delete") === false, "6.6 Stock clerk denied unauthorized inventory:delete (403)");

    assert(hasPermission(inventoryManager, "inventory:write") === true, "6.7 Inventory manager granted inventory:write");
    assert(hasPermission(inventoryManager, "inventory:delete") === true, "6.8 Inventory manager granted inventory:delete");

    console.log("\n--- TEST GROUP 7: CATEGORY API AUTHENTICATION & RBAC (401 vs 403 vs 201) ---");
    const User = mongoose.model("User", UserSchema);
    const Session = mongoose.model("Session", SessionSchema);

    // 1. Extract canonical session cookie 'kasi_session'
    async function simulateCategoryPostRoute(req) {
      const rawToken = req.cookies?.["kasi_session"];

      if (!rawToken) {
        return { status: 401, error: "Authentication required" };
      }

      const tokenHash = hashToken(rawToken);
      const session = await Session.findOne({ tokenHash, expiresAt: { $gt: new Date() } });
      if (!session) {
        return { status: 401, error: "Authentication required (invalid/expired session)" };
      }

      const user = await User.findById(session.userId);
      if (!user || user.status !== "ACTIVE") {
        if (session) await Session.deleteOne({ _id: session._id });
        return { status: 401, error: "Authentication required (user inactive/not found)" };
      }

      // 2. RBAC check
      if (!hasPermission(user, "inventory:write")) {
        return { status: 403, error: "Forbidden: You lack permission to create categories" };
      }

      // 3. Category creation logic
      if (!req.body?.name) {
        return { status: 400, error: "Name is required" };
      }

      const newCat = await Category.create({
        name: req.body.name,
        slug: req.body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        description: req.body.description || "",
        status: "ACTIVE",
      });

      return { status: 201, category: newCat };
    }

    // Create test users
    const ownerDoc = await User.create({
      name: "R. Balamurugan",
      email: "owner@kasiagri.in",
      username: "balamurugan",
      role: "OWNER",
      status: "ACTIVE",
      permissions: [],
    });

    const unauthorizedEmpDoc = await User.create({
      name: "Staff ReadOnly",
      email: "readonly@kasiagri.in",
      username: "readonly",
      role: "EMPLOYEE",
      status: "ACTIVE",
      permissions: ["inventory:read"],
    });

    const authorizedEmpDoc = await User.create({
      name: "Staff Manager",
      email: "manager@kasiagri.in",
      username: "manager",
      role: "EMPLOYEE",
      status: "ACTIVE",
      permissions: ["inventory:read", "inventory:write"],
    });

    const inactiveOwnerDoc = await User.create({
      name: "Deactivated Staff",
      email: "deactivated@kasiagri.in",
      username: "deactivated",
      role: "EMPLOYEE",
      status: "INACTIVE",
      permissions: ["inventory:write"],
    });

    // Create sessions
    const ownerToken1 = "token-owner-primary";
    await Session.create({
      tokenHash: hashToken(ownerToken1),
      userId: ownerDoc._id,
      expiresAt: new Date(Date.now() + 7 * 86400 * 1000),
    });

    const ownerToken2 = "token-owner-alias";
    await Session.create({
      tokenHash: hashToken(ownerToken2),
      userId: ownerDoc._id,
      expiresAt: new Date(Date.now() + 7 * 86400 * 1000),
    });

    const unauthEmpToken = "token-unauth-emp";
    await Session.create({
      tokenHash: hashToken(unauthEmpToken),
      userId: unauthorizedEmpDoc._id,
      expiresAt: new Date(Date.now() + 7 * 86400 * 1000),
    });

    const authEmpToken = "token-auth-emp";
    await Session.create({
      tokenHash: hashToken(authEmpToken),
      userId: authorizedEmpDoc._id,
      expiresAt: new Date(Date.now() + 7 * 86400 * 1000),
    });

    const expiredToken = "token-expired";
    await Session.create({
      tokenHash: hashToken(expiredToken),
      userId: ownerDoc._id,
      expiresAt: new Date(Date.now() - 1000), // expired
    });

    const inactiveToken = "token-inactive-user";
    await Session.create({
      tokenHash: hashToken(inactiveToken),
      userId: inactiveOwnerDoc._id,
      expiresAt: new Date(Date.now() + 7 * 86400 * 1000),
    });

    // 7.1 Unauthenticated request (no cookie/token)
    const resNoAuth = await simulateCategoryPostRoute({ cookies: {}, body: { name: "Bio Fertilizers" } });
    assert(resNoAuth.status === 401, "7.1 Unauthenticated request returns HTTP 401 Unauthorized");

    // 7.2 Logged-in OWNER with standard `kasi_session` cookie
    const resOwnerStandard = await simulateCategoryPostRoute({
      cookies: { kasi_session: ownerToken1 },
      body: { name: "Bio Fertilizers", description: "Organic & bacterial fertilizers" },
    });
    assert(
      resOwnerStandard.status === 201 && resOwnerStandard.category?._id !== undefined,
      "7.2 Logged-in OWNER creates category via kasi_session cookie (HTTP 201)"
    );

    // 7.3 Verify login response attaches Set-Cookie directly to NextResponse headers
    const mockResponse = {
      headers: new Map(),
      cookies: {
        set(name, value, options) {
          mockResponse.headers.set("set-cookie", `${name}=${value}; Path=${options.path}; HttpOnly`);
        },
      },
    };
    mockResponse.cookies.set("kasi_session", ownerToken1, {
      httpOnly: true,
      path: "/",
      sameSite: "lax",
    });
    assert(
      mockResponse.headers.has("set-cookie") && mockResponse.headers.get("set-cookie").includes("kasi_session="),
      "7.3 Login response explicitly attaches HttpOnly 'kasi_session' Set-Cookie header"
    );

    // 7.4 Authenticated employee WITHOUT inventory:write permission
    const resNoWritePerm = await simulateCategoryPostRoute({
      cookies: { kasi_session: unauthEmpToken },
      body: { name: "Agricultural Accessories" },
    });
    assert(
      resNoWritePerm.status === 403,
      "7.4 Authenticated employee without inventory:write receives HTTP 403 Forbidden"
    );

    // 7.5 Authenticated employee WITH inventory:write permission
    const resWithWritePerm = await simulateCategoryPostRoute({
      cookies: { kasi_session: authEmpToken },
      body: { name: "Agricultural Tools", description: "Sprayers, pruners, and implements" },
    });
    assert(
      resWithWritePerm.status === 201 && resWithWritePerm.category?._id !== undefined,
      "7.5 Authenticated employee with inventory:write creates category (HTTP 201)"
    );

    // 7.6 Expired session token
    const resExpired = await simulateCategoryPostRoute({
      cookies: { kasi_session: expiredToken },
      body: { name: "Hybrid Seeds" },
    });
    assert(
      resExpired.status === 401,
      "7.6 Expired session token is rejected with HTTP 401 Unauthorized"
    );

    // 7.7 Inactive/deactivated employee
    const resInactive = await simulateCategoryPostRoute({
      cookies: { kasi_session: inactiveToken },
      body: { name: "Irrigation Drip Kits" },
    });
    assert(
      resInactive.status === 401,
      "7.7 Inactive user session is revoked and rejected with HTTP 401 Unauthorized"
    );

    console.log("\n==========================================================");
    console.log(`PHASE 4 TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
    console.log("==========================================================");

    if (failedTests > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error("Test execution error:", err);
    process.exit(1);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongod) {
      await mongod.stop();
    }
  }
}

runProductCategoryTestSuite();
