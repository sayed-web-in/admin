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
  Lightbulb,
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
import { Textarea } from "@/components/ui/textarea";
import { AddCustomTransactionModal } from "./AddCustomTransactionModal";

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
  advanceBalance?: number | string | null;
  purchases?: Purchase[];
}

interface FinanceAccount {
  id: number;
  name: string;
  accountNumber?: string | null;
  type?: string;
  balance?: number | string;
}

interface SupplierTransactionRow {
  id: number;
  type: string;
  amount: number | string;
  accountId?: number | null;
  offsetsOpeningInventory?: boolean;
  invoiceNo?: string | null;
  purchaseId?: number | null;
  note?: string | null;
  transactionDate: string;
  createdAt?: string;
  account?: {
    id: number;
    name?: string;
    accountName?: string;
    accountType?: string;
    type?: string;
  } | null;
  purchase?: { id: number; referenceNo: string } | null;
}

const TRANSACTION_PAGE_LIMITS = [10, 15, 25, 50, 100] as const;

function getTodayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Local YYYY-MM-DD → ISO (noon local) for API timestamps. */
function paymentYmdToApiIso(ymd: string): string {
  const s = ymd.trim();
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return new Date().toISOString();
  return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString();
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
  const [customTxModal, setCustomTxModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "transactions">("overview");
  const [transactions, setTransactions] = useState<SupplierTransactionRow[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionLimit, setTransactionLimit] = useState<number>(10);
  const [transactionsTotal, setTransactionsTotal] = useState(0);
  const [transactionLastPage, setTransactionLastPage] = useState(1);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    address: "",
    isActive: true,
    advanceBalance: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    note: "",
    paymentAccountId: "",
    paymentDate: getTodayLocalDate(),
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
          advanceBalance:
            data.advanceBalance != null
              ? String(Number(data.advanceBalance))
              : "",
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

  const fetchTransactions = useCallback(
    async (page: number) => {
      if (!id) return;
      setTransactionsLoading(true);
      try {
        const res = await apiFetch<{
          data: SupplierTransactionRow[];
          total: number;
          page: number;
          lastPage: number;
          totalPages?: number;
        }>(
          `/suppliers/${id}/transactions?page=${page}&limit=${transactionLimit}`,
        );
        setTransactions(Array.isArray(res.data) ? res.data : []);
        setTransactionsTotal(typeof res.total === "number" ? res.total : 0);
        const last =
          typeof res.totalPages === "number"
            ? res.totalPages
            : typeof res.lastPage === "number"
              ? res.lastPage
              : 1;
        setTransactionLastPage(last > 0 ? last : 1);
        setTransactionPage(typeof res.page === "number" ? res.page : page);
      } catch {
        setTransactions([]);
        setTransactionsTotal(0);
        setTransactionLastPage(1);
      } finally {
        setTransactionsLoading(false);
      }
    },
    [id, transactionLimit],
  );

  useEffect(() => {
    if (activeTab !== "transactions" || !id) return;
    void fetchTransactions(transactionPage);
  }, [activeTab, id, transactionPage, fetchTransactions]);

  useEffect(() => {
    if (activeTab === "transactions") setTransactionPage(1);
  }, [activeTab]);

  const onTransactionLimitChange = (next: number) => {
    setTransactionLimit(next);
    setTransactionPage(1);
  };

  useEffect(() => {
    if (!paymentModal) return;
    setPaymentForm({
      amount: "",
      note: "",
      paymentAccountId: "",
      paymentDate: getTodayLocalDate(),
    });
    let cancelled = false;
    (async () => {
      setLoadingAccounts(true);
      try {
        const res = await apiFetch<FinanceAccount[] | { data?: FinanceAccount[] }>(
          "/finance/accounts",
        );
        const list = Array.isArray(res) ? res : res.data ?? [];
        const rows = Array.isArray(list)
          ? list.filter((a) => {
              if (!a || (a as FinanceAccount).id == null) return false;
              const active = (a as FinanceAccount & { isActive?: boolean })
                .isActive;
              return active !== false;
            })
          : [];
        if (!cancelled) setAccounts(rows);
      } catch {
        if (!cancelled) {
          setAccounts([]);
          toast.error("Failed to load accounts");
        }
      } finally {
        if (!cancelled) setLoadingAccounts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [paymentModal]);

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
      const advRaw = editForm.advanceBalance.trim();
      const advNum =
        advRaw === "" ? undefined : Math.max(0, Number(advRaw));
      await apiFetch(`/suppliers/${supplier.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name.trim(),
          email: editForm.email.trim() || undefined,
          phone: editForm.phone.trim() || undefined,
          company: editForm.company.trim() || undefined,
          address: editForm.address.trim() || undefined,
          isActive: editForm.isActive,
          ...(advNum !== undefined && Number.isFinite(advNum)
            ? { advanceBalance: advNum }
            : {}),
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

  const totalDueNum = supplier ? Number(supplier.totalDue || 0) : 0;
  const paymentNumAmount = parseFloat(paymentForm.amount) || 0;
  const selectedPayAccount = accounts.find(
    (a) => String(a.id) === paymentForm.paymentAccountId,
  );
  const selectedBalance = selectedPayAccount
    ? Number(selectedPayAccount.balance ?? 0)
    : 0;

  const handlePayment = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!supplier) return;
    if (!paymentForm.paymentAccountId) {
      toast.error("Please select an account");
      return;
    }
    if (paymentNumAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    if (paymentNumAmount > totalDueNum) {
      toast.error(
        `Amount cannot exceed total due (${formatPrice(totalDueNum)})`,
      );
      return;
    }
    if (selectedPayAccount && paymentNumAmount > selectedBalance) {
      toast.error("Insufficient account balance");
      return;
    }
    setSaving(true);
    try {
      await apiFetch(`/suppliers/${supplier.id}/payment`, {
        method: "POST",
        body: JSON.stringify({
          amount: paymentNumAmount,
          paymentAccountId: Number(paymentForm.paymentAccountId),
          paymentDate: paymentYmdToApiIso(
            paymentForm.paymentDate.trim() || getTodayLocalDate(),
          ),
          note: paymentForm.note.trim() || undefined,
        }),
      });
      setPaymentModal(false);
      toast.success("Payment recorded");
      await fetchSupplier();
      if (activeTab === "transactions") {
        void fetchTransactions(transactionPage);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setSaving(false);
    }
  };

  const transactionTypeBadge = (t: string) => {
    const x = (t || "").toLowerCase();
    const map: Record<string, string> = {
      payment: "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300",
      advance: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300",
      due: "bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-300",
      refund: "bg-amber-500/15 text-amber-800 border-amber-500/30 dark:text-amber-200",
      adjustment: "bg-violet-500/15 text-violet-700 border-violet-500/30 dark:text-violet-300",
    };
    return map[x] || "bg-muted text-muted-foreground border-border";
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
              Business Overview
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
              Custom Transaction History
            </button>
          </div>

          {activeTab === "overview" ? (
            <>
              <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
                <InventorySectionHeader icon={LayoutGrid} title="Overview" description="Totals from this supplier’s purchase history." />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard title="Total Purchases" value={formatPrice(purchaseStats.totalPurchases)} icon={ShoppingCart} />
                  <StatCard title="Total Paid" value={formatPrice(purchaseStats.totalPaid)} icon={CreditCard} />
                  <StatCard
                    title="Advance balance"
                    value={formatPrice(Number(supplier.advanceBalance || 0))}
                    icon={DollarSign}
                    className="border-emerald-200/80 dark:border-emerald-900/40"
                  />
                  <StatCard title="Total Due" value={formatPrice(Number(supplier.totalDue || 0))} icon={AlertCircle} className={Number(supplier.totalDue || 0) > 0 ? "border-red-200" : ""} />
                </div>
              </section>

              <section className={INVENTORY_CARD_SHELL}>
                <div className="flex flex-col gap-3 border-b border-border/50 bg-muted/15 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
                  <InventorySectionHeader compact icon={Layers} title="Purchase History" description="Recent purchases for this supplier." />
                  <Button
                    type="button"
                    className="h-10 shrink-0 gap-2 rounded-xl shadow-sm"
                    disabled={totalDueNum <= 0}
                    onClick={() => {
                      if (totalDueNum <= 0) {
                        toast.error("No due amount for this supplier");
                        return;
                      }
                      setPaymentModal(true);
                    }}
                  >
                    <Plus className="h-4 w-4 shrink-0" /> Quick Payment
                  </Button>
                </div>
                <div className="p-5 sm:p-6 md:p-7">
                  <DataTable columns={purchaseColumns} data={supplier.purchases ?? []} loading={false} inventoryStyle />
                </div>
              </section>
            </>
          ) : (
            <section className={INVENTORY_CARD_SHELL}>
              <div className="flex flex-col gap-3 border-b border-border/50 bg-muted/15 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
                <h3 className="text-lg font-semibold">Transaction History</h3>
                <Button
                  type="button"
                  className="h-10 shrink-0 gap-2 rounded-xl shadow-sm"
                  onClick={() => setCustomTxModal(true)}
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  Add Custom Transaction
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
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Purchase</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">Note</th>
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
                        const accountLabel = tx.offsetsOpeningInventory
                          ? "Opening stock (inventory capital)"
                          : accName && accType
                            ? `${accName} (${accType})`
                            : accName ||
                              (tx.accountId != null ? String(tx.accountId) : "—");
                        const purchaseLabel =
                          tx.purchase?.referenceNo ??
                          (tx.purchaseId != null ? `#${tx.purchaseId}` : "—");
                        return (
                          <tr key={tx.id} className="border-t border-border/50">
                            <td className="px-4 py-3">
                              <span className={cn("rounded border px-2 py-1 text-xs font-medium", transactionTypeBadge(tx.type))}>
                                {String(tx.type).toLowerCase()}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {formatDateTimeFromInput(tx.transactionDate)}
                            </td>
                            <td className="px-4 py-3 font-medium">
                              {formatAmountDecimal(Number(tx.amount || 0))}
                            </td>
                            <td className="px-4 py-3">{accountLabel}</td>
                            <td className="px-4 py-3">{tx.invoiceNo || "—"}</td>
                            <td className="px-4 py-3">{purchaseLabel}</td>
                            <td className="px-4 py-3 text-muted-foreground text-sm">{tx.note || "—"}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {transactionsTotal > 0 ? (
                <div className="flex flex-col gap-3 border-t border-border/50 px-4 py-3 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>
                      Page {transactionPage} of {Math.max(1, transactionLastPage)} · {transactionsTotal} total
                    </span>
                    <label className="flex items-center gap-2">
                      <span className="text-xs">Per page</span>
                      <select
                        value={transactionLimit}
                        onChange={(e) =>
                          onTransactionLimitChange(Number(e.target.value))
                        }
                        className={cn(selectClasses, "h-9 w-auto min-w-[4.5rem] py-1")}
                      >
                        {TRANSACTION_PAGE_LIMITS.map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={transactionPage <= 1 || transactionsLoading}
                      onClick={() => setTransactionPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        transactionPage >= transactionLastPage || transactionsLoading
                      }
                      onClick={() => setTransactionPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : null}
            </section>
          )}
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
            <label className="mb-1.5 block text-sm font-medium">Advance balance</label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={editForm.advanceBalance}
              onChange={(e) =>
                setEditForm({ ...editForm, advanceBalance: e.target.value })
              }
              placeholder="0.00 — prepayment from supplier"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Applied on new purchases (seller-style). Leave blank to keep unchanged when saving other fields — set to 0 to clear.
            </p>
          </div>
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

      <Modal
        open={paymentModal}
        onOpenChange={setPaymentModal}
        title="Quick Payment"
        icon={<CreditCard className="h-5 w-5" />}
        size="md"
        description={
          totalDueNum > 0 ? `Total Due: ${formatPrice(totalDueNum)}` : undefined
        }
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPaymentModal(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="supplier-quick-payment-form"
              disabled={
                saving ||
                paymentNumAmount <= 0 ||
                !paymentForm.paymentAccountId
              }
            >
              {saving ? "Processing..." : "Pay"}
            </Button>
          </div>
        }
      >
        <form
          id="supplier-quick-payment-form"
          onSubmit={handlePayment}
          className="space-y-4"
        >
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
            <div className="flex items-start gap-2">
              <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">
                  FIFO — oldest due cleared first
                </p>
                <p className="text-xs text-muted-foreground">
                  Max: {formatPrice(totalDueNum)}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Account <span className="text-destructive">*</span>
            </label>
            {loadingAccounts ? (
              <p className="text-sm text-muted-foreground">Loading accounts…</p>
            ) : (
              <select
                value={paymentForm.paymentAccountId}
                onChange={(e) =>
                  setPaymentForm({
                    ...paymentForm,
                    paymentAccountId: e.target.value,
                  })
                }
                className={selectClasses}
                required
              >
                <option value="">Select Account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {a.name}
                    {a.accountNumber ? ` (${a.accountNumber})` : ""} —{" "}
                    {formatPrice(Number(a.balance ?? 0))}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-sm font-medium">
                Amount <span className="text-destructive">*</span>
              </label>
              {totalDueNum > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    setPaymentForm({
                      ...paymentForm,
                      amount:
                        totalDueNum % 1 === 0
                          ? String(Math.round(totalDueNum))
                          : String(totalDueNum),
                    })
                  }
                  className="text-xs text-primary underline-offset-4 hover:underline"
                >
                  Pay full due
                </button>
              ) : null}
            </div>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max={totalDueNum > 0 ? totalDueNum : undefined}
              value={paymentForm.amount}
              onChange={(e) =>
                setPaymentForm({ ...paymentForm, amount: e.target.value })
              }
              onWheel={(e) => e.currentTarget.blur()}
              placeholder="0.00"
              required
              className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            {paymentNumAmount > 0 && paymentNumAmount > totalDueNum ? (
              <p className="text-xs text-destructive">
                Exceeds total due of {formatPrice(totalDueNum)}
              </p>
            ) : null}
            {selectedPayAccount &&
            paymentNumAmount > 0 &&
            paymentNumAmount > selectedBalance ? (
              <p className="text-xs text-destructive">
                Exceeds account balance of {formatPrice(selectedBalance)}
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Date <span className="text-destructive">*</span>
            </label>
            <Input
              type="date"
              value={paymentForm.paymentDate}
              onChange={(e) =>
                setPaymentForm({ ...paymentForm, paymentDate: e.target.value })
              }
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              value={paymentForm.note}
              onChange={(e) =>
                setPaymentForm({ ...paymentForm, note: e.target.value })
              }
              rows={2}
              placeholder="Optional notes"
              className="resize-none"
            />
          </div>
        </form>
      </Modal>

      <AddCustomTransactionModal
        open={customTxModal}
        onOpenChange={setCustomTxModal}
        supplierId={supplier.id}
        onSuccess={() => {
          void fetchSupplier();
          if (activeTab === "transactions") void fetchTransactions(transactionPage);
        }}
      />
    </div>
  );
}