"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Clock,
  DollarSign,
  CheckCircle,
  Eye,
  CreditCard,
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
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [completeModal, setCompleteModal] = useState(false);
  const [viewModal, setViewModal] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [saving, setSaving] = useState(false);
  const branchId = getSelectedBranch();

  const fetchSales = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status: "PAY_LATER", limit: "100" });
      if (branchId) params.set("branchId", String(branchId));
      if (search) params.set("search", search);
      const res = await apiFetch<any>(`/sales?${params}`);
      setSales(res.data || (Array.isArray(res) ? res : []));
    } catch {
      setSales([]);
    } finally {
      setLoading(false);
    }
  }, [branchId, search]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  const stats = useMemo(() => {
    const totalAmount = sales.reduce((s, sale) => s + Number(sale.dueAmount || 0), 0);
    const today = new Date().toDateString();
    const completedToday = sales.filter(
      (s) => s.status === "COMPLETED" && new Date(s.createdAt).toDateString() === today
    ).length;
    return { total: sales.length, totalAmount, completedToday };
  }, [sales]);

  const filtered = useMemo(
    () =>
      sales.filter(
        (s) =>
          s.invoiceNumber?.toLowerCase().includes(search.toLowerCase()) ||
          s.customer?.name?.toLowerCase().includes(search.toLowerCase())
      ),
    [sales, search]
  );

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
      await apiFetch(`/sales/${selectedSale.id}/pay`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(payAmount),
          paymentMethod: payMethod,
        }),
      });
      setCompleteModal(false);
      setSelectedSale(null);
      fetchSales();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: "index", label: "#", className: "w-12", render: (_: Sale, i: number) => i + 1 },
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
        <span className="text-red-600 font-medium">{formatPrice(Number(item.dueAmount))}</span>
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
        <div className="flex items-center gap-1">
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
    <div className="p-4 md:p-6">
      <PageHeader title="Pay Later Sales" description="Manage pending payment sales" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Total Pay Later" value={stats.total} icon={Clock} />
        <StatCard title="Total Due Amount" value={formatPrice(stats.totalAmount)} icon={DollarSign} />
        <StatCard title="Completed Today" value={stats.completedToday} icon={CheckCircle} />
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by invoice or customer..."
      />

      <DataTable columns={columns} data={filtered} loading={loading} />

      {/* Complete Payment Modal */}
      <Modal
        open={completeModal}
        onOpenChange={setCompleteModal}
        title="Complete Payment"
        className="max-w-md"
      >
        {selectedSale && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3 space-y-1">
              <p className="text-sm">
                <strong>Invoice:</strong> {selectedSale.invoiceNumber}
              </p>
              <p className="text-sm">
                <strong>Customer:</strong> {selectedSale.customer?.name || "Walking Customer"}
              </p>
              <p className="text-sm">
                <strong>Total:</strong> {formatPrice(Number(selectedSale.grandTotal))}
              </p>
              <p className="text-sm">
                <strong>Already Paid:</strong> {formatPrice(Number(selectedSale.paidAmount || 0))}
              </p>
              <p className="text-sm font-semibold text-red-600">
                Due: {formatPrice(Number(selectedSale.dueAmount))}
              </p>
            </div>

            {selectedSale.items && selectedSale.items.length > 0 && (
              <div className="border border-border rounded-lg divide-y divide-border max-h-40 overflow-y-auto">
                {selectedSale.items.map((item) => (
                  <div key={item.id} className="flex justify-between px-3 py-2 text-sm">
                    <span>{item.storeProduct?.product?.name || "Product"} x{item.quantity}</span>
                    <span>{formatPrice(item.unitPrice * item.quantity)}</span>
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-1.5 block">Payment Amount</label>
              <Input
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Enter amount"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Payment Method</label>
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                className="w-full h-10 px-3 text-sm border border-border rounded-lg bg-background"
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

      {/* View Sale Modal */}
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
                <p className="font-medium">{selectedSale.customer?.name || "Walking Customer"}</p>
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
                <h4 className="text-sm font-semibold mb-2">Items</h4>
                <div className="border border-border rounded-lg divide-y divide-border">
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
