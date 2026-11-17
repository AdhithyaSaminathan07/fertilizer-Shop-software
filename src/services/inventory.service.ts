import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Product, IProductDocument } from "@/models/product";
import { Batch, IBatchDocument } from "@/models/batch";
import { Category } from "@/models/category";
import { Purchase } from "@/models/purchase";
import { Sale } from "@/models/sale";
import { StockAdjustment, IStockAdjustmentDocument } from "@/models/stock-adjustment";
import { StockCountSession, IStockCountSessionDocument } from "@/models/stock-count-session";
import { logAuditEvent } from "@/lib/auth";
import { round2 } from "@/services/purchase.service";
import type {
  IStockAdjustment,
  IStockAdjustmentInput,
  IStockCountSession,
  IStockCountCreateInput,
  IStockCountUpdateInput,
  ILowStockItem,
  IExpiryBatchItem,
  IInventoryValuation,
  IStockMovement,
  IInventoryOverview,
  ExpiryBucket,
} from "@/types/inventory";

export interface ActorContext {
  id: string;
  name: string;
  ip?: string;
}

/**
 * Sequential Adjustment Number Generator: ADJ-YYYYMM-XXXX
 */
export async function generateAdjustmentNumber(
  session?: mongoose.ClientSession
): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `ADJ-${year}${month}-`;

  const lastAdjustment = await StockAdjustment.findOne({
    adjustmentNumber: { $regex: `^${prefix}` },
  })
    .sort({ adjustmentNumber: -1 })
    .session(session || null);

  let sequence = 1;
  if (lastAdjustment && lastAdjustment.adjustmentNumber) {
    const parts = lastAdjustment.adjustmentNumber.split("-");
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) {
      sequence = lastSeq + 1;
    }
  }

  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

/**
 * Sequential Stock Count Session Number Generator: STC-YYYYMM-XXXX
 */
export async function generateSessionNumber(
  session?: mongoose.ClientSession
): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `STC-${year}${month}-`;

  const lastSession = await StockCountSession.findOne({
    sessionNumber: { $regex: `^${prefix}` },
  })
    .sort({ sessionNumber: -1 })
    .session(session || null);

  let sequence = 1;
  if (lastSession && lastSession.sessionNumber) {
    const parts = lastSession.sessionNumber.split("-");
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) {
      sequence = lastSeq + 1;
    }
  }

  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

/**
 * Helper to classify batch expiry into buckets
 */
export function getExpiryBucket(expiryDate: Date): {
  bucket: ExpiryBucket;
  daysRemaining: number;
} {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const expTime = new Date(
    expiryDate.getFullYear(),
    expiryDate.getMonth(),
    expiryDate.getDate()
  ).getTime();

  const diffMs = expTime - startOfToday;
  const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (daysRemaining < 0) {
    return { bucket: "EXPIRED", daysRemaining };
  } else if (daysRemaining <= 7) {
    return { bucket: "EXPIRING_7D", daysRemaining };
  } else if (daysRemaining <= 30) {
    return { bucket: "EXPIRING_30D", daysRemaining };
  } else if (daysRemaining <= 60) {
    return { bucket: "EXPIRING_60D", daysRemaining };
  } else {
    return { bucket: "EXPIRING_LATER", daysRemaining };
  }
}

/**
 * 1. Overview Dashboard Metrics
 */
