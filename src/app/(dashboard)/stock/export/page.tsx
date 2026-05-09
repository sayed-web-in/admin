"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import { Package, Hash, DollarSign, Loader2, Download, Printer } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice, todayYmdInDhaka } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { DataTable } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";

interface Branch {
  id: number;
  name: string;
}

interface StockItem {
  id: number;
  productName: string;
  variantLabel?: string;
  sku?: string;
  quantity: number;
  unitPrice: number;
  totalValue: number;
}

export default function StockExportPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchFilter, setBranchFilter] = useState("");
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const headerBranchId = getSelectedBranch();

  useEffect(() => {
    apiFetch<any>("/branches")
      .then((d) => setBranches(d.branches || d.data || (Array.isArray(d) ? d : [])))
      .catch(() => {});
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      const bid = branchFilter || headerBranchId;
      if (bid) params.set("branchId", String(bid));
      const res = await apiFetch<any>(`/stock/export?${params}`);
      const list = res.data || (Array.isArray(res) ? res : []);
      setStockItems(list);
    } catch {
      setStockItems([]);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const totalQty = stockItems.reduce((s, p) => s + Number(p.quantity || 0), 0);
    const totalValue = stockItems.reduce((s, p) => s + Number(p.totalValue || p.quantity * p.unitPrice || 0), 0);
    return { total: stockItems.length, totalQty, totalValue };
  }, [stockItems]);

  const handlePrint = () => {
    const printContent = tableRef.current;
    if (!printContent) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Stock Export</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f5f5f5; font-weight: 600; }
        h2 { margin-bottom: 10px; }
        .summary { display: flex; gap: 30px; margin-bottom: 15px; font-size: 14px; }
      </style></head><body>
      <h2>Stock Report</h2>
      <div class="summary">
        <span><strong>Total Products:</strong> ${stats.total}</span>
        <span><strong>Total Qty:</strong> ${stats.totalQty}</span>
        <span><strong>Total Value:</strong> ${formatPrice(stats.totalValue)}</span>
      </div>
      ${printContent.innerHTML}
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const handleCSV = () => {
    if (stockItems.length === 0) return;
    const headers = ["#", "Product", "Variant", "SKU", "Qty", "Price", "Total Value"];
    const rows = stockItems.map((item, i) => [
      i + 1,
      item.productName,
      item.variantLabel || "",
      item.sku || "",
      item.quantity,
      item.unitPrice,
      item.totalValue || item.quantity * item.unitPrice,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock-export-${todayYmdInDhaka()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectClasses = "h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const columns = [
    { key: "index", label: "#", className: "w-12", render: (_: StockItem, i: number) => i + 1 },
    {
      key: "productName",
      label: "Product",
      render: (item: StockItem) => item.productName || "—",
    },
    {
      key: "variantLabel",
      label: "Variant",
      render: (item: StockItem) => item.variantLabel || "—",
    },
    {
      key: "sku",
      label: "SKU",
      render: (item: StockItem) => item.sku || "—",
    },
    {
      key: "quantity",
      label: "Available Qty",
      className: "text-center",
      render: (item: StockItem) => item.quantity,
    },
    {
      key: "unitPrice",
      label: "Selling Price",
      render: (item: StockItem) => formatPrice(Number(item.unitPrice)),
    },
    {
      key: "totalValue",
      label: "Total Value",
      render: (item: StockItem) => (
        <span className="font-medium">{formatPrice(Number(item.totalValue || item.quantity * item.unitPrice))}</span>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Stock Export"
        description="Export current stock data"
        action={
          stockItems.length > 0 ? (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePrint}>
                <Printer size={16} className="mr-2" /> Print
              </Button>
              <Button variant="outline" onClick={handleCSV}>
                <Download size={16} className="mr-2" /> CSV
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Total Products" value={stats.total} icon={Package} />
        <StatCard title="Total Quantity" value={stats.totalQty} icon={Hash} />
        <StatCard title="Total Value" value={formatPrice(stats.totalValue)} icon={DollarSign} />
      </div>

      <div className="bg-white rounded-xl border border-border p-5 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Branch</label>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className={selectClasses}
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <Button onClick={loadData} disabled={loading}>
            {loading ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
            {loading ? "Loading..." : "Load Data"}
          </Button>
        </div>
      </div>

      <div ref={tableRef}>
        <DataTable columns={columns} data={stockItems} loading={loading} />
      </div>
    </div>
  );
}
