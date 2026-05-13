"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ShoppingCart,
  RotateCcw,
  RefreshCw,
  DollarSign,
  CreditCard,
  BarChart3,
  Printer,
  Download,
  XCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { extractApiList } from "@/lib/apiList";
import {
  formatDate,
  formatPrice,
  firstDayOfMonthYmdInDhaka,
  todayYmdInDhaka,
} from "@/lib/utils";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
} from "@/components/inventory/InventoryCrudLayout";
import { StatCard } from "@/components/common/StatCard";
import { DataTable } from "@/components/common/DataTable";
import { InventoryTablePagination } from "@/components/inventory/InventoryTablePagination";
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

interface CustomerOpt {
  id: number;
  name: string;
  phone?: string;
}

interface SaleRow {
  id: number;
  invoiceNo?: string;
  invoiceNumber?: string;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  branch?: { id: number; name: string } | null;
  orderStatus: string;
  paymentStatus: string;
  createdAt: string;
  items?: { quantity: number }[];
}

interface SalesReportResponse {
  totalSales: number;
  revenue?: number;
  totalRevenue?: number;
  totalDiscount: number;
  totalTax: number;
  summary?: {
    totalUnitsSold: number;
    totalSalesAmount: number;
    totalPaid: number;
    totalDue: number;
  };
  sales: SaleRow[];
  total: number;
  page: number;
  lastPage: number;
  limit?: number;
}

function getChangeAmount(o: SaleRow): number {
  return Math.max(0, Number(o.paidAmount ?? 0) - Number(o.grandTotal ?? 0));
}

