import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Category } from "@/models/category";
import { Product } from "@/models/product";
import { logAuditEvent } from "@/lib/auth";
import { CreateCategoryInput, UpdateCategoryInput } from "@/validations/category";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function listCategories(filter: { search?: string; status?: string } = {}) {
  await connectDB();

  const query: Record<string, unknown> = {};
  if (filter.status && filter.status !== "ALL") {
    query.status = filter.status;
  }
  if (filter.search && filter.search.trim() !== "") {
    query.name = { $regex: filter.search.trim(), $options: "i" };
  }

  const categories = await Category.find(query).sort({ name: 1 });

  // Compute live product count for each category
  const categoriesWithCounts = await Promise.all(
    categories.map(async (cat) => {
      const productCount = await Product.countDocuments({
        categoryId: cat._id,
        status: { $ne: "ARCHIVED" },
      });
      return {
        _id: cat._id.toString(),
        name: cat.name,
        slug: cat.slug,
        description: cat.description,
        status: cat.status,
        productCount,
        createdAt: cat.createdAt.toISOString(),
        updatedAt: cat.updatedAt.toISOString(),
      };
    })
  );

  return categoriesWithCounts;
}

export async function getCategoryById(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;
  await connectDB();
  const category = await Category.findById(id);
  if (!category) return null;

  const productCount = await Product.countDocuments({
    categoryId: category._id,
    status: { $ne: "ARCHIVED" },
  });

  return {
    _id: category._id.toString(),
    name: category.name,
    slug: category.slug,
    description: category.description,
    status: category.status,
    productCount,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
  };
}

export async function createCategory(
  data: CreateCategoryInput,
  actor?: { id: string; name: string; ip?: string }
) {
  await connectDB();

  // Check duplicate category name (case-insensitive)
  const existing = await Category.findOne({
    name: { $regex: `^${data.name.trim()}$`, $options: "i" },
  });
  if (existing) {
    throw new Error(`Category with name "${data.name}" already exists.`);
  }

  const slug = slugify(data.name);
  const newCat = await Category.create({
    name: data.name.trim(),
    slug,
    description: data.description?.trim(),
    status: data.status,
  });

  if (actor) {
    await logAuditEvent({
      action: "CATEGORY_CREATED" as any,
      userId: actor.id,
      userName: actor.name,
      targetUserId: newCat._id.toString(),
      targetUserName: newCat.name,
      details: { name: newCat.name, slug },
      ipAddress: actor.ip,
    });
  }

  return {
    _id: newCat._id.toString(),
    name: newCat.name,
    slug: newCat.slug,
    description: newCat.description,
    status: newCat.status,
    productCount: 0,
    createdAt: newCat.createdAt.toISOString(),
    updatedAt: newCat.updatedAt.toISOString(),
  };
}

export async function updateCategory(
  id: string,
  data: UpdateCategoryInput,
  actor?: { id: string; name: string; ip?: string }
) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid Category ID");
  }
  await connectDB();

  const category = await Category.findById(id);
  if (!category) {
    throw new Error("Category not found");
  }

  if (data.name && data.name.trim() !== category.name) {
    const existing = await Category.findOne({
      _id: { $ne: id },
      name: { $regex: `^${data.name.trim()}$`, $options: "i" },
    });
    if (existing) {
      throw new Error(`Another category with name "${data.name}" already exists.`);
    }
    category.name = data.name.trim();
    category.slug = slugify(data.name);
  }

  if (data.description !== undefined) {
    category.description = data.description?.trim();
  }
  if (data.status !== undefined) {
    category.status = data.status;
  }

  await category.save();

  if (actor) {
    await logAuditEvent({
      action: "CATEGORY_UPDATED" as any,
      userId: actor.id,
      userName: actor.name,
      targetUserId: category._id.toString(),
      targetUserName: category.name,
      details: data as Record<string, unknown>,
      ipAddress: actor.ip,
    });
  }

  return getCategoryById(id);
}

export async function deleteCategory(
  id: string,
  actor?: { id: string; name: string; ip?: string }
) {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid Category ID");
  }
  await connectDB();

  const category = await Category.findById(id);
  if (!category) {
    throw new Error("Category not found");
  }

  // Prevent deletion when products are associated with the category
  const productCount = await Product.countDocuments({ categoryId: id });
  if (productCount > 0) {
    throw new Error(
      `Cannot delete category "${category.name}" because ${productCount} product(s) are associated with it. Please deactivate the category or reassign its products instead.`
    );
  }

  await Category.deleteOne({ _id: id });

  if (actor) {
    await logAuditEvent({
      action: "CATEGORY_DELETED" as any,
      userId: actor.id,
      userName: actor.name,
      targetUserId: category._id.toString(),
      targetUserName: category.name,
      details: { name: category.name },
      ipAddress: actor.ip,
    });
  }

  return { success: true };
}

