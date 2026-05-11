"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, RefreshCw, RotateCcw, TrendingUp, TrendingDown, Printer } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { formatPrice, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/common/PageHeader";

interface Branch {
  id: number;
  name: string;
}

type DataKeys =
  | "posSales"
  | "ecommerceSales"
  | "wholesaleSales"
  | "quickSellSales"
  | "totalSales"
  | "serviceIncome"
  | "othersIncome"
  | "returnGain"
  | "totalIncome"
  | "grossProfit"
  | "cogs"
  | "salesReturn"
  | "salaryWages"
  | "otherOperatingExpenses"
  | "totalExpense"
  | "netProfit";

interface ProfitLossData {
  year: number;
  branchId: number | null;
  monthLabels: string[];
  data: Record<DataKeys, number[]>;
}

type RowType = "section" | "sub" | "total" | "highlight" | "net";

const ALL = "__all__";

const DATA_KEYS: DataKeys[] = [
  "posSales",
  "ecommerceSales",
  "wholesaleSales",
  "quickSellSales",
  "totalSales",
  "serviceIncome",
  "othersIncome",
  "returnGain",
  "totalIncome",
  "grossProfit",
  "cogs",
  "salesReturn",
  "salaryWages",
  "otherOperatingExpenses",
  "totalExpense",
  "netProfit",
];

/** Seller-style rows: label, data key, row type, optional native tooltip */
const ROWS: { label: string; key: DataKeys; type: RowType; tip?: string }[] = [
  { label: "INCOME", key: "totalIncome", type: "section", tip: "Revenue summary" },
  {
    label: "Sales (POS)",
    key: "posSales",
    type: "sub",
    tip: "Counter & invoices not linked to an online order (product portion: grand total minus services on invoice)",
  },
  {
    label: "E‑commerce (orders)",
    key: "ecommerceSales",
    type: "sub",
    tip: "Fulfilled web orders: sales linked to an Order (product portion per invoice)",
  },
  { label: "Service Income", key: "serviceIncome", type: "sub", tip: "Income category name contains “service”" },
  { label: "Others Income", key: "othersIncome", type: "sub" },
  {
    label: "Return gain (damage retention)",
    key: "returnGain",
    type: "sub",
    tip: "Portion of sales returns not refunded to the customer (seller-admin P&L line)",
  },
  { label: "Total Income", key: "totalIncome", type: "highlight" },
  { label: "Gross Profit", key: "grossProfit", type: "highlight" },
  { label: "EXPENSES", key: "totalExpense", type: "section", tip: "Costs" },
  { label: "Cost of Goods Sold", key: "cogs", type: "sub" },
  { label: "Sales Return", key: "salesReturn", type: "sub" },
  { label: "Salary & Wages", key: "salaryWages", type: "sub", tip: "Expense name matches salary / wage / payroll" },
  { label: "Other Operating", key: "otherOperatingExpenses", type: "sub" },
  { label: "Total Expense", key: "totalExpense", type: "highlight" },
  { label: "NET PROFIT", key: "netProfit", type: "net" },
];

const VARIANT: Record<
  RowType,
  { dash: boolean; label: string; val: string; row?: string }
> = {
  section: { dash: true, label: "font-semibold text-primary", val: "text-muted-foreground" },
  sub: { dash: false, label: "pl-6 sm:pl-8", val: "tabular-nums" },
  total: { dash: false, label: "bg-muted/50 font-semibold pl-6 sm:pl-8", val: "font-semibold tabular-nums", row: "bg-muted/50" },
  highlight: { dash: false, label: "font-bold", val: "font-bold tabular-nums", row: "bg-primary/5" },
  net: { dash: false, label: "font-bold border-t border-border bg-muted/40", val: "font-bold tabular-nums", row: "bg-muted/40 border-t-2 border-border" },
};

function pad12(a?: number[]): number[] {
  return a?.length === 12 ? a : Array.from({ length: 12 }, (_, i) => a?.[i] ?? 0);
}

function normalize(raw: ProfitLossData): ProfitLossData {
  const d = raw.data;
  const data = { ...d } as Record<DataKeys, number[]>;
  for (const k of DATA_KEYS) data[k] = pad12(d[k]);
  return { ...raw, data };
}

function sum12(a: number[]) {
  return a.reduce((x, y) => x + y, 0);
}

function cell(type: RowType, v: number) {
  if (type === "section") return "—";
  if (type === "net")
    return <span className={v >= 0 ? "font-bold text-emerald-600" : "font-bold text-red-600"}>{formatPrice(v)}</span>;
  if (type === "highlight")
    return <span className={v < 0 ? "font-bold text-red-600" : "font-bold text-primary"}>{formatPrice(v)}</span>;
  return formatPrice(v);
}

