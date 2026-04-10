"use client";

import { useState, useEffect, useRef } from "react";
import { DollarSign, Receipt, Percent, Calculator, Printer, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { DataTable } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";

interface Branch { id: number; name: string; }

interface SaleRow {
  date: string;
  invoice: string;
  customer: string;
  total: number;
  discount: number;
  tax: number;
  grandTotal: number;
}

interface SalesReport {
  totalSales: number;
  revenue: number;
  totalDiscount: number;
  totalTax: number;
  sales: SaleRow[];
}

export default function SalesReportPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [report, setReport] = useState<SalesReport | null>(null);
  const [loading, setLoading] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
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
      const res = await apiFetch<SalesReport>(`/reports/sales?${params}`);
      setReport(res);
    } catch {
      setReport(null);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!tableRef.current || !report) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Sales Report</title>
      <style>body{font-family:system-ui,sans-serif;padding:20px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5;font-weight:600}.summary{display:flex;gap:30px;margin-bottom:15px;font-size:14px}</style></head><body>
      <h2>Sales Report</h2>
      <div class="summary">
        <span><strong>Total Sales:</strong> ${report.totalSales}</span>
        <span><strong>Revenue:</strong> ${formatPrice(report.revenue)}</span>
        <span><strong>Discount:</strong> ${formatPrice(report.totalDiscount)}</span>
        <span><strong>Tax:</strong> ${formatPrice(report.totalTax)}</span>
      </div>
      ${tableRef.current.innerHTML}
      </body></html>`);
    win.document.close();
    win.print();
  };

  const selectClasses = "h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const columns = [
    { key: "date", label: "Date", render: (r: SaleRow) => formatDate(r.date) },
    { key: "invoice", label: "Invoice", render: (r: SaleRow) => <span className="font-medium">{r.invoice}</span> },
    { key: "customer", label: "Customer", render: (r: SaleRow) => r.customer || "Walk-in" },
    { key: "total", label: "Total", render: (r: SaleRow) => formatPrice(r.total) },
    { key: "discount", label: "Discount", render: (r: SaleRow) => formatPrice(r.discount) },
    { key: "tax", label: "Tax", render: (r: SaleRow) => formatPrice(r.tax) },
    { key: "grandTotal", label: "Grand Total", render: (r: SaleRow) => <span className="font-semibold">{formatPrice(r.grandTotal)}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Sales Report"
        description="View detailed sales report by date range"
        action={
          report ? (
            <Button variant="outline" onClick={handlePrint}>
              <Printer size={16} className="mr-2" /> Print
            </Button>
          ) : undefined
        }
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard title="Total Sales" value={report.totalSales} icon={Receipt} />
          <StatCard title="Revenue" value={formatPrice(report.revenue)} icon={DollarSign} />
          <StatCard title="Total Discount" value={formatPrice(report.totalDiscount)} icon={Percent} />
          <StatCard title="Total Tax" value={formatPrice(report.totalTax)} icon={Calculator} />
        </div>
      )}

      <div ref={tableRef}>
        <DataTable columns={columns} data={report?.sales || []} loading={loading} />
      </div>
    </div>
  );
}
