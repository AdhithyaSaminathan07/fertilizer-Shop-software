import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Purchase, type IPurchaseDocument } from "@/models/purchase";
import { Supplier } from "@/models/supplier";
import { Product } from "@/models/product";
import { logAuditEvent } from "@/lib/auth";
import type {
  IPurchase,
  IPurchaseItem,
  PurchaseFilterParams,
  PurchaseStatus,
  PurchaseSupplierSnapshot,
  PurchaseProductSnapshot,
} from "@/types/purchase";
import type {
  CreatePurchaseInput,
  UpdatePurchaseDraftInput,
  AmendPurchaseInput,
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
 * Generates collision-proof sequential purchase number (PO-YYYYMM-XXXX)
 */
export async function generatePurchaseNumber(): Promise<string> {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
  const prefix = `PO-${yearMonth}-`;

  const lastPurchase = await Purchase.findOne(
    { purchaseNumber: { $regex: `^${prefix}` } },
    { purchaseNumber: 1 }
  ).sort({ purchaseNumber: -1 });

  let seq = 1;
  if (lastPurchase && lastPurchase.purchaseNumber) {
    const parts = lastPurchase.purchaseNumber.split("-");
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(4, "0")}`;
}

/**
 * Formats a raw document to the IPurchase interface
 */
function toPurchaseDto(doc: any): IPurchase {
  return {
    id: doc._id.toString(),
    purchaseNumber: doc.purchaseNumber,
    supplierId: doc.supplierId ? doc.supplierId.toString() : "",
    supplierSnapshot: doc.supplierSnapshot,
    supplierInvoiceNumber: doc.supplierInvoiceNumber,
    supplierInvoiceDate: doc.supplierInvoiceDate ? doc.supplierInvoiceDate.toISOString() : "",
    purchaseDate: doc.purchaseDate ? doc.purchaseDate.toISOString() : "",
    items: (doc.items || []).map((item: any) => ({
      id: item._id ? item._id.toString() : undefined,
      productId: item.productId ? item.productId.toString() : "",
      productSnapshot: item.productSnapshot,
      orderedQty: item.orderedQty,
      receivedQty: item.receivedQty || 0,
      unit: item.unit,
      unitPurchasePrice: item.unitPurchasePrice,
      discountAmount: item.discountAmount || 0,
      taxRate: item.taxRate || 0,
      taxAmount: item.taxAmount || 0,
      lineTotal: item.lineTotal,
    })),
    subtotal: doc.subtotal,
    discountAmount: doc.discountAmount || 0,
    taxAmount: doc.taxAmount || 0,
    grandTotal: doc.grandTotal,
    receivedQty: doc.receivedQty || 0,
    recognizedInvoiceValue: doc.recognizedInvoiceValue || 0,
    amountPaid: doc.amountPaid || 0,
    paymentStatus: doc.paymentStatus || "UNPAID",
    status: doc.status || "DRAFT",
    amendments: (doc.amendments || []).map((a: any) => ({
      amendmentNumber: a.amendmentNumber,
      amendedAt: a.amendedAt ? a.amendedAt.toISOString() : "",
      amendedById: a.amendedById ? a.amendedById.toString() : "",
      amendedByName: a.amendedByName,
      reason: a.reason,
      previousItems: a.previousItems || [],
      revisedItems: a.revisedItems || [],
      previousGrandTotal: a.previousGrandTotal,
      revisedGrandTotal: a.revisedGrandTotal,
    })),
    notes: doc.notes,
    createdById: doc.createdById ? doc.createdById.toString() : undefined,
    updatedById: doc.updatedById ? doc.updatedById.toString() : undefined,
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : "",
    updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : "",
  };
}

/**
 * Lists purchase orders with search, supplier, status, date filtering and pagination
 */
export async function listPurchases(params: PurchaseFilterParams = {}): Promise<{
  purchases: IPurchase[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  summary: {
    totalOrders: number;
    totalAmount: number;
    pendingReceiptCount: number;
    completedCount: number;
  };
}> {
  await connectDB();

  const {
    search,
    supplierId,
    status,
    paymentStatus,
    startDate,
    endDate,
    page = 1,
    limit = 20,
    sortBy = "purchaseDate",
    sortOrder = "desc",
  } = params;

  const query: Record<string, any> = {};

  if (supplierId && mongoose.Types.ObjectId.isValid(supplierId)) {
    query.supplierId = new mongoose.Types.ObjectId(supplierId);
  }

  if (status) {
    query.status = status;
  }

  if (paymentStatus) {
    query.paymentStatus = paymentStatus;
  }

  if (startDate || endDate) {
    query.purchaseDate = {};
    if (startDate) query.purchaseDate.$gte = new Date(startDate);
    if (endDate) query.purchaseDate.$lte = new Date(endDate);
  }

  if (search && search.trim() !== "") {
    const term = search.trim();
    query.$or = [
      { purchaseNumber: { $regex: term, $options: "i" } },
      { supplierInvoiceNumber: { $regex: term, $options: "i" } },
      { "supplierSnapshot.name": { $regex: term, $options: "i" } },
      { "supplierSnapshot.phone": { $regex: term, $options: "i" } },
    ];
  }

  const sortDirection = sortOrder === "asc" ? 1 : -1;
  const sortOption: Record<string, 1 | -1> = { [sortBy]: sortDirection };
  const skip = (Math.max(1, page) - 1) * limit;

  const [docs, total, stats] = await Promise.all([
    Purchase.find(query).sort(sortOption).skip(skip).limit(limit).lean(),
    Purchase.countDocuments(query),
    Purchase.aggregate([
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalAmount: {
            $sum: { $cond: [{ $ne: ["$status", "CANCELLED"] }, "$grandTotal", 0] },
          },
          pendingReceiptCount: {
            $sum: {
              $cond: [
                { $in: ["$status", ["PENDING_RECEIPT", "PARTIALLY_RECEIVED"]] },
                1,
                0,
              ],
            },
          },
          completedCount: {
            $sum: { $cond: [{ $eq: ["$status", "RECEIVED"] }, 1, 0] },
          },
        },
      },
    ]),
  ]);

  const summary = stats[0] || {
    totalOrders: 0,
    totalAmount: 0,
    pendingReceiptCount: 0,
    completedCount: 0,
  };

  return {
    purchases: docs.map(toPurchaseDto),
    pagination: {
      total,
      page: Math.max(1, page),
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
    summary: {
      totalOrders: summary.totalOrders,
      totalAmount: round2(summary.totalAmount),
      pendingReceiptCount: summary.pendingReceiptCount,
      completedCount: summary.completedCount,
    },
  };
}

/**
 * Gets a single purchase by ID
 */
export async function getPurchaseById(id: string): Promise<IPurchase> {
  await connectDB();

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid purchase ID");
  }

  const doc = await Purchase.findById(id).lean();
  if (!doc) {
    throw new Error("Purchase order not found");
  }

  return toPurchaseDto(doc);
}

/**
 * Creates a new purchase order
 */
export async function createPurchase(
  input: CreatePurchaseInput,
  actor: ActorContext
): Promise<IPurchase> {
  await connectDB();

  // 1. Verify supplier exists and is active
  const supplier = await Supplier.findById(input.supplierId);
  if (!supplier) {
    throw new Error("Selected supplier does not exist");
  }
  if (supplier.status !== "ACTIVE") {
    throw new Error(`Supplier '${supplier.name}' is currently ${supplier.status}. Only ACTIVE suppliers can receive new purchase orders.`);
  }

  // 2. Prevent duplicate invoice number for the same supplier
  const duplicateInvoice = await Purchase.findOne({
    supplierId: supplier._id,
    supplierInvoiceNumber: input.supplierInvoiceNumber.trim(),
    status: { $ne: "CANCELLED" },
  });
  if (duplicateInvoice) {
    throw new Error(
      `An active purchase order (${duplicateInvoice.purchaseNumber}) with invoice number '${input.supplierInvoiceNumber}' already exists for ${supplier.name}`
    );
  }

  // 3. Build supplier snapshot
  const supplierSnapshot: PurchaseSupplierSnapshot = {
    name: supplier.name,
    contactPerson: supplier.contactPerson,
    phone: supplier.phone,
    email: supplier.email,
    gstin: supplier.gstin,
    address: supplier.address
      ? {
          street: supplier.address.street,
          city: supplier.address.city,
          state: supplier.address.state,
          pincode: supplier.address.pincode,
        }
      : undefined,
  };

  // 4. Validate and build line items with product snapshots
  const items: any[] = [];
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let grandTotal = 0;

  for (const itemInput of input.items) {
    const product = await Product.findById(itemInput.productId);
    if (!product) {
      throw new Error(`Product ID '${itemInput.productId}' not found`);
    }

    // Capture product snapshot (supports products with or without SKU)
    const productSnapshot: PurchaseProductSnapshot = {
      name: product.name,
      sku: product.sku || undefined,
      brand: product.brand,
      primaryUnit: product.primaryUnit,
      barcode: product.barcode || undefined,
    };

    const calc = calculateItemLineValues(
      itemInput.orderedQty,
      itemInput.unitPurchasePrice,
      itemInput.discountAmount || 0,
      itemInput.taxRate || 0
    );

    items.push({
      productId: product._id,
      productSnapshot,
      orderedQty: itemInput.orderedQty,
      receivedQty: 0,
      unit: product.primaryUnit, // strictly use product's primary unit
      unitPurchasePrice: round2(itemInput.unitPurchasePrice),
      discountAmount: calc.discount,
      taxRate: round2(itemInput.taxRate || 0),
      taxAmount: calc.tax,
      lineTotal: calc.lineTotal,
    });

    subtotal = round2(subtotal + calc.taxable);
    totalDiscount = round2(totalDiscount + calc.discount);
    totalTax = round2(totalTax + calc.tax);
    grandTotal = round2(grandTotal + calc.lineTotal);
  }

  const purchaseNumber = await generatePurchaseNumber();

  const doc = await Purchase.create({
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
    amountPaid: 0,
    paymentStatus: "UNPAID",
    status: input.status || "DRAFT",
    amendments: [],
    notes: input.notes?.trim() || undefined,
    createdById: new mongoose.Types.ObjectId(actor.id),
  });

  await logAuditEvent({
    action: "PURCHASE_CREATED" as any,
    userId: actor.id,
    userName: actor.name,
    ipAddress: actor.ip,
    details: {
      purchaseId: doc._id.toString(),
      purchaseNumber: doc.purchaseNumber,
      supplierName: supplier.name,
      grandTotal: doc.grandTotal,
      status: doc.status,
    },
  });

  return getPurchaseById(doc._id.toString());
}

/**
 * Updates an existing draft purchase order or confirms it to PENDING_RECEIPT
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
    // If attempting to cancel an unreceived purchase
    if (input.status === "CANCELLED") {
      return cancelPurchase(id, "Cancelled via update", actor);
    }
    throw new Error(`Only DRAFT purchase orders can be modified. This purchase is currently '${purchase.status}'. Use Amendment for confirmed orders.`);
  }

  // Update supplier if changed
  if (input.supplierId && input.supplierId !== purchase.supplierId.toString()) {
    const supplier = await Supplier.findById(input.supplierId);
    if (!supplier) throw new Error("Selected supplier does not exist");
    if (supplier.status !== "ACTIVE") throw new Error("Supplier is inactive");

    purchase.supplierId = supplier._id;
    purchase.supplierSnapshot = {
      name: supplier.name,
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      email: supplier.email,
      gstin: supplier.gstin,
      address: supplier.address
        ? {
            street: supplier.address.street,
            city: supplier.address.city,
            state: supplier.address.state,
            pincode: supplier.address.pincode,
          }
        : undefined,
    };
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

  // Re-calculate line items if updated
  if (input.items && input.items.length > 0) {
    const items: any[] = [];
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let grandTotal = 0;

    for (const itemInput of input.items) {
      const product = await Product.findById(itemInput.productId);
      if (!product) throw new Error(`Product '${itemInput.productId}' not found`);

      const calc = calculateItemLineValues(
        itemInput.orderedQty,
        itemInput.unitPurchasePrice,
        itemInput.discountAmount || 0,
        itemInput.taxRate || 0
      );

      items.push({
        productId: product._id,
        productSnapshot: {
          name: product.name,
          sku: product.sku || undefined,
          brand: product.brand,
          primaryUnit: product.primaryUnit,
          barcode: product.barcode || undefined,
        },
        orderedQty: itemInput.orderedQty,
        receivedQty: 0,
        unit: product.primaryUnit,
        unitPurchasePrice: round2(itemInput.unitPurchasePrice),
        discountAmount: calc.discount,
        taxRate: round2(itemInput.taxRate || 0),
        taxAmount: calc.tax,
        lineTotal: calc.lineTotal,
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
 * Cancels an unreceived purchase order
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

  // Strictly block cancellation if goods have been received
  if (purchase.receivedQty > 0 || purchase.status === "PARTIALLY_RECEIVED" || purchase.status === "RECEIVED") {
    throw new Error(
      `Cannot cancel purchase '${purchase.purchaseNumber}' because ${purchase.receivedQty} items have already been received via confirmed GRNs.`
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
 * Submits a controlled purchase amendment with quantity floor check
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

  if (purchase.status === "CANCELLED" || purchase.status === "DRAFT") {
    throw new Error(`Cannot amend a ${purchase.status} purchase order. Use standard edit for Drafts.`);
  }

  const previousItems = JSON.parse(JSON.stringify(purchase.items));
  const previousGrandTotal = purchase.grandTotal;

  // Build a map of existing received quantities per product
  const receivedMap = new Map<string, number>();
  for (const item of purchase.items) {
    receivedMap.set(item.productId.toString(), item.receivedQty || 0);
  }

  // Validate floor rule: revised ordered quantity cannot fall below received quantity
  const revisedItems: any[] = [];
  let subtotal = 0;
  let totalDiscount = 0;
  let totalTax = 0;
  let grandTotal = 0;
  let totalReceived = 0;
  let allFullyReceived = true;

  for (const revisedItem of input.items) {
    const receivedSoFar = receivedMap.get(revisedItem.productId) || 0;
    if (revisedItem.orderedQty < receivedSoFar) {
      const prod = await Product.findById(revisedItem.productId);
      const prodName = prod ? prod.name : revisedItem.productId;
      throw new Error(
        `Cannot reduce ordered quantity for '${prodName}' to ${revisedItem.orderedQty} because ${receivedSoFar} items have already been received.`
      );
    }

    const product = await Product.findById(revisedItem.productId);
    if (!product) throw new Error(`Product '${revisedItem.productId}' not found`);

    const calc = calculateItemLineValues(
      revisedItem.orderedQty,
      revisedItem.unitPurchasePrice,
      revisedItem.discountAmount || 0,
      revisedItem.taxRate || 0
    );

    revisedItems.push({
      productId: product._id,
      productSnapshot: {
        name: product.name,
        sku: product.sku || undefined,
        brand: product.brand,
        primaryUnit: product.primaryUnit,
        barcode: product.barcode || undefined,
      },
      orderedQty: revisedItem.orderedQty,
      receivedQty: receivedSoFar,
      unit: product.primaryUnit,
      unitPurchasePrice: round2(revisedItem.unitPurchasePrice),
      discountAmount: calc.discount,
      taxRate: round2(revisedItem.taxRate || 0),
      taxAmount: calc.tax,
      lineTotal: calc.lineTotal,
    });

    subtotal = round2(subtotal + calc.taxable);
    totalDiscount = round2(totalDiscount + calc.discount);
    totalTax = round2(totalTax + calc.tax);
    grandTotal = round2(grandTotal + calc.lineTotal);
    totalReceived += receivedSoFar;

    if (receivedSoFar < revisedItem.orderedQty) {
      allFullyReceived = false;
    }
  }

  const amendmentNumber = (purchase.amendments?.length || 0) + 1;

  purchase.amendments.push({
    amendmentNumber,
    amendedAt: new Date().toISOString() as any,
    amendedById: new mongoose.Types.ObjectId(actor.id) as any,
    amendedByName: actor.name,
    reason: input.reason.trim(),
    previousItems,
    revisedItems,
    previousGrandTotal,
    revisedGrandTotal: grandTotal,
  });

  purchase.items = revisedItems as any;
  purchase.subtotal = subtotal;
  purchase.discountAmount = totalDiscount;
  purchase.taxAmount = totalTax;
  purchase.grandTotal = grandTotal;
  purchase.receivedQty = totalReceived;
  purchase.updatedById = new mongoose.Types.ObjectId(actor.id);

  // Re-evaluate status
  if (totalReceived === 0) {
    purchase.status = "PENDING_RECEIPT";
  } else if (allFullyReceived) {
    purchase.status = "RECEIVED";
  } else {
    purchase.status = "PARTIALLY_RECEIVED";
  }

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
      reason: input.reason,
      previousGrandTotal,
      revisedGrandTotal: grandTotal,
      status: purchase.status,
    },
  });

  return getPurchaseById(purchase._id.toString());
}
