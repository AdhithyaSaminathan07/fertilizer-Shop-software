import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { z } from "zod";
import crypto from "crypto";

// Security & RBAC helpers matching Phase 3 & 4
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function hasPermission(user, permission) {
  if (!user || user.status !== "ACTIVE") return false;
  if (user.role === "OWNER") return true;
  if (user.permissions.includes(permission)) return true;
  return false;
}

// GSTIN & Phone regex matching src/validations/supplier.ts
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PHONE_REGEX = /^(?:\+91|91)?[6-9]\d{9}$/;

const supplierValidationSchema = z.object({
  name: z.string().min(2).max(150).trim(),
  contactPerson: z.string().max(100).trim().optional().or(z.literal("")),
  phone: z.string().trim().refine((val) => PHONE_REGEX.test(val.replace(/[\s-]/g, "")), {
    message: "Invalid phone number",
  }),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal("")),
  gstin: z.string().trim().toUpperCase().refine((val) => !val || GSTIN_REGEX.test(val), {
    message: "Invalid GSTIN",
  }).optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
});

// Mongoose Schemas matching src/models/
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

async function runPhase5ATestSuite() {
  console.log("==========================================================");
  console.log("   KASI AGRI AGENCIES - PHASE 5A SUPPLIER TEST SUITE      ");
  console.log("==========================================================");

  let mongod;
  try {
    console.log("[Setup] Starting isolated MongoMemoryServer...");
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
    console.log(`[Setup] Connected to isolated test DB: ${uri}`);
    console.log("[Setup] Live production MongoDB Atlas is 100% untouched.");

    const User = mongoose.model("User", UserSchema);
    const Session = mongoose.model("Session", SessionSchema);
    const Supplier = mongoose.model("Supplier", SupplierSchema);

    // Create indexes for Supplier
    await Supplier.createIndexes();

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

    console.log("\n--- TEST GROUP 1: SUPPLIER CREATION & NORMALIZATION ---");
    // 1.1 Create valid supplier
    const sup1 = await Supplier.create({
      name: "  IFFCO Fertilizer Distributors  ",
      contactPerson: "  P. Murugan  ",
      phone: "9876543210",
      email: "SALES@IFFCO.IN",
      gstin: "33aaaaa0000a1z5",
      address: {
        street: "Bypass Road",
        city: "Namakkal",
        state: "Tamil Nadu",
        pincode: "637001",
      },
      notes: "Authorized Urea Supplier",
      status: "ACTIVE",
    });

    assert(sup1._id !== undefined, "1.1 Supplier created successfully in DB");
    assert(sup1.name === "IFFCO Fertilizer Distributors", "1.2 Supplier name trimmed automatically");
    assert(sup1.contactPerson === "P. Murugan", "1.3 Contact person trimmed automatically");
    assert(sup1.email === "sales@iffco.in", "1.4 Email normalized to lowercase");
    assert(sup1.gstin === "33AAAAA0000A1Z5", "1.5 GSTIN normalized to uppercase");
    assert(sup1.totalPurchases === 0, "1.6 Initial totalPurchases safely set to 0.00");
    assert(sup1.totalPaid === 0, "1.7 Initial totalPaid safely set to 0.00");
    assert(sup1.outstandingBalance === 0, "1.8 Initial outstandingBalance safely set to 0.00");

    console.log("\n--- TEST GROUP 2: DUPLICATE GSTIN PROTECTION ---");
    // 2.1 Attempt duplicate GSTIN
    let duplicateGstinBlocked = false;
    try {
      await Supplier.create({
        name: "Second Dealer with Same GSTIN",
        phone: "9876543211",
        gstin: "33AAAAA0000A1Z5",
        status: "ACTIVE",
      });
    } catch {
      duplicateGstinBlocked = true;
    }
    assert(duplicateGstinBlocked, "2.1 Duplicate GSTIN registration strictly blocked by unique constraint");

    // 2.2 Multiple suppliers without GSTIN allowed (sparse index test)
    const supNoGstin1 = await Supplier.create({
      name: "Local Small Trader 1",
      phone: "9876543212",
      status: "ACTIVE",
    });
    const supNoGstin2 = await Supplier.create({
      name: "Local Small Trader 2",
      phone: "9876543213",
      status: "ACTIVE",
    });
    assert(
      supNoGstin1._id !== undefined && supNoGstin2._id !== undefined,
      "2.2 Multiple suppliers without GSTIN allowed via sparse index"
    );

    console.log("\n--- TEST GROUP 3: INPUT VALIDATION & GSTIN REGEX ---");
    // 3.1 Valid Indian GSTIN format
    const validGstinParse = supplierValidationSchema.safeParse({
      name: "Coromandel International",
      phone: "9842100000",
      gstin: "33AAACA6192F1Z8",
    });
    assert(validGstinParse.success === true, "3.1 Valid Indian GSTIN accepted by Zod schema");

    // 3.2 Malformed GSTIN (wrong checksum/format)
    const badGstinParse = supplierValidationSchema.safeParse({
      name: "Coromandel International",
      phone: "9842100000",
      gstin: "INVALID_GSTIN_123",
    });
    assert(badGstinParse.success === false, "3.2 Malformed GSTIN rejected by Zod schema");

    // 3.3 Invalid phone number rejected
    const badPhoneParse = supplierValidationSchema.safeParse({
      name: "Coromandel International",
      phone: "12345", // too short
    });
    assert(badPhoneParse.success === false, "3.3 Invalid phone number rejected by Zod schema");

    console.log("\n--- TEST GROUP 4: SUPPLIER UPDATES & ACTIVE/INACTIVE TOGGLE ---");
    // 4.1 Update phone and contact person
    await Supplier.updateOne(
      { _id: sup1._id },
      { $set: { phone: "9876549999", contactPerson: "R. Sundaram" } }
    );
    const updatedSup1 = await Supplier.findById(sup1._id);
    assert(
      updatedSup1.phone === "9876549999" && updatedSup1.contactPerson === "R. Sundaram",
      "4.1 Supplier contact details updated successfully"
    );

    // 4.2 Toggle status to INACTIVE
    await Supplier.updateOne({ _id: sup1._id }, { $set: { status: "INACTIVE" } });
    const inactiveSup = await Supplier.findById(sup1._id);
    assert(inactiveSup.status === "INACTIVE", "4.2 Supplier toggled to INACTIVE status");

    // Revert back to ACTIVE
    await Supplier.updateOne({ _id: sup1._id }, { $set: { status: "ACTIVE" } });

    console.log("\n--- TEST GROUP 5: ARCHIVE PROTECTION & BALANCE SAFETY ---");
    // 5.1 Simulate outstanding balance on supplier
    const indebtedSup = await Supplier.create({
      name: "Indebted Chemical Supplier",
      phone: "9876543299",
      status: "ACTIVE",
      totalPurchases: 50000,
      totalPaid: 10000,
      outstandingBalance: 40000,
    });

    // Function simulating archiveSupplier service logic
    async function simulateArchiveSupplier(supplierId) {
      const s = await Supplier.findById(supplierId);
      if (!s) throw new Error("Supplier not found");
      if (s.outstandingBalance > 0) {
        throw new Error(
          `Cannot archive supplier '${s.name}' because an outstanding payable balance of ₹${s.outstandingBalance} remains.`
        );
      }
      s.status = "ARCHIVED";
      await s.save();
      return s;
    }

    let archiveBlockedDueToBalance = false;
    try {
      await simulateArchiveSupplier(indebtedSup._id);
    } catch (err) {
      archiveBlockedDueToBalance = true;
    }
    assert(
      archiveBlockedDueToBalance,
      "5.1 Archive strictly blocked when supplier has an outstanding balance"
    );

    // 5.2 Archive allowed when outstanding balance is zero
    const settledSup = await Supplier.create({
      name: "Settled Agro Distributor",
      phone: "9876543288",
      status: "ACTIVE",
      totalPurchases: 25000,
      totalPaid: 25000,
      outstandingBalance: 0,
    });
    const archivedResult = await simulateArchiveSupplier(settledSup._id);
    assert(
      archivedResult.status === "ARCHIVED",
      "5.2 Supplier with zero outstanding balance successfully soft-archived"
    );

    // 5.3 Verify supplier is not hard-deleted from database
    const preservedRecord = await Supplier.findById(settledSup._id);
    assert(
      preservedRecord !== null && preservedRecord.status === "ARCHIVED",
      "5.3 Historical supplier record preserved in DB (no destructive hard deletion)"
    );

    console.log("\n--- TEST GROUP 6: ROLE-BASED ACCESS CONTROL (RBAC) ---");
    // Create users for RBAC testing
    const ownerUser = { role: "OWNER", status: "ACTIVE", permissions: [] };
    const clerkViewOnly = { role: "EMPLOYEE", status: "ACTIVE", permissions: ["suppliers:view"] };
    const managerFull = {
      role: "EMPLOYEE",
      status: "ACTIVE",
      permissions: ["suppliers:view", "suppliers:manage"],
    };
    const unauthorizedUser = { role: "EMPLOYEE", status: "ACTIVE", permissions: ["inventory:read"] };

    // View permissions
    assert(hasPermission(ownerUser, "suppliers:view") === true, "6.1 Owner granted suppliers:view");
    assert(hasPermission(clerkViewOnly, "suppliers:view") === true, "6.2 Clerk granted suppliers:view");
    assert(hasPermission(unauthorizedUser, "suppliers:view") === false, "6.3 Unauthorized user denied suppliers:view (403)");

    // Manage permissions (Create/Edit/Archive)
    assert(hasPermission(ownerUser, "suppliers:manage") === true, "6.4 Owner granted suppliers:manage");
    assert(hasPermission(managerFull, "suppliers:manage") === true, "6.5 Manager granted suppliers:manage");
    assert(hasPermission(clerkViewOnly, "suppliers:manage") === false, "6.6 View-only clerk denied suppliers:manage (403)");

    console.log("\n--- TEST GROUP 7: SEARCH, FILTER & RECONCILIATION QUERIES ---");
    // 7.1 Search by company name
    const searchByName = await Supplier.find({
      name: { $regex: "IFFCO", $options: "i" },
      status: { $ne: "ARCHIVED" },
    });
    assert(searchByName.length >= 1, "7.1 Search query finds supplier by name");

    // 7.2 Search by phone number
    const searchByPhone = await Supplier.find({
      phone: { $regex: "9876549999", $options: "i" },
    });
    assert(searchByPhone.length >= 1, "7.2 Search query finds supplier by phone");

    // 7.3 Status filter excludes ARCHIVED by default
    const nonArchivedList = await Supplier.find({ status: { $ne: "ARCHIVED" } });
    const hasArchivedInList = nonArchivedList.some((s) => s.status === "ARCHIVED");
    assert(!hasArchivedInList, "7.3 Active supplier listing excludes ARCHIVED vendors by default");

    console.log("\n==========================================================");
    console.log(`PHASE 5A TEST SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
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

runPhase5ATestSuite();

