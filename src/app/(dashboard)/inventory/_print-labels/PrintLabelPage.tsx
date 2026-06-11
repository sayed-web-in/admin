"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Barcode,
  CheckSquare,
  FileText,
  QrCode,
  RotateCcw,
  Square,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { extractBranches } from "@/lib/apiList";
import { cn, formatAmountDecimal } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/common/DataTable";
import { Switch } from "@/components/ui/switch";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { INVENTORY_CARD_SHELL } from "@/components/inventory/InventoryCrudLayout";
import { usePrintLabel } from "./usePrintLabel";
import { buildLabelPreview } from "./preview";
import { printBarcodeSheet } from "./barcodePrint";
import { printQrSheet } from "./qrPrint";
import {
  getBarcodeRenderOptions,
  getJsBarcodeOptions,
  getQrRenderSize,
  resolveLabelDimensions,
  THERMAL_LABEL_PRESETS,
} from "./labelLayout";
import type {
  LabelItem,
  PrintLabelKind,
  PrintMode,
  SheetPaperSize,
  ThermalLabelSize,
} from "./types";
import { isUsableEntityId } from "./entityIds";

declare global {
  interface Window {
    JsBarcode?: (el: Element, text: string, opts?: Record<string, unknown>) => void;
    QRCode?: new (
      el: HTMLElement,
      opts: {
        text: string;
        width: number;
        height: number;
        colorDark: string;
        colorLight: string;
        correctLevel?: number;
      }
    ) => void;
  }
}

type ComboOption = { value: string; label: string };

function itemEqual(a: ComboOption, b: ComboOption) {
  return a.value === b.value;
}

interface ProductRow {
  id: string;
  name: string;
  status?: string;
  productType?: string;
  variants?: VariantRow[];
}

interface VariantRow {
  id: string;
  branchId?: string | null;
  sku: string;
  stockQuantity?: number;
  attributes?: Array<{
    name?: string;
    value?: string;
    attribute?: { name?: string };
    attributeValue?: { value?: string; displayName?: string };
  }>;
}

type ApiBatch = {
  id: string;
  batchNumber: string;
  barcode?: string | null;
  availableQuantity?: number;
};

function formatVariantDisplay(variant: VariantRow): string {
  const attrs = variant.attributes;
  if (Array.isArray(attrs) && attrs.length > 0) {
    const parts = attrs.map((attr) => {
      const name = (attr.name || attr.attribute?.name || "").trim();
      const value =
        attr.value ||
        attr.attributeValue?.value ||
        attr.attributeValue?.displayName ||
        "";
      if (!name) return value.trim();
      return `${name}: ${value}`.trim();
    });
    const joined = parts.filter(Boolean).join(", ");
    if (joined) return joined;
  }
  return variant.sku || "—";
}

function normalizeProductType(t: string | undefined): "single" | "variable" | "other" {
  const s = String(t || "").toLowerCase();
  if (s === "single") return "single";
  if (s === "variable") return "variable";
  return "other";
}

/** Price-list rows include every variant in branch (fixes single products missing from GET /products branch-variant filter). */
type PriceListMergeRow = {
  productId: string;
  variantId: string;
  productName: string;
  productType: string;
  sku: string;
  variantDisplay: string;
  branchId: string;
};

