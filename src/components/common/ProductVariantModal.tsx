"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  Layers,
  Pencil,
  Plus,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { resolveMediaUrl } from "@/app/(dashboard)/inventory/add-product/media";

interface AttributeValue {
  id: number;
  value: string;
}

interface Attribute {
  id: number;
  name: string;
  values: AttributeValue[];
}

type ComboOption = { value: number; label: string };

function comboEq(a: ComboOption, b: ComboOption) {
  return a.value === b.value;
}

export interface VariantEntry {
  id?: string;
  image?: string;
  /** Local pick before product save uploads via `uploadProductImage` (seller-admin style). */
  pendingImage?: { tempUrl: string; file: File };
  sku: string;
  /** ISO timestamp; set on create, from API on edit load */
  createdAt?: string;
  attributes: {
    attributeId: number;
    attributeName: string;
    valueId: number;
    valueName: string;
  }[];
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function newVariantId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `v-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function buildSuggestedSku(
  productName: string,
  rows: { attributeId: number; valueId: number }[],
  attrs: Attribute[]
): string {
  const parts = rows
    .filter((r) => r.attributeId > 0 && r.valueId > 0)
    .map((r) => {
      const a = attrs.find((x) => x.id === r.attributeId);
      const v = a?.values.find((x) => x.id === r.valueId);
      return (v?.value || "?").replace(/\s+/g, "").slice(0, 4).toUpperCase();
    });
  const slug = productName
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 12)
    .toUpperCase();
  const base =
    parts.length > 0
      ? `${slug || "VAR"}-${parts.join("-")}`
      : `VAR-${Date.now().toString(36).slice(-6)}`;
  return base.slice(0, 72) || `VAR-${Date.now().toString(36)}`;
}

function ensureUniqueSku(candidate: string, taken: Set<string>, exclude?: string) {
  const ex = (exclude || "").trim().toLowerCase();
  let s = candidate.slice(0, 80);
  let n = 0;
  while (
    taken.has(s.trim().toLowerCase()) &&
    s.trim().toLowerCase() !== ex &&
    n < 500
  ) {
    n += 1;
    s = `${candidate.slice(0, 60)}-${n}`;
  }
  return s;
}

export interface ProductVariantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (variant: VariantEntry) => void;
  /** Product name — used for SKU suggestions */
  productName: string;
  /** SKUs already used by other variants (for uniqueness) */
  existingSkus: string[];
  initialVariant?: VariantEntry | null;
}

/** Modal for add/edit inventory product variants (image, attributes, SKU). Reusable outside add-product. */
export function ProductVariantModal({
  open,
  onOpenChange,
  onAdd,
  productName,
  existingSkus,
  initialVariant = null,
}: ProductVariantModalProps) {
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [rows, setRows] = useState<{ attributeId: number; valueId: number }[]>([
    { attributeId: 0, valueId: 0 },
  ]);
  const [sku, setSku] = useState("");
  const [skuEditing, setSkuEditing] = useState(false);
  const variantSkuInputRef = useRef<HTMLInputElement>(null);
  const selectWholeSkuAfterEditOpen = useRef(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const variantImageFileInputRef = useRef<HTMLInputElement>(null);

  const takenSkus = useMemo(() => {
    const s = new Set<string>();
    for (const x of existingSkus) {
      if (x?.trim()) s.add(x.trim().toLowerCase());
    }
    return s;
  }, [existingSkus]);

  useEffect(() => {
    if (!open) return;
    apiFetch<unknown>("/attributes?limit=500")
      .then((res) => {
        const list = Array.isArray(res)
          ? res
          : res &&
              typeof res === "object" &&
              "data" in res &&
              Array.isArray((res as { data: Attribute[] }).data)
            ? (res as { data: Attribute[] }).data
            : [];
        setAttributes(
          list.map((a) => ({
            id: a.id,
            name: a.name,
            values: (a.values ?? []).map((v: AttributeValue) => ({
              id: v.id,
              value: v.value,
            })),
          }))
        );
      })
      .catch(() => setAttributes([]));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setSkuEditing(false);
    if (initialVariant) {
      setSku(initialVariant.sku || "");
      if (initialVariant.pendingImage) {
        setImageFile(initialVariant.pendingImage.file);
        setImagePreview(initialVariant.pendingImage.tempUrl);
      } else {
        setImageFile(null);
        setImagePreview(initialVariant.image || "");
      }
      setRows(
        initialVariant.attributes.length
          ? initialVariant.attributes.map((a) => ({
              attributeId: a.attributeId,
              valueId: a.valueId,
            }))
          : [{ attributeId: 0, valueId: 0 }]
      );
    } else {
      setRows([{ attributeId: 0, valueId: 0 }]);
      setSku("");
      setImageFile(null);
      setImagePreview("");
    }
  }, [open, initialVariant]);

  useEffect(() => {
    if (!skuEditing || !open) return;
    const el = variantSkuInputRef.current;
    if (!el) return;
    el.focus();
    if (selectWholeSkuAfterEditOpen.current) {
      el.select();
      selectWholeSkuAfterEditOpen.current = false;
    }
  }, [skuEditing, open]);

  const attributeItems = useMemo<ComboOption[]>(
    () => attributes.map((a) => ({ value: a.id, label: a.name })),
    [attributes]
  );

  useEffect(() => {
    if (!open || initialVariant) return;
    const filled = rows.every((r) => r.attributeId > 0 && r.valueId > 0);
    if (!filled || !productName.trim()) return;
    setSku((prev) => {
      if (prev.trim()) return prev;
      const suggested = buildSuggestedSku(
        productName.trim(),
        rows,
        attributes
      );
      return ensureUniqueSku(suggested, takenSkus);
    });
  }, [open, initialVariant, rows, productName, attributes, takenSkus]);

  const handleAttrChange = (
    index: number,
    field: "attributeId" | "valueId",
    val: number
  ) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        if (field === "attributeId") return { attributeId: val, valueId: 0 };
        return { ...row, valueId: val };
      })
    );
  };

  const addAttrRow = () =>
    setRows((prev) => [...prev, { attributeId: 0, valueId: 0 }]);

  const removeAttrRow = (index: number) =>
    setRows((prev) => prev.filter((_, i) => i !== index));

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image is larger than 10MB. Please choose a smaller image.");
      e.target.value = "";
      return;
    }
    if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    const temp = URL.createObjectURL(file);
    setImageFile(file);
    setImagePreview(temp);
    e.target.value = "";
  };

  const removeImage = () => {
    if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview("");
  };

  const handleGenerateSku = useCallback(() => {
    const ts = Date.now().toString().slice(-6);
    const base = `SKU-${ts}`;
    const unique = ensureUniqueSku(
      base,
      takenSkus,
      initialVariant?.sku
    );
    setSku(unique);
  }, [takenSkus, initialVariant?.sku]);

  const handleVariantSkuPencilClick = () => {
    if (skuEditing) {
      setSkuEditing(false);
      return;
    }
    selectWholeSkuAfterEditOpen.current = true;
    setSkuEditing(true);
  };

  const handleSave = () => {
    const valid = rows.filter((r) => r.attributeId > 0 && r.valueId > 0);
    if (valid.length === 0) {
      toast.error("Please add at least one complete attribute / value pair.");
      return;
    }
    if (!sku.trim()) {
      toast.error("Please enter a SKU.");
      return;
    }
    const attrIds = valid.map((r) => r.attributeId);
    if (new Set(attrIds).size !== attrIds.length) {
      toast.error(
        "Each attribute (e.g. Color, Size) can only be used once per variant."
      );
      return;
    }

    let imageUrl: string | undefined;
    let pending: VariantEntry["pendingImage"];
    if (imageFile && imagePreview.startsWith("blob:")) {
      imageUrl = imagePreview;
      pending = { file: imageFile, tempUrl: imagePreview };
    } else if (
      imagePreview &&
      !imagePreview.startsWith("blob:")
    ) {
      imageUrl = imagePreview;
    }

    const attrDetails = valid.map((r) => {
      const attr = attributes.find((x) => x.id === r.attributeId)!;
      const val = attr.values.find((v) => v.id === r.valueId)!;
      return {
        attributeId: attr.id,
        attributeName: attr.name,
        valueId: val.id,
        valueName: val.value,
      };
    });

    onAdd({
      id: initialVariant?.id ?? newVariantId(),
      image: imageUrl,
      pendingImage: pending,
      sku: sku.trim(),
      createdAt: initialVariant?.createdAt ?? new Date().toISOString(),
      attributes: attrDetails,
    });
    onOpenChange(false);
  };

  const displayImageSrc = imagePreview
    ? imagePreview.startsWith("blob:") || imagePreview.startsWith("data:")
      ? imagePreview
      : resolveMediaUrl(imagePreview)
    : "";

  const title = initialVariant ? "Edit product variant" : "Add product variant";

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description="Configure variant image, attributes, and SKU."
      icon={<Layers className="h-5 w-5" aria-hidden />}
      className="max-w-lg"
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            className="h-10 min-h-[42px] w-full gap-2 rounded-xl sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4 shrink-0" aria-hidden />
            Cancel
          </Button>
          <Button
            type="button"
            className="h-10 min-h-[42px] w-full gap-2 rounded-xl sm:w-auto"
            onClick={handleSave}
          >
            {initialVariant ? (
              <Check className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <Plus className="h-4 w-4 shrink-0" aria-hidden />
            )}
            {initialVariant ? "Update variant" : "Add variant"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            Variant image
          </label>
          <p className="mb-3 text-xs text-muted-foreground">
            Optional. Converted to WebP and optimized when you save the product
            (same as main images).
          </p>
          <input
            ref={variantImageFileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={handleImagePick}
          />
          {displayImageSrc ? (
            <div className="group relative inline-block">
              <img
                src={displayImageSrc}
                alt="Variant"
                className="h-32 w-32 rounded-xl border-2 border-border object-cover shadow-sm transition-transform group-hover:scale-[1.02]"
              />
              <button
                type="button"
                onClick={() => variantImageFileInputRef.current?.click()}
                className="absolute bottom-1 left-1 flex h-8 w-8 items-center justify-center rounded-lg border border-border/80 bg-background/95 text-foreground shadow-md transition hover:bg-muted"
                title="Replace image"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={removeImage}
                className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full border border-destructive/30 bg-destructive/90 text-destructive-foreground shadow-md transition hover:bg-destructive"
                title="Remove image"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => variantImageFileInputRef.current?.click()}
              className="flex h-32 w-32 flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/70 bg-muted/20 transition-colors hover:border-primary/40 hover:bg-muted/40"
            >
              <Upload className="mb-2 h-6 w-6 text-primary" />
              <span className="px-2 text-center text-xs text-muted-foreground">
                Upload
              </span>
            </button>
          )}
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <label className="text-base font-semibold text-foreground">
              Attributes <span className="text-red-500">*</span>
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-xl"
              onClick={addAttrRow}
            >
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          <div className="space-y-4">
            {rows.map((row, index) => {
              const takenElsewhere = new Set(
                rows
                  .filter((_, j) => j !== index)
                  .map((r) => r.attributeId)
                  .filter((id) => id > 0)
              );
              const selectedAttr = attributeItems.find(
                (i) => i.value === row.attributeId
              ) ?? null;
              const attrDef = attributes.find((a) => a.id === row.attributeId);
              const valueItems: ComboOption[] = (
                attrDef?.values ?? []
              ).map((v) => ({ value: v.id, label: v.value }));
              const selectedVal =
                valueItems.find((i) => i.value === row.valueId) ?? null;

              return (
                <div
                  key={index}
                  className="space-y-3 rounded-lg border border-border/60 bg-card p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Attribute
                    </span>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAttrRow(index)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10"
                        title="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  <Combobox
                    items={attributeItems}
                    value={selectedAttr}
                    onValueChange={(item) =>
                      handleAttrChange(
                        index,
                        "attributeId",
                        item?.value ?? 0
                      )
                    }
                    isItemEqualToValue={comboEq}
                  >
                    <ComboboxInput
                      placeholder="Search or select attribute…"
                      showClear={row.attributeId > 0}
                      className="rounded-xl"
                    />
                    <ComboboxContent sideOffset={4} className="z-[200]">
                      <ComboboxEmpty>No attributes found.</ComboboxEmpty>
                      <ComboboxList>
                        {attributeItems.map((item) => {
                          const disabled =
                            takenElsewhere.has(item.value) &&
                            item.value !== row.attributeId;
                          return (
                            <ComboboxItem
                              key={item.value}
                              value={item}
                              disabled={disabled}
                              className={cn(disabled && "opacity-50")}
                            >
                              {disabled
                                ? `${item.label} (already used)`
                                : item.label}
                            </ComboboxItem>
                          );
                        })}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Value
                    </label>
                    <Combobox
                      items={valueItems}
                      value={selectedVal}
                      onValueChange={(item) =>
                        handleAttrChange(
                          index,
                          "valueId",
                          item?.value ?? 0
                        )
                      }
                      isItemEqualToValue={comboEq}
                    >
                      <ComboboxInput
                        placeholder={
                          row.attributeId
                            ? "Search or select value…"
                            : "Select attribute first"
                        }
                        showClear={row.valueId > 0}
                        disabled={!row.attributeId}
                        className="rounded-xl"
                      />
                      <ComboboxContent sideOffset={4} className="z-[200]">
                        <ComboboxEmpty>No values found.</ComboboxEmpty>
                        <ComboboxList>
                          {valueItems.map((item) => (
                            <ComboboxItem key={item.value} value={item}>
                              {item.label}
                            </ComboboxItem>
                          ))}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/15 p-4">
          <label className="mb-3 block text-base font-semibold text-foreground">
            SKU <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap items-stretch gap-2">
            {skuEditing ? (
              <Input
                ref={variantSkuInputRef}
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Enter SKU"
                className="min-w-0 flex-1 font-mono"
              />
            ) : (
              <div className="flex min-h-[42px] min-w-0 flex-1 items-center rounded-xl border border-border/70 bg-transparent px-3 font-mono text-sm text-foreground">
                <span className="break-all">{sku.trim() || "—"}</span>
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-11 shrink-0 rounded-xl"
              title="Generate SKU"
              onClick={handleGenerateSku}
            >
              <Sparkles className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-11 shrink-0 rounded-xl"
              title={skuEditing ? "Done" : "Edit SKU"}
              onClick={handleVariantSkuPencilClick}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            SKU can be suggested from the product name and attributes; use the
            icons to regenerate or edit manually.
          </p>
        </div>
      </div>
    </Modal>
  );
}
