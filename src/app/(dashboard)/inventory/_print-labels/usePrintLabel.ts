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
import { normalizeLabelScancode } from "./scancode";

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

type PriceListItem = {
  productId?: string;
  variantId?: string;
  branchId?: string;
  sellingPrice?: unknown;
};

function priceListRowMatches(
  row: PriceListItem,
  productId: string,
  variantId: string,
  branchId: string
): boolean {
  if (String(row.branchId ?? "") !== String(branchId)) return false;
  if (String(row.productId ?? "") !== String(productId)) return false;
  const rowVariant = String(row.variantId ?? "");
  const wantVariant = String(variantId);
  if (rowVariant === wantVariant) return true;
  // Single-product rows in price list use variantId "0".
  return rowVariant === "0";
}

async function fetchSellingPrice(
  productId: string,
  variantId: string,
  branchId: string
): Promise<number | undefined> {
  if (!isUsableEntityId(variantId) || !isUsableEntityId(branchId)) return undefined;
  if (!isUsableEntityId(productId)) return undefined;
  try {
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages && page <= 50) {
      const qs = new URLSearchParams({
        branchId: String(branchId),
        page: String(page),
        limit: "100",
      });
      const res = await apiFetch<{
        items?: PriceListItem[];
        totalPages?: number;
      }>(`/products/price-list?${qs.toString()}`);
      const items = Array.isArray(res.items) ? res.items : [];
      const row = items.find((p) =>
        priceListRowMatches(p, productId, variantId, branchId)
      );
      if (row?.sellingPrice != null) {
        const n = Number(row.sellingPrice);
        if (Number.isFinite(n)) return n;
      }
      totalPages = Math.max(1, Number(res.totalPages) || 1);
      page += 1;
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
    printMode: "thermal",
    paperSize: "A4",
    thermalSize: "60x40",
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

  const addBatchToItems = useCallback(
    async (
      batch: ApiBatch,
      branchId: string,
      meta?: { productName?: string; variantLabel?: string }
    ) => {
    if (!isUsableEntityId(branchId) || !isUsableEntityId(batch.variantId)) return;
    const sellingPrice = await fetchSellingPrice(
      batch.productId,
      batch.variantId,
      branchId
    );
    const scancode = normalizeLabelScancode(
      String(batch.barcode || batch.batchNumber || "")
    );
    const newItem: LabelItem = {
      id: batch.id,
      batchId: batch.id,
      productId: batch.productId,
      variantId: batch.variantId,
      productName: meta?.productName || batch.product?.name || "",
      variant: meta?.variantLabel || batch.variant?.sku || "",
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
  },
  []);

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

  const refreshItemPrices = useCallback(async (branchId: string) => {
    if (!isUsableEntityId(branchId)) return;
    setLabelItems((prev) => {
      if (prev.length === 0) return prev;
      void (async () => {
        const updated = await Promise.all(
          prev.map(async (item) => {
            if (item.price != null) return item;
            const price = await fetchSellingPrice(
              item.productId,
              item.variantId,
              branchId
            );
            return price != null ? { ...item, price } : item;
          })
        );
        const changed = updated.some((item, index) => item.price !== prev[index]?.price);
        if (changed) setLabelItems(updated);
      })();
      return prev;
    });
  }, []);

  const reset = useCallback(() => {
    setSelectedProductId("");
    setSelectedVariantId("");
    setVariantBatches({});
    setLabelItems([]);
    setSettings({
      printMode: "thermal",
      paperSize: "A4",
      thermalSize: "60x40",
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
    refreshItemPrices,
    reset,
  };
}
