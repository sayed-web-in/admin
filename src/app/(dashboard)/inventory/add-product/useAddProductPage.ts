"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, uploadProductImage } from "@/lib/api";
import { getSelectedBranch } from "@/lib/auth";
import type { VariantEntry } from "@/components/inventory/VariantModal";
import type { ProductFormState, StoreProductRow } from "./types";
import { hasDescriptionText, isProductInfoValid } from "./utils";

interface CategoryRow {
  id: number;
  name: string;
  branches?: { branch: { id: number; name: string } }[];
}

function extractList<T>(res: unknown): T[] {
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === "object") {
    const o = res as Record<string, unknown>;
    if (Array.isArray(o.data)) return o.data as T[];
  }
  return [];
}

function categoryForBranch(cat: CategoryRow, branchId: number): boolean {
  if (!cat.branches?.length) return true;
  return cat.branches.some((b) => b.branch.id === branchId);
}

/** Only treat all-digit strings as DB ids. UUIDs start with hex digits — `parseInt` would wrongly return a prefix (e.g. 550). */
function parseVariantId(id?: string): number | undefined {
  if (id == null) return undefined;
  const s = String(id).trim();
  if (!/^\d+$/.test(s)) return undefined;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : undefined;
}

/** Stable key from chosen attribute values — used to merge POST/PATCH variants when client id is still a temp UUID. */
function clientVariantValueIdKey(v: VariantEntry): string {
  const ids = v.attributes.map((a) => a.valueId).filter((x) => x > 0);
  ids.sort((a, b) => a - b);
  return ids.join(":");
}

function apiVariantValueIdKey(apiVar: Record<string, unknown>): string {
  const attrs = (apiVar.attributes as Record<string, unknown>[]) || [];
  const ids: number[] = [];
  for (const row of attrs) {
    const av = row.attributeValue as Record<string, unknown> | undefined;
    if (!av || av.id == null) continue;
    const id =
      typeof av.id === "number" ? av.id : parseInt(String(av.id), 10);
    if (Number.isFinite(id) && id > 0) ids.push(id);
  }
  ids.sort((a, b) => a - b);
  return ids.join(":");
}

function emptyFormState(branchId = 0): ProductFormState {
  return {
    name: "",
    description: "",
    productType: "single",
    branchId,
    categoryId: 0,
    subcategoryId: 0,
    brandId: 0,
    unitId: 0,
    taxRateId: 0,
    sku: "",
    hasSerialNumber: false,
    images: [],
    pendingImages: [],
    specifications: [{ name: "", value: "" }],
    variants: [],
  };
}

function mapApiProductToStoreRows(
  product: Record<string, unknown>
): StoreProductRow[] {
  const pid = product.id as number;
  const type = String(product.type || "");
  const rows: StoreProductRow[] = [];
  const list = (product.storeProducts as Record<string, unknown>[]) || [];
  for (const sp of list) {
    if (sp.isActive === false) continue;
    const branch = sp.branch as { id: number; name: string };
    const pv = sp.productVariant as Record<string, unknown> | null | undefined;
    let variantLabel = "";
    let sku = (product.sku as string) || "";
    if (pv) {
      sku = (pv.sku as string) || sku;
      const attrs = (pv.attributes as Record<string, unknown>[]) || [];
      variantLabel = attrs
        .map((a) => {
          const av = a.attributeValue as Record<string, unknown>;
          const attr = av?.attribute as { name?: string };
          return `${attr?.name || "?"}: ${av?.value || "?"}`;
        })
        .join(", ");
    } else if (type === "SINGLE") {
      variantLabel = "Default";
    }
    const batches = (sp.batches as Record<string, unknown>[]) || [];
    const firstBatch = batches[0] as { purchaseCost?: unknown } | undefined;
    const purchaseCostPerUnit = firstBatch
      ? Number(firstBatch.purchaseCost ?? 0)
      : 0;
    const serialNumbers: string[] = [];
    for (const b of batches) {
      const sns = (b.serialNumbers as { serial: string }[]) || [];
      for (const s of sns) serialNumbers.push(s.serial);
    }
    rows.push({
      storeProductId: sp.id as number,
      productId: pid,
      branch,
      variantId: pv ? (pv.id as number) : null,
      variantLabel,
      sku,
      quantity: Number(sp.quantity ?? 0),
      quantityAlert: Number(sp.quantityAlert ?? 0),
      purchaseCostPerUnit,
      sellingPrice: Number(sp.sellingPrice ?? 0),
      discountType: String(sp.discountType ?? ""),
      discountValue: Number(sp.discountValue ?? 0),
      sellingType: String(sp.sellingType ?? "BOTH"),
      createdAt: String(sp.createdAt ?? ""),
      serialNumbers,
    });
  }
  return rows;
}

