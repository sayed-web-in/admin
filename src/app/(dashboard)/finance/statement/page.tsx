"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Search, RotateCcw, LayoutGrid, Layers } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
  InventorySectionHeader,
} from "@/components/inventory/InventoryCrudLayout";
import { StatCard } from "@/components/common/StatCard";
import { DataTable } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Account {
  id: number;
  name: string;
  accountNumber?: string;
  type?: string;
}

interface StatementRow {
  id: number;
  createdAt: string;
  description?: string;
  reference?: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

export default function AccountStatementPage() {
  const router = useRouter();
  const branchId = getSelectedBranch();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [accountName, setAccountName] = useState("");
  const [accountMeta, setAccountMeta] = useState("");
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);
  const [rows, setRows] = useState<StatementRow[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiFetch<unknown>("/finance/accounts");
        setAccounts(Array.isArray(res) ? (res as Account[]) : []);
      } catch {
        setAccounts([]);
      }
    };
    void load();
  }, [branchId]);

  const handleGenerate = async () => {
    if (!selectedAccountId) return;
    setLoading(true);
    try {
      const q = new URLSearchParams();
      q.set("accountId", selectedAccountId);
      if (dateFrom) q.set("dateFrom", dateFrom);
      if (dateTo) q.set("dateTo", dateTo);
      if (branchId) q.set("branchId", String(branchId));
      const raw = (await apiFetch<unknown>(`/finance/account-statement?${q.toString()}`)) as Record<string, unknown>;
      const account = (raw.account || {}) as Record<string, unknown>;
      setAccountName(String(account.name || ""));
      setAccountMeta(`${String(account.accountNumber || "—")} · ${String(account.type || "—")}`);
      setOpeningBalance(Number(raw.openingBalance) || 0);
      setClosingBalance(Number(raw.closingBalance) || 0);
      const txns = Array.isArray(raw.transactions) ? (raw.transactions as Record<string, unknown>[]) : [];
      setRows(
        txns.map((t) => {
          const type = String(t.type || "").toUpperCase();
          const amount = Number(t.amount) || 0;
          return {
            id: Number(t.id) || 0,
            createdAt: String(t.createdAt || ""),
            description: String(t.description || ""),
            reference: String(t.reference || ""),
            debit: type === "DEBIT" ? amount : 0,
            credit: type === "CREDIT" ? amount : 0,
            runningBalance: Number(t.runningBalance) || 0,
          };
        }),
      );
    } catch {
      setAccountName("");
      setAccountMeta("");
      setOpeningBalance(0);
      setClosingBalance(0);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(
    () => ({
      debit: rows.reduce((s, r) => s + r.debit, 0),
      credit: rows.reduce((s, r) => s + r.credit, 0),
    }),
    [rows],
  );

  const columns = [
    { key: "createdAt", label: "Date", render: (r: StatementRow) => formatDate(r.createdAt) },
    { key: "description", label: "Description", render: (r: StatementRow) => r.description || "—" },
    { key: "reference", label: "Reference", render: (r: StatementRow) => r.reference || "—" },
    { key: "debit", label: "Debit", render: (r: StatementRow) => <span className="font-medium text-red-600">{r.debit > 0 ? formatPrice(r.debit) : "—"}</span> },
    { key: "credit", label: "Credit", render: (r: StatementRow) => <span className="font-medium text-emerald-600">{r.credit > 0 ? formatPrice(r.credit) : "—"}</span> },
    { key: "runningBalance", label: "Balance", render: (r: StatementRow) => <span className="font-semibold">{formatPrice(r.runningBalance)}</span> },
  ];

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader icon={FileText} title="Account Statement" description="Generate detailed account statement by date range.">
        <Button type="button" variant="outline" size="sm" className="h-10 w-full rounded-xl sm:h-9 sm:w-auto" onClick={() => router.back()}>
          Back
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-10 w-full gap-2 rounded-xl sm:h-9 sm:w-auto" onClick={handleGenerate} disabled={!selectedAccountId}>
          <RotateCcw className="h-4 w-4" /> Refresh
        </Button>
      </InventoryListPageHeader>

      <section className={INVENTORY_CARD_SHELL}>
        <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
          <InventorySectionHeader compact icon={Search} title="Generate statement" description="Select account and date range." />
        </div>
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end sm:p-6 md:p-7">
          <div className="sm:min-w-[260px]">
            <label className="mb-1.5 block text-sm font-medium">Account</label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Select Account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.accountNumber || "—"})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">From</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 rounded-xl" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">To</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 rounded-xl" />
          </div>
          <Button onClick={handleGenerate} disabled={loading || !selectedAccountId} className="h-10 gap-2 rounded-xl">
            <Search className="h-4 w-4" /> {loading ? "Generating..." : "Generate"}
          </Button>
        </div>
      </section>

      <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
        <InventorySectionHeader icon={LayoutGrid} title="Overview" description={accountName || "No statement loaded yet."} />
        <div className="mb-3 text-sm text-muted-foreground">{accountMeta || "Select an account to see details."}</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard title="Opening Balance" value={formatPrice(openingBalance)} icon={FileText} />
          <StatCard title="Total Debit" value={formatPrice(totals.debit)} icon={FileText} />
          <StatCard title="Total Credit" value={formatPrice(totals.credit)} icon={FileText} />
        </div>
        <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-3 text-right text-sm font-semibold">
          Closing Balance:{" "}
          <span className={closingBalance >= 0 ? "text-emerald-600" : "text-red-600"}>{formatPrice(closingBalance)}</span>
        </div>
      </section>

      <section className={INVENTORY_CARD_SHELL}>
        <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
          <InventorySectionHeader compact icon={Layers} title="Statement entries" description={`Rows: ${rows.length}`} />
        </div>
        <div className="p-5 sm:p-6 md:p-7">
          <DataTable columns={columns} data={rows} loading={loading} inventoryStyle />
        </div>
      </section>
    </div>
  );
}