function mergePrintCatalog(
  apiProducts: ProductRow[],
  priceRows: PriceListMergeRow[],
  branchId: string
): ProductRow[] {
  const map = new Map<string, ProductRow>();
  const pushVariant = (p: ProductRow, v: VariantRow) => {
    const list = p.variants || (p.variants = []);
    if (!list.some((x) => String(x.id) === String(v.id))) list.push(v);
  };

  for (const p of apiProducts) {
    if (String(p.status ?? "").toLowerCase() !== "active") continue;
    const id = String(p.id);
    map.set(id, {
      ...p,
      id,
      variants: [...(p.variants || [])]
        .filter((v) => isUsableEntityId(v.id))
        .map((v) => ({
          ...v,
          id: String(v.id),
          branchId: v.branchId != null ? String(v.branchId) : v.branchId,
        })),
    });
  }

  for (const row of priceRows) {
    if (String(row.branchId) !== String(branchId)) continue;
    if (!isUsableEntityId(row.productId) || !isUsableEntityId(row.variantId)) continue;
    const pid = String(row.productId);
    const synthetic: VariantRow = {
      id: String(row.variantId),
      branchId: String(branchId),
      sku: row.sku || "—",
      attributes: row.variantDisplay
        ? [{ name: "", value: row.variantDisplay, attribute: { name: "" } }]
        : [],
    };
    const existing = map.get(pid);
    if (!existing) {
      map.set(pid, {
        id: pid,
        name: row.productName,
        productType: row.productType,
        status: "active",
        variants: [synthetic],
      });
    } else {
      pushVariant(existing, synthetic);
    }
  }

  return Array.from(map.values());
}

