"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  User,
  Phone,
  Mail,
  MapPin,
  DollarSign,
  ShoppingCart,
  CreditCard,
  AlertCircle,
  Edit2,
  Plus,
  ExternalLink,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  division: string | null;
  district: string | null;
  totalAdvance: number;
  totalPurchase: number;
  totalPaid: number;
  totalDue: number;
}

interface Order {
  id: number;
  orderNumber: string;
  invoiceNumber: string;
  totalAmount: number;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  createdAt: string;
}

const divisions = [
  "Dhaka", "Chittagong", "Rajshahi", "Khulna",
  "Barisal", "Sylhet", "Rangpur", "Mymensingh",
];

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [txnModal, setTxnModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "", email: "", phone: "", address: "", division: "", district: "",
  });
  const [txnForm, setTxnForm] = useState({ amount: "", note: "" });

  const fetchCustomer = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any>(`/customers/${id}`);
      const data = res.data || res;
      setCustomer(data);
      setEditForm({
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        address: data.address || "",
        division: data.division || "",
        district: data.district || "",
      });
    } catch {
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const res = await apiFetch<any>(`/customers/${id}/orders?limit=100`);
      setOrders(res.data || (Array.isArray(res) ? res : []));
    } catch {
      setOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCustomer();
    fetchOrders();
  }, [fetchCustomer, fetchOrders]);

  const handleEdit = async () => {
    setSaving(true);
    try {
      await apiFetch(`/customers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(editForm),
      });
      setEditModal(false);
      fetchCustomer();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTransaction = async () => {
    if (!txnForm.amount) return;
    setSaving(true);
    try {
      await apiFetch(`/customers/${id}/transaction`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(txnForm.amount),
          note: txnForm.note,
        }),
      });
      setTxnModal(false);
      setTxnForm({ amount: "", note: "" });
      fetchCustomer();
      fetchOrders();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const orderColumns = [
    { key: "index", label: "#", className: "w-12", render: (_: Order, i: number) => i + 1 },
    {
      key: "orderNumber",
      label: "Order / Invoice",
      render: (item: Order) => (
        <div>
          <p className="font-medium">{item.orderNumber || item.invoiceNumber}</p>
          {item.invoiceNumber && item.orderNumber && (
            <p className="text-xs text-muted-foreground">{item.invoiceNumber}</p>
          )}
        </div>
      ),
    },
    {
      key: "createdAt",
      label: "Date",
      render: (item: Order) => formatDate(item.createdAt),
    },
    {
      key: "grandTotal",
      label: "Total",
      render: (item: Order) => (
        <span className="font-medium">{formatPrice(Number(item.grandTotal || item.totalAmount))}</span>
      ),
    },
    {
      key: "paidAmount",
      label: "Paid",
      render: (item: Order) => (
        <span className="text-green-600">{formatPrice(Number(item.paidAmount || 0))}</span>
      ),
    },
    {
      key: "dueAmount",
      label: "Due",
      render: (item: Order) => {
        const due = Number(item.dueAmount || 0);
        return due > 0 ? (
          <span className="text-red-600 font-medium">{formatPrice(due)}</span>
        ) : (
          <span className="text-green-600">{formatPrice(0)}</span>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (item: Order) => <StatusBadge status={item.status} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: Order) => (
        <Link href={`/orders?track=${item.id}`}>
          <Button variant="ghost" size="sm">
            <ExternalLink size={14} className="mr-1" /> Track
          </Button>
        </Link>
      ),
    },
  ];

  const selectClasses = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center py-20 text-muted-foreground">Loading customer...</div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center py-20 text-muted-foreground">Customer not found</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title={customer.name}
        description="Customer Details"
        action={
          <Button onClick={() => setTxnModal(true)}>
            <Plus size={16} className="mr-2" /> Add Quick Transaction
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        {/* Customer Info Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Customer Info</h3>
              <Button variant="ghost" size="sm" onClick={() => setEditModal(true)}>
                <Edit2 size={14} />
              </Button>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <User size={16} className="text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="text-sm font-medium">{customer.name}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone size={16} className="text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm font-medium">{customer.phone || "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail size={16} className="text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{customer.email || "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Address</p>
                  <p className="text-sm font-medium">{customer.address || "—"}</p>
                  {(customer.division || customer.district) && (
                    <p className="text-xs text-muted-foreground">
                      {[customer.district, customer.division].filter(Boolean).join(", ")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats + Orders */}
        <div className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Total Advance" value={formatPrice(Number(customer.totalAdvance || 0))} icon={CreditCard} />
            <StatCard title="Total Purchase" value={formatPrice(Number(customer.totalPurchase || 0))} icon={ShoppingCart} />
            <StatCard title="Total Paid" value={formatPrice(Number(customer.totalPaid || 0))} icon={DollarSign} />
            <StatCard
              title="Total Due"
              value={formatPrice(Number(customer.totalDue || 0))}
              icon={AlertCircle}
              className={Number(customer.totalDue) > 0 ? "border-red-200" : ""}
            />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-foreground mb-3">Order History</h3>
            <DataTable columns={orderColumns} data={orders} loading={ordersLoading} />
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal open={editModal} onOpenChange={setEditModal} title="Edit Customer">
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Name</label>
            <Input
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Phone</label>
            <Input
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Email</label>
            <Input
              type="email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Address</label>
            <Input
              value={editForm.address}
              onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Division</label>
              <select
                value={editForm.division}
                onChange={(e) => setEditForm({ ...editForm, division: e.target.value })}
                className={selectClasses}
              >
                <option value="">Select Division</option>
                {divisions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">District</label>
              <Input
                value={editForm.district}
                onChange={(e) => setEditForm({ ...editForm, district: e.target.value })}
              />
            </div>
          </div>
          <Button className="w-full mt-2" onClick={handleEdit} disabled={saving}>
            {saving ? "Saving..." : "Update Customer"}
          </Button>
        </div>
      </Modal>

      {/* Quick Transaction Modal */}
      <Modal open={txnModal} onOpenChange={setTxnModal} title="Add Quick Transaction">
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Amount *</label>
            <Input
              type="number"
              value={txnForm.amount}
              onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value })}
              placeholder="Enter amount"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Note</label>
            <Input
              value={txnForm.note}
              onChange={(e) => setTxnForm({ ...txnForm, note: e.target.value })}
              placeholder="Payment note (optional)"
            />
          </div>
          <Button className="w-full mt-2" onClick={handleTransaction} disabled={saving}>
            {saving ? "Processing..." : "Submit Transaction"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
