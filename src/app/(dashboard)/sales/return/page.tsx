"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  RotateCcw,
  CalendarDays,
  DollarSign,
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
  unitPrice: number;
  storeProduct?: { product?: { name: string } };
}

interface SaleReturn {
  id: number;
  sale?: {
    id: number;
    invoiceNumber: string;
    customer?: { name: string };
  };
  saleInvoice?: string;
  reason: string;
  items: ReturnItem[];
  totalAmount: number;
  createdAt: string;
}

interface SaleForReturn {
  id: number;
  invoiceNumber: string;
  customer?: { name: string };
  items: {
    id: number;
    quantity: number;
    unitPrice: number;
    storeProductId: number;
    storeProduct?: { product?: { name: string } };
  }[];
}

interface ReturnQty {
  saleItemId: number;
  storeProductId: number;
  quantity: number;
  maxQty: number;
  unitPrice: number;
  name: string;
}

export default function SalesReturnPage() {
  const [returns, setReturns] = useState<SaleReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [addModal, setAddModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<SaleReturn | null>(null);

  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [saleForReturn, setSaleForReturn] = useState<SaleForReturn | null>(null);
  const [returnItems, setReturnItems] = useState<ReturnQty[]>([]);
  const [returnReason, setReturnReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchingInvoice, setSearchingInvoice] = useState(false);
  const branchId = getSelectedBranch();

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (branchId) params.set("branchId", String(branchId));
      if (search) params.set("search", search);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await apiFetch<any>(`/sales/returns?${params}`);
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
    const today = new Date().toDateString();
    const todayReturns = returns.filter(
      (r) => new Date(r.createdAt).toDateString() === today
    );
    const totalAmount = returns.reduce((s, r) => s + Number(r.totalAmount || 0), 0);
    return {
      total: returns.length,
      todayReturns: todayReturns.length,
      totalAmount,
    };
  }, [returns]);

  const searchInvoice = async () => {
    if (!invoiceSearch.trim()) return;
    setSearchingInvoice(true);
    try {
      const res = await apiFetch<any>(`/sales?search=${invoiceSearch}&limit=1`);
      const sales = res.data || (Array.isArray(res) ? res : []);
      if (sales.length === 0) {
        alert("Sale not found");
        setSaleForReturn(null);
        return;
      }
      const sale = sales[0];
      let full: SaleForReturn;
      try {
        full = await apiFetch<SaleForReturn>(`/sales/${sale.id}`);
      } catch {
        full = sale;
      }
      setSaleForReturn(full);
      setReturnItems(
        (full.items || []).map((item) => ({
          saleItemId: item.id,
          storeProductId: item.storeProductId,
          quantity: 0,
          maxQty: item.quantity,
          unitPrice: item.unitPrice,
          name: item.storeProduct?.product?.name || "Product",
        }))
      );
    } catch (err: any) {
      alert(err.message);
      setSaleForReturn(null);
    } finally {
      setSearchingInvoice(false);
    }
  };

  const updateReturnQty = (saleItemId: number, qty: number) => {
    setReturnItems((prev) =>
      prev.map((item) =>
        item.saleItemId === saleItemId
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
      await apiFetch("/sales/returns", {
        method: "POST",
        body: JSON.stringify({
          saleId: saleForReturn?.id,
          reason: returnReason,
          items: itemsToReturn.map((i) => ({
            saleItemId: i.saleItemId,
            storeProductId: i.storeProductId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        }),
      });
      setAddModal(false);
      setSaleForReturn(null);
      setReturnItems([]);
      setReturnReason("");
      setInvoiceSearch("");
      fetchReturns();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => {
    setSaleForReturn(null);
    setReturnItems([]);
    setReturnReason("");
    setInvoiceSearch("");
    setAddModal(true);
  };

  const openView = (ret: SaleReturn) => {
    setSelectedReturn(ret);
    setViewModal(true);
  };

  const returnTotal = returnItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  const columns = [
    {
      key: "index",
      label: "#",
      className: "w-12",
      render: (_: SaleReturn, i: number) => i + 1,
    },
    {
      key: "saleInvoice",
      label: "Sale Invoice",
      render: (item: SaleReturn) => item.sale?.invoiceNumber || item.saleInvoice || "—",
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
      label: "Total",
      render: (item: SaleReturn) => formatPrice(Number(item.totalAmount)),
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
        <Button variant="ghost" size="sm" onClick={() => openView(item)}>
          <Eye size={14} />
        </Button>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Sales Returns"
        description="Manage product returns"
        action={
          <Button onClick={openAdd}>
            <Plus size={16} className="mr-2" /> Add Return
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Total Returns" value={stats.total} icon={RotateCcw} />
        <StatCard title="Today's Returns" value={stats.todayReturns} icon={CalendarDays} />
        <StatCard
          title="Total Return Amount"
          value={formatPrice(stats.totalAmount)}
          icon={DollarSign}
        />
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search returns..."
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

      {/* Add Return Modal */}
      <Modal
        open={addModal}
        onOpenChange={setAddModal}
        title="Create Sales Return"
        className="max-w-xl"
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Search Sale Invoice</label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter invoice number..."
                value={invoiceSearch}
                onChange={(e) => setInvoiceSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchInvoice()}
              />
              <Button onClick={searchInvoice} disabled={searchingInvoice}>
                <Search size={16} />
              </Button>
            </div>
          </div>

          {saleForReturn && (
            <>
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p>
                  <strong>Invoice:</strong> {saleForReturn.invoiceNumber}
                </p>
                <p>
                  <strong>Customer:</strong>{" "}
                  {saleForReturn.customer?.name || "Walking Customer"}
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Select items and quantity to return
                </label>
                <div className="border border-border rounded-lg divide-y divide-border">
                  {returnItems.map((item) => (
                    <div
                      key={item.saleItemId}
                      className="flex items-center justify-between px-3 py-2"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Max: {item.maxQty} &middot; {formatPrice(item.unitPrice)} each
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={item.quantity || ""}
                          onChange={(e) =>
                            updateReturnQty(item.saleItemId, Number(e.target.value))
                          }
                          className="w-20 h-8 text-sm text-center"
                          min={0}
                          max={item.maxQty}
                          placeholder="0"
                        />
                        <span className="text-sm font-medium w-20 text-right">
                          {formatPrice(item.quantity * item.unitPrice)}
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
                <Button variant="outline" onClick={() => setAddModal(false)}>
                  Cancel
                </Button>
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

      {/* View Return Modal */}
      <Modal
        open={viewModal}
        onOpenChange={setViewModal}
        title="Return Details"
        className="max-w-md"
      >
        {selectedReturn && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Sale Invoice</p>
                <p className="font-medium">
                  {selectedReturn.sale?.invoiceNumber || selectedReturn.saleInvoice || "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Customer</p>
                <p className="font-medium">
                  {selectedReturn.sale?.customer?.name || "Walking Customer"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Date</p>
                <p className="font-medium">{formatDate(selectedReturn.createdAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total</p>
                <p className="font-medium text-primary">
                  {formatPrice(Number(selectedReturn.totalAmount))}
                </p>
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
