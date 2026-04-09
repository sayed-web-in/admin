"use client";

import { PageHeader } from "@/components/common/PageHeader";
import { ProductForm } from "@/components/inventory/ProductForm";

export default function AddProductPage() {
  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Add Product"
        description="Create a new product and optionally add it to a store"
      />
      <ProductForm />
    </div>
  );
}
