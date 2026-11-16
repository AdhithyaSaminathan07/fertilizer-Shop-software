import mongoose from "mongoose";
import fs from "fs";
import path from "path";
import { hash } from "@node-rs/argon2";

// Load .env.staging explicitly
function loadStagingEnv() {
  const envPath = path.resolve(process.cwd(), ".env.staging");
  if (!fs.existsSync(envPath)) {
    console.error("FATAL: .env.staging file does not exist. Aborting.");
    process.exit(1);
  }

  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const [key, ...values] = trimmed.split("=");
    if (key && values.length > 0) {
      process.env[key.trim()] = values.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
}

loadStagingEnv();

const MONGODB_URI = process.env.MONGODB_URI;

// Security Guard 1: String check on URI
if (!MONGODB_URI || !MONGODB_URI.includes("/kasi_staging")) {
  console.error("FATAL SAFETY ERROR: MONGODB_URI does not explicitly target '/kasi_staging'.");
  console.error("Aborting immediately to protect production database.");
  process.exit(1);
}

// Minimal schemas for seeding
const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["OWNER", "EMPLOYEE"], default: "OWNER" },
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
    totalPurchases: { type: Number, default: 0 },
    totalPaid: { type: Number, default: 0 },
    outstandingBalance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    description: String,
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
  },
  { timestamps: true }
);

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    sku: { type: String, trim: true, uppercase: true, sparse: true },
    brand: { type: String, required: true, trim: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category" },
    primaryUnit: { type: String, required: true },
    purchasePrice: { type: Number, default: 0 },
    sellingPrice: { type: Number, default: 0 },
    currentStock: { type: Number, default: 0 },
    status: { type: String, enum: ["ACTIVE", "INACTIVE", "ARCHIVED"], default: "ACTIVE" },
  },
  { timestamps: true }
);

