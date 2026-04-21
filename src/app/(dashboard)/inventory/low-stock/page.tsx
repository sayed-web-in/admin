"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  AlertOctagon,
  AlertCircle,
  Store,
  Eye,
  ImageIcon,
  RotateCcw,
  LayoutGrid,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { resolveMediaUrl } from "@/app/(dashboard)/inventory/add-product/media";
import { unwrapPaginated, extractBranches } from "@/lib/apiList";
import { StatCard } from "@/components/common/StatCard";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import {
  TableRowActions,
  TableRowActionLink,
  tableActionIconClassName,
} from "@/components/common/TableRowActions";
import { InventoryTablePagination } from "@/components/inventory/InventoryTablePagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 20;

interface Branch {
  id: number;
  name: string;
}

interface LowStockItem {
  id: number;
  productId: number;
  image?: string;
  productName: string;
  type: string;
  variantLabel?: string;
  unitPrice: number;
  taxRate?: number;
  quantity: number;
  quantityAlert: number;
  branchName: string;
}

function buildLowStockQuery(
  page: number,
  opts: {
    search?: string;
    branchId?: number;
    level?: string;
    limit?: number;
  }
) {
  const qs = new URLSearchParams();
  qs.set("page", String(page));
  qs.set("limit", String(opts.limit ?? PAGE_SIZE));
  if (opts.search) qs.set("search", opts.search);
  if (opts.branchId) qs.set("branchId", String(opts.branchId));
  if (opts.level === "critical" || opts.level === "warning") {
    qs.set("level", opts.level);
  }
  return qs.toString();
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

function stockStatusBadge(qty: number, alert: number) {
  if (qty === 0)
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertOctagon size={12} /> Out of stock
      </Badge>
    );
  if (qty <= alert)
    return (
      <Badge variant="warning" className="gap-1">
        <AlertCircle size={12} /> Low stock
      </Badge>
    );
  return <Badge variant="secondary">In stock</Badge>;
}

function normalizeLowStockRow(sp: {
  id: number;
  productId: number;
  quantity: number;
  sellingPrice: unknown;
  quantityAlert: number;
  product: {
    name: string;
    type: string;
    images?: { url: string }[];
    taxRate?: { rate: unknown } | null;
  };
  branch: { name: string };
  productVariant?: {
    attributes?: { attributeValue?: { value: string } | null }[];
  } | null;
}): LowStockItem {
  const pv = sp.productVariant;
  const variantLabel =
    pv?.attributes?.length
      ? pv.attributes
          .map((a) => a.attributeValue?.value)
          .filter(Boolean)
          .join(" / ") || undefined
      : undefined;
  return {
    id: sp.id,
    productId: sp.productId,
    image: sp.product.images?.[0]?.url,
    productName: sp.product.name,
    type: sp.product.type,
    variantLabel,
    unitPrice: Number(sp.sellingPrice),
    taxRate:
      sp.product.taxRate?.rate != null
        ? Number(sp.product.taxRate.rate)
        : undefined,
    quantity: sp.quantity,
    quantityAlert: sp.quantityAlert,
    branchName: sp.branch.name,
  };
}

