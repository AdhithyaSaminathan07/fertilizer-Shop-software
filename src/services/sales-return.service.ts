import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { SalesReturn, ISalesReturnDocument } from "@/models/sales-return";
import { Sale } from "@/models/sale";
import { logAuditEvent } from "@/lib/auth";
import { round2 } from "@/services/purchase.service";
import type {
  ISalesReturn,
  ISalesReturnItem,
  ICreateSalesReturnInput,
  IUpdateSalesReturnInput,
  ReturnStatus,
} from "@/types/returns";

export interface ActorContext {
  id: string;
  name: string;
  ip?: string;
}

/**
 * Sequential Sales Return Number Generator: SRET-YYYYMM-XXXX
 */
export async function generateSalesReturnNumber(
  session?: mongoose.ClientSession
): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `SRET-${year}${month}-`;

  const lastReturn = await SalesReturn.findOne({
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
 * Get returnable details of an original sale
 * Calculates previous approved/pending return quantities per item
 */
export async function getReturnableSaleDetails(saleId: string) {
  await connectDB();

  const sale = await Sale.findById(saleId).lean();
  if (!sale) {
    throw new Error("Sales invoice not found");
  }

  if (sale.status === "CANCELLED") {
    throw new Error("Cannot return items from a cancelled sales invoice");
  }

  // Find all existing non-cancelled and non-rejected returns for this sale
  const existingReturns = await SalesReturn.find({
    saleId: sale._id,
    status: { $in: ["PENDING_APPROVAL", "APPROVED"] },
  }).lean();

  // Aggregate previously returned quantities per product and batch
  const returnedQtyMap = new Map<string, number>();
  existingReturns.forEach((ret: any) => {
    (ret.items || []).forEach((it: any) => {
      const key = `${it.productId.toString()}_${it.batchNumber || "NO_BATCH"}`;
      returnedQtyMap.set(key, round2((returnedQtyMap.get(key) || 0) + it.returnQty));
    });
  });

  const returnableItems = (sale.items || []).map((item: any) => {
    const key = `${item.productId.toString()}_${item.batchNumber || "NO_BATCH"}`;
    const previouslyReturned = returnedQtyMap.get(key) || 0;
    const soldQty = round2(item.quantity || 0);
    const availableToReturn = Math.max(0, round2(soldQty - previouslyReturned));

    return {
      productId: item.productId.toString(),
      productSnapshot: item.productSnapshot,
      batchNumber: item.batchNumber,
      soldQuantity: soldQty,
      previouslyReturnedQuantity: previouslyReturned,
      availableToReturn,
      unitSellingPrice: item.unitSellingPrice,
      discountAmount: item.discountAmount || 0,
      taxRate: item.taxRate || 0,
    };
  });

  return {
    saleId: sale._id.toString(),
    saleNumber: sale.invoiceNumber,
    saleDate: sale.invoiceDate ? new Date(sale.invoiceDate).toISOString() : new Date((sale as any).createdAt).toISOString(),
    customerSnapshot: sale.customerSnapshot,
    items: returnableItems,
  };
}

/**
 * Create a new Customer Sales Return
 * Strict Module Independence: Does NOT modify Inventory, Customer, or Cashbook.
 */
export async function createSalesReturn(
  input: ICreateSalesReturnInput,
  actor: ActorContext
): Promise<ISalesReturn> {
  await connectDB();

  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    const sale = await Sale.findById(input.saleId).session(dbSession);
    if (!sale) {
      throw new Error("Original sales invoice not found");
    }
    if (sale.status === "CANCELLED") {
      throw new Error("Cannot return items from a cancelled sales invoice");
    }

    // Find active existing returns to verify quantity limits under lock
    const existingReturns = await SalesReturn.find({
      saleId: sale._id,
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

    // Build return items and calculate independent financials
    const processedItems: ISalesReturnItem[] = [];
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    let refundTotal = 0;

    for (const itemInput of input.items) {
      const returnQty = round2(itemInput.returnQty);
      if (returnQty <= 0) {
        throw new Error("Return quantity must be greater than 0");
      }

      // Match item against original sale
      const origItem = sale.items.find(
        (it) =>
          it.productId.toString() === itemInput.productId &&
          (!itemInput.batchNumber || it.batchNumber === itemInput.batchNumber)
      );

      if (!origItem) {
        throw new Error(`Product not found in original sales invoice`);
      }

      const key = `${origItem.productId.toString()}_${origItem.batchNumber || "NO_BATCH"}`;
      const previouslyReturned = previouslyReturnedMap.get(key) || 0;
      const originalSold = round2(origItem.quantity);
      const maxReturnable = Math.max(0, round2(originalSold - previouslyReturned));

      if (returnQty > maxReturnable) {
        throw new Error(
          `Return quantity (${returnQty}) exceeds available returnable quantity (${maxReturnable}) for '${origItem.productSnapshot.name}' (Originally sold: ${originalSold}, Previously returned: ${previouslyReturned})`
        );
      }

      // Update map to prevent duplicate lines in same request over-returning
      previouslyReturnedMap.set(key, round2(previouslyReturned + returnQty));

      const unitSellingPrice = round2(origItem.unitSellingPrice);
      const gross = round2(returnQty * unitSellingPrice);

      // Prorate original discount
      const origItemDiscount = round2(origItem.discountAmount || 0);
      const unitDiscount = originalSold > 0 ? round2(origItemDiscount / originalSold) : 0;
      const discountAmount = round2(unitDiscount * returnQty);

      const taxableAmount = Math.max(0, round2(gross - discountAmount));
      const taxRate = round2((origItem as any).gstRate || (origItem as any).taxRate || 0);
      const taxAmount = round2((taxableAmount * taxRate) / 100);
      const lineTotal = round2(taxableAmount + taxAmount);

      subtotal = round2(subtotal + gross);
      discountTotal = round2(discountTotal + discountAmount);
      taxTotal = round2(taxTotal + taxAmount);
      refundTotal = round2(refundTotal + lineTotal);

      processedItems.push({
        productId: origItem.productId.toString(),
        productSnapshot: {
          name: origItem.productSnapshot.name,
          sku: origItem.productSnapshot.sku,
          primaryUnit: origItem.productSnapshot.primaryUnit || "PCS",
          hsnCode: (origItem.productSnapshot as any).hsnCode || "",
        },
        batchNumber: origItem.batchNumber,
        originalSoldQty: originalSold,
        previouslyReturnedQty: previouslyReturned,
        returnQty,
        unitSellingPrice,
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

    const returnNumber = await generateSalesReturnNumber(dbSession);
    const initialStatus: ReturnStatus = input.submitForApproval ? "PENDING_APPROVAL" : "DRAFT";
    const now = new Date();

    const returnDoc = new SalesReturn({
      returnNumber,
      returnDate: input.returnDate ? new Date(input.returnDate) : now,
      saleId: sale._id,
      saleNumber: sale.invoiceNumber,
      saleDate: sale.invoiceDate || (sale as any).createdAt,
      customerSnapshot: {
        id: sale.customerId,
        name: sale.customerSnapshot?.name || "Walk-in Customer",
        mobile: sale.customerSnapshot?.phone,
        village: sale.customerSnapshot?.village,
        gstin: sale.customerSnapshot?.gstin,
      },
      items: processedItems,
      subtotal,
      discountTotal,
      taxTotal,
      refundTotal,
      refundMethod: input.refundMethod,
      refundReference: input.refundReference?.trim(),
      status: initialStatus,
      statusHistory: [
        {
          status: initialStatus,
          changedAt: now,
          changedById: new mongoose.Types.ObjectId(actor.id),
          changedByName: actor.name,
          reason: input.submitForApproval
            ? "Created and submitted for approval"
            : "Draft sales return created",
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
      action: "SALES_RETURN_CREATED",
      details: {
        resourceType: "SALES_RETURN",
        resourceId: returnDoc._id.toString(),
        returnNumber,
        saleNumber: sale.invoiceNumber,
        refundTotal,
        status: initialStatus,
        itemCount: processedItems.length,
      },
      ipAddress: actor.ip,
    });

    await dbSession.commitTransaction();
    return returnDoc.toJSON() as unknown as ISalesReturn;
  } catch (error) {
    await dbSession.abortTransaction();
    throw error;
  } finally {
    dbSession.endSession();
  }
}

/**
 * Update an existing Sales Return in DRAFT status
 */
export async function updateSalesReturn(
  id: string,
  input: IUpdateSalesReturnInput,
  actor: ActorContext
): Promise<ISalesReturn> {
  await connectDB();

  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    const returnDoc = await SalesReturn.findById(id).session(dbSession);
    if (!returnDoc) {
      throw new Error("Sales return not found");
    }

    if (returnDoc.status !== "DRAFT") {
      throw new Error(`Only DRAFT returns can be updated (current status: '${returnDoc.status}')`);
    }

    const sale = await Sale.findById(returnDoc.saleId).session(dbSession);
    if (!sale) {
      throw new Error("Original sales invoice not found");
    }

    if (input.refundMethod) returnDoc.refundMethod = input.refundMethod;
    if (input.refundReference !== undefined) returnDoc.refundReference = input.refundReference?.trim();
    if (input.generalReason) returnDoc.generalReason = input.generalReason;
    if (input.remarks !== undefined) returnDoc.remarks = input.remarks?.trim();

    // If items are being updated
    if (input.items && input.items.length > 0) {
      // Find other active returns for this sale excluding the current return
      const otherReturns = await SalesReturn.find({
        saleId: sale._id,
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

      const processedItems: ISalesReturnItem[] = [];
      let subtotal = 0;
      let discountTotal = 0;
      let taxTotal = 0;
      let refundTotal = 0;

      for (const itemInput of input.items) {
        const returnQty = round2(itemInput.returnQty);
        if (returnQty <= 0) {
          throw new Error("Return quantity must be greater than 0");
        }

        const origItem = sale.items.find(
          (it) =>
            it.productId.toString() === itemInput.productId &&
            (!itemInput.batchNumber || it.batchNumber === itemInput.batchNumber)
        );

        if (!origItem) {
          throw new Error(`Product not found in original sales invoice`);
        }

        const key = `${origItem.productId.toString()}_${origItem.batchNumber || "NO_BATCH"}`;
        const previouslyReturned = previouslyReturnedMap.get(key) || 0;
        const originalSold = round2(origItem.quantity);
        const maxReturnable = Math.max(0, round2(originalSold - previouslyReturned));

        if (returnQty > maxReturnable) {
          throw new Error(
            `Return quantity (${returnQty}) exceeds available returnable quantity (${maxReturnable}) for '${origItem.productSnapshot.name}'`
          );
        }

        previouslyReturnedMap.set(key, round2(previouslyReturned + returnQty));

        const unitSellingPrice = round2(origItem.unitSellingPrice);
        const gross = round2(returnQty * unitSellingPrice);
        const origItemDiscount = round2(origItem.discountAmount || 0);
        const unitDiscount = originalSold > 0 ? round2(origItemDiscount / originalSold) : 0;
        const discountAmount = round2(unitDiscount * returnQty);
        const taxableAmount = Math.max(0, round2(gross - discountAmount));
        const taxRate = round2((origItem as any).gstRate || (origItem as any).taxRate || 0);
        const taxAmount = round2((taxableAmount * taxRate) / 100);
        const lineTotal = round2(taxableAmount + taxAmount);

        subtotal = round2(subtotal + gross);
        discountTotal = round2(discountTotal + discountAmount);
        taxTotal = round2(taxTotal + taxAmount);
        refundTotal = round2(refundTotal + lineTotal);

        processedItems.push({
          productId: origItem.productId.toString(),
          productSnapshot: {
            name: origItem.productSnapshot.name,
            sku: origItem.productSnapshot.sku,
            primaryUnit: origItem.productSnapshot.primaryUnit || "PCS",
            hsnCode: (origItem.productSnapshot as any).hsnCode || "",
          },
          batchNumber: origItem.batchNumber,
          originalSoldQty: originalSold,
          previouslyReturnedQty: previouslyReturned,
          returnQty,
          unitSellingPrice,
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
      returnDoc.refundTotal = refundTotal;
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
      action: "SALES_RETURN_UPDATED",
      details: {
        resourceType: "SALES_RETURN",
        resourceId: returnDoc._id.toString(),
        returnNumber: returnDoc.returnNumber,
        status: returnDoc.status,
      },
      ipAddress: actor.ip,
    });

    await dbSession.commitTransaction();
    return returnDoc.toJSON() as unknown as ISalesReturn;
  } catch (error) {
    await dbSession.abortTransaction();
    throw error;
  } finally {
    dbSession.endSession();
  }
}

/**
 * Approve Sales Return
 * Strict Module Independence: Only updates the sales return document.
 * NEVER changes inventory, customer ledger, sale invoice, or cashbook.
 */
export async function approveSalesReturn(
  id: string,
  actor: ActorContext
): Promise<ISalesReturn> {
  await connectDB();

  const dbSession = await mongoose.startSession();
  dbSession.startTransaction();

  try {
    const returnDoc = await SalesReturn.findById(id).session(dbSession);
    if (!returnDoc) {
      throw new Error("Sales return not found");
    }

    if (returnDoc.status === "APPROVED") {
      throw new Error("Sales return is already approved");
    }

    if (returnDoc.status !== "PENDING_APPROVAL" && returnDoc.status !== "DRAFT") {
      throw new Error(`Cannot approve return with status '${returnDoc.status}'`);
    }

    // Concurrent over-return lock check: Verify no other returns approved in the meantime have depleted returnable quantities
    const otherReturns = await SalesReturn.find({
      saleId: returnDoc.saleId,
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
      const originalSold = round2(item.originalSoldQty);
      const remainingReturnable = Math.max(0, round2(originalSold - approvedQty));

      if (item.returnQty > remainingReturnable) {
        throw new Error(
          `Approval aborted: Return quantity (${item.returnQty}) for '${item.productSnapshot.name}' exceeds currently available returnable quantity (${remainingReturnable}) due to previously approved returns`
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
      reason: "Sales return authorized and approved",
    });

    await returnDoc.save({ session: dbSession });

    await logAuditEvent({
      userId: actor.id,
      userName: actor.name,
      action: "SALES_RETURN_APPROVED",
      details: {
        resourceType: "SALES_RETURN",
        resourceId: returnDoc._id.toString(),
        returnNumber: returnDoc.returnNumber,
        refundTotal: returnDoc.refundTotal,
      },
      ipAddress: actor.ip,
    });

    await dbSession.commitTransaction();
    return returnDoc.toJSON() as unknown as ISalesReturn;
  } catch (error) {
    await dbSession.abortTransaction();
    throw error;
  } finally {
    dbSession.endSession();
  }
}

/**
 * Reject Sales Return
 */
export async function rejectSalesReturn(
  id: string,
  reason: string,
  actor: ActorContext
): Promise<ISalesReturn> {
  await connectDB();

  const returnDoc = await SalesReturn.findById(id);
  if (!returnDoc) {
    throw new Error("Sales return not found");
  }

  if (returnDoc.status === "APPROVED") {
    throw new Error("Cannot reject an already approved sales return");
  }
  if (returnDoc.status === "REJECTED") {
    throw new Error("Sales return is already rejected");
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
    action: "SALES_RETURN_REJECTED",
    details: {
      resourceType: "SALES_RETURN",
      resourceId: returnDoc._id.toString(),
      returnNumber: returnDoc.returnNumber,
      rejectionReason: reason.trim(),
    },
    ipAddress: actor.ip,
  });

  return returnDoc.toJSON() as unknown as ISalesReturn;
}

/**
 * Cancel Sales Return
 */
export async function cancelSalesReturn(
  id: string,
  reason: string,
  actor: ActorContext
): Promise<ISalesReturn> {
  await connectDB();

  const returnDoc = await SalesReturn.findById(id);
  if (!returnDoc) {
    throw new Error("Sales return not found");
  }

  if (returnDoc.status === "CANCELLED") {
    throw new Error("Sales return is already cancelled");
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
    action: "SALES_RETURN_CANCELLED",
    details: {
      resourceType: "SALES_RETURN",
      resourceId: returnDoc._id.toString(),
      returnNumber: returnDoc.returnNumber,
      cancellationReason: reason.trim(),
    },
    ipAddress: actor.ip,
  });

  return returnDoc.toJSON() as unknown as ISalesReturn;
}

/**
 * Query Sales Returns list with pagination
 */
export async function getSalesReturns(params: {
  search?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}): Promise<{ returns: ISalesReturn[]; total: number; pages: number }> {
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
      { saleNumber: { $regex: s, $options: "i" } },
      { "customerSnapshot.name": { $regex: s, $options: "i" } },
      { "customerSnapshot.mobile": { $regex: s, $options: "i" } },
    ];
  }

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const [docs, total] = await Promise.all([
    SalesReturn.find(query).sort({ returnDate: -1, createdAt: -1 }).skip(skip).limit(limit),
    SalesReturn.countDocuments(query),
  ]);

  return {
    returns: docs.map((d) => d.toJSON() as unknown as ISalesReturn),
    total,
    pages: Math.ceil(total / limit) || 1,
  };
}

export async function getSalesReturnById(id: string): Promise<ISalesReturn> {
  await connectDB();
  const returnDoc = await SalesReturn.findById(id);
  if (!returnDoc) {
    throw new Error("Sales return not found");
  }
  return returnDoc.toJSON() as unknown as ISalesReturn;
}

