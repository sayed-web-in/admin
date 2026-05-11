"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Tag,
  Layers,
  Pencil,
  Loader2,
  DollarSign,
  Package,
  TrendingUp,
  TrendingDown,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileText,
  RotateCcw,
  LayoutGrid,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { extractApiList, extractBranches } from "@/lib/apiList";
import { formatPrice } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";
import { resolveMediaUrl } from "@/app/(dashboard)/inventory/add-product/media";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
  InventorySectionHeader,
} from "@/components/inventory/InventoryCrudLayout";
import { StatCard } from "@/components/common/StatCard";
import { DataTable } from "@/components/common/DataTable";
import {
  TableRowActions,
  TableRowActionButton,
  tableActionIconClassName,
} from "@/components/common/TableRowActions";
import { InventoryTablePagination } from "@/components/inventory/InventoryTablePagination";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getMergedNoteLines,
  type NoteRow,
} from "@/components/inventory/price-list/exportNoteUtils";

const DEFAULT_LIMIT = 15;

export type PriceListRow = {
  id: string;
  productId: string;
  variantId: string;
  priceId: string | null;
  productName: string;
  productType: string;
  productImage: string;
  productCreatedAt: string;
  categoryId: string | null;
  brandId: string | null;
  variantDisplay: string;
  sku: string;
  stockQuantity: number;
  lowStockThreshold: number;
  purchasePrice: number;
  sellingPrice: number;
  branchId: string;
};

interface PriceListResponse {
  items: PriceListRow[];
  total: number;
  totalPages: number;
  page: number;
  limit?: number;
  stats?: {
    totalItems: number;
    totalProducts: number;
    totalPurchaseValue: number;
    totalSellingValue: number;
  };
}

function formatMoney(value: number): string {
  return formatPrice(Math.round(Number(value) || 0));
}

