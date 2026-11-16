import mongoose from "mongoose";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import { Purchase, type IPurchaseDocument } from "@/models/purchase";
import { Supplier } from "@/models/supplier";
import { Product } from "@/models/product";
import { Category } from "@/models/category";
import { Batch } from "@/models/batch";
import { logAuditEvent } from "@/lib/auth";
import type {
  IPurchase,
  IPurchaseItem,
  IPurchaseReceipt,
  PurchaseFilterParams,
  PurchaseStatus,
  PurchaseSupplierSnapshot,
  PurchaseProductSnapshot,
} from "@/types/purchase";
import type {
  CreatePurchaseInput,
  UpdatePurchaseDraftInput,
  AmendPurchaseInput,
  ConfirmInwardInput,
} from "@/validations/purchase";

export interface ActorContext {
  id: string;
  name: string;
  ip?: string;
}

/**
 * High-precision two-decimal rounding (half-up)
 */
export function round2(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates item financial values with exact 2-decimal precision
 */
export function calculateItemLineValues(
  orderedQty: number,
  unitPurchasePrice: number,
  discountAmount: number = 0,
  taxRate: number = 0
): {
  gross: number;
  discount: number;
  taxable: number;
  tax: number;
  lineTotal: number;
} {
  const gross = round2(orderedQty * unitPurchasePrice);
  const discount = Math.min(gross, round2(discountAmount || 0));
  const taxable = round2(gross - discount);
  const tax = round2(taxable * ((taxRate || 0) / 100));
  const lineTotal = round2(taxable + tax);
  return { gross, discount, taxable, tax, lineTotal };
}

/**
 * Generates collision-proof SKU for newly saved catalogue products
 */
export async function generateAutoSku(session?: mongoose.ClientSession): Promise<string> {
  let collision = true;
  let finalSku = "";
  while (collision) {
    const timePart = Date.now().toString(36).toUpperCase();
    const randHex = crypto.randomBytes(3).toString("hex").toUpperCase();
    finalSku = `KASI-PRD-${timePart}-${randHex}`;
    let q = Product.findOne({ sku: finalSku });
    if (session) q = q.session(session);
    const existing = await q;
    if (!existing) {
      collision = false;
    }
  }
  return finalSku;
}

/**
 * Searches for duplicate active catalogue product by name & brand (case-insensitive)
 */
export async function findDuplicateCatalogueProduct(
  name: string,
  brand?: string,
  session?: mongoose.ClientSession
) {
  const escapedName = name.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const query: any = {
    name: { $regex: `^${escapedName}$`, $options: "i" },
    status: { $ne: "ARCHIVED" },
  };
  if (brand && brand.trim() && brand.trim().toLowerCase() !== "generic") {
    const escapedBrand = brand.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.brand = { $regex: `^${escapedBrand}$`, $options: "i" };
  }
  let q = Product.findOne(query);
  if (session) q = q.session(session);
  return q;
}

/**
 * Resolves an active category ID or falls back to first active category
 */
export async function resolveActiveCategoryId(
  manualCategoryId?: string,
  session?: mongoose.ClientSession
): Promise<mongoose.Types.ObjectId> {
  if (manualCategoryId && mongoose.Types.ObjectId.isValid(manualCategoryId)) {
    let catQuery = Category.findById(manualCategoryId);
    if (session) catQuery = catQuery.session(session);
    const cat = await catQuery;
    if (cat && cat.status === "ACTIVE") {
      return cat._id;
    }
  }
  let fallbackQuery = Category.findOne({ status: "ACTIVE" });
  if (session) fallbackQuery = fallbackQuery.session(session);
  let fallback = await fallbackQuery;
  if (!fallback) {
    const [created] = await Category.create(
      [
        {
          name: "General Agri Products",
          slug: "general-agri-products",
          description: "Default category for manually entered purchase items",
          status: "ACTIVE",
        },
      ],
      session ? { session } : {}
    );
    return created._id;
  }
  return fallback._id;
}

/**
 * Generates sequential collision-proof purchase bill number (PUR-YYYYMM-XXXX)
 */
export async function generatePurchaseNumber(): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `PUR-${yearMonth}-`;

  const lastPurchase = await Purchase.findOne(
    { purchaseNumber: { $regex: `^${prefix}` } },
    { purchaseNumber: 1 }
  ).sort({ purchaseNumber: -1 });

  let seq = 1;
  if (lastPurchase && lastPurchase.purchaseNumber) {
    const parts = lastPurchase.purchaseNumber.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      seq = lastSeq + 1;
    }
  }

  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/**
 * List purchases in Purchase Register with filters and KPI stats
 */
