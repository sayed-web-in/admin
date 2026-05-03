"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  DollarSign,
  TrendingUp,
  ShoppingBag,
  XCircle,
  BarChart3,
  RotateCcw,
  LayoutGrid,
  Layers,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate, cn } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
  InventorySectionHeader,
} from "@/components/inventory/InventoryCrudLayout";
import { StatCard } from "@/components/common/StatCard";
import { DataTable } from "@/components/common/DataTable";
import { InventoryTablePagination } from "@/components/inventory/InventoryTablePagination";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const LIMIT = 25;

interface RawItem {
  id: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: string | number;
  costPrice: string | number;
  totalPrice: string | number;
  lineSubtotal?: number;
  netRevenue?: number;
  netProfit?: number;
  saleOrder: {
    id: string;
    invoiceNo: string;
    orderNo: string;
    orderType: string;
    orderDate: string;
    grandTotal?: string | number;
    servicesTotal?: string | number;
    branch?: { id: string; name: string };
  };
  product?: {
    sellerCategory?: { id: string; name: string } | null;
    sellerBrand?: { id: string; name: string } | null;
  };
  variant?: {
    id: string;
    sku: string;
    attributes?: { attribute: { name: string }; attributeValue: { value: string } }[];
  };
}

interface Stats {
  totalTransactions: number;
  totalQty: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
}

interface ListResponse {
  data: RawItem[];
  total: number;
  page: number;
  totalPages: number;
}

const orderTypeLabel = (t: string) =>
  t === "wholesale" ? "Wholesale" : t === "quick_sell" ? "Quick Sell" : "POS";

const orderTypeBadgeClass = (t: string) =>
  cn(
    "inline-flex rounded-md border px-2 py-0.5 text-xs font-medium",
    t === "wholesale" &&
      "border-purple-500/30 bg-purple-500/15 text-purple-700 dark:text-purple-300",
    t === "quick_sell" &&
      "border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300",
    (t === "pos" || !t || (t !== "wholesale" && t !== "quick_sell")) &&
      "border-blue-500/30 bg-blue-500/15 text-blue-800 dark:text-blue-300"
  );