function labelStatus(raw: string): string {
  if (!raw) return "—";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function orderBadgeClass(s: string): string {
  if (s === "completed") return "bg-emerald-500/15 text-emerald-700 border border-emerald-500/25";
  if (s === "returned") return "bg-rose-500/15 text-rose-700 border border-rose-500/25";
  return "bg-amber-500/15 text-amber-800 border border-amber-500/25";
}

function paymentBadgeClass(s: string): string {
  if (s === "paid") return "bg-emerald-500/15 text-emerald-700 border border-emerald-500/25";
  if (s === "partial") return "bg-amber-500/15 text-amber-800 border border-amber-500/25";
  return "bg-rose-500/15 text-rose-700 border border-rose-500/25";
}

export default function SalesReportPage() {
  const firstDay = firstDayOfMonthYmdInDhaka();
  const today = todayYmdInDhaka();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [customers, setCustomers] = useState<CustomerOpt[]>([]);
  const [dateFrom, setDateFrom] = useState(firstDay);
  const [dateTo, setDateTo] = useState(today);
  const [branchId, setBranchId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(15);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [generated, setGenerated] = useState(false);
  const [report, setReport] = useState<SalesReportResponse | null>(null);
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
    void apiFetch<unknown>("/customers?page=1&limit=500")
      .then((res) => {
        const list = extractApiList<CustomerOpt>(res, ["customers"]);
        setCustomers(list);
      })
      .catch(() => setCustomers([]));
  }, []);

  const fetchReport = useCallback(
    async (targetPage: number, limitOverride?: number) => {
      setError("");
      setLoading(true);
      const effLimit = limitOverride ?? limit;
      try {
        const q = new URLSearchParams();
        if (dateFrom) q.set("dateFrom", dateFrom);
        if (dateTo) q.set("dateTo", dateTo);
        if (branchId) q.set("branchId", branchId);
        if (customerId) q.set("customerId", customerId);
        if (paymentStatus) q.set("paymentStatus", paymentStatus);
        q.set("page", String(targetPage));
        q.set("limit", String(effLimit));
        const res = await apiFetch<SalesReportResponse>(`/reports/sales?${q.toString()}`);
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
    [dateFrom, dateTo, branchId, customerId, paymentStatus, limit],
  );

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    void fetchReport(1);
  };

  const handleReset = () => {
    setDateFrom(firstDayOfMonthYmdInDhaka());
    setDateTo(todayYmdInDhaka());
    setBranchId("");
    setCustomerId("");
    setPaymentStatus("");
    setPage(1);
    setLimit(15);
    setReport(null);
    setGenerated(false);
    setError("");
  };

  const summary = report?.summary;
  const list = report?.sales ?? [];
  const meta = {
    page: report?.page ?? page,
    lastPage: report?.lastPage ?? 1,
    total: report?.total ?? 0,
  };

  const columns = useMemo(
    () => [
      {
        key: "idx",
        label: "#",
        className: "w-12",
        render: (_r: SaleRow, index: number) => (
          <span className="text-muted-foreground tabular-nums">
            {(meta.page - 1) * limit + index + 1}
          </span>
        ),
      },
      {
        key: "invoice",
        label: "Invoice No",
        render: (r: SaleRow) => (
          <span className="font-medium">{r.invoiceNo ?? r.invoiceNumber ?? "—"}</span>
        ),
      },
      {
        key: "grandTotal",
        label: "Grand Total",
        className: "text-right",
        render: (r: SaleRow) => (
          <span className="font-semibold tabular-nums">{formatPrice(Number(r.grandTotal))}</span>
        ),
      },
      {
        key: "paid",
        label: "Paid",
        className: "text-right",
        render: (r: SaleRow) => (
          <span className="tabular-nums text-muted-foreground">{formatPrice(Number(r.paidAmount))}</span>
        ),
      },
      {
        key: "due",
        label: "Due",
        className: "text-right",
        render: (r: SaleRow) => (
          <span className="tabular-nums text-muted-foreground">{formatPrice(Number(r.dueAmount))}</span>
        ),
      },
      {
        key: "change",
        label: "Change",
        className: "text-right",
        render: (r: SaleRow) => (
          <span className="tabular-nums text-muted-foreground">{formatPrice(getChangeAmount(r))}</span>
        ),
      },
      {
        key: "branch",
        label: "Branch",
        render: (r: SaleRow) => <span className="text-muted-foreground">{r.branch?.name ?? "—"}</span>,
      },
      {
        key: "order",
        label: "Order",
        render: (r: SaleRow) => (
          <span
            className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${orderBadgeClass(r.orderStatus)}`}
          >
            {labelStatus(r.orderStatus)}
          </span>
        ),
      },
      {
        key: "payment",
        label: "Payment",
        render: (r: SaleRow) => (
          <span
            className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${paymentBadgeClass(r.paymentStatus)}`}
          >
            {labelStatus(r.paymentStatus)}
          </span>
        ),
      },
      {
        key: "date",
        label: "Date",
        render: (r: SaleRow) => (
          <span className="text-muted-foreground">{r.createdAt ? formatDate(r.createdAt) : "—"}</span>
        ),
      },
    ],
    [meta.page, limit],
  );

  const periodLabel = `${dateFrom} to ${dateTo}`;
  const reportHeaders = [
    "#",
    "Invoice No",
    "Grand Total",
    "Paid",
    "Due",
    "Change",
    "Branch",
    "Order",
    "Payment",
    "Date",
  ];

  const getReportRows = () =>
    list.map((row, i) => [
      String((meta.page - 1) * limit + i + 1),
      row.invoiceNo ?? row.invoiceNumber ?? "—",
      formatPrice(Number(row.grandTotal)),
      formatPrice(Number(row.paidAmount)),
      formatPrice(Number(row.dueAmount)),
      formatPrice(getChangeAmount(row)),
      row.branch?.name ?? "—",
      labelStatus(row.orderStatus),
      labelStatus(row.paymentStatus),
      row.createdAt ? formatDate(row.createdAt) : "—",
    ]);

  const handlePrint = () => {
    if (!tableRef.current || !generated) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Sales Report</title>
      <style>body{font-family:system-ui,sans-serif;padding:20px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5;font-weight:600}.meta{margin-bottom:12px;font-size:14px;color:#444}</style></head><body>
      <h2>Sales Report</h2>
      <p class="meta">${periodLabel}</p>
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
    a.download = `sales-report-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={ShoppingCart}
        title="Sales Report"
        description="Sales by date range, branch, customer, and payment status — aligned with seller-admin columns."
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
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={`${filterFieldClass} w-full min-w-[9.25rem] sm:w-40`}
            aria-label="From date"
          />
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={`${filterFieldClass} w-full min-w-[9.25rem] sm:w-40`}
            aria-label="To date"
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
          <Select value={customerId || ALL} onValueChange={(v) => setCustomerId(v === ALL ? "" : v)}>
            <SelectTrigger className={`${filterFieldClass} w-full min-w-[11rem] sm:min-w-[12rem] sm:flex-1 sm:max-w-[18rem]`}>
              <SelectValue placeholder="All customers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All customers</SelectItem>
              {customers.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name || c.phone || `#${c.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={paymentStatus || ALL} onValueChange={(v) => setPaymentStatus(v === ALL ? "" : v)}>
            <SelectTrigger className={`${filterFieldClass} w-full min-w-[10rem] sm:w-[10.5rem]`}>
              <SelectValue placeholder="All payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All payment</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="due">Due</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex w-full flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-10 gap-2 rounded-xl"
              onClick={handleReset}
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <Button type="submit" className="h-10 gap-2 rounded-xl" disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Generating…" : "Generate"}
            </Button>
          </div>
        </form>
      </section>

      {generated && summary ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total units sold" value={summary.totalUnitsSold} icon={BarChart3} />
          <StatCard title="Total sales" value={formatPrice(summary.totalSalesAmount)} icon={DollarSign} />
          <StatCard title="Total paid" value={formatPrice(summary.totalPaid)} icon={CreditCard} />
          <StatCard title="Total due" value={formatPrice(summary.totalDue)} icon={CreditCard} />
        </div>
      ) : null}

      {generated && report && !summary ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Invoices" value={report.totalSales} icon={BarChart3} />
          <StatCard
            title="Revenue"
            value={formatPrice(Number(report.revenue ?? report.totalRevenue ?? 0))}
            icon={DollarSign}
          />
          <StatCard title="Discount" value={formatPrice(report.totalDiscount)} icon={CreditCard} />
          <StatCard title="Tax" value={formatPrice(report.totalTax)} icon={CreditCard} />
        </div>
      ) : null}

      <div className="space-y-4">
        {!generated ? (
          <p className="rounded-xl border border-dashed border-border/80 bg-muted/20 py-10 text-center text-sm text-muted-foreground">
            Set filters and click <span className="font-medium text-foreground">Generate</span> to load the report.
          </p>
        ) : null}

        {generated && loading ? (
          <DataTable columns={columns} data={[]} loading inventoryStyle />
        ) : null}

        {generated && !loading && list.length === 0 ? (
          <div
            className={`${INVENTORY_CARD_SHELL} p-12 text-center text-muted-foreground`}
          >
            <ShoppingCart className="mx-auto mb-3 h-12 w-12 opacity-40" aria-hidden />
            <p className="m-0 font-medium">No sales found for the selected filters.</p>
          </div>
        ) : null}

        {generated && !loading && list.length > 0 ? (
          <>
            <div className="block space-y-3 lg:hidden">
              {list.map((row) => (
                <div key={row.id} className={`${INVENTORY_CARD_SHELL} p-4`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">
                        {row.invoiceNo ?? row.invoiceNumber ?? "—"}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {row.branch?.name ?? "—"} · {row.createdAt ? formatDate(row.createdAt) : "—"}
                      </p>
                    </div>
                    <span className="shrink-0 text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                      {formatPrice(Number(row.grandTotal))}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Paid {formatPrice(Number(row.paidAmount))}</span>
                    <span>·</span>
                    <span>Due {formatPrice(Number(row.dueAmount))}</span>
                    <span>·</span>
                    <span>Change {formatPrice(getChangeAmount(row))}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${orderBadgeClass(row.orderStatus)}`}
                    >
                      {labelStatus(row.orderStatus)}
                    </span>
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${paymentBadgeClass(row.paymentStatus)}`}
                    >
                      {labelStatus(row.paymentStatus)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden min-w-0 overflow-x-auto lg:block" ref={tableRef}>
              <DataTable columns={columns} data={list} loading={false} inventoryStyle />
            </div>
            {meta.total > 0 ? (
              <div className="flex flex-col gap-4 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
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
                  <option value="15">15 / page</option>
                  <option value="30">30 / page</option>
                  <option value="50">50 / page</option>
                  <option value="100">100 / page</option>
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
      </div>
    </div>
  );
}
