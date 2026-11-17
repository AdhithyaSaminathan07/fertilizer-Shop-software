import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { PurchaseReturn, IPurchaseReturnDocument } from "@/models/purchase-return";
import { Purchase } from "@/models/purchase";
import { logAuditEvent } from "@/lib/auth";
import { round2 } from "@/services/purchase.service";
import type {
  IPurchaseReturn,
  IPurchaseReturnItem,
  ICreatePurchaseReturnInput,
  IUpdatePurchaseReturnInput,
  ReturnStatus,
} from "@/types/returns";

export interface ActorContext {
  id: string;
  name: string;
  ip?: string;
}

/**
 * Sequential Purchase Return Number Generator: PRET-YYYYMM-XXXX
 */
export async function generatePurchaseReturnNumber(
  session?: mongoose.ClientSession
): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `PRET-${year}${month}-`;

  const lastReturn = await PurchaseReturn.findOne({
    returnNumber: { $regex: `^${prefix}` },
  })
    .sort({ returnNumber: -1 })
    .session(session || null);

  let sequence = 1;
  if (lastReturn && lastReturn.returnNumber) {
    const parts = lastReturn.returnNumber.split("-");
    const lastSeq = parseInt(parts[2], 10);
    if (!isNaN(lastSeq)) {
      sequence = lastSeq + 1;
    }
  }

  return `${prefix}${String(sequence).padStart(4, "0")}`;
}

/**
 * Get returnable details of an original purchase
 * Calculates previous approved/pending return quantities per item
 */
export async function getReturnablePurchaseDetails(purchaseId: string) {
  await connectDB();

  const purchase = await Purchase.findById(purchaseId).lean();
  if (!purchase) {
    throw new Error("Purchase invoice not found");
  }

  if (purchase.status === "CANCELLED") {
    throw new Error("Cannot return items from a cancelled purchase");
  }

  // Find all existing active returns for this purchase
  const existingReturns = await PurchaseReturn.find({
    purchaseId: purchase._id,
    status: { $in: ["PENDING_APPROVAL", "APPROVED"] },
  }).lean();

  const returnedQtyMap = new Map<string, number>();
  existingReturns.forEach((ret: any) => {
    (ret.items || []).forEach((it: any) => {
      const key = `${it.productId.toString()}_${it.batchNumber || "NO_BATCH"}`;
      returnedQtyMap.set(key, round2((returnedQtyMap.get(key) || 0) + it.returnQty));
    });
  });

  const returnableItems = (purchase.items || []).map((item: any) => {
    const key = `${item.productId.toString()}_${item.inwardBatches?.[0]?.batchNumber || "NO_BATCH"}`;
    const previouslyReturned = returnedQtyMap.get(key) || 0;
    const purchasedQty = round2(item.receivedQty || item.orderedQty || 0);
    const availableToReturn = Math.max(0, round2(purchasedQty - previouslyReturned));

    return {
      productId: item.productId.toString(),
      productSnapshot: item.productSnapshot,
      batchNumber: item.inwardBatches?.[0]?.batchNumber,
      purchasedQuantity: purchasedQty,
      previouslyReturnedQuantity: previouslyReturned,
      availableToReturn,
      unitPurchasePrice: item.unitPurchasePrice,
      discountAmount: item.discountAmount || 0,
      taxRate: item.taxRate || 0,
    };
  });

  return {
    purchaseId: purchase._id.toString(),
    purchaseNumber: purchase.purchaseNumber,
    supplierInvoiceNumber: purchase.supplierInvoiceNumber,
    supplierInvoiceDate: purchase.supplierInvoiceDate
      ? new Date(purchase.supplierInvoiceDate).toISOString()
      : undefined,
    purchaseDate: purchase.purchaseDate
      ? new Date(purchase.purchaseDate).toISOString()
      : new Date(purchase.createdAt).toISOString(),
    supplierSnapshot: purchase.supplierSnapshot,
    items: returnableItems,
  };
}

/**
 * Create a new Supplier Purchase Return
 * Strict Module Independence: Does NOT modify Inventory, Supplier Balances, Advances or Payments.
 */