export default function PriceListPage() {
  const router = useRouter();
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [filterBranchId, setFilterBranchId] = useState<string>(() => {
    const b = getSelectedBranch();
    return b != null ? String(b) : "";
  });

  useEffect(() => {
    const h = () => {
      const b = getSelectedBranch();
      setFilterBranchId(b != null ? String(b) : "");
    };
    window.addEventListener("branch-changed", h);
    return () => window.removeEventListener("branch-changed", h);
  }, []);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [rows, setRows] = useState<PriceListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterBrandId, setFilterBrandId] = useState("");
  const [filterStockStatus, setFilterStockStatus] = useState("");
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [editingRow, setEditingRow] = useState<PriceListRow | null>(null);
  const [modalPriceValue, setModalPriceValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({
    totalItems: 0,
    totalProducts: 0,
    totalPurchaseValue: 0,
    totalSellingValue: 0,
  });

  const [exportFilterOpen, setExportFilterOpen] = useState(false);
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);
  const [exportBranchId, setExportBranchId] = useState("");
  const [exportCategoryId, setExportCategoryId] = useState("");
  const [exportBrandId, setExportBrandId] = useState("");
  const [exportStockStatus, setExportStockStatus] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [exportLines, setExportLines] = useState<{ line: string; brandId: string | null }[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    void (async () => {
      try {
        const raw = await apiFetch<unknown>("/branches");
        setBranches(extractBranches(raw));
      } catch {
        setBranches([]);
      }
    })();
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await apiFetch<unknown>("/categories?limit=500");
      const list = extractApiList<{ id: number; name: string }>(res, ["categories"]);
      setCategories(
        list.map((c) => ({ id: String(c.id), name: c.name || "—" }))
      );
    } catch {
      setCategories([]);
    }
  }, []);

  const fetchBrands = useCallback(async () => {
    try {
      const res = await apiFetch<unknown>("/brands?limit=500");
      const list = extractApiList<{ id: number; name: string }>(res, ["brands"]);
      setBrands(list.map((b) => ({ id: String(b.id), name: b.name || "—" })));
    } catch {
      setBrands([]);
    }
  }, []);

  useEffect(() => {
    void fetchCategories();
    void fetchBrands();
  }, [fetchCategories, fetchBrands]);

  const fetchPriceList = useCallback(async () => {
    if (!branches.length) {
      setRows([]);
      setTotal(0);
      setTotalPages(1);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (filterBranchId) params.set("branchId", filterBranchId);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (filterCategoryId) params.set("categoryId", filterCategoryId);
      if (filterBrandId) params.set("brandId", filterBrandId);
      if (filterStockStatus) params.set("stockStatus", filterStockStatus);

      const data = await apiFetch<PriceListResponse>(
        `/products/price-list?${params.toString()}`
      );
      const list = data.items || [];
      setRows(list);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
      setStats({
        totalItems: Number(data?.stats?.totalItems ?? data?.total ?? 0),
        totalProducts: Number(data?.stats?.totalProducts ?? 0),
        totalPurchaseValue: Number(data?.stats?.totalPurchaseValue ?? 0),
        totalSellingValue: Number(data?.stats?.totalSellingValue ?? 0),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load price list");
      setRows([]);
      setStats({
        totalItems: 0,
        totalProducts: 0,
        totalPurchaseValue: 0,
        totalSellingValue: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [
    branches.length,
    page,
    limit,
    debouncedSearch,
    filterCategoryId,
    filterBrandId,
    filterStockStatus,
    filterBranchId,
  ]);

  useEffect(() => {
    void fetchPriceList();
  }, [fetchPriceList]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterCategoryId, filterBrandId, filterStockStatus, filterBranchId, limit]);

  const groupedByProduct = useMemo(() => {
    const map: Record<string, PriceListRow[]> = {};
    rows.forEach((r) => {
      if (!map[r.productId]) map[r.productId] = [];
      map[r.productId].push(r);
    });
    return map;
  }, [rows]);

  const tableRows: PriceListRow[] = useMemo(() => {
    const out: PriceListRow[] = [];
    const productIds = Object.keys(groupedByProduct).sort((a, b) => {
      const dateA = groupedByProduct[a][0]?.productCreatedAt || "";
      const dateB = groupedByProduct[b][0]?.productCreatedAt || "";
      return dateB.localeCompare(dateA);
    });
    productIds.forEach((productId) => {
      groupedByProduct[productId].forEach((row) => out.push(row));
    });
    return out;
  }, [groupedByProduct]);

  const openEditModal = useCallback((row: PriceListRow) => {
    if (!row.priceId) {
      toast.error("No price record to edit.");
      return;
    }
    setEditingRow(row);
    setModalPriceValue(String(row.sellingPrice));
  }, []);

  const closeEditModal = () => {
    setEditingRow(null);
    setModalPriceValue("");
  };

  const saveSellingPrice = async () => {
    if (!editingRow?.priceId) return;
    const num = parseFloat(modalPriceValue);
    if (Number.isNaN(num) || num < 0) {
      toast.error("Enter a valid price (number ≥ 0).");
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/products/store-products/${editingRow.priceId}`, {
        method: "PATCH",
        body: JSON.stringify({ sellingPrice: num }),
      });
      setRows((prev) =>
        prev.map((r) =>
          r.priceId === editingRow.priceId ? { ...r, sellingPrice: num } : r
        )
      );
      toast.success("Selling price updated.");
      closeEditModal();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update price");
    } finally {
      setSaving(false);
    }
  };

  const runExportFetch = async () => {
    if (!exportBranchId) {
      toast.error("Please select a branch");
      return;
    }
    setExportLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("branchId", exportBranchId);
      params.set("limit", "9999");
      params.set("page", "1");
      if (exportCategoryId) params.set("categoryId", exportCategoryId);
      if (exportBrandId) params.set("brandId", exportBrandId);
      if (exportStockStatus) params.set("stockStatus", exportStockStatus);

      const data = await apiFetch<PriceListResponse>(
        `/products/price-list?${params.toString()}`
      );
      const list = data.items || [];
      const noteRows: NoteRow[] = list.map((r) => ({
        productName: r.productName,
        sellingPrice: r.sellingPrice,
        variantDisplay: r.variantDisplay,
        sku: r.sku,
        brandId: r.brandId,
      }));
      setExportLines(getMergedNoteLines(noteRows));
      setExportFilterOpen(false);
      setExportPreviewOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setExportLoading(false);
    }
  };

  const openExportFilter = () => {
    setExportBranchId(filterBranchId || (branches[0] ? String(branches[0].id) : ""));
    setExportCategoryId(filterCategoryId);
    setExportBrandId(filterBrandId);
    setExportStockStatus(filterStockStatus);
    setExportFilterOpen(true);
  };

  const copyExportText = async () => {
    const text = exportLines.map((l) => l.line).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed");
    }
  };

  const variantCells = useCallback((row: PriceListRow) => {
    const raw = row.variantDisplay || row.sku || "";
    const byComma = raw.split(/\s*,\s*/).map((p) => p.trim()).filter(Boolean);
    const parts =
      byComma.length > 1
        ? byComma
        : byComma[0]
          ? byComma[0].split(/\s+/).filter(Boolean)
          : [];
    if (parts.length === 0) return <span className="text-muted-foreground">-</span>;
    return (
      <div className="flex flex-wrap gap-1">
        {parts.map((val, i) => (
          <span
            key={i}
            className="inline-block rounded border border-border/70 bg-muted/40 px-1.5 py-0.5 text-xs font-medium text-foreground"
          >
            {val}
          </span>
        ))}
      </div>
    );
  }, []);

  const priceListColumns = useMemo(
    () => [
      {
        key: "index",
        label: "#",
        className: "w-10",
        render: (_: PriceListRow, i: number) => (page - 1) * limit + i + 1,
      },
      {
        key: "image",
        label: "Img",
        className: "w-[4.75rem]",
        render: (row: PriceListRow) => {
          const src = row.productImage ? resolveMediaUrl(row.productImage) : "";
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
        render: (row: PriceListRow) => (
          <span className="font-semibold text-foreground">{row.productName}</span>
        ),
      },
      {
        key: "productType",
        label: "Type",
        render: (row: PriceListRow) => (
          <Badge
            variant={
              String(row.productType).toUpperCase() === "VARIABLE"
                ? "warning"
                : "secondary"
            }
          >
            {row.productType}
          </Badge>
        ),
      },
      {
        key: "variant",
        label: "Variant",
        render: (row: PriceListRow) => (
          <div className="max-w-[min(240px,40vw)]">{variantCells(row)}</div>
        ),
      },
      {
        key: "sku",
        label: "SKU",
        render: (row: PriceListRow) => (
          <span className="font-mono text-xs text-primary">{row.sku || "—"}</span>
        ),
      },
      {
        key: "quantity",
        label: "Qty",
        className: "text-center",
        render: (row: PriceListRow) => (
          <span className="inline-block rounded border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-primary">
            {row.stockQuantity}
          </span>
        ),
      },
      {
        key: "stock",
        label: "Stock",
        className: "text-center",
        render: (row: PriceListRow) => {
          if (row.stockQuantity === 0) {
            return (
              <span className="inline-flex items-center gap-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
                <XCircle className="size-3.5" /> Out
              </span>
            );
          }
          if (
            row.lowStockThreshold > 0 &&
            row.stockQuantity <= row.lowStockThreshold
          ) {
            return (
              <span className="inline-flex items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-400">
                <AlertCircle className="size-3.5" /> Low
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1 rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-400">
              <CheckCircle className="size-3.5" /> In
            </span>
          );
        },
      },
      {
        key: "purchase",
        label: "Purchase",
        className: "text-right",
        render: (row: PriceListRow) => (
          <span className="tabular-nums font-medium text-foreground">
            {formatMoney(row.purchasePrice)}
          </span>
        ),
      },
      {
        key: "sellingPrice",
        label: "Selling",
        className: "text-right",
        render: (row: PriceListRow) => (
          <span className="tabular-nums font-medium text-foreground">
            {formatMoney(row.sellingPrice)}
          </span>
        ),
      },
      {
        key: "actions",
        label: "Actions",
        render: (row: PriceListRow) => (
          <TableRowActions>
            <TableRowActionButton
              title="Edit selling price"
              onClick={() => openEditModal(row)}
            >
              <Pencil className={tableActionIconClassName} aria-hidden />
            </TableRowActionButton>
          </TableRowActions>
        ),
      },
    ],
    [page, limit, variantCells, openEditModal]
  );

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={Tag}
        title="Price List"
        description="View and edit purchase & selling prices by branch."
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 rounded-xl"
          onClick={() => router.back()}
        >
          Back
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 gap-2 rounded-xl"
          onClick={() => void fetchPriceList()}
        >
          <RotateCcw className="h-4 w-4" /> Refresh
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-10 gap-2 rounded-xl"
          onClick={openExportFilter}
        >
          <FileText className="h-4 w-4" /> Export Note
        </Button>
      </InventoryListPageHeader>

      <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
        <InventorySectionHeader icon={LayoutGrid} title="Overview" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Items"
            value={stats.totalItems.toLocaleString("en-IN")}
            icon={Package}
          />
          <StatCard
            title="Products"
            value={stats.totalProducts.toLocaleString("en-IN")}
            icon={Package}
          />
          <StatCard
            title="Total Purchase Value"
            value={formatPrice(Math.round(stats.totalPurchaseValue))}
            icon={TrendingDown}
          />
          <StatCard
            title="Total Selling Value"
            value={formatPrice(Math.round(stats.totalSellingValue))}
            icon={TrendingUp}
          />
        </div>
      </section>

      {!branches.length && (
        <div className="py-16 text-center text-muted-foreground">
          <Package className="mx-auto mb-4 size-16 opacity-50" />
          <p>No branches available</p>
        </div>
      )}

      {branches.length > 0 && (
        <section className={INVENTORY_CARD_SHELL}>
          <div className="flex flex-col gap-4 border-b border-border/50 bg-muted/15 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-5">
            <InventorySectionHeader
              compact
              icon={Layers}
              title="Price list"
              description="Filter by branch, category, brand, and stock — same table layout as Manage products."
            />
          </div>
          <div className="flex flex-wrap gap-3 p-5 sm:p-6 md:p-7">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-10 rounded-xl pl-9"
                placeholder="Search product, SKU, variant..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              value={filterCategoryId}
              onChange={(e) => setFilterCategoryId(e.target.value)}
              className="h-10 min-w-[160px] rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={filterBrandId}
              onChange={(e) => setFilterBrandId(e.target.value)}
              className="h-10 min-w-[160px] rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="">All Brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
            <select
              value={filterStockStatus}
              onChange={(e) => setFilterStockStatus(e.target.value)}
              className="h-10 min-w-[140px] rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="">All Status</option>
              <option value="in_stock">In Stock</option>
              <option value="out_of_stock">Out of Stock</option>
              <option value="low_stock">Low Stock</option>
            </select>
            <select
              value={filterBranchId}
              onChange={(e) => setFilterBranchId(e.target.value)}
              className="h-10 min-w-[160px] rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name}
                </option>
              ))}
            </select>
            <select
              value={String(limit)}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
              className="h-10 min-w-[100px] rounded-xl border border-input bg-background px-3 text-sm"
            >
              {[10, 15, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-4 border-t border-border/50 p-5 sm:p-6 md:p-7">
            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <DataTable
              columns={priceListColumns}
              data={tableRows}
              loading={loading}
              inventoryStyle
            />
            {total > 0 && (
              <InventoryTablePagination
                page={page}
                lastPage={totalPages}
                total={total}
                loading={loading}
                onPageChange={setPage}
              />
            )}
          </div>
        </section>
      )}

      <Modal
        open={!!editingRow}
        onOpenChange={(o) => !o && closeEditModal()}
        title="Edit Selling Price"
        description={
          editingRow
            ? `${editingRow.productName} · ${editingRow.variantDisplay || editingRow.sku}`
            : undefined
        }
        icon={<DollarSign className="size-5" />}
        iconClassName="bg-primary/15 text-primary"
        size="sm"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button type="button" variant="outline" disabled={saving} onClick={closeEditModal}>
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={() => void saveSellingPrice()}>
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Updating…
                </>
              ) : (
                "Update"
              )}
            </Button>
          </div>
        }
      >
        {editingRow && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Current:{" "}
              <span className="font-semibold text-foreground">{formatMoney(editingRow.sellingPrice)}</span>
            </p>
            <div>
              <label className="mb-1.5 block text-sm font-medium">New selling price (৳)</label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={modalPriceValue}
                onChange={(e) => setModalPriceValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void saveSellingPrice();
                  }
                }}
                className="tabular-nums"
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={exportFilterOpen}
        onOpenChange={setExportFilterOpen}
        title="Export Note"
        description="Filter and fetch lines for copy / print"
        icon={<FileText className="size-4" />}
        size="md"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button type="button" variant="outline" disabled={exportLoading} onClick={() => setExportFilterOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={exportLoading || !exportBranchId} onClick={() => void runExportFetch()}>
              {exportLoading ? <Loader2 className="size-4 animate-spin" /> : "Get"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium">Branch</label>
            <select
              value={exportBranchId}
              onChange={(e) => setExportBranchId(e.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="">Select branch</option>
              {branches.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Category</label>
            <select
              value={exportCategoryId}
              onChange={(e) => setExportCategoryId(e.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="">All</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Brand</label>
            <select
              value={exportBrandId}
              onChange={(e) => setExportBrandId(e.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="">All</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Stock status</label>
            <select
              value={exportStockStatus}
              onChange={(e) => setExportStockStatus(e.target.value)}
              className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
            >
              <option value="">All</option>
              <option value="in_stock">In Stock</option>
              <option value="out_of_stock">Out of Stock</option>
              <option value="low_stock">Low Stock</option>
            </select>
          </div>
        </div>
      </Modal>

      <Modal
        open={exportPreviewOpen}
        onOpenChange={setExportPreviewOpen}
        title="Export note"
        description="Merged lines (seller-admin style)"
        icon={<FileText className="size-4" />}
        size="lg"
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setExportPreviewOpen(false)}>
              Close
            </Button>
            <Button type="button" variant="secondary" className="gap-2" onClick={() => void copyExportText()}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy all"}
            </Button>
          </div>
        }
      >
        <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-4 text-sm">
          {exportLines.map((l) => l.line).join("\n")}
        </pre>
      </Modal>
    </div>
  );
}
