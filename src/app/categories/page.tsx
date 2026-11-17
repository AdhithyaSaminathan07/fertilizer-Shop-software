"use client";

import * as React from "react";
import { CategoryManager } from "@/components/settings/category-manager";

export default function CategoriesPage() {
  return (
    <div className="max-w-5xl mx-auto py-4">
      <CategoryManager />
    </div>
  );
}
