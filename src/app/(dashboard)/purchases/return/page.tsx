"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  RotateCcw,
  DollarSign,
  CalendarDays,
  Plus,
  Eye,
  LayoutGrid,
  Layers,
  Download,
  Printer,
  ArrowLeftRight,
  User,
  Package,
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
  "h-10 rounded-xl border border-input bg-background/80 px-3 text-sm shadow-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-40";

interface PurchaseReturn {
  id: number;
  purchase?: {
    id: number;
    referenceNo: string;
    supplier?: { name: string };
    branch?: { name: string };
  };
  purchaseRef?: string;
  reason: string;
  items: { id: number; quantity: number }[];
  totalAmount: number;
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

function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function getTodayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function totalQty(ret: PurchaseReturn): number {
  return (ret.items ?? []).reduce((s, it) => s + (Number(it.quantity) || 0), 0);
}

export default function PurchaseReturnPage() {
  const router = useRouter();
  const [returns, setReturns] = useState<PurchaseReturn[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [branchFilter, setBranchFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, lastPage: 1, total: 0 });
  const [stats, setStats] = useState({ total: 0, totalAmount: 0, todayReturns: 0 });
  const selectedBranchId = getSelectedBranch();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, dateFrom, dateTo, branchFilter, supplierFilter, selectedBranchId]);

  const buildCommonParams = useCallback(() => {
    const qs = new URLSearchParams();
    if (selectedBranchId) qs.set("branchId", String(selectedBranchId));
    if (branchFilter) qs.set("branchId", branchFilter);
    if (debouncedSearch) qs.set("search", debouncedSearch);
    if (supplierFilter) qs.set("supplierId", supplierFilter);
    if (dateFrom) qs.set("dateFrom", dateFrom);
    if (dateTo) qs.set("dateTo", dateTo);
    return qs;
  }, [selectedBranchId, branchFilter, debouncedSearch, supplierFilter, dateFrom, dateTo]);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildCommonParams();
      qs.set("page", String(page));
      qs.set("limit", String(PAGE_SIZE));
      const res = await apiFetch<unknown>(`/purchases/returns?${qs.toString()}`);
      const p = unwrapPaginated<PurchaseReturn>(res);
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
  }, [buildCommonParams, page]);

  const loadSummary = useCallback(async () => {
    try {
      const qs = buildCommonParams();
      const res = await apiFetch<unknown>(`/purchases/returns/summary?${qs.toString()}`);
      const body = res && typeof res === "object" ? (res as Record<string, unknown>) : {};
      setStats({
        total: Number(body.total) || 0,
        totalAmount: Number(body.totalAmount) || 0,
        todayReturns: Number(body.todayReturns) || 0,
      });
    } catch {
      setStats({ total: 0, totalAmount: 0, todayReturns: 0 });
    }
  }, [buildCommonParams]);

  useEffect(() => {
    void fetchReturns();
  }, [fetchReturns]);

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
    void Promise.all([fetchReturns(), loadSummary()]);
  };

  const handlePrint = () => {
    if (returns.length === 0) return;
    const rows = returns
      .map(
        (r, i) =>
          `<tr><td>${i + 1}</td><td>${escapeHtml(formatDate(r.createdAt))}</td><td>${escapeHtml(r.purchase?.branch?.name ?? "—")}</td><td>${r.items?.length ?? 0}</td><td>${totalQty(r)}</td><td>${escapeHtml(r.purchase?.supplier?.name ?? "—")}</td><td>${escapeHtml(r.purchase?.referenceNo ?? r.purchaseRef ?? "—")}</td><td>${escapeHtml(String(r.reason ?? "").slice(0, 80))}</td><td>${escapeHtml(formatPrice(Number(r.totalAmount)))}</td></tr>`
      )
      .join("");
    const html = `<!DOCTYPE html><html><head><title>Purchase returns</title><style>body{font-family:system-ui,sans-serif;padding:16px;}table{width:100%;border-collapse:collapse;font-size:12px;}th,td{border:1px solid #ccc;padding:6px 8px;}th{background:#4f46e5;color:#fff;}</style></head><body><h1>Purchase returns</h1><p style="font-size:11px;color:#666;">Generated: ${new Date().toLocaleString()}</p><table><thead><tr><th>#</th><th>Date</th><th>Branch</th><th>Lines</th><th>Qty</th><th>Supplier</th><th>Purchase</th><th>Reason</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      const trigger = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
        }, 800);
      };
      iframe.onload = () => setTimeout(trigger, 200);
    }
  };

  const handleExport = () => {
    if (returns.length === 0) return;
    const headers = ["#", "Date", "Branch", "Lines", "Qty", "Supplier", "Purchase", "Reason", "Total"];
    const rows = returns.map((r, i) => [
      i + 1 + (page - 1) * PAGE_SIZE,
      formatDate(r.createdAt),
      `"${(r.purchase?.branch?.name ?? "—").replace(/"/g, '""')}"`,
      r.items?.length ?? 0,
      totalQty(r),
      `"${(r.purchase?.supplier?.name ?? "—").replace(/"/g, '""')}"`,
      `"${(r.purchase?.referenceNo ?? r.purchaseRef ?? "—").replace(/"/g, '""')}"`,
      `"${String(r.reason ?? "").replace(/"/g, '""')}"`,
      formatPrice(Number(r.totalAmount)),
    ]);
    const csvContent = [headers.map((h) => `"${h}"`).join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `purchase-returns-${getTodayLocalDate()}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const columns = [
    {
      key: "index",
      label: "#",
      className: "w-12",
      render: (_: PurchaseReturn, i: number) => (page - 1) * PAGE_SIZE + i + 1,
    },
    {
      key: "dateBranch",
      label: "Date / branch",
      render: (item: PurchaseReturn) => (
        <div>
          <span className="font-medium">{formatDate(item.createdAt)}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{item.purchase?.branch?.name ?? "—"}</span>
        </div>
      ),
    },
    {
      key: "purchaseRef",
      label: "Purchase",
      render: (item: PurchaseReturn) => (
        <div>
          <span className="font-medium">{item.purchase?.referenceNo || item.purchaseRef || "—"}</span>
        </div>
      ),
    },
    {
      key: "supplier",
      label: "Supplier",
      render: (item: PurchaseReturn) => item.purchase?.supplier?.name || "—",
    },
    {
      key: "linesQty",
      label: "Lines / qty",
      className: "text-center",
      render: (item: PurchaseReturn) => `${item.items?.length ?? 0} / ${totalQty(item)}`,
    },
    {
      key: "reason",
      label: "Reason",
      render: (item: PurchaseReturn) => <span className="line-clamp-2 max-w-[14rem] text-muted-foreground">{item.reason || "—"}</span>,
    },
    {
      key: "totalAmount",
      label: "Total",
      render: (item: PurchaseReturn) => <span className="font-medium">{formatPrice(Number(item.totalAmount))}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: PurchaseReturn) => (
        <TableRowActions>
          {item.purchase?.id ? (
            <TableRowActionButton title="View purchase" onClick={() => router.push(`/purchases/${item.purchase!.id}`)}>
              <ArrowLeftRight className={tableActionIconClassName} />
            </TableRowActionButton>
          ) : null}
          <TableRowActionButton title="View return" onClick={() => router.push(`/purchases/return/${item.id}`)}>
            <Eye className={tableActionIconClassName} />
          </TableRowActionButton>
        </TableRowActions>
      ),
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={RotateCcw}
        title="Purchase returns"
        description="Same flow as seller-admin: list with filters, print/export, create on a dedicated page, open a return for accounting details."
      >
        <Button type="button" variant="outline" size="sm" className="h-10 w-full gap-2 rounded-xl sm:h-9 sm:w-auto" onClick={() => router.back()}>
          Back
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-10 w-full gap-2 rounded-xl sm:h-9 sm:w-auto" onClick={refresh}>
          <RotateCcw className="h-4 w-4 shrink-0" /> Refresh
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-10 w-full gap-2 rounded-xl sm:h-9 sm:w-auto" disabled={returns.length === 0} onClick={handlePrint}>
          <Printer className="h-4 w-4 shrink-0" /> Print
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-10 w-full gap-2 rounded-xl sm:h-9 sm:w-auto" disabled={returns.length === 0} onClick={handleExport}>
          <Download className="h-4 w-4 shrink-0" /> Export CSV
        </Button>
        <Button type="button" className="h-10 w-full gap-2 rounded-xl shadow-sm sm:h-9 sm:w-auto" asChild>
          <Link href="/purchases/return/create">
            <Plus className="h-4 w-4 shrink-0" /> Create return
          </Link>
        </Button>
      </InventoryListPageHeader>

      <div className="space-y-5 sm:space-y-6">
        <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
          <InventorySectionHeader icon={LayoutGrid} title="Overview" description="Totals respect branch / supplier / date filters (GET /purchases/returns/summary)." />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard title="Total returns" value={stats.total} icon={RotateCcw} />
            <StatCard title="Today's returns" value={stats.todayReturns} icon={CalendarDays} />
            <StatCard title="Total amount" value={formatPrice(stats.totalAmount)} icon={DollarSign} />
          </div>
        </section>

        <section className={INVENTORY_CARD_SHELL}>
          <div className="flex flex-col gap-4 border-b border-border/50 bg-muted/15 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-5">
            <InventorySectionHeader compact icon={Layers} title="Return log" description={`Paginated (${PAGE_SIZE} per page).`} />
          </div>
          <div className="space-y-4 p-5 sm:p-6 md:p-7">
            <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search purchase ref, supplier, reason…">
              <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className={filterFieldClass}>
                <option value="">All branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
              <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className={filterFieldClass}>
                <option value="">All suppliers</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={filterFieldClass} />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={filterFieldClass} />
            </FilterBar>

            <div className="block lg:hidden space-y-3">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : returns.length === 0 ? (
                <div className="rounded-xl border border-border/60 bg-muted/10 p-8 text-center text-sm text-muted-foreground">
                  <Package className="mx-auto mb-2 size-10 opacity-40" />
                  No purchase returns found.
                </div>
              ) : (
                returns.map((ret) => (
                  <div
                    key={ret.id}
                    className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <User className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{ret.purchase?.referenceNo || ret.purchaseRef || "—"}</p>
                        <p className="text-xs text-muted-foreground">{ret.purchase?.supplier?.name ?? "—"}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {ret.purchase?.branch?.name ?? "—"} · {formatDate(ret.createdAt)}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-primary">{formatPrice(Number(ret.totalAmount))}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-border/50 pt-3">
                      {ret.purchase?.id ? (
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/purchases/${ret.purchase.id}`}>Purchase</Link>
                        </Button>
                      ) : null}
                      <Button size="sm" asChild>
                        <Link href={`/purchases/return/${ret.id}`}>View return</Link>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="hidden lg:block">
              <DataTable columns={columns} data={returns} loading={loading} inventoryStyle />
            </div>
            <InventoryTablePagination page={meta.page} lastPage={meta.lastPage} total={meta.total} loading={loading} onPageChange={setPage} />
          </div>
        </section>
      </div>
    </div>
  );
}
