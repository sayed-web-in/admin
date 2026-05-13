"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Package,
  Hash,
  DollarSign,
  AlertTriangle,
  BarChart3,
  Printer,
  Download,
  XCircle,
  RotateCcw,
  RefreshCw,
  ImageIcon,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { extractApiList } from "@/lib/apiList";
import { formatPrice } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";
import { resolveMediaUrl } from "@/lib/media";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
} from "@/components/inventory/InventoryCrudLayout";
import { StatCard } from "@/components/common/StatCard";
import { DataTable } from "@/components/common/DataTable";
import { InventoryTablePagination } from "@/components/inventory/InventoryTablePagination";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all__";

const filterFieldClass =
  "h-10 min-w-0 rounded-xl border border-input bg-background/80 px-3 text-sm shadow-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Branch {
  id: number;
  name: string;
}

interface CategoryRow {
  id: number;
  name: string;
  subcategories?: { id: number; name: string }[];
}

interface BrandRow {
  id: number;
  name: string;
}

interface StockItemRow {
  id: number;
  productName: string;
  variant: string;
  sku: string;
  branchName: string;
  inStock: number;
  soldStock: number;
  productImage: string | null;
  sellingPrice: number;
  value: number;
}

interface StockReportResponse {
  totalProducts: number;
  totalQty: number;
  totalValue: number;
  lowStock?: number;
  lowStockCount?: number;
  stats?: { totalInStock?: number; totalSold?: number };
  items: StockItemRow[];
  total: number;
  page: number;
  lastPage: number;
  limit?: number;
}

