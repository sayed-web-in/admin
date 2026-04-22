"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Receipt,
  CalendarDays,
  CalendarClock,
  Pencil,
  Trash2,
  Plus,
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
import {
  TableRowActions,
  TableRowActionButton,
  tableActionIconClassName,
} from "@/components/common/TableRowActions";

const PAGE_SIZE = 20;
const selectClass =
  "h-10 rounded-xl border border-input bg-background/80 px-3 text-sm shadow-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Category {
  id: number;
  name: string;
}
interface Account {
  id: number;
  name: string;
}
interface Expense {
  id: number;
  date: string;
  category: Category;
  categoryId: number;
  amount: number;
  note?: string;
}

export default function ExpensesPage() {
  const router = useRouter();
  const branchId = getSelectedBranch();
  const [rows, setRows] = useState<Expense[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, lastPage: 1, total: 0 });
  const [summary, setSummary] = useState({
    totalExpenses: 0,
    thisMonthExpenses: 0,
    todayExpenses: 0,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formAccountId, setFormAccountId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterCategory, dateFrom, dateTo, branchId]);

  const buildQs = useCallback(() => {
    const q = new URLSearchParams();
    q.set("page", String(page));
    q.set("limit", String(PAGE_SIZE));
    if (debouncedSearch) q.set("search", debouncedSearch);
    if (filterCategory) q.set("categoryId", filterCategory);
    if (dateFrom) q.set("dateFrom", dateFrom);
    if (dateTo) q.set("dateTo", dateTo);
    return q;
  }, [page, debouncedSearch, filterCategory, dateFrom, dateTo]);

  const fetchLookups = useCallback(async () => {
    try {
      const [c, a] = await Promise.all([
        apiFetch<unknown>("/finance/expense-categories"),
        apiFetch<unknown>("/finance/accounts"),
      ]);
      setCats(Array.isArray(c) ? (c as Category[]) : []);
      setAccounts(Array.isArray(a) ? (a as Account[]) : []);
    } catch {
      setCats([]);
      setAccounts([]);
    }
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<unknown>(`/finance/expenses?${buildQs().toString()}`);
      const p = unwrapPaginated<Expense>(res);
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
      q.delete("page");
      q.delete("limit");
      const res = await apiFetch<unknown>(`/finance/expenses/summary?${q.toString()}`);
      const r = res as Record<string, unknown>;
      setSummary({
        totalExpenses: Number(r.totalExpenses) || 0,
        thisMonthExpenses: Number(r.thisMonthExpenses) || 0,
        todayExpenses: Number(r.todayExpenses) || 0,
      });
    } catch {
      setSummary({ totalExpenses: 0, thisMonthExpenses: 0, todayExpenses: 0 });
    }
  }, [buildQs]);

  useEffect(() => {
    void fetchLookups();
  }, [fetchLookups]);

  useEffect(() => {
    void fetchRows();
    void fetchSummary();
  }, [fetchRows, fetchSummary]);

  const refresh = () => {
    void fetchRows();
    void fetchSummary();
  };

  const openAdd = () => {
    setEditItem(null);
    setFormCategoryId(cats[0]?.id ? String(cats[0].id) : "");
    setFormAccountId("");
    setFormAmount("");
    setFormNote("");
    setFormDate(new Date().toISOString().slice(0, 10));
    setModalOpen(true);
  };

  const openEdit = (item: Expense) => {
    setEditItem(item);
    setFormCategoryId(String(item.categoryId));
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
        note: formNote || undefined,
        date: formDate,
      };
      if (editItem) {
        await apiFetch(`/finance/expenses/${editItem.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/finance/expenses", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      setModalOpen(false);
      refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this expense?")) return;
    try {
      await apiFetch(`/finance/expenses/${id}`, { method: "DELETE" });
      refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const columns = [
    { key: "#", label: "#", className: "w-12", render: (_: Expense, i: number) => (page - 1) * PAGE_SIZE + i + 1 },
    { key: "date", label: "Date", render: (e: Expense) => formatDate(e.date) },
    { key: "category", label: "Category", render: (e: Expense) => e.category?.name || "—" },
    { key: "amount", label: "Amount", render: (e: Expense) => <span className="font-semibold">{formatPrice(e.amount)}</span> },
    { key: "note", label: "Note", render: (e: Expense) => <span className="block max-w-[220px] truncate">{e.note || "—"}</span> },
    {
      key: "actions",
      label: "Actions",
      render: (e: Expense) => (
        <TableRowActions>
          <TableRowActionButton title="Edit" onClick={() => openEdit(e)}>
            <Pencil className={tableActionIconClassName} />
          </TableRowActionButton>
          <TableRowActionButton variant="danger" title="Delete" onClick={() => handleDelete(e.id)}>
            <Trash2 className={tableActionIconClassName} />
          </TableRowActionButton>
        </TableRowActions>
      ),
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={Receipt}
        title="Expenses"
        description="Track and manage expenses with server-side filters and pagination."
      >
        <Button type="button" variant="outline" size="sm" className="h-10 w-full rounded-xl sm:h-9 sm:w-auto" onClick={() => router.back()}>
          Back
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-10 w-full gap-2 rounded-xl sm:h-9 sm:w-auto" onClick={refresh}>
          <RotateCcw className="h-4 w-4" /> Refresh
        </Button>
        <Button type="button" className="h-10 w-full gap-2 rounded-xl sm:h-9 sm:w-auto" onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add Expense
        </Button>
      </InventoryListPageHeader>

      <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
        <InventorySectionHeader icon={LayoutGrid} title="Overview" description="Summary reflects current filters." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard title="Total Expenses" value={formatPrice(summary.totalExpenses)} icon={Receipt} />
          <StatCard title="This Month" value={formatPrice(summary.thisMonthExpenses)} icon={CalendarDays} />
          <StatCard title="Today" value={formatPrice(summary.todayExpenses)} icon={CalendarClock} />
        </div>
      </section>

      <section className={INVENTORY_CARD_SHELL}>
        <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
          <InventorySectionHeader compact icon={Layers} title="Expense list" description={`Paginated (${PAGE_SIZE} per page).`} />
        </div>
        <div className="space-y-4 p-5 sm:p-6 md:p-7">
          <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search expenses...">
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className={selectClass}>
              <option value="">All Categories</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 w-40 rounded-xl" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 w-40 rounded-xl" />
          </FilterBar>
          <DataTable columns={columns} data={rows} loading={loading} inventoryStyle />
          <InventoryTablePagination page={meta.page} lastPage={meta.lastPage} total={meta.total} loading={loading} onPageChange={setPage} />
        </div>
      </section>

      <Modal open={modalOpen} onOpenChange={setModalOpen} title={editItem ? "Edit Expense" : "Add Expense"}>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Category</label>
            <select value={formCategoryId} onChange={(e) => setFormCategoryId(e.target.value)} className={selectClass}>
              <option value="">Select Category</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Account (optional)</label>
            <select value={formAccountId} onChange={(e) => setFormAccountId(e.target.value)} className={selectClass}>
              <option value="">No Account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Amount</label>
            <Input type="number" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="0" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Note</label>
            <Input value={formNote} onChange={(e) => setFormNote(e.target.value)} placeholder="Expense description" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Date</label>
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