export default function LowStockPage() {
  const router = useRouter();
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterBranch, setFilterBranch] = useState(0);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({
    page: 1,
    lastPage: 1,
    total: 0,
  });
  const [stats, setStats] = useState({
    total: 0,
    critical: 0,
    warning: 0,
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterBranch, filterStatus]);

  const loadStats = useCallback(async () => {
    const common = {
      search: debouncedSearch || undefined,
      branchId: filterBranch || undefined,
    };
    try {
      const [totalRes, critRes, warnRes] = await Promise.all([
        apiFetch<unknown>(
          `/products/low-stock?${buildLowStockQuery(1, { ...common, limit: 1 })}`
        ),
        apiFetch<unknown>(
          `/products/low-stock?${buildLowStockQuery(1, {
            ...common,
            limit: 1,
            level: "critical",
          })}`
        ),
        apiFetch<unknown>(
          `/products/low-stock?${buildLowStockQuery(1, {
            ...common,
            limit: 1,
            level: "warning",
          })}`
        ),
      ]);
      const t = unwrapPaginated(totalRes);
      const c = unwrapPaginated(critRes);
      const w = unwrapPaginated(warnRes);
      setStats({
        total: t?.total ?? 0,
        critical: c?.total ?? 0,
        warning: w?.total ?? 0,
      });
    } catch {
      setStats({ total: 0, critical: 0, warning: 0 });
    }
  }, [debouncedSearch, filterBranch]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildLowStockQuery(page, {
        search: debouncedSearch || undefined,
        branchId: filterBranch || undefined,
        level: filterStatus || undefined,
      });
      const res = await apiFetch<unknown>(`/products/low-stock?${qs}`);
      const p =
        unwrapPaginated<Parameters<typeof normalizeLowStockRow>[0]>(res);
      if (p) {
        setItems(p.data.map(normalizeLowStockRow));
        setMeta({
          page: p.page,
          lastPage: p.lastPage,
          total: p.total,
        });
        if (p.page > p.lastPage) {
          setPage(p.lastPage);
        }
      } else {
        setItems([]);
        setMeta({ page: 1, lastPage: 1, total: 0 });
      }
    } catch {
      setItems([]);
      setMeta({ page: 1, lastPage: 1, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filterBranch, filterStatus]);

  useEffect(() => {
    apiFetch<unknown>("/branches")
      .then((d) => setBranches(extractBranches(d)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const selectClasses =
    "h-10 rounded-xl border border-input bg-background/80 px-3 text-sm shadow-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const columns = useMemo(
    () => [
      {
        key: "index",
        label: "#",
        className: "w-12",
        render: (_: LowStockItem, i: number) =>
          (page - 1) * PAGE_SIZE + i + 1,
      },
      {
        key: "image",
        label: "Img",
        className: "w-[4.75rem]",
        render: (item: LowStockItem) => {
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
        render: (item: LowStockItem) => (
          <span className="font-semibold text-foreground">
            {item.productName}
          </span>
        ),
      },
      {
        key: "type",
        label: "Type",
        render: (item: LowStockItem) => (
          <Badge variant={item.type === "VARIABLE" ? "warning" : "secondary"}>
            {item.type}
          </Badge>
        ),
      },
      {
        key: "variant",
        label: "Variant",
        render: (item: LowStockItem) =>
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
      {
        key: "unitPrice",
        label: "Price",
        render: (item: LowStockItem) => formatPrice(item.unitPrice),
      },
      {
        key: "tax",
        label: "Tax",
        render: (item: LowStockItem) =>
          item.taxRate != null ? `${item.taxRate}%` : "—",
      },
      {
        key: "quantity",
        label: "Qty",
        render: (item: LowStockItem) => (
          <span className="tabular-nums">
            {item.quantity}
            <span className="text-muted-foreground">
              {" "}
              / alert {item.quantityAlert}
            </span>
          </span>
        ),
      },
      {
        key: "branch",
        label: "Branch",
        render: (item: LowStockItem) => (
          <span className="text-muted-foreground">{item.branchName}</span>
        ),
      },
      {
        key: "status",
        label: "Status",
        render: (item: LowStockItem) =>
          stockStatusBadge(item.quantity, item.quantityAlert),
      },
      {
        key: "actions",
        label: "Actions",
        render: (item: LowStockItem) => (
          <TableRowActions>
            <TableRowActionLink
              href={`/inventory/manage-product/${item.productId}`}
              title="View product"
            >
              <Eye className={tableActionIconClassName} aria-hidden />
            </TableRowActionLink>
          </TableRowActions>
        ),
      },
    ],
    [page]
  );

  const refreshAll = () => {
    void loadStats();
    void fetchList();
  };

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
              <AlertTriangle className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Low stock
              </h1>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Store rows where quantity is at or below the branch alert level
                (same layout as manage products).
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
              variant="outline"
              size="sm"
              className="h-10 w-full rounded-xl border-border/80 bg-background/80 backdrop-blur-sm sm:h-9 sm:w-auto"
              asChild
            >
              <Link href="/inventory/manage-product">Manage products</Link>
            </Button>
          </div>
        </div>
      </header>

      <div className="space-y-5 sm:space-y-6">
        <section className={`${cardShell} p-5 sm:p-6 md:p-7`}>
          <SectionHeader
            icon={LayoutGrid}
            title="Overview"
            description="Critical means 0 qty. Warning means above 0 but still at or below the SKU alert level. Counts follow branch and search filters."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Below threshold"
              value={stats.total}
              icon={AlertTriangle}
            />
            <StatCard
              title="Out of stock"
              value={stats.critical}
              icon={AlertOctagon}
            />
            <StatCard
              title="Low (not zero)"
              value={stats.warning}
              icon={AlertCircle}
            />
            <StatCard
              title="Branches"
              value={branches.length}
              icon={Store}
            />
          </div>
        </section>

        <section className={cardShell}>
          <div className="flex flex-col gap-4 border-b border-border/50 bg-muted/15 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-5">
            <SectionHeader
              compact
              icon={Layers}
              title="Restock list"
              description="Paginated GET /products/low-stock with search, branch, and status filters."
            />
          </div>

          <div className="space-y-4 p-5 sm:p-6 md:p-7">
            <FilterBar
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search products…"
            >
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className={selectClasses}
              >
                <option value="">All status</option>
                <option value="critical">Out of stock (0)</option>
                <option value="warning">Low (≤ alert)</option>
              </select>
              <select
                value={filterBranch}
                onChange={(e) => setFilterBranch(Number(e.target.value))}
                className={selectClasses}
              >
                <option value={0}>All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </FilterBar>

            <DataTable
              columns={columns}
              data={items}
              loading={loading}
              inventoryStyle
            />
            <InventoryTablePagination
              page={meta.page}
              lastPage={meta.lastPage}
              total={meta.total}
              loading={loading}
              onPageChange={setPage}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
