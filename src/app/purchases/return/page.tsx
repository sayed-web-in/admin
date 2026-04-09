"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  RotateCcw,
  DollarSign,
  CalendarDays,
  Plus,
  Eye,
  Search,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ReturnItem {
  id: number;
  quantity: number;
  unitCost: number;
  storeProduct?: { product?: { name: string }; variant?: { label: string } };
}

interface PurchaseReturn {
  id: number;
  purchase?: {
    id: number;
    referenceNo: string;
    supplier?: { name: string };
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
    storeProduct?: { product?: { name: string }; variant?: { label: string } };
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
  const [returns, setReturns] = useState<PurchaseReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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
  const branchId = getSelectedBranch();

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (branchId) params.set("branchId", String(branchId));
      if (search) params.set("search", search);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await apiFetch<any>(`/purchases/returns?${params}`);
      setReturns(res.data || (Array.isArray(res) ? res : []));
    } catch {
      setReturns([]);
    } finally {
      setLoading(false);
    }
  }, [branchId, search, dateFrom, dateTo]);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns]);

  const stats = useMemo(() => {
    const totalAmount = returns.reduce((s, r) => s + Number(r.totalAmount || 0), 0);
    return { total: returns.length, totalAmount };
  }, [returns]);

  const searchPurchase = async () => {
    if (!refSearch.trim()) return;
    setSearchingRef(true);
    try {
      const res = await apiFetch<any>(`/purchases?search=${encodeURIComponent(refSearch)}&limit=1`);
      const list = res.data || (Array.isArray(res) ? res : []);
      if (list.length === 0) {
        alert("Purchase not found");
        setPurchaseForReturn(null);
        return;
      }
      const purchase = list[0];
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
    } catch (err: any) {
      alert(err.message);
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
            purchaseItemId: i.purchaseItemId,
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
      fetchReturns();
    } catch (err: any) {
      alert(err.message);
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
    { key: "index", label: "#", className: "w-12", render: (_: PurchaseReturn, i: number) => i + 1 },
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
        <Button variant="ghost" size="sm" onClick={() => openView(item)}>
          <Eye size={14} />
        </Button>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Purchase Returns"
        description="Manage purchase returns"
        action={
          <Button onClick={openAdd}>
            <Plus size={16} className="mr-2" /> Add Return
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <StatCard title="Total Returns" value={stats.total} icon={RotateCcw} />
        <StatCard title="Total Amount" value={formatPrice(stats.totalAmount)} icon={DollarSign} />
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search purchase returns..."
      >
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-40 h-10"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-40 h-10"
        />
      </FilterBar>

      <DataTable columns={columns} data={returns} loading={loading} />

      <Modal open={addModal} onOpenChange={setAddModal} title="Create Purchase Return" className="max-w-xl">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Search Purchase Reference</label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter reference number..."
                value={refSearch}
                onChange={(e) => setRefSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchPurchase()}
              />
              <Button onClick={searchPurchase} disabled={searchingRef}>
                <Search size={16} />
              </Button>
            </div>
          </div>

          {purchaseForReturn && (
            <>
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p><strong>Reference:</strong> {purchaseForReturn.referenceNo}</p>
                <p><strong>Supplier:</strong> {purchaseForReturn.supplier?.name || "—"}</p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Select items and quantity to return
                </label>
                <div className="border border-border rounded-lg divide-y divide-border">
                  {returnItems.map((item) => (
                    <div key={item.purchaseItemId} className="flex items-center justify-between px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Max: {item.maxQty} &middot; {formatPrice(item.unitCost)} each
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={item.quantity || ""}
                          onChange={(e) => updateReturnQty(item.purchaseItemId, Number(e.target.value))}
                          className="w-20 h-8 text-sm text-center"
                          min={0}
                          max={item.maxQty}
                          placeholder="0"
                        />
                        <span className="text-sm font-medium w-20 text-right">
                          {formatPrice(item.quantity * item.unitCost)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                {returnTotal > 0 && (
                  <div className="flex justify-between mt-2 font-semibold text-sm">
                    <span>Return Total</span>
                    <span className="text-primary">{formatPrice(returnTotal)}</span>
                  </div>
                )}
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px]"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="Why is this being returned?"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setAddModal(false)}>Cancel</Button>
                <Button
                  onClick={handleSubmitReturn}
                  disabled={saving || returnItems.every((i) => i.quantity === 0)}
                >
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
              <div>
                <p className="text-muted-foreground">Purchase Ref</p>
                <p className="font-medium">{selectedReturn.purchase?.referenceNo || selectedReturn.purchaseRef || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Supplier</p>
                <p className="font-medium">{selectedReturn.purchase?.supplier?.name || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date</p>
                <p className="font-medium">{formatDate(selectedReturn.createdAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total</p>
                <p className="font-medium text-primary">{formatPrice(Number(selectedReturn.totalAmount))}</p>
              </div>
            </div>

            <div>
              <p className="text-muted-foreground text-sm">Reason</p>
              <p className="text-sm mt-1">{selectedReturn.reason || "—"}</p>
            </div>

            {selectedReturn.items && selectedReturn.items.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Returned Items</h4>
                <div className="border border-border rounded-lg divide-y divide-border">
                  {selectedReturn.items.map((item) => (
                    <div key={item.id} className="flex justify-between px-3 py-2 text-sm">
                      <span>
                        {item.storeProduct?.product?.name || "Product"} x{item.quantity}
                      </span>
                      <span className="font-medium">
                        {formatPrice(item.unitCost * item.quantity)}
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