export async function listPurchases(params: PurchaseFilterParams): Promise<{
  purchases: IPurchase[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: {
    totalCount: number;
    totalGrossAmount: number;
    totalPaidAmount: number;
    totalOutstandingAmount: number;
    pendingReceiptCount: number;
    partiallyReceivedCount: number;
    receivedCount: number;
    draftCount: number;
    cancelledCount: number;
  };
}> {
  await connectDB();

  const query: any = {};

  if (params.search && params.search.trim()) {
    const term = params.search.trim();
    query.$or = [
      { purchaseNumber: { $regex: term, $options: "i" } },
      { supplierInvoiceNumber: { $regex: term, $options: "i" } },
      { "supplierSnapshot.name": { $regex: term, $options: "i" } },
    ];
  }

  if (params.supplierId) {
    query.supplierId = new mongoose.Types.ObjectId(params.supplierId);
  }

  if (params.status && params.status !== ("ALL" as any)) {
    query.status = params.status;
  }

  if (params.paymentStatus) {
    query.paymentStatus = params.paymentStatus;
  }

  if (params.startDate || params.endDate) {
    query.purchaseDate = {};
    if (params.startDate) {
      query.purchaseDate.$gte = new Date(params.startDate);
    }
    if (params.endDate) {
      const end = new Date(params.endDate);
      end.setHours(23, 59, 59, 999);
      query.purchaseDate.$lte = end;
    }
  }

  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, Math.min(100, params.limit || 20));
  const skip = (page - 1) * limit;

  const sortField = params.sortBy || "createdAt";
  const sortDirection = params.sortOrder === "asc" ? 1 : -1;
  const sortOptions: Record<string, 1 | -1> = { [sortField]: sortDirection };

  const [docs, totalCount, statsAgg] = await Promise.all([
    Purchase.find(query).sort(sortOptions).skip(skip).limit(limit).lean(),
    Purchase.countDocuments(query),
    Purchase.aggregate([
      {
        $group: {
          _id: null,
          totalCount: { $sum: 1 },
          totalGrossAmount: { $sum: "$grandTotal" },
          totalPaidAmount: { $sum: "$amountPaid" },
          totalOutstandingAmount: { $sum: "$outstandingAmount" },
          pendingReceiptCount: {
            $sum: { $cond: [{ $eq: ["$status", "PENDING_RECEIPT"] }, 1, 0] },
          },
          partiallyReceivedCount: {
            $sum: { $cond: [{ $eq: ["$status", "PARTIALLY_RECEIVED"] }, 1, 0] },
          },
          receivedCount: {
            $sum: { $cond: [{ $eq: ["$status", "RECEIVED"] }, 1, 0] },
          },
          draftCount: {
            $sum: { $cond: [{ $eq: ["$status", "DRAFT"] }, 1, 0] },
          },
          cancelledCount: {
            $sum: { $cond: [{ $eq: ["$status", "CANCELLED"] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  const defaultStats = {
    totalCount: 0,
    totalGrossAmount: 0,
    totalPaidAmount: 0,
    totalOutstandingAmount: 0,
    pendingReceiptCount: 0,
    partiallyReceivedCount: 0,
    receivedCount: 0,
    draftCount: 0,
    cancelledCount: 0,
  };

  const stats = statsAgg.length > 0 ? { ...defaultStats, ...statsAgg[0] } : defaultStats;
  delete (stats as any)._id;

  const purchases: IPurchase[] = docs.map((doc: any) => ({
    ...doc,
    id: doc._id.toString(),
    _id: doc._id.toString(),
    supplierId: doc.supplierId.toString(),
    createdById: doc.createdById?.toString(),
    updatedById: doc.updatedById?.toString(),
    items: doc.items.map((it: any) => ({
      ...it,
      id: it._id?.toString(),
      _id: it._id?.toString(),
      productId: it.productId ? it.productId.toString() : undefined,
    })),
  }));

  return {
    purchases,
    totalCount,
    page,
    limit,
    totalPages: Math.ceil(totalCount / limit) || 1,
    stats: {
      ...stats,
      totalGrossAmount: round2(stats.totalGrossAmount),
      totalPaidAmount: round2(stats.totalPaidAmount),
      totalOutstandingAmount: round2(stats.totalOutstandingAmount),
    },
  };
}

/**
 * Get purchase bill by ID
 */
export async function getPurchaseById(id: string): Promise<IPurchase> {
  await connectDB();

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid purchase order ID format");
  }

  const doc = await Purchase.findById(id).lean();
  if (!doc) {
    throw new Error("Purchase order not found");
  }

  return ({
    ...doc,
    id: (doc as any)._id.toString(),
    _id: (doc as any)._id.toString(),
    supplierId: doc.supplierId.toString(),
    createdById: doc.createdById?.toString(),
    updatedById: doc.updatedById?.toString(),
    items: doc.items.map((it: any) => ({
      ...it,
      id: it._id?.toString(),
      _id: it._id?.toString(),
      productId: it.productId ? it.productId.toString() : undefined,
    })),
  } as unknown) as IPurchase;
}

/**
 * Creates an actual Purchase Bill in Purchase Register
 * Supports optional upfront payment and optional immediate stock inward
 */
export async function createPurchase(
  input: CreatePurchaseInput,
  actor: ActorContext
): Promise<IPurchase> {
  await connectDB();

  // 1. Validate Supplier
  const supplier = await Supplier.findById(input.supplierId);
  if (!supplier) {
    throw new Error("Selected supplier does not exist");
  }
  if (supplier.status !== "ACTIVE") {
    throw new Error(`Supplier '${supplier.name}' is ${supplier.status.toLowerCase()} and cannot accept new purchases`);
  }

  // 2. Check compound unique index: supplierId + supplierInvoiceNumber
  const existingInvoice = await Purchase.findOne({
    supplierId: supplier._id,
    supplierInvoiceNumber: input.supplierInvoiceNumber.trim(),
  });
  if (existingInvoice) {
    throw new Error(
      `An invoice with number '${input.supplierInvoiceNumber}' already exists for supplier '${supplier.name}'.`
    );
  }

  // 3. Prepare Supplier Snapshot
  const supplierSnapshot: PurchaseSupplierSnapshot = {
    name: supplier.name,
    contactPerson: supplier.contactPerson || undefined,
    phone: supplier.phone,
    email: supplier.email || undefined,
    gstin: supplier.gstin || undefined,
    address: supplier.address
      ? {
          street: supplier.address.street,
          city: supplier.address.city,
          state: supplier.address.state,
          pincode: supplier.address.pincode,
        }
      : undefined,
  };

  // 4. Validate and build line items
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let grandTotal = 0;

  const items: any[] = [];

  for (const itemInput of input.items) {
    // Validate batch quantities if batches are provided
    if (itemInput.batches && itemInput.batches.length > 0) {
      const batchSum = itemInput.batches.reduce((sum, b) => sum + b.quantity, 0);
      if (round2(batchSum) !== round2(itemInput.orderedQty)) {
        const prodName = itemInput.isManualProduct
          ? itemInput.manualProductName || "Manual Product"
          : "selected product";
        throw new Error(
          `Sum of batch quantities (${batchSum}) must equal ordered quantity (${itemInput.orderedQty}) for product '${prodName}'`
        );
      }
    }

    const calc = calculateItemLineValues(
      itemInput.orderedQty,
      itemInput.unitPurchasePrice,
      itemInput.discountAmount || 0,
      itemInput.taxRate || 0
    );

    let productId: mongoose.Types.ObjectId | undefined = undefined;
    let productSnapshot: PurchaseProductSnapshot;
    let unit: string = "BAGS";

    if (itemInput.isManualProduct) {
      const manualName = (itemInput.manualProductName || "").trim();
      const manualBrand = (itemInput.manualBrand || "").trim() || "Generic";
      const manualUnit = (itemInput.manualUnit || "").trim() || "BAGS";
      unit = manualUnit;

      productSnapshot = {
        name: manualName,
        sku: undefined,
        brand: manualBrand,
        primaryUnit: manualUnit,
        barcode: undefined,
      };

      if (itemInput.saveToCatalogue) {
        // If not receiveNow, check duplicate or create catalog product now with 0 stock
        // (if receiveNow is true, creation happens inside createAndInwardPurchaseAtomic transaction)
        if (!input.receiveNow) {
          const duplicate = await findDuplicateCatalogueProduct(manualName, manualBrand);
          if (duplicate) {
            productId = duplicate._id as mongoose.Types.ObjectId;
            productSnapshot.sku = duplicate.sku || undefined;
            productSnapshot.brand = duplicate.brand;
            productSnapshot.primaryUnit = duplicate.primaryUnit;
          } else {
            const autoSku = await generateAutoSku();
            const catId = await resolveActiveCategoryId(itemInput.manualCategoryId);
            const [newProd] = await Product.create([
              {
                name: manualName,
                sku: autoSku,
                brand: manualBrand,
                categoryId: catId,
                primaryUnit: manualUnit as any,
                purchasePrice: round2(itemInput.unitPurchasePrice),
                sellingPrice: round2(itemInput.manualSellingPrice || itemInput.unitPurchasePrice),
                minStockThreshold: 10,
                status: "ACTIVE",
                currentStock: 0,
              },
            ]);
            productId = newProd._id as mongoose.Types.ObjectId;
            productSnapshot.sku = autoSku;
          }
        }
      }
    } else {
      const product = await Product.findById(itemInput.productId);
      if (!product) {
        throw new Error(`Product with ID '${itemInput.productId}' not found`);
      }
      if (product.status !== "ACTIVE") {
        throw new Error(`Product '${product.name}' is not ACTIVE`);
      }
      productId = product._id as mongoose.Types.ObjectId;
      unit = product.primaryUnit;
      productSnapshot = {
        name: product.name,
        sku: product.sku || undefined,
        brand: product.brand,
        primaryUnit: product.primaryUnit,
        barcode: product.barcode || undefined,
      };
    }

    items.push({
      productId,
      isManualProduct: Boolean(itemInput.isManualProduct),
      saveToCatalogue: Boolean(itemInput.saveToCatalogue),
      productSnapshot,
      orderedQty: itemInput.orderedQty,
      receivedQty: 0,
      unit,
      unitPurchasePrice: round2(itemInput.unitPurchasePrice),
      discountAmount: calc.discount,
      taxRate: round2(itemInput.taxRate || 0),
      taxAmount: calc.tax,
      lineTotal: calc.lineTotal,
      recognizedValue: 0,
      batches: itemInput.batches || [],
    });

    subtotal = round2(subtotal + calc.taxable);
    totalDiscount = round2(totalDiscount + calc.discount);
    totalTax = round2(totalTax + calc.tax);
    grandTotal = round2(grandTotal + calc.lineTotal);
  }

  const purchaseNumber = await generatePurchaseNumber();
  const amountPaid = round2(input.amountPaid || 0);

  // If immediate stock inward is requested upon bill creation
  if (input.receiveNow) {
    return createAndInwardPurchaseAtomic(
      {
        purchaseNumber,
        supplier,
        supplierSnapshot,
        supplierInvoiceNumber: input.supplierInvoiceNumber.trim(),
        supplierInvoiceDate: new Date(input.supplierInvoiceDate),
        purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : new Date(),
        items,
        subtotal,
        totalDiscount,
        totalTax,
        grandTotal,
        amountPaid,
        notes: input.notes?.trim(),
      },
      actor
    );
  }

  // Normal Purchase Bill Entry (Pending Receipt / Draft)
  const initialStatus: PurchaseStatus = input.status === "DRAFT" ? "DRAFT" : "PENDING_RECEIPT";

  const purchase = new Purchase({
    purchaseNumber,
    supplierId: supplier._id,
    supplierSnapshot,
    supplierInvoiceNumber: input.supplierInvoiceNumber.trim(),
    supplierInvoiceDate: new Date(input.supplierInvoiceDate),
    purchaseDate: input.purchaseDate ? new Date(input.purchaseDate) : new Date(),
    items,
    subtotal,
    discountAmount: totalDiscount,
    taxAmount: totalTax,
    grandTotal,
    receivedQty: 0,
    recognizedInvoiceValue: 0,
    amountPaid,
    outstandingAmount: 0, // Zero financial liability recognized until goods are inwarded!
    paymentStatus: amountPaid > 0 ? "PARTIALLY_PAID" : "UNPAID",
    status: initialStatus,
    receipts: [],
    amendments: [],
    notes: input.notes?.trim() || undefined,
    createdById: new mongoose.Types.ObjectId(actor.id),
  });

  await purchase.save();

  await logAuditEvent({
    action: "PURCHASE_CREATED" as any,
    userId: actor.id,
    userName: actor.name,
    ipAddress: actor.ip,
    details: {
      purchaseId: purchase._id.toString(),
      purchaseNumber: purchase.purchaseNumber,
      supplierId: supplier._id.toString(),
      supplierName: supplier.name,
      grandTotal,
      amountPaid,
      status: initialStatus,
    },
  });

  return getPurchaseById(purchase._id.toString());
}

/**
 * Atomic helper to create and inward purchase simultaneously in a native MongoDB transaction
 */
async function createAndInwardPurchaseAtomic(
  params: {
    purchaseNumber: string;
    supplier: any;
    supplierSnapshot: PurchaseSupplierSnapshot;
    supplierInvoiceNumber: string;
    supplierInvoiceDate: Date;
    purchaseDate: Date;
    items: any[];
    subtotal: number;
    totalDiscount: number;
    totalTax: number;
    grandTotal: number;
    amountPaid: number;
    notes?: string;
  },
  actor: ActorContext
): Promise<IPurchase> {
  const session = await mongoose.startSession();

  let createdPurchaseId: string = "";

  try {
    await session.withTransaction(async () => {
      const receiptItems: any[] = [];
      let totalReceivedQty = 0;

      for (const item of params.items) {
        item.receivedQty = item.orderedQty;
        item.recognizedValue = item.lineTotal;
        totalReceivedQty += item.orderedQty;

        // If item is a manual product requested to be saved to catalogue and not yet created
        if (item.isManualProduct && item.saveToCatalogue && !item.productId) {
          const duplicate = await findDuplicateCatalogueProduct(
            item.productSnapshot.name,
            item.productSnapshot.brand,
            session
          );
          if (duplicate) {
            item.productId = duplicate._id;
            item.productSnapshot.sku = duplicate.sku || undefined;
            item.productSnapshot.brand = duplicate.brand;
            item.productSnapshot.primaryUnit = duplicate.primaryUnit;
          } else {
            const autoSku = await generateAutoSku(session);
            const catId = await resolveActiveCategoryId(undefined, session);
            const [newProd] = await Product.create(
              [
                {
                  name: item.productSnapshot.name,
                  sku: autoSku,
                  brand: item.productSnapshot.brand || "Generic",
                  categoryId: catId,
                  primaryUnit: item.unit as any,
                  purchasePrice: round2(item.unitPurchasePrice),
                  sellingPrice: round2(item.unitPurchasePrice),
                  minStockThreshold: 10,
                  status: "ACTIVE",
                  currentStock: 0,
                },
              ],
              { session }
            );
            item.productId = newProd._id;
            item.productSnapshot.sku = autoSku;
          }
        }

        // Process inventory stock & batches if item has a catalogue productId
        let itemBatches: any[] = [];
        if (item.productId) {
          // 1. Atomic Product stock increment
          await Product.findByIdAndUpdate(
            item.productId,
            { $inc: { currentStock: item.orderedQty } },
            { session }
          );

          // 2. Atomic Batch processing
          itemBatches =
            item.batches && item.batches.length > 0
              ? item.batches
              : [
                  {
                    batchNumber: `BAT-${params.purchaseNumber.replace(/[^0-9]/g, "")}-${String(
                      item.productId
                    ).slice(-4)}`,
                    quantity: item.orderedQty,
                  },
                ];

          for (const b of itemBatches) {
            const existingBatch = await Batch.findOne({
              productId: item.productId,
              batchNumber: b.batchNumber.toUpperCase().trim(),
            }).session(session);

            if (existingBatch) {
              if (
                b.expiryDate &&
                existingBatch.expiryDate &&
                new Date(b.expiryDate).toISOString() !==
                  new Date(existingBatch.expiryDate).toISOString()
              ) {
                throw new Error(
                  `Conflicting expiry date for existing batch '${b.batchNumber}'. Existing: ${existingBatch.expiryDate.toISOString()}, Provided: ${new Date(
                    b.expiryDate
                  ).toISOString()}`
                );
              }
              existingBatch.quantity += b.quantity;
              await existingBatch.save({ session });
            } else {
              await Batch.create(
                [
                  {
                    productId: item.productId,
                    batchNumber: b.batchNumber.toUpperCase().trim(),
                    manufacturingDate: b.manufacturingDate
                      ? new Date(b.manufacturingDate)
                      : undefined,
                    expiryDate: b.expiryDate ? new Date(b.expiryDate) : undefined,
                    quantity: b.quantity,
                    purchasePrice: item.unitPurchasePrice,
                    status: "ACTIVE",
                  },
                ],
                { session }
              );
            }
          }
        } else {
          // Purchase-only manual line item: do not mutate Product/Batch collections
          itemBatches =
            item.batches && item.batches.length > 0
              ? item.batches
              : [
                  {
                    batchNumber: `BAT-${params.purchaseNumber.replace(/[^0-9]/g, "")}-MAN`,
                    quantity: item.orderedQty,
                  },
                ];
        }

        receiptItems.push({
          productId: item.productId ? item.productId.toString() : undefined,
          productName: item.productSnapshot?.name,
          receivedQty: item.orderedQty,
          recognizedValue: item.lineTotal,
          batches: itemBatches,
        });
      }

      const outstandingAmount = Math.max(0, round2(params.grandTotal - params.amountPaid));
      const paymentStatus =
        params.amountPaid >= params.grandTotal
          ? "PAID"
          : params.amountPaid > 0
          ? "PARTIALLY_PAID"
          : "UNPAID";

      const receiptRecord: IPurchaseReceipt = {
        receiptNumber: `REC-${params.purchaseNumber}-01`,
        receiptDate: new Date(),
        receivedById: actor.id,
        receivedByName: actor.name,
        items: receiptItems,
        totalRecognizedValue: params.grandTotal,
        notes: "Full receipt upon purchase bill creation",
      };

      // 3. Create purchase with full receipt and recognized liability
      const [newPurchase] = await Purchase.create(
        [
          {
            purchaseNumber: params.purchaseNumber,
            supplierId: params.supplier._id,
            supplierSnapshot: params.supplierSnapshot,
            supplierInvoiceNumber: params.supplierInvoiceNumber,
            supplierInvoiceDate: params.supplierInvoiceDate,
            purchaseDate: params.purchaseDate,
            items: params.items,
            subtotal: params.subtotal,
            discountAmount: params.totalDiscount,
            taxAmount: params.totalTax,
            grandTotal: params.grandTotal,
            receivedQty: totalReceivedQty,
            recognizedInvoiceValue: params.grandTotal,
            amountPaid: params.amountPaid,
            outstandingAmount,
            paymentStatus,
            status: "RECEIVED",
            receipts: [receiptRecord],
            amendments: [],
            notes: params.notes,
            createdById: new mongoose.Types.ObjectId(actor.id),
          },
        ],
        { session }
      );

      createdPurchaseId = newPurchase._id.toString();

      // 4. Atomic Supplier Ledger update
      await Supplier.findByIdAndUpdate(
        params.supplier._id,
        {
          $inc: {
            totalPurchases: params.grandTotal,
            totalPaid: params.amountPaid,
            outstandingBalance: outstandingAmount,
          },
        },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  await logAuditEvent({
    action: "PURCHASE_INWARD_CONFIRMED" as any,
    userId: actor.id,
    userName: actor.name,
    ipAddress: actor.ip,
    details: {
      purchaseId: createdPurchaseId,
      purchaseNumber: params.purchaseNumber,
      recognizedValue: params.grandTotal,
      amountPaid: params.amountPaid,
    },
  });

  return getPurchaseById(createdPurchaseId);
}

/**
 * Confirms physical goods inward against an existing purchase bill
 * Supports partial or full receipt with deterministic financial recognition
 * Enforces native MongoDB transactions and strict database idempotency
 */
export async function confirmPurchaseInward(
  id: string,
  input: ConfirmInwardInput,
  actor: ActorContext
): Promise<IPurchase> {
  await connectDB();

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid purchase order ID format");
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const purchase = await Purchase.findById(id).session(session);
      if (!purchase) {
        throw new Error("Purchase order not found");
      }

      if (purchase.status === "CANCELLED") {
        throw new Error("Cannot inward stock on a cancelled purchase bill");
      }

      if (purchase.status === "RECEIVED") {
        throw new Error(`Purchase '${purchase.purchaseNumber}' is already fully received. Duplicate inward rejected.`);
      }

      let totalNewlyRecognizedValue = 0;
      let totalNewlyReceivedQty = 0;
      const receiptItems: any[] = [];

      for (const inwardItem of input.items) {
        const lineItem = purchase.items.find((it) => {
          if (inwardItem.itemId && (it as any)._id?.toString() === inwardItem.itemId) {
            return true;
          }
          if (
            inwardItem.productId &&
            it.productId &&
            it.productId.toString() === inwardItem.productId
          ) {
            return true;
          }
          return false;
        });
        if (!lineItem) {
          throw new Error(
            `Line item '${inwardItem.itemId || inwardItem.productId}' does not exist on this purchase bill`
          );
        }

        const remainingOrdered = round2(lineItem.orderedQty - lineItem.receivedQty);
        if (inwardItem.receivedQty > remainingOrdered) {
          throw new Error(
            `Received quantity (${inwardItem.receivedQty}) exceeds remaining ordered quantity (${remainingOrdered}) for product '${lineItem.productSnapshot?.name}'`
          );
        }

        // Validate sum of batch quantities equals received quantity
        const batchSum = inwardItem.batches.reduce((sum, b) => sum + b.quantity, 0);
        if (round2(batchSum) !== round2(inwardItem.receivedQty)) {
          throw new Error(
            `Sum of batch quantities (${batchSum}) must equal received quantity (${inwardItem.receivedQty}) for product '${lineItem.productSnapshot?.name}'`
          );
        }

        // Deterministic Financial Allocation:
        // Final receipt absorbs any rounding remainder so total recognized matches line total exactly
        let itemRecognizedIncrement = 0;
        const newCumulativeReceived = round2(lineItem.receivedQty + inwardItem.receivedQty);

        if (newCumulativeReceived === lineItem.orderedQty) {
          // Final receipt: absorbs exact remainder
          itemRecognizedIncrement = round2(lineItem.lineTotal - lineItem.recognizedValue);
        } else {
          // Partial receipt: proportional allocation
          itemRecognizedIncrement = round2(
            (inwardItem.receivedQty / lineItem.orderedQty) * lineItem.lineTotal
          );
        }

        // 1. Increment Product Stock atomically (if catalogue product)
        if (lineItem.productId) {
          await Product.findByIdAndUpdate(
            lineItem.productId,
            { $inc: { currentStock: inwardItem.receivedQty } },
            { session }
          );

          // 2. Upsert/Increment Batches atomically
          for (const b of inwardItem.batches) {
            const existingBatch = await Batch.findOne({
              productId: lineItem.productId,
              batchNumber: b.batchNumber.toUpperCase().trim(),
            }).session(session);

            if (existingBatch) {
              if (
                b.expiryDate &&
                existingBatch.expiryDate &&
                new Date(b.expiryDate).toISOString() !==
                  new Date(existingBatch.expiryDate).toISOString()
              ) {
                throw new Error(
                  `Conflicting expiry date for existing batch '${b.batchNumber}'. Existing: ${existingBatch.expiryDate.toISOString()}, Provided: ${new Date(
                    b.expiryDate
                  ).toISOString()}`
                );
              }
              existingBatch.quantity += b.quantity;
              await existingBatch.save({ session });
            } else {
              await Batch.create(
                [
                  {
                    productId: lineItem.productId,
                    batchNumber: b.batchNumber.toUpperCase().trim(),
                    manufacturingDate: b.manufacturingDate
                      ? new Date(b.manufacturingDate)
                      : undefined,
                    expiryDate: b.expiryDate ? new Date(b.expiryDate) : undefined,
                    quantity: b.quantity,
                    purchasePrice: lineItem.unitPurchasePrice,
                    status: "ACTIVE",
                  },
                ],
                { session }
              );
            }
          }
        }

        // Update line item counters
        lineItem.receivedQty = newCumulativeReceived;
        lineItem.recognizedValue = round2(lineItem.recognizedValue + itemRecognizedIncrement);

        totalNewlyReceivedQty = round2(totalNewlyReceivedQty + inwardItem.receivedQty);
        totalNewlyRecognizedValue = round2(totalNewlyRecognizedValue + itemRecognizedIncrement);

        receiptItems.push({
          productId: lineItem.productId ? lineItem.productId.toString() : undefined,
          itemId: (lineItem as any)._id ? (lineItem as any)._id.toString() : undefined,
          productName: lineItem.productSnapshot?.name,
          receivedQty: inwardItem.receivedQty,
          recognizedValue: itemRecognizedIncrement,
          batches: inwardItem.batches,
        });
      }

      // Update purchase counters
      purchase.receivedQty = round2(purchase.receivedQty + totalNewlyReceivedQty);
      purchase.recognizedInvoiceValue = round2(
        purchase.recognizedInvoiceValue + totalNewlyRecognizedValue
      );
      purchase.outstandingAmount = Math.max(
        0,
        round2(purchase.recognizedInvoiceValue - purchase.amountPaid)
      );

      // Status resolution
      const allFullyReceived = purchase.items.every(
        (it) => it.receivedQty >= it.orderedQty
      );
      purchase.status = allFullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";

      // Payment status resolution
      if (purchase.amountPaid >= purchase.recognizedInvoiceValue && purchase.recognizedInvoiceValue > 0) {
        purchase.paymentStatus = "PAID";
      } else if (purchase.amountPaid > 0) {
        purchase.paymentStatus = "PARTIALLY_PAID";
      } else {
        purchase.paymentStatus = "UNPAID";
      }

      const receiptCount = (purchase.receipts?.length || 0) + 1;
      const receiptNumber = `REC-${purchase.purchaseNumber}-${String(receiptCount).padStart(2, "0")}`;

      purchase.receipts.push({
        receiptNumber,
        receiptDate: new Date(),
        receivedById: actor.id as any,
        receivedByName: actor.name,
        items: receiptItems,
        totalRecognizedValue: totalNewlyRecognizedValue,
        notes: input.notes?.trim(),
      });

      purchase.updatedById = new mongoose.Types.ObjectId(actor.id);
      await purchase.save({ session });

      // 3. Increment Supplier Financial Ledger atomically
      await Supplier.findByIdAndUpdate(
        purchase.supplierId,
        {
          $inc: {
            totalPurchases: totalNewlyRecognizedValue,
            outstandingBalance: totalNewlyRecognizedValue,
          },
        },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  await logAuditEvent({
    action: "PURCHASE_INWARD_CONFIRMED" as any,
    userId: actor.id,
    userName: actor.name,
    ipAddress: actor.ip,
    details: {
      purchaseId: id,
      itemsCount: input.items.length,
    },
  });

  return getPurchaseById(id);
}

/**
 * Updates a purchase draft (only allowed while in DRAFT status)
 */
export async function updatePurchaseDraft(
  id: string,
  input: UpdatePurchaseDraftInput,
  actor: ActorContext
): Promise<IPurchase> {
  await connectDB();

  const purchase = await Purchase.findById(id);
  if (!purchase) {
    throw new Error("Purchase order not found");
  }

  if (purchase.status !== "DRAFT") {
    throw new Error(`Cannot edit purchase in '${purchase.status}' status. Use controlled amendments.`);
  }

  if (input.supplierInvoiceNumber) {
    purchase.supplierInvoiceNumber = input.supplierInvoiceNumber.trim();
  }
  if (input.supplierInvoiceDate) {
    purchase.supplierInvoiceDate = new Date(input.supplierInvoiceDate);
  }
  if (input.notes !== undefined) {
    purchase.notes = input.notes.trim() || undefined;
  }
  if (input.status) {
    purchase.status = input.status;
  }
  if (input.amountPaid !== undefined) {
    purchase.amountPaid = round2(input.amountPaid);
  }

  if (input.items && input.items.length > 0) {
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let grandTotal = 0;

    const items: any[] = [];

    for (const itemInput of input.items) {
      let productId: mongoose.Types.ObjectId | undefined = undefined;
      let productSnapshot: PurchaseProductSnapshot;
      let unit: string = "BAGS";

      if (itemInput.isManualProduct) {
        const manualName = (itemInput.manualProductName || "").trim();
        const manualBrand = (itemInput.manualBrand || "").trim() || "Generic";
        const manualUnit = (itemInput.manualUnit || "").trim() || "BAGS";
        unit = manualUnit;

        productSnapshot = {
          name: manualName,
          sku: undefined,
          brand: manualBrand,
          primaryUnit: manualUnit,
          barcode: undefined,
        };

        if (itemInput.saveToCatalogue) {
          const duplicate = await findDuplicateCatalogueProduct(manualName, manualBrand);
          if (duplicate) {
            productId = duplicate._id as mongoose.Types.ObjectId;
            productSnapshot.sku = duplicate.sku || undefined;
            productSnapshot.brand = duplicate.brand;
            productSnapshot.primaryUnit = duplicate.primaryUnit;
          } else {
            const autoSku = await generateAutoSku();
            const catId = await resolveActiveCategoryId(itemInput.manualCategoryId);
            const [newProd] = await Product.create([
              {
                name: manualName,
                sku: autoSku,
                brand: manualBrand,
                categoryId: catId,
                primaryUnit: manualUnit as any,
                purchasePrice: round2(itemInput.unitPurchasePrice),
                sellingPrice: round2(itemInput.manualSellingPrice || itemInput.unitPurchasePrice),
                minStockThreshold: 10,
                status: "ACTIVE",
                currentStock: 0,
              },
            ]);
            productId = newProd._id as mongoose.Types.ObjectId;
            productSnapshot.sku = autoSku;
          }
        }
      } else {
        const product = await Product.findById(itemInput.productId);
        if (!product) {
          throw new Error(`Product '${itemInput.productId}' not found`);
        }
        productId = product._id as mongoose.Types.ObjectId;
        unit = product.primaryUnit;
        productSnapshot = {
          name: product.name,
          sku: product.sku || undefined,
          brand: product.brand,
          primaryUnit: product.primaryUnit,
          barcode: product.barcode || undefined,
        };
      }

      const calc = calculateItemLineValues(
        itemInput.orderedQty,
        itemInput.unitPurchasePrice,
        itemInput.discountAmount || 0,
        itemInput.taxRate || 0
      );

      items.push({
        productId,
        isManualProduct: Boolean(itemInput.isManualProduct),
        saveToCatalogue: Boolean(itemInput.saveToCatalogue),
        productSnapshot,
        orderedQty: itemInput.orderedQty,
        receivedQty: 0,
        unit,
        unitPurchasePrice: round2(itemInput.unitPurchasePrice),
        discountAmount: calc.discount,
        taxRate: round2(itemInput.taxRate || 0),
        taxAmount: calc.tax,
        lineTotal: calc.lineTotal,
        recognizedValue: 0,
        batches: itemInput.batches || [],
      });

      subtotal = round2(subtotal + calc.taxable);
      totalDiscount = round2(totalDiscount + calc.discount);
      totalTax = round2(totalTax + calc.tax);
      grandTotal = round2(grandTotal + calc.lineTotal);
    }

    purchase.items = items as any;
    purchase.subtotal = subtotal;
    purchase.discountAmount = totalDiscount;
    purchase.taxAmount = totalTax;
    purchase.grandTotal = grandTotal;
  }

  purchase.updatedById = new mongoose.Types.ObjectId(actor.id);
  await purchase.save();

  await logAuditEvent({
    action: "PURCHASE_UPDATED" as any,
    userId: actor.id,
    userName: actor.name,
    ipAddress: actor.ip,
    details: {
      purchaseId: purchase._id.toString(),
      purchaseNumber: purchase.purchaseNumber,
      status: purchase.status,
    },
  });

  return getPurchaseById(purchase._id.toString());
}

/**
 * Cancels an unreceived purchase bill
 */
export async function cancelPurchase(
  id: string,
  reason: string,
  actor: ActorContext
): Promise<IPurchase> {
  await connectDB();

  const purchase = await Purchase.findById(id);
  if (!purchase) {
    throw new Error("Purchase order not found");
  }

  if (purchase.status === "CANCELLED") {
    throw new Error("Purchase order is already cancelled");
  }

  // Strictly block cancellation if goods have been inwarded into physical stock
  if (purchase.receivedQty > 0 || purchase.status === "PARTIALLY_RECEIVED" || purchase.status === "RECEIVED") {
    throw new Error(
      `Cannot cancel purchase '${purchase.purchaseNumber}' because ${purchase.receivedQty} items have already been received into stock.`
    );
  }

  purchase.status = "CANCELLED";
  purchase.updatedById = new mongoose.Types.ObjectId(actor.id);
  await purchase.save();

  await logAuditEvent({
    action: "PURCHASE_CANCELLED" as any,
    userId: actor.id,
    userName: actor.name,
    ipAddress: actor.ip,
    details: {
      purchaseId: purchase._id.toString(),
      purchaseNumber: purchase.purchaseNumber,
      reason,
    },
  });

  return getPurchaseById(purchase._id.toString());
}

/**
 * Controlled purchase amendment with Floor Guard constraint
 */
export async function amendPurchase(
  id: string,
  input: AmendPurchaseInput,
  actor: ActorContext
): Promise<IPurchase> {
  await connectDB();

  const purchase = await Purchase.findById(id);
  if (!purchase) {
    throw new Error("Purchase order not found");
  }

  if (purchase.status === "CANCELLED") {
    throw new Error("Cannot amend a cancelled purchase order");
  }

  const previousItems = JSON.parse(JSON.stringify(purchase.items));
  const previousGrandTotal = purchase.grandTotal;

  // Floor Guard Check
  for (const itemInput of input.items) {
    const existing = purchase.items.find(
      (it) => (it.productId && itemInput.productId && it.productId.toString() === itemInput.productId) ||
              ((it as any)._id && (itemInput as any).itemId && (it as any)._id.toString() === (itemInput as any).itemId)
    );
    if (existing && existing.receivedQty > 0) {
      if (itemInput.orderedQty < existing.receivedQty) {
        throw new Error(
          `Floor Guard: Cannot reduce ordered quantity for '${existing.productSnapshot?.name}' below already received quantity (${existing.receivedQty} ${existing.unit}).`
        );
      }
    }
  }

  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let grandTotal = 0;

  const revisedItems: any[] = [];

  for (const itemInput of input.items) {
    const existing = purchase.items.find(
      (it) => (it.productId && itemInput.productId && it.productId.toString() === itemInput.productId) ||
              ((it as any)._id && (itemInput as any).itemId && (it as any)._id.toString() === (itemInput as any).itemId)
    );

    let productId: mongoose.Types.ObjectId | undefined = undefined;
    let productSnapshot: PurchaseProductSnapshot;
    let unit: string = "BAGS";

    if (itemInput.isManualProduct || (!itemInput.productId && existing?.isManualProduct)) {
      unit = itemInput.manualUnit || existing?.unit || "BAGS";
      productSnapshot = existing?.productSnapshot || {
        name: itemInput.manualProductName || "Manual Item",
        brand: itemInput.manualBrand || "Generic",
        primaryUnit: unit,
      };
      productId = existing?.productId ? new mongoose.Types.ObjectId(existing.productId) : undefined;
    } else {
      const product = await Product.findById(itemInput.productId);
      if (!product) {
        throw new Error(`Product '${itemInput.productId}' not found`);
      }
      productId = product._id as mongoose.Types.ObjectId;
      unit = product.primaryUnit;
      productSnapshot = {
        name: product.name,
        sku: product.sku || undefined,
        brand: product.brand,
        primaryUnit: product.primaryUnit,
        barcode: product.barcode || undefined,
      };
    }

    const calc = calculateItemLineValues(
      itemInput.orderedQty,
      itemInput.unitPurchasePrice,
      itemInput.discountAmount || 0,
      itemInput.taxRate || 0
    );

    revisedItems.push({
      productId,
      isManualProduct: Boolean(itemInput.isManualProduct || existing?.isManualProduct),
      saveToCatalogue: Boolean(itemInput.saveToCatalogue || existing?.saveToCatalogue),
      productSnapshot,
      orderedQty: itemInput.orderedQty,
      receivedQty: existing ? existing.receivedQty : 0,
      unit,
      unitPurchasePrice: round2(itemInput.unitPurchasePrice),
      discountAmount: calc.discount,
      taxRate: round2(itemInput.taxRate || 0),
      taxAmount: calc.tax,
      lineTotal: calc.lineTotal,
      recognizedValue: existing ? existing.recognizedValue : 0,
      batches: existing?.batches || [],
    });

    subtotal = round2(subtotal + calc.taxable);
    totalDiscount = round2(totalDiscount + calc.discount);
    totalTax = round2(totalTax + calc.tax);
    grandTotal = round2(grandTotal + calc.lineTotal);
  }

  const amendmentNumber = (purchase.amendments?.length || 0) + 1;

  purchase.items = revisedItems as any;
  purchase.subtotal = subtotal;
  purchase.discountAmount = totalDiscount;
  purchase.taxAmount = totalTax;
  purchase.grandTotal = grandTotal;

  purchase.amendments.push({
    amendmentNumber,
    amendedAt: new Date().toISOString(),
    amendedById: actor.id,
    amendedByName: actor.name,
    reason: input.reason.trim(),
    previousItems,
    revisedItems: JSON.parse(JSON.stringify(revisedItems)),
    previousGrandTotal,
    revisedGrandTotal: grandTotal,
  });

  purchase.updatedById = new mongoose.Types.ObjectId(actor.id);
  await purchase.save();

  await logAuditEvent({
    action: "PURCHASE_AMENDED" as any,
    userId: actor.id,
    userName: actor.name,
    ipAddress: actor.ip,
    details: {
      purchaseId: purchase._id.toString(),
      purchaseNumber: purchase.purchaseNumber,
      amendmentNumber,
      reason: input.reason.trim(),
      previousGrandTotal,
      newGrandTotal: grandTotal,
    },
  });

  return getPurchaseById(purchase._id.toString());
}