export default function StockReportPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [branchId, setBranchId] = useState<string>(() => {
    const b = getSelectedBranch();
    return b != null ? String(b) : "";
  });
  const [categoryId, setCategoryId] = useState("");
  const [subCategoryId, setSubCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState(false);
  const [report, setReport] = useState<StockReportResponse | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    void apiFetch<unknown>("/categories?limit=200&page=1")
      .then((res) => {
        const list = extractApiList<CategoryRow>(res, ["categories"]);
        setCategories(Array.isArray(list) ? list : []);
      })
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    void apiFetch<unknown>("/brands?limit=200")
      .then((res) => {
        const list = extractApiList<BrandRow>(res, ["brands"]);
        setBrands(list.map((b) => ({ id: b.id, name: b.name })));
      })
      .catch(() => setBrands([]));
  }, []);

  const subOptions = useMemo(() => {
    if (!categoryId) return [];
    const cat = categories.find((c) => String(c.id) === categoryId);
    return cat?.subcategories ?? [];
  }, [categoryId, categories]);

  const fetchReport = useCallback(
    async (targetPage: number, limitOverride?: number) => {
      setError("");
      setLoading(true);
      const effLimit = limitOverride ?? limit;
      try {
        const q = new URLSearchParams();
        if (branchId) q.set("branchId", branchId);
        if (categoryId) q.set("categoryId", categoryId);
        if (subCategoryId) q.set("subCategoryId", subCategoryId);
        if (brandId) q.set("brandId", brandId);
        q.set("page", String(targetPage));
        q.set("limit", String(effLimit));
        const res = await apiFetch<StockReportResponse>(`/reports/stock?${q.toString()}`);
        setReport(res);
        setPage(res.page ?? targetPage);
        setGenerated(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load report");
        setReport(null);
      } finally {
        setLoading(false);
      }
    },
    [branchId, categoryId, subCategoryId, brandId, limit],
  );

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    void fetchReport(1);
  };

  const handleReset = () => {
    setBranchId(() => {
      const b = getSelectedBranch();
      return b != null ? String(b) : "";
    });
    setCategoryId("");
    setSubCategoryId("");
    setBrandId("");
    setPage(1);
    setLimit(25);
    setReport(null);
    setGenerated(false);
    setError("");
  };

  const list = report?.items ?? [];
  const meta = {
    page: report?.page ?? page,
    lastPage: report?.lastPage ?? 1,
    total: report?.total ?? 0,
  };

  const lowN = report?.lowStockCount ?? report?.lowStock ?? 0;
  const totalSold = report?.stats?.totalSold ?? 0;

  const columns = useMemo(
    () => [
      {
        key: "idx",
        label: "#",
        className: "w-12",
        render: (_r: StockItemRow, index: number) => (
          <span className="text-muted-foreground tabular-nums">
            {(meta.page - 1) * limit + index + 1}
          </span>
        ),
      },
      {
        key: "image",
        label: "Img",
        className: "w-[4.75rem]",
        render: (r: StockItemRow) => {
          const src = r.productImage ? resolveMediaUrl(r.productImage) : "";
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
        render: (r: StockItemRow) => (
          <span className="font-semibold text-foreground">{r.productName}</span>
        ),
      },
      {
        key: "variant",
        label: "Variant",
        render: (r: StockItemRow) => (
          <span className="text-muted-foreground">{r.variant && r.variant !== "—" ? r.variant : "—"}</span>
        ),
      },
      {
        key: "sku",
        label: "SKU",
        render: (r: StockItemRow) => (
          <span className="font-mono text-xs text-primary">{r.sku || "—"}</span>
        ),
      },
      {
        key: "branchName",
        label: "Branch",
        render: (r: StockItemRow) => <span className="text-muted-foreground">{r.branchName ?? "—"}</span>,
      },
      {
        key: "inStock",
        label: "In stock",
        className: "text-right",
        render: (r: StockItemRow) => (
          <span className="tabular-nums font-medium">{r.inStock}</span>
        ),
      },
      {
        key: "soldStock",
        label: "Sold (hist.)",
        className: "text-right",
        render: (r: StockItemRow) => (
          <span className="tabular-nums text-muted-foreground">{r.soldStock}</span>
        ),
      },
      {
        key: "sellingPrice",
        label: "Price",
        className: "text-right",
        render: (r: StockItemRow) => (
          <span className="tabular-nums">{formatPrice(Number(r.sellingPrice))}</span>
        ),
      },
      {
        key: "value",
        label: "Value",
        className: "text-right",
        render: (r: StockItemRow) => (
          <span className="tabular-nums font-semibold">{formatPrice(Number(r.value))}</span>
        ),
      },
    ],
    [meta.page, limit],
  );

  const reportHeaders = [
    "#",
    "Product",
    "Variant",
    "SKU",
    "Branch",
    "In stock",
    "Sold (hist.)",
    "Price",
    "Value",
  ];

  const getReportRows = () =>
    list.map((row, i) => [
      String((meta.page - 1) * limit + i + 1),
      row.productName,
      row.variant && row.variant !== "—" ? row.variant : "—",
      row.sku || "—",
      row.branchName ?? "—",
      String(row.inStock),
      String(row.soldStock),
      formatPrice(Number(row.sellingPrice)),
      formatPrice(Number(row.value)),
    ]);

  const handlePrint = () => {
    if (!tableRef.current || !generated) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Stock Report</title>
      <style>body{font-family:system-ui,sans-serif;padding:20px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5;font-weight:600}.meta{margin-bottom:12px;font-size:14px;color:#444}</style></head><body>
      <h2>Stock Report</h2>
      <p class="meta">Current inventory (active products, non-archived)</p>
      ${tableRef.current.innerHTML}
      </body></html>`);
    win.document.close();
    win.print();
  };

  const today = new Date().toISOString().slice(0, 10);

  const handleExportCsv = () => {
    if (!generated || list.length === 0) return;
    const escape = (c: string) => `"${c.replace(/"/g, '""')}"`;
    const lines = [reportHeaders.join(",")];
    for (const row of getReportRows()) {
      lines.push(row.map((c) => escape(String(c))).join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock-report-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={Package}
        title="Stock Report"
        description="On-hand inventory by branch, category, subcategory, and brand — paginated lines with value and historical sold quantity."
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-full gap-2 rounded-xl sm:h-9 sm:w-auto"
          disabled={!generated || list.length === 0}
          onClick={handlePrint}
        >
          <Printer className="h-4 w-4" />
          Print
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-full gap-2 rounded-xl sm:h-9 sm:w-auto"
          disabled={!generated || list.length === 0}
          onClick={handleExportCsv}
        >
          <Download className="h-4 w-4" />
          CSV
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

      <section className={INVENTORY_CARD_SHELL}>
        <form
          onSubmit={handleGenerate}
          className="flex flex-col flex-wrap gap-3 p-5 sm:flex-row sm:items-end sm:gap-3 sm:p-6 md:p-7"
        >
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

          <Select
            value={categoryId || ALL}
            onValueChange={(v) => {
              const next = v === ALL ? "" : v;
              setCategoryId(next);
              setSubCategoryId("");
            }}
          >
            <SelectTrigger className={`${filterFieldClass} w-full min-w-[10rem] sm:min-w-[11rem] sm:max-w-[14rem]`}>
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={subCategoryId || ALL}
            onValueChange={(v) => setSubCategoryId(v === ALL ? "" : v)}
            disabled={!categoryId || subOptions.length === 0}
          >
            <SelectTrigger className={`${filterFieldClass} w-full min-w-[10rem] sm:min-w-[11rem] sm:max-w-[14rem]`}>
              <SelectValue placeholder="All subcategories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All subcategories</SelectItem>
              {subOptions.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={brandId || ALL} onValueChange={(v) => setBrandId(v === ALL ? "" : v)}>
            <SelectTrigger className={`${filterFieldClass} w-full min-w-[10rem] sm:w-[11rem]`}>
              <SelectValue placeholder="All brands" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All brands</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
            <Button type="submit" disabled={loading} className="h-10 flex-1 gap-2 rounded-xl sm:flex-none">
              {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
              Generate
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 gap-2 rounded-xl"
              onClick={handleReset}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </form>

        {generated && report ? (
          <div className="grid grid-cols-1 gap-3 border-t border-border/60 px-5 py-4 sm:grid-cols-2 lg:grid-cols-5 sm:px-6 md:px-7">
            <StatCard title="Products (distinct)" value={String(report.totalProducts)} icon={Package} />
            <StatCard title="Total qty" value={String(report.totalQty)} icon={Hash} />
            <StatCard title="Stock value" value={formatPrice(report.totalValue)} icon={DollarSign} />
            <StatCard title="Low-stock lines" value={String(lowN)} icon={AlertTriangle} />
            <StatCard title="Sold qty (all)" value={String(totalSold)} icon={BarChart3} />
          </div>
        ) : null}

        {!generated && !loading ? (
          <div className="border-t border-border/60 px-5 py-10 text-center text-sm text-muted-foreground sm:px-6">
            Choose filters and click Generate to load stock lines.
          </div>
        ) : null}

        {generated && !loading && list.length === 0 ? (
          <div className="border-t border-border/60 px-5 py-12 text-center text-sm text-muted-foreground sm:px-6">
            <Package className="mx-auto mb-3 h-12 w-12 opacity-40" aria-hidden />
            <p className="m-0 font-medium">No stock lines match the selected filters.</p>
          </div>
        ) : null}

        {generated && !loading && list.length > 0 ? (
          <>
            <div className="block space-y-3 border-t border-border/60 p-4 lg:hidden">
              {list.map((row) => (
                <div key={row.id} className={`${INVENTORY_CARD_SHELL} p-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{row.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.branchName} · {row.sku}
                      </p>
                    </div>
                    <span className="shrink-0 text-base font-bold tabular-nums text-primary">
                      {formatPrice(Number(row.value))}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Qty {row.inStock}</span>
                    <span>·</span>
                    <span>Sold {row.soldStock}</span>
                    <span>·</span>
                    <span>{formatPrice(Number(row.sellingPrice))} / unit</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden min-w-0 overflow-x-auto border-t border-border/60 p-4 sm:p-5 lg:block" ref={tableRef}>
              <DataTable columns={columns} data={list} loading={false} inventoryStyle />
            </div>
            {meta.total > 0 ? (
              <div className="flex flex-col gap-4 border-t border-border/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 md:px-6">
                <select
                  value={String(limit)}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    setLimit(n);
                    if (generated) {
                      setPage(1);
                      void fetchReport(1, n);
                    }
                  }}
                  className={`${filterFieldClass} w-full min-w-[7.5rem] max-w-[11rem] sm:w-auto`}
                  aria-label="Rows per page"
                >
                  <option value="25">25 / page</option>
                  <option value="50">50 / page</option>
                  <option value="100">100 / page</option>
                  <option value="500">500 / page</option>
                  <option value="2000">All (max 2000)</option>
                </select>
                <InventoryTablePagination
                  className="flex-1 border-t-0 pt-0"
                  page={meta.page}
                  lastPage={meta.lastPage}
                  total={meta.total}
                  loading={loading}
                  onPageChange={(p) => {
                    setPage(p);
                    void fetchReport(p);
                  }}
                />
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
