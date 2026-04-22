"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
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
  RotateCcw,
  LayoutGrid,
  Layers,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/utils";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
  InventorySectionHeader,
} from "@/components/inventory/InventoryCrudLayout";
import { StatCard } from "@/components/common/StatCard";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Purchase {
  id: number;
  referenceNo: string;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  createdAt: string;
}

interface Supplier {
  id: number;
  name: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  isActive: boolean;
  totalDue: number;
  purchases?: Purchase[];
}

const selectClasses =
  "h-10 w-full rounded-xl border border-input bg-background/80 px-3 text-sm shadow-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function SupplierDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [paymentModal, setPaymentModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    address: "",
    isActive: true,
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    note: "",
  });

  const fetchSupplier = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<unknown>(`/suppliers/${id}`);
      const data = (res && typeof res === "object" && "data" in (res as object)
        ? (res as { data: Supplier }).data
        : (res as Supplier)) || null;
      setSupplier(data);
      if (data) {
        setEditForm({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          company: data.company || "",
          address: data.address || "",
          isActive: data.isActive,
        });
      }
    } catch {
      setSupplier(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchSupplier();
  }, [fetchSupplier]);

  const refresh = () => {
    void fetchSupplier();
  };

  const purchaseStats = useMemo(() => {
    const list = supplier?.purchases ?? [];
    const totalPurchases = list.reduce((sum, p) => sum + Number(p.grandTotal || 0), 0);
    const totalPaid = list.reduce((sum, p) => sum + Number(p.paidAmount || 0), 0);
    return { totalPurchases, totalPaid };
  }, [supplier]);

  const handleEdit = async () => {
    if (!supplier) return;
    setSaving(true);
    try {
      await apiFetch(`/suppliers/${supplier.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name.trim(),
          email: editForm.email.trim() || undefined,
          phone: editForm.phone.trim() || undefined,
          company: editForm.company.trim() || undefined,
          address: editForm.address.trim() || undefined,
          isActive: editForm.isActive,
        }),
      });
      setEditModal(false);
      await fetchSupplier();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handlePayment = async () => {
    if (!supplier || !paymentForm.amount) return;
    setSaving(true);
    try {
      await apiFetch(`/suppliers/${supplier.id}/payment`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(paymentForm.amount),
          note: paymentForm.note,
        }),
      });
      setPaymentModal(false);
      setPaymentForm({ amount: "", note: "" });
      await fetchSupplier();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setSaving(false);
    }
  };

  const purchaseColumns = [
    { key: "index", label: "#", className: "w-12", render: (_: Purchase, i: number) => i + 1 },
    {
      key: "referenceNo",
      label: "Reference",
      render: (item: Purchase) => <span className="font-medium">{item.referenceNo || `#${item.id}`}</span>,
    },
    { key: "createdAt", label: "Date", render: (item: Purchase) => formatDate(item.createdAt) },
    { key: "grandTotal", label: "Total", render: (item: Purchase) => formatPrice(Number(item.grandTotal || 0)) },
    { key: "paidAmount", label: "Paid", render: (item: Purchase) => <span className="text-green-600">{formatPrice(Number(item.paidAmount || 0))}</span> },
    {
      key: "dueAmount",
      label: "Due",
      render: (item: Purchase) => {
        const due = Number(item.dueAmount || 0);
        return due > 0 ? <span className="font-medium text-red-600">{formatPrice(due)}</span> : <span className="text-green-600">{formatPrice(0)}</span>;
      },
    },
    { key: "status", label: "Status", render: (item: Purchase) => <StatusBadge status={item.status || "pending"} /> },
  ];

  if (loading) return <div className="p-6 text-sm text-muted-foreground">Loading supplier...</div>;
  if (!supplier) return <div className="p-6 text-sm text-muted-foreground">Supplier not found.</div>;

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={User}
        title={supplier.name}
        description={supplier.company || "Supplier details and purchase history."}
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
          <RotateCcw className="h-4 w-4 shrink-0" /> Refresh
        </Button>
        <Button
          type="button"
          className="h-10 w-full gap-2 rounded-xl shadow-sm sm:h-9 sm:w-auto"
          onClick={() => setPaymentModal(true)}
        >
          <Plus className="h-4 w-4 shrink-0" /> Quick Payment
        </Button>
      </InventoryListPageHeader>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-4 sm:gap-6">
        <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 lg:col-span-1`}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Supplier Info</h3>
            <Button variant="ghost" size="sm" onClick={() => setEditModal(true)}>
              <Edit2 size={14} />
            </Button>
          </div>
          <div className="space-y-3">
            <div className="flex gap-3"><User size={16} className="mt-0.5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Name</p><p className="text-sm font-medium">{supplier.name}</p></div></div>
            {supplier.company ? <div className="flex gap-3"><Building2 size={16} className="mt-0.5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Company</p><p className="text-sm font-medium">{supplier.company}</p></div></div> : null}
            <div className="flex gap-3"><Phone size={16} className="mt-0.5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Phone</p><p className="text-sm font-medium">{supplier.phone || "—"}</p></div></div>
            <div className="flex gap-3"><Mail size={16} className="mt-0.5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Email</p><p className="text-sm font-medium">{supplier.email || "—"}</p></div></div>
            <div className="flex gap-3"><MapPin size={16} className="mt-0.5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Address</p><p className="text-sm font-medium">{supplier.address || "—"}</p></div></div>
            <div className="pt-2"><StatusBadge status={supplier.isActive ? "active" : "inactive"} /></div>
          </div>
        </section>

        <section className="space-y-5 lg:col-span-3 sm:space-y-6">
          <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
            <InventorySectionHeader icon={LayoutGrid} title="Overview" description="Totals from this supplier’s purchase history." />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard title="Total Purchases" value={formatPrice(purchaseStats.totalPurchases)} icon={ShoppingCart} />
              <StatCard title="Total Paid" value={formatPrice(purchaseStats.totalPaid)} icon={CreditCard} />
              <StatCard title="Total Due" value={formatPrice(Number(supplier.totalDue || 0))} icon={AlertCircle} className={Number(supplier.totalDue || 0) > 0 ? "border-red-200" : ""} />
            </div>
          </section>

          <section className={INVENTORY_CARD_SHELL}>
            <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
              <InventorySectionHeader compact icon={Layers} title="Purchase History" description="Recent purchases for this supplier." />
            </div>
            <div className="p-5 sm:p-6 md:p-7">
              <DataTable columns={purchaseColumns} data={supplier.purchases ?? []} loading={false} inventoryStyle />
            </div>
          </section>
        </section>
      </div>

      <Modal open={editModal} onOpenChange={setEditModal} title="Edit Supplier">
        <div className="space-y-3">
          <div><label className="mb-1.5 block text-sm font-medium">Name</label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
          <div><label className="mb-1.5 block text-sm font-medium">Company</label><Input value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} /></div>
          <div><label className="mb-1.5 block text-sm font-medium">Phone</label><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
          <div><label className="mb-1.5 block text-sm font-medium">Email</label><Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
          <div><label className="mb-1.5 block text-sm font-medium">Address</label><Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} /></div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Status</label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setEditForm({ ...editForm, isActive: !editForm.isActive })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editForm.isActive ? "bg-primary" : "bg-gray-300"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editForm.isActive ? "translate-x-6" : "translate-x-1"}`} />
              </button>
              <span className="text-sm">{editForm.isActive ? "Active" : "Inactive"}</span>
            </div>
          </div>
          <Button className="mt-2 w-full" onClick={handleEdit} disabled={saving}>{saving ? "Saving..." : "Update Supplier"}</Button>
        </div>
      </Modal>

      <Modal open={paymentModal} onOpenChange={setPaymentModal} title="Quick Payment">
        <div className="space-y-3">
          <div><label className="mb-1.5 block text-sm font-medium">Amount *</label><Input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} placeholder="Enter payment amount" /></div>
          <div><label className="mb-1.5 block text-sm font-medium">Note</label><Input value={paymentForm.note} onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })} placeholder="Payment note (optional)" /></div>
          <Button className="mt-2 w-full" onClick={handlePayment} disabled={saving}>{saving ? "Processing..." : "Submit Payment"}</Button>
        </div>
      </Modal>
    </div>
  );
}