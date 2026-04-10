"use client";

import { useState, useEffect, useRef } from "react";
import { ShoppingBag, DollarSign, CreditCard, AlertCircle, Printer, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { DataTable } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";

interface Branch { id: number; name: string; }

interface PurchaseRow {
  date: string;
  reference: string;
  supplier: string;
  total: number;
  paid: number;
  due: number;
}

interface PurchaseReport {
  totalPurchases: number;
  totalAmount: number;
  totalPaid: number;
  totalDue: number;
  purchases: PurchaseRow[];
}

export default function PurchaseReportPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [report, setReport] = useState<PurchaseReport | null>(null);
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
      const res = await apiFetch<PurchaseReport>(`/reports/purchases?${params}`);
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
    win.document.write(`<html><head><title>Purchase Report</title>
      <style>body{font-family:system-ui,sans-serif;padding:20px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5;font-weight:600}.summary{display:flex;gap:30px;margin-bottom:15px;font-size:14px}</style></head><body>
      <h2>Purchase Report</h2>
      <div class="summary">
        <span><strong>Total Purchases:</strong> ${report.totalPurchases}</span>
        <span><strong>Amount:</strong> ${formatPrice(report.totalAmount)}</span>
        <span><strong>Paid:</strong> ${formatPrice(report.totalPaid)}</span>
        <span><strong>Due:</strong> ${formatPrice(report.totalDue)}</span>
      </div>
      ${tableRef.current.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  };

  const selectClasses = "h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const columns = [
    { key: "date", label: "Date", render: (r: PurchaseRow) => formatDate(r.date) },
    { key: "reference", label: "Reference", render: (r: PurchaseRow) => <span className="font-medium">{r.reference}</span> },
    { key: "supplier", label: "Supplier", render: (r: PurchaseRow) => r.supplier || "—" },
    { key: "total", label: "Total", render: (r: PurchaseRow) => formatPrice(r.total) },
    { key: "paid", label: "Paid", render: (r: PurchaseRow) => <span className="text-green-600">{formatPrice(r.paid)}</span> },
    { key: "due", label: "Due", render: (r: PurchaseRow) => <span className={r.due > 0 ? "text-red-600 font-medium" : ""}>{formatPrice(r.due)}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Purchase Report"
        description="View detailed purchase report by date range"
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
          <StatCard title="Total Purchases" value={report.totalPurchases} icon={ShoppingBag} />
          <StatCard title="Total Amount" value={formatPrice(report.totalAmount)} icon={DollarSign} />
          <StatCard title="Total Paid" value={formatPrice(report.totalPaid)} icon={CreditCard} />
          <StatCard title="Total Due" value={formatPrice(report.totalDue)} icon={AlertCircle} />
        </div>
      )}

      <div ref={tableRef}>
        <DataTable columns={columns} data={report?.purchases || []} loading={loading} />
      </div>
    </div>
  );
}
