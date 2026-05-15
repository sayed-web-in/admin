"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Store, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { getSelectedBranch } from "@/lib/auth";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import type { StoreProductRow } from "@/app/(dashboard)/inventory/add-product/types";
import type { VariantEntry } from "./VariantModal";

interface Branch {
  id: number;
  name: string;
}

interface Supplier {
  id: number;
  name: string;
}

type SupplierCombo = { value: number; label: string };

function supplierEq(a: SupplierCombo, b: SupplierCombo) {
  return a.value === b.value;
}

/** Saved variant = numeric DB id (string of digits). */
function isVariantSavedForStore(v: VariantEntry): boolean {
  return !!v.id && /^\d+$/.test(String(v.id).trim());
}

function variantOptionValue(v: VariantEntry, index: number): string {
  if (v.id != null && String(v.id).trim() !== "") return String(v.id);
  return `__pending__${index}`;
}

function parseVariantDbId(idStr: string): number | undefined {
  if (!idStr || !/^\d+$/.test(idStr)) return undefined;
  const n = parseInt(idStr, 10);
  return Number.isFinite(n) ? n : undefined;
}

interface StoreProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: number | null;
  productType: "SINGLE" | "VARIABLE";
  hasImei: boolean;
  variants: VariantEntry[];
  /** Current branch listings for this product — used to disable duplicates (seller-admin behavior). */
  existingStoreRows?: StoreProductRow[];
  /** When false, hide supplier / quantity / purchase cost / serial fields (seller-admin default OFF). */
  showStockFields?: boolean;
  onAdded?: () => void;
}

