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
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate, formatDateTimeFromInput, formatAmountDecimal, cn } from "@/lib/utils";
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
import { CustomerTransactionModal } from "./CustomerTransactionModal";

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
  manualDue?: number | string | null;
  totalAdvance?: number;
  totalPurchase?: number;
  totalPaid?: number;
  totalDue?: number;
  sales?: CustomerSale[];
  orders?: CustomerOrder[];
}

interface CustomerTransactionRow {
  id: number;
  type: string;
  amount: number;
  date: string;
  transactionDate: string;
  note?: string | null;
  saleId?: number | null;
  account?: {
    id: number;
    accountName?: string;
    name?: string;
    accountType?: string;
    type?: string;
  } | null;
  invoice?: { id: number; invoiceNumber: string } | null;
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
  const [activeTab, setActiveTab] = useState<"overview" | "transactions">("overview");
  const [transactions, setTransactions] = useState<CustomerTransactionRow[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    division: "",
    district: "",
  });

  const fetchCustomer = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<unknown>(`/customers/${id}`);
      const data =
        (res && typeof res === "object" && "data" in (res as object)
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

  const fetchTransactions = useCallback(async () => {
    if (!id) return;
    setTransactionsLoading(true);
    try {
      const res = await apiFetch<{ data: CustomerTransactionRow[] }>(
        `/customers/${id}/transactions`,
      );
      setTransactions(Array.isArray(res.data) ? res.data : []);
    } catch {
      setTransactions([]);
    } finally {
      setTransactionsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void fetchCustomer();
  }, [fetchCustomer]);

  useEffect(() => {
    if (activeTab !== "transactions" || !id) return;
    void fetchTransactions();
  }, [activeTab, id, fetchTransactions]);

  const refresh = () => {
    void fetchCustomer();
  };

  const manualDueNum = customer ? Number(customer.manualDue ?? 0) : 0;
  const totalDueNum = customer ? Number(customer.totalDue || 0) : 0;

  const salesWithDue = useMemo(
    () =>
      (customer?.sales ?? [])
        .filter((s) => Number(s.dueAmount || 0) > 0)
        .map((s) => ({
          id: s.id,
          invoiceNumber: s.invoiceNumber || `Sale #${s.id}`,
          dueAmount: Number(s.dueAmount || 0),
        })),
    [customer?.sales],
  );

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
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
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

  const handleDeleteTransaction = async (txId: number) => {
    if (!customer) return;
    if (
      !window.confirm(
        "Delete this transaction? Ledger and customer balances will be reversed.",
      )
    ) {
      return;
    }
    setDeletingId(txId);
    try {
      await apiFetch(`/customers/${customer.id}/transactions/${txId}`, {
        method: "DELETE",
      });
      toast.success("Transaction deleted");
      await fetchCustomer();
      await fetchTransactions();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const transactionTypeBadge = (t: string) => {
    const x = (t || "").toLowerCase();
    const map: Record<string, string> = {
      payment:
        "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300",
      advance:
        "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
      due: "bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-300",
    };
    return map[x] || "bg-muted text-muted-foreground border-border";
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
          <div className="flex gap-6 border-b border-border/60">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={cn(
                "flex items-center gap-2 border-b-2 -mb-px py-3 px-1 text-sm font-medium transition-colors",
                activeTab === "overview"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="h-4 w-4" />
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("transactions")}
              className={cn(
                "flex items-center gap-2 border-b-2 -mb-px py-3 px-1 text-sm font-medium transition-colors",
                activeTab === "transactions"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <CreditCard className="h-4 w-4" />
              Transaction history
            </button>
          </div>

          {activeTab === "overview" ? (
            <>
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
                <div className="flex flex-col gap-3 border-b border-border/50 bg-muted/15 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
                  <InventorySectionHeader compact icon={Layers} title="Recent Ledger" description="Latest sales and orders for this customer." />
                  <Button
                    type="button"
                    className="h-10 shrink-0 gap-2 rounded-xl shadow-sm"
                    disabled={totalDueNum <= 0}
                    onClick={() => {
                      if (totalDueNum <= 0) {
                        toast.error("No due amount for this customer");
                        return;
                      }
                      setTxnModal(true);
                    }}
                  >
                    <Plus className="h-4 w-4 shrink-0" /> Quick payment
                  </Button>
                </div>
                <div className="p-5 sm:p-6 md:p-7">
                  <DataTable columns={ledgerColumns} data={ledgerRows} loading={false} inventoryStyle />
                </div>
              </section>
            </>
          ) : (
            <section className={INVENTORY_CARD_SHELL}>
              <div className="flex flex-col gap-3 border-b border-border/50 bg-muted/15 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
                <h3 className="text-lg font-semibold">Transaction history</h3>
                <Button
                  type="button"
                  className="h-10 shrink-0 gap-2 rounded-xl shadow-sm"
                  onClick={() => setTxnModal(true)}
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  Quick Transaction
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-border/50 bg-muted/30">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Amount</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Account</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Invoice</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Note</th>
                      <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactionsLoading ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                          Loading transactions…
                        </td>
                      </tr>
                    ) : transactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                          No transactions found
                        </td>
                      </tr>
                    ) : (
                      transactions.map((tx) => {
                        const acc = tx.account;
                        const accName = acc?.accountName ?? acc?.name;
                        const accType = acc?.accountType ?? acc?.type;
                        const accountLabel =
                          accName && accType
                            ? `${accName} (${accType})`
                            : accName || (acc?.id != null ? String(acc.id) : "—");
                        const invLabel =
                          tx.invoice?.invoiceNumber ??
                          (tx.saleId != null ? `#${tx.saleId}` : "—");
                        return (
                          <tr key={tx.id} className="border-t border-border/50">
                            <td className="px-4 py-3">
                              <span
                                className={cn(
                                  "rounded border px-2 py-1 text-xs font-medium",
                                  transactionTypeBadge(tx.type),
                                )}
                              >
                                {String(tx.type).toLowerCase()}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {formatDateTimeFromInput(tx.transactionDate || tx.date)}
                            </td>
                            <td className="px-4 py-3 font-medium">
                              {formatAmountDecimal(Number(tx.amount || 0))}
                            </td>
                            <td className="px-4 py-3">{accountLabel}</td>
                            <td className="px-4 py-3">{invLabel}</td>
                            <td className="px-4 py-3 text-muted-foreground text-sm">{tx.note || "—"}</td>
                            <td className="px-4 py-3 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                                disabled={deletingId === tx.id}
                                onClick={() => void handleDeleteTransaction(tx.id)}
                                aria-label="Delete transaction"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
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

      <CustomerTransactionModal
        open={txnModal}
        onOpenChange={setTxnModal}
        customerId={customer.id}
        manualDue={manualDueNum}
        salesWithDue={salesWithDue}
        totalDue={totalDueNum}
        onSuccess={() => {
          void fetchCustomer();
          if (activeTab === "transactions") void fetchTransactions();
        }}
      />
    </div>
  );
}