export async function getInventoryOverview(): Promise<IInventoryOverview> {
  await connectDB();

  const activeProducts = await Product.find({ isActive: true });
  const totalActiveProducts = activeProducts.length;

  let totalStockQuantity = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  activeProducts.forEach((p) => {
    const stock = round2(p.currentStock || 0);
    totalStockQuantity = round2(totalStockQuantity + stock);

    if (stock <= 0) {
      outOfStockCount++;
    } else if (stock <= (p.minStockThreshold || 0)) {
      lowStockCount++;
    }
  });

  // Calculate valuation using batches and product purchasePrice
  const allBatches = await Batch.find({
    status: "ACTIVE",
    quantity: { $gt: 0 },
  });

  let totalInventoryValuation = 0;
  const productBatchQtyMap = new Map<string, number>();

  allBatches.forEach((b) => {
    const qty = round2(b.quantity);
    const price = round2(b.purchasePrice || 0);
    totalInventoryValuation = round2(totalInventoryValuation + qty * price);

    const pId = b.productId.toString();
    productBatchQtyMap.set(pId, round2((productBatchQtyMap.get(pId) || 0) + qty));
  });

  // For products where stock is not fully represented by active batches, use product.purchasePrice
  activeProducts.forEach((p) => {
    const pId = p._id.toString();
    const batchQty = productBatchQtyMap.get(pId) || 0;
    const residualStock = round2(Math.max(0, (p.currentStock || 0) - batchQty));
    if (residualStock > 0 && p.purchasePrice) {
      totalInventoryValuation = round2(
        totalInventoryValuation + residualStock * round2(p.purchasePrice)
      );
    }
  });

  // Expiry counts
  const now = new Date();
  let nearExpiryBatchesCount = 0;
  let expiredBatchesCount = 0;

  allBatches.forEach((b) => {
    if (b.expiryDate) {
      const { bucket } = getExpiryBucket(new Date(b.expiryDate));
      if (bucket === "EXPIRED") {
        expiredBatchesCount++;
      } else if (bucket === "EXPIRING_7D" || bucket === "EXPIRING_30D") {
        nearExpiryBatchesCount++;
      }
    }
  });

  // Recently received purchases (confirmed inwards)
  const recentPurchases: any[] = await Purchase.find({
    status: { $in: ["RECEIVED", "PARTIALLY_RECEIVED"] },
  })
    .sort({ updatedAt: -1 })
    .limit(5)
    .lean();

  const recentlyReceivedStock = recentPurchases.map((pur: any) => {
    let totalQty = 0;
    (pur.items || []).forEach((it: any) => {
      totalQty = round2(totalQty + (it.receivedQty || it.orderedQty || 0));
    });

    return {
      purchaseNumber: pur.purchaseNumber,
      supplierName: pur.supplierSnapshot?.name || "Unknown",
      inwardDate: pur.purchaseDate
        ? new Date(pur.purchaseDate).toISOString()
        : new Date(pur.createdAt).toISOString(),
      itemCount: pur.items?.length || 0,
      totalQuantity: totalQty,
    };
  });

  // Unified recent movements (last 10)
  const recentMovementsData = await getStockMovements({ limit: 10 });

  return {
    totalActiveProducts,
    totalStockQuantity,
    totalInventoryValuation,
    lowStockCount,
    outOfStockCount,
    nearExpiryBatchesCount,
    expiredBatchesCount,
    recentlyReceivedStock,
    recentMovements: recentMovementsData.movements,
  };
}

/**
 * 2. Low Stock & Reorder Intelligence Report
 */
export async function getLowStockReport(params: {
  categoryId?: string;
  search?: string;
  stockStatus?: "ALL" | "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
}): Promise<ILowStockItem[]> {
  await connectDB();

  const query: any = { isActive: true };
  if (params.categoryId) {
    query.categoryId = params.categoryId;
  }
  if (params.search && params.search.trim()) {
    const s = params.search.trim();
    query.$or = [
      { name: { $regex: s, $options: "i" } },
      { sku: { $regex: s, $options: "i" } },
      { brand: { $regex: s, $options: "i" } },
    ];
  }

  const products = await Product.find(query).populate("categoryId", "name").lean();

  const items: ILowStockItem[] = [];

  products.forEach((p: any) => {
    const stock = round2(p.currentStock || 0);
    const minThreshold = round2(p.minStockThreshold || 0);
    const prefReorder = p.preferredReorderQty ? round2(p.preferredReorderQty) : undefined;

    let status: "OUT_OF_STOCK" | "LOW_STOCK" | "ADEQUATE" = "ADEQUATE";
    if (stock <= 0) {
      status = "OUT_OF_STOCK";
    } else if (stock <= minThreshold) {
      status = "LOW_STOCK";
    }

    if (params.stockStatus === "OUT_OF_STOCK" && status !== "OUT_OF_STOCK") return;
    if (params.stockStatus === "LOW_STOCK" && status !== "LOW_STOCK") return;
    if (params.stockStatus === "IN_STOCK" && status === "OUT_OF_STOCK") return;
    if (!params.stockStatus || params.stockStatus === "ALL") {
      // By default show low-stock and out-of-stock items first
      // But if user specifically searched without filter, include all matching status
    }

    // Suggested reorder quantity calculation
    let suggestedReorderQty = 0;
    if (status !== "ADEQUATE") {
      if (prefReorder && prefReorder > 0) {
        suggestedReorderQty = prefReorder;
      } else {
        suggestedReorderQty = round2(Math.max(1, minThreshold * 2 - stock));
      }
    }

    items.push({
      productId: p._id.toString(),
      name: p.name,
      sku: p.sku,
      brand: p.brand || "",
      categoryName: p.categoryId?.name || "General",
      primaryUnit: p.primaryUnit || "PCS",
      currentStock: stock,
      minStockThreshold: minThreshold,
      preferredReorderQty: prefReorder,
      stockStatus: status,
      suggestedReorderQty,
    });
  });

  // Sort: OUT_OF_STOCK first, then LOW_STOCK, then ADEQUATE
  items.sort((a, b) => {
    const priority = { OUT_OF_STOCK: 0, LOW_STOCK: 1, ADEQUATE: 2 };
    if (priority[a.stockStatus] !== priority[b.stockStatus]) {
      return priority[a.stockStatus] - priority[b.stockStatus];
    }
    return a.name.localeCompare(b.name);
  });

  return items;
}

