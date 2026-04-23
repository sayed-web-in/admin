"use client";

import Image from "next/image";
import { Package } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { resolveMediaUrl } from "@/lib/media";

export interface POSProduct {
  id: number;
  name: string;
  sku?: string;
  images: { url: string }[];
  sellerBrand?: { name?: string };
  brand?: { name?: string };
  storeProducts: {
    id: number;
    sellingPrice: number;
    quantity: number;
    discountType?: "fixed" | "percentage" | "FIXED" | "PERCENTAGE";
    discountValue?: number;
    productVariant?: {
      sku?: string;
      image?: string;
      attributes?: { attributeValue?: { value?: string } }[];
    };
  }[];
  hasImei?: boolean;
}

interface ProductCardProps {
  product: POSProduct;
  storeProduct: POSProduct["storeProducts"][number];
  onAdd: (product: POSProduct, storeProductId: number) => void;
}

export function ProductCard({ product, storeProduct, onAdd }: ProductCardProps) {
  const stockQuantity = Number(storeProduct?.quantity || 0);
  const isOutOfStock = stockQuantity <= 0;
  const sellingPrice = Number(storeProduct?.sellingPrice || 0);
  const discountType = String(storeProduct?.discountType || "").toLowerCase();
  const discountValue = Number(storeProduct?.discountValue || 0);

  let finalPrice = sellingPrice;
  if (discountType === "percentage" && discountValue > 0) {
    finalPrice = sellingPrice - (sellingPrice * discountValue) / 100;
  } else if (discountType === "fixed" && discountValue > 0) {
    finalPrice = sellingPrice - discountValue;
  }
  finalPrice = Math.max(0, finalPrice);

  const variantName =
    storeProduct?.productVariant?.attributes
      ?.map((a) => a?.attributeValue?.value)
      .filter((v): v is string => Boolean(v && v.trim()))
      .join(" + ") || "";

  const productImage = storeProduct?.productVariant?.image
    ? resolveMediaUrl(storeProduct.productVariant.image)
    : product.images?.[0]?.url
      ? resolveMediaUrl(product.images[0].url)
      : "";
  const brandName = product.sellerBrand?.name || product.brand?.name || "";

  return (
    <button
      onClick={() => !isOutOfStock && onAdd(product, storeProduct.id)}
      className={`p-2.5 lg:p-4 rounded-xl border border-slate-200 bg-white shadow-md transition-all text-left ${
        isOutOfStock ? "opacity-60 cursor-not-allowed" : "hover:shadow-lg"
      }`}
    >
      <div className="relative w-full aspect-square lg:h-48 lg:aspect-auto mb-2 lg:mb-3 rounded-lg overflow-hidden bg-slate-100">
        {productImage ? (
          <Image
            src={productImage}
            alt={product.name}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 lg:w-16 lg:h-16 text-slate-400" />
          </div>
        )}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <span className="text-white font-semibold">Out of Stock</span>
          </div>
        )}
      </div>

      <div className="space-y-1.5 lg:space-y-2">
        <div>
          {brandName && (
            <p className="text-[9px] lg:text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-0.5 lg:mb-1 opacity-80 truncate">
              {brandName}
            </p>
          )}
          <h3 className="text-sm lg:text-base font-semibold text-slate-900 line-clamp-1">
            {product.name}
          </h3>
          {variantName && (
            <p className="text-[10px] lg:text-xs text-slate-600 mt-0.5 truncate">
              ({variantName})
            </p>
          )}
        </div>

        <div className="pt-1.5 lg:pt-2 border-t border-slate-200">
          <div className="flex items-center justify-between gap-1">
            <div className="min-w-0">
              <div className="text-sm lg:text-lg font-bold text-slate-900">
                {formatPrice(finalPrice)}
              </div>
              {discountValue > 0 && (
                <div className="text-[10px] lg:text-sm text-slate-500 line-through">
                  {formatPrice(sellingPrice)}
                </div>
              )}
            </div>

            <div
              className={`px-1.5 lg:px-2 py-0.5 lg:py-1 rounded text-[10px] lg:text-xs font-medium shrink-0 ${
                stockQuantity > 10
                  ? "bg-green-100 text-green-700"
                  : stockQuantity > 0
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
              }`}
            >
              <span className="lg:hidden">{stockQuantity}</span>
              <span className="hidden lg:inline">Stock: {stockQuantity}</span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