async function resetStagingDatabase() {
  console.log("==========================================================");
  console.log("    KASI AGRI AGENCIES — RESET STAGING DATABASE ONLY      ");
  console.log("==========================================================\n");

  console.log("[1/5] Connecting to staging database...");
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });

  const activeDbName = mongoose.connection.db.databaseName;
  console.log(`[2/5] Connected database name: '${activeDbName}'`);

  // Security Guard 2: Database name check on connected instance
  if (activeDbName !== "kasi_staging") {
    console.error(`FATAL SAFETY VIOLATION: Connected database is '${activeDbName}', NOT 'kasi_staging'!`);
    console.error("Aborting immediately. No collections or records were modified.");
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log("[3/5] Verified target is strictly 'kasi_staging'. Purging staging test collections...");
  const collections = await mongoose.connection.db.listCollections().toArray();
  const collectionNames = collections.map((c) => c.name);

  const targetCollections = [
    "purchases",
    "suppliers",
    "products",
    "batches",
    "categories",
    "sessions",
    "ratelimits",
    "auditlogs",
    "users",
  ];

  for (const colName of targetCollections) {
    if (collectionNames.includes(colName)) {
      await mongoose.connection.db.dropCollection(colName);
      console.log(`  - Dropped staging collection: ${colName}`);
    }
  }

  console.log("[4/5] Seeding clean baseline records into staging database...");
  const User = mongoose.model("User", UserSchema);
  const Supplier = mongoose.model("Supplier", SupplierSchema);
  const Category = mongoose.model("Category", CategorySchema);
  const Product = mongoose.model("Product", ProductSchema);

  // 1. Seed Owner Admin
  const ownerName = process.env.KASI_OWNER_NAME || "Admin";
  const ownerUsername = process.env.KASI_OWNER_USERNAME || "admin";
  const ownerEmail = process.env.KASI_OWNER_EMAIL || "admin@kasiagri.com";
  const ownerPassword = process.env.KASI_OWNER_INITIAL_PASSWORD || "Admin@KasiAgri2026";

  const passwordHash = await hash(ownerPassword, {
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });

  await User.create({
    name: ownerName,
    email: ownerEmail,
    username: ownerUsername,
    passwordHash,
    role: "OWNER",
    permissions: [],
    status: "ACTIVE",
  });
  console.log(`  - Created Owner Admin account: '${ownerUsername}'`);

  // 2. Seed Standard Categories
  const fertCat = await Category.create({
    name: "Chemical Fertilizers",
    description: "Urea, DAP, Potash, Complex fertilizers",
    status: "ACTIVE",
  });
  const seedCat = await Category.create({
    name: "Certified Seeds",
    description: "Paddy, Maize, Cotton certified seeds",
    status: "ACTIVE",
  });
  const pestCat = await Category.create({
    name: "Crop Protection Chemicals",
    description: "Insecticides, fungicides, weedicides",
    status: "ACTIVE",
  });
  console.log("  - Created 3 standard categories");

  // 3. Seed Registered Suppliers
  await Supplier.create([
    {
      name: "Ranga Agencies",
      contactPerson: "R. Ranganathan",
      phone: "9842100010",
      email: "ranga@agri.test",
      gstin: "33AAACR1234F1Z1",
      address: { street: "12 Main Bazar", city: "Trichy", state: "Tamil Nadu", pincode: "620001" },
      status: "ACTIVE",
      totalPurchases: 0,
      totalPaid: 0,
      outstandingBalance: 0,
    },
    {
      name: "ABC Fertilizers Ltd",
      contactPerson: "A. Balan",
      phone: "9842100020",
      email: "abc@agri.test",
      gstin: "33AABCA5678G1Z2",
      address: { street: "44 Agro Complex", city: "Madurai", state: "Tamil Nadu", pincode: "625001" },
      status: "ACTIVE",
      totalPurchases: 0,
      totalPaid: 0,
      outstandingBalance: 0,
    },
    {
      name: "Sri Murugan Agencies",
      contactPerson: "M. Murugan",
      phone: "9842100030",
      email: "murugan@agri.test",
      gstin: "33AABCM9012H1Z3",
      address: { street: "8 Salem Highway", city: "Namakkal", state: "Tamil Nadu", pincode: "637001" },
      status: "ACTIVE",
      totalPurchases: 0,
      totalPaid: 0,
      outstandingBalance: 0,
    },
  ]);
  console.log("  - Created 3 registered suppliers (Ranga Agencies, ABC Fertilizers, Sri Murugan Agencies)");

  // 4. Seed Standard Products (Stock starts at zero for testing actual inward)
  await Product.create([
    {
      name: "Neem Coated Urea 45kg",
      sku: "FERT-UREA-45",
      brand: "IFFCO",
      categoryId: fertCat._id,
      primaryUnit: "BAGS",
      purchasePrice: 266.5,
      sellingPrice: 300,
      currentStock: 0,
      status: "ACTIVE",
    },
    {
      name: "DAP 50kg Fertilizer",
      sku: "FERT-DAP-50",
      brand: "Coromandel",
      categoryId: fertCat._id,
      primaryUnit: "BAGS",
      purchasePrice: 1350.0,
      sellingPrice: 1500,
      currentStock: 0,
      status: "ACTIVE",
    },
    {
      name: "MOP (Muriate of Potash) 50kg",
      sku: "FERT-MOP-50",
      brand: "IPL",
      categoryId: fertCat._id,
      primaryUnit: "BAGS",
      purchasePrice: 1650.0,
      sellingPrice: 1800,
      currentStock: 0,
      status: "ACTIVE",
    },
    {
      name: "CR-1009 Sub-1 Paddy Seeds 30kg",
      sku: "SEED-PADDY-30",
      brand: "Tamil Nadu Seed Corp",
      categoryId: seedCat._id,
      primaryUnit: "BAGS",
      purchasePrice: 1200.0,
      sellingPrice: 1350,
      currentStock: 0,
      status: "ACTIVE",
    },
  ]);
  console.log("  - Created 4 standard catalog products with zero initial stock");

  await mongoose.disconnect();
  console.log("\n[5/5] Disconnected safely.");
  console.log("==========================================================");
  console.log(" STAGING RESET COMPLETE: 'kasi_staging' is ready for test ");
  console.log(" Live production database was 100% untouched and safe.    ");
  console.log("==========================================================\n");
}

resetStagingDatabase().catch((err) => {
  console.error("Fatal error resetting staging database:", err.message);
  process.exit(1);
});

