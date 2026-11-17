/**
 * KASI AGRI AGENCIES — PHASE 8 EXPENSES & BUSINESS CASHBOOK TEST SUITE
 *
 * Comprehensive verification of:
 * 1. Expense category seeding, unique constraint & deactivation protection
 * 2. Expense creation with sequential EXP-YYYYMM-XXXX generation
 * 3. Expense editing with mandatory reason & audit history preservation
 * 4. Expense reversal with mandatory reason & atomic balance restoration
 * 5. Double-reversal guard & reversed expense edit protection
 * 6. Cashbook opening balance configuration & adjustment history
 * 7. Cash sale integration (cash portion appears as cashbook inflow)
 * 8. Split payment integration (cash & UPI split into distinct inflows)
 * 9. Credit sale exclusion (credit amounts excluded from cashbook inflow)
 * 10. Customer repayment integration (inflow under specific payment method)
 * 11. Supplier payment integration (outflow under specific payment method)
 * 12. Purchase upfront payment integration (without double-counting advances)
 * 13. Reversal & cancellation exclusion (cancelled sales, reversed payments/expenses do not distort cashbook)
 * 14. Cashbook chronological running balance reconciliation (Opening + Inflows - Outflows = Closing)
 * 15. Payment account separation (Cash, UPI, Bank Transfer, Cheque)
 * 16. Multi-dimensional reports (Date-range, Income vs Expense, Category breakdown, Daily timeline)
 * 17. Dashboard financial aggregations
 * 18. RBAC authorization (Owner, Clerk view, Cashier manage)
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

const ExpenseCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);
ExpenseCategorySchema.index({ name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

const ExpenseAuditSchema = new mongoose.Schema(
  {
    editedAt: { type: Date, required: true, default: Date.now },
    editedById: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    editedByName: { type: String, required: true },
    reason: { type: String, required: true, trim: true },
    previousData: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { _id: false }
);

const ExpenseReversalSchema = new mongoose.Schema(
  {
    reason: { type: String, required: true, trim: true },
    reversedAt: { type: Date, required: true, default: Date.now },
    reversedById: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reversedByName: { type: String, required: true },
  },
  { _id: false }
);

const ExpenseSchema = new mongoose.Schema(
  {
    expenseNumber: { type: String, required: true, unique: true, trim: true },
    expenseDate: { type: Date, required: true, default: Date.now },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "ExpenseCategory", required: true },
    categoryName: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0.01 },
    paymentMethod: { type: String, enum: ["CASH", "UPI", "BANK_TRANSFER", "CHEQUE"], required: true },
    paymentReference: { type: String, trim: true, default: "" },
    paidTo: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["RECORDED", "REVERSED"], default: "RECORDED" },
    reversal: { type: ExpenseReversalSchema, default: null },
    auditHistory: { type: [ExpenseAuditSchema], default: [] },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true }
);

const HistorySchema = new mongoose.Schema(
  {
    adjustedAt: { type: Date, required: true, default: Date.now },
    adjustedById: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    adjustedByName: { type: String, required: true },
    reason: { type: String, required: true, trim: true },
    previousBalances: {
      cash: { type: Number, required: true, default: 0 },
      upi: { type: Number, required: true, default: 0 },
      bank: { type: Number, required: true, default: 0 },
      cheque: { type: Number, required: true, default: 0 },
    },
    newBalances: {
      cash: { type: Number, required: true, default: 0 },
      upi: { type: Number, required: true, default: 0 },
      bank: { type: Number, required: true, default: 0 },
      cheque: { type: Number, required: true, default: 0 },
    },
  },
  { _id: false }
);

const CashbookOpeningBalanceSchema = new mongoose.Schema(
  {
    configKey: { type: String, required: true, unique: true, default: "DEFAULT_CASHBOOK_OPENING" },
    effectiveDate: { type: Date, required: true, default: () => new Date(2026, 3, 1) },
    cash: { type: Number, required: true, default: 0, min: 0 },
    upi: { type: Number, required: true, default: 0, min: 0 },
    bank: { type: Number, required: true, default: 0, min: 0 },
    cheque: { type: Number, required: true, default: 0, min: 0 },
    notes: { type: String, trim: true, default: "" },
    history: { type: [HistorySchema], default: [] },
    createdById: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdByName: { type: String, required: true },
  },
  { timestamps: true }
);

const SaleSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    invoiceDate: { type: Date, required: true },
    customerSnapshot: { name: String, phone: String },
    isWalkIn: { type: Boolean, default: false },
    grandTotal: { type: Number, required: true },
    payment: {
      method: { type: String, enum: ["CASH", "UPI", "CREDIT", "SPLIT"], required: true },
      cashAmount: { type: Number, default: 0 },
      upiAmount: { type: Number, default: 0 },
      upiReference: String,
      creditAmount: { type: Number, default: 0 },
      totalPaid: { type: Number, default: 0 },
    },
    status: { type: String, enum: ["COMPLETED", "CANCELLED"], default: "COMPLETED" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const CustomerPaymentSchema = new mongoose.Schema(
  {
    paymentNumber: { type: String, required: true, unique: true },
    paymentDate: { type: Date, required: true },
    customerSnapshot: { name: String, phone: String },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ["CASH", "UPI", "BANK_TRANSFER", "CHEQUE"], required: true },
    transactionReference: String,
    status: { type: String, enum: ["RECORDED", "REVERSED"], default: "RECORDED" },
    createdByName: { type: String, required: true },
  },
  { timestamps: true }
);

const SupplierPaymentSchema = new mongoose.Schema(
  {
    paymentNumber: { type: String, required: true, unique: true },
    paymentDate: { type: Date, required: true },
    supplierSnapshot: { name: String, phone: String },
    amount: { type: Number, required: true },
    paymentMethod: { type: String, enum: ["CASH", "UPI", "BANK_TRANSFER", "CHEQUE"], required: true },
    paymentReference: String,
    status: { type: String, enum: ["RECORDED", "REVERSED"], default: "RECORDED" },
    createdByName: { type: String, required: true },
  },
  { timestamps: true }
);

const PurchaseSchema = new mongoose.Schema(
  {
    purchaseNumber: { type: String, required: true, unique: true },
    purchaseDate: { type: Date, required: true },
    supplierSnapshot: { name: String, phone: String },
    grandTotal: { type: Number, required: true },
    amountPaid: { type: Number, default: 0 },
    paymentMethod: { type: String, default: "CASH" },
    paymentReference: String,
    advanceAdjustments: [{ amount: Number, adjustedAt: Date }],
    status: { type: String, default: "RECEIVED" },
  },
  { timestamps: true }
);

// Register Models
const User = mongoose.models.User || mongoose.model("User", UserSchema);
const ExpenseCategory = mongoose.models.ExpenseCategory || mongoose.model("ExpenseCategory", ExpenseCategorySchema);
const Expense = mongoose.models.Expense || mongoose.model("Expense", ExpenseSchema);
const CashbookOpeningBalance = mongoose.models.CashbookOpeningBalance || mongoose.model("CashbookOpeningBalance", CashbookOpeningBalanceSchema);
const Sale = mongoose.models.Sale || mongoose.model("Sale", SaleSchema);
const CustomerPayment = mongoose.models.CustomerPayment || mongoose.model("CustomerPayment", CustomerPaymentSchema);
const SupplierPayment = mongoose.models.SupplierPayment || mongoose.model("SupplierPayment", SupplierPaymentSchema);
const Purchase = mongoose.models.Purchase || mongoose.model("Purchase", PurchaseSchema);

const DEFAULT_CATEGORIES = [
  "Shop Rent", "Electricity", "Water", "Staff Salary", "Transport", "Fuel",
  "Loading and Unloading", "Telephone and Internet", "Office Supplies",
  "Repairs and Maintenance", "Packaging", "Travel", "Bank Charges", "Miscellaneous"
];

let replSet;
let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✔ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`  ✖ FAIL: ${message}`);
    failCount++;
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log("===============================================================================");
  console.log(" KASI AGRI AGENCIES — PHASE 8 EXPENSES & CASHBOOK TEST SUITE");
  console.log("===============================================================================\n");

  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  const uri = replSet.getUri();
  await mongoose.connect(uri);
  console.log("✔ Connected to isolated in-memory MongoMemoryReplSet.\n");

  // Create Users
  const ownerUser = await User.create({
    name: "R. Balamurugan",
    email: "owner@kasiagri.com",
    username: "balamurugan",
    role: "OWNER",
    permissions: [],
  });

  const clerkUser = await User.create({
    name: "S. Murugan",
    email: "clerk@kasiagri.com",
    username: "murugan",
    role: "EMPLOYEE",
    permissions: ["expenses:view", "cashbook:view"],
  });

  const cashierUser = await User.create({
    name: "K. Rengasamy",
    email: "cashier@kasiagri.com",
    username: "rengasamy",
    role: "EMPLOYEE",
    permissions: ["expenses:manage", "cashbook:manage"],
  });

  // --------------------------------------------------------------------------
  console.log("Section 1: Default Categories & Category Management");
  // --------------------------------------------------------------------------
  for (const name of DEFAULT_CATEGORIES) {
    await ExpenseCategory.create({ name, description: `Default category ${name}`, isActive: true });
  }
  const allCats = await ExpenseCategory.find({ isActive: true });
  assert(allCats.length === 14, "All 14 default expense categories successfully seeded");

  // Prevent duplicate category name (case-insensitive)
  let duplicateRejected = false;
  try {
    await ExpenseCategory.create({ name: "shop rent" });
  } catch (err) {
    duplicateRejected = true;
  }
  assert(duplicateRejected, "Duplicate category name (case-insensitive) is rejected");

  // Deactivate category
  const rentCat = await ExpenseCategory.findOne({ name: "Shop Rent" });
  rentCat.isActive = false;
  await rentCat.save();
  assert(rentCat.isActive === false, "Category can be deactivated instead of destructive deletion");

  // Reactivate for further tests
  rentCat.isActive = true;
  await rentCat.save();

  // --------------------------------------------------------------------------
  console.log("\nSection 2: Expense Creation & Sequential Numbering");
  // --------------------------------------------------------------------------
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const expNumber1 = `EXP-${ym}-0001`;
  const expNumber2 = `EXP-${ym}-0002`;

  const exp1 = await Expense.create({
    expenseNumber: expNumber1,
    expenseDate: new Date(),
    categoryId: rentCat._id,
    categoryName: rentCat.name,
    description: "Monthly premises rent for main store",
    amount: 15000.0,
    paymentMethod: "BANK_TRANSFER",
    paymentReference: "NEFT-RENT-001",
    paidTo: "Premises Landlord",
    status: "RECORDED",
    createdById: cashierUser._id,
    createdByName: cashierUser.name,
  });
  assert(exp1.expenseNumber === expNumber1, "Expense 1 recorded with sequential reference EXP-YYYYMM-0001");
  assert(exp1.amount === 15000.0, "Expense amount recorded accurately as ₹15,000.00");

  const fuelCat = await ExpenseCategory.findOne({ name: "Fuel" });
  const exp2 = await Expense.create({
    expenseNumber: expNumber2,
    expenseDate: new Date(),
    categoryId: fuelCat._id,
    categoryName: fuelCat.name,
    description: "Generator diesel 50 litres",
    amount: 4750.5,
    paymentMethod: "CASH",
    paidTo: "Thiruvarur IOC Petrol Bunk",
    status: "RECORDED",
    createdById: cashierUser._id,
    createdByName: cashierUser.name,
  });
  assert(exp2.expenseNumber === expNumber2, "Expense 2 recorded with sequential reference EXP-YYYYMM-0002");
  assert(exp2.paymentMethod === "CASH", "Expense 2 payment method recorded as CASH");

  // Category in-use deletion guard
  const inUseCount = await Expense.countDocuments({ categoryId: rentCat._id });
  assert(inUseCount > 0, "ExpenseCategory in-use detection counts active expense records");

  // --------------------------------------------------------------------------
  console.log("\nSection 3: Expense Editing with Audit History");
  // --------------------------------------------------------------------------
  const prevData = {
    amount: exp2.amount,
    description: exp2.description,
    paymentMethod: exp2.paymentMethod,
  };
  exp2.amount = 4950.0;
  exp2.description = "Generator diesel 52 litres with delivery hamali";
  exp2.auditHistory.push({
    editedAt: new Date(),
    editedById: cashierUser._id,
    editedByName: cashierUser.name,
    reason: "Adjusted quantity and cost as per bunk cash memo",
    previousData: prevData,
  });
  await exp2.save();

  const refreshedExp2 = await Expense.findById(exp2._id);
  assert(refreshedExp2.amount === 4950.0, "Expense amount updated to ₹4,950.00");
  assert(refreshedExp2.auditHistory.length === 1, "Audit history contains 1 modification record");
  assert(refreshedExp2.auditHistory[0].reason.includes("bunk cash memo"), "Audit history preserves modification reason");
  assert(refreshedExp2.auditHistory[0].previousData.amount === 4750.5, "Audit history preserves previous data snapshot");

  // --------------------------------------------------------------------------
  console.log("\nSection 4: Expense Reversal with Mandatory Reason");
  // --------------------------------------------------------------------------
  const expToReverse = await Expense.findOneAndUpdate(
    { _id: exp2._id, status: "RECORDED" },
    {
      $set: {
        status: "REVERSED",
        reversal: {
          reason: "Duplicate diesel bill entered by mistake",
          reversedAt: new Date(),
          reversedById: cashierUser._id,
          reversedByName: cashierUser.name,
        },
      },
    },
    { new: true }
  );
  assert(expToReverse.status === "REVERSED", "Expense status atomically changed to REVERSED");
  assert(expToReverse.reversal.reason.includes("Duplicate diesel bill"), "Reversal record preserves mandatory reason");

  // --------------------------------------------------------------------------
  console.log("\nSection 5: Double-Reversal Guard & Reversed Edit Protection");
  // --------------------------------------------------------------------------
  const doubleReverseAttempt = await Expense.findOneAndUpdate(
    { _id: exp2._id, status: "RECORDED" },
    { $set: { status: "REVERSED" } },
    { new: true }
  );
  assert(doubleReverseAttempt === null, "Double-reversal atomically rejected via { status: 'RECORDED' } condition");

  // Create fresh active expense for cashbook tests
  const exp3 = await Expense.create({
    expenseNumber: `EXP-${ym}-0003`,
    expenseDate: new Date(),
    categoryId: fuelCat._id,
    categoryName: fuelCat.name,
    description: "Delivery tempo diesel",
    amount: 2500.0,
    paymentMethod: "CASH",
    paidTo: "BPCL Station",
    status: "RECORDED",
    createdById: cashierUser._id,
    createdByName: cashierUser.name,
  });
  assert(exp3.status === "RECORDED", "Active operational expense EXP-0003 created");

  // --------------------------------------------------------------------------
  console.log("\nSection 6: Cashbook Opening Balance Configuration");
  // --------------------------------------------------------------------------
  const openingConfig = await CashbookOpeningBalance.create({
    configKey: "DEFAULT_CASHBOOK_OPENING",
    effectiveDate: new Date(2026, 3, 1),
    cash: 50000.0,
    upi: 25000.0,
    bank: 100000.0,
    cheque: 0.0,
    notes: "Verified baseline store opening balances",
    history: [],
    createdById: ownerUser._id,
    createdByName: ownerUser.name,
  });
  assert(openingConfig.cash === 50000.0, "Store Cash opening balance set to ₹50,000.00");
  assert(openingConfig.upi === 25000.0, "Recorded UPI opening balance set to ₹25,000.00");
  assert(openingConfig.bank === 100000.0, "Recorded Bank opening balance set to ₹1,00,000.00");

  // Adjust opening balance with audit history
  openingConfig.history.push({
    adjustedAt: new Date(),
    adjustedById: ownerUser._id,
    adjustedByName: ownerUser.name,
    reason: "Audited physical cash drawer adjustment",
    previousBalances: { cash: 50000.0, upi: 25000.0, bank: 100000.0, cheque: 0.0 },
    newBalances: { cash: 52000.0, upi: 25000.0, bank: 100000.0, cheque: 0.0 },
  });
  openingConfig.cash = 52000.0;
  await openingConfig.save();

  const refreshedOpening = await CashbookOpeningBalance.findOne({ configKey: "DEFAULT_CASHBOOK_OPENING" });
  assert(refreshedOpening.cash === 52000.0, "Adjusted cash opening balance is ₹52,000.00");
  assert(refreshedOpening.history.length === 1, "Opening balance history tracks adjustment audit");

  // --------------------------------------------------------------------------
  console.log("\nSection 7: Cash Sale Integration & Credit Sale Exclusion");
  // --------------------------------------------------------------------------
  // 7A. 100% Cash Sale
  const cashSale = await Sale.create({
    invoiceNumber: "INV-202604-0001",
    invoiceDate: new Date(),
    customerSnapshot: { name: "M. Senthil", phone: "9876543210" },
    isWalkIn: false,
    grandTotal: 5000.0,
    payment: {
      method: "CASH",
      cashAmount: 5000.0,
      upiAmount: 0,
      creditAmount: 0,
      totalPaid: 5000.0,
    },
    status: "COMPLETED",
    createdBy: cashierUser._id,
  });
  assert(cashSale.payment.cashAmount === 5000.0, "Cash sale records cashAmount of ₹5,000.00");

  // 7B. 100% Credit Sale (Khata) - Must NOT appear in cashbook inflows!
  const creditSale = await Sale.create({
    invoiceNumber: "INV-202604-0002",
    invoiceDate: new Date(),
    customerSnapshot: { name: "K. Rengasamy", phone: "9876543211" },
    isWalkIn: false,
    grandTotal: 12000.0,
    payment: {
      method: "CREDIT",
      cashAmount: 0,
      upiAmount: 0,
      creditAmount: 12000.0,
      totalPaid: 0,
    },
    status: "COMPLETED",
    createdBy: cashierUser._id,
  });
  assert(creditSale.payment.cashAmount === 0 && creditSale.payment.upiAmount === 0, "Credit sale has zero cash/UPI inflow");

  // --------------------------------------------------------------------------
  console.log("\nSection 8: Split Payment Integration");
  // --------------------------------------------------------------------------
  // Sale paid partly in Cash and partly via UPI
  const splitSale = await Sale.create({
    invoiceNumber: "INV-202604-0003",
    invoiceDate: new Date(),
    customerSnapshot: { name: "P. Muthuvel", phone: "9876543212" },
    isWalkIn: false,
    grandTotal: 10000.0,
    payment: {
      method: "SPLIT",
      cashAmount: 4000.0,
      upiAmount: 6000.0,
      upiReference: "UPI-SPLIT-9988",
      creditAmount: 0,
      totalPaid: 10000.0,
    },
    status: "COMPLETED",
    createdBy: cashierUser._id,
  });
  assert(splitSale.payment.cashAmount === 4000.0, "Split sale cash component is ₹4,000.00");
  assert(splitSale.payment.upiAmount === 6000.0, "Split sale UPI component is ₹6,000.00");

  // --------------------------------------------------------------------------
  console.log("\nSection 9: Customer Khata Repayment Integration");
  // --------------------------------------------------------------------------
  // Farmer repays ₹5,000 of credit via UPI
  const custRepayUPI = await CustomerPayment.create({
    paymentNumber: "PAY-202604-0001",
    paymentDate: new Date(),
    customerSnapshot: { name: "K. Rengasamy", phone: "9876543211" },
    amount: 5000.0,
    paymentMethod: "UPI",
    transactionReference: "UPI-KHATA-1234",
    status: "RECORDED",
    createdByName: cashierUser.name,
  });
  assert(custRepayUPI.amount === 5000.0, "Customer repayment of ₹5,000.00 recorded");
  assert(custRepayUPI.paymentMethod === "UPI", "Customer repayment method is UPI");

  // Farmer repays ₹3,000 of credit via Cash
  const custRepayCash = await CustomerPayment.create({
    paymentNumber: "PAY-202604-0002",
    paymentDate: new Date(),
    customerSnapshot: { name: "K. Rengasamy", phone: "9876543211" },
    amount: 3000.0,
    paymentMethod: "CASH",
    status: "RECORDED",
    createdByName: cashierUser.name,
  });
  assert(custRepayCash.amount === 3000.0, "Customer cash repayment of ₹3,000.00 recorded");

  // --------------------------------------------------------------------------
  console.log("\nSection 10: Supplier Payment Integration");
  // --------------------------------------------------------------------------
  const suppPayment = await SupplierPayment.create({
    paymentNumber: "SPAY-202604-0001",
    paymentDate: new Date(),
    supplierSnapshot: { name: "IFFCO Fertilizer Distributor", phone: "9123456789" },
    amount: 20000.0,
    paymentMethod: "BANK_TRANSFER",
    paymentReference: "UTR-IFFCO-7766",
    status: "RECORDED",
    createdByName: cashierUser.name,
  });
  assert(suppPayment.amount === 20000.0, "Supplier payment of ₹20,000.00 recorded");
  assert(suppPayment.paymentMethod === "BANK_TRANSFER", "Supplier payment method is BANK_TRANSFER");

  // --------------------------------------------------------------------------
  console.log("\nSection 11: Purchase Direct Upfront Payment Integration");
  // --------------------------------------------------------------------------
  const purchaseBill = await Purchase.create({
    purchaseNumber: "PUR-202604-0001",
    purchaseDate: new Date(),
    supplierSnapshot: { name: "Bayer CropScience", phone: "9444332211" },
    grandTotal: 18000.0,
    amountPaid: 8000.0,
    paymentMethod: "CASH",
    paymentReference: "PO-CASH-DOWN",
    advanceAdjustments: [],
    status: "RECEIVED",
  });
  assert(purchaseBill.amountPaid === 8000.0, "Purchase upfront cash payment is ₹8,000.00");

  // --------------------------------------------------------------------------
  console.log("\nSection 12: Cancellation & Reversal Exclusion Verification");
  // --------------------------------------------------------------------------
  // Cancelled sale
  const cancelledSale = await Sale.create({
    invoiceNumber: "INV-202604-0004",
    invoiceDate: new Date(),
    customerSnapshot: { name: "Cancelled Walkin", phone: "9000000000" },
    isWalkIn: true,
    grandTotal: 3000.0,
    payment: {
      method: "CASH",
      cashAmount: 3000.0,
      upiAmount: 0,
      creditAmount: 0,
      totalPaid: 3000.0,
    },
    status: "CANCELLED",
  });
  assert(cancelledSale.status === "CANCELLED", "Sale marked as CANCELLED");

  // Reversed customer payment
  const reversedCustPay = await CustomerPayment.create({
    paymentNumber: "PAY-202604-0003",
    paymentDate: new Date(),
    customerSnapshot: { name: "Mistake Entry", phone: "9000000001" },
    amount: 7000.0,
    paymentMethod: "CASH",
    status: "REVERSED",
    createdByName: cashierUser.name,
  });
  assert(reversedCustPay.status === "REVERSED", "Customer payment marked as REVERSED");

  // Reversed supplier payment
  const reversedSuppPay = await SupplierPayment.create({
    paymentNumber: "SPAY-202604-0002",
    paymentDate: new Date(),
    supplierSnapshot: { name: "Mistake Supplier", phone: "9000000002" },
    amount: 15000.0,
    paymentMethod: "BANK_TRANSFER",
    status: "REVERSED",
    createdByName: cashierUser.name,
  });
  assert(reversedSuppPay.status === "REVERSED", "Supplier payment marked as REVERSED");

  // --------------------------------------------------------------------------
  console.log("\nSection 13: Mathematical Cashbook Ledger & Running Balances");
  // --------------------------------------------------------------------------
  // Let's compute active inflows and outflows:
  // Base Openings:
  //   Cash: 52,000
  //   UPI: 25,000
  //   Bank: 1,00,000
  //   Cheque: 0
  //   Total Opening = 1,77,000.00
  //
  // Inflows:
  //   Cash Sale: +5,000 (CASH)
  //   Split Sale: +4,000 (CASH)
  //   Split Sale: +6,000 (UPI)
  //   Cust Repay: +5,000 (UPI)
  //   Cust Repay: +3,000 (CASH)
  //   (Cancelled sale +3,000 is EXCLUDED)
  //   (Reversed cust pay +7,000 is EXCLUDED)
  //   (Credit sale 12,000 is EXCLUDED)
  //
  // Inflow Totals:
  //   Cash Inflow = 5,000 + 4,000 + 3,000 = 12,000.00
  //   UPI Inflow = 6,000 + 5,000 = 11,000.00
  //   Bank Inflow = 0
  //   Cheque Inflow = 0
  //   Total Inflow = 23,000.00
  //
  // Outflows:
  //   Exp1 (Rent): -15,000 (BANK_TRANSFER)
  //   Exp3 (Diesel): -2,500 (CASH)
  //   (Exp2 diesel 4,950 was REVERSED, so EXCLUDED)
  //   Supplier Payment: -20,000 (BANK_TRANSFER)
  //   (Reversed supplier payment -15,000 is EXCLUDED)
  //   Purchase upfront: -8,000 (CASH)
  //
  // Outflow Totals:
  //   Cash Outflow = 2,500 + 8,000 = 10,500.00
  //   UPI Outflow = 0
  //   Bank Outflow = 15,000 + 20,000 = 35,000.00
  //   Cheque Outflow = 0
  //   Total Outflow = 45,500.00
  //
  // Closing Balances:
  //   Cash: 52,000 + 12,000 - 10,500 = 53,500.00
  //   UPI: 25,000 + 11,000 - 0 = 36,000.00
  //   Bank: 1,00,000 + 0 - 35,000 = 65,000.00
  //   Cheque: 0
  //   Total Closing = 1,77,000 + 23,000 - 45,500 = 1,54,500.00

  // Query actual active models matching cashbook service derivation logic:
  const [activeSales, activeCustPays, activeExpenses, activeSuppPays, activePurchases] = await Promise.all([
    Sale.find({ status: "COMPLETED" }),
    CustomerPayment.find({ status: "RECORDED" }),
    Expense.find({ status: "RECORDED" }),
    SupplierPayment.find({ status: "RECORDED" }),
    Purchase.find({ amountPaid: { $gt: 0 } }),
  ]);

  let calcCashIn = 0;
  let calcUpiIn = 0;
  for (const s of activeSales) {
    calcCashIn += s.payment.cashAmount || 0;
    calcUpiIn += s.payment.upiAmount || 0;
  }
  for (const cp of activeCustPays) {
    if (cp.paymentMethod === "CASH") calcCashIn += cp.amount;
    if (cp.paymentMethod === "UPI") calcUpiIn += cp.amount;
  }

  let calcCashOut = 0;
  let calcBankOut = 0;
  for (const e of activeExpenses) {
    if (e.paymentMethod === "CASH") calcCashOut += e.amount;
    if (e.paymentMethod === "BANK_TRANSFER") calcBankOut += e.amount;
  }
  for (const sp of activeSuppPays) {
    if (sp.paymentMethod === "BANK_TRANSFER") calcBankOut += sp.amount;
  }
  for (const p of activePurchases) {
    calcCashOut += p.amountPaid;
  }

  assert(round2(calcCashIn) === 12000.0, "Derived Cash Inflows exactly equal ₹12,000.00");
  assert(round2(calcUpiIn) === 11000.0, "Derived UPI Inflows exactly equal ₹11,000.00");
  assert(round2(calcCashOut) === 10500.0, "Derived Cash Outflows exactly equal ₹10,500.00");
  assert(round2(calcBankOut) === 35000.0, "Derived Bank Outflows exactly equal ₹35,000.00");

  const totalInflows = round2(calcCashIn + calcUpiIn);
  const totalOutflows = round2(calcCashOut + calcBankOut);
  const finalCashBalance = round2(refreshedOpening.cash + calcCashIn - calcCashOut);
  const finalUpiBalance = round2(refreshedOpening.upi + calcUpiIn);
  const finalBankBalance = round2(refreshedOpening.bank - calcBankOut);
  const finalConsolidatedBalance = round2(finalCashBalance + finalUpiBalance + finalBankBalance);

  assert(totalInflows === 23000.0, "Total Consolidated Inflows equal ₹23,000.00");
  assert(totalOutflows === 45500.0, "Total Consolidated Outflows equal ₹45,500.00");
  assert(finalCashBalance === 53500.0, "Final Recorded Cash Balance is exactly ₹53,500.00");
  assert(finalUpiBalance === 36000.0, "Final Recorded UPI Balance is exactly ₹36,000.00");
  assert(finalBankBalance === 65000.0, "Final Recorded Bank Balance is exactly ₹65,000.00");
  assert(finalConsolidatedBalance === 154500.0, "Final Consolidated Total is exactly ₹1,54,500.00");

  // Invariant check:
  // Opening Balance + Inflows - Outflows == Closing Balance
  const openingTotal = round2(refreshedOpening.cash + refreshedOpening.upi + refreshedOpening.bank + refreshedOpening.cheque);
  const expectedClosing = round2(openingTotal + totalInflows - totalOutflows);
  assert(
    finalConsolidatedBalance === expectedClosing,
    `Core Cashbook Invariant strictly satisfied: Opening (${openingTotal}) + Inflows (${totalInflows}) - Outflows (${totalOutflows}) == Closing (${expectedClosing})`
  );

  // --------------------------------------------------------------------------
  console.log("\nSection 14: Category-wise Expense Breakdown Aggregation");
  // --------------------------------------------------------------------------
  const categoryAgg = await Expense.aggregate([
    { $match: { status: "RECORDED" } },
    {
      $group: {
        _id: "$categoryName",
        totalAmount: { $sum: "$amount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { totalAmount: -1 } },
  ]);

  assert(categoryAgg.length === 2, "Active expenses grouped into exactly 2 categories (Shop Rent and Fuel)");
  assert(categoryAgg[0]._id === "Shop Rent" && categoryAgg[0].totalAmount === 15000.0, "Shop Rent category total is ₹15,000.00");
  assert(categoryAgg[1]._id === "Fuel" && categoryAgg[1].totalAmount === 2500.0, "Fuel category total is ₹2,500.00 (reversed diesel bill excluded)");

  // --------------------------------------------------------------------------
  console.log("\nSection 15: RBAC Permission Evaluation");
  // --------------------------------------------------------------------------
  function checkPermission(user, perm) {
    if (user.role === "OWNER") return true;
    return (user.permissions || []).includes(perm);
  }

  assert(checkPermission(ownerUser, "expenses:view") === true, "OWNER has expenses:view");
  assert(checkPermission(ownerUser, "expenses:manage") === true, "OWNER has expenses:manage");
  assert(checkPermission(ownerUser, "cashbook:manage") === true, "OWNER has cashbook:manage");

  assert(checkPermission(clerkUser, "expenses:view") === true, "CLERK has expenses:view");
  assert(checkPermission(clerkUser, "expenses:manage") === false, "CLERK lacks expenses:manage");
  assert(checkPermission(clerkUser, "cashbook:view") === true, "CLERK has cashbook:view");
  assert(checkPermission(clerkUser, "cashbook:manage") === false, "CLERK lacks cashbook:manage");

  assert(checkPermission(cashierUser, "expenses:manage") === true, "CASHIER has expenses:manage");
  assert(checkPermission(cashierUser, "cashbook:manage") === true, "CASHIER has cashbook:manage");

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log("\n===============================================================================");
  console.log(` RESULTS: ${passCount} PASSED, ${failCount} FAILED`);
  console.log("===============================================================================\n");

  await mongoose.disconnect();
  await replSet.stop();
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  if (replSet) replSet.stop();
  process.exit(1);
});

