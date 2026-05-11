"use client";

import { useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import type { LabelItem, LabelSettings } from "./types";
import { parseApiList } from "./parseApiList";
import { isUsableEntityId } from "./entityIds";
import {
  looksLikeLegacyNumericIds,
  mapLegacyBatchToApi,
  resolveLegacyStoreProductId,
  type LegacyBatchRow,
} from "./legacyBatches";

type ApiBatch = {
  id: string;
  batchNumber: string;
  barcode?: string | null;
  productId: string;
  variantId: string;
  availableQuantity?: number;
  product?: { name?: string };
  variant?: { sku?: string };
};

async function fetchSellingPrice(
  variantId: string,
  branchId: string
): Promise<number | undefined> {
  if (!isUsableEntityId(variantId) || !isUsableEntityId(branchId)) return undefined;
  try {
    const pricesData = await apiFetch<unknown>(
      `/product-prices?variantId=${encodeURIComponent(variantId)}&branchId=${encodeURIComponent(branchId)}`
    );
    const prices = parseApiList<{
      variantId?: string;
      branchId?: string;
      sellingPrice?: unknown;
    }>(pricesData);
    const row =
      prices.find((p) => p.variantId === variantId && p.branchId === branchId) ||
      prices.find((p) => p.variantId === variantId);
    if (row && row.sellingPrice != null) {
      const n = Number(row.sellingPrice);
      return Number.isFinite(n) ? n : undefined;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

export function usePrintLabel() {
  const [selectedBranchId, setSelectedBranchId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [variantBatches, setVariantBatches] = useState<Record<string, ApiBatch[]>>({});
  const [labelItems, setLabelItems] = useState<LabelItem[]>([]);
  const [settings, setSettings] = useState<LabelSettings>({
    paperSize: "A4",
    showStoreName: true,
    showBatch: true,
    showProductName: true,
    showVariant: true,
    showPrice: true,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBatchesForVariant = useCallback(
    async (productId: string, variantId: string, branchId: string) => {
      const pid = String(productId ?? "").trim();
      const vid = String(variantId ?? "").trim();
      const bid = String(branchId ?? "").trim();
      if (!isUsableEntityId(pid) || !isUsableEntityId(vid) || !isUsableEntityId(bid)) {
        return;
      }
      setLoading(true);
      setError(null);
      try {
        let batches: ApiBatch[] = [];

        if (looksLikeLegacyNumericIds(pid, vid, bid)) {
          const storeProductId = await resolveLegacyStoreProductId(pid, vid, bid);
          if (!storeProductId) {
            setError(
              "No store listing found for this product and variant in this branch."
            );
            setVariantBatches((prev) => ({ ...prev, [vid]: [] }));
            return;
          }
          const res = await apiFetch<{ batches?: LegacyBatchRow[] }>(
            `/products/store/${storeProductId}/batches`
          );
          const raw = Array.isArray(res.batches) ? res.batches : [];
          batches = raw.map((b) => mapLegacyBatchToApi(b, pid, vid));
        } else {
          const qs = new URLSearchParams({
            productId: pid,
            variantId: vid,
            branchId: bid,
          });
          const data = await apiFetch<unknown>(`/batches?${qs.toString()}`);
          batches = parseApiList<ApiBatch>(data);
        }

        setVariantBatches((prev) => ({ ...prev, [vid]: batches }));
      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : "Failed to fetch batches");
        setVariantBatches((prev) => ({ ...prev, [vid]: [] }));
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const addBatchToItems = useCallback(async (batch: ApiBatch, branchId: string) => {
    if (!isUsableEntityId(branchId) || !isUsableEntityId(batch.variantId)) return;
    const sellingPrice = await fetchSellingPrice(batch.variantId, branchId);
    const scancode = String(batch.barcode || batch.batchNumber || "").trim();
    const newItem: LabelItem = {
      id: batch.id,
      batchId: batch.id,
      productId: batch.productId,
      variantId: batch.variantId,
      productName: batch.product?.name || "",
      variant: batch.variant?.sku || "",
      batchNumber: batch.batchNumber,
      scancode,
      quantity: 1,
      price: sellingPrice,
      selected: true,
    };

    setLabelItems((prev) => {
      if (prev.some((item) => item.batchId === batch.id)) return prev;
      return [...prev, newItem];
    });
  }, []);

  const updateSettings = useCallback((partial: Partial<LabelSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const toggleItemSelection = useCallback((itemId: string) => {
    setLabelItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, selected: !item.selected } : item
      )
    );
  }, []);

  const selectAllItems = useCallback(() => {
    setLabelItems((prev) => prev.map((item) => ({ ...item, selected: true })));
  }, []);

  const updateItemQuantity = useCallback((itemId: string, quantity: number) => {
    setLabelItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, quantity: Math.max(1, quantity) } : item
      )
    );
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setLabelItems((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const reset = useCallback(() => {
    setSelectedProductId("");
    setSelectedVariantId("");
    setVariantBatches({});
    setLabelItems([]);
    setSettings({
      paperSize: "A4",
      showStoreName: true,
      showBatch: true,
      showProductName: true,
      showVariant: true,
      showPrice: true,
    });
  }, []);

  return {
    selectedBranchId,
    setSelectedBranchId,
    selectedProductId,
    setSelectedProductId,
    selectedVariantId,
    setSelectedVariantId,
    variantBatches,
    labelItems,
    settings,
    loading,
    error,
    fetchBatchesForVariant,
    addBatchToItems,
    updateSettings,
    toggleItemSelection,
    updateItemQuantity,
    selectAllItems,
    removeItem,
    reset,
  };
}
