"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShoppingBag,
  DollarSign,
  Clock,
  CalendarDays,
  Eye,
  Plus,
  RotateCcw,
  Undo2,
  LayoutGrid,
  Layers,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";
import { unwrapPaginated, extractBranches, extractApiList } from "@/lib/apiList";
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
import {
  TableRowActions,
  TableRowActionButton,
  tableActionIconClassName,
} from "@/components/common/TableRowActions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 20;
const filterFieldClass =
  "h-10 rounded-xl border border-input bg-background/80 px-3 text-sm shadow-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Purchase {
  id: number;
  referenceNo: string;
  supplier?: { id: number; name: string; phone?: string; email?: string };
  branch?: { id: number; name: string };
  items?: { id: number }[];
  _count?: { items: number };
  totalAmount: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: string;
  status: string;
  note?: string;
  createdAt: string;
}

interface Branch {
  id: number;
  name: string;
}
interface Supplier {
  id: number;
  name: string;
}

export default function PurchasesPage() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, lastPage: 1, total: 0 });
  const [stats, setStats] = useState({
    total: 0,
    totalAmount: 0,
    pending: 0,
    todayPurchases: 0,
  });
  const selectedBranchId = getSelectedBranch();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, branchFilter, supplierFilter, dateFrom, dateTo, selectedBranchId]);

  const buildCommonParams = useCallback(() => {
    const qs = new URLSearchParams();
    if (selectedBranchId) qs.set("branchId", String(selectedBranchId));
    if (branchFilter) qs.set("branchId", branchFilter);
    if (debouncedSearch) qs.set("search", debouncedSearch);
    if (statusFilter) qs.set("status", statusFilter);
    if (supplierFilter) qs.set("supplierId", supplierFilter);
    if (dateFrom) qs.set("dateFrom", dateFrom);
    if (dateTo) qs.set("dateTo", dateTo);
    return qs;
  }, [selectedBranchId, branchFilter, debouncedSearch, statusFilter, supplierFilter, dateFrom, dateTo]);

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildCommonParams();
      qs.set("page", String(page));
      qs.set("limit", String(PAGE_SIZE));
      const res = await apiFetch<unknown>(`/purchases?${qs.toString()}`);
      const p = unwrapPaginated<Purchase>(res);
      if (p) {
        setPurchases(p.data);
        setMeta({ page: p.page, lastPage: p.lastPage, total: p.total });
        if (p.page > p.lastPage) setPage(p.lastPage);
      } else {
        setPurchases([]);
        setMeta({ page: 1, lastPage: 1, total: 0 });
      }
    } catch {
      setPurchases([]);
      setMeta({ page: 1, lastPage: 1, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [buildCommonParams, page]);

  const loadSummary = useCallback(async () => {
    try {
      const qs = buildCommonParams();
      const res = await apiFetch<unknown>(`/purchases/summary?${qs.toString()}`);
      const body = res && typeof res === "object" ? (res as Record<string, unknown>) : {};
      setStats({
        total: Number(body.total) || 0,
        totalAmount: Number(body.totalAmount) || 0,
        pending: Number(body.pending) || 0,
        todayPurchases: Number(body.todayPurchases) || 0,
      });
    } catch {
      setStats({ total: 0, totalAmount: 0, pending: 0, todayPurchases: 0 });
    }
  }, [buildCommonParams]);

  useEffect(() => {
    void fetchPurchases();
  }, [fetchPurchases]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    apiFetch<unknown>("/branches")
      .then((d) => setBranches(extractBranches(d)))
      .catch(() => {});
    apiFetch<unknown>("/suppliers?limit=500&isActive=true")
      .then((d) => setSuppliers(extractApiList<Supplier>(d, ["suppliers"])))
      .catch(() => {});
  }, []);

  const refresh = () => {
    void Promise.all([fetchPurchases(), loadSummary()]);
  };

  const itemCountCell = (item: Purchase) => item._count?.items ?? item.items?.length ?? "—";

  const columns = [
    {
      key: "index",
      label: "#",
      className: "w-12",
      render: (_: Purchase, i: number) => (page - 1) * PAGE_SIZE + i + 1,
    },
    { key: "referenceNo", label: "Reference No" },
    {
      key: "supplier",
      label: "Supplier",
      render: (item: Purchase) => item.supplier?.name || "—",
    },
    {
      key: "branch",
      label: "Branch",
      render: (item: Purchase) => item.branch?.name || "—",
    },
    {
      key: "itemCount",
      label: "Items",
      className: "text-center",
      render: (item: Purchase) => itemCountCell(item),
    },
    {
      key: "grandTotal",
      label: "Total",
      render: (item: Purchase) => <span className="font-medium">{formatPrice(Number(item.grandTotal))}</span>,
    },
    {
      key: "paidAmount",
      label: "Paid",
      render: (item: Purchase) => formatPrice(Number(item.paidAmount || 0)),
    },
    {
      key: "dueAmount",
      label: "Due",
      render: (item: Purchase) => {
        const due = Number(item.dueAmount || 0);
        return due > 0 ? <span className="text-red-600">{formatPrice(due)}</span> : <span className="text-green-600">{formatPrice(0)}</span>;
      },
    },
    {
      key: "status",
      label: "Status",
      render: (item: Purchase) => <StatusBadge status={item.status} />,
    },
    {
      key: "createdAt",
      label: "Date",
      render: (item: Purchase) => formatDate(item.createdAt),
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: Purchase) => (
        <TableRowActions>
          {item.status !== "RETURNED" ? (
            <TableRowActionButton
              title="Create return (seller-style)"
              onClick={() => router.push(`/purchases/return/create?purchaseId=${item.id}`)}
            >
              <Undo2 className={tableActionIconClassName} />
            </TableRowActionButton>
          ) : null}
          <TableRowActionButton title="View" onClick={() => router.push(`/purchases/${item.id}`)}>
            <Eye className={tableActionIconClassName} />
          </TableRowActionButton>
        </TableRowActions>
      ),
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={ShoppingBag}
        title="Purchases"
        description="Track purchase orders, payments, and dues with server-side filters and pagination."
      >
        <Button type="button" variant="outline" size="sm" className="h-10 w-full gap-2 rounded-xl border-border/80 bg-background/80 backdrop-blur-sm sm:h-9 sm:w-auto" onClick={() => router.back()}>
          Back
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-10 w-full gap-2 rounded-xl border-border/80 bg-background/80 backdrop-blur-sm sm:h-9 sm:w-auto" onClick={refresh}>
          <RotateCcw className="h-4 w-4 shrink-0" /> Refresh
        </Button>
        <Button type="button" className="h-10 w-full gap-2 rounded-xl shadow-sm sm:h-9 sm:w-auto" asChild>
          <Link href="/purchases/add">
            <Plus className="h-4 w-4 shrink-0" /> Add Purchase
          </Link>
        </Button>
      </InventoryListPageHeader>

      <div className="space-y-5 sm:space-y-6">
        <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
          <InventorySectionHeader icon={LayoutGrid} title="Overview" description="Totals use current filters from GET /purchases/summary." />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Purchases" value={stats.total} icon={ShoppingBag} />
            <StatCard title="Total Amount" value={formatPrice(stats.totalAmount)} icon={DollarSign} />
            <StatCard title="Pending" value={stats.pending} icon={Clock} />
            <StatCard title="Today's Purchases" value={stats.todayPurchases} icon={CalendarDays} />
          </div>
        </section>

        <section className={INVENTORY_CARD_SHELL}>
          <div className="flex flex-col gap-4 border-b border-border/50 bg-muted/15 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-5">
            <InventorySectionHeader compact icon={Layers} title="Purchase list" description={`Paginated (${PAGE_SIZE} per page). Search matches reference and supplier name.`} />
          </div>
          <div className="space-y-4 p-5 sm:p-6 md:p-7">
            <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search by reference or supplier...">
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={filterFieldClass}>
                <option value="">All Status</option>
                <option value="RECEIVED">Received</option>
                <option value="PENDING">Pending</option>
                <option value="PARTIAL">Partial</option>
                <option value="RETURNED">Returned</option>
              </select>
              <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className={filterFieldClass}>
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className={filterFieldClass}>
                <option value="">All Suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={`${filterFieldClass} sm:w-40`} />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={`${filterFieldClass} sm:w-40`} />
            </FilterBar>

            <DataTable columns={columns} data={purchases} loading={loading} inventoryStyle />
            <InventoryTablePagination page={meta.page} lastPage={meta.lastPage} total={meta.total} loading={loading} onPageChange={setPage} />
          </div>
        </section>
      </div>

    </div>
  );
}