export default function ProfitLossReportPage() {
  const tableRef = useRef<HTMLDivElement>(null);
  const years = useMemo(() => {
    const c = new Date().getFullYear();
    return Array.from({ length: 17 }, (_, i) => c + 1 - i);
  }, []);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [branchId, setBranchId] = useState(ALL);
  const [report, setReport] = useState<ProfitLossData | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    apiFetch<{ branches?: Branch[]; data?: Branch[] } | Branch[]>("/branches")
      .then((d) => setBranches(Array.isArray(d) ? d : d.branches || d.data || []))
      .catch(() => setBranches([]));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setDone(false);
    try {
      const q = new URLSearchParams({ year: String(year) });
      if (branchId !== ALL) q.set("branchId", branchId);
      setReport(normalize(await apiFetch<ProfitLossData>(`/reports/profit-loss?${q}`)));
      setDone(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setYear(new Date().getFullYear());
    setBranchId(ALL);
    setReport(null);
    setDone(false);
  }

  function printTable() {
    if (!tableRef.current || !report) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(
      `<!DOCTYPE html><html><head><title>P&L ${report.year}</title><style>body{font:13px system-ui;padding:16px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px;text-align:right}td:first-child,th:first-child{text-align:left}th{background:#eee}</style></head><body><h2>P&L ${report.year}</h2>${tableRef.current.innerHTML}</body></html>`
    );
    w.document.close();
    w.print();
  }

  const totals = report
    ? {
        sales: sum12(report.data.totalSales),
        income: sum12(report.data.totalIncome),
        expense: sum12(report.data.totalExpense),
        net: sum12(report.data.netProfit),
      }
    : null;

  return (
    <div className="w-full min-w-0 space-y-5 pb-8">
      <PageHeader
        title="Profit & Loss"
        description="Year and branch: POS vs e‑commerce product sales, finance income & expense categories, gross and net profit."
        action={
          done && report ? (
            <Button type="button" variant="outline" size="sm" onClick={printTable}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          ) : undefined
        }
      />

      <form onSubmit={onSubmit} className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Year</label>
            <Select value={String(year)} onValueChange={(v) => setYear(+v)}>
              <SelectTrigger className="h-10 w-[130px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Branch</label>
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger className="h-10 min-w-[180px]">
                <SelectValue placeholder="All" />
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
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="h-10" onClick={reset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button type="submit" className="h-10" disabled={loading}>
              <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
              {loading ? "…" : "Generate"}
            </Button>
          </div>
        </div>
      </form>

      {done && report && totals && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(
            [
              { label: "Total Sales", value: totals.sales, Icon: TrendingUp, color: "text-blue-600" },
              { label: "Total Income", value: totals.income, Icon: TrendingUp, color: "text-indigo-600" },
              { label: "Total Expense", value: totals.expense, Icon: TrendingDown, color: "text-red-600" },
              {
                label: "Net Profit",
                value: totals.net,
                Icon: TrendingUp,
                color: totals.net >= 0 ? "text-emerald-600" : "text-red-600",
              },
            ] as const
          ).map(({ label, value, Icon, color }) => (
            <div key={label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Icon className={cn("h-4 w-4", color)} />
                {label}
              </div>
              <div className={cn("text-lg font-bold tabular-nums", color)}>{formatPrice(value)}</div>
            </div>
          ))}
        </div>
      )}

      {done && report && (
        <div ref={tableRef} className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <div className="min-w-[880px]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-primary/25 bg-muted/50">
                  <th className="sticky left-0 z-10 min-w-[180px] border-r bg-muted px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground">
                    Category
                  </th>
                  {report.monthLabels.map((lab, i) => (
                    <th
                      key={i}
                      className="border-r px-2 py-2.5 text-right text-xs font-medium text-muted-foreground tabular-nums last:border-r-0"
                    >
                      {lab}
                    </th>
                  ))}
                  <th className="border-l-2 border-primary/20 bg-primary/5 px-2 py-2.5 text-right text-xs font-bold text-primary tabular-nums">
                    {report.year}
                  </th>
                </tr>
              </thead>
              <tbody>
                {ROWS.map((row, idx) => {
                  const v = VARIANT[row.type];
                  const vals = report.data[row.key];
                  const gross = row.label === "Gross Profit";
                  return (
                    <tr key={idx} className={cn("hover:bg-muted/20", v.row, gross && "bg-emerald-500/5")}>
                      <td
                        title={row.tip}
                        className={cn(
                          "sticky left-0 z-[1] border-r border-border bg-card px-3 py-2",
                          v.label,
                          gross && "bg-emerald-50 font-bold text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200",
                        )}
                      >
                        {row.label}
                      </td>
                      {vals.map((n, i) => (
                        <td
                          key={i}
                          className={cn(
                            "border-r px-2 py-2 text-right tabular-nums last:border-r-0",
                            gross && "font-bold text-emerald-800 dark:text-emerald-200",
                            !gross && v.val,
                          )}
                        >
                          {v.dash ? "—" : cell(row.type, n)}
                        </td>
                      ))}
                      <td
                        className={cn(
                          "border-l-2 border-primary/15 bg-primary/5 px-2 py-2 text-right font-semibold tabular-nums",
                          gross && "text-emerald-800 dark:text-emerald-200",
                          !gross && v.val,
                        )}
                      >
                        {v.dash ? "—" : cell(row.type, sum12(vals))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!done && !loading && (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          <FileText className="mx-auto mb-2 h-9 w-9 opacity-40" />
          Select year and branch, then <strong>Generate</strong>.
        </div>
      )}
    </div>
  );
}
