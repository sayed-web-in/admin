"use client";

import { useEffect, useState, useMemo } from "react";
import {
  AlertTriangle,
  AlertOctagon,
  AlertCircle,
  Store,
  Eye,
  ImageIcon,
} from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Branch {
  id: number;
  name: string;
}

interface LowStockItem {
  id: number;
  productId: number;
  image?: string;
  productName: string;
  type: string;
  variantLabel?: string;
  unitPrice: number;
  taxRate?: number;
  quantity: number;
  quantityAlert: number;
  branchName: string;
}

export default function LowStockPage() {
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterBranch, setFilterBranch] = useState(0);

  useEffect(() => {
    setLoading(true);
    apiFetch<{ items: LowStockItem[] }>("/products/low-stock")
      .then((d) => setItems(d.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));

    apiFetch<{ branches: Branch[] }>("/branches")
      .then((d) => setBranches(d.branches || []))
      .catch(() => {});
  }, []);

  const stats = useMemo(() => {
    const critical = items.filter((i) => i.quantity === 0).length;
    const warning = items.filter(
      (i) => i.quantity > 0 && i.quantity <= 5
    ).length;
    const branchCount = filterBranch
      ? items.filter(
          (i) => branches.find((b) => b.id === filterBranch)?.name === i.branchName
        ).length
      : items.length;
    return { total: items.length, critical, warning, branchCount };
  }, [items, filterBranch, branches]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (
        search &&
        !item.productName.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      if (filterStatus === "critical" && item.quantity !== 0) return false;
      if (filterStatus === "warning" && (item.quantity === 0 || item.quantity > 5))
        return false;
      if (
        filterBranch &&
        branches.find((b) => b.id === filterBranch)?.name !== item.branchName
      )
        return false;
      return true;
    });
  }, [items, search, filterStatus, filterBranch, branches]);

  const getStockStatus = (qty: number) => {
    if (qty === 0)
      return (
        <Badge variant="destructive" className="gap-1">
          <AlertOctagon size={12} /> Out of Stock
        </Badge>
      );
    if (qty <= 5)
      return (
        <Badge variant="warning" className="gap-1">
          <AlertCircle size={12} /> Low Stock
        </Badge>
      );
    return <Badge variant="success">In Stock</Badge>;
  };

  const selectClasses =
    "h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const columns = [
    {
      key: "index",
      label: "#",
      className: "w-10",
      render: (_: LowStockItem, i: number) => i + 1,
    },
    {
      key: "image",
      label: "Image",
      className: "w-14",
      render: (item: LowStockItem) =>
        item.image ? (
          <img
            src={item.image}
            alt={item.productName}
            className="w-10 h-10 rounded-lg object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <ImageIcon size={14} className="text-muted-foreground" />
          </div>
        ),
    },
    { key: "productName", label: "Name" },
    {
      key: "type",
      label: "Type",
      render: (item: LowStockItem) => (
        <Badge variant="secondary">{item.type}</Badge>
      ),
    },
    {
      key: "variant",
      label: "Variant",
      render: (item: LowStockItem) => item.variantLabel || "—",
    },
    {
      key: "unitPrice",
      label: "Unit Price",
      render: (item: LowStockItem) => formatPrice(item.unitPrice),
    },
    {
      key: "tax",
      label: "Tax",
      render: (item: LowStockItem) =>
        item.taxRate ? `${item.taxRate}%` : "—",
    },
    { key: "quantity", label: "Qty" },
    {
      key: "status",
      label: "Status",
      render: (item: LowStockItem) => getStockStatus(item.quantity),
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: LowStockItem) => (
        <Link href={`/inventory/manage-product/${item.productId}`}>
          <Button variant="ghost" size="sm">
            <Eye size={14} />
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Low Stock Products"
        description="Products that need restocking"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Low Stock"
          value={stats.total}
          icon={AlertTriangle}
        />
        <StatCard
          title="Critical (Qty=0)"
          value={stats.critical}
          icon={AlertOctagon}
        />
        <StatCard
          title="Warning (Qty≤5)"
          value={stats.warning}
          icon={AlertCircle}
        />
        <StatCard
          title="Filtered Count"
          value={stats.branchCount}
          icon={Store}
        />
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search products..."
      >
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={selectClasses}
        >
          <option value="">All Status</option>
          <option value="critical">Critical (Qty=0)</option>
          <option value="warning">Warning (Qty≤5)</option>
        </select>
        <select
          value={filterBranch}
          onChange={(e) => setFilterBranch(Number(e.target.value))}
          className={selectClasses}
        >
          <option value={0}>All Branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </FilterBar>

      <DataTable columns={columns} data={filtered} loading={loading} />
    </div>
  );
}