export function PrintLabelPage({
  kind,
  title,
  description,
  icon: Icon,
}: {
  kind: PrintLabelKind;
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  const {
    selectedBranchId,
    setSelectedBranchId,
    selectedProductId,
    setSelectedProductId,
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
  } = usePrintLabel();

  const [branches, setBranches] = useState<Array<{ id: string; name: string; storeType?: string }>>(
    []
  );
  /** Merged from GET /products + GET /products/price-list so single-type products in branch still appear. */
  const [catalogProducts, setCatalogProducts] = useState<ProductRow[]>([]);
  const [selectedStoreName, setSelectedStoreName] = useState("");
  const [libLoaded, setLibLoaded] = useState(false);
  /** For variable products with 2+ variants — user picks before batch. */
  const [selectedVariantIdForPrint, setSelectedVariantIdForPrint] = useState("");
  const [batchComboNonce, setBatchComboNonce] = useState(0);

  useEffect(() => {
    void (async () => {
      try {
        const raw = await apiFetch<unknown>("/branches");
        const list = extractBranches(raw);
        setBranches(
          list.map((b) => ({
            id: String((b as { id: unknown }).id),
            name: String((b as { name?: string }).name ?? ""),
            storeType: (b as { storeType?: string }).storeType,
          }))
        );
      } catch {
        setBranches([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (kind === "barcode") {
      if (window.JsBarcode) {
        queueMicrotask(() => setLibLoaded(true));
        return;
      }
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js";
      script.onload = () => setLibLoaded(true);
      document.head.appendChild(script);
      return;
    }
    if (window.QRCode) {
      queueMicrotask(() => setLibLoaded(true));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    script.onload = () => setLibLoaded(true);
    document.head.appendChild(script);
  }, [kind]);

  useEffect(() => {
    if (!selectedBranchId) {
      queueMicrotask(() => setCatalogProducts([]));
      return;
    }
    let cancelled = false;
    void (async () => {
      const branchId = selectedBranchId;
      try {
        const qs = new URLSearchParams({
          page: "1",
          limit: "1000",
          branchId,
        });
        const res = await apiFetch<{
          products?: ProductRow[];
          data?: ProductRow[];
        }>(`/products?${qs.toString()}`);
        const raw = res.products ?? res.data ?? [];
        const apiList = (Array.isArray(raw) ? raw : []).filter(
          (p) => String(p.status || "").toLowerCase() === "active"
        );

        const priceRows: PriceListMergeRow[] = [];
        try {
          let page = 1;
          let totalPages = 1;
          do {
            const pqs = new URLSearchParams({
              branchId,
              page: String(page),
              limit: "100",
            });
            const pl = await apiFetch<{
              items?: PriceListMergeRow[];
              totalPages?: number;
            }>(`/products/price-list?${pqs.toString()}`);
            priceRows.push(...(Array.isArray(pl.items) ? pl.items : []));
            totalPages = Math.max(1, Number(pl.totalPages) || 1);
            page += 1;
            if (page > 200) break;
          } while (page <= totalPages);
        } catch {
          /* Price list permission or network — still use /products only */
        }

        if (cancelled) return;
        setCatalogProducts(mergePrintCatalog(apiList, priceRows, branchId));
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setCatalogProducts([]);
          toast.error("Failed to load products");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedBranchId]);

  const selectedProduct = useMemo(
    () => catalogProducts.find((p) => p.id === selectedProductId),
    [catalogProducts, selectedProductId]
  );

  const productVariants = useMemo(() => {
    const raw =
      selectedProduct?.variants && Array.isArray(selectedProduct.variants)
        ? selectedProduct.variants
        : [];
    return raw.filter((v) => isUsableEntityId(v.id));
  }, [selectedProduct]);

  const productsWithStock = useMemo(() => {
    if (!selectedBranchId) return [];
    return catalogProducts.filter((p) => {
      const vars = p.variants && Array.isArray(p.variants) ? p.variants : [];
      return vars.some((v) => isUsableEntityId(v.id));
    });
  }, [catalogProducts, selectedBranchId]);

  const productItems: ComboOption[] = useMemo(
    () => productsWithStock.map((p) => ({ value: p.id, label: p.name })),
    [productsWithStock]
  );
  const selectedProductItem =
    productItems.find((i) => i.value === selectedProductId) ?? null;

  /** Single (or variable with one variant): auto-pick variant. Variable with many: user must choose variant. */
  useEffect(() => {
    if (!selectedProduct) {
      queueMicrotask(() => setSelectedVariantIdForPrint(""));
      return;
    }
    const vs = selectedProduct.variants || [];
    const pt = normalizeProductType(selectedProduct.productType);
    if (pt !== "variable" || vs.length <= 1) {
      const firstId = vs[0]?.id;
      queueMicrotask(() =>
        setSelectedVariantIdForPrint(isUsableEntityId(firstId) ? String(firstId) : "")
      );
    } else {
      queueMicrotask(() => setSelectedVariantIdForPrint(""));
    }
  }, [selectedProductId, selectedProduct]);

  useEffect(() => {
    if (
      !isUsableEntityId(selectedProductId) ||
      !isUsableEntityId(selectedVariantIdForPrint) ||
      !isUsableEntityId(selectedBranchId)
    ) {
      return;
    }
    void fetchBatchesForVariant(
      selectedProductId,
      selectedVariantIdForPrint,
      selectedBranchId
    );
  }, [
    selectedProductId,
    selectedVariantIdForPrint,
    selectedBranchId,
    fetchBatchesForVariant,
  ]);

  const preview = useMemo(
    () => buildLabelPreview(kind, labelItems, settings, selectedStoreName),
    [kind, labelItems, settings, selectedStoreName]
  );

  const priceRefreshKeyRef = useRef("");

  useEffect(() => {
    if (!settings.showPrice || !isUsableEntityId(selectedBranchId)) return;
    if (!labelItems.some((item) => item.price == null)) return;
    const refreshKey = `${selectedBranchId}:${labelItems.map((item) => item.batchId).join(",")}`;
    if (priceRefreshKeyRef.current === refreshKey) return;
    priceRefreshKeyRef.current = refreshKey;
    void refreshItemPrices(selectedBranchId);
  }, [settings.showPrice, selectedBranchId, labelItems, refreshItemPrices]);

  const labelDims = useMemo(() => resolveLabelDimensions(settings), [settings]);
  const previewQrSize = useMemo(() => getQrRenderSize(settings), [settings]);
  const previewRender = useMemo(
    () =>
      labelDims.isThermal ? getBarcodeRenderOptions(labelDims.heightMm) : null,
    [labelDims]
  );

  useEffect(() => {
    if (!libLoaded || preview.items.length === 0) return;

    if (kind === "barcode") {
      preview.items.slice(0, 8).forEach((_, index) => {
        const el = document.getElementById(`barcode-${index}`);
        if (el) el.innerHTML = "";
      });
      const t = window.setTimeout(() => {
        preview.items.slice(0, 8).forEach((item, index) => {
          const svg = document.getElementById(`barcode-${index}`);
          if (svg && window.JsBarcode) {
            try {
              window.JsBarcode(svg, item.scancode, {
                ...getJsBarcodeOptions(settings, item.scancode),
                lineColor: "#000000",
                background: "#ffffff",
              });
            } catch (err) {
              console.error(err);
            }
          }
        });
      }, 100);
      return () => window.clearTimeout(t);
    }

    preview.items.slice(0, 8).forEach((_, index) => {
      const el = document.getElementById(`qrcode-${index}`);
      if (el) el.innerHTML = "";
    });
    const t = window.setTimeout(() => {
      preview.items.slice(0, 8).forEach((item, index) => {
        const el = document.getElementById(`qrcode-${index}`);
        if (el && window.QRCode) {
          try {
            const QR = window.QRCode as unknown as new (
              el: HTMLElement,
              opts: Record<string, unknown>
            ) => void;
            new QR(el, {
              text: item.scancode,
              width: previewQrSize,
              height: previewQrSize,
              colorDark: "#000000",
              colorLight: "#ffffff",
              correctLevel: 2,
            });
          } catch (err) {
            console.error(err);
          }
        }
      });
    }, 100);
    return () => window.clearTimeout(t);
  }, [libLoaded, preview.items, kind, settings, previewQrSize]);

  const handleBranchChange = (branchId: string) => {
    setSelectedBranchId(branchId);
    const b = branches.find((x) => x.id === branchId);
    setSelectedStoreName(b?.name || "");
    setSelectedProductId("");
    setSelectedVariantIdForPrint("");
    setBatchComboNonce((n) => n + 1);
  };

  const handleBatchSelect = useCallback(
    async (batchId: string) => {
      if (
        !isUsableEntityId(selectedVariantIdForPrint) ||
        !isUsableEntityId(selectedBranchId) ||
        !isUsableEntityId(batchId)
      ) {
        return;
      }
      const batches = (variantBatches[selectedVariantIdForPrint] || []) as ApiBatch[];
      const batch = batches.find((x) => x.id === batchId);
      if (!batch) return;
      const code = String(batch.barcode || batch.batchNumber || "").trim();
      if (!code) {
        toast.error("This batch has no barcode / code to print");
        return;
      }
      await addBatchToItems(batch as never, selectedBranchId);
      setBatchComboNonce((n) => n + 1);
    },
    [variantBatches, selectedBranchId, addBatchToItems, selectedVariantIdForPrint]
  );

  const handlePrint = () => {
    if (preview.items.length === 0) {
      toast.error("Select items and set quantity, or press Generate first");
      return;
    }
    if (kind === "barcode") printBarcodeSheet(preview);
    else printQrSheet(preview);
  };

  const codeColumnLabel = kind === "barcode" ? "Barcode" : "QR payload";

  const variantKind = useMemo(
    () => normalizeProductType(selectedProduct?.productType),
    [selectedProduct?.productType]
  );

  const variantComboItems: ComboOption[] = useMemo(
    () =>
      productVariants.map((v) => ({
        value: String(v.id),
        label: formatVariantDisplay(v),
      })),
    [productVariants]
  );

  const selectedVariantComboItem =
    variantComboItems.find((i) => i.value === selectedVariantIdForPrint) ?? null;

  const batchComboItems: ComboOption[] = useMemo(() => {
    const all = (variantBatches[selectedVariantIdForPrint] || []) as ApiBatch[];
    return all
      .filter((b) => (b.availableQuantity ?? 0) > 0)
      .map((batch) => ({
        value: batch.id,
        label: `${batch.batchNumber}${batch.barcode ? ` (${batch.barcode})` : ""} — Qty: ${batch.availableQuantity ?? 0}`,
      }));
  }, [variantBatches, selectedVariantIdForPrint]);

  const showVariantStep =
    variantKind === "variable" && productVariants.length > 1;

  const itemColumns = useMemo(
    () => [
      {
        key: "sel",
        label: "",
        className: "w-12",
        render: (item: LabelItem) => (
          <button
            type="button"
            onClick={() => toggleItemSelection(item.id)}
            className="text-primary hover:opacity-80"
            title={item.selected ? "Deselect" : "Select"}
          >
            {item.selected ? (
              <CheckSquare className="size-5" />
            ) : (
              <Square className="size-5" />
            )}
          </button>
        ),
      },
      { key: "productName", label: "Product name" },
      { key: "variant", label: "Variant" },
      { key: "batchNumber", label: "Batch no" },
      {
        key: "scancode",
        label: codeColumnLabel,
        render: (item: LabelItem) => (
          <span className="font-mono text-xs">{item.scancode}</span>
        ),
      },
      {
        key: "quantity",
        label: "Quantity",
        className: "w-28",
        render: (item: LabelItem) => (
          <Input
            type="number"
            min={1}
            className="h-8 w-20 text-center"
            value={item.quantity}
            onChange={(e) =>
              updateItemQuantity(item.id, parseInt(e.target.value, 10) || 1)
            }
          />
        ),
      },
      {
        key: "actions",
        label: "Action",
        className: "w-28",
        render: (item: LabelItem) => (
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 shrink-0"
              title={item.selected ? "Deselect" : "Select"}
              onClick={() => toggleItemSelection(item.id)}
            >
              {item.selected ? (
                <CheckSquare className="size-4" />
              ) : (
                <Square className="size-4" />
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-9 shrink-0 text-destructive hover:text-destructive"
              title="Remove"
              onClick={() => removeItem(item.id)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ),
      },
    ],
    [codeColumnLabel, toggleItemSelection, updateItemQuantity, removeItem]
  );

  const selectClasses =
    "h-10 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25">
            <Icon className="size-7" aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>

      <div className={INVENTORY_CARD_SHELL}>
        <div className="flex flex-wrap items-end gap-3 border-b border-border/50 bg-muted/15 p-4 sm:p-5 md:p-6">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1.5 block text-sm font-medium">Branch</label>
            <select
              className={selectClasses}
              value={selectedBranchId}
              onChange={(e) => handleBranchChange(e.target.value)}
            >
              <option value="">Select branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.storeType ? ` (${b.storeType})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[220px] flex-1">
            <label className="mb-1.5 block text-sm font-medium">Product</label>
            <Combobox
              items={productItems}
              value={selectedProductItem}
              onValueChange={(item) => {
                const v = item?.value;
                setSelectedProductId(isUsableEntityId(v) ? String(v) : "");
                setBatchComboNonce((n) => n + 1);
              }}
              isItemEqualToValue={itemEqual}
              disabled={!selectedBranchId}
            >
              <ComboboxInput
                placeholder="Search or select product…"
                disabled={!selectedBranchId}
                showClear={!!selectedProductId}
              />
              <ComboboxContent sideOffset={4} className="z-50">
                <ComboboxEmpty>No products in this branch.</ComboboxEmpty>
                <ComboboxList>
                  {productItems.map((item) => (
                    <ComboboxItem key={item.value} value={item}>
                      {item.label}
                    </ComboboxItem>
                  ))}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
        </div>
      </div>

      {selectedProduct && productVariants.length > 0 && (
        <div className={cn(INVENTORY_CARD_SHELL, "space-y-4 p-4 sm:p-5 md:p-6")}>
          <h2 className="text-lg font-semibold text-foreground">Add batch to print list</h2>
          {showVariantStep && (
            <div className="max-w-md">
              <label className="mb-1.5 block text-sm font-medium">Variant</label>
              <Combobox
                items={variantComboItems}
                value={selectedVariantComboItem}
                onValueChange={(item) => {
                  const v = item?.value;
                  setSelectedVariantIdForPrint(isUsableEntityId(v) ? String(v) : "");
                  setBatchComboNonce((n) => n + 1);
                }}
                isItemEqualToValue={itemEqual}
              >
                <ComboboxInput placeholder="Search or select variant…" showClear={!!selectedVariantIdForPrint} />
                <ComboboxContent sideOffset={4} className="z-50">
                  <ComboboxEmpty>No variants</ComboboxEmpty>
                  <ComboboxList>
                    {variantComboItems.map((item) => (
                      <ComboboxItem key={item.value} value={item}>
                        {item.label}
                      </ComboboxItem>
                    ))}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
              {!selectedVariantIdForPrint ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Select a variant, then choose a batch (same flow as seller admin).
                </p>
              ) : null}
            </div>
          )}
          {selectedVariantIdForPrint ? (
            <div className="max-w-md">
              <label className="mb-1.5 block text-sm font-medium">Batch</label>
              {loading && batchComboItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">Loading batches…</p>
              ) : batchComboItems.length > 0 ? (
                <Combobox
                  key={`batch-${selectedVariantIdForPrint}-${batchComboNonce}`}
                  items={batchComboItems}
                  onValueChange={(item) => {
                    if (item) void handleBatchSelect(item.value);
                  }}
                  isItemEqualToValue={itemEqual}
                >
                  <ComboboxInput placeholder="Search or select batch…" />
                  <ComboboxContent sideOffset={4} className="z-50">
                    <ComboboxEmpty>No batches with stock</ComboboxEmpty>
                    <ComboboxList>
                      {batchComboItems.map((item) => (
                        <ComboboxItem key={item.value} value={item}>
                          {item.label}
                        </ComboboxItem>
                      ))}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {(variantBatches[selectedVariantIdForPrint] || []).length === 0
                    ? "No batches for this variant."
                    : "No available quantity in batches."}
                </p>
              )}
            </div>
          ) : null}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {labelItems.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-foreground">
              {kind === "barcode" ? "Barcode" : "QR code"} items
            </h2>
            <Button type="button" variant="ghost" size="sm" onClick={selectAllItems}>
              <CheckSquare className="mr-1 size-4" />
              Select all
            </Button>
          </div>
          <DataTable columns={itemColumns} data={labelItems} inventoryStyle />
        </div>
      )}

      {labelItems.length > 0 && (
        <div className={cn(INVENTORY_CARD_SHELL, "p-5 sm:p-6 md:p-7")}>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium">Print mode</label>
                <select
                  className={selectClasses}
                  value={settings.printMode}
                  onChange={(e) =>
                    updateSettings({ printMode: e.target.value as PrintMode })
                  }
                >
                  <option value="thermal">Thermal label (GP-3120TUC)</option>
                  <option value="sheet">Sheet paper (A4 / A5)</option>
                </select>
              </div>
              {settings.printMode === "thermal" ? (
                <div>
                  <label className="mb-2 block text-sm font-medium">Label size</label>
                  <select
                    className={selectClasses}
                    value={settings.thermalSize}
                    onChange={(e) =>
                      updateSettings({ thermalSize: e.target.value as ThermalLabelSize })
                    }
                  >
                    {THERMAL_LABEL_PRESETS.map((preset) => (
                      <option key={preset.value} value={preset.value}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Install Gprinter driver, match sticker roll size, set margins to 0 in
                    printer properties, then print.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="mb-2 block text-sm font-medium">Paper size</label>
                  <select
                    className={selectClasses}
                    value={settings.paperSize}
                    onChange={(e) =>
                      updateSettings({ paperSize: e.target.value as SheetPaperSize })
                    }
                  >
                    <option value="A4">A4</option>
                    <option value="A5">A5</option>
                    <option value="Letter">Letter</option>
                  </select>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium">Display options</p>
              {(
                [
                  ["showStoreName", "Show store name"],
                  ["showBatch", "Show batch"],
                  ["showProductName", "Show product name"],
                  ["showVariant", "Show SKU / variant"],
                  ["showPrice", "Show price"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-foreground">{label}</span>
                  <Switch
                    checked={settings[key]}
                    onCheckedChange={(v) => updateSettings({ [key]: v })}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            <Button type="button" onClick={() => selectAllItems()}>
              <FileText className="mr-2 size-4" />
              Generate {kind === "barcode" ? "barcode" : "QR code"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                setSelectedVariantIdForPrint("");
                setBatchComboNonce((n) => n + 1);
              }}
            >
              <RotateCcw className="mr-2 size-4" />
              Reset
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handlePrint}
              disabled={preview.items.length === 0}
            >
              {kind === "barcode" ? (
                <Barcode className="mr-2 size-4" />
              ) : (
                <QrCode className="mr-2 size-4" />
              )}
              Print {kind === "barcode" ? "barcode" : "QR code"}
            </Button>
          </div>
        </div>
      )}

      {preview.items.length > 0 && (
        <div className={cn(INVENTORY_CARD_SHELL, "p-5 sm:p-6 md:p-7")}>
          <h2 className="mb-4 text-lg font-semibold">Preview</h2>
          <div className="rounded-xl border border-border bg-white p-4 text-black dark:bg-white">
            <div
              className={
                labelDims.isThermal
                  ? "flex flex-wrap gap-4"
                  : "grid grid-cols-2 gap-4 md:grid-cols-4"
              }
            >
              {preview.items.slice(0, 8).map((item, index) => (
                <div
                  key={item.id}
                  className="border border-neutral-300 bg-white text-center text-black"
                  style={
                    labelDims.isThermal
                      ? {
                          width: `${labelDims.widthMm * 3}px`,
                          minHeight: `${labelDims.heightMm * 3}px`,
                          padding: "6px 8px",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          lineHeight: 1.1,
                        }
                      : { padding: "12px" }
                  }
                >
                  {settings.showStoreName && selectedStoreName ? (
                    <div
                      className="mb-0.5"
                      style={
                        previewRender
                          ? { fontSize: `${previewRender.storeFont}px` }
                          : { fontSize: "12px" }
                      }
                    >
                      {selectedStoreName}
                    </div>
                  ) : null}
                  {settings.showProductName ? (
                    <div
                      className="mb-0.5 font-bold"
                      style={
                        previewRender
                          ? { fontSize: `${previewRender.productFont}px` }
                          : { fontSize: "14px" }
                      }
                    >
                      {item.productName}
                    </div>
                  ) : null}
                  {settings.showVariant && item.variant ? (
                    <div
                      className="mb-0.5 text-neutral-700"
                      style={
                        previewRender
                          ? { fontSize: `${previewRender.metaFont}px` }
                          : { fontSize: "12px" }
                      }
                    >
                      {item.variant}
                    </div>
                  ) : null}
                  {settings.showBatch ? (
                    <div
                      className="mb-0.5 text-neutral-700"
                      style={
                        previewRender
                          ? { fontSize: `${previewRender.metaFont}px` }
                          : { fontSize: "12px" }
                      }
                    >
                      Batch: {item.batchNumber}
                    </div>
                  ) : null}
                  <div className="barcode-svg-wrap my-0 w-full bg-white">
                    {kind === "barcode" ? (
                      <svg
                        id={`barcode-${index}`}
                        className="mx-auto block max-w-full"
                        style={{
                          width: "auto",
                          height: "auto",
                          maxHeight: previewRender
                            ? `${previewRender.height + 14}px`
                            : "96px",
                        }}
                      />
                    ) : (
                      <div
                        className="flex items-center justify-center bg-white"
                        style={{
                          minHeight: previewRender
                            ? `${previewRender.qrSize}px`
                            : "96px",
                        }}
                      >
                        <div
                          id={`qrcode-${index}`}
                          style={{
                            width: previewQrSize,
                            height: previewQrSize,
                          }}
                        />
                      </div>
                    )}
                  </div>
                  {kind === "qrcode" ? (
                    <div
                      className="mt-0.5 font-mono text-neutral-800"
                      style={
                        previewRender
                          ? { fontSize: `${Math.max(5, previewRender.metaFont - 1)}px` }
                          : { fontSize: "10px" }
                      }
                    >
                      {item.scancode}
                    </div>
                  ) : null}
                  {settings.showPrice && item.price != null ? (
                    <div
                      className="font-semibold"
                      style={
                        previewRender
                          ? { fontSize: `${previewRender.priceFont}px` }
                          : { fontSize: "12px" }
                      }
                    >
                      {formatAmountDecimal(item.price)}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            {preview.items.length > 8 ? (
              <p className="mt-4 text-center text-sm text-muted-foreground">
                + {preview.items.length - 8} more labels in print
              </p>
            ) : null}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-16">
          <div className="size-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}
    </div>
  );
}
