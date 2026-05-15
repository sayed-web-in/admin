"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ShoppingBag,
  Clock,
  Loader2,
  CheckCircle2,
  Truck,
  Eye,
  Check,
  X,
  DollarSign,
  Package,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";
import { toast } from "sonner";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface OrderItem {
  id: number;
  productName?: string;
  storeProduct?: { product?: { name?: string } };
  variantLabel?: string;
  quantity: number;
  unitPrice: number;
  total: number;
  cancelled?: boolean;
}

function orderItemLabel(item: OrderItem): string {
  const n = item.productName?.trim() || item.storeProduct?.product?.name?.trim();
  return n || "Product";
}

interface OrderTimeline {
  status: string;
  note?: string;
  createdAt: string;
}

interface Order {
  id: number;
  orderNumber: string;
  customer?: { id: number; name: string; phone: string; email?: string; address?: string };
  items?: OrderItem[];
  itemCount?: number;
  totalAmount: number;
  grandTotal: number;
  discount: number;
  shippingCost: number;
  paidAmount: number;
  dueAmount: number;
  paymentMethod: string;
  status: string;
  note?: string;
  timeline?: OrderTimeline[];
  createdAt: string;
  sale?: { id: number; invoiceNumber?: string } | null;
}

interface Branch {
  id: number;
  name: string;
}