export async function createPurchaseReturn(
  input: ICreatePurchaseReturnInput,
  actor: ActorContext
): Promise<IPurchaseReturn> {
  await connectDB();

  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    const purchase = await Purchase.findById(input.purchaseId).session(dbSession);
    if (!purchase) {
      throw new Error("Original purchase invoice not found");
    }
    if (purchase.status === "CANCELLED") {
      throw new Error("Cannot return items from a cancelled purchase invoice");
    }

    // Find active existing returns to verify limits under lock
    const existingReturns = await PurchaseReturn.find({
      purchaseId: purchase._id,
      status: { $in: ["PENDING_APPROVAL", "APPROVED"] },
    }).session(dbSession);

    const previouslyReturnedMap = new Map<string, number>();
    existingReturns.forEach((ret) => {
      (ret.items || []).forEach((it) => {
        const key = `${it.productId.toString()}_${it.batchNumber || "NO_BATCH"}`;
        previouslyReturnedMap.set(
          key,
          round2((previouslyReturnedMap.get(key) || 0) + it.returnQty)
        );
      });
    });

    const processedItems: IPurchaseReturnItem[] = [];
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    let returnTotal = 0;

    for (const itemInput of input.items) {
      const returnQty = round2(itemInput.returnQty);
      if (returnQty <= 0) {
        throw new Error("Return quantity must be greater than 0");
      }

      // Match item against original purchase
      const origItem = purchase.items.find(
        (it) => it.productId?.toString() === itemInput.productId
      );

      if (!origItem) {
        throw new Error("Product not found in original purchase invoice");
      }

      const key = `${origItem.productId?.toString() || ""}_${itemInput.batchNumber || "NO_BATCH"}`;
      const previouslyReturned = previouslyReturnedMap.get(key) || 0;
      const originalPurchased = round2(origItem.receivedQty || origItem.orderedQty || 0);
      const maxReturnable = Math.max(0, round2(originalPurchased - previouslyReturned));

      if (returnQty > maxReturnable) {
        throw new Error(
          `Return quantity (${returnQty}) exceeds available returnable quantity (${maxReturnable}) for '${origItem.productSnapshot?.name}' (Originally purchased: ${originalPurchased}, Previously returned: ${previouslyReturned})`
        );
      }

      previouslyReturnedMap.set(key, round2(previouslyReturned + returnQty));

      const unitPurchasePrice = round2(origItem.unitPurchasePrice);
      const gross = round2(returnQty * unitPurchasePrice);

      const origItemDiscount = round2(origItem.discountAmount || 0);
      const unitDiscount = originalPurchased > 0 ? round2(origItemDiscount / originalPurchased) : 0;
      const discountAmount = round2(unitDiscount * returnQty);

      const taxableAmount = Math.max(0, round2(gross - discountAmount));
      const taxRate = round2(origItem.taxRate || 0);
      const taxAmount = round2((taxableAmount * taxRate) / 100);
      const lineTotal = round2(taxableAmount + taxAmount);

      subtotal = round2(subtotal + gross);
      discountTotal = round2(discountTotal + discountAmount);
      taxTotal = round2(taxTotal + taxAmount);
      returnTotal = round2(returnTotal + lineTotal);

      processedItems.push({
        productId: origItem.productId?.toString() || itemInput.productId,
        productSnapshot: {
          name: origItem.productSnapshot?.name || "Product",
          sku: origItem.productSnapshot?.sku || "",
          primaryUnit: origItem.productSnapshot?.primaryUnit || "PCS",
        },
        batchNumber: itemInput.batchNumber,
        originalPurchasedQty: originalPurchased,
        previouslyReturnedQty: previouslyReturned,
        returnQty,
        unitPurchasePrice,
        discountAmount,
        taxRate,
        taxableAmount,
        taxAmount,
        lineTotal,
        reason: itemInput.reason,
        condition: itemInput.condition,
        remarks: itemInput.remarks?.trim(),
      });
    }

    const returnNumber = await generatePurchaseReturnNumber(dbSession);
    const initialStatus: ReturnStatus = input.submitForApproval ? "PENDING_APPROVAL" : "DRAFT";
    const now = new Date();

    const returnDoc = new PurchaseReturn({
      returnNumber,
      returnDate: input.returnDate ? new Date(input.returnDate) : now,
      purchaseId: purchase._id,
      purchaseNumber: purchase.purchaseNumber,
      supplierInvoiceNumber: purchase.supplierInvoiceNumber,
      supplierInvoiceDate: purchase.supplierInvoiceDate,
      purchaseDate: purchase.purchaseDate || purchase.createdAt,
      supplierSnapshot: {
        id: purchase.supplierId,
        name: purchase.supplierSnapshot?.name || "Supplier",
        phone: purchase.supplierSnapshot?.phone,
        gstin: purchase.supplierSnapshot?.gstin,
      },
      items: processedItems,
      subtotal,
      discountTotal,
      taxTotal,
      returnTotal,
      supplierResponse: input.supplierResponse,
      supplierCreditNoteNumber: input.supplierCreditNoteNumber?.trim(),
      supplierCreditNoteDate: input.supplierCreditNoteDate
        ? new Date(input.supplierCreditNoteDate)
        : undefined,
      status: initialStatus,
      statusHistory: [
        {
          status: initialStatus,
          changedAt: now,
          changedById: new mongoose.Types.ObjectId(actor.id),
          changedByName: actor.name,
          reason: input.submitForApproval
            ? "Created and submitted for approval"
            : "Draft purchase return created",
        },
      ],
      generalReason: input.generalReason || input.items[0]?.reason,
      remarks: input.remarks?.trim(),
      createdById: new mongoose.Types.ObjectId(actor.id),
      createdByName: actor.name,
    });

    await returnDoc.save({ session: dbSession });

    await logAuditEvent({
      userId: actor.id,
      userName: actor.name,
      action: "PURCHASE_RETURN_CREATED",
      details: {
        resourceType: "PURCHASE_RETURN",
        resourceId: returnDoc._id.toString(),
        returnNumber,
        purchaseNumber: purchase.purchaseNumber,
        returnTotal,
        status: initialStatus,
        itemCount: processedItems.length,
      },
      ipAddress: actor.ip,
    });

    await dbSession.commitTransaction();
    return returnDoc.toJSON() as unknown as IPurchaseReturn;
  } catch (error) {
    await dbSession.abortTransaction();
    throw error;
  } finally {
    dbSession.endSession();
  }
}

