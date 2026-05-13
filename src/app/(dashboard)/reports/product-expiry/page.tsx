"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  Printer,
  Download,
  XCircle,
  RotateCcw,
  RefreshCw,
  Package,
  Hash,
  Boxes,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { extractApiList } from "@/lib/apiList";
import { formatDate, formatPrice, todayYmdInDhaka } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
} from "@/components/inventory/InventoryCrudLayout";
import { StatCard } from "@/components/common/StatCard";
import { DataTable } from "@/components/common/DataTable";
import { InventoryTablePagination } from "@/components/inventory/InventoryTablePagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

interface ExpiryLine {
  batchId: number;
  batchNumber: string;
  batchDate: string;
  daysOld: number;
  quantity: number;
  purchaseCost: number;
  productName: string;
  sku: string | null;
  categoryName: string | null;
  brandName: string | null;
  branchName: string;
  supplierName: string | null;
}

interface ProductExpiryReportResponse {
  summary?: {
    totalBatches: number;
    totalAvailableQty: number;
    minAgeDays: number;
  };
  items: ExpiryLine[];
  total: number;
  page: number;
  lastPage: number;
  limit?: number;
}

function ageBadge(days: number) {
  if (days > 180) return <Badge variant="destructive">{days}d</Badge>;
  if (days > 90) return <Badge variant="warning">{days}d</Badge>;
  return <Badge variant="success">{days}d</Badge>;
}

