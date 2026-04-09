"use client";

import { useState, useEffect, useRef } from "react";
import { Package, Hash, DollarSign, AlertTriangle, Printer, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { DataTable } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";

interface Branch { id: number; name: string; }

interface StockRow {
  product: string;
  variant: string;
  branch: string;
  quantity: number;
  price: number;
  value: number;
}

interface StockReport {
  totalProducts: number;
  totalQty: number;
  totalValue: number;
  lowStock: number;
  items: StockRow[];
}

export default function StockReportPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [report, setReport] = useState<StockReport | null>(null);
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
      const res = await apiFetch<StockReport>(`/reports/stock?${params}`);
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
    win.document.write(`<html><head><title>Stock Report</title>
      <style>body{font-family:system-ui,sans-serif;padding:20px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5;font-weight:600}.summary{display:flex;gap:30px;margin-bottom:15px;font-size:14px}</style></head><body>
      <h2>Stock Report</h2>
      <div class="summary">
        <span><strong>Products:</strong> ${report.totalProducts}</span>
        <span><strong>Qty:</strong> ${report.totalQty}</span>
        <span><strong>Value:</strong> ${formatPrice(report.totalValue)}</span>
        <span><strong>Low Stock:</strong> ${report.lowStock}</span>
      </div>
      ${tableRef.current.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  };

  const selectClasses = "h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const columns = [
    { key: "product", label: "Product", render: (r: StockRow) => <span className="font-medium">{r.product}</span> },
    { key: "variant", label: "Variant", render: (r: StockRow) => r.variant || "—" },
    { key: "branch", label: "Branch", render: (r: StockRow) => r.branch || "—" },
    { key: "quantity", label: "Qty", className: "text-center", render: (r: StockRow) => r.quantity },
    { key: "price", label: "Price", render: (r: StockRow) => formatPrice(r.price) },
    { key: "value", label: "Value", render: (r: StockRow) => <span className="font-semibold">{formatPrice(r.value)}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Stock Report"
        description="View current stock levels across branches"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard title="Total Products" value={report.totalProducts} icon={Package} />
          <StatCard title="Total Qty" value={report.totalQty} icon={Hash} />
          <StatCard title="Total Value" value={formatPrice(report.totalValue)} icon={DollarSign} />
          <StatCard title="Low Stock" value={report.lowStock} icon={AlertTriangle} />
        </div>
      )}

      <div ref={tableRef}>
        <DataTable columns={columns} data={report?.items || []} loading={loading} />
      </div>
    </div>
  );
}
