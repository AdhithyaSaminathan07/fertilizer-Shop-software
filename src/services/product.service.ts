import mongoose from "mongoose";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import { Product } from "@/models/product";
import { Category } from "@/models/category";
import { Batch } from "@/models/batch";
import { logAuditEvent } from "@/lib/auth";
import { calculateMargin } from "@/lib/units";
import { CreateProductInput, UpdateProductInput } from "@/validations/product";
import { StockStatus } from "@/types/product";

export function getStockStatus(currentStock: number, minThreshold: number): StockStatus {
  if (currentStock <= 0) {
    return "OUT_OF_STOCK";
  }
  if (currentStock <= minThreshold) {
    return "LOW_STOCK";
  }
  return "IN_STOCK";
}

export async function listProducts(options: {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  brand?: string;
  stockStatus?: string;
  status?: string;
} = {}) {
  await connectDB();

  const page = Math.max(1, options.page || 1);
  const limit = Math.max(1, Math.min(100, options.limit || 20));
  const skip = (page - 1) * limit;

  const query: Record<string, unknown> = {};

  // Status filter (exclude ARCHIVED by default unless explicitly requested)
  if (options.status && options.status !== "ALL") {
    query.status = options.status;
  } else if (!options.status) {
    query.status = { $ne: "ARCHIVED" };
  }

  // Category filter
  if (options.categoryId && mongoose.Types.ObjectId.isValid(options.categoryId)) {
    query.categoryId = new mongoose.Types.ObjectId(options.categoryId);
  }

  // Brand filter
  if (options.brand && options.brand.trim() !== "") {
    query.brand = { $regex: options.brand.trim(), $options: "i" };
  }

  // Search filter
  if (options.search && options.search.trim() !== "") {
    const term = options.search.trim();
    query.$or = [
      { name: { $regex: term, $options: "i" } },
      { sku: { $regex: term, $options: "i" } },
      { brand: { $regex: term, $options: "i" } },
      { barcode: { $regex: term, $options: "i" } },
    ];
  }

  // Stock status filter
  if (options.stockStatus === "OUT_OF_STOCK") {
    query.currentStock = { $lte: 0 };
  } else if (options.stockStatus === "IN_STOCK") {
    query.currentStock = { $gt: 0 };
  }

  const [products, total] = await Promise.all([
    Product.find(query)
      .populate("categoryId", "name slug status")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(query),
  ]);

  const items = products.map((prod: any) => {
    const { margin, marginPercent } = calculateMargin(prod.purchasePrice, prod.sellingPrice);
    const stockStatus = getStockStatus(prod.currentStock || 0, prod.minStockThreshold || 10);

    return {
      _id: prod._id.toString(),
      name: prod.name,
      sku: prod.sku,
      barcode: prod.barcode,
      brand: prod.brand,
      categoryId: prod.categoryId?._id ? prod.categoryId._id.toString() : prod.categoryId?.toString(),
      category: prod.categoryId && typeof prod.categoryId === "object"
        ? { _id: prod.categoryId._id.toString(), name: prod.categoryId.name }
        : undefined,
      description: prod.description,
      purchasePrice: prod.purchasePrice,
      sellingPrice: prod.sellingPrice,
      margin,
      marginPercent,
      primaryUnit: prod.primaryUnit,
      unitConversion: prod.unitConversion,
      minStockThreshold: prod.minStockThreshold,
      status: prod.status,
      currentStock: prod.currentStock || 0,
      stockStatus,
      createdAt: prod.createdAt ? new Date(prod.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: prod.updatedAt ? new Date(prod.updatedAt).toISOString() : new Date().toISOString(),
    };
  });

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getProductById(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  await connectDB();

  const product = await Product.findById(id)
    .populate("categoryId", "name slug status")
    .lean();

  if (!product) return null;

  const { margin, marginPercent } = calculateMargin(product.purchasePrice, product.sellingPrice);
  const stockStatus = getStockStatus(product.currentStock || 0, product.minStockThreshold || 10);

  // Fetch batches associated with this product
  const batches = await Batch.find({ productId: id })
    .sort({ expiryDate: 1, createdAt: -1 })
    .lean();

  return {
    _id: product._id.toString(),
    name: product.name,
    sku: product.sku,
    barcode: product.barcode,
    brand: product.brand,
    categoryId: product.categoryId?._id ? (product.categoryId as any)._id.toString() : product.categoryId?.toString(),
    category: product.categoryId && typeof product.categoryId === "object"
      ? { _id: (product.categoryId as any)._id.toString(), name: (product.categoryId as any).name }
      : undefined,
    description: product.description,
    purchasePrice: product.purchasePrice,
    sellingPrice: product.sellingPrice,
    margin,
    marginPercent,
    primaryUnit: product.primaryUnit,
    unitConversion: product.unitConversion,
    minStockThreshold: product.minStockThreshold,
    status: product.status,
    currentStock: product.currentStock || 0,
    stockStatus,
    batches: batches.map((b) => ({
      _id: b._id.toString(),
      productId: b.productId.toString(),
      batchNumber: b.batchNumber,
      manufacturingDate: b.manufacturingDate ? new Date(b.manufacturingDate).toISOString() : undefined,
      expiryDate: b.expiryDate ? new Date(b.expiryDate).toISOString() : undefined,
      quantity: b.quantity,
      purchasePrice: b.purchasePrice,
      status: b.status,
      createdAt: b.createdAt.toISOString(),
    })),
    createdAt: (product as any).createdAt?.toISOString(),
    updatedAt: (product as any).updatedAt?.toISOString(),
  };
}

export async function createProduct(
  data: CreateProductInput,
  actor?: { id: string; name: string; ip?: string }
) {
  await connectDB();

  // Validate category existence
  const category = await Category.findById(data.categoryId);
  if (!category) {
    throw new Error("Selected category does not exist.");
  }
  if (category.status !== "ACTIVE") {
    throw new Error(`Category "${category.name}" is inactive. Activate it or choose another category.`);
  }

  // Handle SKU: optional manual input or collision-proof auto-generation
  let finalSku = data.sku ? data.sku.trim().toUpperCase() : "";
  if (!finalSku) {
    let collision = true;
    while (collision) {
      const timePart = Date.now().toString(36).toUpperCase();
      const randHex = crypto.randomBytes(3).toString("hex").toUpperCase();
      finalSku = `KASI-PRD-${timePart}-${randHex}`;
      const existing = await Product.findOne({ sku: finalSku });
      if (!existing) {
        collision = false;
      }
    }
  } else {
    // Validate unique SKU (case-insensitive)
    const existingSku = await Product.findOne({
      sku: { $regex: `^${finalSku}$`, $options: "i" },
    });
    if (existingSku) {
      throw new Error(`A product with SKU "${finalSku}" already exists.`);
    }
  }

  // Validate unique barcode if provided
  if (data.barcode && data.barcode.trim() !== "") {
    const existingBarcode = await Product.findOne({ barcode: data.barcode.trim() });
    if (existingBarcode) {
      throw new Error(`A product with Barcode "${data.barcode}" already exists.`);
    }
  }

  // Phase 4 safety: stock quantities begin at 0 until Purchase module integration
  const product = await Product.create({
    name: data.name.trim(),
    sku: finalSku,
    barcode: data.barcode?.trim() || undefined,
    brand: data.brand.trim(),
    categoryId: new mongoose.Types.ObjectId(data.categoryId),
    description: data.description?.trim() || undefined,
    purchasePrice: data.purchasePrice,
    sellingPrice: data.sellingPrice,
    primaryUnit: data.primaryUnit,
    unitConversion: data.unitConversion?.enabled ? data.unitConversion : { enabled: false },
    minStockThreshold: data.minStockThreshold,
    status: data.status,
    currentStock: 0,
  });

  if (actor) {
    await logAuditEvent({
      action: "PRODUCT_CREATED" as any,
      userId: actor.id,
      userName: actor.name,
      targetUserId: product._id.toString(),
      targetUserName: product.name,
      details: {
        sku: product.sku,
        brand: product.brand,
        categoryId: data.categoryId,
        purchasePrice: data.purchasePrice,
        sellingPrice: data.sellingPrice,
      },
      ipAddress: actor.ip,
    });
  }

  return getProductById(product._id.toString());
}

export async function updateProduct(
  id: string,
  data: UpdateProductInput,
  actor?: { id: string; name: string; ip?: string }
) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid Product ID");
  }
  await connectDB();

  const product = await Product.findById(id);
  if (!product) {
    throw new Error("Product not found");
  }

  // If SKU is being updated with a non-empty string, verify uniqueness (never overwrite with empty)
  if (data.sku && data.sku.trim() !== "" && data.sku.trim().toUpperCase() !== product.sku) {
    const candidateSku = data.sku.trim().toUpperCase();
    const existingSku = await Product.findOne({
      _id: { $ne: id },
      sku: { $regex: `^${candidateSku}$`, $options: "i" },
    });
    if (existingSku) {
      throw new Error(`Another product with SKU "${candidateSku}" already exists.`);
    }
    product.sku = candidateSku;
  }

  // If barcode is being updated, verify uniqueness
  if (data.barcode !== undefined && data.barcode !== product.barcode) {
    if (data.barcode && data.barcode.trim() !== "") {
      const existingBarcode = await Product.findOne({
        _id: { $ne: id },
        barcode: data.barcode.trim(),
      });
      if (existingBarcode) {
        throw new Error(`Another product with Barcode "${data.barcode}" already exists.`);
      }
      product.barcode = data.barcode.trim();
    } else {
      product.barcode = undefined;
    }
  }

  // If category changed, verify category exists
  if (data.categoryId && data.categoryId !== product.categoryId.toString()) {
    const cat = await Category.findById(data.categoryId);
    if (!cat) {
      throw new Error("Target category does not exist.");
    }
    product.categoryId = new mongoose.Types.ObjectId(data.categoryId);
  }

  if (data.name !== undefined) product.name = data.name.trim();
  if (data.brand !== undefined) product.brand = data.brand.trim();
  if (data.description !== undefined) product.description = data.description?.trim();
  if (data.purchasePrice !== undefined) product.purchasePrice = data.purchasePrice;
  if (data.sellingPrice !== undefined) product.sellingPrice = data.sellingPrice;
  if (data.primaryUnit !== undefined) product.primaryUnit = data.primaryUnit;
  if (data.unitConversion !== undefined) {
    product.unitConversion = data.unitConversion?.enabled ? data.unitConversion : { enabled: false };
  }
  if (data.minStockThreshold !== undefined) product.minStockThreshold = data.minStockThreshold;
  if (data.status !== undefined) product.status = data.status;

  await product.save();

  if (actor) {
    await logAuditEvent({
      action: "PRODUCT_UPDATED" as any,
      userId: actor.id,
      userName: actor.name,
      targetUserId: product._id.toString(),
      targetUserName: product.name,
      details: data as Record<string, unknown>,
      ipAddress: actor.ip,
    });
  }

  return getProductById(id);
}

