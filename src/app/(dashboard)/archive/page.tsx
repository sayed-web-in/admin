"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  AlertTriangle,
  ImageIcon,
  Package,
  RefreshCw,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { unwrapPaginated } from "@/lib/apiList";
import { formatDate } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";
import { resolveMediaUrl } from "@/lib/media";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
} from "@/components/inventory/InventoryCrudLayout";
import { StatCard } from "@/components/common/StatCard";
import { DataTable } from "@/components/common/DataTable";
import { InventoryTablePagination } from "@/components/inventory/InventoryTablePagination";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  TableRowActions,
  TableRowActionButton,
  tableActionIconClassName,
} from "@/components/common/TableRowActions";

const ALL = "__all__";

const filterFieldClass =
  "h-10 min-w-0 rounded-xl border border-input bg-background/80 px-3 text-sm shadow-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Branch {
  id: number;
  name: string;
}

interface CategoryLite {
  id: number;
  name: string;
}

interface BrandLite {
  id: number;
  name: string;
}

interface ProductImage {
  url: string;
}

interface ArchivedProductRow {
  id: number;
  name: string;
  slug: string;
  sku: string | null;
  type: string;
  status: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  category?: CategoryLite | null;
  brand?: BrandLite | null;
  images?: ProductImage[];
  variants?: { image: string | null }[];
  storeProducts?: {
    id: number;
    branch?: { id: number; name: string };
    productVariant?: { sku: string | null } | null;
  }[];
}

