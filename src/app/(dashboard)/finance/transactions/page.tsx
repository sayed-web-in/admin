"use client";

import { useEffect, useState } from "react";
import { ArrowUpCircle, ArrowDownCircle, Scale, Plus } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";

interface Account {
  id: number;
  name: string;
}

interface Transaction {
  id: number;
  date: string;
  account: Account;
  accountId: number;
  type: "Credit" | "Debit";
  amount: number;
  reference: string;
  description: string;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterAccount, setFilterAccount] = useState("");
  const [filterType, setFilterType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  const [formAccountId, setFormAccountId] = useState("");
  const [formType, setFormType] = useState<"Credit" | "Debit">("Credit");
  const [formAmount, setFormAmount] = useState("");
  const [formReference, setFormReference] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const branchId = getSelectedBranch();

  const fetchAccounts = async () => {
    try {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", String(branchId));
      const data = await apiFetch<Account[]>(`/finance/accounts?${params}`);
      setAccounts(data);
    } catch {
      setAccounts([]);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", String(branchId));
      if (filterAccount) params.set("accountId", filterAccount);
      if (filterType) params.set("type", filterType);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const data = await apiFetch<Transaction[]>(`/finance/transactions?${params}`);
      setTransactions(data);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAccounts(); }, [branchId]);
  useEffect(() => { fetchData(); }, [branchId, filterAccount, filterType, dateFrom, dateTo]);

  const filtered = transactions.filter(
    (t) =>
      t.reference?.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase()) ||
      t.account?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const totalCredits = transactions.filter((t) => t.type === "Credit").reduce((s, t) => s + t.amount, 0);
  const totalDebits = transactions.filter((t) => t.type === "Debit").reduce((s, t) => s + t.amount, 0);
  const netBalance = totalCredits - totalDebits;

  const openAdd = () => {
    setFormAccountId(accounts[0]?.id?.toString() || "");
    setFormType("Credit");
    setFormAmount("");
    setFormReference("");
    setFormDescription("");
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiFetch("/finance/transactions", {
        method: "POST",
        body: JSON.stringify({
          accountId: Number(formAccountId),
          type: formType,
          amount: parseFloat(formAmount) || 0,
          reference: formReference,
          description: formDescription,
          branchId,
        }),
      });
      setModalOpen(false);
      fetchData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: "#", label: "#", className: "w-12", render: (_: Transaction, i: number) => i + 1 },
    { key: "date", label: "Date", render: (t: Transaction) => formatDate(t.date) },
    { key: "account", label: "Account", render: (t: Transaction) => t.account?.name || "—" },
    {
      key: "type",
      label: "Type",
      render: (t: Transaction) => (
        <Badge variant={t.type === "Credit" ? "success" : "destructive"}>{t.type}</Badge>
      ),
    },
    { key: "amount", label: "Amount", render: (t: Transaction) => <span className="font-semibold">{formatPrice(t.amount)}</span> },
    { key: "reference", label: "Reference", render: (t: Transaction) => t.reference || "—" },
    { key: "description", label: "Description", render: (t: Transaction) => <span className="max-w-[200px] truncate block">{t.description || "—"}</span> },
  ];

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Transactions"
        description="View and manage financial transactions"
        action={
          <Button onClick={openAdd}>
            <Plus size={16} className="mr-1.5" /> Add Transaction
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Total Credits" value={formatPrice(totalCredits)} icon={ArrowUpCircle} />
        <StatCard title="Total Debits" value={formatPrice(totalDebits)} icon={ArrowDownCircle} />
        <StatCard title="Net Balance" value={formatPrice(netBalance)} icon={Scale} />
      </div>

      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search transactions...">
        <select
          value={filterAccount}
          onChange={(e) => setFilterAccount(e.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Types</option>
          <option value="Credit">Credit</option>
          <option value="Debit">Debit</option>
        </select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-auto" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-auto" />
      </FilterBar>

      <DataTable columns={columns} data={filtered} loading={loading} />

      <Modal open={modalOpen} onOpenChange={setModalOpen} title="Add Transaction">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Account</label>
            <select
              value={formAccountId}
              onChange={(e) => setFormAccountId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Select Account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Type</label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value as "Credit" | "Debit")}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="Credit">Credit</option>
              <option value="Debit">Debit</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Amount</label>
            <Input type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Reference</label>
            <Input value={formReference} onChange={(e) => setFormReference(e.target.value)} placeholder="e.g. INV-001" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Description</label>
            <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Transaction description" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !formAccountId || !formAmount}>
              {saving ? "Saving..." : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
