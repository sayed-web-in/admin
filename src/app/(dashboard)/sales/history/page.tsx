"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShoppingCart,
  DollarSign,
  TrendingUp,
  CalendarDays,
  Eye,
  RotateCcw,
  LayoutGrid,
  Layers,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";
import { unwrapPaginated } from "@/lib/apiList";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
  InventorySectionHeader,
} from "@/components/inventory/InventoryCrudLayout";
import { StatCard } from "@/components/common/StatCard";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { InventoryTablePagination } from "@/components/inventory/InventoryTablePagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 20;

const filterFieldClass =
  "h-10 rounded-xl border border-input bg-background/80 px-3 text-sm shadow-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-40";

interface SaleItem {
  id: number;
  quantity: number;
  unitPrice: number;
  serialNumbers?: string[];
  storeProduct?: {
    product?: { name: string };
  };
}

interface Sale {
  id: number;
  invoiceNumber: string;
  order?: { id: number; orderNumber: string } | null;
  customer?: { name: string; phone: string; email?: string };
  items?: SaleItem[];
  itemCount?: number;
  _count?: { items: number };
  totalAmount: number;
  grandTotal: number;
  discount: number;
  paidAmount: number;
  dueAmount: number;
  changeAmount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

export default function SalesHistoryPage() {
  const router = useRouter();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, lastPage: 1, total: 0 });
  const [stats, setStats] = useState({
    total: 0,
    totalRevenue: 0,
    todaySales: 0,
    todayRevenue: 0,
  });
  const branchId = getSelectedBranch();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, dateFrom, dateTo, branchId]);

  const summaryParams = useCallback(() => {
    const qs = new URLSearchParams();
    if (branchId) qs.set("branchId", String(branchId));
    if (debouncedSearch) qs.set("search", debouncedSearch);
    if (statusFilter) qs.set("status", statusFilter);
    if (dateFrom) qs.set("dateFrom", dateFrom);
    if (dateTo) qs.set("dateTo", dateTo);
    return qs.toString();
  }, [branchId, debouncedSearch, statusFilter, dateFrom, dateTo]);

  const loadSummary = useCallback(async () => {
    try {
      const q = summaryParams();
      const res = await apiFetch<unknown>(`/sales/summary${q ? `?${q}` : ""}`);
      const body = res && typeof res === "object" ? (res as Record<string, unknown>) : {};
      setStats({
        total: Number(body.total) || 0,
        totalRevenue: Number(body.totalRevenue) || 0,
        todaySales: Number(body.todaySales) || 0,
        todayRevenue: Number(body.todayRevenue) || 0,
      });
    } catch {
      setStats({ total: 0, totalRevenue: 0, todaySales: 0, todayRevenue: 0 });
    }
  }, [summaryParams]);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (branchId) qs.set("branchId", String(branchId));
      if (debouncedSearch) qs.set("search", debouncedSearch);
      if (statusFilter) qs.set("status", statusFilter);
      if (dateFrom) qs.set("dateFrom", dateFrom);
      if (dateTo) qs.set("dateTo", dateTo);
      const res = await apiFetch<unknown>(`/sales?${qs}`);
      const p = unwrapPaginated<Sale>(res);
      if (p) {
        setSales(p.data);
        setMeta({ page: p.page, lastPage: p.lastPage, total: p.total });
        if (p.page > p.lastPage) setPage(p.lastPage);
      } else {
        setSales([]);
        setMeta({ page: 1, lastPage: 1, total: 0 });
      }
    } catch {
      setSales([]);
      setMeta({ page: 1, lastPage: 1, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [branchId, debouncedSearch, statusFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void fetchSales();
  }, [fetchSales]);

  const refresh = () => {
    void Promise.all([fetchSales(), loadSummary()]);
  };

  const openView = (sale: Sale) => {
    router.push(`/sales/history/${sale.id}`);
  };

  const itemCountCell = (item: Sale) =>
    item._count?.items ?? item.items?.length ?? item.itemCount ?? "—";

  const columns = [
    {
      key: "index",
      label: "#",
      className: "w-12",
      render: (_: Sale, i: number) => (page - 1) * PAGE_SIZE + i + 1,
    },
    { key: "invoiceNumber", label: "Invoice No" },
    {
      key: "source",
      label: "Source",
      className: "min-w-[7rem]",
      render: (item: Sale) =>
        item.order ? (
          <Link
            href={`/ecommerce/orders/${item.order.id}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            {item.order.orderNumber}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">POS</span>
        ),
    },
    {
      key: "customer",
      label: "Customer",
      render: (item: Sale) => item.customer?.name || "Walking Customer",
    },
    {
      key: "itemCount",
      label: "Items",
      className: "text-center",
      render: (item: Sale) => itemCountCell(item),
    },
    {
      key: "grandTotal",
      label: "Total",
      render: (item: Sale) => (
        <span className="font-medium">{formatPrice(Number(item.grandTotal))}</span>
      ),
    },
    {
      key: "paidAmount",
      label: "Paid",
      render: (item: Sale) => formatPrice(Number(item.paidAmount || 0)),
    },
    {
      key: "dueAmount",
      label: "Due",
      render: (item: Sale) => {
        const due = Number(item.dueAmount || 0);
        return due > 0 ? (
          <span className="text-red-600">{formatPrice(due)}</span>
        ) : (
          <span className="text-green-600">{formatPrice(0)}</span>
        );
      },
    },
    {
      key: "paymentMethod",
      label: "Method",
      render: (item: Sale) => (
        <span className="capitalize text-muted-foreground">
          {item.paymentMethod?.replace("_", " ")}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (item: Sale) => <StatusBadge status={item.status} />,
    },
    {
      key: "createdAt",
      label: "Date",
      render: (item: Sale) => formatDate(item.createdAt),
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: Sale) => (
        <button
          type="button"
          onClick={() => openView(item)}
          className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 hover:border-indigo-300 transition-colors"
          title="View details"
        >
          <Eye size={15} />
        </button>
      ),
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={ShoppingCart}
        title="Sales History"
        description="All sales with filters — overview matches the same branch, dates, status, and search as the table."
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-full gap-2 rounded-xl border-border/80 bg-background/80 backdrop-blur-sm sm:h-9 sm:w-auto"
          onClick={() => router.back()}
        >
          Back
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-full gap-2 rounded-xl border-border/80 bg-background/80 backdrop-blur-sm sm:h-9 sm:w-auto"
          onClick={refresh}
        >
          <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
          Refresh
        </Button>
      </InventoryListPageHeader>

      <div className="space-y-5 sm:space-y-6">
        <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
          <InventorySectionHeader
            icon={LayoutGrid}
            title="Overview"
            description="Totals and today’s figures from GET /sales/summary with your current filters."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Sales" value={stats.total} icon={ShoppingCart} />
            <StatCard
              title="Total Revenue"
              value={formatPrice(stats.totalRevenue)}
              icon={DollarSign}
            />
            <StatCard title="Today's Sales" value={stats.todaySales} icon={CalendarDays} />
            <StatCard
              title="Today's Revenue"
              value={formatPrice(stats.todayRevenue)}
              icon={TrendingUp}
            />
          </div>
        </section>

        <section className={INVENTORY_CARD_SHELL}>
          <div className="flex flex-col gap-4 border-b border-border/50 bg-muted/15 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-5">
            <InventorySectionHeader
              compact
              icon={Layers}
              title="Transactions"
              description={`Paginated (${PAGE_SIZE} per page). Search matches invoice or customer.`}
            />
          </div>
          <div className="space-y-4 p-5 sm:p-6 md:p-7">
            <FilterBar
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by invoice or customer…"
            >
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={filterFieldClass}
                placeholder="From"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={filterFieldClass}
                placeholder="To"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={filterFieldClass}
              >
                <option value="">All Status</option>
                <option value="COMPLETED">Completed</option>
                <option value="PAY_LATER">Pay Later</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="RETURNED">Returned</option>
              </select>
            </FilterBar>
            <DataTable columns={columns} data={sales} loading={loading} inventoryStyle />
            <InventoryTablePagination
              page={meta.page}
              lastPage={meta.lastPage}
              total={meta.total}
              loading={loading}
              onPageChange={setPage}
            />
          </div>
        </section>
      </div>

    </div>
  );
}
