import { connectDB } from "@/lib/db";
import { Supplier, type ISupplierDocument } from "@/models/supplier";
import { logAuditEvent } from "@/lib/auth";
import type { SupplierFilterParams, ISupplier } from "@/types/supplier";
import type { CreateSupplierInput, UpdateSupplierInput } from "@/validations/supplier";

export interface ActorContext {
  id: string;
  name: string;
  ip?: string;
}

/**
 * Lists suppliers with pagination, text search, and status filtering.
 */
export async function listSuppliers(params: SupplierFilterParams = {}): Promise<{
  suppliers: ISupplier[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
  summary: {
    totalSuppliers: number;
    activeSuppliers: number;
    totalOutstanding: number;
  };
}> {
  await connectDB();

  const {
    search,
    status,
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = params;

  const query: Record<string, any> = {};

  if (status) {
    query.status = status;
  } else {
    // By default, exclude ARCHIVED suppliers from default active listings unless explicitly requested
    query.status = { $ne: "ARCHIVED" };
  }

  if (search && search.trim() !== "") {
    const term = search.trim();
    query.$or = [
      { name: { $regex: term, $options: "i" } },
      { contactPerson: { $regex: term, $options: "i" } },
      { phone: { $regex: term, $options: "i" } },
      { gstin: { $regex: term, $options: "i" } },
    ];
  }

  const sortDirection = sortOrder === "asc" ? 1 : -1;
  const sortOption: Record<string, 1 | -1> = { [sortBy]: sortDirection };

  const skip = (Math.max(1, page) - 1) * limit;

  const [docs, total, stats] = await Promise.all([
    Supplier.find(query).sort(sortOption).skip(skip).limit(limit).lean(),
    Supplier.countDocuments(query),
    Supplier.aggregate([
      {
        $group: {
          _id: null,
          totalSuppliers: { $sum: 1 },
          activeSuppliers: {
            $sum: { $cond: [{ $eq: ["$status", "ACTIVE"] }, 1, 0] },
          },
          totalOutstanding: {
            $sum: {
              $cond: [
                { $ne: ["$status", "ARCHIVED"] },
                "$outstandingBalance",
                0,
              ],
            },
          },
        },
      },
    ]),
  ]);

  const summary = stats[0] || {
    totalSuppliers: 0,
    activeSuppliers: 0,
    totalOutstanding: 0,
  };

  const suppliers: ISupplier[] = docs.map((doc: any) => ({
    id: doc._id.toString(),
    name: doc.name,
    contactPerson: doc.contactPerson,
    phone: doc.phone,
    email: doc.email,
    address: doc.address,
    gstin: doc.gstin,
    notes: doc.notes,
    status: doc.status,
    totalPurchases: doc.totalPurchases || 0,
    totalPaid: doc.totalPaid || 0,
    outstandingBalance: doc.outstandingBalance || 0,
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : new Date().toISOString(),
    updatedAt: doc.updatedAt ? doc.updatedAt.toISOString() : new Date().toISOString(),
  }));

  return {
    suppliers,
    pagination: {
      total,
      page: Math.max(1, page),
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
    summary: {
      totalSuppliers: summary.totalSuppliers,
      activeSuppliers: summary.activeSuppliers,
      totalOutstanding: Number(summary.totalOutstanding.toFixed(2)),
    },
  };
}

/**
 * Retrieves a single supplier by ID.
 */
export async function getSupplierById(id: string): Promise<ISupplier> {
  await connectDB();

  const doc = await Supplier.findById(id).lean();
  if (!doc) {
    throw new Error("Supplier not found");
  }

  const s = doc as any;
  return {
    id: s._id.toString(),
    name: s.name,
    contactPerson: s.contactPerson,
    phone: s.phone,
    email: s.email,
    address: s.address,
    gstin: s.gstin,
    notes: s.notes,
    status: s.status,
    totalPurchases: s.totalPurchases || 0,
    totalPaid: s.totalPaid || 0,
    outstandingBalance: s.outstandingBalance || 0,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

/**
 * Creates a new supplier with duplicate GSTIN protection.
 */
export async function createSupplier(
  input: CreateSupplierInput,
  actor: ActorContext
): Promise<ISupplier> {
  await connectDB();

  // Normalize GSTIN
  const gstinNormalized = input.gstin ? input.gstin.trim().toUpperCase() : undefined;

  if (gstinNormalized) {
    const existingWithGstin = await Supplier.findOne({ gstin: gstinNormalized });
    if (existingWithGstin) {
      throw new Error(`A supplier with GSTIN '${gstinNormalized}' already exists (${existingWithGstin.name})`);
    }
  }

  // Create document
  const doc = await Supplier.create({
    name: input.name.trim(),
    contactPerson: input.contactPerson?.trim() || undefined,
    phone: input.phone.trim(),
    email: input.email?.trim().toLowerCase() || undefined,
    address: input.address || {},
    gstin: gstinNormalized,
    notes: input.notes?.trim() || undefined,
    status: input.status || "ACTIVE",
    totalPurchases: 0,
    totalPaid: 0,
    outstandingBalance: 0,
  });

  await logAuditEvent({
    action: "SUPPLIER_CREATED" as any,
    userId: actor.id,
    userName: actor.name,
    ipAddress: actor.ip,
    details: {
      supplierId: doc._id.toString(),
      name: doc.name,
      gstin: doc.gstin,
      phone: doc.phone,
    },
  });

  return getSupplierById(doc._id.toString());
}

/**
 * Updates an existing supplier.
 */
export async function updateSupplier(
  id: string,
  input: UpdateSupplierInput,
  actor: ActorContext
): Promise<ISupplier> {
  await connectDB();

  const supplier = await Supplier.findById(id);
  if (!supplier) {
    throw new Error("Supplier not found");
  }

  if (input.gstin !== undefined) {
    const gstinNormalized = input.gstin ? input.gstin.trim().toUpperCase() : undefined;
    if (gstinNormalized && gstinNormalized !== supplier.gstin) {
      const existing = await Supplier.findOne({
        _id: { $ne: id },
        gstin: gstinNormalized,
      });
      if (existing) {
        throw new Error(`GSTIN '${gstinNormalized}' is already registered to another supplier (${existing.name})`);
      }
      supplier.gstin = gstinNormalized;
    } else if (!gstinNormalized) {
      supplier.gstin = undefined;
    }
  }

  if (input.name !== undefined) supplier.name = input.name.trim();
  if (input.contactPerson !== undefined) supplier.contactPerson = input.contactPerson.trim() || undefined;
  if (input.phone !== undefined) supplier.phone = input.phone.trim();
  if (input.email !== undefined) supplier.email = input.email.trim().toLowerCase() || undefined;
  if (input.address !== undefined) supplier.address = input.address;
  if (input.notes !== undefined) supplier.notes = input.notes.trim() || undefined;
  if (input.status !== undefined) supplier.status = input.status;

  await supplier.save();

  await logAuditEvent({
    action: "SUPPLIER_UPDATED" as any,
    userId: actor.id,
    userName: actor.name,
    ipAddress: actor.ip,
    details: {
      supplierId: supplier._id.toString(),
      name: supplier.name,
      status: supplier.status,
    },
  });

  return getSupplierById(supplier._id.toString());
}

/**
 * Soft-archives a supplier.
 * Strictly prevents archiving if an outstanding payable balance exists.
 */
export async function archiveSupplier(
  id: string,
  actor: ActorContext
): Promise<ISupplier> {
  await connectDB();

  const supplier = await Supplier.findById(id);
  if (!supplier) {
    throw new Error("Supplier not found");
  }

  if (supplier.outstandingBalance > 0) {
    throw new Error(
      `Cannot archive supplier '${supplier.name}' because an outstanding payable balance of ₹${supplier.outstandingBalance.toFixed(
        2
      )} remains. Please settle outstanding invoices before archiving.`
    );
  }

  supplier.status = "ARCHIVED";
  await supplier.save();

  await logAuditEvent({
    action: "SUPPLIER_ARCHIVED" as any,
    userId: actor.id,
    userName: actor.name,
    ipAddress: actor.ip,
    details: {
      supplierId: supplier._id.toString(),
      name: supplier.name,
    },
  });

  return getSupplierById(supplier._id.toString());
}

