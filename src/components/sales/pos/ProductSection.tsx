"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ProductCard, POSProduct } from "@/components/sales/pos/ProductCard";
import { ProductVariantSelectionModal } from "@/components/sales/pos/ProductVariantSelectionModal";
import { useState } from "react";

interface ProductSectionProps {
  products: POSProduct[];
  search: string;
  onSearchChange: (value: string) => void;
  onAddToCart: (product: POSProduct, storeProductId?: number) => void;
}

export function ProductSection({
  products,
  search,
  onSearchChange,
  onAddToCart,
}: ProductSectionProps) {
  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<POSProduct | null>(null);

  const handleProductClick = (product: POSProduct) => {
    if ((product.storeProducts?.length || 0) > 1) {
      setSelectedProduct(product);
      setVariantModalOpen(true);
      return;
    }
    onAddToCart(product);
  };

  const handleSelectVariant = (storeProductId: number) => {
    if (!selectedProduct) return;
    onAddToCart(selectedProduct, storeProductId);
    setVariantModalOpen(false);
    setSelectedProduct(null);
  };

  return (
    <>
      <div className="h-full flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex-shrink-0 bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 bg-white border-slate-300 text-slate-900"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 min-h-0">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} onAdd={handleProductClick} />
            ))}
            {products.length === 0 && (
              <div className="col-span-full text-center py-12 text-slate-500 text-sm">
                No products found
              </div>
            )}
          </div>
        </div>
      </div>
      <ProductVariantSelectionModal
        open={variantModalOpen}
        product={selectedProduct}
        onOpenChange={(open) => {
          setVariantModalOpen(open);
          if (!open) setSelectedProduct(null);
        }}
        onSelectVariant={handleSelectVariant}
      />
    </>
  );
}
