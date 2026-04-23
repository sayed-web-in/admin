"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Package,
  Plus,
  Trash2,
  Pencil,
  ImageIcon,
  FileText,
  Sparkles,
  Eye,
  X,
  LayoutGrid,
  Layers,
  ClipboardList,
  Store,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ProductVariantModal,
  type VariantEntry,
} from "@/components/common/ProductVariantModal";
import { StoreProductModal } from "@/components/inventory/StoreProductModal";
import { SpecBuilder } from "@/components/inventory/SpecBuilder";
import { useAddProductPage } from "./useAddProductPage";
import DescriptionEditor from "./DescriptionEditor";
import { EditStoreProductModal } from "./EditStoreProductModal";
import { ConfirmModal } from "./ConfirmModal";
import { ViewSerialNumbersModal } from "./ViewSerialNumbersModal";
import { BatchExplorerModal } from "./BatchExplorerModal";
import { resolveMediaUrl } from "./media";
import { formatPrice, formatDate } from "@/lib/utils";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PRODUCT_TYPES, SERIAL_NUMBER_OPTIONS } from "./types";

type ComboOption = { value: number; label: string };

function itemEqual(a: ComboOption, b: ComboOption) {
  return a.value === b.value;
}

function formatStoreDiscount(discountType: string, discountValue: number) {
  if (!discountValue) return "—";
  const t = (discountType || "").toLowerCase();
  if (t === "percentage" || t === "percent") return `${discountValue}%`;
  return formatPrice(discountValue);
}

const cardShell =
  "overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]";
const basicFieldClass = "border-border/90 bg-muted/55 dark:bg-muted/35";

function SectionHeader({
  icon: Icon,
  title,
  description,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Omit bottom border/margin when sitting in a toolbar row (e.g. with actions). */
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "flex min-w-0 flex-1 items-start gap-3"
          : "mb-5 flex items-start gap-3 border-b border-border/50 pb-4"
      }
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary shadow-sm ring-1 ring-primary/10">
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </div>
      <div className="min-w-0 pt-0.5">
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function AddProductPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] w-full min-w-0 items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/20 text-sm text-muted-foreground">
          Loading…
        </div>
      }
    >
      <AddProductPageContent />
    </Suspense>
  );
}