export function StoreProductModal({
  open,
  onOpenChange,
  productId,
  productType,
  hasImei,
  variants,
  existingStoreRows = [],
  showStockFields = false,
  onAdded,
}: StoreProductModalProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [serverVariants, setServerVariants] = useState<VariantEntry[] | null>(null);

  const [branchId, setBranchId] = useState(0);
  const [variantId, setVariantId] = useState("");

  const [supplierId, setSupplierId] = useState(0);
  const [quantity, setQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [qtyAlert, setQtyAlert] = useState("");
  const [discountType, setDiscountType] = useState<"none" | "fixed" | "percentage">(
    "none"
  );
  const [discountValue, setDiscountValue] = useState("");
  const [sellingType, setSellingType] = useState<"online" | "store" | "both">(
    "both"
  );
  const [isBestDeal, setIsBestDeal] = useState(false);
  const [isFeatured, setIsFeatured] = useState(false);

  const [currentSerialInput, setCurrentSerialInput] = useState("");
  const [serialNumbers, setSerialNumbers] = useState<string[]>([]);

  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<string, string>>
  >({});
  const [saving, setSaving] = useState(false);

  const variantsForStore = useMemo(
    () => (serverVariants && serverVariants.length > 0 ? serverVariants : variants),
    [serverVariants, variants]
  );

  const supplierItems = useMemo<SupplierCombo[]>(
    () => suppliers.map((s) => ({ value: s.id, label: s.name })),
    [suppliers]
  );
  const selectedSupplier = useMemo(
    () => supplierItems.find((i) => i.value === supplierId) ?? null,
    [supplierItems, supplierId]
  );

  const resetFormFields = useCallback(() => {
    setBranchId(0);
    setVariantId("");
    setSupplierId(0);
    setQuantity("");
    setPurchasePrice("");
    setSellingPrice("");
    setQtyAlert("");
    setDiscountType("none");
    setDiscountValue("");
    setSellingType("both");
    setIsBestDeal(false);
    setIsFeatured(false);
    setCurrentSerialInput("");
    setSerialNumbers([]);
    setDuplicateMessage(null);
    setFieldErrors({});
  }, []);

  useEffect(() => {
    if (!open) return;
    resetFormFields();
    setServerVariants(null);
    apiFetch<unknown>("/branches")
      .then((res) => {
        const list = Array.isArray(res) ? (res as Branch[]) : [];
        setBranches(list.map((b) => ({ id: b.id, name: b.name })));
      })
      .catch(() => setBranches([]));
    apiFetch<unknown>("/suppliers?limit=500")
      .then((res) => {
        const list = Array.isArray(res)
          ? res
          : res &&
              typeof res === "object" &&
              "data" in res &&
              Array.isArray((res as { data: unknown }).data)
            ? (res as { data: Supplier[] }).data
            : [];
        setSuppliers(list.map((s) => ({ id: s.id, name: s.name })));
      })
      .catch(() => setSuppliers([]));
  }, [open, resetFormFields]);

  useEffect(() => {
    if (!open || productType !== "VARIABLE" || !productId) return;
    apiFetch<Record<string, unknown>>(`/products/${productId}`)
      .then((res) => {
        const payload =
          res && typeof res === "object" && res.data && typeof res.data === "object"
            ? (res.data as Record<string, unknown>)
            : res;
        const apiVariants = Array.isArray(payload.variants)
          ? (payload.variants as Record<string, unknown>[])
          : [];
        const mapped: VariantEntry[] = apiVariants
          .filter((v) => !v.deletedAt)
          .map((v) => {
            const attrs = Array.isArray(v.attributes)
              ? (v.attributes as Record<string, unknown>[])
              : [];
            return {
              id: String(v.id ?? ""),
              sku: String(v.sku ?? ""),
              image: typeof v.image === "string" ? v.image : undefined,
              createdAt: v.createdAt ? String(v.createdAt) : undefined,
              attributes: attrs.map((a) => {
                const av = (a.attributeValue || {}) as Record<string, unknown>;
                const attr = (av.attribute || {}) as Record<string, unknown>;
                return {
                  attributeId: Number(attr.id ?? 0),
                  attributeName: String(attr.name ?? ""),
                  valueId: Number(av.id ?? 0),
                  valueName: String(av.value ?? ""),
                };
              }),
            };
          });
        setServerVariants(mapped);
      })
      .catch(() => {
        setServerVariants(null);
      });
  }, [open, productType, productId]);

  useEffect(() => {
    if (!open || branches.length === 0) return;
    const headerBranchId = getSelectedBranch();
    if (
      headerBranchId != null &&
      branches.some((b) => b.id === headerBranchId)
    ) {
      setBranchId(headerBranchId);
    }
  }, [open, branches]);

  useEffect(() => {
    const onBranchChanged = () => {
      if (!open) return;
      const id = getSelectedBranch();
      if (id != null && branches.some((b) => b.id === id)) {
        setBranchId(id);
      }
    };
    window.addEventListener("branch-changed", onBranchChanged);
    return () => window.removeEventListener("branch-changed", onBranchChanged);
  }, [open, branches]);

  useEffect(() => {
    if (!open) {
      setDuplicateMessage(null);
      return;
    }
    if (!branchId) {
      setDuplicateMessage(null);
      return;
    }
    if (productType === "SINGLE") {
      const exists = existingStoreRows.some((r) => r.branch.id === branchId);
      setDuplicateMessage(
        exists
          ? "This product is already added for the selected store. If you want to add the same product in the same store again, please use the Purchase option."
          : null
      );
      return;
    }
    if (!variantId) {
      setDuplicateMessage(null);
      return;
    }
    const vid = parseVariantDbId(variantId);
    if (vid == null) {
      setDuplicateMessage(null);
      return;
    }
    const exists = existingStoreRows.some(
      (r) => r.branch.id === branchId && r.variantId === vid
    );
    setDuplicateMessage(
      exists
        ? "This product is already added for the selected store. If you want to add the same product in the same store again, please use the Purchase option."
        : null
    );
  }, [open, branchId, variantId, productType, existingStoreRows]);

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleBranchChange = (v: string) => {
    setBranchId(v ? Number(v) : 0);
    if (duplicateMessage) setDuplicateMessage(null);
    clearFieldError("branchId");
  };

  const handleVariantChange = (v: string) => {
    setVariantId(v || "");
    clearFieldError("variantId");
  };

  const handleSerialKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !currentSerialInput.trim()) return;
    e.preventDefault();
    const trimmed = currentSerialInput.trim();
    if (serialNumbers.includes(trimmed)) {
      setCurrentSerialInput("");
      return;
    }
    const cap = parseInt(quantity, 10) || 0;
    if (serialNumbers.length >= cap) {
      setCurrentSerialInput("");
      return;
    }
    setSerialNumbers((prev) => [...prev, trimmed]);
    setCurrentSerialInput("");
  };

  const showDetailsSection =
    branchId > 0 &&
    (productType === "SINGLE" || !!variantId) &&
    !duplicateMessage;

  const handleClose = () => {
    resetFormFields();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    setFieldErrors({});
    const errs: Record<string, string> = {};
    if (!productId) {
      toast.error("Save the product first.");
      return;
    }
    if (!branchId) errs.branchId = "Please select a branch";
    if (productType === "VARIABLE") {
      if (!variantId?.trim()) {
        errs.variantId = "Please select a variant";
      } else if (parseVariantDbId(variantId) == null) {
        errs.variantId = "Save the product first so variants get IDs, then add to store";
      }
    }
    if (
      !sellingPrice?.trim() ||
      Number.isNaN(parseFloat(sellingPrice)) ||
      parseFloat(sellingPrice) <= 0
    ) {
      errs.sellingPrice = "Please enter a valid selling price";
    }
    const qtyNum = quantity?.trim()
      ? Math.max(0, parseInt(quantity, 10) || 0)
      : 0;
    if (
      showStockFields &&
      qtyNum > 0 &&
      (!purchasePrice?.trim() || parseFloat(purchasePrice) < 0)
    ) {
      errs.purchasePrice =
        "Please enter purchase cost per unit when quantity is given";
    }
    if (
      showStockFields &&
      hasImei &&
      quantity?.trim() &&
      parseInt(quantity, 10) > 0 &&
      serialNumbers.length !== parseInt(quantity, 10)
    ) {
      errs.serialNumbers = `Please enter exactly ${parseInt(quantity, 10)} serial/IMEI numbers`;
    }
    if (duplicateMessage) {
      toast.error(duplicateMessage);
      return;
    }
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    let productVariantId: number | undefined;
    if (productType === "VARIABLE") {
      productVariantId = parseVariantDbId(variantId)!;
    } else if (variantsForStore[0] && isVariantSavedForStore(variantsForStore[0])) {
      productVariantId = parseInt(String(variantsForStore[0].id), 10);
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        productId,
        branchId,
        productVariantId,
        supplierId: supplierId || undefined,
        quantity: qtyNum,
        purchaseCost: purchasePrice ? Number(purchasePrice) : 0,
        sellingPrice: Number(sellingPrice),
        quantityAlert: qtyAlert ? Number(qtyAlert) : undefined,
        discountType:
          discountType === "percentage"
            ? "PERCENTAGE"
            : discountType === "fixed"
              ? "FIXED"
              : undefined,
        discountValue: discountType !== "none" ? Number(discountValue) : undefined,
        sellingType:
          sellingType === "online"
            ? "ONLINE"
            : sellingType === "store"
              ? "STORE"
              : "BOTH",
        isBestDeal,
        isFeatured,
      };
      if (showStockFields && hasImei && qtyNum > 0) {
        payload.serialNumbers = serialNumbers;
      }
      await apiFetch("/products/add-to-store", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      toast.success("Added to store");
      onAdded?.();
      handleClose();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  };

  const selectError = (key: string) =>
    fieldErrors[key] ? "border-destructive aria-invalid:ring-destructive/25" : "";

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        if (!o) resetFormFields();
        onOpenChange(o);
      }}
      title="Add store product"
      description="Choose branch and variant, then set stock, cost, and pricing."
      icon={<Store className="h-5 w-5" aria-hidden />}
      size="lg"
      footer={
        <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl sm:w-auto"
            onClick={handleClose}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="w-full rounded-xl sm:w-auto"
            disabled={saving || !!duplicateMessage || !showDetailsSection}
            onClick={() => void handleSubmit()}
          >
            {saving ? "Adding…" : "Add store product"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Branch <span className="text-red-500">*</span>
          </label>
          <Select
            value={branchId ? String(branchId) : undefined}
            onValueChange={handleBranchChange}
          >
            <SelectTrigger
              className={`min-h-[42px] w-full rounded-xl ${selectError("branchId")}`}
            >
              <SelectValue placeholder="Select branch" />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[200] rounded-xl">
              <SelectGroup>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {(fieldErrors.branchId || (duplicateMessage && productType === "SINGLE")) && (
            <p className="mt-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs text-destructive">
              {fieldErrors.branchId || duplicateMessage}
            </p>
          )}
        </div>

        {productType === "VARIABLE" && variantsForStore.length > 0 && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              Variant <span className="text-red-500">*</span>
            </label>
            <Select
              value={variantId || undefined}
              onValueChange={handleVariantChange}
            >
              <SelectTrigger
                className={`min-h-[42px] w-full rounded-xl ${selectError("variantId")}`}
              >
                <SelectValue placeholder="Select variant" />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[200] rounded-xl">
                <SelectGroup>
                  {variantsForStore.map((v, idx) => {
                    const val = variantOptionValue(v, idx);
                    const saved = isVariantSavedForStore(v);
                    const dbId = saved ? parseInt(String(v.id), 10) : null;
                    const already =
                      branchId > 0 &&
                      dbId != null &&
                      existingStoreRows.some(
                        (row) =>
                          row.branch.id === branchId && row.variantId === dbId
                      );
                    const disabled = already || !saved;
                    const labelBase = v.attributes
                      .map((a) => `${a.attributeName}: ${a.valueName}`)
                      .join(", ");
                    const suffix = already
                      ? " (Already added)"
                      : !saved
                        ? " (Save product first)"
                        : "";
                    return (
                      <SelectItem
                        key={val}
                        value={val}
                        disabled={disabled}
                        className={disabled ? "opacity-50" : ""}
                      >
                        {labelBase || v.sku}
                        {suffix}
                      </SelectItem>
                    );
                  })}
                </SelectGroup>
              </SelectContent>
            </Select>
            {(fieldErrors.variantId || duplicateMessage) && (
              <p className="mt-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs text-destructive">
                {fieldErrors.variantId || duplicateMessage}
              </p>
            )}
          </div>
        )}

        {showDetailsSection && (
          <>
            {showStockFields ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Supplier
              </label>
              <Combobox
                items={supplierItems}
                value={selectedSupplier}
                onValueChange={(item) => {
                  setSupplierId(item?.value ?? 0);
                }}
                isItemEqualToValue={supplierEq}
              >
                <ComboboxInput
                  placeholder="Search or select supplier…"
                  showClear={supplierId > 0}
                  className="rounded-xl"
                />
                <ComboboxContent sideOffset={4} className="z-[200]">
                  <ComboboxEmpty>No suppliers found.</ComboboxEmpty>
                  <ComboboxList>
                    {supplierItems.map((item) => (
                      <ComboboxItem key={item.value} value={item}>
                        {item.label}
                      </ComboboxItem>
                    ))}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {showStockFields ? (
              <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Quantity
                </label>
                <Input
                  type="number"
                  min={0}
                  value={quantity}
                  onChange={(e) => {
                    setQuantity(e.target.value);
                  }}
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="Enter quantity"
                  className="rounded-xl"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Purchase cost per unit (average)
                  {quantity && parseInt(quantity, 10) > 0 && (
                    <span className="text-red-500"> *</span>
                  )}
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={purchasePrice}
                  onChange={(e) => {
                    setPurchasePrice(e.target.value);
                    clearFieldError("purchasePrice");
                  }}
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0.00"
                  className={`rounded-xl ${fieldErrors.purchasePrice ? "border-destructive" : ""}`}
                />
                {fieldErrors.purchasePrice && (
                  <p className="mt-1 text-xs text-destructive">
                    {fieldErrors.purchasePrice}
                  </p>
                )}
              </div>
              </>
              ) : null}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Selling price <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={sellingPrice}
                  onChange={(e) => {
                    setSellingPrice(e.target.value);
                    clearFieldError("sellingPrice");
                  }}
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="0.00"
                  className={`rounded-xl ${fieldErrors.sellingPrice ? "border-destructive" : ""}`}
                />
                {fieldErrors.sellingPrice && (
                  <p className="mt-1 text-xs text-destructive">
                    {fieldErrors.sellingPrice}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Quantity alert (low stock threshold)
                </label>
                <Input
                  type="number"
                  min={0}
                  value={qtyAlert}
                  onChange={(e) => setQtyAlert(e.target.value)}
                  onWheel={(e) => e.currentTarget.blur()}
                  placeholder="Threshold"
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Discount type
                </label>
                <Select
                  value={discountType}
                  onValueChange={(val) =>
                    setDiscountType(val as "none" | "fixed" | "percentage")
                  }
                >
                  <SelectTrigger className="min-h-[42px] w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" className="z-[200] rounded-xl">
                    <SelectGroup>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="fixed">Fixed amount</SelectItem>
                      <SelectItem value="percentage">Percentage</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              {discountType !== "none" && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    Discount value
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    onWheel={(e) => e.currentTarget.blur()}
                    placeholder={
                      discountType === "percentage" ? "%" : "Amount"
                    }
                    className="rounded-xl"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Selling type
              </label>
              <Select
                value={sellingType}
                onValueChange={(val) =>
                  setSellingType(val as "online" | "store" | "both")
                }
              >
                <SelectTrigger className="min-h-[42px] w-full rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" className="z-[200] rounded-xl">
                  <SelectGroup>
                    <SelectItem value="online">Online</SelectItem>
                    <SelectItem value="store">Store</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 rounded-xl border border-border/70 bg-muted/20 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium text-foreground">
                    Best deal
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Highlight this listing as a best deal in the store.
                  </p>
                </div>
                <Switch
                  checked={isBestDeal}
                  onCheckedChange={setIsBestDeal}
                  aria-label="Best deal"
                />
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-medium text-foreground">
                    Featured product
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Show this product in featured placements.
                  </p>
                </div>
                <Switch
                  checked={isFeatured}
                  onCheckedChange={setIsFeatured}
                  aria-label="Featured product"
                />
              </div>
            </div>

            {showStockFields && hasImei && (
              <div
                className={
                  fieldErrors.serialNumbers
                    ? "rounded-xl border border-destructive/40 p-3"
                    : ""
                }
              >
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Serial/IMEI numbers
                  {quantity?.trim() && parseInt(quantity, 10) > 0 ? (
                    <span className="text-red-500"> *</span>
                  ) : null}
                </label>
                <p className="mb-2 text-xs text-muted-foreground">
                  Type a serial or IMEI and press Enter to add (total:{" "}
                  {quantity || 0}). Set quantity first to add serials.
                </p>
                <Input
                  value={currentSerialInput}
                  onChange={(e) => setCurrentSerialInput(e.target.value)}
                  onKeyDown={handleSerialKeyDown}
                  disabled={
                    serialNumbers.length >= (parseInt(quantity, 10) || 0)
                  }
                  placeholder="Type IMEI/serial and press Enter…"
                  className={`mb-3 rounded-xl ${fieldErrors.serialNumbers ? "border-destructive" : ""}`}
                />
                {serialNumbers.length > 0 && (
                  <div className="mb-2 flex min-h-[60px] flex-wrap gap-2 rounded-xl border border-border bg-muted/30 p-3">
                    {serialNumbers.map((serial, index) => (
                      <div
                        key={`${serial}-${index}`}
                        className="flex items-center gap-2 rounded-md border border-primary/25 bg-primary/10 px-3 py-1.5 font-mono text-sm text-primary"
                      >
                        <span>{serial}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setSerialNumbers((prev) =>
                              prev.filter((_, i) => i !== index)
                            )
                          }
                          className="text-primary hover:text-destructive"
                          aria-label="Remove"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Entered: {serialNumbers.length} / {quantity || 0}
                </p>
                {fieldErrors.serialNumbers && (
                  <p className="mt-1 text-xs text-destructive">
                    {fieldErrors.serialNumbers}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
