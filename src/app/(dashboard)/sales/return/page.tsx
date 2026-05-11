"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RotateCcw,
  CalendarDays,
  DollarSign,
  Plus,
  Eye,
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
import { InventoryTablePagination } from "@/components/inventory/InventoryTablePagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 20;

const filterFieldClass =
  "h-10 rounded-xl border border-input bg-background/80 px-3 text-sm shadow-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-40";

interface ReturnItem {
  id: number;
  quantity: number;
  unitPrice: number;
  storeProduct?: { product?: { name: string } };
}

interface SaleReturn {
  id: number;
  status?: string;
  sale?: {
    id: number;
    invoiceNumber: string;
    customer?: { name: string };
  };
  saleInvoice?: string;
  reason: string;
  items: ReturnItem[];
  totalAmount: number;
  refundAmount?: number;
  returnGain?: number;
  pendingCashRefund?: number | string;
  cashRefundPaid?: number | string;
  createdAt: string;
}

export default function SalesReturnPage() {
  const router = useRouter();
  const [returns, setReturns] = useState<SaleReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, lastPage: 1, total: 0 });
  const [stats, setStats] = useState({
    total: 0,
    todayReturns: 0,
    totalAmount: 0,
    totalRefund: 0,
    totalGain: 0,
  });
  const branchId = getSelectedBranch();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, dateFrom, dateTo, branchId]);

  const summaryParams = useCallback(() => {
    const qs = new URLSearchParams();
    if (branchId) qs.set("branchId", String(branchId));
    if (debouncedSearch) qs.set("search", debouncedSearch);
    if (dateFrom) qs.set("dateFrom", dateFrom);
    if (dateTo) qs.set("dateTo", dateTo);
    return qs.toString();
  }, [branchId, debouncedSearch, dateFrom, dateTo]);

  const loadSummary = useCallback(async () => {
    try {
      const q = summaryParams();
      const res = await apiFetch<unknown>(
        `/sales/returns/summary${q ? `?${q}` : ""}`
      );
      const body = res && typeof res === "object" ? (res as Record<string, unknown>) : {};
      setStats({
        total: Number(body.total) || 0,
        todayReturns: Number(body.todayReturns) || 0,
        totalAmount: Number(body.totalReturnAmount) || 0,
        totalRefund: Number(body.totalRefundAmount) || 0,
        totalGain: Number(body.totalReturnGain) || 0,
      });
    } catch {
      setStats({ total: 0, todayReturns: 0, totalAmount: 0, totalRefund: 0, totalGain: 0 });
    }
  }, [summaryParams]);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (branchId) qs.set("branchId", String(branchId));
      if (debouncedSearch) qs.set("search", debouncedSearch);
      if (dateFrom) qs.set("dateFrom", dateFrom);
      if (dateTo) qs.set("dateTo", dateTo);
      const res = await apiFetch<unknown>(`/sales/returns?${qs}`);
      const p = unwrapPaginated<SaleReturn>(res);
      if (p) {
        setReturns(p.data);
        setMeta({ page: p.page, lastPage: p.lastPage, total: p.total });
        if (p.page > p.lastPage) setPage(p.lastPage);
      } else {
        setReturns([]);
        setMeta({ page: 1, lastPage: 1, total: 0 });
      }
    } catch {
      setReturns([]);
      setMeta({ page: 1, lastPage: 1, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [branchId, debouncedSearch, dateFrom, dateTo, page]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    void fetchReturns();
  }, [fetchReturns]);

  const refresh = () => {
    void Promise.all([fetchReturns(), loadSummary()]);
  };

  const columns = [
    {
      key: "index",
      label: "#",
      className: "w-12",
      render: (_: SaleReturn, i: number) => (page - 1) * PAGE_SIZE + i + 1,
    },
    {
      key: "saleInvoice",
      label: "Sale Invoice",
      render: (item: SaleReturn) =>
        item.sale?.invoiceNumber || item.saleInvoice || "—",
    },
    {
      key: "status",
      label: "Status",
      render: (item: SaleReturn) => {
        const s = (item.status ?? "completed").toLowerCase();
        const cls =
          s === "pending"
            ? "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200"
            : "border-border bg-muted/40 text-muted-foreground";
        return (
          <span className={`rounded-md border px-2 py-0.5 text-xs font-medium capitalize ${cls}`}>
            {s.replace(/_/g, " ")}
          </span>
        );
      },
    },
    {
      key: "reason",
      label: "Reason",
      render: (item: SaleReturn) => (
        <span className="line-clamp-1">{item.reason || "—"}</span>
      ),
    },
    {
      key: "items",
      label: "Items",
      className: "text-center",
      render: (item: SaleReturn) => item.items?.length || 0,
    },
    {
      key: "totalAmount",
      label: "Gross",
      render: (item: SaleReturn) => formatPrice(Number(item.totalAmount)),
    },
    {
      key: "refund",
      label: "Refund",
      render: (item: SaleReturn) =>
        formatPrice(Number(item.refundAmount ?? item.totalAmount)),
    },
    {
      key: "gain",
      label: "Gain",
      render: (item: SaleReturn) => formatPrice(Number(item.returnGain ?? 0)),
    },
    {
      key: "createdAt",
      label: "Date",
      render: (item: SaleReturn) => formatDate(item.createdAt),
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: SaleReturn) => (
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/sales/return/${item.id}`}>
            <Eye size={14} />
          </Link>
        </Button>
      ),
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={RotateCcw}
        title="Sales Returns"
        description="Create from invoice; cash refund is recorded from the return detail page (seller-admin style modal)."
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
        <Button type="button" className="h-10 w-full gap-2 rounded-xl shadow-sm sm:h-9 sm:w-auto" asChild>
          <Link href="/sales/return/create">
            <Plus className="h-4 w-4 shrink-0" />
            Add return
          </Link>
        </Button>
      </InventoryListPageHeader>

      <div className="space-y-5 sm:space-y-6">
        <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
          <InventorySectionHeader
            icon={LayoutGrid}
            title="Overview"
            description="Counts, gross return value, refunds, and return gain (damage retention)."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard title="Total Returns" value={stats.total} icon={RotateCcw} />
            <StatCard title="Today's Returns" value={stats.todayReturns} icon={CalendarDays} />
            <StatCard title="Gross returned" value={formatPrice(stats.totalAmount)} icon={DollarSign} />
            <StatCard title="Refunded" value={formatPrice(stats.totalRefund)} icon={DollarSign} />
            <StatCard title="Return gain" value={formatPrice(stats.totalGain)} icon={DollarSign} />
          </div>
        </section>

        <section className={INVENTORY_CARD_SHELL}>
          <div className="flex flex-col gap-4 border-b border-border/50 bg-muted/15 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-5">
            <InventorySectionHeader
              compact
              icon={Layers}
              title="Return log"
              description={`Paginated (${PAGE_SIZE} per page). Open a row for accounting detail.`}
            />
          </div>
          <div className="space-y-4 p-5 sm:p-6 md:p-7">
            <FilterBar
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search returns…"
            >
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className={filterFieldClass}
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className={filterFieldClass}
              />
            </FilterBar>
            <DataTable columns={columns} data={returns} loading={loading} inventoryStyle />
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