function AddProductPageContent() {
  const {
    isEditMode,
    editLoading,
    dataLoading,
    actionLoading,
    draftProductId,
    productStatus,
    form,
    setForm,
    setField,
    categories,
    subcategories,
    brands,
    units,
    taxRates,
    storeRows,
    storeLoading,
    isProductTypeDisabled,
    isSerialDisabled,
    saveProductInfo,
    addVariant,
    removeVariant,
    storeModalOpen,
    setStoreModalOpen,
    editStoreOpen,
    setEditStoreOpen,
    selectedStoreRow,
    setSelectedStoreRow,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    rowToDelete,
    setRowToDelete,
    handleEditStoreSubmit,
    handleDeleteStoreRow,
    serialModalOpen,
    setSerialModalOpen,
    serialModalRows,
    setSerialModalRows,
    batchModalOpen,
    setBatchModalOpen,
    batchStoreProductId,
    setBatchStoreProductId,
    refreshStoreRows,
    startNewProductSession,
    isTab1Valid,
    router,
  } = useAddProductPage();

  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [variantEdit, setVariantEdit] = useState<VariantEntry | null>(null);

  const variantExistingSkus = useMemo(
    () =>
      form.variants
        .filter((v) => !variantEdit?.id || v.id !== variantEdit.id)
        .map((v) => v.sku)
        .filter(Boolean),
    [form.variants, variantEdit?.id]
  );
  const productImageInputRef = useRef<HTMLInputElement>(null);
  const replaceImageInputRef = useRef<HTMLInputElement>(null);
  const replaceImageIndexRef = useRef<number | null>(null);
  const [singleSkuEditing, setSingleSkuEditing] = useState(false);
  const singleSkuInputRef = useRef<HTMLInputElement>(null);
  const selectWholeSkuAfterEditOpen = useRef(false);

  useEffect(() => {
    if (!singleSkuEditing || form.productType !== "single") return;
    const el = singleSkuInputRef.current;
    if (!el) return;
    el.focus();
    if (selectWholeSkuAfterEditOpen.current) {
      el.select();
      selectWholeSkuAfterEditOpen.current = false;
    }
  }, [singleSkuEditing, form.productType]);

  const handleSingleSkuPencilClick = () => {
    if (singleSkuEditing) {
      setSingleSkuEditing(false);
      return;
    }
    selectWholeSkuAfterEditOpen.current = true;
    setSingleSkuEditing(true);
  };

  const handleGenerateSingleSku = () => {
    const ts = Date.now().toString().slice(-6);
    setField("sku", `SKU-${ts}`);
  };

  const categoryItems = useMemo<ComboOption[]>(
    () => categories.map((c) => ({ value: c.id, label: c.name })),
    [categories]
  );
  const subcategoryItems = useMemo<ComboOption[]>(
    () => subcategories.map((s) => ({ value: s.id, label: s.name })),
    [subcategories]
  );
  const brandItems = useMemo<ComboOption[]>(
    () => brands.map((b) => ({ value: b.id, label: b.name })),
    [brands]
  );
  const unitItems = useMemo<ComboOption[]>(
    () => units.map((u) => ({ value: u.id, label: u.name })),
    [units]
  );

  const selectedCategory = useMemo(
    () => categoryItems.find((x) => x.value === form.categoryId) ?? null,
    [categoryItems, form.categoryId]
  );
  const selectedSubcategory = useMemo(
    () => subcategoryItems.find((x) => x.value === form.subcategoryId) ?? null,
    [subcategoryItems, form.subcategoryId]
  );
  const selectedBrand = useMemo(
    () => brandItems.find((x) => x.value === form.brandId) ?? null,
    [brandItems, form.brandId]
  );
  const selectedUnit = useMemo(
    () => unitItems.find((x) => x.value === form.unitId) ?? null,
    [unitItems, form.unitId]
  );

  const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

  const onPickImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const oversized = files.filter((f) => f.size > MAX_IMAGE_BYTES);
    if (oversized.length > 0) {
      for (const file of oversized) {
        toast.error(`"${file.name}" is larger than 10MB and was skipped.`);
      }
    }

    const validFiles = files.filter((f) => f.size <= MAX_IMAGE_BYTES);
    if (!validFiles.length) {
      e.target.value = "";
      return;
    }

    const newPending = validFiles.map((file) => {
      const tempUrl = URL.createObjectURL(file);
      return { tempUrl, file };
    });
    const newTempUrls = newPending.map((p) => p.tempUrl);

    setForm((prev) => {
      for (const prevUrl of prev.images || []) {
        if (typeof prevUrl === "string" && prevUrl.startsWith("blob:")) {
          URL.revokeObjectURL(prevUrl);
        }
      }
      return {
        ...prev,
        images: newTempUrls,
        pendingImages: newPending,
      };
    });
    e.target.value = "";
  };

  const removeImageAt = (idx: number) => {
    setForm((f) => {
      const url = f.images[idx];
      const pending = f.pendingImages.find((p) => p.tempUrl === url);
      if (pending) URL.revokeObjectURL(pending.tempUrl);
      return {
        ...f,
        images: f.images.filter((_, i) => i !== idx),
        pendingImages: f.pendingImages.filter((p) => p.tempUrl !== url),
      };
    });
  };

  const openReplaceImage = (idx: number) => {
    replaceImageIndexRef.current = idx;
    replaceImageInputRef.current?.click();
  };

  const onReplaceImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = replaceImageIndexRef.current;
    const file = e.target.files?.[0];
    e.target.value = "";
    replaceImageIndexRef.current = null;
    if (idx == null || !file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error(
        `"${file.name}" is larger than 10MB. Please choose a smaller image.`
      );
      return;
    }
    const tempUrl = URL.createObjectURL(file);
    setForm((prev) => {
      const oldUrl = prev.images[idx];
      if (!oldUrl) return prev;
      const oldPending = prev.pendingImages.find((p) => p.tempUrl === oldUrl);
      if (oldPending && oldUrl.startsWith("blob:")) {
        URL.revokeObjectURL(oldUrl);
      }
      const nextImages = [...prev.images];
      nextImages[idx] = tempUrl;
      const nextPending = prev.pendingImages
        .filter((p) => p.tempUrl !== oldUrl)
        .concat({ tempUrl, file });
      return { ...prev, images: nextImages, pendingImages: nextPending };
    });
  };

  if (editLoading || dataLoading) {
    return (
      <div className="w-full min-w-0 py-8 sm:py-12">
        <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/15 text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <header className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card to-primary/[0.06] p-5 shadow-md ring-1 ring-black/[0.04] dark:ring-white/[0.08] sm:p-6">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/[0.12] blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 sm:h-14 sm:w-14">
              <Package className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  {isEditMode ? "Edit product" : "Add product"}
                </h1>
                {productStatus ? (
                  <Badge
                    variant="secondary"
                    className="rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
                  >
                    {String(productStatus).toLowerCase()}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {isEditMode
                  ? "Update details, variants, and store listings in one place."
                  : "Set up the catalog entry, then add it to branches when you save."}
              </p>
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 w-full gap-2 rounded-xl border-border/80 bg-background/80 backdrop-blur-sm sm:h-9 sm:w-auto"
              title="Back"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              Back
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={startNewProductSession}
              className="h-10 w-full gap-1.5 rounded-xl border-border/80 bg-background/80 backdrop-blur-sm sm:h-9 sm:w-auto"
              title="Add New Product"
            >
              <Plus className="h-4 w-4 shrink-0" />
              Add New
            </Button>
          </div>
        </div>
      </header>

      <div className="space-y-5 sm:space-y-6">
          <section className={`${cardShell} p-5 sm:p-6 md:p-7`}>
            <SectionHeader
              icon={LayoutGrid}
              title="Basic details"
              description="Product type, category, brand, unit, tax, name, and serial tracking."
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Product type <span className="text-red-500">*</span>
                </label>
                <Select
                  value={form.productType}
                  onValueChange={(val) =>
                    setField("productType", val as "single" | "variable")
                  }
                  disabled={isProductTypeDisabled}
                >
                  <SelectTrigger className={`h-10 w-full rounded-xl ${basicFieldClass}`}>
                    <SelectValue placeholder="Select product type" />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" align="start">
                    <SelectGroup>
                      {PRODUCT_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Category <span className="text-red-500">*</span>
                </label>
                <Combobox
                  items={categoryItems}
                  value={selectedCategory}
                  onValueChange={(item) => {
                    setField("categoryId", item?.value ?? 0);
                    setField("subcategoryId", 0);
                  }}
                  isItemEqualToValue={itemEqual}
                >
                  <ComboboxInput
                    className={basicFieldClass}
                    placeholder={
                      form.branchId
                        ? "Search or select category…"
                        : "Select branch in the top bar"
                    }
                    showClear={form.categoryId > 0}
                    disabled={!form.branchId}
                  />
                  <ComboboxContent sideOffset={4} className="z-50">
                    <ComboboxEmpty>
                      {form.branchId
                        ? "No categories found."
                        : "Select a branch in the header first."}
                    </ComboboxEmpty>
                    <ComboboxList>
                      {categoryItems.map((item) => (
                        <ComboboxItem key={item.value} value={item}>
                          {item.label}
                        </ComboboxItem>
                      ))}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Subcategory
                </label>
                <Combobox
                  items={subcategoryItems}
                  value={selectedSubcategory}
                  onValueChange={(item) =>
                    setField("subcategoryId", item?.value ?? 0)
                  }
                  isItemEqualToValue={itemEqual}
                >
                  <ComboboxInput
                    className={basicFieldClass}
                    placeholder="Search or select subcategory…"
                    showClear={form.subcategoryId > 0}
                    disabled={!form.categoryId}
                  />
                  <ComboboxContent sideOffset={4} className="z-50">
                    <ComboboxEmpty>No subcategories found.</ComboboxEmpty>
                    <ComboboxList>
                      {subcategoryItems.map((item) => (
                        <ComboboxItem key={item.value} value={item}>
                          {item.label}
                        </ComboboxItem>
                      ))}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Brand <span className="text-red-500">*</span>
                </label>
                <Combobox
                  items={brandItems}
                  value={selectedBrand}
                  onValueChange={(item) => setField("brandId", item?.value ?? 0)}
                  isItemEqualToValue={itemEqual}
                >
                  <ComboboxInput
                    className={basicFieldClass}
                    placeholder="Search or select brand…"
                    showClear={form.brandId > 0}
                  />
                  <ComboboxContent sideOffset={4} className="z-50">
                    <ComboboxEmpty>No brands found.</ComboboxEmpty>
                    <ComboboxList>
                      {brandItems.map((item) => (
                        <ComboboxItem key={item.value} value={item}>
                          {item.label}
                        </ComboboxItem>
                      ))}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Unit <span className="text-red-500">*</span>
                </label>
                <Combobox
                  items={unitItems}
                  value={selectedUnit}
                  onValueChange={(item) => setField("unitId", item?.value ?? 0)}
                  isItemEqualToValue={itemEqual}
                >
                  <ComboboxInput
                    className={basicFieldClass}
                    placeholder="Search or select unit…"
                    showClear={form.unitId > 0}
                  />
                  <ComboboxContent sideOffset={4} className="z-50">
                    <ComboboxEmpty>No units found.</ComboboxEmpty>
                    <ComboboxList>
                      {unitItems.map((item) => (
                        <ComboboxItem key={item.value} value={item}>
                          {item.label}
                        </ComboboxItem>
                      ))}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Tax rate{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </label>
                <Select
                  value={form.taxRateId ? String(form.taxRateId) : "none"}
                  onValueChange={(val) =>
                    setField("taxRateId", val === "none" ? 0 : Number(val))
                  }
                >
                  <SelectTrigger className={`h-10 w-full rounded-xl ${basicFieldClass}`}>
                    <SelectValue placeholder="No tax" />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" align="start">
                    <SelectGroup>
                      <SelectItem value="none">No tax</SelectItem>
                      {taxRates.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name} ({t.rate}%)
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 xl:col-span-2">
                <label className="text-sm font-medium mb-1.5 block">
                  Product name <span className="text-red-500">*</span>
                </label>
                <Input
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  placeholder="Product name"
                  className={basicFieldClass}
                />
              </div>
              {form.productType === "single" && (
                <div className="sm:col-span-2 xl:col-span-2">
                  <label className="text-sm font-medium mb-1.5 block">
                    SKU <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap items-stretch gap-2">
                    {singleSkuEditing ? (
                      <Input
                        ref={singleSkuInputRef}
                        value={form.sku}
                        onChange={(e) => setField("sku", e.target.value)}
                        placeholder="Enter SKU"
                        className={`min-w-0 flex-1 font-mono ${basicFieldClass}`}
                      />
                    ) : (
                      <div className="flex min-h-[42px] min-w-0 flex-1 items-center rounded-xl border border-border/70 bg-transparent px-3 font-mono text-sm text-foreground">
                        <span className="break-all">
                          {form.sku.trim() ? form.sku : "—"}
                        </span>
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-11 shrink-0 rounded-xl"
                      title="Generate SKU"
                      onClick={handleGenerateSingleSku}
                    >
                      <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-10 w-11 shrink-0 rounded-xl"
                      title={singleSkuEditing ? "Done" : "Edit SKU"}
                      onClick={handleSingleSkuPencilClick}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    SKU can be auto-filled; use the icons to generate a new code
                    or edit manually.
                  </p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Unique Serial/IMEI Number
                </label>
                <Select
                  value={String(form.hasSerialNumber)}
                  onValueChange={(val) =>
                    setField("hasSerialNumber", val === "true")
                  }
                  disabled={isSerialDisabled}
                >
                  <SelectTrigger className={`h-10 w-full rounded-xl ${basicFieldClass}`}>
                    <SelectValue placeholder="Select option" />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" align="start">
                    <SelectGroup>
                      {SERIAL_NUMBER_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          {form.productType === "single" ? (
            <section className={`${cardShell} p-5 sm:p-6 md:p-7`}>
              <SectionHeader
                icon={ImageIcon}
                title="Product images"
                description="Resized and saved as WebP when you save (same flow as seller admin)."
              />
              <div className="space-y-5">
                <div className="rounded-2xl border-2 border-dashed border-primary/20 bg-gradient-to-b from-muted/30 to-muted/10 p-6 text-center sm:p-8">
                  <ImageIcon
                    className="mx-auto mb-3 h-12 w-12 text-muted-foreground opacity-80 sm:mb-4"
                    aria-hidden
                  />
                  <p className="mb-4 text-sm text-muted-foreground">
                    Choose images — picking new files replaces the current
                    selection. Max 10MB each.
                  </p>
                  <Button
                    type="button"
                    className="min-h-[42px] rounded-xl px-6"
                    onClick={() => productImageInputRef.current?.click()}
                  >
                    Choose images
                  </Button>
                  <input
                    ref={productImageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={onPickImages}
                  />
                  <input
                    ref={replaceImageInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onReplaceImagePick}
                  />
                </div>
                {form.images.length > 0 && (
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                    {form.images.map((src, idx) => (
                      <div key={idx} className="group relative">
                        <img
                          src={resolveMediaUrl(src)}
                          alt={`Product ${idx + 1}`}
                          className="h-24 w-full rounded-xl border border-border object-cover"
                        />
                        <div className="absolute bottom-1 left-1 right-1 flex justify-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                          <Button
                            type="button"
                            size="icon"
                            variant="secondary"
                            className="h-7 w-7 rounded-lg border border-border/80 bg-background/95 shadow-sm"
                            title="Replace image"
                            onClick={() => openReplaceImage(idx)}
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                          </Button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeImageAt(idx)}
                          className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm transition-opacity hover:bg-destructive/90 sm:h-7 sm:w-7 sm:opacity-0 sm:group-hover:opacity-100"
                          aria-label="Remove image"
                        >
                          <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : (
            <section className={`${cardShell} space-y-5 p-5 sm:p-6 md:p-7`}>
              <div className="flex flex-col gap-4 border-b border-border/50 pb-4 sm:flex-row sm:items-end sm:justify-between">
                <SectionHeader
                  compact
                  icon={Layers}
                  title="Product variants"
                  description="Images, attributes, and SKUs for each variation."
                />
                <Button
                  type="button"
                  className="h-10 w-full shrink-0 gap-2 rounded-xl sm:h-9 sm:w-auto"
                  onClick={() => {
                    setVariantEdit(null);
                    setVariantModalOpen(true);
                  }}
                >
                  <Plus size={16} className="shrink-0" aria-hidden />
                  Add product variant
                </Button>
              </div>
              {form.variants.length === 0 ? (
                <div className="rounded-xl border border-border bg-muted/20 py-16 text-center shadow-sm">
                  <ImageIcon
                    className="mx-auto mb-4 h-16 w-16 text-muted-foreground/50"
                    aria-hidden
                  />
                  <p className="mb-4 text-sm text-muted-foreground">
                    No variants added yet
                  </p>
                  <Button
                    type="button"
                    onClick={() => {
                      setVariantEdit(null);
                      setVariantModalOpen(true);
                    }}
                  >
                    <Plus size={16} className="mr-2 shrink-0" aria-hidden />
                    Add first variant
                  </Button>
                </div>
              ) : (
                <>
                  <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[760px] text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/45">
                            <th className="w-[76px] px-4 py-3.5 text-left align-middle text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                              Image
                            </th>
                            <th className="min-w-[140px] px-4 py-3.5 text-left align-middle text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                              Attribute name
                            </th>
                            <th className="min-w-[140px] px-4 py-3.5 text-left align-middle text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                              Variant value
                            </th>
                            <th className="w-[140px] px-4 py-3.5 text-left align-middle text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                              SKU
                            </th>
                            <th className="w-[120px] px-4 py-3.5 text-left align-middle text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                              Created date
                            </th>
                            <th className="w-[100px] px-4 py-3.5 text-right align-middle text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {form.variants.map((v, i) => (
                            <tr
                              key={v.id || i}
                              className="transition-colors hover:bg-muted/25"
                            >
                              <td className="px-4 py-3 align-middle">
                                {v.image ? (
                                  <img
                                    src={resolveMediaUrl(v.image)}
                                    alt=""
                                    className="h-12 w-12 shrink-0 rounded-lg border-2 border-border/80 object-cover shadow-sm"
                                  />
                                ) : (
                                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border-2 border-border/80 bg-muted/50">
                                    <ImageIcon
                                      size={18}
                                      className="text-muted-foreground"
                                      aria-hidden
                                    />
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 align-middle">
                                <span className="font-medium leading-snug text-foreground">
                                  {v.attributes.length
                                    ? v.attributes
                                        .map((a) => a.attributeName)
                                        .join(" — ")
                                    : "—"}
                                </span>
                              </td>
                              <td className="px-4 py-3 align-middle">
                                <span className="leading-snug text-muted-foreground">
                                  {v.attributes.length
                                    ? v.attributes
                                        .map((a) => a.valueName)
                                        .join(" — ")
                                    : "—"}
                                </span>
                              </td>
                              <td className="px-4 py-3 align-middle">
                                <span className="inline-flex max-w-full break-all rounded-md border border-primary/25 bg-primary/10 px-2 py-1 font-mono text-xs font-medium text-primary">
                                  {v.sku || "—"}
                                </span>
                              </td>
                              <td className="px-4 py-3 align-middle whitespace-nowrap tabular-nums text-muted-foreground">
                                {v.createdAt ? formatDate(v.createdAt) : "—"}
                              </td>
                              <td className="px-4 py-3 align-middle text-right">
                                <div className="inline-flex items-center justify-end gap-0.5">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                                    title="Edit variant"
                                    onClick={() => {
                                      setVariantEdit(v);
                                      setVariantModalOpen(true);
                                    }}
                                  >
                                    <Pencil size={15} aria-hidden />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                                    title="Remove variant"
                                    onClick={() => {
                                      if (v.id) removeVariant(v.id);
                                    }}
                                  >
                                    <Trash2 size={15} aria-hidden />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground shadow-sm">
                    <span className="font-semibold text-foreground">
                      {form.variants.length}
                    </span>{" "}
                    variant
                    {form.variants.length !== 1 ? "s" : ""} added
                  </div>
                </>
              )}
            </section>
          )}

          <section className={`${cardShell} p-5 sm:p-6 md:p-7`}>
            <SectionHeader
              icon={ClipboardList}
              title="Specifications"
              description="Key–value fields shown on the product page (optional)."
            />
            <SpecBuilder
              specs={form.specifications}
              onChange={(specs) => setField("specifications", specs)}
            />
          </section>

          <section className={`${cardShell} p-5 sm:p-6 md:p-7`}>
            <SectionHeader
              icon={FileText}
              title="Product description"
              description="Optional rich text — saved together with product details."
            />
            <DescriptionEditor
              value={form.description}
              onChange={(html) => setField("description", html)}
            />
          </section>

          <div
            className={`${cardShell} sticky bottom-2 z-10 flex flex-col gap-3 p-4 shadow-md backdrop-blur-sm supports-[backdrop-filter]:bg-card/90 sm:flex-row sm:items-center sm:justify-end sm:p-4`}
          >
            <Button
              type="button"
              className="h-11 w-full min-w-[180px] rounded-xl shadow-sm sm:ml-auto sm:h-10 sm:w-auto"
              onClick={() => void saveProductInfo()}
              disabled={actionLoading || !isTab1Valid()}
            >
              <Package size={16} className="mr-2 shrink-0" />
              {actionLoading ? "Saving…" : "Save product"}
            </Button>
          </div>
      </div>

      <section className={cardShell}>
        <div className="flex flex-col gap-4 border-b border-border/50 bg-muted/15 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-5">
          <SectionHeader
            compact
            icon={Store}
            title="Store product"
            description={
              draftProductId
                ? "Add this product to branches and set prices."
                : "Save the product above first, then add it to branches here."
            }
          />
          <Button
            type="button"
            className="h-10 w-full shrink-0 gap-2 rounded-xl sm:h-9 sm:w-auto"
            disabled={!draftProductId}
            onClick={() => setStoreModalOpen(true)}
          >
            <Plus size={16} className="shrink-0" aria-hidden />
            Add store product
          </Button>
        </div>
        <div className="p-5 sm:p-6 md:p-7">
          <div className="overflow-x-auto rounded-xl border border-border/80 ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
            <table className="w-full min-w-[1100px] border-collapse text-sm">
              <thead className="bg-muted/45">
                <tr className="border-b border-border">
                  <th className="px-3 py-3 text-left align-middle text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    Branch
                  </th>
                  <th className="px-3 py-3 text-left align-middle text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    Variant
                  </th>
                  <th className="px-3 py-3 text-left align-middle text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    Quantity
                  </th>
                  <th className="px-3 py-3 text-left align-middle text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    Selling price
                  </th>
                  <th className="px-3 py-3 text-left align-middle text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    Low stock
                  </th>
                  <th className="px-3 py-3 text-left align-middle text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    Discount
                  </th>
                  <th className="px-3 py-3 text-left align-middle text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    Serial/IMEI
                  </th>
                  <th className="px-3 py-3 text-left align-middle text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    Selling type
                  </th>
                  <th className="px-3 py-3 text-left align-middle text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    Created
                  </th>
                  <th className="px-3 py-3 text-left align-middle text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    Batch
                  </th>
                  <th className="px-3 py-3 text-left align-middle text-[0.7rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {!draftProductId ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-3 py-16 text-center text-muted-foreground"
                    >
                      <Package
                        className="mx-auto mb-4 h-16 w-16 opacity-50"
                        aria-hidden
                      />
                      <p className="text-base">
                        Save the product above first, then you can add it to
                        branches here.
                      </p>
                    </td>
                  </tr>
                ) : storeLoading ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-3 py-10 text-center text-muted-foreground"
                    >
                      Loading…
                    </td>
                  </tr>
                ) : storeRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-3 py-16 text-center text-muted-foreground"
                    >
                      <Package
                        className="mx-auto mb-4 h-16 w-16 opacity-50"
                        aria-hidden
                      />
                      <p className="text-base">
                        No store products yet. Click &quot;Add store product&quot;
                        to add to a branch.
                      </p>
                    </td>
                  </tr>
                ) : (
                  storeRows.map((row) => (
                    <tr
                      key={row.storeProductId}
                      className="border-b border-border/60 transition-colors hover:bg-muted/25 last:border-b-0"
                    >
                      <td className="px-3 py-2.5 align-middle text-foreground">
                        {row.branch.name}
                      </td>
                      <td className="max-w-[220px] px-3 py-2.5 align-middle text-muted-foreground">
                        <span className="line-clamp-2">
                          {row.variantLabel || row.sku || "—"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 align-middle tabular-nums text-muted-foreground">
                        {row.quantity}
                      </td>
                      <td className="px-3 py-2.5 align-middle tabular-nums text-muted-foreground">
                        {formatPrice(row.sellingPrice)}
                      </td>
                      <td className="px-3 py-2.5 align-middle tabular-nums text-muted-foreground">
                        {row.quantityAlert != null ? row.quantityAlert : "—"}
                      </td>
                      <td className="px-3 py-2.5 align-middle text-muted-foreground">
                        {formatStoreDiscount(
                          row.discountType,
                          row.discountValue
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        {form.hasSerialNumber ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 rounded-lg px-2.5"
                            title="View serial/IMEI numbers"
                            onClick={() => {
                              setSerialModalRows(
                                row.serialNumbers.map((s) => ({
                                  serial: s,
                                  status: "IN_STOCK",
                                }))
                              );
                              setSerialModalOpen(true);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" aria-hidden />
                            View
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <span className="inline-flex rounded-md border border-border bg-primary/10 px-2 py-0.5 text-xs font-medium capitalize text-primary">
                          {(row.sellingType || "retail")
                            .replace(/_/g, " ")
                            .toLowerCase()
                            .replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 align-middle text-muted-foreground">
                        {row.createdAt ? formatDate(row.createdAt) : "—"}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        {row.branch.id ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 gap-1 rounded-lg px-2.5"
                            title="View batches"
                            onClick={() => {
                              setBatchStoreProductId(row.storeProductId);
                              setBatchModalOpen(true);
                            }}
                          >
                            <Eye className="h-3.5 w-3.5" aria-hidden />
                            View
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-middle">
                        <div className="flex items-center gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-lg"
                            title="Edit"
                            onClick={() => {
                              setSelectedStoreRow(row);
                              setEditStoreOpen(true);
                            }}
                          >
                            <Pencil size={16} />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-lg text-destructive hover:bg-destructive/10 hover:text-destructive"
                            title="Delete"
                            onClick={() => {
                              setRowToDelete(row);
                              setDeleteConfirmOpen(true);
                            }}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex justify-end">
            <Button variant="outline" asChild>
              <Link href="/inventory/manage-product">
                Back to manage products
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <ProductVariantModal
        open={variantModalOpen}
        onOpenChange={(o) => {
          setVariantModalOpen(o);
          if (!o) setVariantEdit(null);
        }}
        productName={form.name}
        existingSkus={variantExistingSkus}
        initialVariant={variantEdit}
        onAdd={(v) => {
          if (variantEdit?.id) {
            setForm((f) => ({
              ...f,
              variants: f.variants.map((x) => (x.id === v.id ? v : x)),
            }));
          } else {
            addVariant(v);
          }
          setVariantModalOpen(false);
          setVariantEdit(null);
        }}
      />

      <StoreProductModal
        open={storeModalOpen}
        onOpenChange={setStoreModalOpen}
        productId={draftProductId}
        productType={form.productType === "variable" ? "VARIABLE" : "SINGLE"}
        hasImei={form.hasSerialNumber}
        variants={form.variants}
        existingStoreRows={storeRows}
        onAdded={() => {
          if (draftProductId) void refreshStoreRows(draftProductId);
        }}
      />

      <EditStoreProductModal
        open={editStoreOpen}
        onOpenChange={(o) => {
          setEditStoreOpen(o);
          if (!o) setSelectedStoreRow(null);
        }}
        onSubmit={(data) => void handleEditStoreSubmit(data)}
        onDelete={() => {
          if (selectedStoreRow) {
            setRowToDelete(selectedStoreRow);
            setEditStoreOpen(false);
            setSelectedStoreRow(null);
            setDeleteConfirmOpen(true);
          }
        }}
        storeProduct={selectedStoreRow}
        canEditPurchaseCost={selectedStoreRow?.canEditPurchaseCost ?? false}
        loading={actionLoading}
      />

      <ConfirmModal
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Remove store listing?"
        message="This will delete the branch listing if the server allows (no stock, no linked orders)."
        confirmText="Delete"
        destructive
        loading={actionLoading}
        onConfirm={async () => {
          await handleDeleteStoreRow();
        }}
      />

      <ViewSerialNumbersModal
        open={serialModalOpen}
        onOpenChange={setSerialModalOpen}
        serials={serialModalRows}
      />

      <BatchExplorerModal
        open={batchModalOpen}
        onOpenChange={setBatchModalOpen}
        storeProductId={batchStoreProductId}
      />
    </div>
  );
}
