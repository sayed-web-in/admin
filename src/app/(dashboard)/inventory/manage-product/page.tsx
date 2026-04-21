"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Package,
  Store,
  FileText,
  AlertTriangle,
  ImageIcon,
  Eye,
  Pencil,
  Trash2,
  Plus,
  RotateCcw,
  LayoutGrid,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/utils";
import { resolveMediaUrl } from "@/app/(dashboard)/inventory/add-product/media";
import { unwrapPaginated, extractApiList } from "@/lib/apiList";
import { StatCard } from "@/components/common/StatCard";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import {
  TableRowActions,
  TableRowActionLink,
  TableRowActionButton,
  tableActionIconClassName,
} from "@/components/common/TableRowActions";
import { InventoryTablePagination } from "@/components/inventory/InventoryTablePagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 20;

interface Brand {
  id: number;
  name: string;
}
interface Category {
  id: number;
  name: string;
}

interface StoreProduct {
  id: number;
  productId: number;
  productName: string;
  image?: string;
  brandName?: string;
  categoryName?: string;
  type: string;
  variantLabel?: string;
  sku: string;
  quantity: number;
  sellingPrice: number;
  discountType?: string;
  discountValue?: number;
  status: string;
}

interface DraftProduct {
  id: number;
  name: string;
  image?: string;
  type: string;
  sku?: string;
  categoryName?: string;
  brandName?: string;
  createdAt: string;
  status: string;
}

function normalizeStoreRow(sp: {
  id: number;
  productId: number;
  quantity: number;
  sellingPrice: unknown;
  discountType?: string | null;
  discountValue?: unknown | null;
  isActive?: boolean;
  product: {
    name: string;
    type: string;
    sku?: string | null;
    images?: { url: string }[];
    brand?: { name: string } | null;
    category?: { name: string } | null;
  };
  productVariant?: {
    sku: string;
    attributes?: { attributeValue?: { value: string } | null }[];
  } | null;
}): StoreProduct {
  const pv = sp.productVariant;
  const variantLabel =
    pv?.attributes?.length
      ? pv.attributes
          .map((a) => a.attributeValue?.value)
          .filter(Boolean)
          .join(" / ") || undefined
      : undefined;
  const dt = sp.discountType;
  const discountTypeUi =
    dt === "PERCENTAGE"
      ? "percentage"
      : dt === "FIXED"
        ? "fixed"
        : undefined;
  return {
    id: sp.id,
    productId: sp.productId,
    productName: sp.product.name,
    image: sp.product.images?.[0]?.url,
    brandName: sp.product.brand?.name,
    categoryName: sp.product.category?.name,
    type: sp.product.type,
    variantLabel,
    sku: pv?.sku ?? sp.product.sku ?? "—",
    quantity: sp.quantity,
    sellingPrice: Number(sp.sellingPrice),
    discountType: discountTypeUi,
    discountValue:
      sp.discountValue != null ? Number(sp.discountValue) : undefined,
    status: sp.isActive ? "active" : "inactive",
  };
}

function normalizeDraftRow(p: {
  id: number;
  name: string;
  type: string;
  sku?: string | null;
  createdAt: string;
  status: string;
  category?: { name: string } | null;
  brand?: { name: string } | null;
  images?: { url: string }[];
}): DraftProduct {
  return {
    id: p.id,
    name: p.name,
    image: p.images?.[0]?.url,
    type: p.type,
    sku: p.sku ?? undefined,
    categoryName: p.category?.name,
    brandName: p.brand?.name,
    createdAt: p.createdAt,
    status: p.status,
  };
}

const cardShell =
  "overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.06]";