/**
 * Update Reorder Settings for a Product
 */
export async function updateProductReorderLevels(
  productId: string,
  minStockThreshold: number,
  preferredReorderQty?: number,
  actor?: ActorContext
): Promise<IProductDocument> {
  await connectDB();

  const product = await Product.findById(productId);
  if (!product) {
    throw new Error("Product not found");
  }

  const previousThreshold = product.minStockThreshold;
  const previousReorderQty = product.preferredReorderQty;

  product.minStockThreshold = Math.max(0, round2(minStockThreshold));
  if (preferredReorderQty !== undefined) {
    product.preferredReorderQty = Math.max(0, round2(preferredReorderQty));
  }
  await product.save();

  if (actor) {
    await logAuditEvent({
      userId: actor.id,
      userName: actor.name,
      action: "REORDER_SETTINGS_UPDATED",
      details: {
        resourceType: "PRODUCT",
        resourceId: product._id.toString(),
        productName: product.name,
        sku: product.sku,
        previousThreshold,
        newThreshold: product.minStockThreshold,
        previousReorderQty,
        newReorderQty: product.preferredReorderQty,
      },
      ipAddress: actor.ip,
    });
  }

  return product;
}

/**
 * 3. Expiry Monitoring Report
 */
export async function getExpiryReport(params: {
  categoryId?: string;
  search?: string;
  expiryBucket?: ExpiryBucket | "ALL";
}): Promise<IExpiryBatchItem[]> {
  await connectDB();

  const batchQuery: any = {
    status: { $in: ["ACTIVE", "EXPIRED"] },
    quantity: { $gt: 0 },
    expiryDate: { $exists: true, $ne: null },
  };

  const batches = await Batch.find(batchQuery)
    .populate({
      path: "productId",
      populate: { path: "categoryId", select: "name" },
    })
    .lean();

  const items: IExpiryBatchItem[] = [];

  batches.forEach((b: any) => {
    const prod = b.productId;
    if (!prod) return;

    if (params.categoryId && prod.categoryId?._id?.toString() !== params.categoryId) {
      return;
    }

    if (params.search && params.search.trim()) {
      const s = params.search.trim().toLowerCase();
      const match =
        prod.name.toLowerCase().includes(s) ||
        prod.sku.toLowerCase().includes(s) ||
        (prod.brand && prod.brand.toLowerCase().includes(s)) ||
        b.batchNumber.toLowerCase().includes(s);
      if (!match) return;
    }

    const { bucket, daysRemaining } = getExpiryBucket(new Date(b.expiryDate));

    if (params.expiryBucket && params.expiryBucket !== "ALL" && bucket !== params.expiryBucket) {
      return;
    }

    const qty = round2(b.quantity);
    const unitCost = round2(b.purchasePrice || prod.purchasePrice || 0);
    const totalValuation = round2(qty * unitCost);

    items.push({
      batchId: b._id.toString(),
      batchNumber: b.batchNumber,
      productId: prod._id.toString(),
      productName: prod.name,
      sku: prod.sku,
      brand: prod.brand || "",
      categoryName: prod.categoryId?.name || "General",
      primaryUnit: prod.primaryUnit || "PCS",
      quantity: qty,
      unitCost,
      totalValuation,
      manufacturingDate: b.manufacturingDate ? new Date(b.manufacturingDate).toISOString() : undefined,
      expiryDate: new Date(b.expiryDate).toISOString(),
      expiryBucket: bucket,
      daysRemaining,
    });
  });

  // Sort by expiryDate ascending (most urgent first)
  items.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

  return items;
}

/**
 * Batches for a Product (with expiry information for FEFO)
 */
export async function getBatchesWithExpiry(productId?: string): Promise<IBatchDocument[]> {
  await connectDB();
  const query: any = { quantity: { $gt: 0 } };
  if (productId) {
    query.productId = productId;
  }
  return Batch.find(query).sort({ expiryDate: 1, createdAt: 1 });
}

/**
 * 4. Stock Adjustment & Write-Offs
 */