export default function ArchivePage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState<string>(() => {
    const b = getSelectedBranch();
    return b != null ? String(b) : "";
  });
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [limit] = useState(20);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<ArchivedProductRow[]>([]);
  const [meta, setMeta] = useState({ page: 1, lastPage: 1, total: 0 });
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<ArchivedProductRow | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const h = () => {
      const b = getSelectedBranch();
      setBranchId(b != null ? String(b) : "");
    };
    window.addEventListener("branch-changed", h);
    return () => window.removeEventListener("branch-changed", h);
  }, []);

  useEffect(() => {
    void apiFetch<unknown>("/branches")
      .then((d) => {
        const list = Array.isArray(d)
          ? (d as Branch[])
          : (d as { branches?: Branch[] })?.branches ?? (d as { data?: Branch[] })?.data ?? [];
        setBranches(Array.isArray(list) ? list : []);
      })
      .catch(() => setBranches([]));
  }, []);

  const fetchList = useCallback(
    async (targetPage: number) => {
      setError("");
      setLoading(true);
      try {
        const q = new URLSearchParams();
        q.set("isArchived", "true");
        q.set("page", String(targetPage));
        q.set("limit", String(limit));
        if (debouncedSearch) q.set("search", debouncedSearch);
        if (branchId) q.set("branchId", branchId);
        const raw = await apiFetch<unknown>(`/products?${q.toString()}`);
        const p = unwrapPaginated<ArchivedProductRow>(raw);
        if (p) {
          setRows(p.data);
          setMeta({ page: p.page, lastPage: p.lastPage, total: p.total });
        } else {
          setRows([]);
          setMeta({ page: 1, lastPage: 1, total: 0 });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load archived products");
        setRows([]);
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, branchId, limit],
  );

  useEffect(() => {
    void fetchList(1);
  }, [debouncedSearch, branchId, fetchList]);

  const handlePageChange = (p: number) => {
    void fetchList(p);
  };

  const openRestore = (row: ArchivedProductRow) => {
    setSelected(row);
    setRestoreOpen(true);
  };

  const openDelete = (row: ArchivedProductRow) => {
    setSelected(row);
    setDeleteOpen(true);
  };

  const confirmRestore = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await apiFetch(`/products/${selected.id}/restore`, { method: "POST" });
      toast.success("Product restored to catalog.");
      setRestoreOpen(false);
      setSelected(null);
      await fetchList(1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setActionLoading(false);
    }
  };

  const confirmPermanentDelete = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await apiFetch(`/products/${selected.id}/permanent`, { method: "DELETE" });
      toast.success("Product permanently removed.");
      setDeleteOpen(false);
      setSelected(null);
      await fetchList(1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setActionLoading(false);
    }
  };

  const branchSummary = (row: ArchivedProductRow) => {
    const list = row.storeProducts ?? [];
    if (list.length === 0) return "—";
    const names = list
      .map((s) => s.branch?.name)
      .filter((x): x is string => Boolean(x && x.trim()));
    const uniq = [...new Set(names)];
    if (uniq.length <= 2) return uniq.join(", ") || "—";
    return `${uniq.slice(0, 2).join(", ")} +${uniq.length - 2}`;
  };

  const thumb = (row: ArchivedProductRow) => {
    const vImg = row.variants?.[0]?.image?.trim();
    const pImg = row.images?.[0]?.url?.trim();
    const src = vImg || pImg || "";
    return src ? resolveMediaUrl(src) : "";
  };

  const columns = useMemo(
    () => [
      {
        key: "idx",
        label: "#",
        className: "w-11",
        render: (_r: ArchivedProductRow, i: number) => (
          <span className="text-muted-foreground tabular-nums">
            {(meta.page - 1) * limit + i + 1}
          </span>
        ),
      },
      {
        key: "img",
        label: "",
        className: "w-[3.25rem]",
        render: (r: ArchivedProductRow) => {
          const src = thumb(r);
          return src ? (
            <img
              src={src}
              alt=""
              className="h-11 w-11 rounded-xl border border-border/70 object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-muted/30 text-muted-foreground">
              <ImageIcon className="h-4 w-4" aria-hidden />
            </div>
          );
        },
      },
      {
        key: "name",
        label: "Product",
        render: (r: ArchivedProductRow) => {
          const lineSku =
            r.sku?.trim() ||
            r.storeProducts?.find((s) => s.productVariant?.sku?.trim())?.productVariant?.sku?.trim() ||
            "—";
          return (
            <div>
              <span className="font-semibold text-foreground">{r.name}</span>
              <span className="mt-0.5 block font-mono text-xs text-muted-foreground">{lineSku}</span>
            </div>
          );
        },
      },
      {
        key: "type",
        label: "Type",
        render: (r: ArchivedProductRow) => (
          <Badge variant="secondary">{String(r.type).replaceAll("_", " ")}</Badge>
        ),
      },
      {
        key: "category",
        label: "Category",
        render: (r: ArchivedProductRow) => r.category?.name ?? "—",
      },
      {
        key: "brand",
        label: "Brand",
        render: (r: ArchivedProductRow) => <span className="text-muted-foreground">{r.brand?.name ?? "—"}</span>,
      },
      {
        key: "branches",
        label: "Branches",
        render: (r: ArchivedProductRow) => (
          <span className="max-w-[10rem] truncate text-xs text-muted-foreground">{branchSummary(r)}</span>
        ),
      },
      {
        key: "archived",
        label: "Archived",
        render: (r: ArchivedProductRow) => (
          <span className="text-muted-foreground">{r.updatedAt ? formatDate(r.updatedAt) : "—"}</span>
        ),
      },
      {
        key: "actions",
        label: "",
        className: "w-[1px] whitespace-nowrap text-right",
        render: (r: ArchivedProductRow) => (
          <TableRowActions>
            <TableRowActionButton
              type="button"
              title="Restore"
              className="text-emerald-700 hover:bg-emerald-500/10"
              onClick={() => openRestore(r)}
            >
              <RotateCcw className={tableActionIconClassName} aria-hidden />
            </TableRowActionButton>
            <TableRowActionButton
              type="button"
              title="Delete permanently"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => openDelete(r)}
            >
              <Trash2 className={tableActionIconClassName} aria-hidden />
            </TableRowActionButton>
          </TableRowActions>
        ),
      },
    ],
    [meta.page, limit],
  );

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={Archive}
        title="Archive"
        description="Archived catalog products — restore to the catalog or permanently remove when there are no linked sales, orders, or purchases."
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-full gap-2 rounded-xl sm:h-9 sm:w-auto"
          disabled={loading}
          onClick={() => void fetchList(meta.page)}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </InventoryListPageHeader>

      <div
        className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent"
        aria-hidden
      />

      {error ? (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden />
          <p className="m-0 font-medium text-destructive">{error}</p>
        </div>
      ) : null}

      <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
        <div className="flex gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
          <p className="m-0 leading-relaxed">
            Restoring puts the product back in the catalog. Permanent delete removes the product and its store
            lines only when no POS sale lines, ecommerce order lines, or purchase lines reference it.
          </p>
        </div>
      </div>

      <section className={INVENTORY_CARD_SHELL}>
        <div className="flex flex-col flex-wrap gap-3 border-b border-border/60 p-5 sm:flex-row sm:items-end sm:gap-3 sm:p-6 md:p-7">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or SKU…"
            className={`${filterFieldClass} w-full min-w-[12rem] sm:max-w-md`}
            aria-label="Search archived products"
          />
          <Select value={branchId || ALL} onValueChange={(v) => setBranchId(v === ALL ? "" : v)}>
            <SelectTrigger className={`${filterFieldClass} w-full min-w-[10rem] sm:w-[11rem]`}>
              <SelectValue placeholder="All branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 gap-3 border-b border-border/60 px-5 py-4 sm:grid-cols-2 sm:px-6 md:px-7">
          <StatCard title="Archived products" value={String(meta.total)} icon={Package} />
          <StatCard title="This page" value={String(rows.length)} icon={Archive} />
        </div>

        {!loading && rows.length === 0 ? (
          <div className="px-5 py-14 text-center text-sm text-muted-foreground sm:px-6">
            <Archive className="mx-auto mb-3 h-12 w-12 opacity-40" aria-hidden />
            <p className="m-0 font-medium">No archived products match your filters.</p>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <>
            <div className="block space-y-3 p-4 lg:hidden">
              {rows.map((r) => (
                <div key={r.id} className={`${INVENTORY_CARD_SHELL} p-4`}>
                  <div className="flex gap-3">
                    {thumb(r) ? (
                      <img
                        src={thumb(r)}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-xl border border-border/70 object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/30">
                        <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-foreground">{r.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.updatedAt ? formatDate(r.updatedAt) : "—"} · {branchSummary(r)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => openRestore(r)}>
                      <RotateCcw className="mr-1 h-4 w-4" />
                      Restore
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => openDelete(r)}
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden min-w-0 overflow-x-auto p-4 sm:p-5 lg:block" ref={tableRef}>
              <DataTable columns={columns} data={rows} loading={loading} inventoryStyle />
            </div>
            {meta.total > 0 ? (
              <div className="border-t border-border/60 px-4 py-4 sm:px-5 md:px-6">
                <InventoryTablePagination
                  page={meta.page}
                  lastPage={meta.lastPage}
                  total={meta.total}
                  loading={loading}
                  onPageChange={handlePageChange}
                />
              </div>
            ) : null}
          </>
        ) : loading ? (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">Loading…</div>
        ) : null}
      </section>

      <Modal
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        title="Restore product"
        description={
          selected
            ? `“${selected.name}” will be visible again in the catalog (not archived).`
            : undefined
        }
        icon={<RotateCcw className="h-5 w-5" />}
        iconClassName="from-emerald-500 to-teal-600"
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setRestoreOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void confirmRestore()} disabled={actionLoading}>
              {actionLoading ? "Restoring…" : "Restore"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">The product will appear again in inventory and product lists.</p>
      </Modal>

      <Modal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete permanently"
        description={
          selected
            ? `This cannot be undone. “${selected.name}” will be removed only if it has no linked sales, orders, or purchase lines.`
            : undefined
        }
        icon={<Trash2 className="h-5 w-5" />}
        iconClassName="from-rose-500 to-red-600"
        footer={
          <div className="flex w-full flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} disabled={actionLoading}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmPermanentDelete()}
              disabled={actionLoading}
            >
              {actionLoading ? "Deleting…" : "Delete permanently"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">
          If the API rejects the request, clear related history first or keep the product archived.
        </p>
      </Modal>
    </div>
  );
}