/**
 * Update an existing Purchase Return in DRAFT status
 */
export async function updatePurchaseReturn(
  id: string,
  input: IUpdatePurchaseReturnInput,
  actor: ActorContext
): Promise<IPurchaseReturn> {
  await connectDB();

  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    const returnDoc = await PurchaseReturn.findById(id).session(dbSession);
    if (!returnDoc) {
      throw new Error("Purchase return not found");
    }

    if (returnDoc.status !== "DRAFT") {
      throw new Error(`Only DRAFT returns can be updated (current status: '${returnDoc.status}')`);
    }

    const purchase = await Purchase.findById(returnDoc.purchaseId).session(dbSession);
    if (!purchase) {
      throw new Error("Original purchase invoice not found");
    }

    if (input.supplierResponse) returnDoc.supplierResponse = input.supplierResponse;
    if (input.supplierCreditNoteNumber !== undefined)
      returnDoc.supplierCreditNoteNumber = input.supplierCreditNoteNumber?.trim();
    if (input.supplierCreditNoteDate !== undefined)
      returnDoc.supplierCreditNoteDate = input.supplierCreditNoteDate
        ? new Date(input.supplierCreditNoteDate)
        : undefined;
    if (input.generalReason) returnDoc.generalReason = input.generalReason;
    if (input.remarks !== undefined) returnDoc.remarks = input.remarks?.trim();

    if (input.items && input.items.length > 0) {
      const otherReturns = await PurchaseReturn.find({
        purchaseId: purchase._id,
        _id: { $ne: returnDoc._id },
        status: { $in: ["PENDING_APPROVAL", "APPROVED"] },
      }).session(dbSession);

      const previouslyReturnedMap = new Map<string, number>();
      otherReturns.forEach((ret) => {
        (ret.items || []).forEach((it) => {
          const key = `${it.productId.toString()}_${it.batchNumber || "NO_BATCH"}`;
          previouslyReturnedMap.set(
            key,
            round2((previouslyReturnedMap.get(key) || 0) + it.returnQty)
          );
        });
      });

      const processedItems: IPurchaseReturnItem[] = [];
      let subtotal = 0;
      let discountTotal = 0;
      let taxTotal = 0;
      let returnTotal = 0;

      for (const itemInput of input.items) {
        const returnQty = round2(itemInput.returnQty);
        if (returnQty <= 0) {
          throw new Error("Return quantity must be greater than 0");
        }

        const origItem = purchase.items.find(
          (it) => it.productId?.toString() === itemInput.productId
        );

        if (!origItem) {
          throw new Error("Product not found in original purchase invoice");
        }

        const key = `${origItem.productId?.toString() || ""}_${itemInput.batchNumber || "NO_BATCH"}`;
        const previouslyReturned = previouslyReturnedMap.get(key) || 0;
        const originalPurchased = round2(origItem.receivedQty || origItem.orderedQty || 0);
        const maxReturnable = Math.max(0, round2(originalPurchased - previouslyReturned));

        if (returnQty > maxReturnable) {
          throw new Error(
            `Return quantity (${returnQty}) exceeds available returnable quantity (${maxReturnable}) for '${origItem.productSnapshot?.name}'`
          );
        }

        previouslyReturnedMap.set(key, round2(previouslyReturned + returnQty));

        const unitPurchasePrice = round2(origItem.unitPurchasePrice);
        const gross = round2(returnQty * unitPurchasePrice);
        const origItemDiscount = round2(origItem.discountAmount || 0);
        const unitDiscount = originalPurchased > 0 ? round2(origItemDiscount / originalPurchased) : 0;
        const discountAmount = round2(unitDiscount * returnQty);
        const taxableAmount = Math.max(0, round2(gross - discountAmount));
        const taxRate = round2(origItem.taxRate || 0);
        const taxAmount = round2((taxableAmount * taxRate) / 100);
        const lineTotal = round2(taxableAmount + taxAmount);

        subtotal = round2(subtotal + gross);
        discountTotal = round2(discountTotal + discountAmount);
        taxTotal = round2(taxTotal + taxAmount);
        returnTotal = round2(returnTotal + lineTotal);

        processedItems.push({
          productId: origItem.productId?.toString() || itemInput.productId,
          productSnapshot: {
            name: origItem.productSnapshot?.name || "Product",
            sku: origItem.productSnapshot?.sku || "",
            primaryUnit: origItem.productSnapshot?.primaryUnit || "PCS",
          },
          batchNumber: itemInput.batchNumber,
          originalPurchasedQty: originalPurchased,
          previouslyReturnedQty: previouslyReturned,
          returnQty,
          unitPurchasePrice,
          discountAmount,
          taxRate,
          taxableAmount,
          taxAmount,
          lineTotal,
          reason: itemInput.reason,
          condition: itemInput.condition,
          remarks: itemInput.remarks?.trim(),
        });
      }

      returnDoc.items = processedItems as any;
      returnDoc.subtotal = subtotal;
      returnDoc.discountTotal = discountTotal;
      returnDoc.taxTotal = taxTotal;
      returnDoc.returnTotal = returnTotal;
    }

    if (input.submitForApproval) {
      returnDoc.status = "PENDING_APPROVAL";
      returnDoc.statusHistory.push({
        status: "PENDING_APPROVAL",
        changedAt: new Date().toISOString(),
        changedById: actor.id,
        changedByName: actor.name,
        reason: "Submitted for approval",
      });
    }

    await returnDoc.save({ session: dbSession });

    await logAuditEvent({
      userId: actor.id,
      userName: actor.name,
      action: "PURCHASE_RETURN_UPDATED",
      details: {
        resourceType: "PURCHASE_RETURN",
        resourceId: returnDoc._id.toString(),
        returnNumber: returnDoc.returnNumber,
        status: returnDoc.status,
      },
      ipAddress: actor.ip,
    });

    await dbSession.commitTransaction();
    return returnDoc.toJSON() as unknown as IPurchaseReturn;
  } catch (error) {
    await dbSession.abortTransaction();
    throw error;
  } finally {
    dbSession.endSession();
  }
}

