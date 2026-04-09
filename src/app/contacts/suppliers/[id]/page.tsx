"use client";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Building2,
  DollarSign,
  ShoppingCart,
  CreditCard,
  AlertCircle,
  Edit2,
  Plus,
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

interface Supplier {
  id: number;
  name: string;
  company: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  status: string;
  totalPurchases: number;
  totalPaid: number;
  totalDue: number;
}

interface Purchase {
  id: number;
  invoiceNumber: string;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  createdAt: string;
  items?: { product?: { name: string }; quantity: number; unitPrice: number }[];
}

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchasesLoading, setPurchasesLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "", email: "", phone: "", company: "", address: "", status: "active",
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: "", paymentMethod: "cash", note: "",
  });

  const fetchSupplier = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<any>(`/suppliers/${id}`);
      const data = res.data || res;
      setSupplier(data);
      setEditForm({
        name: data.name || "",
        email: data.email || "",
        phone: data.phone || "",
        company: data.company || "",
        address: data.address || "",
        status: data.status || "active",
      });
    } catch {
      setSupplier(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchPurchases = useCallback(async () => {
    setPurchasesLoading(true);
    try {
      const res = await apiFetch<any>(`/suppliers/${id}/purchases?limit=100`);
      setPurchases(res.data || (Array.isArray(res) ? res : []));
    } catch {
      setPurchases([]);
    } finally {
      setPurchasesLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSupplier();
    fetchPurchases();
  }, [fetchSupplier, fetchPurchases]);

  const handleEdit = async () => {
    setSaving(true);
    try {
      await apiFetch(`/suppliers/${id}`, {
        method: "PATCH",
        body: JSON.stringify(editForm),
      });
      setEditModal(false);
      fetchSupplier();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePayment = async () => {
    if (!paymentForm.amount) return;
    setSaving(true);
    try {
      await apiFetch(`/suppliers/${id}/payment`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(paymentForm.amount),
          paymentMethod: paymentForm.paymentMethod,
          note: paymentForm.note,
        }),
      });
      setPaymentModal(false);
      setPaymentForm({ amount: "", paymentMethod: "cash", note: "" });
      fetchSupplier();
      fetchPurchases();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const purchaseColumns = [
    { key: "index", label: "#", className: "w-12", render: (_: Purchase, i: number) => i + 1 },
    {
      key: "invoiceNumber",
      label: "Invoice",
      render: (item: Purchase) => (
        <span className="font-medium">{item.invoiceNumber || `#${item.id}`}</span>
      ),
    },
    {
      key: "createdAt",
      label: "Date",
      render: (item: Purchase) => formatDate(item.createdAt),
    },
    {
      key: "totalAmount",
      label: "Total",
      render: (item: Purchase) => (
        <span className="font-medium">{formatPrice(Number(item.totalAmount || 0))}</span>
      ),
    },
    {
      key: "paidAmount",
      label: "Paid",
      render: (item: Purchase) => (
        <span className="text-green-600">{formatPrice(Number(item.paidAmount || 0))}</span>
      ),
    },
    {
      key: "dueAmount",
      label: "Due",
      render: (item: Purchase) => {
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
      render: (item: Purchase) => <StatusBadge status={item.status || "completed"} />,
    },
  ];

  const selectClasses = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const toggleClasses = "relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer";

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center py-20 text-muted-foreground">Loading supplier...</div>
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="p-4 md:p-6">
        <div className="text-center py-20 text-muted-foreground">Supplier not found</div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title={supplier.name}
        description={supplier.company || "Supplier Details"}
        action={
          <Button onClick={() => setPaymentModal(true)}>
            <Plus size={16} className="mr-2" /> Quick Payment
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        {/* Supplier Info Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-border p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground">Supplier Info</h3>
              <Button variant="ghost" size="sm" onClick={() => setEditModal(true)}>
                <Edit2 size={14} />
              </Button>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <User size={16} className="text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="text-sm font-medium">{supplier.name}</p>
                </div>
              </div>
              {supplier.company && (
                <div className="flex items-start gap-3">
                  <Building2 size={16} className="text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Company</p>
                    <p className="text-sm font-medium">{supplier.company}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-3">
                <Phone size={16} className="text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Phone</p>
                  <p className="text-sm font-medium">{supplier.phone || "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail size={16} className="text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{supplier.email || "—"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin size={16} className="text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Address</p>
                  <p className="text-sm font-medium">{supplier.address || "—"}</p>
                </div>
              </div>
              <div className="pt-2 border-t border-border">
                <StatusBadge status={supplier.status || "active"} />
              </div>
            </div>
          </div>
        </div>

        {/* Stats + Purchase History */}
        <div className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard title="Total Purchases" value={formatPrice(Number(supplier.totalPurchases || 0))} icon={ShoppingCart} />
            <StatCard title="Total Paid" value={formatPrice(Number(supplier.totalPaid || 0))} icon={CreditCard} />
            <StatCard
              title="Total Due"
              value={formatPrice(Number(supplier.totalDue || 0))}
              icon={AlertCircle}
              className={Number(supplier.totalDue) > 0 ? "border-red-200" : ""}
            />
          </div>

          <div>
            <h3 className="text-lg font-semibold text-foreground mb-3">Purchase History</h3>
            <DataTable columns={purchaseColumns} data={purchases} loading={purchasesLoading} />
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal open={editModal} onOpenChange={setEditModal} title="Edit Supplier">
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Name</label>
            <Input
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Company</label>
            <Input
              value={editForm.company}
              onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
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
          <div>
            <label className="text-sm font-medium mb-1.5 block">Status</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEditForm({ ...editForm, status: editForm.status === "active" ? "inactive" : "active" })}
                className={`${toggleClasses} ${editForm.status === "active" ? "bg-primary" : "bg-gray-300"}`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    editForm.status === "active" ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className="text-sm capitalize">{editForm.status}</span>
            </div>
          </div>
          <Button className="w-full mt-2" onClick={handleEdit} disabled={saving}>
            {saving ? "Saving..." : "Update Supplier"}
          </Button>
        </div>
      </Modal>

      {/* Quick Payment Modal */}
      <Modal open={paymentModal} onOpenChange={setPaymentModal} title="Quick Payment">
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Amount *</label>
            <Input
              type="number"
              value={paymentForm.amount}
              onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
              placeholder="Enter payment amount"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Payment Method</label>
            <select
              value={paymentForm.paymentMethod}
              onChange={(e) => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
              className={selectClasses}
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="mobile_banking">Mobile Banking</option>
              <option value="check">Check</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Note</label>
            <Input
              value={paymentForm.note}
              onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })}
              placeholder="Payment note (optional)"
            />
          </div>
          <Button className="w-full mt-2" onClick={handlePayment} disabled={saving}>
            {saving ? "Processing..." : "Submit Payment"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