type AccountOption = {
  id: number;
  name?: string;
  accountName?: string;
  type?: string;
  accountType?: string;
  isActive?: boolean;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const branchId = getSelectedBranch();

  const [viewModal, setViewModal] = useState(false);
  const [completeModal, setCompleteModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [processing, setProcessing] = useState(false);
  const [cancellingItemId, setCancellingItemId] = useState<number | null>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [completeForm, setCompleteForm] = useState({
    branchId: "",
    paymentMethod: "cash",
    paymentAccountId: "",
  });

  useEffect(() => {
    apiFetch<any>("/branches")
      .then((d) => setBranches(d.branches || d.data || (Array.isArray(d) ? d : [])))
      .catch(() => {});
    apiFetch<AccountOption[] | { data?: AccountOption[] }>("/finance/accounts")
      .then((res) => {
        const list = Array.isArray(res) ? res : res.data || [];
        const active = list.filter((a) => a?.id != null && (a.isActive ?? true));
        setAccounts(active);
        const cash =
          active.find(
            (a) =>
              String(a.accountType ?? a.type ?? "").toLowerCase() === "cash",
          ) ?? active[0];
        if (cash) {
          setCompleteForm((f) => ({
            ...f,
            paymentAccountId: String(cash.id),
          }));
        }
      })
      .catch(() => setAccounts([]));
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (branchId) params.set("branchId", String(branchId));
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await apiFetch<any>(`/orders?${params}`);
      setOrders(res.data || (Array.isArray(res) ? res : []));
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [branchId, search, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const stats = useMemo(() => {
    const pending = orders.filter((o) => o.status?.toLowerCase() === "pending").length;
    const proc = orders.filter((o) => o.status?.toLowerCase() === "processing").length;
    const delivered = orders.filter((o) => o.status?.toLowerCase() === "delivered").length;
    return { total: orders.length, pending, processing: proc, delivered };
  }, [orders]);

  const openView = async (order: Order) => {
    try {
      const full = await apiFetch<Order>(`/orders/${order.id}`);
      setSelectedOrder(full);
    } catch {
      setSelectedOrder(order);
    }
    setViewModal(true);
  };

  const openComplete = (order: Order) => {
    setSelectedOrder(order);
    const cash =
      accounts.find(
        (a) => String(a.accountType ?? a.type ?? "").toLowerCase() === "cash",
      ) ?? accounts[0];
    setCompleteForm({
      branchId: branchId ? String(branchId) : "",
      paymentMethod: "cash",
      paymentAccountId: cash ? String(cash.id) : "",
    });
    setCompleteModal(true);
  };

  const handleComplete = async () => {
    if (!selectedOrder) return;
    const branchNum = Number(completeForm.branchId);
    const accountNum = Number(completeForm.paymentAccountId);
    if (!Number.isFinite(branchNum) || branchNum < 1) {
      toast.error("Select a branch");
      return;
    }
    if (!Number.isFinite(accountNum) || accountNum < 1) {
      toast.error("Select a payment account — sale cannot complete without one");
      return;
    }
    if (accounts.length === 0) {
      toast.error("No active accounts found. Add a cash/bank account in Finance first.");
      return;
    }
    setProcessing(true);
    try {
      await apiFetch(`/orders/${selectedOrder.id}/complete`, {
        method: "POST",
        body: JSON.stringify({
          branchId: branchNum,
          paymentMethod: completeForm.paymentMethod,
          paymentAccountId: accountNum,
        }),
      });
      toast.success("Order completed and sale created");
      setCompleteModal(false);
      setSelectedOrder(null);
      fetchOrders();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Complete failed");
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async (order: Order) => {
    if (!confirm(`Cancel order "${order.orderNumber}"? This action cannot be undone.`)) return;
    try {
      await apiFetch(`/orders/${order.id}/cancel`, { method: "POST" });
      fetchOrders();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCancelLine = async (order: Order, item: OrderItem) => {
    if (item.cancelled) return;
    if (
      !confirm(
        `Cancel only "${orderItemLabel(item)}"? Other items stay on this order.`,
      )
    )
      return;
    setCancellingItemId(item.id);
    try {
      await apiFetch(`/orders/${order.id}/items/${item.id}/cancel`, { method: "POST" });
      const full = await apiFetch<Order>(`/orders/${order.id}`);
      setSelectedOrder(full);
      fetchOrders();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCancellingItemId(null);
    }
  };

  const handleStatusUpdate = async (orderId: number, newStatus: string) => {
    setProcessing(true);
    try {
      await apiFetch(`/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      if (selectedOrder && selectedOrder.id === orderId) {
        const full = await apiFetch<Order>(`/orders/${orderId}`);
        setSelectedOrder(full);
      }
      fetchOrders();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setProcessing(false);
    }
  };

  const columns = [
    { key: "index", label: "#", className: "w-12", render: (_: Order, i: number) => i + 1 },
    {
      key: "orderNumber",
      label: "Order No",
      render: (item: Order) => (
        <span className="font-medium text-foreground">{item.orderNumber}</span>
      ),
    },
    {
      key: "customer",
      label: "Customer",
      render: (item: Order) => (
        <div>
          <p className="font-medium text-sm">{item.customer?.name || "—"}</p>
        </div>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      render: (item: Order) => item.customer?.phone || "—",
    },
    {
      key: "items",
      label: "Items",
      className: "text-center",
      render: (item: Order) => item.items?.length || item.itemCount || "—",
    },
    {
      key: "grandTotal",
      label: "Total",
      render: (item: Order) => (
        <span className="font-medium">{formatPrice(Number(item.grandTotal || item.totalAmount))}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (item: Order) => <StatusBadge status={item.status} />,
    },
    {
      key: "createdAt",
      label: "Date",
      render: (item: Order) => formatDate(item.createdAt),
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: Order) => {
        const status = item.status?.toLowerCase();
        return (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => openView(item)}>
              <Eye size={14} />
            </Button>
            {(status === "pending" || status === "processing" || status === "confirmed") && (
              <Button
                variant="ghost"
                size="sm"
                className="text-green-600 hover:text-green-700"
                onClick={() => openComplete(item)}
              >
                <Check size={14} />
              </Button>
            )}
            {status !== "cancelled" && status !== "delivered" && status !== "completed" && (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-600"
                onClick={() => handleCancel(item)}
              >
                <X size={14} />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const selectClasses = "h-10 px-3 text-sm border border-border rounded-lg bg-background";

  const statusFlow = ["pending", "confirmed", "processing", "shipped", "delivered"];
  const getNextStatuses = (current: string) => {
    const idx = statusFlow.indexOf(current.toLowerCase());
    if (idx === -1 || idx >= statusFlow.length - 1) return [];
    return statusFlow.slice(idx + 1);
  };

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Orders" description="Manage frontend orders" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Orders" value={stats.total} icon={ShoppingBag} />
        <StatCard title="Pending" value={stats.pending} icon={Clock} />
        <StatCard title="Processing" value={stats.processing} icon={Package} />
        <StatCard title="Delivered" value={stats.delivered} icon={Truck} />
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by order no or customer..."
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={selectClasses}
        >
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="PROCESSING">Processing</option>
          <option value="SHIPPED">Shipped</option>
          <option value="DELIVERED">Delivered</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </FilterBar>

      <DataTable columns={columns} data={orders} loading={loading} />

      {/* View Order Modal */}
      <Modal
        open={viewModal}
        onOpenChange={setViewModal}
        title="Order Details"
        className="max-w-2xl"
      >
        {selectedOrder && (
          <div className="space-y-4">
            {/* Order & Customer Info */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Order No</p>
                <p className="font-medium">{selectedOrder.orderNumber}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date</p>
                <p className="font-medium">{formatDate(selectedOrder.createdAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <StatusBadge status={selectedOrder.status} />
              </div>
              <div>
                <p className="text-muted-foreground">Customer</p>
                <p className="font-medium">{selectedOrder.customer?.name || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Phone</p>
                <p className="font-medium">{selectedOrder.customer?.phone || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="font-medium">{selectedOrder.customer?.email || "—"}</p>
              </div>
              {selectedOrder.customer?.address && (
                <div className="col-span-full">
                  <p className="text-muted-foreground">Address</p>
                  <p className="font-medium">{selectedOrder.customer.address}</p>
                </div>
              )}
            </div>

            {/* Items */}
            {selectedOrder.items && selectedOrder.items.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Items</h4>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Product</th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">Qty</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Price</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selectedOrder.items.map((item) => {
                        const st = selectedOrder.status?.toLowerCase();
                        const canLineCancel =
                          !item.cancelled &&
                          !selectedOrder.sale &&
                          st !== "cancelled" &&
                          st !== "delivered" &&
                          st !== "completed";
                        return (
                        <tr key={item.id} className={item.cancelled ? "opacity-60" : undefined}>
                          <td className="px-3 py-2">
                            <p className={item.cancelled ? "line-through text-muted-foreground" : undefined}>{orderItemLabel(item)}</p>
                            {item.variantLabel && (
                              <p className="text-xs text-muted-foreground">{item.variantLabel}</p>
                            )}
                            {item.cancelled && (
                              <p className="text-[10px] font-semibold uppercase text-red-600 mt-0.5">Cancelled</p>
                            )}
                            {canLineCancel && (
                              <button
                                type="button"
                                className="mt-1.5 text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                                disabled={cancellingItemId !== null}
                                onClick={() => handleCancelLine(selectedOrder, item)}
                              >
                                {cancellingItemId === item.id ? "…" : "Cancel this line"}
                              </button>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">{item.quantity}</td>
                          <td className="px-3 py-2 text-right">{formatPrice(Number(item.unitPrice))}</td>
                          <td className="px-3 py-2 text-right font-medium">
                            {formatPrice(Number(item.total || item.unitPrice * item.quantity))}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Totals */}
            <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatPrice(Number(selectedOrder.totalAmount))}</span>
              </div>
              {Number(selectedOrder.discount) > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount</span>
                  <span>-{formatPrice(Number(selectedOrder.discount))}</span>
                </div>
              )}
              {Number(selectedOrder.shippingCost) > 0 && (
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span>{formatPrice(Number(selectedOrder.shippingCost))}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t border-border pt-1 mt-1">
                <span>Grand Total</span>
                <span className="text-primary">{formatPrice(Number(selectedOrder.grandTotal))}</span>
              </div>
            </div>

            {/* Timeline */}
            {selectedOrder.timeline && selectedOrder.timeline.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Tracking Timeline</h4>
                <div className="space-y-3">
                  {selectedOrder.timeline.map((entry, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className="mt-1">
                        <div className={`w-3 h-3 rounded-full ${
                          idx === 0 ? "bg-primary" : "bg-gray-300"
                        }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <StatusBadge status={entry.status} />
                          <span className="text-xs text-muted-foreground">
                            {formatDate(entry.createdAt)}
                          </span>
                        </div>
                        {entry.note && (
                          <p className="text-xs text-muted-foreground mt-0.5">{entry.note}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Status Update Actions */}
            {selectedOrder.status?.toLowerCase() !== "cancelled" &&
              selectedOrder.status?.toLowerCase() !== "delivered" &&
              selectedOrder.status?.toLowerCase() !== "completed" && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                {getNextStatuses(selectedOrder.status).map((nextStatus) => (
                  <Button
                    key={nextStatus}
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusUpdate(selectedOrder.id, nextStatus.toUpperCase())}
                    disabled={processing}
                    className="capitalize"
                  >
                    Mark as {nextStatus}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-green-600 border-green-300 hover:bg-green-50"
                  onClick={() => {
                    setViewModal(false);
                    openComplete(selectedOrder);
                  }}
                >
                  <CheckCircle2 size={14} className="mr-1" /> Complete as Sale
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Complete Order Modal */}
      <Modal
        open={completeModal}
        onOpenChange={setCompleteModal}
        title="Complete Order as Sale"
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span>Order</span>
                <span className="font-medium">{selectedOrder.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span>Customer</span>
                <span className="font-medium">{selectedOrder.customer?.name || "—"}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span className="text-primary">{formatPrice(Number(selectedOrder.grandTotal || selectedOrder.totalAmount))}</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Branch *</label>
              <select
                value={completeForm.branchId}
                onChange={(e) => setCompleteForm({ ...completeForm, branchId: e.target.value })}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Select Branch</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Payment Method</label>
              <select
                value={completeForm.paymentMethod}
                onChange={(e) => setCompleteForm({ ...completeForm, paymentMethod: e.target.value })}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="mobile_banking">Mobile Banking</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Payment account *</label>
              {accounts.length === 0 ? (
                <p className="text-sm text-destructive">
                  No active accounts. Add one under Finance → Accounts before selling.
                </p>
              ) : (
                <select
                  value={completeForm.paymentAccountId}
                  onChange={(e) =>
                    setCompleteForm({ ...completeForm, paymentAccountId: e.target.value })
                  }
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">Select account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.accountName ?? a.name ?? `Account #${a.id}`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <Button
              className="w-full"
              onClick={handleComplete}
              disabled={
                processing ||
                !completeForm.branchId ||
                !completeForm.paymentAccountId ||
                accounts.length === 0
              }
            >
              {processing ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" /> Processing...
                </>
              ) : (
                <>
                  <CheckCircle2 size={16} className="mr-2" /> Confirm & Create Sale
                </>
              )}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