/**
 * Approve Purchase Return
 * Strict Module Independence: Only updates the purchase return document.
 * NEVER changes inventory, supplier balance, advances or purchase invoices.
 */
export async function approvePurchaseReturn(
  id: string,
  actor: ActorContext
): Promise<IPurchaseReturn> {
  await connectDB();

  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    const returnDoc = await PurchaseReturn.findById(id).session(dbSession);
    if (!returnDoc) {
      throw new Error("Purchase return not found");
    }

    if (returnDoc.status === "APPROVED") {
      throw new Error("Purchase return is already approved");
    }

    if (returnDoc.status !== "PENDING_APPROVAL" && returnDoc.status !== "DRAFT") {
      throw new Error(`Cannot approve return with status '${returnDoc.status}'`);
    }

    // Verify under transaction lock that other returns haven't depleted limits
    const otherReturns = await PurchaseReturn.find({
      purchaseId: returnDoc.purchaseId,
      _id: { $ne: returnDoc._id },
      status: "APPROVED",
    }).session(dbSession);

    const approvedReturnedMap = new Map<string, number>();
    otherReturns.forEach((ret) => {
      (ret.items || []).forEach((it) => {
        const key = `${it.productId.toString()}_${it.batchNumber || "NO_BATCH"}`;
        approvedReturnedMap.set(
          key,
          round2((approvedReturnedMap.get(key) || 0) + it.returnQty)
        );
      });
    });

    for (const item of returnDoc.items) {
      const key = `${item.productId.toString()}_${item.batchNumber || "NO_BATCH"}`;
      const approvedQty = approvedReturnedMap.get(key) || 0;
      const originalPurchased = round2(item.originalPurchasedQty);
      const remainingReturnable = Math.max(0, round2(originalPurchased - approvedQty));

      if (item.returnQty > remainingReturnable) {
        throw new Error(
          `Approval aborted: Return quantity (${item.returnQty}) for '${item.productSnapshot.name}' exceeds available returnable quantity (${remainingReturnable}) due to previously approved returns`
        );
      }
    }

    const now = new Date();
    returnDoc.status = "APPROVED";
    returnDoc.approvedAt = now;
    returnDoc.approvedById = new mongoose.Types.ObjectId(actor.id);
    returnDoc.approvedByName = actor.name;

    returnDoc.statusHistory.push({
      status: "APPROVED",
      changedAt: now.toISOString(),
      changedById: actor.id,
      changedByName: actor.name,
      reason: "Purchase return authorized and approved",
    });

    await returnDoc.save({ session: dbSession });

    await logAuditEvent({
      userId: actor.id,
      userName: actor.name,
      action: "PURCHASE_RETURN_APPROVED",
      details: {
        resourceType: "PURCHASE_RETURN",
        resourceId: returnDoc._id.toString(),
        returnNumber: returnDoc.returnNumber,
        returnTotal: returnDoc.returnTotal,
      },
      ipAddress: actor.ip,
    });

    await dbSession.commitTransaction();
    return returnDoc.toJSON() as unknown as IPurchaseReturn;
  } catch (error) {
    await dbSession.abortTransaction();
    throw error;
  } finally {
    dbSession.endSession();
  }
}

