"use client";

import { useState, useEffect, useRef } from "react";
import { DollarSign, TrendingUp, TrendingDown, MinusCircle, BarChart3, Printer, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";

interface Branch { id: number; name: string; }

interface ProfitLossReport {
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  revenueBreakdown?: { label: string; amount: number }[];
  expenseBreakdown?: { label: string; amount: number }[];
}

export default function ProfitLossReportPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [report, setReport] = useState<ProfitLossReport | null>(null);
  const [loading, setLoading] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const headerBranchId = getSelectedBranch();

  useEffect(() => {
    apiFetch<any>("/branches")
      .then((d) => setBranches(d.branches || d.data || (Array.isArray(d) ? d : [])))
      .catch(() => {});
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const bid = branchFilter || headerBranchId;
      if (bid) params.set("branchId", String(bid));
      const res = await apiFetch<ProfitLossReport>(`/reports/profit-loss?${params}`);
      setReport(res);
    } catch {
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!contentRef.current || !report) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Profit & Loss Statement</title>
      <style>body{font-family:system-ui,sans-serif;padding:20px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5;font-weight:600}.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee}.total{font-weight:700;font-size:16px}</style></head><body>
      <h2>Profit & Loss Statement</h2>
      ${contentRef.current.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  };

  const selectClasses = "h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div>
      <PageHeader
        title="Profit & Loss Report"
        description="View profit and loss statement"
        action={report ? <Button variant="outline" onClick={handlePrint}><Printer size={16} className="mr-2" /> Print</Button> : undefined}
      />

      <div className="bg-white rounded-xl border border-border p-5 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 flex-wrap">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">From</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-auto" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">To</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-auto" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Branch</label>
            <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className={selectClasses}>
              <option value="">All Branches</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <Button onClick={handleGenerate} disabled={loading}>
            {loading ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
            {loading ? "Generating..." : "Generate"}
          </Button>
        </div>
      </div>

      {report && (
        <div ref={contentRef} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatCard title="Revenue" value={formatPrice(report.revenue)} icon={DollarSign} />
            <StatCard title="COGS" value={formatPrice(report.cogs)} icon={MinusCircle} />
            <StatCard title="Gross Profit" value={formatPrice(report.grossProfit)} icon={TrendingUp} />
            <StatCard title="Expenses" value={formatPrice(report.expenses)} icon={TrendingDown} />
            <StatCard
              title="Net Profit"
              value={formatPrice(report.netProfit)}
              icon={BarChart3}
              className={report.netProfit >= 0 ? "ring-1 ring-green-200" : "ring-1 ring-red-200"}
            />
          </div>

          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-muted/30">
              <h3 className="font-semibold text-foreground">Profit & Loss Statement</h3>
              {dateFrom && dateTo && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Period: {new Date(dateFrom).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })} — {new Date(dateTo).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                </p>
              )}
            </div>

            <div className="divide-y divide-border">
              <div className="px-5 py-3 bg-green-50/50">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Revenue</p>
                {report.revenueBreakdown?.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-foreground">{item.label}</span>
                    <span className="text-sm font-medium text-foreground">{formatPrice(item.amount)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-2 mt-1 border-t border-green-200">
                  <span className="text-sm font-bold text-foreground">Total Revenue</span>
                  <span className="text-sm font-bold text-green-600">{formatPrice(report.revenue)}</span>
                </div>
              </div>

              <div className="px-5 py-3">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm font-medium text-foreground">Cost of Goods Sold (COGS)</span>
                  <span className="text-sm font-medium text-red-600">({formatPrice(report.cogs)})</span>
                </div>
              </div>

              <div className="px-5 py-3 bg-blue-50/50">
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm font-bold text-foreground">Gross Profit</span>
                  <span className={`text-lg font-bold ${report.grossProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatPrice(report.grossProfit)}
                  </span>
                </div>
              </div>

              <div className="px-5 py-3 bg-red-50/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Operating Expenses</p>
                {report.expenseBreakdown?.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-foreground">{item.label}</span>
                    <span className="text-sm font-medium text-foreground">{formatPrice(item.amount)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between py-2 mt-1 border-t border-red-200">
                  <span className="text-sm font-bold text-foreground">Total Expenses</span>
                  <span className="text-sm font-bold text-red-600">({formatPrice(report.expenses)})</span>
                </div>
              </div>

              <div className="px-5 py-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-foreground">Net Profit / (Loss)</span>
                  <span className={`text-xl font-bold ${report.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {report.netProfit >= 0 ? formatPrice(report.netProfit) : `(${formatPrice(Math.abs(report.netProfit))})`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!report && !loading && (
        <div className="bg-white rounded-xl border border-border p-8 text-center">
          <BarChart3 size={48} className="mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Select a date range and click Generate to view the Profit & Loss statement.</p>
        </div>
      )}
    </div>
  );
}