const getDateRange = (preset: string) => {
  const now = new Date();
  if (preset === "today") {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }
  if (preset === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }
  if (preset === "year") {
    const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { startDate: monthStart.toISOString(), endDate: monthEnd.toISOString() };
};

function variantDisplay(item: RawItem) {
  const attrs = item.variant?.attributes
    ?.map((a) => a.attributeValue.value)
    .join(", ");
  return attrs || item.variant?.sku || item.sku || "—";
}

export default function ProductTransactionsPage() {
  const router = useRouter();
  const [branchId, setBranchId] = useState<number | null>(() => getSelectedBranch());

  useEffect(() => {
    const h = () => setBranchId(getSelectedBranch());
    window.addEventListener("branch-changed", h);
    return () => window.removeEventListener("branch-changed", h);
  }, []);

  const [orderType, setOrderType] = useState("");
  const [datePreset, setDatePreset] = useState("month");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<RawItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<Stats>({
    totalTransactions: 0,
    totalQty: 0,
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState("");

  const buildParams = useCallback(
    (extraPage?: number) => {
      const { startDate, endDate } = getDateRange(datePreset);
      const p = new URLSearchParams();
      p.set("startDate", startDate);
      p.set("endDate", endDate);
      p.set("page", String(extraPage ?? page));
      p.set("limit", String(LIMIT));
      if (branchId != null) p.set("branchId", String(branchId));
      if (orderType) p.set("orderType", orderType);
      return p;
    },
    [datePreset, page, branchId, orderType]
  );

  const fetchPage = useCallback(
    async (targetPage: number) => {
      setLoading(true);
      setError("");
      try {
        const params = buildParams(targetPage);
        const json = await apiFetch<ListResponse>(
          `/sales/product-transactions?${params.toString()}`
        );
        setItems(json.data ?? []);
        setTotal(json.total ?? 0);
        setTotalPages(json.totalPages ?? 1);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load");
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [buildParams]
  );

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const { startDate, endDate } = getDateRange(datePreset);
      const p = new URLSearchParams();
      p.set("startDate", startDate);
      p.set("endDate", endDate);
      p.set("page", "1");
      p.set("limit", "99999");
      if (branchId != null) p.set("branchId", String(branchId));
      if (orderType) p.set("orderType", orderType);
      const json = await apiFetch<ListResponse>(
        `/sales/product-transactions?${p.toString()}`
      );
      const all: RawItem[] = json.data ?? [];
      const totalQty = all.reduce((s, r) => s + Number(r.quantity), 0);
      const totalRevenue = all.reduce(
        (s, r) => s + Number(r.netRevenue ?? r.totalPrice),
        0
      );
      const totalCost = all.reduce(
        (s, r) => s + Number(r.quantity) * Number(r.costPrice),
        0
      );
      const totalProfit = all.reduce((s, r) => {
        if (r.netProfit != null) return s + Number(r.netProfit);
        const nr = Number(r.netRevenue ?? r.totalPrice);
        return s + (nr - Number(r.quantity) * Number(r.costPrice));
      }, 0);
      setStats({
        totalTransactions: json.total ?? 0,
        totalQty,
        totalRevenue,
        totalCost,
        totalProfit,
      });
    } catch {
      setStats({
        totalTransactions: 0,
        totalQty: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
      });
    } finally {
      setStatsLoading(false);
    }
  }, [datePreset, branchId, orderType]);

  useEffect(() => {
    setPage(1);
    void fetchPage(1);
    void fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset page on filter change
  }, [datePreset, branchId, orderType]);

  const handlePageChange = (p: number) => {
    setPage(p);
    void fetchPage(p);
  };

  const refresh = () => {
    void fetchPage(page);
    void fetchStats();
  };

  const columns = [
    {
      key: "#",
      label: "#",
      className: "w-10",
      render: (_: RawItem, i: number) => (
        <span className="text-muted-foreground">{(page - 1) * LIMIT + i + 1}</span>
      ),
    },
    {
      key: "invoice",
      label: "Invoice / Date",
      render: (row: RawItem) => (
        <div>
          <div className="font-medium text-foreground">{row.saleOrder.invoiceNo}</div>
          <div className="text-xs text-muted-foreground">
            {formatDate(row.saleOrder.orderDate)}
          </div>
        </div>
      ),
    },
    {
      key: "channel",
      label: "Channel",
      render: (row: RawItem) => (
        <span className={orderTypeBadgeClass(row.saleOrder.orderType)}>
          {orderTypeLabel(row.saleOrder.orderType)}
        </span>
      ),
    },
    {
      key: "branch",
      label: "Branch",
      render: (row: RawItem) => (
        <span className="text-sm text-muted-foreground">
          {row.saleOrder.branch?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "product",
      label: "Product",
      render: (row: RawItem) => (
        <span className="font-medium text-foreground">{row.productName}</span>
      ),
    },
    {
      key: "variant",
      label: "Variant",
      render: (row: RawItem) => (
        <span className="max-w-[180px] truncate text-sm text-muted-foreground">
          {variantDisplay(row)}
        </span>
      ),
    },
    {
      key: "catbrand",
      label: "Category / Brand",
      render: (row: RawItem) => (
        <div>
          <div className="text-sm font-medium text-foreground">
            {row.product?.sellerCategory?.name ?? "—"}
          </div>
          <div className="text-xs text-muted-foreground">
            {row.product?.sellerBrand?.name ?? "—"}
          </div>
        </div>
      ),
    },
    {
      key: "unitPrice",
      label: "Unit Price",
      className: "text-right",
      render: (row: RawItem) => (
        <span className="tabular-nums text-muted-foreground">
          {formatPrice(Number(row.unitPrice))}
        </span>
      ),
    },
    {
      key: "cost",
      label: "Cost Price",
      className: "text-right",
      render: (row: RawItem) => {
        const qty = Number(row.quantity);
        const costPrice = Number(row.costPrice);
        const cost = qty * costPrice;
        return (
          <div>
            <div className="font-medium tabular-nums text-foreground">
              {formatPrice(cost)}
            </div>
            <div className="text-xs text-muted-foreground">
              ({formatPrice(costPrice)} × {qty})
            </div>
          </div>
        );
      },
    },
    {
      key: "netRev",
      label: "Net revenue",
      className: "text-right",
      render: (row: RawItem) => {
        const lineSub = Number(row.lineSubtotal ?? row.totalPrice);
        const revenue = Number(row.netRevenue ?? row.totalPrice);
        return (
          <div>
            <div className="font-medium tabular-nums text-foreground">
              {formatPrice(revenue)}
            </div>
            {lineSub !== revenue && (
              <div className="text-xs opacity-80">line {formatPrice(lineSub)}</div>
            )}
          </div>
        );
      },
    },
    {
      key: "netProfit",
      label: "Net profit",
      className: "text-right",
      render: (row: RawItem) => {
        const qty = Number(row.quantity);
        const costPrice = Number(row.costPrice);
        const revenue = Number(row.netRevenue ?? row.totalPrice);
        const cost = qty * costPrice;
        const profit =
          row.netProfit != null ? Number(row.netProfit) : revenue - cost;
        return (
          <span
            className={cn(
              "text-sm font-semibold tabular-nums",
              profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
            )}
          >
            {formatPrice(profit)}
          </span>
        );
      },
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={Package}
        title="Product Transactions"
        description="Product-wise sales, cost and profit — POS, Quick Sell, Wholesale. Revenue uses each order's net product total (grand total minus services), split across lines so coupons, gift cards, VIP, and order discounts match accounting."
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-full rounded-xl sm:h-9 sm:w-auto"
          onClick={() => router.back()}
        >
          Back
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-full gap-2 rounded-xl sm:h-9 sm:w-auto"
          onClick={refresh}
        >
          <RotateCcw className="h-4 w-4" /> Refresh
        </Button>
      </InventoryListPageHeader>

      <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
        <InventorySectionHeader
          icon={LayoutGrid}
          title="Overview"
          description="Totals for current filters (stats load full filtered set)."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Transactions"
            value={statsLoading ? "—" : String(stats.totalTransactions)}
            icon={BarChart3}
            trend={statsLoading ? undefined : `${stats.totalQty} qty`}
          />
          <StatCard
            title="Total Revenue"
            value={statsLoading ? "—" : formatPrice(stats.totalRevenue)}
            icon={DollarSign}
          />
          <StatCard
            title="Total Cost"
            value={statsLoading ? "—" : formatPrice(stats.totalCost)}
            icon={ShoppingBag}
          />
          <StatCard
            title="Total Profit"
            value={statsLoading ? "—" : formatPrice(stats.totalProfit)}
            icon={TrendingUp}
          />
        </div>
      </section>

      <section className={INVENTORY_CARD_SHELL}>
        <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
          <InventorySectionHeader
            compact
            icon={Layers}
            title="Filters"
            description="Date range, channel, and branch (from header)."
          />
        </div>
        <div className="flex flex-wrap gap-3 p-5 sm:p-6 md:p-7">
          <select
            value={datePreset}
            onChange={(e) => setDatePreset(e.target.value)}
            className="h-10 min-w-[150px] rounded-xl border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="year">This Year</option>
          </select>
          <select
            value={orderType}
            onChange={(e) => setOrderType(e.target.value)}
            className="h-10 min-w-[150px] rounded-xl border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All Channels</option>
            <option value="pos">POS</option>
            <option value="quick_sell">Quick Sell</option>
            <option value="wholesale">Wholesale</option>
          </select>
          <Badge variant="outline" className="h-10 items-center px-3 text-sm font-normal">
            Branch: from header{branchId != null ? ` (#${branchId})` : " (all)"}
          </Badge>
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <p className="m-0 text-sm font-semibold text-destructive">{error}</p>
          </div>
        </div>
      )}

      {!loading && items.length === 0 ? (
        <section className={`${INVENTORY_CARD_SHELL} p-16 text-center`}>
          <Package className="mx-auto mb-4 h-16 w-16 text-muted-foreground opacity-50" />
          <p className="m-0 font-medium text-muted-foreground">No transactions found</p>
          <p className="mt-2 text-sm text-muted-foreground">Try changing the filters</p>
        </section>
      ) : (
        <>
          <div className="block space-y-4 lg:hidden">
            {!loading &&
              items.map((row) => {
                const qty = Number(row.quantity);
                const costPrice = Number(row.costPrice);
                const revenue = Number(row.netRevenue ?? row.totalPrice);
                const cost = qty * costPrice;
                const profit =
                  row.netProfit != null ? Number(row.netProfit) : revenue - cost;
                return (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                  >
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-foreground">{row.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.saleOrder.invoiceNo} · {formatDate(row.saleOrder.orderDate)}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 font-semibold tabular-nums",
                          profit >= 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        )}
                      >
                        {formatPrice(profit)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{orderTypeLabel(row.saleOrder.orderType)}</span>
                      <span>·</span>
                      <span>Qty: {qty}</span>
                      <span>·</span>
                      <span>Revenue: {formatPrice(revenue)}</span>
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="hidden min-w-0 overflow-x-auto lg:block">
            <DataTable columns={columns} data={items} loading={loading} inventoryStyle />
          </div>

          <InventoryTablePagination
            page={page}
            lastPage={totalPages}
            total={total}
            loading={loading}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </div>
  );
}