export function useAddProductPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editProductId = searchParams.get("productId");
  const isEditMode = searchParams.get("mode") === "edit";

  const [draftProductId, setDraftProductId] = useState<number | null>(null);
  const [productStatus, setProductStatus] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(
    isEditMode && !!editProductId
  );

  const [categoriesAll, setCategoriesAll] = useState<CategoryRow[]>([]);
  const [brands, setBrands] = useState<{ id: number; name: string }[]>([]);
  const [units, setUnits] = useState<{ id: number; name: string }[]>([]);
  const [taxRates, setTaxRates] = useState<
    { id: number; name: string; rate: number }[]
  >([]);
  const [subcategories, setSubcategories] = useState<
    { id: number; name: string }[]
  >([]);
  const [dataLoading, setDataLoading] = useState(true);

  const [form, setForm] = useState<ProductFormState>({
    name: "",
    description: "",
    productType: "single",
    branchId: 0,
    categoryId: 0,
    subcategoryId: 0,
    brandId: 0,
    unitId: 0,
    taxRateId: 0,
    sku: "",
    hasSerialNumber: false,
    images: [],
    pendingImages: [],
    specifications: [{ name: "", value: "" }],
    variants: [],
  });

  const [storeRows, setStoreRows] = useState<StoreProductRow[]>([]);
  const [storeLoading, setStoreLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [storeModalOpen, setStoreModalOpen] = useState(false);
  const [editStoreOpen, setEditStoreOpen] = useState(false);
  const [selectedStoreRow, setSelectedStoreRow] = useState<StoreProductRow | null>(
    null
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [rowToDelete, setRowToDelete] = useState<StoreProductRow | null>(null);
  const [serialModalOpen, setSerialModalOpen] = useState(false);
  const [serialModalRows, setSerialModalRows] = useState<
    { serial: string; status?: string }[]
  >([]);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [batchStoreProductId, setBatchStoreProductId] = useState<number | null>(
    null
  );

  const singleSkuAutoDoneRef = useRef(false);

  useEffect(() => {
    if (isEditMode) return;
    if (form.productType !== "single") {
      singleSkuAutoDoneRef.current = false;
      return;
    }
    if (form.sku.trim()) {
      singleSkuAutoDoneRef.current = true;
      return;
    }
    if (singleSkuAutoDoneRef.current) return;
    singleSkuAutoDoneRef.current = true;
    const ts = Date.now().toString().slice(-6);
    setForm((f) => ({ ...f, sku: `SKU-${ts}` }));
  }, [form.productType, form.sku, isEditMode]);

  const categories = useMemo(() => {
    if (!form.branchId) return categoriesAll;
    return categoriesAll.filter((c) => categoryForBranch(c, form.branchId));
  }, [categoriesAll, form.branchId]);

  const hasStoreProducts = storeRows.length > 0;
  const isProductTypeDisabled =
    isEditMode && (productStatus === "ACTIVE" || hasStoreProducts);
  const isSerialDisabled =
    isEditMode && (productStatus === "ACTIVE" || hasStoreProducts);

  const refreshStoreRows = useCallback(async (productId: number) => {
    setStoreLoading(true);
    try {
      const p = await apiFetch<Record<string, unknown>>(`/products/${productId}`);
      setStoreRows(mapApiProductToStoreRows(p));
    } catch {
      setStoreRows([]);
    } finally {
      setStoreLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDataLoading(true);
      try {
        const [cat, brd, un, tax] = await Promise.all([
          apiFetch<unknown>("/categories?limit=500").catch(() => ({ data: [] })),
          apiFetch<unknown>("/brands?limit=500").catch(() => ({ data: [] })),
          apiFetch<unknown>("/units?limit=500").catch(() => ({ data: [] })),
          apiFetch<unknown>("/finance/tax-rates").catch(() => []),
        ]);
        if (cancelled) return;
        setCategoriesAll(extractList<CategoryRow>(cat));
        setBrands(
          extractList<{ id: number; name: string }>(brd).map((b) => ({
            id: b.id,
            name: b.name,
          }))
        );
        setUnits(
          extractList<{ id: number; name: string }>(un).map((u) => ({
            id: u.id,
            name: u.name,
          }))
        );
        const tr = Array.isArray(tax) ? tax : extractList(tax);
        setTaxRates(
          (tr as { id: number; name: string; rate: unknown }[]).map((t) => ({
            id: t.id,
            name: t.name,
            rate: Number(t.rate),
          }))
        );
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isEditMode) return;
    const id = getSelectedBranch();
    if (id) setForm((f) => ({ ...f, branchId: id }));
  }, [isEditMode]);

  useEffect(() => {
    if (isEditMode) return;
    const syncFromHeader = () => {
      const id = getSelectedBranch();
      if (!id) return;
      setForm((prev) => {
        if (prev.branchId === id) return prev;
        return {
          ...prev,
          branchId: id,
          categoryId: 0,
          subcategoryId: 0,
          brandId: 0,
          unitId: 0,
          taxRateId: 0,
        };
      });
    };
    window.addEventListener("branch-changed", syncFromHeader);
    return () => window.removeEventListener("branch-changed", syncFromHeader);
  }, [isEditMode]);

  const loadProductForEdit = useCallback(async (productId: number) => {
    setEditLoading(true);
    try {
      const p = await apiFetch<Record<string, unknown>>(`/products/${productId}`);
      setDraftProductId(productId);
      setProductStatus(String(p.status ?? ""));
      const type = String(p.type) === "VARIABLE" ? "variable" : "single";
      const imgs = ((p.images as { url: string }[]) || []).map((i) => i.url);
      const specs = (p.specifications as { name: string; value: string }[]) || [];
      const variantsApi = (p.variants as Record<string, unknown>[]) || [];
      const variants: VariantEntry[] = variantsApi
        .filter((v) => !v.deletedAt)
        .map((v) => {
          const attrs = (v.attributes as Record<string, unknown>[]) || [];
          return {
            id: String(v.id),
            sku: String(v.sku || ""),
            image: (v.image as string) || undefined,
            createdAt: v.createdAt
              ? String(v.createdAt)
              : undefined,
            attributes: attrs.map((a) => {
              const av = a.attributeValue as Record<string, unknown>;
              const attr = av?.attribute as { id: number; name: string };
              return {
                attributeId: attr.id,
                attributeName: attr.name,
                valueId: av.id as number,
                valueName: String(av.value),
              };
            }),
          };
        });

      const storePs = (p.storeProducts as { branch?: { id: number } }[]) || [];
      let branchId = 0;
      const firstSp = storePs.find((s) => s.branch?.id);
      if (firstSp?.branch?.id) branchId = firstSp.branch.id;
      else {
        const cat = p.category as {
          branches?: { branch: { id: number } }[];
        } | null;
        if (cat?.branches?.length) branchId = cat.branches[0].branch.id;
      }

      setForm({
        name: String(p.name || ""),
        description: String(p.description || ""),
        productType: type,
        branchId,
        categoryId: (p.category as { id: number } | null)?.id ?? 0,
        subcategoryId: (p.subCategory as { id: number } | null)?.id ?? 0,
        brandId: (p.brand as { id: number } | null)?.id ?? 0,
        unitId: (p.unit as { id: number } | null)?.id ?? 0,
        taxRateId: (p.taxRate as { id: number } | null)?.id ?? 0,
        sku: String(p.sku || ""),
        hasSerialNumber: Boolean(p.hasImei),
        images: imgs,
        pendingImages: [],
        specifications: specs.length > 0 ? specs : [{ name: "", value: "" }],
        variants,
      });
      setStoreRows(mapApiProductToStoreRows(p));
    } catch {
      toast.error("Failed to load product");
    } finally {
      setEditLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isEditMode || !editProductId) return;
    const id = parseInt(editProductId, 10);
    if (Number.isNaN(id)) return;
    void loadProductForEdit(id);
  }, [isEditMode, editProductId, loadProductForEdit]);

  const resetForm = useCallback(() => {
    if (isEditMode && editProductId) {
      const id = parseInt(editProductId, 10);
      if (!Number.isNaN(id)) {
        void loadProductForEdit(id);
        toast.info("Form restored from server");
      }
      return;
    }
    if (
      !window.confirm(
        "Clear all fields? Unsaved changes on this page will be lost."
      )
    ) {
      return;
    }
    const branchId = getSelectedBranch() ?? 0;
    setForm(emptyFormState(branchId));
    setDraftProductId(null);
    setProductStatus(null);
    setStoreRows([]);
    toast.success("Form cleared");
  }, [isEditMode, editProductId, loadProductForEdit]);

  useEffect(() => {
    if (!form.categoryId) {
      setSubcategories([]);
      return;
    }
    apiFetch<{ subcategories?: { id: number; name: string }[] }>(
      `/categories/${form.categoryId}`
    )
      .then((d) => {
        const subs = d.subcategories || [];
        setSubcategories(subs);
        if (
          form.subcategoryId &&
          !subs.some((s) => s.id === form.subcategoryId)
        ) {
          setForm((f) => ({ ...f, subcategoryId: 0 }));
        }
      })
      .catch(() => setSubcategories([]));
  }, [form.categoryId, form.subcategoryId]);

  const uploadPending = useCallback(async (state: ProductFormState) => {
    const tempToUrl = new Map<string, string>();
    for (const item of state.pendingImages) {
      const url = await uploadProductImage(item.file);
      tempToUrl.set(item.tempUrl, url);
    }
    for (const item of state.pendingImages) {
      if (item.tempUrl.startsWith("blob:")) {
        URL.revokeObjectURL(item.tempUrl);
      }
    }
    const images = state.images.map((u) =>
      u.startsWith("blob:") ? tempToUrl.get(u) || u : u
    );
    const variants: VariantEntry[] = [];
    for (const v of state.variants) {
      let imageUrl = v.image || "";
      if (v.pendingImage?.file) {
        imageUrl = await uploadProductImage(v.pendingImage.file);
        if (v.pendingImage.tempUrl.startsWith("blob:")) {
          URL.revokeObjectURL(v.pendingImage.tempUrl);
        }
      } else if (imageUrl.startsWith("blob:")) {
        throw new Error(
          "Please reselect variant image(s) before saving the product."
        );
      }
      const { pendingImage: _p, ...rest } = v;
      variants.push({
        ...rest,
        image: imageUrl || undefined,
      });
    }
    return {
      ...state,
      images,
      pendingImages: [],
      variants,
    };
  }, []);

  const buildPayload = useCallback(
    (state: ProductFormState, type: "SINGLE" | "VARIABLE") => {
      const specs = state.specifications.filter(
        (s) => s.name.trim() && s.value.trim()
      );
      const images = state.images
        .filter((u) => u && !u.startsWith("blob:"))
        .map((url, i) => ({ url, sortOrder: i }));
      const variants =
        type === "VARIABLE"
          ? state.variants.map((v) => ({
              id: parseVariantId(v.id),
              sku: v.sku?.trim() || undefined,
              image: v.image || undefined,
              attributeValueIds: v.attributes
                .map((a) => a.valueId)
                .filter((x) => x > 0),
            }))
          : undefined;
      return {
        name: state.name.trim(),
        type,
        sku: type === "SINGLE" ? state.sku.trim() || undefined : undefined,
        categoryId: state.categoryId || undefined,
        subCategoryId: state.subcategoryId || undefined,
        brandId: state.brandId || undefined,
        unitId: state.unitId || undefined,
        taxRateId: state.taxRateId || undefined,
        hasImei: state.hasSerialNumber,
        description: hasDescriptionText(state.description)
          ? state.description
          : undefined,
        specifications: specs.length ? specs : undefined,
        images: images.length ? images : undefined,
        variants,
      };
    },
    []
  );

  const mergeVariantsFromResponse = useCallback(
    (prepared: ProductFormState, result: Record<string, unknown>) => {
      const apiVars = (result.variants as Record<string, unknown>[]) || [];
      const desc =
        typeof result.description === "string" ? result.description : undefined;
      if (prepared.productType !== "variable" || !apiVars.length) {
        setForm((prev) => ({
          ...prev,
          images: prepared.images,
          pendingImages: [],
          ...(desc !== undefined ? { description: desc } : {}),
        }));
        return;
      }
      setForm((prev) => ({
        ...prev,
        images: prepared.images,
        pendingImages: [],
        ...(desc !== undefined ? { description: desc } : {}),
        variants: prepared.variants.map((v) => {
          const sid = parseVariantId(v.id);
          const byId =
            sid != null
              ? apiVars.find((x) => Number(x.id) === sid)
              : undefined;
          const skuTrim = (v.sku || "").trim();
          const bySku =
            skuTrim.length > 0
              ? apiVars.find(
                  (x) => String(x.sku || "").trim() === skuTrim
                )
              : undefined;
          const attrKey = clientVariantValueIdKey(v);
          const byAttrs =
            attrKey.length > 0
              ? apiVars.find((x) => apiVariantValueIdKey(x) === attrKey)
              : undefined;
          const found = byId ?? bySku ?? byAttrs;
          if (found)
            return {
              ...v,
              id: String(found.id),
              sku: String(found.sku || v.sku),
              ...(found.createdAt
                ? { createdAt: String(found.createdAt) }
                : {}),
            };
          return v;
        }),
      }));
    },
    []
  );

  const saveProductInfo = useCallback(async () => {
    if (!isProductInfoValid(form)) {
      toast.error("Please fill in all required fields");
      return;
    }
    const typeEarly = form.productType === "variable" ? "VARIABLE" : "SINGLE";
    if (typeEarly === "VARIABLE" && !form.variants.length) {
      toast.error("Add at least one variant");
      return;
    }
    setActionLoading(true);
    try {
      const prepared = await uploadPending(form);
      setForm(prepared);
      const type = prepared.productType === "variable" ? "VARIABLE" : "SINGLE";
      const body = buildPayload(prepared, type);
      let result: Record<string, unknown>;
      const pid = draftProductId;
      if (pid) {
        result = await apiFetch<Record<string, unknown>>(`/products/${pid}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        result = await apiFetch<Record<string, unknown>>("/products", {
          method: "POST",
          body: JSON.stringify(body),
        });
        const newId = result.id as number;
        setDraftProductId(newId);
        setProductStatus(String(result.status ?? "DRAFT"));
      }
      mergeVariantsFromResponse(prepared, result);
      toast.success("Product saved");
      const id = (result.id as number) || pid;
      if (id) await refreshStoreRows(id);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setActionLoading(false);
    }
  }, [form, draftProductId, buildPayload, uploadPending, mergeVariantsFromResponse, refreshStoreRows]);

  const handleEditStoreSubmit = useCallback(
    async (data: import("./EditStoreProductModal").EditStoreProductFormData) => {
      if (!selectedStoreRow) return;
      setActionLoading(true);
      try {
        const payload: Record<string, unknown> = {
          sellingPrice: parseFloat(data.sellingPrice) || 0,
          quantityAlert: parseInt(data.quantityAlert, 10) || 0,
          sellingType:
            data.sellingType === "online"
              ? "ONLINE"
              : data.sellingType === "store"
                ? "STORE"
                : "BOTH",
        };
        if (data.discountType === "percentage") {
          payload.discountType = "PERCENTAGE";
          payload.discountValue = parseFloat(data.discountValue) || 0;
        } else if (data.discountType === "fixed") {
          payload.discountType = "FIXED";
          payload.discountValue = parseFloat(data.discountValue) || 0;
        } else {
          payload.discountType = null;
          payload.discountValue = null;
        }
        const pc = parseFloat(data.purchaseCostPerUnit);
        if (!Number.isNaN(pc) && data.purchaseCostPerUnit.trim() !== "") {
          payload.purchaseCostPerUnit = pc;
        }
        await apiFetch(`/products/store-products/${selectedStoreRow.storeProductId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Store product updated");
        setEditStoreOpen(false);
        setSelectedStoreRow(null);
        if (draftProductId) await refreshStoreRows(draftProductId);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Update failed");
      } finally {
        setActionLoading(false);
      }
    },
    [selectedStoreRow, draftProductId, refreshStoreRows]
  );

  const handleDeleteStoreRow = useCallback(async () => {
    if (!rowToDelete) return;
    setActionLoading(true);
    try {
      await apiFetch(`/products/store-products/${rowToDelete.storeProductId}`, {
        method: "DELETE",
      });
      toast.success("Store listing removed");
      setDeleteConfirmOpen(false);
      setRowToDelete(null);
      if (draftProductId) await refreshStoreRows(draftProductId);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setActionLoading(false);
    }
  }, [rowToDelete, draftProductId, refreshStoreRows]);

  const addVariant = useCallback((v: VariantEntry) => {
    setForm((f) => ({ ...f, variants: [...f.variants, v] }));
  }, []);

  const removeVariant = useCallback((id: string) => {
    setForm((f) => ({
      ...f,
      variants: f.variants.filter((x) => x.id !== id),
    }));
  }, []);

  const setField = useCallback(
    <K extends keyof ProductFormState>(key: K, value: ProductFormState[K]) => {
      setForm((f) => ({ ...f, [key]: value }));
    },
    []
  );

  return {
    router,
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
    hasStoreProducts,
    isProductTypeDisabled,
    isSerialDisabled,
    saveProductInfo,
    resetForm,
    refreshStoreRows,
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
    isTab1Valid: () => isProductInfoValid(form),
  };
}
