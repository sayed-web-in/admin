"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Scale,
  ArrowLeftRight,
  RotateCcw,
  LayoutGrid,
  Layers,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { unwrapPaginated } from "@/lib/apiList";
import { formatPrice, formatDate } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
  InventorySectionHeader,
} from "@/components/inventory/InventoryCrudLayout";
import { StatCard } from "@/components/common/StatCard";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import { InventoryTablePagination } from "@/components/inventory/InventoryTablePagination";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const PAGE_SIZE = 20;
type TxType = "CREDIT" | "DEBIT";

interface Account {
  id: number;
  name: string;
  balance?: number | string;
}

function accountBalance(a: Account): number {
  const b = a.balance;
  if (b === undefined || b === null) return 0;
  const n = typeof b === "number" ? b : parseFloat(String(b));
  return Number.isFinite(n) ? n : 0;
}

interface TransactionRow {
  id: number;
  createdAt: string;
  account?: Account;
  accountId: number;
  type: TxType;
  amount: number;
  reference?: string;
  description?: string;
}

export default function TransactionsPage() {
  const router = useRouter();
  const branchId = getSelectedBranch();
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterAccount, setFilterAccount] = useState("");
  const [filterType, setFilterType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, lastPage: 1, total: 0 });
  const [summary, setSummary] = useState({
    totalCredits: 0,
    totalDebits: 0,
    netBalance: 0,
  });
  const [transferOpen, setTransferOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formFromId, setFormFromId] = useState("");
  const [formToId, setFormToId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formReference, setFormReference] = useState("");
  const [formDescription, setFormDescription] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterAccount, filterType, dateFrom, dateTo, branchId]);

  const buildQs = useCallback(() => {
    const q = new URLSearchParams();
    q.set("page", String(page));
    q.set("limit", String(PAGE_SIZE));
    if (debouncedSearch) q.set("search", debouncedSearch);
    if (filterAccount) q.set("accountId", filterAccount);
    if (filterType) q.set("type", filterType);
    if (dateFrom) q.set("dateFrom", dateFrom);
    if (dateTo) q.set("dateTo", dateTo);
    return q;
  }, [page, debouncedSearch, filterAccount, filterType, dateFrom, dateTo]);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await apiFetch<unknown>("/finance/accounts");
      setAccounts(Array.isArray(res) ? (res as Account[]) : []);
    } catch {
      setAccounts([]);
    }
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<unknown>(`/finance/transactions?${buildQs().toString()}`);
      const p = unwrapPaginated<TransactionRow>(res);
      if (p) {
        setRows(p.data);
        setMeta({ page: p.page, lastPage: p.lastPage, total: p.total });
      } else {
        setRows([]);
        setMeta({ page: 1, lastPage: 1, total: 0 });
      }
    } catch {
      setRows([]);
      setMeta({ page: 1, lastPage: 1, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [buildQs]);

  const fetchSummary = useCallback(async () => {
    try {
      const q = buildQs();
      q.set("page", "1");
      q.set("limit", "100000");
      const res = await apiFetch<unknown>(`/finance/transactions?${q.toString()}`);
      const p = unwrapPaginated<TransactionRow>(res);
      const data = p?.data || [];
      const totalCredits = data.filter((x) => x.type === "CREDIT").reduce((s, x) => s + Number(x.amount || 0), 0);
      const totalDebits = data.filter((x) => x.type === "DEBIT").reduce((s, x) => s + Number(x.amount || 0), 0);
      setSummary({ totalCredits, totalDebits, netBalance: totalCredits - totalDebits });
    } catch {
      setSummary({ totalCredits: 0, totalDebits: 0, netBalance: 0 });
    }
  }, [buildQs]);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    void fetchRows();
    void fetchSummary();
  }, [fetchRows, fetchSummary]);

  const refresh = () => {
    void fetchRows();
    void fetchSummary();
  };

  const openTransfer = () => {
    const first = accounts[0];
    const second = accounts.find((a) => a.id !== first?.id);
    setFormFromId(first?.id ? String(first.id) : "");
    setFormToId(second?.id ? String(second.id) : "");
    setFormAmount("");
    setFormReference("");
    setFormDescription("");
    setTransferOpen(true);
  };

  const fromAccount = accounts.find((a) => a.id === Number(formFromId));
  const availableFrom = fromAccount ? accountBalance(fromAccount) : 0;
  const transferAmount = parseFloat(formAmount) || 0;
  const sameAccount =
    formFromId &&
    formToId &&
    Number(formFromId) === Number(formToId);
  const exceedsBalance = transferAmount > availableFrom + 1e-9;
  const transferInvalid =
    !formFromId ||
    !formToId ||
    sameAccount ||
    transferAmount <= 0 ||
    exceedsBalance;

  const handleTransferSave = async () => {
    if (transferInvalid) return;
    setSaving(true);
    try {
      await apiFetch("/finance/transactions/transfer", {
        method: "POST",
        body: JSON.stringify({
          fromAccountId: Number(formFromId),
          toAccountId: Number(formToId),
          amount: transferAmount,
          reference: formReference.trim() || undefined,
          description: formDescription.trim() || undefined,
        }),
      });
      setTransferOpen(false);
      refresh();
      void fetchAccounts();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Transfer failed");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: "#", label: "#", className: "w-12", render: (_: TransactionRow, i: number) => (page - 1) * PAGE_SIZE + i + 1 },
    { key: "createdAt", label: "Date", render: (t: TransactionRow) => formatDate(t.createdAt) },
    { key: "account", label: "Account", render: (t: TransactionRow) => t.account?.name || "—" },
    {
      key: "type",
      label: "Type",
      render: (t: TransactionRow) => (
        <Badge variant={t.type === "CREDIT" ? "success" : "destructive"}>
          {t.type === "CREDIT" ? "Credit" : "Debit"}
        </Badge>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      render: (t: TransactionRow) => {
        const n = Number(t.amount || 0);
        const abs = formatPrice(Math.abs(n));
        if (t.type === "CREDIT") {
          return (
            <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
              +{abs}
            </span>
          );
        }
        return (
          <span className="font-semibold tabular-nums text-red-600 dark:text-red-400">
            -{abs}
          </span>
        );
      },
    },
    { key: "reference", label: "Reference", render: (t: TransactionRow) => t.reference || "—" },
    { key: "description", label: "Description", render: (t: TransactionRow) => <span className="block max-w-[220px] truncate">{t.description || "—"}</span> },
  ];

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader icon={Scale} title="Transactions" description="View transactions and transfer balance between accounts.">
        <Button type="button" variant="outline" size="sm" className="h-10 w-full rounded-xl sm:h-9 sm:w-auto" onClick={() => router.back()}>
          Back
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-10 w-full gap-2 rounded-xl sm:h-9 sm:w-auto" onClick={refresh}>
          <RotateCcw className="h-4 w-4" /> Refresh
        </Button>
        <Button type="button" className="h-10 w-full gap-2 rounded-xl sm:h-9 sm:w-auto" onClick={openTransfer}>
          <ArrowLeftRight className="h-4 w-4" /> Add Transfer
        </Button>
      </InventoryListPageHeader>

      <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
        <InventorySectionHeader icon={LayoutGrid} title="Overview" description="Summary reflects active filters." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard title="Total Credits" value={formatPrice(summary.totalCredits)} icon={ArrowUpCircle} />
          <StatCard title="Total Debits" value={formatPrice(summary.totalDebits)} icon={ArrowDownCircle} />
          <StatCard title="Net Balance" value={formatPrice(summary.netBalance)} icon={Scale} />
        </div>
      </section>

      <section className={INVENTORY_CARD_SHELL}>
        <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
          <InventorySectionHeader compact icon={Layers} title="Transaction list" description={`Paginated (${PAGE_SIZE} per page).`} />
        </div>
        <div className="space-y-4 p-5 sm:p-6 md:p-7">
          <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search transactions...">
            <select
              value={filterAccount}
              onChange={(e) => setFilterAccount(e.target.value)}
              className="h-10 rounded-xl border border-input bg-background/80 px-3 text-sm shadow-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All Accounts</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="h-10 rounded-xl border border-input bg-background/80 px-3 text-sm shadow-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All Types</option>
              <option value="CREDIT">Credit</option>
              <option value="DEBIT">Debit</option>
            </select>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 w-40 rounded-xl" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 w-40 rounded-xl" />
          </FilterBar>
          <DataTable columns={columns} data={rows} loading={loading} inventoryStyle />
          <InventoryTablePagination page={meta.page} lastPage={meta.lastPage} total={meta.total} loading={loading} onPageChange={setPage} />
        </div>
      </section>

      <Modal open={transferOpen} onOpenChange={setTransferOpen} title="Transfer between accounts">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">From account</label>
            <select
              value={formFromId}
              onChange={(e) => {
                const v = e.target.value;
                setFormFromId(v);
                if (v && v === formToId) {
                  const other = accounts.find((a) => String(a.id) !== v);
                  setFormToId(other ? String(other.id) : "");
                }
              }}
              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Select account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({formatPrice(accountBalance(a))})
                </option>
              ))}
            </select>
            {fromAccount && (
              <p className="mt-1 text-xs text-muted-foreground">
                Available balance:{" "}
                <span className="font-medium text-foreground">{formatPrice(availableFrom)}</span>
              </p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">To account</label>
            <select
              value={formToId}
              onChange={(e) => {
                const v = e.target.value;
                setFormToId(v);
                if (v && v === formFromId) {
                  const other = accounts.find((a) => String(a.id) !== v);
                  setFormFromId(other ? String(other.id) : "");
                }
              }}
              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Select account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id} disabled={String(a.id) === formFromId}>
                  {a.name} ({formatPrice(accountBalance(a))})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Amount</label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              placeholder="0.00"
            />
            {formFromId && transferAmount > 0 && exceedsBalance && (
              <p className="mt-1 text-xs text-destructive">
                Amount cannot exceed available balance ({formatPrice(availableFrom)}).
              </p>
            )}
            {sameAccount && formFromId && (
              <p className="mt-1 text-xs text-destructive">Choose two different accounts.</p>
            )}
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Reference (optional)</label>
            <Input value={formReference} onChange={(e) => setFormReference(e.target.value)} placeholder="e.g. TRF-001" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Note (optional)</label>
            <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Shown on both ledger lines" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancel</Button>
            <Button onClick={handleTransferSave} disabled={saving || transferInvalid}>
              {saving ? "Transferring..." : "Transfer"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
