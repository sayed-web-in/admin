"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Clock,
  DollarSign,
  BarChart3,
  Eye,
  CreditCard,
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
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 20;

interface Sale {
  id: number;
  invoiceNumber: string;
  customer?: { name: string; phone: string };
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: string;
  status: string;
  createdAt: string;
  items?: {
    id: number;
    quantity: number;
    unitPrice: number;
    storeProduct?: { product?: { name: string } };
  }[];
}

export default function PayLaterPage() {
  const router = useRouter();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, lastPage: 1, total: 0 });
  const [stats, setStats] = useState({ total: 0, totalDueAmount: 0 });
  const [completeModal, setCompleteModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [saving, setSaving] = useState(false);
  const branchId = getSelectedBranch();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, branchId]);

  const loadStats = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (branchId) qs.set("branchId", String(branchId));
      if (debouncedSearch) qs.set("search", debouncedSearch);
      const res = await apiFetch<unknown>(`/sales/pay-later/stats?${qs}`);
      const body = res && typeof res === "object" ? (res as Record<string, unknown>) : {};
      setStats({
        total: Number(body.total) || 0,
        totalDueAmount: Number(body.totalDueAmount) || 0,
      });
    } catch {
      setStats({ total: 0, totalDueAmount: 0 });
    }
  }, [branchId, debouncedSearch]);

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (branchId) qs.set("branchId", String(branchId));
      if (debouncedSearch) qs.set("search", debouncedSearch);
      const res = await apiFetch<unknown>(`/sales/pay-later?${qs}`);
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
  }, [branchId, debouncedSearch, page]);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    void fetchSales();
  }, [fetchSales]);

  const avgDue =
    stats.total > 0 ? stats.totalDueAmount / stats.total : 0;

  const refresh = () => {
    void Promise.all([fetchSales(), loadStats()]);
  };

  const openComplete = async (sale: Sale) => {
    if (!sale.items) {
      try {
        const full = await apiFetch<Sale>(`/sales/${sale.id}`);
        setSelectedSale(full);
      } catch {
        setSelectedSale(sale);
      }
    } else {
      setSelectedSale(sale);
    }
    setPayAmount(String(sale.dueAmount || sale.grandTotal));
    setPayMethod("cash");
    setCompleteModal(true);
  };

  const openView = async (sale: Sale) => {
    if (!sale.items) {
      try {
        const full = await apiFetch<Sale>(`/sales/${sale.id}`);
        setSelectedSale(full);
      } catch {
        setSelectedSale(sale);
      }
    } else {
      setSelectedSale(sale);
    }
    setViewModal(true);
  };

  const handlePayment = async () => {
    if (!selectedSale) return;
    setSaving(true);
    try {
      await apiFetch(`/sales/${selectedSale.id}/complete`, {
        method: "POST",
        body: JSON.stringify({
          paidAmount: Number(payAmount),
          paymentMethod: payMethod,
        }),
      });
      setCompleteModal(false);
      setSelectedSale(null);
      await Promise.all([fetchSales(), loadStats()]);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: "index",
      label: "#",
      className: "w-12",
      render: (_: Sale, i: number) => (page - 1) * PAGE_SIZE + i + 1,
    },
    { key: "invoiceNumber", label: "Invoice" },
    {
      key: "customer",
      label: "Customer",
      render: (item: Sale) => item.customer?.name || "Walking Customer",
    },
    {
      key: "grandTotal",
      label: "Amount",
      render: (item: Sale) => formatPrice(Number(item.grandTotal)),
    },
    {
      key: "dueAmount",
      label: "Due",
      render: (item: Sale) => (
        <span className="font-medium text-red-600">
          {formatPrice(Number(item.dueAmount))}
        </span>
      ),
    },
    {
      key: "createdAt",
      label: "Date",
      render: (item: Sale) => formatDate(item.createdAt),
    },
    {
      key: "status",
      label: "Status",
      render: (item: Sale) => <StatusBadge status={item.status} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: Sale) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => openComplete(item)}>
            <CreditCard size={14} className="text-green-600" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => openView(item)}>
            <Eye size={14} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={Clock}
        title="Pay Later Sales"
        description="Open PAY_LATER invoices — collect dues or review details. Uses the selected branch when set."
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
            description="Counts and amounts respect branch and search filters (same as the list)."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard title="Open invoices" value={stats.total} icon={Clock} />
            <StatCard
              title="Total due"
              value={formatPrice(stats.totalDueAmount)}
              icon={DollarSign}
            />
            <StatCard title="Avg. due / invoice" value={formatPrice(avgDue)} icon={BarChart3} />
          </div>
        </section>

        <section className={INVENTORY_CARD_SHELL}>
          <div className="flex flex-col gap-4 border-b border-border/50 bg-muted/15 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-5">
            <InventorySectionHeader
              compact
              icon={Layers}
              title="Pay later list"
              description={`Paginated (${PAGE_SIZE} per page). Search matches invoice or customer.`}
            />
          </div>
          <div className="space-y-4 p-5 sm:p-6 md:p-7">
            <FilterBar
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by invoice or customer…"
            />
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

      <Modal
        open={completeModal}
        onOpenChange={setCompleteModal}
        title="Complete Payment"
        className="max-w-md"
      >
        {selectedSale && (
          <div className="space-y-4">
            <div className="space-y-1 rounded-lg bg-muted/50 p-3">
              <p className="text-sm">
                <strong>Invoice:</strong> {selectedSale.invoiceNumber}
              </p>
              <p className="text-sm">
                <strong>Customer:</strong>{" "}
                {selectedSale.customer?.name || "Walking Customer"}
              </p>
              <p className="text-sm">
                <strong>Total:</strong> {formatPrice(Number(selectedSale.grandTotal))}
              </p>
              <p className="text-sm">
                <strong>Already Paid:</strong>{" "}
                {formatPrice(Number(selectedSale.paidAmount || 0))}
              </p>
              <p className="text-sm font-semibold text-red-600">
                Due: {formatPrice(Number(selectedSale.dueAmount))}
              </p>
            </div>

            {selectedSale.items && selectedSale.items.length > 0 && (
              <div className="max-h-40 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {selectedSale.items.map((item) => (
                  <div key={item.id} className="flex justify-between px-3 py-2 text-sm">
                    <span>
                      {item.storeProduct?.product?.name || "Product"} x{item.quantity}
                    </span>
                    <span>{formatPrice(item.unitPrice * item.quantity)}</span>
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium">Payment Amount</label>
              <Input
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Payment Method</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="mobile_banking">Mobile Banking</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCompleteModal(false)}>
                Cancel
              </Button>
              <Button onClick={handlePayment} disabled={saving || !payAmount}>
                {saving ? "Processing..." : "Confirm Payment"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={viewModal}
        onOpenChange={setViewModal}
        title="Sale Details"
        className="max-w-md"
      >
        {selectedSale && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Invoice</p>
                <p className="font-medium">{selectedSale.invoiceNumber}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Customer</p>
                <p className="font-medium">
                  {selectedSale.customer?.name || "Walking Customer"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Total</p>
                <p className="font-medium">{formatPrice(Number(selectedSale.grandTotal))}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Paid</p>
                <p className="font-medium">{formatPrice(Number(selectedSale.paidAmount || 0))}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Due</p>
                <p className="font-medium text-red-600">
                  {formatPrice(Number(selectedSale.dueAmount))}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Date</p>
                <p className="font-medium">{formatDate(selectedSale.createdAt)}</p>
              </div>
            </div>

            {selectedSale.items && selectedSale.items.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Items</h4>
                <div className="divide-y divide-border rounded-lg border border-border">
                  {selectedSale.items.map((item) => (
                    <div key={item.id} className="flex justify-between px-3 py-2 text-sm">
                      <span>
                        {item.storeProduct?.product?.name || "Product"} x{item.quantity}
                      </span>
                      <span className="font-medium">
                        {formatPrice(item.unitPrice * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