export default function ProductExpiryReportPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [branchId, setBranchId] = useState<string>(() => {
    const b = getSelectedBranch();
    return b != null ? String(b) : "";
  });
  const [categoryId, setCategoryId] = useState("");
  const [subCategoryId, setSubCategoryId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [minAgeDays, setMinAgeDays] = useState("90");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState(false);
  const [report, setReport] = useState<ProductExpiryReportResponse | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const today = todayYmdInDhaka();

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
      .then((res) => setCategories(extractApiList<CategoryRow>(res, ["categories"])))
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
      const ageNum = Math.min(3650, Math.max(1, parseInt(minAgeDays, 10) || 90));
      try {
        const q = new URLSearchParams();
        if (dateFrom) q.set("dateFrom", dateFrom);
        if (dateTo) q.set("dateTo", dateTo);
        if (branchId) q.set("branchId", branchId);
        if (categoryId) q.set("categoryId", categoryId);
        if (subCategoryId) q.set("subCategoryId", subCategoryId);
        if (brandId) q.set("brandId", brandId);
        q.set("batchMinAgeDays", String(ageNum));
        q.set("page", String(targetPage));
        q.set("limit", String(effLimit));
        const res = await apiFetch<ProductExpiryReportResponse>(`/reports/product-expiry?${q.toString()}`);
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
    [dateFrom, dateTo, branchId, categoryId, subCategoryId, brandId, minAgeDays, limit],
  );

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    void fetchReport(1);
  };

  const handleReset = () => {
    setDateFrom("");
    setDateTo("");
    setBranchId(() => {
      const b = getSelectedBranch();
      return b != null ? String(b) : "";
    });
    setCategoryId("");
    setSubCategoryId("");
    setBrandId("");
    setMinAgeDays("90");
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
  const s = report?.summary;

  const columns = useMemo(
    () => [
      {
        key: "idx",
        label: "#",
        className: "w-12",
        render: (_r: ExpiryLine, index: number) => (
          <span className="text-muted-foreground tabular-nums">
            {(meta.page - 1) * limit + index + 1}
          </span>
        ),
      },
      {
        key: "productName",
        label: "Product",
        render: (r: ExpiryLine) => <span className="font-semibold text-foreground">{r.productName}</span>,
      },
      {
        key: "sku",
        label: "SKU",
        render: (r: ExpiryLine) => (
          <span className="font-mono text-xs text-primary">{r.sku?.trim() || "—"}</span>
        ),
      },
      {
        key: "batchNumber",
        label: "Batch",
        render: (r: ExpiryLine) => <span className="text-muted-foreground">{r.batchNumber}</span>,
      },
      {
        key: "branchName",
        label: "Branch",
        render: (r: ExpiryLine) => <span>{r.branchName}</span>,
      },
      {
        key: "categoryName",
        label: "Category",
        render: (r: ExpiryLine) => <span className="text-muted-foreground">{r.categoryName ?? "—"}</span>,
      },
      {
        key: "supplierName",
        label: "Supplier",
        render: (r: ExpiryLine) => <span className="text-muted-foreground">{r.supplierName ?? "—"}</span>,
      },
      {
        key: "quantity",
        label: "Qty",
        className: "text-right",
        render: (r: ExpiryLine) => <span className="tabular-nums font-medium">{r.quantity}</span>,
      },
      {
        key: "purchaseCost",
        label: "Unit cost",
        className: "text-right",
        render: (r: ExpiryLine) => (
          <span className="tabular-nums">{formatPrice(Number(r.purchaseCost))}</span>
        ),
      },
      {
        key: "batchDate",
        label: "Batch date",
        render: (r: ExpiryLine) => (
          <span className="text-muted-foreground">{r.batchDate ? formatDate(r.batchDate) : "—"}</span>
        ),
      },
      {
        key: "daysOld",
        label: "Age",
        render: (r: ExpiryLine) => ageBadge(r.daysOld),
      },
    ],
    [meta.page, limit],
  );

  const periodNote =
    dateFrom || dateTo
      ? `Optional batch date window: ${dateFrom || "…"} → ${dateTo || "…"}`
      : "No batch date window (only minimum age filter).";

  const reportHeaders = [
    "#",
    "Product",
    "SKU",
    "Batch",
    "Branch",
    "Category",
    "Supplier",
    "Qty",
    "Unit cost",
    "Batch date",
    "Age (days)",
  ];

  const getReportRows = () =>
    list.map((row, i) => [
      String((meta.page - 1) * limit + i + 1),
      row.productName,
      row.sku?.trim() || "—",
      row.batchNumber,
      row.branchName,
      row.categoryName ?? "—",
      row.supplierName ?? "—",
      String(row.quantity),
      formatPrice(Number(row.purchaseCost)),
      row.batchDate ? formatDate(row.batchDate) : "—",
      String(row.daysOld),
    ]);

  const handlePrint = () => {
    if (!tableRef.current || !generated) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Product Expiry / Age Report</title>
      <style>body{font-family:system-ui,sans-serif;padding:20px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5;font-weight:600}.meta{margin-bottom:12px;font-size:14px;color:#444}</style></head><body>
      <h2>Product Expiry / Age Report</h2>
      <p class="meta">${periodNote}</p>
      ${tableRef.current.innerHTML}
      </body></html>`);
    win.document.close();
    win.print();
  };

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
    a.download = `product-expiry-report-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={CalendarClock}
        title="Product expiry / age"
        description="Batches with remaining stock that are at least N days old — optional batch-date window and product filters."
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
          <div className="flex w-full min-w-[6rem] max-w-[7.5rem] flex-col gap-1 sm:w-auto">
            <span className="text-xs font-medium text-muted-foreground">Min age (days)</span>
            <Input
              type="number"
              min={1}
              max={3650}
              value={minAgeDays}
              onChange={(e) => setMinAgeDays(e.target.value)}
              className={filterFieldClass}
              aria-label="Minimum batch age in days"
            />
          </div>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={`${filterFieldClass} w-full min-w-[9.25rem] sm:w-40`}
            aria-label="Batch date from"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={`${filterFieldClass} w-full min-w-[9.25rem] sm:w-40`}
            aria-label="Batch date to"
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
          <Select
            value={categoryId || ALL}
            onValueChange={(v) => {
              const next = v === ALL ? "" : v;
              setCategoryId(next);
              setSubCategoryId("");
            }}
          >
            <SelectTrigger className={`${filterFieldClass} w-full min-w-[10rem] sm:max-w-[14rem]`}>
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
            <SelectTrigger className={`${filterFieldClass} w-full min-w-[10rem] sm:max-w-[14rem]`}>
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
            <Button type="button" variant="outline" className="h-10 gap-2 rounded-xl" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
          </div>
        </form>

        {generated && report ? (
          <div className="grid grid-cols-1 gap-3 border-t border-border/60 px-5 py-4 sm:grid-cols-3 sm:px-6 md:px-7">
            <StatCard title="Matching batches" value={String(s?.totalBatches ?? meta.total)} icon={Boxes} />
            <StatCard title="Qty on hand" value={String(s?.totalAvailableQty ?? "—")} icon={Hash} />
            <StatCard title="Min age filter" value={`${s?.minAgeDays ?? minAgeDays}d`} icon={Package} />
          </div>
        ) : null}

        {!generated && !loading ? (
          <div className="border-t border-border/60 px-5 py-10 text-center text-sm text-muted-foreground sm:px-6">
            Set minimum batch age (default 90 days), optional batch date range, then Generate.
          </div>
        ) : null}

        {generated && !loading && list.length === 0 ? (
          <div className="border-t border-border/60 px-5 py-12 text-center text-sm text-muted-foreground sm:px-6">
            <CalendarClock className="mx-auto mb-3 h-12 w-12 opacity-40" aria-hidden />
            <p className="m-0 font-medium">No batches match the selected filters.</p>
          </div>
        ) : null}

        {generated && !loading && list.length > 0 ? (
          <>
            <div className="block space-y-3 border-t border-border/60 p-4 lg:hidden">
              {list.map((row) => (
                <div key={row.batchId} className={`${INVENTORY_CARD_SHELL} p-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{row.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.batchNumber} · {row.branchName}
                      </p>
                    </div>
                    {ageBadge(row.daysOld)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Qty {row.quantity}</span>
                    <span>·</span>
                    <span>{row.batchDate ? formatDate(row.batchDate) : "—"}</span>
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