function SectionHeader({
  icon: Icon,
  title,
  description,
  compact,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
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

export default function ManageProductPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"store" | "draft">("store");
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  const [draftProducts, setDraftProducts] = useState<DraftProduct[]>([]);
  const [loadingStore, setLoadingStore] = useState(true);
  const [loadingDraft, setLoadingDraft] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [storePage, setStorePage] = useState(1);
  const [draftPage, setDraftPage] = useState(1);
  const [storeMeta, setStoreMeta] = useState({
    page: 1,
    lastPage: 1,
    total: 0,
  });
  const [draftMeta, setDraftMeta] = useState({
    page: 1,
    lastPage: 1,
    total: 0,
  });

  const [overviewStats, setOverviewStats] = useState({
    total: 0,
    store: 0,
    draft: 0,
    lowStock: 0,
  });

  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [filterBrand, setFilterBrand] = useState(0);
  const [filterCategory, setFilterCategory] = useState(0);
  const [filterStatus, setFilterStatus] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setStorePage(1);
    setDraftPage(1);
  }, [debouncedSearch, filterBrand, filterCategory, filterStatus]);

  const loadOverview = useCallback(async () => {
    try {
      const [store, draft, low] = await Promise.all([
        apiFetch<unknown>("/products/store?page=1&limit=1"),
        apiFetch<unknown>("/products/draft?page=1&limit=1"),
        apiFetch<unknown>("/products/low-stock?page=1&limit=1"),
      ]);
      const s = unwrapPaginated(store);
      const d = unwrapPaginated(draft);
      const l = unwrapPaginated(low);
      setOverviewStats({
        total: (s?.total ?? 0) + (d?.total ?? 0),
        store: s?.total ?? 0,
        draft: d?.total ?? 0,
        lowStock: l?.total ?? 0,
      });
    } catch {
      setOverviewStats({ total: 0, store: 0, draft: 0, lowStock: 0 });
    }
  }, []);

  const fetchStore = useCallback(async () => {
    setLoadingStore(true);
    try {
      const qs = new URLSearchParams();
      qs.set("page", String(storePage));
      qs.set("limit", String(PAGE_SIZE));
      if (debouncedSearch) qs.set("search", debouncedSearch);
      if (filterBrand > 0) qs.set("brandId", String(filterBrand));
      if (filterCategory > 0) qs.set("categoryId", String(filterCategory));
      if (filterStatus === "active") qs.set("isActive", "true");
      else if (filterStatus === "inactive") qs.set("isActive", "false");

      const res = await apiFetch<unknown>(`/products/store?${qs.toString()}`);
      const p =
        unwrapPaginated<Parameters<typeof normalizeStoreRow>[0]>(res);
      if (p) {
        setStoreProducts(p.data.map(normalizeStoreRow));
        setStoreMeta({
          page: p.page,
          lastPage: p.lastPage,
          total: p.total,
        });
        if (p.page > p.lastPage) {
          setStorePage(p.lastPage);
        }
      } else {
        setStoreProducts([]);
        setStoreMeta({ page: 1, lastPage: 1, total: 0 });
      }
    } catch {
      setStoreProducts([]);
      setStoreMeta({ page: 1, lastPage: 1, total: 0 });
    } finally {
      setLoadingStore(false);
    }
  }, [
    storePage,
    debouncedSearch,
    filterBrand,
    filterCategory,
    filterStatus,
  ]);

  const fetchDraft = useCallback(async () => {
    setLoadingDraft(true);
    try {
      const qs = new URLSearchParams();
      qs.set("page", String(draftPage));
      qs.set("limit", String(PAGE_SIZE));
      if (debouncedSearch) qs.set("search", debouncedSearch);
      if (filterBrand > 0) qs.set("brandId", String(filterBrand));
      if (filterCategory > 0) qs.set("categoryId", String(filterCategory));
      if (filterStatus) qs.set("status", filterStatus);

      const res = await apiFetch<unknown>(`/products/draft?${qs.toString()}`);
      const p = unwrapPaginated<Parameters<typeof normalizeDraftRow>[0]>(res);
      if (p) {
        setDraftProducts(p.data.map(normalizeDraftRow));
        setDraftMeta({
          page: p.page,
          lastPage: p.lastPage,
          total: p.total,
        });
        if (p.page > p.lastPage) {
          setDraftPage(p.lastPage);
        }
      } else {
        setDraftProducts([]);
        setDraftMeta({ page: 1, lastPage: 1, total: 0 });
      }
    } catch {
      setDraftProducts([]);
      setDraftMeta({ page: 1, lastPage: 1, total: 0 });
    } finally {
      setLoadingDraft(false);
    }
  }, [
    draftPage,
    debouncedSearch,
    filterBrand,
    filterCategory,
    filterStatus,
  ]);

  useEffect(() => {
    void loadOverview();
    apiFetch<unknown>("/brands?limit=200")
      .then((res) => {
        const list = extractApiList<Brand>(res, ["brands"]);
        setBrands(list.map((b) => ({ id: b.id, name: b.name })));
      })
      .catch(() => {});
    apiFetch<unknown>("/categories?limit=200")
      .then((res) => {
        const list = extractApiList<Category>(res, ["categories"]);
        setCategories(list.map((c) => ({ id: c.id, name: c.name })));
      })
      .catch(() => {});
  }, [loadOverview]);

  useEffect(() => {
    if (tab !== "store") return;
    void fetchStore();
  }, [tab, fetchStore]);

  useEffect(() => {
    if (tab !== "draft") return;
    void fetchDraft();
  }, [tab, fetchDraft]);

  const handleDeleteStore = useCallback(async (id: number, qty: number) => {
    const msg =
      qty === 0
        ? "This product has 0 stock. It will be archived."
        : "Are you sure you want to delete this store product?";
    if (!confirm(msg)) return;
    try {
      await apiFetch(`/products/store-products/${id}`, { method: "DELETE" });
      await Promise.all([fetchStore(), loadOverview()]);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }, [fetchStore, loadOverview]);

  const handleDeleteDraft = useCallback(async (id: number) => {
    if (!confirm("Are you sure you want to delete this draft?")) return;
    try {
      await apiFetch(`/products/${id}`, { method: "DELETE" });
      await Promise.all([fetchDraft(), loadOverview()]);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Delete failed");
    }
  }, [fetchDraft, loadOverview]);

  const refreshAll = () => {
    void loadOverview();
    if (tab === "store") void fetchStore();
    else void fetchDraft();
  };

  const selectClasses =
    "h-10 rounded-xl border border-input bg-background/80 px-3 text-sm shadow-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const storeColumns = useMemo(
    () => [
      {
        key: "index",
        label: "#",
        className: "w-12",
        render: (_: StoreProduct, i: number) =>
          (storePage - 1) * PAGE_SIZE + i + 1,
      },
      {
        key: "image",
        label: "Img",
        className: "w-[4.75rem]",
        render: (item: StoreProduct) => {
          const src = item.image ? resolveMediaUrl(item.image) : "";
          return src ? (
            <img
              src={src}
              alt=""
              className="h-12 w-12 rounded-xl border border-border/70 object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-muted/30 text-muted-foreground">
              <ImageIcon className="h-5 w-5" aria-hidden />
            </div>
          );
        },
      },
      {
        key: "productName",
        label: "Product",
        render: (item: StoreProduct) => (
          <span className="font-semibold text-foreground">
            {item.productName}
          </span>
        ),
      },
      {
        key: "type",
        label: "Type",
        render: (item: StoreProduct) => (
          <Badge variant={item.type === "VARIABLE" ? "warning" : "secondary"}>
            {item.type}
          </Badge>
        ),
      },
      {
        key: "variant",
        label: "Variant",
        render: (item: StoreProduct) =>
          item.variantLabel ? (
            <span className="inline-flex max-w-[220px] items-center truncate rounded-lg border border-border/70 bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm">
              {item.variantLabel}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-lg border border-dashed border-border/60 bg-muted/25 px-2.5 py-1 text-xs text-muted-foreground">
              —
            </span>
          ),
      },
      { key: "sku", label: "SKU" },
      { key: "quantity", label: "Qty" },
      {
        key: "sellingPrice",
        label: "Selling Price",
        render: (item: StoreProduct) => formatPrice(item.sellingPrice),
      },
      {
        key: "discount",
        label: "Discount",
        render: (item: StoreProduct) => {
          if (!item.discountType || item.discountType === "none") return "—";
          if (item.discountType === "percentage")
            return `${item.discountValue ?? 0}%`;
          return formatPrice(Number(item.discountValue ?? 0));
        },
      },
      {
        key: "actions",
        label: "Actions",
        render: (item: StoreProduct) => (
          <TableRowActions>
            <TableRowActionLink
              href={`/inventory/manage-product/${item.productId}`}
              title="View"
            >
              <Eye className={tableActionIconClassName} aria-hidden />
            </TableRowActionLink>
            <TableRowActionLink
              href={`/inventory/add-product?mode=edit&productId=${item.productId}`}
              title="Edit product"
            >
              <Pencil className={tableActionIconClassName} aria-hidden />
            </TableRowActionLink>
            <TableRowActionButton
              variant="danger"
              title="Remove from store"
              onClick={() => handleDeleteStore(item.id, item.quantity)}
            >
              <Trash2 className={tableActionIconClassName} aria-hidden />
            </TableRowActionButton>
          </TableRowActions>
        ),
      },
    ],
    [storePage, handleDeleteStore]
  );

  const draftColumns = useMemo(
    () => [
      {
        key: "index",
        label: "#",
        className: "w-12",
        render: (_: DraftProduct, i: number) =>
          (draftPage - 1) * PAGE_SIZE + i + 1,
      },
      {
        key: "image",
        label: "Img",
        className: "w-[4.75rem]",
        render: (item: DraftProduct) => {
          const src = item.image ? resolveMediaUrl(item.image) : "";
          return src ? (
            <img
              src={src}
              alt=""
              className="h-12 w-12 rounded-xl border border-border/70 object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/60 bg-muted/30 text-muted-foreground">
              <ImageIcon className="h-5 w-5" aria-hidden />
            </div>
          );
        },
      },
      {
        key: "name",
        label: "Product",
        render: (item: DraftProduct) => (
          <span className="font-semibold text-foreground">{item.name}</span>
        ),
      },
      {
        key: "type",
        label: "Type",
        render: (item: DraftProduct) => (
          <Badge variant={item.type === "VARIABLE" ? "warning" : "secondary"}>
            {item.type}
          </Badge>
        ),
      },
      {
        key: "sku",
        label: "SKU",
        render: (item: DraftProduct) => item.sku || "—",
      },
      {
        key: "categoryName",
        label: "Category",
        render: (item: DraftProduct) => item.categoryName || "—",
      },
      {
        key: "brandName",
        label: "Brand",
        render: (item: DraftProduct) => item.brandName || "—",
      },
      {
        key: "createdAt",
        label: "Created",
        render: (item: DraftProduct) => formatDate(item.createdAt),
      },
      {
        key: "actions",
        label: "Actions",
        render: (item: DraftProduct) => (
          <TableRowActions>
            <TableRowActionLink
              href={`/inventory/manage-product/${item.id}`}
              title="View"
            >
              <Eye className={tableActionIconClassName} aria-hidden />
            </TableRowActionLink>
            <TableRowActionLink
              href={`/inventory/add-product?mode=edit&productId=${item.id}`}
              title="Edit draft"
            >
              <Pencil className={tableActionIconClassName} aria-hidden />
            </TableRowActionLink>
            <TableRowActionButton
              variant="danger"
              title="Delete draft"
              onClick={() => handleDeleteDraft(item.id)}
            >
              <Trash2 className={tableActionIconClassName} aria-hidden />
            </TableRowActionButton>
          </TableRowActions>
        ),
      },
    ],
    [draftPage, handleDeleteDraft]
  );

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
              <Layers className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Manage products
              </h1>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                View store listings and drafts — same layout rhythm as add
                product.
              </p>
            </div>
          </div>
          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 w-full gap-2 rounded-xl border-border/80 bg-background/80 backdrop-blur-sm sm:h-9 sm:w-auto"
              onClick={() => router.back()}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-10 w-full gap-2 rounded-xl border-border/80 bg-background/80 backdrop-blur-sm sm:h-9 sm:w-auto"
              onClick={refreshAll}
            >
              <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
              Refresh
            </Button>
            <Button
              type="button"
              className="h-10 w-full gap-2 rounded-xl shadow-sm sm:h-9 sm:w-auto"
              asChild
            >
              <Link href="/inventory/add-product">
                <Plus className="h-4 w-4 shrink-0" aria-hidden />
                Add product
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="space-y-5 sm:space-y-6">
        <section className={`${cardShell} p-5 sm:p-6 md:p-7`}>
          <SectionHeader
            icon={LayoutGrid}
            title="Overview"
            description="Totals from the server. Low stock counts SKUs at or below branch alert (same as the low-stock page)."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total products"
              value={overviewStats.total}
              icon={Package}
            />
            <StatCard
              title="Store products"
              value={overviewStats.store}
              icon={Store}
            />
            <StatCard
              title="Draft products"
              value={overviewStats.draft}
              icon={FileText}
            />
            <StatCard
              title="Low stock"
              value={overviewStats.lowStock}
              icon={AlertTriangle}
            />
          </div>
        </section>

        <section className={cardShell}>
          <div className="flex flex-col gap-4 border-b border-border/50 bg-muted/15 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-5">
            <SectionHeader
              compact
              icon={Store}
              title="Product catalog"
              description={
                tab === "store"
                  ? "SKUs currently on sale across branches."
                  : "Unpublished catalog entries — open a row to edit or publish."
              }
            />
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
              <div className="flex gap-1 rounded-xl bg-muted/50 p-1 ring-1 ring-border/40">
                <button
                  type="button"
                  onClick={() => setTab("store")}
                  className={`min-h-10 flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:min-h-9 sm:flex-none ${
                    tab === "store"
                      ? "bg-card text-foreground shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.08]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Store
                </button>
                <button
                  type="button"
                  onClick={() => setTab("draft")}
                  className={`min-h-10 flex-1 rounded-lg px-4 py-2 text-sm font-medium transition-colors sm:min-h-9 sm:flex-none ${
                    tab === "draft"
                      ? "bg-card text-foreground shadow-sm ring-1 ring-black/[0.04] dark:ring-white/[0.08]"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Drafts
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-5 sm:p-6 md:p-7">
            <FilterBar
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search products…"
            >
              <select
                value={filterBrand}
                onChange={(e) => setFilterBrand(Number(e.target.value))}
                className={selectClasses}
              >
                <option value={0}>All brands</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(Number(e.target.value))}
                className={selectClasses}
              >
                <option value={0}>All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={selectClasses}
              >
                <option value="">All status</option>
                {tab === "store" ? (
                  <>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </>
                ) : (
                  <>
                    <option value="DRAFT">Draft</option>
                    <option value="ACTIVE">Active</option>
                    <option value="ARCHIVED">Archived</option>
                  </>
                )}
              </select>
            </FilterBar>

            {tab === "store" ? (
              <>
                <DataTable
                  columns={storeColumns}
                  data={storeProducts}
                  loading={loadingStore}
                  inventoryStyle
                />
                <InventoryTablePagination
                  page={storeMeta.page}
                  lastPage={storeMeta.lastPage}
                  total={storeMeta.total}
                  loading={loadingStore}
                  onPageChange={setStorePage}
                />
              </>
            ) : (
              <>
                <DataTable
                  columns={draftColumns}
                  data={draftProducts}
                  loading={loadingDraft}
                  inventoryStyle
                />
                <InventoryTablePagination
                  page={draftMeta.page}
                  lastPage={draftMeta.lastPage}
                  total={draftMeta.total}
                  loading={loadingDraft}
                  onPageChange={setDraftPage}
                />
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
