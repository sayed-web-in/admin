"use client";

import { useState, useEffect, useRef } from "react";
import { Printer, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";

interface Branch { id: number; name: string; }

interface ProductQtyRow {
  product: string;
  branch: string;
  availableQty: number;
  soldQty: number;
  totalValue: number;
}

export default function ProductQuantityReportPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [items, setItems] = useState<ProductQtyRow[]>([]);
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
      const res = await apiFetch<any>(`/reports/product-quantity?${params}`);
      setItems(res.items || res.data || (Array.isArray(res) ? res : []));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    if (!tableRef.current) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Product Quantity Report</title>
      <style>body{font-family:system-ui,sans-serif;padding:20px}table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5;font-weight:600}</style></head><body>
      <h2>Product Quantity Report</h2>
      ${tableRef.current.innerHTML}</body></html>`);
    win.document.close();
    win.print();
  };

  const selectClasses = "h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const columns = [
    { key: "product", label: "Product", render: (r: ProductQtyRow) => <span className="font-medium">{r.product}</span> },
    { key: "branch", label: "Branch", render: (r: ProductQtyRow) => r.branch || "—" },
    { key: "availableQty", label: "Available Qty", className: "text-center", render: (r: ProductQtyRow) => r.availableQty },
    { key: "soldQty", label: "Sold Qty", className: "text-center", render: (r: ProductQtyRow) => r.soldQty },
    { key: "totalValue", label: "Total Value", render: (r: ProductQtyRow) => <span className="font-semibold">{formatPrice(r.totalValue)}</span> },
  ];

  return (
    <div>
      <PageHeader
        title="Product Quantity Report"
        description="View available and sold quantities per product"
        action={items.length > 0 ? <Button variant="outline" onClick={handlePrint}><Printer size={16} className="mr-2" /> Print</Button> : undefined}
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

      <div ref={tableRef}>
        <DataTable columns={columns} data={items} loading={loading} />
      </div>
    </div>
  );
}
