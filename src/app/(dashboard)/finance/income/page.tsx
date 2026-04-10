"use client";

import { useEffect, useState } from "react";
import { TrendingUp, CalendarDays, CalendarClock, Pencil, Trash2, Plus } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";

interface Category {
  id: number;
  name: string;
}

interface Account {
  id: number;
  name: string;
}

interface Income {
  id: number;
  date: string;
  category: Category;
  categoryId: number;
  account?: Account;
  accountId?: number;
  amount: number;
  note: string;
}

export default function IncomePage() {
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Income | null>(null);

  const [formCategoryId, setFormCategoryId] = useState("");
  const [formAccountId, setFormAccountId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const branchId = getSelectedBranch();

  const fetchLookups = async () => {
    try {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", String(branchId));
      const [cats, accs] = await Promise.all([
        apiFetch<Category[]>(`/finance/income-categories?${params}`),
        apiFetch<Account[]>(`/finance/accounts?${params}`),
      ]);
      setCategories(cats);
      setAccounts(accs);
    } catch {
      setCategories([]);
      setAccounts([]);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", String(branchId));
      if (filterCategory) params.set("categoryId", filterCategory);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const data = await apiFetch<Income[]>(`/finance/incomes?${params}`);
      setIncomes(data);
    } catch {
      setIncomes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLookups(); }, [branchId]);
  useEffect(() => { fetchData(); }, [branchId, filterCategory, dateFrom, dateTo]);

  const filtered = incomes.filter(
    (e) =>
      e.category?.name?.toLowerCase().includes(search.toLowerCase()) ||
      e.note?.toLowerCase().includes(search.toLowerCase())
  );

  const totalIncome = incomes.reduce((s, e) => s + e.amount, 0);
  const now = new Date();
  const thisMonthIncome = incomes
    .filter((e) => { const d = new Date(e.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); })
    .reduce((s, e) => s + e.amount, 0);
  const todayStr = now.toISOString().slice(0, 10);
  const todayIncome = incomes
    .filter((e) => e.date?.slice(0, 10) === todayStr)
    .reduce((s, e) => s + e.amount, 0);

  const openAdd = () => {
    setEditItem(null);
    setFormCategoryId(categories[0]?.id?.toString() || "");
    setFormAccountId("");
    setFormAmount("");
    setFormNote("");
    setFormDate(new Date().toISOString().slice(0, 10));
    setModalOpen(true);
  };

  const openEdit = (item: Income) => {
    setEditItem(item);
    setFormCategoryId(String(item.categoryId));
    setFormAccountId(item.accountId ? String(item.accountId) : "");
    setFormAmount(String(item.amount));
    setFormNote(item.note || "");
    setFormDate(item.date?.slice(0, 10) || new Date().toISOString().slice(0, 10));
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        categoryId: Number(formCategoryId),
        accountId: formAccountId ? Number(formAccountId) : undefined,
        amount: parseFloat(formAmount) || 0,
        note: formNote,
        date: formDate,
        branchId,
      };
      if (editItem) {
        await apiFetch(`/finance/incomes/${editItem.id}`, { method: "PATCH", body: JSON.stringify(body) });
      } else {
        await apiFetch("/finance/incomes", { method: "POST", body: JSON.stringify(body) });
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
    if (!confirm("Are you sure you want to delete this income record?")) return;
    try {
      await apiFetch(`/finance/incomes/${id}`, { method: "DELETE" });
      fetchData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const columns = [
    { key: "#", label: "#", className: "w-12", render: (_: Income, i: number) => i + 1 },
    { key: "date", label: "Date", render: (e: Income) => formatDate(e.date) },
    { key: "category", label: "Category", render: (e: Income) => e.category?.name || "—" },
    { key: "account", label: "Account", render: (e: Income) => e.account?.name || "—" },
    { key: "amount", label: "Amount", render: (e: Income) => <span className="font-semibold text-green-600">{formatPrice(e.amount)}</span> },
    { key: "note", label: "Note", render: (e: Income) => <span className="max-w-[200px] truncate block">{e.note || "—"}</span> },
    {
      key: "actions",
      label: "Actions",
      render: (e: Income) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
            <Pencil size={15} />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)}>
            <Trash2 size={15} className="text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Income"
        description="Track and manage income"
        action={
          <Button onClick={openAdd}>
            <Plus size={16} className="mr-1.5" /> Add Income
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard title="Total Income" value={formatPrice(totalIncome)} icon={TrendingUp} />
        <StatCard title="This Month" value={formatPrice(thisMonthIncome)} icon={CalendarDays} />
        <StatCard title="Today" value={formatPrice(todayIncome)} icon={CalendarClock} />
      </div>

      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search income...">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-auto" />
        <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-auto" />
      </FilterBar>

      <DataTable columns={columns} data={filtered} loading={loading} />

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editItem ? "Edit Income" : "Add Income"}
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Category</label>
            <select
              value={formCategoryId}
              onChange={(e) => setFormCategoryId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Select Category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Account (optional)</label>
            <select
              value={formAccountId}
              onChange={(e) => setFormAccountId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">No Account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Amount</label>
            <Input type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Note</label>
            <Input value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="Income description" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Date</label>
            <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !formCategoryId || !formAmount}>
              {saving ? "Saving..." : editItem ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
