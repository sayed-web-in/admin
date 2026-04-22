"use client";

import Image from "next/image";
import { Package } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
import type { POSProduct } from "@/components/sales/pos/ProductCard";

type POSStoreProduct = POSProduct["storeProducts"][number];

interface ProductVariantSelectionModalProps {
  open: boolean;
  product: POSProduct | null;
  onOpenChange: (open: boolean) => void;
  onSelectVariant: (storeProductId: number) => void;
}

function getVariantName(storeProduct: POSStoreProduct) {
  return (
    storeProduct.productVariant?.attributes
      ?.map((a) => a?.attributeValue?.value)
      .filter((v): v is string => Boolean(v && v.trim()))
      .join(" + ") || "Default"
  );
}

export function ProductVariantSelectionModal({
  open,
  product,
  onOpenChange,
  onSelectVariant,
}: ProductVariantSelectionModalProps) {
  if (!product) return null;

  const imageUrl = product.images?.[0]?.url;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Select Variant"
      description={`Choose a variant for ${product.name}`}
      className="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 bg-slate-50">
          <div className="relative h-14 w-14 rounded-md overflow-hidden bg-white border border-slate-200 shrink-0">
            {imageUrl ? (
              <Image src={imageUrl} alt={product.name} fill className="object-cover" unoptimized />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Package className="w-6 h-6 text-slate-400" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{product.name}</p>
            <p className="text-xs text-slate-500">
              {product.storeProducts.length} variant{product.storeProducts.length > 1 ? "s" : ""}
            </p>
          </div>
        </div>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {product.storeProducts.map((sp) => {
            const stock = Number(sp.quantity || 0);
            const variantName = getVariantName(sp);
            return (
              <div
                key={sp.id}
                className="rounded-lg border border-slate-200 bg-white p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{variantName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Stock: {stock}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <p className="text-sm font-bold text-primary">{formatPrice(Number(sp.sellingPrice || 0))}</p>
                  <Button
                    size="sm"
                    onClick={() => onSelectVariant(sp.id)}
                    disabled={stock <= 0}
                  >
                    {stock > 0 ? "Add" : "Out"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}
