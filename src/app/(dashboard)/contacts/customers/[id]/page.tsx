"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
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

interface CustomerSale {
  id: number;
  invoiceNumber: string;
  grandTotal: number;
  paidAmount: number;
  dueAmount: number;
  status: string;
  createdAt: string;
}

interface CustomerOrder {
  id: number;
  orderNumber: string;
  totalAmount: number;
  status: string;
  createdAt: string;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  division?: string | null;
  district?: string | null;
  totalAdvance?: number;
  totalPurchase?: number;
  totalPaid?: number;
  totalDue?: number;
  sales?: CustomerSale[];
  orders?: CustomerOrder[];
}

type LedgerRow = {
  id: number;
  ref: string;
  kind: "sale" | "order";
  status: string;
  total: number;
  paid: number;
  due: number;
  createdAt: string;
};

const divisions = [
  "Dhaka",
  "Chittagong",
  "Rajshahi",
  "Khulna",
  "Barisal",
  "Sylhet",
  "Rangpur",
  "Mymensingh",
];

const selectClasses =
  "h-10 w-full rounded-xl border border-input bg-background/80 px-3 text-sm shadow-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function CustomerDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [txnModal, setTxnModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    division: "",
    district: "",
  });
  const [txnForm, setTxnForm] = useState({ amount: "", note: "" });

  const fetchCustomer = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<unknown>(`/customers/${id}`);
      const data = (res && typeof res === "object" && "data" in (res as object)
        ? (res as { data: Customer }).data
        : (res as Customer)) || null;
      setCustomer(data);
      if (data) {
        setEditForm({
          name: data.name || "",
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
          division: data.division || "",
          district: data.district || "",
        });
      }
    } catch {
      setCustomer(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchCustomer();
  }, [fetchCustomer]);

  const refresh = () => {
    void fetchCustomer();
  };

  const ledgerRows = useMemo<LedgerRow[]>(() => {
    if (!customer) return [];
    const sales = (customer.sales ?? []).map((s) => ({
      id: s.id,
      ref: s.invoiceNumber || `Sale #${s.id}`,
      kind: "sale" as const,
      status: s.status,
      total: Number(s.grandTotal || 0),
      paid: Number(s.paidAmount || 0),
      due: Number(s.dueAmount || 0),
      createdAt: s.createdAt,
    }));
    const orders = (customer.orders ?? []).map((o) => ({
      id: o.id,
      ref: o.orderNumber || `Order #${o.id}`,
      kind: "order" as const,
      status: o.status,
      total: Number(o.totalAmount || 0),
      paid: Number(o.totalAmount || 0),
      due: 0,
      createdAt: o.createdAt,
    }));
    return [...sales, ...orders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [customer]);

  const handleEdit = async () => {
    if (!customer) return;
    setSaving(true);
    try {
      await apiFetch(`/customers/${customer.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...editForm,
          email: editForm.email.trim() || undefined,
          address: editForm.address.trim() || undefined,
          division: editForm.division || undefined,
          district: editForm.district.trim() || undefined,
        }),
      });
      setEditModal(false);
      await fetchCustomer();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleTransaction = async () => {
    if (!customer || !txnForm.amount) return;
    setSaving(true);
    try {
      await apiFetch(`/customers/${customer.id}/transaction`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(txnForm.amount),
          note: txnForm.note,
        }),
      });
      setTxnModal(false);
      setTxnForm({ amount: "", note: "" });
      await fetchCustomer();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setSaving(false);
    }
  };

  const ledgerColumns = [
    { key: "index", label: "#", className: "w-12", render: (_: LedgerRow, i: number) => i + 1 },
    {
      key: "ref",
      label: "Reference",
      render: (item: LedgerRow) => (
        <div>
          <p className="font-medium">{item.ref}</p>
          <p className="text-xs text-muted-foreground capitalize">{item.kind}</p>
        </div>
      ),
    },
    { key: "createdAt", label: "Date", render: (item: LedgerRow) => formatDate(item.createdAt) },
    { key: "total", label: "Total", render: (item: LedgerRow) => formatPrice(item.total) },
    {
      key: "paid",
      label: "Paid",
      render: (item: LedgerRow) => <span className="text-green-600">{formatPrice(item.paid)}</span>,
    },
    {
      key: "due",
      label: "Due",
      render: (item: LedgerRow) =>
        item.due > 0 ? (
          <span className="font-medium text-red-600">{formatPrice(item.due)}</span>
        ) : (
          <span className="text-green-600">{formatPrice(0)}</span>
        ),
    },
    { key: "status", label: "Status", render: (item: LedgerRow) => <StatusBadge status={item.status} /> },
  ];

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading customer...</div>;
  }

  if (!customer) {
    return <div className="p-6 text-sm text-muted-foreground">Customer not found.</div>;
  }

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={User}
        title={customer.name}
        description="Customer profile, due summary, and recent sales/orders."
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
          onClick={() => setTxnModal(true)}
        >
          <Plus className="h-4 w-4 shrink-0" /> Quick Transaction
        </Button>
      </InventoryListPageHeader>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-4 sm:gap-6">
        <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 lg:col-span-1`}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Customer Info</h3>
            <Button variant="ghost" size="sm" onClick={() => setEditModal(true)}>
              <Edit2 size={14} />
            </Button>
          </div>
          <div className="space-y-3">
            <div className="flex gap-3"><User size={16} className="mt-0.5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Name</p><p className="text-sm font-medium">{customer.name}</p></div></div>
            <div className="flex gap-3"><Phone size={16} className="mt-0.5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Phone</p><p className="text-sm font-medium">{customer.phone || "—"}</p></div></div>
            <div className="flex gap-3"><Mail size={16} className="mt-0.5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Email</p><p className="text-sm font-medium">{customer.email || "—"}</p></div></div>
            <div className="flex gap-3"><MapPin size={16} className="mt-0.5 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Address</p><p className="text-sm font-medium">{customer.address || "—"}</p><p className="text-xs text-muted-foreground">{[customer.district, customer.division].filter(Boolean).join(", ") || ""}</p></div></div>
          </div>
        </section>

        <section className="space-y-5 lg:col-span-3 sm:space-y-6">
          <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
            <InventorySectionHeader icon={LayoutGrid} title="Overview" description="Financial summary from customer stats." />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Total Advance" value={formatPrice(Number(customer.totalAdvance || 0))} icon={CreditCard} />
              <StatCard title="Total Purchase" value={formatPrice(Number(customer.totalPurchase || 0))} icon={ShoppingCart} />
              <StatCard title="Total Paid" value={formatPrice(Number(customer.totalPaid || 0))} icon={DollarSign} />
              <StatCard title="Total Due" value={formatPrice(Number(customer.totalDue || 0))} icon={AlertCircle} className={Number(customer.totalDue || 0) > 0 ? "border-red-200" : ""} />
            </div>
          </section>

          <section className={INVENTORY_CARD_SHELL}>
            <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
              <InventorySectionHeader compact icon={Layers} title="Recent Ledger" description="Latest sales and orders for this customer." />
            </div>
            <div className="p-5 sm:p-6 md:p-7">
              <DataTable columns={ledgerColumns} data={ledgerRows} loading={false} inventoryStyle />
            </div>
          </section>
        </section>
      </div>

      <Modal open={editModal} onOpenChange={setEditModal} title="Edit Customer">
        <div className="space-y-3">
          <div><label className="mb-1.5 block text-sm font-medium">Name</label><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} /></div>
          <div><label className="mb-1.5 block text-sm font-medium">Phone</label><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></div>
          <div><label className="mb-1.5 block text-sm font-medium">Email</label><Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} /></div>
          <div><label className="mb-1.5 block text-sm font-medium">Address</label><Input value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Division</label>
              <select value={editForm.division} onChange={(e) => setEditForm({ ...editForm, division: e.target.value })} className={selectClasses}>
                <option value="">Select Division</option>
                {divisions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div><label className="mb-1.5 block text-sm font-medium">District</label><Input value={editForm.district} onChange={(e) => setEditForm({ ...editForm, district: e.target.value })} /></div>
          </div>
          <Button className="mt-2 w-full" onClick={handleEdit} disabled={saving}>{saving ? "Saving..." : "Update Customer"}</Button>
        </div>
      </Modal>

      <Modal open={txnModal} onOpenChange={setTxnModal} title="Add Quick Transaction">
        <div className="space-y-3">
          <div><label className="mb-1.5 block text-sm font-medium">Amount *</label><Input type="number" value={txnForm.amount} onChange={(e) => setTxnForm({ ...txnForm, amount: e.target.value })} placeholder="Enter amount" /></div>
          <div><label className="mb-1.5 block text-sm font-medium">Note</label><Input value={txnForm.note} onChange={(e) => setTxnForm({ ...txnForm, note: e.target.value })} placeholder="Payment note (optional)" /></div>
          <Button className="mt-2 w-full" onClick={handleTransaction} disabled={saving}>{saving ? "Processing..." : "Submit Transaction"}</Button>
        </div>
      </Modal>
    </div>
  );
}