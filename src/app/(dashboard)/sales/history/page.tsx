"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  ShoppingCart,
  DollarSign,
  TrendingUp,
  CalendarDays,
  Eye,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  customer?: { name: string; phone: string; email?: string };
  items?: SaleItem[];
  itemCount?: number;
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
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [viewModal, setViewModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const branchId = getSelectedBranch();

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (branchId) params.set("branchId", String(branchId));
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await apiFetch<any>(`/sales?${params}`);
      setSales(res.data || (Array.isArray(res) ? res : []));
    } catch {
      setSales([]);
    } finally {
      setLoading(false);
    }
  }, [branchId, search, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const stats = useMemo(() => {
    const totalRevenue = sales.reduce((s, sale) => s + Number(sale.grandTotal || 0), 0);
    const today = new Date().toDateString();
    const todaySales = sales.filter((s) => new Date(s.createdAt).toDateString() === today);
    const todayRevenue = todaySales.reduce((s, sale) => s + Number(sale.grandTotal || 0), 0);
    return {
      total: sales.length,
      totalRevenue,
      todaySales: todaySales.length,
      todayRevenue,
    };
  }, [sales]);

  const openView = async (sale: Sale) => {
    try {
      const full = await apiFetch<Sale>(`/sales/${sale.id}`);
      setSelectedSale(full);
    } catch {
      setSelectedSale(sale);
    }
    setViewModal(true);
  };

  const columns = [
    { key: "index", label: "#", className: "w-12", render: (_: Sale, i: number) => i + 1 },
    { key: "invoiceNumber", label: "Invoice No" },
    {
      key: "customer",
      label: "Customer",
      render: (item: Sale) => item.customer?.name || "Walking Customer",
    },
    {
      key: "itemCount",
      label: "Items",
      className: "text-center",
      render: (item: Sale) => item.items?.length || item.itemCount || "—",
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
        <Button variant="ghost" size="sm" onClick={() => openView(item)}>
          <Eye size={14} />
        </Button>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Sales History" description="View all sales transactions" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Sales" value={stats.total} icon={ShoppingCart} />
        <StatCard title="Total Revenue" value={formatPrice(stats.totalRevenue)} icon={DollarSign} />
        <StatCard title="Today's Sales" value={stats.todaySales} icon={CalendarDays} />
        <StatCard title="Today's Revenue" value={formatPrice(stats.todayRevenue)} icon={TrendingUp} />
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by invoice or customer..."
      >
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-40 h-10"
          placeholder="From"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-40 h-10"
          placeholder="To"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-3 text-sm border border-border rounded-lg bg-background"
        >
          <option value="">All Status</option>
          <option value="COMPLETED">Completed</option>
          <option value="PAY_LATER">Pay Later</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="RETURNED">Returned</option>
        </select>
      </FilterBar>

      <DataTable columns={columns} data={sales} loading={loading} />

      {/* View Sale Detail Modal */}
      <Modal
        open={viewModal}
        onOpenChange={setViewModal}
        title="Sale Details"
        className="max-w-2xl"
      >
        {selectedSale && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Invoice</p>
                <p className="font-medium">{selectedSale.invoiceNumber}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Customer</p>
                <p className="font-medium">{selectedSale.customer?.name || "Walking Customer"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Phone</p>
                <p className="font-medium">{selectedSale.customer?.phone || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date</p>
                <p className="font-medium">{formatDate(selectedSale.createdAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Method</p>
                <p className="font-medium capitalize">
                  {selectedSale.paymentMethod?.replace("_", " ")}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Status</p>
                <StatusBadge status={selectedSale.status} />
              </div>
            </div>

            {selectedSale.items && selectedSale.items.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Items</h4>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">
                          Product
                        </th>
                        <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">
                          Qty
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                          Price
                        </th>
                        <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {selectedSale.items.map((item) => (
                        <tr key={item.id}>
                          <td className="px-3 py-2">
                            <p>{item.storeProduct?.product?.name || "Product"}</p>
                            {item.serialNumbers && item.serialNumbers.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                SN: {item.serialNumbers.join(", ")}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">{item.quantity}</td>
                          <td className="px-3 py-2 text-right">
                            {formatPrice(item.unitPrice)}
                          </td>
                          <td className="px-3 py-2 text-right font-medium">
                            {formatPrice(item.unitPrice * item.quantity)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatPrice(Number(selectedSale.totalAmount))}</span>
              </div>
              {Number(selectedSale.discount) > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount</span>
                  <span>-{formatPrice(Number(selectedSale.discount))}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t border-border pt-1 mt-1">
                <span>Grand Total</span>
                <span className="text-primary">
                  {formatPrice(Number(selectedSale.grandTotal))}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Paid</span>
                <span className="text-green-600">
                  {formatPrice(Number(selectedSale.paidAmount || 0))}
                </span>
              </div>
              {Number(selectedSale.changeAmount) > 0 && (
                <div className="flex justify-between">
                  <span>Change</span>
                  <span>{formatPrice(Number(selectedSale.changeAmount))}</span>
                </div>
              )}
              {Number(selectedSale.dueAmount) > 0 && (
                <div className="flex justify-between text-red-600 font-medium">
                  <span>Due</span>
                  <span>{formatPrice(Number(selectedSale.dueAmount))}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