/**
 * Reject Purchase Return
 */
export async function rejectPurchaseReturn(
  id: string,
  reason: string,
  actor: ActorContext
): Promise<IPurchaseReturn> {
  await connectDB();

  const returnDoc = await PurchaseReturn.findById(id);
  if (!returnDoc) {
    throw new Error("Purchase return not found");
  }

  if (returnDoc.status === "APPROVED") {
    throw new Error("Cannot reject an already approved purchase return");
  }
  if (returnDoc.status === "REJECTED") {
    throw new Error("Purchase return is already rejected");
  }

  const now = new Date();
  returnDoc.status = "REJECTED";
  returnDoc.rejectedAt = now;
  returnDoc.rejectedById = new mongoose.Types.ObjectId(actor.id);
  returnDoc.rejectedByName = actor.name;
  returnDoc.rejectionReason = reason.trim();

  returnDoc.statusHistory.push({
    status: "REJECTED",
    changedAt: now.toISOString(),
    changedById: actor.id,
    changedByName: actor.name,
    reason: reason.trim(),
  });

  await returnDoc.save();

  await logAuditEvent({
    userId: actor.id,
    userName: actor.name,
    action: "PURCHASE_RETURN_REJECTED",
    details: {
      resourceType: "PURCHASE_RETURN",
      resourceId: returnDoc._id.toString(),
      returnNumber: returnDoc.returnNumber,
      rejectionReason: reason.trim(),
    },
    ipAddress: actor.ip,
  });

  return returnDoc.toJSON() as unknown as IPurchaseReturn;
}