export async function createStockAdjustment(
  input: IStockAdjustmentInput,
  actor: ActorContext
): Promise<IStockAdjustment> {
  await connectDB();

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const product = await Product.findById(input.productId).session(session);
    if (!product) {
      throw new Error("Product not found");
    }

    let batch: IBatchDocument | null = null;
    if (input.batchId) {
      batch = await Batch.findById(input.batchId).session(session);
      if (!batch) {
        throw new Error("Batch not found");
      }
      if (batch.productId.toString() !== product._id.toString()) {
        throw new Error("Batch does not belong to the selected product");
      }
    }

    const currentProductStock = round2(product.currentStock || 0);
    const previousQuantity = batch ? round2(batch.quantity) : currentProductStock;
    const adjQty = round2(input.adjustmentQuantity);

    if (adjQty <= 0) {
      throw new Error("Adjustment quantity must be greater than 0");
    }

    // Negative stock guard
    if (input.type === "DECREASE") {
      if (previousQuantity < adjQty) {
        throw new Error(
          `Insufficient stock to decrease. Available: ${previousQuantity}, Requested reduction: ${adjQty}`
        );
      }
      if (currentProductStock < adjQty) {
        throw new Error(
          `Product current stock (${currentProductStock}) is less than reduction quantity (${adjQty})`
        );
      }
    }

    let newQuantity = 0;
    if (input.type === "INCREASE") {
      newQuantity = round2(previousQuantity + adjQty);
      product.currentStock = round2(currentProductStock + adjQty);
      if (batch) {
        batch.quantity = newQuantity;
        if (batch.status === "DEPLETED") {
          batch.status = "ACTIVE";
        }
        await batch.save({ session });
      }
    } else {
      newQuantity = round2(previousQuantity - adjQty);
      product.currentStock = round2(currentProductStock - adjQty);
      if (batch) {
        batch.quantity = newQuantity;
        if (batch.quantity <= 0.0001) {
          batch.quantity = 0;
          batch.status = "DEPLETED";
        }
        await batch.save({ session });
      }
    }

    await product.save({ session });

    const adjustmentNumber = await generateAdjustmentNumber(session);

    const adjustmentDocs = await StockAdjustment.create(
      [
        {
          adjustmentNumber,
          date: new Date(),
          productId: product._id,
          productSnapshot: {
            name: product.name,
            sku: product.sku,
            primaryUnit: product.primaryUnit || "PCS",
          },
          batchId: batch ? batch._id : undefined,
          batchNumber: batch ? batch.batchNumber : undefined,
          type: input.type,
          previousQuantity,
          adjustmentQuantity: adjQty,
          newQuantity,
          reason: input.reason,
          explanation: input.explanation.trim(),
          createdById: new mongoose.Types.ObjectId(actor.id),
          createdByName: actor.name,
        },
      ],
      { session }
    );

    const adjustment = adjustmentDocs[0];

    await logAuditEvent({
      userId: actor.id,
      userName: actor.name,
      action: "STOCK_ADJUSTMENT_CREATED",
      details: {
        resourceType: "PRODUCT",
        resourceId: product._id.toString(),
        adjustmentNumber,
        productName: product.name,
        sku: product.sku,
        batchNumber: batch?.batchNumber,
        type: input.type,
        adjustmentQuantity: adjQty,
        reason: input.reason,
        explanation: input.explanation,
        resultingStock: product.currentStock,
      },
      ipAddress: actor.ip,
    });

    await session.commitTransaction();
    return adjustment.toJSON() as unknown as IStockAdjustment;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Get adjustments list with pagination
 */
export async function getStockAdjustments(params: {
  productId?: string;
  reason?: string;
  type?: string;
  page?: number;
  limit?: number;
}): Promise<{ adjustments: IStockAdjustment[]; total: number; pages: number }> {
  await connectDB();

  const query: any = {};
  if (params.productId) query.productId = params.productId;
  if (params.reason) query.reason = params.reason;
  if (params.type) query.type = params.type;

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const [docs, total] = await Promise.all([
    StockAdjustment.find(query).sort({ date: -1, createdAt: -1 }).skip(skip).limit(limit),
    StockAdjustment.countDocuments(query),
  ]);

  return {
    adjustments: docs.map((d) => d.toJSON() as unknown as IStockAdjustment),
    total,
    pages: Math.ceil(total / limit) || 1,
  };
}

/**
 * 5. Physical Stock Count Reconciliation Sessions
 */
export async function createStockCountSession(
  input: IStockCountCreateInput,
  actor: ActorContext
): Promise<IStockCountSession> {
  await connectDB();

  const prodQuery: any = { isActive: true };
  if (input.categoryIds && input.categoryIds.length > 0) {
    prodQuery.categoryId = { $in: input.categoryIds };
  }

  const products = await Product.find(prodQuery)
    .populate("categoryId", "name")
    .sort({ name: 1 })
    .lean();

  const items = products.map((p: any) => {
    const systemStock = round2(p.currentStock || 0);
    return {
      productId: p._id,
      productName: p.name,
      sku: p.sku,
      categoryName: p.categoryId?.name || "General",
      unit: p.primaryUnit || "PCS",
      systemStockAtStart: systemStock,
      countedStock: systemStock,
      variance: 0,
      notes: "",
    };
  });

  const sessionNumber = await generateSessionNumber();

  const sessionDoc = await StockCountSession.create({
    sessionNumber,
    title: input.title.trim(),
    status: "DRAFT",
    notes: input.notes?.trim(),
    categoryIds: input.categoryIds?.map((c) => new mongoose.Types.ObjectId(c)),
    items,
    createdById: new mongoose.Types.ObjectId(actor.id),
    createdByName: actor.name,
  });

  await logAuditEvent({
    userId: actor.id,
    userName: actor.name,
    action: "STOCK_COUNT_SESSION_CREATED",
    details: {
      resourceType: "PRODUCT",
      resourceId: sessionDoc._id.toString(),
      sessionNumber,
      title: sessionDoc.title,
      itemCount: items.length,
    },
    ipAddress: actor.ip,
  });

  return sessionDoc.toJSON() as unknown as IStockCountSession;
}

export async function updateStockCountSession(
  id: string,
  input: IStockCountUpdateInput,
  actor: ActorContext
): Promise<IStockCountSession> {
  await connectDB();

  const sessionDoc = await StockCountSession.findById(id);
  if (!sessionDoc) {
    throw new Error("Stock count session not found");
  }

  if (sessionDoc.status !== "DRAFT") {
    throw new Error(`Cannot update session with status '${sessionDoc.status}'`);
  }

  if (input.title) sessionDoc.title = input.title.trim();
  if (input.notes !== undefined) sessionDoc.notes = input.notes.trim();

  if (input.items && input.items.length > 0) {
    const inputMap = new Map<string, { countedStock: number; notes?: string }>();
    input.items.forEach((item) => {
      inputMap.set(item.productId, {
        countedStock: round2(item.countedStock),
        notes: item.notes?.trim(),
      });
    });

    sessionDoc.items.forEach((item) => {
      const pId = item.productId.toString();
      if (inputMap.has(pId)) {
        const update = inputMap.get(pId)!;
        item.countedStock = update.countedStock;
        item.variance = round2(update.countedStock - item.systemStockAtStart);
        if (update.notes !== undefined) item.notes = update.notes;
      }
    });
  }

  await sessionDoc.save();
  return sessionDoc.toJSON() as unknown as IStockCountSession;
}

export async function submitStockCountSession(
  id: string,
  actor: ActorContext
): Promise<IStockCountSession> {
  await connectDB();

  const sessionDoc = await StockCountSession.findById(id);
  if (!sessionDoc) {
    throw new Error("Stock count session not found");
  }

  if (sessionDoc.status !== "DRAFT") {
    throw new Error(`Only DRAFT sessions can be submitted (current: '${sessionDoc.status}')`);
  }

  sessionDoc.status = "SUBMITTED";
  sessionDoc.submittedAt = new Date();
  await sessionDoc.save();

  await logAuditEvent({
    userId: actor.id,
    userName: actor.name,
    action: "STOCK_COUNT_SESSION_SUBMITTED",
    details: {
      resourceType: "PRODUCT",
      resourceId: sessionDoc._id.toString(),
      sessionNumber: sessionDoc.sessionNumber,
      title: sessionDoc.title,
    },
    ipAddress: actor.ip,
  });

  return sessionDoc.toJSON() as unknown as IStockCountSession;
}

export async function approveStockCountSession(
  id: string,
  approvalNotes: string | undefined,
  actor: ActorContext
): Promise<IStockCountSession> {
  await connectDB();

  const sessionDoc = await StockCountSession.findById(id);
  if (!sessionDoc) {
    throw new Error("Stock count session not found");
  }

  if (sessionDoc.status !== "SUBMITTED") {
    throw new Error(`Only SUBMITTED sessions can be approved (current: '${sessionDoc.status}')`);
  }

  // Stale movement detection: check if product currentStock has changed since session started
  const productIds = sessionDoc.items.map((i) => i.productId);
  const currentProducts = await Product.find({ _id: { $in: productIds } });
  const currentProductMap = new Map<string, IProductDocument>();
  currentProducts.forEach((p) => currentProductMap.set(p._id.toString(), p));

  for (const item of sessionDoc.items) {
    if (item.variance !== 0) {
      const prod = currentProductMap.get(item.productId.toString());
      if (prod) {
        const liveStock = round2(prod.currentStock || 0);
        const baselineStock = round2(item.systemStockAtStart);
        if (liveStock !== baselineStock) {
          throw new Error(
            `Stale stock detected for product '${item.productName}'. System stock was ${baselineStock} at session start, but has changed to ${liveStock}. Please review or restart the count session.`
          );
        }
      }
    }
  }

  // Apply reconciliation adjustments atomically
  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    for (const item of sessionDoc.items) {
      const variance = round2(item.variance);
      if (variance === 0) continue;

      const type = variance > 0 ? "INCREASE" : "DECREASE";
      const adjQty = Math.abs(variance);

      // Create stock adjustment
      await createStockAdjustment(
        {
          productId: item.productId.toString(),
          type,
          adjustmentQuantity: adjQty,
          reason: "PHYSICAL_CORRECTION",
          explanation: `Physical Stock Count reconciliation session ${sessionDoc.sessionNumber}`,
        },
        actor
      );
    }

    sessionDoc.status = "APPROVED";
    sessionDoc.approvedAt = new Date();
    sessionDoc.approvedById = new mongoose.Types.ObjectId(actor.id);
    sessionDoc.approvedByName = actor.name;
    sessionDoc.approvalNotes = approvalNotes?.trim();
    await sessionDoc.save({ session: dbSession });

    await logAuditEvent({
      userId: actor.id,
      userName: actor.name,
      action: "STOCK_COUNT_SESSION_APPROVED",
      details: {
        resourceType: "PRODUCT",
        resourceId: sessionDoc._id.toString(),
        sessionNumber: sessionDoc.sessionNumber,
        title: sessionDoc.title,
        adjustedItemsCount: sessionDoc.items.filter((i) => i.variance !== 0).length,
      },
      ipAddress: actor.ip,
    });

    await dbSession.commitTransaction();
    return sessionDoc.toJSON() as unknown as IStockCountSession;
  } catch (error) {
    await dbSession.abortTransaction();
    throw error;
  } finally {
    dbSession.endSession();
  }
}

