"use client";
import { useState, useMemo } from "react";
import { Package, DollarSign, ShoppingBag, Loader2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { DataTable } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PurchasedProduct {
  id: number;
  productName: string;
  variantLabel?: string;
  quantity: number;
  unitCost: number;
  total: number;
  purchaseRef: string;
  purchaseDate: string;
}

export default function PurchaseProductsPage() {
  const [products, setProducts] = useState<PurchasedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const branchId = getSelectedBranch();

  const loadData = async () => {
    if (!dateFrom || !dateTo) {
      alert("Please select both dates");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ dateFrom, dateTo });
      if (branchId) params.set("branchId", String(branchId));
      const res = await apiFetch<any>(`/purchases/products?${params}`);
      const list = res.data || (Array.isArray(res) ? res : []);
      setProducts(list);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const totalQty = products.reduce((s, p) => s + Number(p.quantity || 0), 0);
    const totalAmount = products.reduce((s, p) => s + Number(p.total || p.unitCost * p.quantity || 0), 0);
    return { total: products.length, totalQty, totalAmount };
  }, [products]);

  const columns = [
    { key: "index", label: "#", className: "w-12", render: (_: PurchasedProduct, i: number) => i + 1 },
    {
      key: "productName",
      label: "Product",
      render: (item: PurchasedProduct) => item.productName || "—",
    },
    {
      key: "variantLabel",
      label: "Variant",
      render: (item: PurchasedProduct) => item.variantLabel || "—",
    },
    {
      key: "quantity",
      label: "Qty",
      className: "text-center",
      render: (item: PurchasedProduct) => item.quantity,
    },
    {
      key: "unitCost",
      label: "Unit Cost",
      render: (item: PurchasedProduct) => formatPrice(Number(item.unitCost)),
    },
    {
      key: "total",
      label: "Total",
      render: (item: PurchasedProduct) => (
        <span className="font-medium">{formatPrice(Number(item.total || item.unitCost * item.quantity))}</span>
      ),
    },
    {
      key: "purchaseRef",
      label: "Purchase Ref",
      render: (item: PurchasedProduct) => item.purchaseRef || "—",
    },
    {
      key: "purchaseDate",
      label: "Date",
      render: (item: PurchasedProduct) => formatDate(item.purchaseDate),
    },
  ];

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Purchase Products" description="View all purchased products by date range" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Total Products" value={stats.total} icon={Package} />
        <StatCard title="Total Quantity" value={stats.totalQty} icon={ShoppingBag} />
        <StatCard title="Total Amount" value={formatPrice(stats.totalAmount)} icon={DollarSign} />
      </div>

      <div className="bg-white rounded-xl border border-border p-5 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">From Date</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-44"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">To Date</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-44"
            />
          </div>
          <Button onClick={loadData} disabled={loading}>
            {loading ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}
            {loading ? "Loading..." : "Load Data"}
          </Button>
        </div>
      </div>

      <DataTable columns={columns} data={products} loading={loading} />
    </div>
  );
}