export async function archiveProduct(
  id: string,
  actor?: { id: string; name: string; ip?: string }
) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid Product ID");
  }
  await connectDB();

  const product = await Product.findById(id);
  if (!product) {
    throw new Error("Product not found");
  }

  // Deactivate/Archive product to preserve future purchase/sales history
  product.status = "ARCHIVED";
  await product.save();

  if (actor) {
    await logAuditEvent({
      action: "PRODUCT_ARCHIVED" as any,
      userId: actor.id,
      userName: actor.name,
      targetUserId: product._id.toString(),
      targetUserName: product.name,
      details: { sku: product.sku, status: "ARCHIVED" },
      ipAddress: actor.ip,
    });
  }

  return { success: true, message: "Product archived successfully." };
}

export async function listBatchesForProduct(productId: string) {
  if (!mongoose.Types.ObjectId.isValid(productId)) {
    throw new Error("Invalid Product ID");
  }
  await connectDB();

  const batches = await Batch.find({ productId })
    .sort({ expiryDate: 1, createdAt: -1 })
    .lean();

  return batches.map((b) => ({
    _id: b._id.toString(),
    productId: b.productId.toString(),
    batchNumber: b.batchNumber,
    manufacturingDate: b.manufacturingDate ? new Date(b.manufacturingDate).toISOString() : undefined,
    expiryDate: b.expiryDate ? new Date(b.expiryDate).toISOString() : undefined,
    quantity: b.quantity,
    purchasePrice: b.purchasePrice,
    status: b.status,
    createdAt: b.createdAt.toISOString(),
  }));
}