/**
 * Cancel Purchase Return
 */
export async function cancelPurchaseReturn(
  id: string,
  reason: string,
  actor: ActorContext
): Promise<IPurchaseReturn> {
  await connectDB();

  const returnDoc = await PurchaseReturn.findById(id);
  if (!returnDoc) {
    throw new Error("Purchase return not found");
  }

  if (returnDoc.status === "CANCELLED") {
    throw new Error("Purchase return is already cancelled");
  }

  const now = new Date();
  returnDoc.status = "CANCELLED";
  returnDoc.cancelledAt = now;
  returnDoc.cancelledById = new mongoose.Types.ObjectId(actor.id);
  returnDoc.cancelledByName = actor.name;
  returnDoc.cancellationReason = reason.trim();

  returnDoc.statusHistory.push({
    status: "CANCELLED",
    changedAt: now.toISOString(),
    changedById: actor.id,
    changedByName: actor.name,
    reason: reason.trim(),
  });

  await returnDoc.save();

  await logAuditEvent({
    userId: actor.id,
    userName: actor.name,
    action: "PURCHASE_RETURN_CANCELLED",
    details: {
      resourceType: "PURCHASE_RETURN",
      resourceId: returnDoc._id.toString(),
      returnNumber: returnDoc.returnNumber,
      cancellationReason: reason.trim(),
    },
    ipAddress: actor.ip,
  });

  return returnDoc.toJSON() as unknown as IPurchaseReturn;
}

/**
 * Query Purchase Returns list with pagination
 */
export async function getPurchaseReturns(params: {
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}): Promise<{ returns: IPurchaseReturn[]; total: number; pages: number }> {
  await connectDB();

  const query: any = {};
  if (params.status) {
    query.status = params.status;
  }
  if (params.startDate || params.endDate) {
    query.returnDate = {};
    if (params.startDate) query.returnDate.$gte = new Date(params.startDate);
    if (params.endDate) query.returnDate.$lte = new Date(params.endDate);
  }
  if (params.search && params.search.trim()) {
    const s = params.search.trim();
    query.$or = [
      { returnNumber: { $regex: s, $options: "i" } },
      { purchaseNumber: { $regex: s, $options: "i" } },
      { supplierInvoiceNumber: { $regex: s, $options: "i" } },
      { "supplierSnapshot.name": { $regex: s, $options: "i" } },
    ];
  }

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const [docs, total] = await Promise.all([
    PurchaseReturn.find(query).sort({ returnDate: -1, createdAt: -1 }).skip(skip).limit(limit),
    PurchaseReturn.countDocuments(query),
  ]);

  return {
    returns: docs.map((d) => d.toJSON() as unknown as IPurchaseReturn),
    total,
    pages: Math.ceil(total / limit) || 1,
  };
}

export async function getPurchaseReturnById(id: string): Promise<IPurchaseReturn> {
  await connectDB();
  const returnDoc = await PurchaseReturn.findById(id);
  if (!returnDoc) {
    throw new Error("Purchase return not found");
  }
  return returnDoc.toJSON() as unknown as IPurchaseReturn;
}