export async function rejectStockCountSession(
  id: string,
  rejectionNotes: string,
  actor: ActorContext
): Promise<IStockCountSession> {
  await connectDB();

  const sessionDoc = await StockCountSession.findById(id);
  if (!sessionDoc) {
    throw new Error("Stock count session not found");
  }

  if (sessionDoc.status !== "SUBMITTED" && sessionDoc.status !== "DRAFT") {
    throw new Error(`Cannot reject session with status '${sessionDoc.status}'`);
  }

  sessionDoc.status = "REJECTED";
  sessionDoc.approvalNotes = rejectionNotes.trim();
  await sessionDoc.save();

  await logAuditEvent({
    userId: actor.id,
    userName: actor.name,
    action: "STOCK_COUNT_SESSION_SUBMITTED",
    details: {
      resourceType: "PRODUCT",
      resourceId: sessionDoc._id.toString(),
      sessionNumber: sessionDoc.sessionNumber,
      action: "REJECTED",
      notes: rejectionNotes,
    },
    ipAddress: actor.ip,
  });

  return sessionDoc.toJSON() as unknown as IStockCountSession;
}

export async function getStockCountSessions(params: {
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{ sessions: IStockCountSession[]; total: number; pages: number }> {
  await connectDB();

  const query: any = {};
  if (params.status) query.status = params.status;

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const [docs, total] = await Promise.all([
    StockCountSession.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
    StockCountSession.countDocuments(query),
  ]);

  return {
    sessions: docs.map((d) => d.toJSON() as unknown as IStockCountSession),
    total,
    pages: Math.ceil(total / limit) || 1,
  };
}

export async function getStockCountSessionById(id: string): Promise<IStockCountSession> {
  await connectDB();
  const sessionDoc = await StockCountSession.findById(id);
  if (!sessionDoc) {
    throw new Error("Stock count session not found");
  }
  return sessionDoc.toJSON() as unknown as IStockCountSession;
}

/**
 * 6. Inventory Valuation Report
 */
export async function getInventoryValuation(params?: {
  categoryId?: string;
}): Promise<IInventoryValuation> {
  await connectDB();

  const prodQuery: any = { isActive: true };
  if (params?.categoryId) {
    prodQuery.categoryId = params.categoryId;
  }

  const products = await Product.find(prodQuery)
    .populate("categoryId", "name")
    .lean();

  const batches = await Batch.find({
    status: "ACTIVE",
    quantity: { $gt: 0 },
  }).lean();

  // Map batches by product
  const batchesByProduct = new Map<string, any[]>();
  batches.forEach((b) => {
    const pId = b.productId.toString();
    if (!batchesByProduct.has(pId)) batchesByProduct.set(pId, []);
    batchesByProduct.get(pId)!.push(b);
  });

  let totalValuation = 0;
  let totalQuantity = 0;

  const categoryMap = new Map<
    string,
    { categoryId: string; categoryName: string; productCount: number; quantity: number; valuation: number }
  >();

  const byProduct = products.map((prod: any) => {
    const pId = prod._id.toString();
    const currentStock = round2(prod.currentStock || 0);
    const prodBatches = batchesByProduct.get(pId) || [];

    let prodValuation = 0;
    let batchQtySum = 0;

    prodBatches.forEach((b) => {
      const q = round2(b.quantity);
      const cost = round2(b.purchasePrice || prod.purchasePrice || 0);
      prodValuation = round2(prodValuation + q * cost);
      batchQtySum = round2(batchQtySum + q);
    });

    // Residual stock not covered by active batches
    const residual = round2(Math.max(0, currentStock - batchQtySum));
    if (residual > 0) {
      const unitCost = round2(prod.purchasePrice || 0);
      prodValuation = round2(prodValuation + residual * unitCost);
    }

    const averageUnitCost = currentStock > 0 ? round2(prodValuation / currentStock) : round2(prod.purchasePrice || 0);

    totalValuation = round2(totalValuation + prodValuation);
    totalQuantity = round2(totalQuantity + currentStock);

    const catId = prod.categoryId?._id?.toString() || "unknown";
    const catName = prod.categoryId?.name || "General";

    if (!categoryMap.has(catId)) {
      categoryMap.set(catId, {
        categoryId: catId,
        categoryName: catName,
        productCount: 0,
        quantity: 0,
        valuation: 0,
      });
    }

    const catEntry = categoryMap.get(catId)!;
    catEntry.productCount += 1;
    catEntry.quantity = round2(catEntry.quantity + currentStock);
    catEntry.valuation = round2(catEntry.valuation + prodValuation);

    return {
      productId: pId,
      name: prod.name,
      sku: prod.sku,
      categoryName: catName,
      primaryUnit: prod.primaryUnit || "PCS",
      currentStock,
      averageUnitCost,
      valuation: prodValuation,
    };
  });

  // Sort products by valuation descending
  byProduct.sort((a, b) => b.valuation - a.valuation);

  const byCategory = Array.from(categoryMap.values()).sort((a, b) => b.valuation - a.valuation);

  return {
    totalValuation,
    totalQuantity,
    byCategory,
    byProduct,
  };
}

/**
 * 7. Unified Stock Movements Ledger
 */
export async function getStockMovements(params: {
  productId?: string;
  movementType?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}): Promise<{ movements: IStockMovement[]; total: number; pages: number }> {
  await connectDB();

  const movements: IStockMovement[] = [];

  const dateFilter: any = {};
  if (params.startDate) dateFilter.$gte = new Date(params.startDate);
  if (params.endDate) dateFilter.$lte = new Date(params.endDate);
  const hasDateFilter = params.startDate || params.endDate;

  // 1. Purchase Inwards
  const purchaseQuery: any = {
    status: { $in: ["RECEIVED", "PARTIALLY_RECEIVED"] },
  };
  if (hasDateFilter) {
    purchaseQuery.purchaseDate = dateFilter;
  }
  if (params.productId) {
    purchaseQuery["items.productId"] = new mongoose.Types.ObjectId(params.productId);
  }

  const purchases = await Purchase.find(purchaseQuery)
    .sort({ purchaseDate: -1, updatedAt: -1 })
    .limit(200)
    .lean();

  purchases.forEach((pur: any) => {
    (pur.items || []).forEach((it: any) => {
      if (params.productId && it.productId?.toString() !== params.productId) return;
      const qtyIn = round2(it.receivedQty || it.orderedQty || 0);
      if (qtyIn <= 0) return;

      movements.push({
        id: `PUR-${pur._id}-${it.productId}`,
        date: pur.purchaseDate ? new Date(pur.purchaseDate).toISOString() : new Date(pur.createdAt).toISOString(),
        productId: it.productId?.toString(),
        productName: it.productSnapshot?.name || "Product",
        sku: it.productSnapshot?.sku || "",
        unit: it.productSnapshot?.primaryUnit || "PCS",
        batchNumber: it.inwardBatches?.[0]?.batchNumber || undefined,
        movementType: "PURCHASE_INWARD",
        quantityIn: qtyIn,
        quantityOut: 0,
        sourceReference: pur.purchaseNumber,
        recordedByName: pur.supplierSnapshot?.name || "Purchase Inward",
        notes: `Purchase order received from ${pur.supplierSnapshot?.name || "Supplier"}`,
      });
    });
  });

  // 2. Sales Deductions & Cancellations
  const saleQuery: any = {};
  if (hasDateFilter) {
    saleQuery.createdAt = dateFilter;
  }
  if (params.productId) {
    saleQuery["items.productId"] = new mongoose.Types.ObjectId(params.productId);
  }

  const sales = await Sale.find(saleQuery).sort({ createdAt: -1 }).limit(200).lean();

  sales.forEach((s: any) => {
    (s.items || []).forEach((it: any) => {
      if (params.productId && it.productId?.toString() !== params.productId) return;
      const qtyOut = round2(it.quantity || 0);

      // Normal sale deduction
      movements.push({
        id: `SALE-${s._id}-${it.productId}`,
        date: s.saleDate ? new Date(s.saleDate).toISOString() : new Date(s.createdAt).toISOString(),
        productId: it.productId?.toString(),
        productName: it.productSnapshot?.name || "Product",
        sku: it.productSnapshot?.sku || "",
        unit: it.productSnapshot?.primaryUnit || "PCS",
        batchNumber: it.batchNumber || undefined,
        movementType: "SALE_DEDUCTION",
        quantityIn: 0,
        quantityOut: qtyOut,
        sourceReference: s.saleNumber,
        recordedByName: s.createdByName || "Sales Staff",
        notes: `Sale to ${s.customerSnapshot?.name || "Walk-in Customer"}`,
      });

      // If cancelled, there is a restoration movement
      if (s.status === "CANCELLED") {
        movements.push({
          id: `SALE-CANCEL-${s._id}-${it.productId}`,
          date: s.cancelledAt ? new Date(s.cancelledAt).toISOString() : new Date(s.updatedAt).toISOString(),
          productId: it.productId?.toString(),
          productName: it.productSnapshot?.name || "Product",
          sku: it.productSnapshot?.sku || "",
          unit: it.productSnapshot?.primaryUnit || "PCS",
          batchNumber: it.batchNumber || undefined,
          movementType: "SALE_CANCELLATION_RESTORE",
          quantityIn: qtyOut,
          quantityOut: 0,
          sourceReference: s.saleNumber,
          recordedByName: s.cancelledByName || "Manager",
          notes: `Restored due to cancellation: ${s.cancellationReason || "No reason specified"}`,
        });
      }
    });
  });

  // 3. Stock Adjustments
  const adjQuery: any = {};
  if (hasDateFilter) adjQuery.date = dateFilter;
  if (params.productId) adjQuery.productId = params.productId;

  const adjustments = await StockAdjustment.find(adjQuery)
    .sort({ date: -1 })
    .limit(200)
    .lean();

  adjustments.forEach((adj: any) => {
    let movementType: any =
      adj.type === "INCREASE" ? "STOCK_ADJUSTMENT_INCREASE" : "STOCK_ADJUSTMENT_DECREASE";

    if (adj.reason === "DAMAGED_GOODS") {
      movementType = "DAMAGE_WRITEOFF";
    } else if (adj.reason === "EXPIRED_GOODS") {
      movementType = "EXPIRED_WRITEOFF";
    }

    const qtyIn = adj.type === "INCREASE" ? adj.adjustmentQuantity : 0;
    const qtyOut = adj.type === "DECREASE" ? adj.adjustmentQuantity : 0;

    movements.push({
      id: `ADJ-${adj._id}`,
      date: new Date(adj.date || adj.createdAt).toISOString(),
      productId: adj.productId?.toString(),
      productName: adj.productSnapshot?.name || "Product",
      sku: adj.productSnapshot?.sku || "",
      unit: adj.productSnapshot?.primaryUnit || "PCS",
      batchNumber: adj.batchNumber || undefined,
      movementType,
      quantityIn: qtyIn,
      quantityOut: qtyOut,
      resultingQuantity: adj.newQuantity,
      sourceReference: adj.adjustmentNumber,
      recordedByName: adj.createdByName,
      notes: `${adj.reason}: ${adj.explanation}`,
    });
  });

  // Filter by movementType if provided
  let filtered = movements;
  if (params.movementType && params.movementType !== "ALL") {
    filtered = movements.filter((m) => m.movementType === params.movementType);
  }

  // Sort descending by date
  filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const paginated = filtered.slice(skip, skip + limit);
  const total = filtered.length;

  return {
    movements: paginated,
    total,
    pages: Math.ceil(total / limit) || 1,
  };
}
