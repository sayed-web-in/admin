"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  RotateCcw,
  DollarSign,
  CalendarDays,
  Plus,
  Eye,
  Search,
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
import {
  TableRowActions,
  TableRowActionButton,
  tableActionIconClassName,
} from "@/components/common/TableRowActions";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 20;
const filterFieldClass =
  "h-10 rounded-xl border border-input bg-background/80 px-3 text-sm shadow-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-40";

interface ReturnItem {
  id: number;
  quantity: number;
  unitCost: number;
  storeProduct?: {
    product?: { name: string };
    productVariant?: { attributes?: { attributeValue?: { value: string } | null }[] } | null;
  };
}

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
  items: ReturnItem[];
  totalAmount: number;
  createdAt: string;
}

interface PurchaseForReturn {
  id: number;
  referenceNo: string;
  supplier?: { name: string };
  items: {
    id: number;
    quantity: number;
    unitCost: number;
    storeProductId: number;
    storeProduct?: {
      product?: { name: string };
      productVariant?: { attributes?: { attributeValue?: { value: string } | null }[] } | null;
    };
  }[];
}

interface ReturnQty {
  purchaseItemId: number;
  storeProductId: number;
  quantity: number;
  maxQty: number;
  unitCost: number;
  name: string;
}

export default function PurchaseReturnPage() {
  const router = useRouter();
  const [returns, setReturns] = useState<PurchaseReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [addModal, setAddModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<PurchaseReturn | null>(null);
  const [refSearch, setRefSearch] = useState("");
  const [purchaseForReturn, setPurchaseForReturn] = useState<PurchaseForReturn | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnQty[]>([]);
  const [returnReason, setReturnReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchingRef, setSearchingRef] = useState(false);
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
  }, [debouncedSearch, dateFrom, dateTo, selectedBranchId]);

  const buildCommonParams = useCallback(() => {
    const qs = new URLSearchParams();
    if (selectedBranchId) qs.set("branchId", String(selectedBranchId));
    if (debouncedSearch) qs.set("search", debouncedSearch);
    if (dateFrom) qs.set("dateFrom", dateFrom);
    if (dateTo) qs.set("dateTo", dateTo);
    return qs;
  }, [selectedBranchId, debouncedSearch, dateFrom, dateTo]);

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

  const refresh = () => {
    void Promise.all([fetchReturns(), loadSummary()]);
  };

  const searchPurchase = async () => {
    if (!refSearch.trim()) return;
    setSearchingRef(true);
    try {
      const qs = new URLSearchParams({
        search: refSearch.trim(),
        page: "1",
        limit: "5",
      });
      if (selectedBranchId) qs.set("branchId", String(selectedBranchId));
      const res = await apiFetch<unknown>(`/purchases?${qs.toString()}`);
      const p = unwrapPaginated<{ id: number }>(res);
      const list = p?.data ?? [];
      if (list.length === 0) {
        alert("Purchase not found");
        setPurchaseForReturn(null);
        return;
      }
      const purchase = list[0] as PurchaseForReturn;
      let full: PurchaseForReturn;
      try {
        full = await apiFetch<PurchaseForReturn>(`/purchases/${purchase.id}`);
      } catch {
        full = purchase;
      }
      setPurchaseForReturn(full);
      setReturnItems(
        (full.items || []).map((item) => ({
          purchaseItemId: item.id,
          storeProductId: item.storeProductId,
          quantity: 0,
          maxQty: item.quantity,
          unitCost: item.unitCost,
          name: item.storeProduct?.product?.name || "Product",
        }))
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Search failed");
      setPurchaseForReturn(null);
    } finally {
      setSearchingRef(false);
    }
  };

  const updateReturnQty = (purchaseItemId: number, qty: number) => {
    setReturnItems((prev) =>
      prev.map((item) =>
        item.purchaseItemId === purchaseItemId
          ? { ...item, quantity: Math.min(Math.max(0, qty), item.maxQty) }
          : item
      )
    );
  };

  const handleSubmitReturn = async () => {
    const itemsToReturn = returnItems.filter((i) => i.quantity > 0);
    if (itemsToReturn.length === 0) {
      alert("Select at least one item to return");
      return;
    }
    if (!returnReason.trim()) {
      alert("Please provide a reason");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/purchases/return", {
        method: "POST",
        body: JSON.stringify({
          purchaseId: purchaseForReturn?.id,
          reason: returnReason,
          items: itemsToReturn.map((i) => ({
            storeProductId: i.storeProductId,
            quantity: i.quantity,
            unitCost: i.unitCost,
          })),
        }),
      });
      setAddModal(false);
      setPurchaseForReturn(null);
      setReturnItems([]);
      setReturnReason("");
      setRefSearch("");
      await Promise.all([fetchReturns(), loadSummary()]);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => {
    setPurchaseForReturn(null);
    setReturnItems([]);
    setReturnReason("");
    setRefSearch("");
    setAddModal(true);
  };

  const openView = (ret: PurchaseReturn) => {
    setSelectedReturn(ret);
    setViewModal(true);
  };

  const returnTotal = returnItems.reduce((s, i) => s + i.quantity * i.unitCost, 0);

  const columns = [
    {
      key: "index",
      label: "#",
      className: "w-12",
      render: (_: PurchaseReturn, i: number) => (page - 1) * PAGE_SIZE + i + 1,
    },
    {
      key: "purchaseRef",
      label: "Purchase Ref",
      render: (item: PurchaseReturn) => item.purchase?.referenceNo || item.purchaseRef || "—",
    },
    {
      key: "supplier",
      label: "Supplier",
      render: (item: PurchaseReturn) => item.purchase?.supplier?.name || "—",
    },
    {
      key: "reason",
      label: "Reason",
      render: (item: PurchaseReturn) => <span className="line-clamp-1">{item.reason || "—"}</span>,
    },
    {
      key: "items",
      label: "Items",
      className: "text-center",
      render: (item: PurchaseReturn) => item.items?.length || 0,
    },
    {
      key: "totalAmount",
      label: "Total",
      render: (item: PurchaseReturn) => formatPrice(Number(item.totalAmount)),
    },
    {
      key: "createdAt",
      label: "Date",
      render: (item: PurchaseReturn) => formatDate(item.createdAt),
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: PurchaseReturn) => (
        <TableRowActions>
          <TableRowActionButton title="View" onClick={() => openView(item)}>
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
        title="Purchase Returns"
        description="Log returned items against purchases with server-side filters and pagination."
      >
        <Button type="button" variant="outline" size="sm" className="h-10 w-full gap-2 rounded-xl border-border/80 bg-background/80 backdrop-blur-sm sm:h-9 sm:w-auto" onClick={() => router.back()}>
          Back
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-10 w-full gap-2 rounded-xl border-border/80 bg-background/80 backdrop-blur-sm sm:h-9 sm:w-auto" onClick={refresh}>
          <RotateCcw className="h-4 w-4 shrink-0" /> Refresh
        </Button>
        <Button type="button" className="h-10 w-full gap-2 rounded-xl shadow-sm sm:h-9 sm:w-auto" onClick={openAdd}>
          <Plus className="h-4 w-4 shrink-0" /> Add Return
        </Button>
      </InventoryListPageHeader>

      <div className="space-y-5 sm:space-y-6">
        <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
          <InventorySectionHeader icon={LayoutGrid} title="Overview" description="Totals from GET /purchases/returns/summary with current filters." />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard title="Total Returns" value={stats.total} icon={RotateCcw} />
            <StatCard title="Today's Returns" value={stats.todayReturns} icon={CalendarDays} />
            <StatCard title="Total Amount" value={formatPrice(stats.totalAmount)} icon={DollarSign} />
          </div>
        </section>

        <section className={INVENTORY_CARD_SHELL}>
          <div className="flex flex-col gap-4 border-b border-border/50 bg-muted/15 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-5">
            <InventorySectionHeader compact icon={Layers} title="Return log" description={`Paginated (${PAGE_SIZE} per page). Search matches purchase ref, supplier, or reason.`} />
          </div>
          <div className="space-y-4 p-5 sm:p-6 md:p-7">
            <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search returns...">
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={filterFieldClass} />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={filterFieldClass} />
            </FilterBar>

            <DataTable columns={columns} data={returns} loading={loading} inventoryStyle />
            <InventoryTablePagination page={meta.page} lastPage={meta.lastPage} total={meta.total} loading={loading} onPageChange={setPage} />
          </div>
        </section>
      </div>

      <Modal open={addModal} onOpenChange={setAddModal} title="Create Purchase Return" className="max-w-xl">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Search Purchase Reference</label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter reference number..."
                value={refSearch}
                onChange={(e) => setRefSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchPurchase()}
              />
              <Button type="button" onClick={searchPurchase} disabled={searchingRef}>
                <Search size={16} />
              </Button>
            </div>
          </div>

          {purchaseForReturn && (
            <>
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p><strong>Reference:</strong> {purchaseForReturn.referenceNo}</p>
                <p><strong>Supplier:</strong> {purchaseForReturn.supplier?.name || "—"}</p>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Select items and quantity to return</label>
                <div className="divide-y divide-border rounded-lg border border-border">
                  {returnItems.map((item) => (
                    <div key={item.purchaseItemId} className="flex items-center justify-between px-3 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">Max: {item.maxQty} · {formatPrice(item.unitCost)} each</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={item.quantity || ""}
                          onChange={(e) => updateReturnQty(item.purchaseItemId, Number(e.target.value))}
                          className="h-8 w-20 text-center text-sm"
                          min={0}
                          max={item.maxQty}
                          placeholder="0"
                        />
                        <span className="w-20 text-right text-sm font-medium">{formatPrice(item.quantity * item.unitCost)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {returnTotal > 0 && (
                  <div className="mt-2 flex justify-between text-sm font-semibold">
                    <span>Return Total</span>
                    <span className="text-primary">{formatPrice(returnTotal)}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium">Reason <span className="text-red-500">*</span></label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Why is this being returned?"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setAddModal(false)}>Cancel</Button>
                <Button onClick={handleSubmitReturn} disabled={saving || returnItems.every((i) => i.quantity === 0)}>
                  {saving ? "Submitting..." : "Submit Return"}
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal open={viewModal} onOpenChange={setViewModal} title="Return Details" className="max-w-md">
        {selectedReturn && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-muted-foreground">Purchase Ref</p><p className="font-medium">{selectedReturn.purchase?.referenceNo || selectedReturn.purchaseRef || "—"}</p></div>
              <div><p className="text-muted-foreground">Supplier</p><p className="font-medium">{selectedReturn.purchase?.supplier?.name || "—"}</p></div>
              <div><p className="text-muted-foreground">Date</p><p className="font-medium">{formatDate(selectedReturn.createdAt)}</p></div>
              <div><p className="text-muted-foreground">Total</p><p className="font-medium text-primary">{formatPrice(Number(selectedReturn.totalAmount))}</p></div>
            </div>

            <div><p className="text-sm text-muted-foreground">Reason</p><p className="mt-1 text-sm">{selectedReturn.reason || "—"}</p></div>

            {selectedReturn.items && selectedReturn.items.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold">Returned Items</h4>
                <div className="divide-y divide-border rounded-lg border border-border">
                  {selectedReturn.items.map((item) => (
                    <div key={item.id} className="flex justify-between px-3 py-2 text-sm">
                      <span>{item.storeProduct?.product?.name || "Product"} x{item.quantity}</span>
                      <span className="font-medium">{formatPrice(item.unitCost * item.quantity)}</span>
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
