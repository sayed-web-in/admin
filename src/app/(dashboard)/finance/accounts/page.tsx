"use client";

import { useEffect, useState } from "react";
import { Landmark, Wallet, Building2, CreditCard, Pencil, Trash2, Plus } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import { Modal } from "@/components/common/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";

interface Account {
  id: number;
  name: string;
  accountNumber: string;
  type: string;
  balance: number;
  status: string;
}

const ACCOUNT_TYPES = ["Cash", "Bank", "Mobile Banking"];

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Account | null>(null);

  const [formName, setFormName] = useState("");
  const [formNumber, setFormNumber] = useState("");
  const [formType, setFormType] = useState("Cash");
  const [formBalance, setFormBalance] = useState("");
  const [formStatus, setFormStatus] = useState(true);
  const [saving, setSaving] = useState(false);

  const branchId = getSelectedBranch();

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", String(branchId));
      const data = await apiFetch<Account[]>(`/finance/accounts?${params}`);
      setAccounts(data);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [branchId]);

  const filtered = accounts.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.accountNumber.toLowerCase().includes(search.toLowerCase())
  );

  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const cashCount = accounts.filter((a) => a.type === "Cash").length;
  const bankCount = accounts.filter((a) => a.type === "Bank").length;

  const openAdd = () => {
    setEditItem(null);
    setFormName("");
    setFormNumber("");
    setFormType("Cash");
    setFormBalance("");
    setFormStatus(true);
    setModalOpen(true);
  };

  const openEdit = (item: Account) => {
    setEditItem(item);
    setFormName(item.name);
    setFormNumber(item.accountNumber);
    setFormType(item.type);
    setFormBalance(String(item.balance));
    setFormStatus(item.status === "active");
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        name: formName,
        accountNumber: formNumber,
        type: formType,
        balance: parseFloat(formBalance) || 0,
        status: formStatus ? "active" : "inactive",
        branchId,
      };
      if (editItem) {
        await apiFetch(`/finance/accounts/${editItem.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiFetch("/finance/accounts", { method: "POST", body: JSON.stringify(body) });
      }
      setModalOpen(false);
      fetchData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this account?")) return;
    try {
      await apiFetch(`/finance/accounts/${id}`, { method: "DELETE" });
      fetchData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const columns = [
    { key: "#", label: "#", className: "w-12", render: (_: Account, i: number) => i + 1 },
    { key: "name", label: "Account Name", render: (a: Account) => <span className="font-medium">{a.name}</span> },
    { key: "accountNumber", label: "Account Number" },
    {
      key: "type",
      label: "Type",
      render: (a: Account) => (
        <Badge variant={a.type === "Cash" ? "warning" : a.type === "Bank" ? "default" : "secondary"}>
          {a.type}
        </Badge>
      ),
    },
    { key: "balance", label: "Balance", render: (a: Account) => <span className="font-semibold">{formatPrice(a.balance)}</span> },
    { key: "status", label: "Status", render: (a: Account) => <StatusBadge status={a.status} /> },
    {
      key: "actions",
      label: "Actions",
      render: (a: Account) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
            <Pencil size={15} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}>
            <Trash2 size={15} className="text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Accounts"
        description="Manage financial accounts"
        action={
          <Button onClick={openAdd}>
            <Plus size={16} className="mr-1.5" /> Add Account
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Accounts" value={accounts.length} icon={Landmark} />
        <StatCard title="Total Balance" value={formatPrice(totalBalance)} icon={Wallet} />
        <StatCard title="Cash Accounts" value={cashCount} icon={CreditCard} />
        <StatCard title="Bank Accounts" value={bankCount} icon={Building2} />
      </div>

      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search accounts..." />

      <DataTable columns={columns} data={filtered} loading={loading} />

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editItem ? "Edit Account" : "Add Account"}
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Account Name</label>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Main Cash" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Account Number</label>
            <Input value={formNumber} onChange={(e) => setFormNumber(e.target.value)} placeholder="e.g. 1001" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Type</label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              {editItem ? "Balance" : "Initial Balance"}
            </label>
            <Input type="number" value={formBalance} onChange={(e) => setFormBalance(e.target.value)} placeholder="0" />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-foreground">Status</label>
            <button
              type="button"
              onClick={() => setFormStatus(!formStatus)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formStatus ? "bg-primary" : "bg-gray-300"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formStatus ? "translate-x-6" : "translate-x-1"}`} />
            </button>
            <span className="text-sm text-muted-foreground">{formStatus ? "Active" : "Inactive"}</span>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !formName}>
              {saving ? "Saving..." : editItem ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
