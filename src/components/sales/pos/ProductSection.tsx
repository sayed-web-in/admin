"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ProductCard, POSProduct } from "@/components/sales/pos/ProductCard";
import { ImeiSelectionModal } from "@/components/sales/pos/ImeiSelectionModal";
import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

interface ProductSectionProps {
  products: POSProduct[];
  cart: { storeProductId: number; serialNumbers?: string[] }[];
  search: string;
  onSearchChange: (value: string) => void;
  onAddToCart: (
    product: POSProduct,
    storeProductId?: number,
    serialNumbers?: string[],
    meta?: {
      batchNumber?: string;
      batchNumbers?: string[];
      serialBatchMap?: Record<string, string>;
    }
  ) => void;
}

export function ProductSection({
  products,
  cart,
  search,
  onSearchChange,
  onAddToCart,
}: ProductSectionProps) {
  const [imeiModalOpen, setImeiModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<POSProduct | null>(null);
  const [selectedStoreProductId, setSelectedStoreProductId] = useState<number | null>(null);
  const [availableSerials, setAvailableSerials] = useState<string[]>([]);
  const [serialBatchMap, setSerialBatchMap] = useState<Record<string, string>>({});
  const [imeiLoading, setImeiLoading] = useState(false);

  const cardRows = useMemo(
    () =>
      products.flatMap((product) =>
        (product.storeProducts || []).map((storeProduct) => ({
          product,
          storeProduct,
        }))
      ),
    [products]
  );

  const getVariantName = (storeProduct: POSProduct["storeProducts"][number]) =>
    storeProduct.productVariant?.attributes
      ?.map((a) => a?.attributeValue?.value)
      .filter((v): v is string => Boolean(v && v.trim()))
      .join(" + ") || "";

  const tryAddByEnter = async () => {
    const query = search.trim();
    if (!query) return;
    const exact = query.toLowerCase();

    // 1) Exact IMEI/serial match (same pattern as seller admin: prioritize IMEI)
    try {
      const serialHit = await apiFetch<{
        serial?: string;
        status?: string;
        batch?: { storeProduct?: { id?: number; productId?: number } };
      }>(`/sales/serial/${encodeURIComponent(query)}`);

      const serialStatus = String(serialHit?.status ?? "").toUpperCase();
      const storeProductId = Number(serialHit?.batch?.storeProduct?.id ?? 0);
      const productId = Number(serialHit?.batch?.storeProduct?.productId ?? 0);

      if (storeProductId > 0 && productId > 0 && serialStatus !== "SOLD") {
        const matchedProduct = products.find((p) => p.id === productId);
        if (matchedProduct) {
          onAddToCart(matchedProduct, storeProductId, [query]);
          onSearchChange("");
          return;
        }
      }
    } catch {
      // Ignore and continue to SKU fallback
    }

    // 2) Exact SKU match for non-IMEI flow
    const skuMatches = cardRows.filter(({ product, storeProduct }) => {
      const variantSku = String(storeProduct.productVariant?.sku || "").toLowerCase();
      const productSku = String(product.sku || "").toLowerCase();
      return variantSku === exact || productSku === exact;
    });

    if (skuMatches.length === 1) {
      const hit = skuMatches[0];
      await handleProductClick(hit.product, hit.storeProduct.id);
      onSearchChange("");
      return;
    }

    if (skuMatches.length > 1) {
      toast.error("Multiple exact SKU matches found. Select product manually.");
      return;
    }

    toast.error("No exact IMEI or SKU match found.");
  };

  const handleProductClick = async (product: POSProduct, storeProductId: number) => {
    if (product.hasImei) {
      setSelectedProduct(product);
      setSelectedStoreProductId(storeProductId);
      setImeiLoading(true);
      setImeiModalOpen(true);

      try {
        const alreadyInCart = new Set(
          cart
            .filter((item) => item.storeProductId === storeProductId)
            .flatMap((item) => item.serialNumbers ?? [])
            .map((s) => String(s).trim())
            .filter(Boolean)
        );
        const res = await apiFetch<
          | { batches?: Array<{ serialNumbers?: Array<{ serial?: string; status?: string }> }> }
          | { data?: { batches?: Array<{ serialNumbers?: Array<{ serial?: string; status?: string }> }> } }
        >(`/products/store/${storeProductId}/batches`);
        const batches = Array.isArray((res as { batches?: unknown[] })?.batches)
          ? ((res as { batches?: Array<{ serialNumbers?: Array<{ serial?: string; status?: string }> }> }).batches ?? [])
          : Array.isArray((res as { data?: { batches?: unknown[] } })?.data?.batches)
            ? ((res as { data?: { batches?: Array<{ serialNumbers?: Array<{ serial?: string; status?: string }> }> } }).data?.batches ?? [])
            : [];
        const nextSerialBatchMap: Record<string, string> = {};
        const serials = batches.flatMap((batch) => {
          const batchSerials = Array.isArray(batch.serialNumbers) ? batch.serialNumbers : [];
          const batchLabel = String(
            (batch as unknown as { batchNumber?: string }).batchNumber ?? ""
          ).trim();
          return batchSerials
            .filter((s) => s?.serial && String(s.status || "").toUpperCase() !== "SOLD")
            .map((s) => String(s.serial).trim())
            .filter((serial) => {
              const ok = Boolean(serial) && !alreadyInCart.has(serial);
              if (ok && batchLabel) nextSerialBatchMap[serial] = batchLabel;
              return ok;
            });
        });
        setSerialBatchMap(nextSerialBatchMap);
        setAvailableSerials(Array.from(new Set(serials)));
      } catch {
        setAvailableSerials([]);
        setSerialBatchMap({});
      } finally {
        setImeiLoading(false);
      }
      return;
    }
    try {
      const res = await apiFetch<
        | { batches?: Array<{ batchNumber?: string; availableQty?: number }> }
        | { data?: { batches?: Array<{ batchNumber?: string; availableQty?: number }> } }
      >(`/products/store/${storeProductId}/batches`);

      const batches = Array.isArray((res as { batches?: unknown[] })?.batches)
        ? ((res as { batches?: Array<{ batchNumber?: string; availableQty?: number }> }).batches ?? [])
        : Array.isArray((res as { data?: { batches?: unknown[] } })?.data?.batches)
          ? ((res as { data?: { batches?: Array<{ batchNumber?: string; availableQty?: number }> } }).data?.batches ?? [])
          : [];

      const usableBatchNumbers = batches
        .filter((b) => Number(b.availableQty ?? 0) > 0 && String(b.batchNumber ?? "").trim())
        .map((b) => String(b.batchNumber).trim());

      onAddToCart(product, storeProductId, undefined, {
        batchNumber: usableBatchNumbers[0],
        batchNumbers: usableBatchNumbers.length > 0 ? [usableBatchNumbers[0]] : undefined,
      });
    } catch {
      onAddToCart(product, storeProductId);
    }
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
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void tryAddByEnter();
                }
              }}
              className="pl-9 bg-white border-slate-300 text-slate-900"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 min-h-0">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 lg:gap-4">
            {cardRows.map(({ product, storeProduct }) => (
              <ProductCard
                key={`${product.id}-${storeProduct.id}`}
                product={product}
                storeProduct={storeProduct}
                onAdd={handleProductClick}
              />
            ))}
            {cardRows.length === 0 && (
              <div className="col-span-full text-center py-12 text-slate-500 text-sm">
                No products found
              </div>
            )}
          </div>
        </div>
      </div>
      <ImeiSelectionModal
        open={imeiModalOpen}
        productName={selectedProduct?.name || ""}
        variantName={
          selectedProduct && selectedStoreProductId
            ? getVariantName(
                selectedProduct.storeProducts.find((s) => s.id === selectedStoreProductId) ||
                  selectedProduct.storeProducts[0]
              )
            : ""
        }
        serials={availableSerials}
        loading={imeiLoading}
        onOpenChange={(open) => {
          setImeiModalOpen(open);
          if (!open) {
            setSelectedProduct(null);
            setSelectedStoreProductId(null);
            setAvailableSerials([]);
            setSerialBatchMap({});
          }
        }}
        onConfirm={(serials) => {
          if (!selectedProduct || !selectedStoreProductId) return;
          const selectedBatchNumbers = Array.from(
            new Set(
              serials
                .map((serial) => serialBatchMap[serial])
                .filter((batch): batch is string => Boolean(batch && batch.trim()))
            )
          );
          onAddToCart(selectedProduct, selectedStoreProductId, serials, {
            batchNumber: selectedBatchNumbers[0],
            batchNumbers: selectedBatchNumbers,
            serialBatchMap,
          });
          setImeiModalOpen(false);
          setSelectedProduct(null);
          setSelectedStoreProductId(null);
          setAvailableSerials([]);
          setSerialBatchMap({});
        }}
      />
    </>
  );
}
