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
  Search,
  TrendingDown,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { unwrapPaginated } from "@/lib/apiList";
import { formatPrice, formatDate, todayYmdInDhaka } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
  InventorySectionHeader,
} from "@/components/inventory/InventoryCrudLayout";
import { StatCard } from "@/components/common/StatCard";
import { DataTable } from "@/components/common/DataTable";
import { InventoryTablePagination } from "@/components/inventory/InventoryTablePagination";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { StatusBadge } from "@/components/common/StatusBadge";
import {
  TableRowActions,
  TableRowActionButton,
  tableActionIconClassName,
} from "@/components/common/TableRowActions";

const PAGE_SIZE = 20;
const selectClass =
  "h-10 w-full rounded-xl border border-input bg-background/80 px-3 text-sm shadow-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const filterSelectClass =
  "h-10 min-w-[8.5rem] max-w-[10.5rem] shrink-0 rounded-xl border border-input bg-background/80 px-2.5 text-sm shadow-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface Category {
  id: number;
  name: string;
}
interface BranchRow {
  id: number;
  name: string;
}
interface AccountRow {
  id: number;
  name: string;
  balance?: number | string;
  isActive?: boolean;
}
interface Expense {
  id: number;
  date: string;
  name?: string | null;
  reference?: string | null;
  status?: string | null;
  category: Category;
  categoryId: number;
  branchId?: number | null;
  branch?: { id: number; name: string } | null;
  accountId?: number | null;
  account?: { id: number; name: string; type?: string } | null;
  amount: number;
  note?: string | null;
}

function normalizeAccounts(raw: unknown): AccountRow[] {
  const list = Array.isArray(raw) ? raw : (raw as { data?: unknown })?.data;
  if (!Array.isArray(list)) return [];
  return list
    .filter((a): a is AccountRow => a && typeof (a as AccountRow).id === "number")
    .filter((a) => (a.isActive ?? true) !== false);
}

export default function ExpensesPage() {
  const router = useRouter();
  const [filterBranchId, setFilterBranchId] = useState<number | "">(() => getSelectedBranch() ?? "");

  useEffect(() => {
    const h = () => setFilterBranchId(getSelectedBranch() ?? "");
    window.addEventListener("branch-changed", h);
    return () => window.removeEventListener("branch-changed", h);
  }, []);

  const [rows, setRows] = useState<Expense[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
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
  const [formName, setFormName] = useState("");
  const [formBranchId, setFormBranchId] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formAccountId, setFormAccountId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formReference, setFormReference] = useState("");
  const [formStatus, setFormStatus] = useState("active");
  const [formDate, setFormDate] = useState(() => todayYmdInDhaka());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filterCategory, filterBranchId, dateFrom, dateTo]);

  const buildQs = useCallback(() => {
    const q = new URLSearchParams();
    q.set("page", String(page));
    q.set("limit", String(PAGE_SIZE));
    if (debouncedSearch) q.set("search", debouncedSearch);
    if (filterCategory) q.set("categoryId", filterCategory);
    if (filterBranchId !== "" && filterBranchId != null) q.set("branchId", String(filterBranchId));
    if (dateFrom) q.set("dateFrom", dateFrom);
    if (dateTo) q.set("dateTo", dateTo);
    return q;
  }, [page, debouncedSearch, filterCategory, filterBranchId, dateFrom, dateTo]);

  const fetchLookups = useCallback(async () => {
    try {
      const [c, a, b] = await Promise.all([
        apiFetch<unknown>("/finance/expense-categories"),
        apiFetch<unknown>("/finance/accounts"),
        apiFetch<unknown>("/branches").catch(() => []),
      ]);
      setCats(Array.isArray(c) ? (c as Category[]) : []);
      setAccounts(normalizeAccounts(a));
      const bl = Array.isArray(b) ? b : (b as { data?: BranchRow[] })?.data ?? [];
      setBranches(Array.isArray(bl) ? bl : []);
    } catch {
      setCats([]);
      setAccounts([]);
      setBranches([]);
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
    const b = filterBranchId !== "" && filterBranchId != null ? String(filterBranchId) : branches[0]?.id ? String(branches[0].id) : "";
    setFormName("");
    setFormBranchId(b);
    setFormCategoryId(cats[0]?.id ? String(cats[0].id) : "");
    setFormAccountId("");
    setFormAmount("");
    setFormNote("");
    setFormReference("");
    setFormStatus("active");
    setFormDate(todayYmdInDhaka());
    setModalOpen(true);
  };

  const openEdit = (item: Expense) => {
    setEditItem(item);
    setFormName(item.name || "");
    setFormBranchId(item.branchId != null ? String(item.branchId) : "");
    setFormCategoryId(String(item.categoryId));
    setFormAccountId(item.accountId != null ? String(item.accountId) : "");
    setFormAmount(String(item.amount));
    setFormNote(item.note || "");
    setFormReference(item.reference || "");
    setFormStatus((item.status || "active").toLowerCase());
    setFormDate(item.date?.slice(0, 10) || todayYmdInDhaka());
    setModalOpen(true);
  };

  const handleSave = async () => {
    const name = formName.trim();
    if (!name) {
      toast.error("Expense name is required");
      return;
    }
    if (!formBranchId) {
      toast.error("Branch is required");
      return;
    }
    if (!formCategoryId) {
      toast.error("Category is required");
      return;
    }
    const statusLower = formStatus.toLowerCase();
    if (statusLower === "active" && !formAccountId) {
      toast.error("Account is required when status is Active — amount debits that account");
      return;
    }
    const amt = parseFloat(formAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error("Enter a valid amount greater than 0");
      return;
    }
    if (!formDate) {
      toast.error("Date is required");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        name,
        branchId: Number(formBranchId),
        categoryId: Number(formCategoryId),
        amount: amt,
        note: formNote.trim() || undefined,
        reference: formReference.trim() || undefined,
        status: formStatus,
        date: formDate,
      };
      if (formAccountId) body.accountId = Number(formAccountId);
      else if (statusLower !== "active") body.accountId = undefined;

      if (editItem) {
        await apiFetch(`/finance/expenses/${editItem.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        toast.success("Expense updated");
      } else {
        await apiFetch("/finance/expenses", {
          method: "POST",
          body: JSON.stringify(body),
        });
        toast.success("Expense added — account debited when status is Active (counts in Profit & Loss)");
      }
      setModalOpen(false);
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this expense? Active entries will reverse the account debit.")) return;
    try {
      await apiFetch(`/finance/expenses/${id}`, { method: "DELETE" });
      toast.success("Deleted");
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const columns = [
    { key: "#", label: "#", className: "w-12", render: (_: Expense, i: number) => (page - 1) * PAGE_SIZE + i + 1 },
    { key: "date", label: "Date", render: (e: Expense) => formatDate(e.date) },
    {
      key: "name",
      label: "Name",
      render: (e: Expense) => (
        <span className="font-medium text-foreground">{e.name?.trim() || e.category?.name || "—"}</span>
      ),
    },
    { key: "category", label: "Category", render: (e: Expense) => e.category?.name || "—" },
    {
      key: "account",
      label: "Account",
      render: (e: Expense) => e.account?.name ?? "—",
    },
    {
      key: "branch",
      label: "Branch",
      render: (e: Expense) => e.branch?.name ?? "—",
    },
    {
      key: "status",
      label: "Status",
      render: (e: Expense) => <StatusBadge status={e.status || "active"} />,
    },
    { key: "amount", label: "Amount", render: (e: Expense) => <span className="font-semibold text-rose-600">{formatPrice(e.amount)}</span> },
    {
      key: "reference",
      label: "Reference",
      render: (e: Expense) => <span className="block max-w-[140px] truncate text-muted-foreground text-sm">{e.reference || "—"}</span>,
    },
    {
      key: "note",
      label: "Note",
      render: (e: Expense) => <span className="block max-w-[180px] truncate text-muted-foreground text-sm">{e.note || "—"}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      render: (e: Expense) => (
        <TableRowActions>
          <TableRowActionButton title="Edit" onClick={() => openEdit(e)}>
            <Pencil className={tableActionIconClassName} />
          </TableRowActionButton>
          <TableRowActionButton variant="danger" title="Delete" onClick={() => void handleDelete(e.id)}>
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
        description="Seller-admin style: name, branch, category, account, status, reference, date. Active expenses debit the account and reduce Profit & Loss net profit."
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
        <InventorySectionHeader icon={LayoutGrid} title="Overview" description="Totals use Active expenses only (matches Profit & Loss)." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard title="Total (active)" value={formatPrice(summary.totalExpenses)} icon={Receipt} />
          <StatCard title="This Month" value={formatPrice(summary.thisMonthExpenses)} icon={CalendarDays} />
          <StatCard title="Today" value={formatPrice(summary.todayExpenses)} icon={CalendarClock} />
        </div>
      </section>

      <section className={INVENTORY_CARD_SHELL}>
        <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
          <InventorySectionHeader compact icon={Layers} title="Expense list" description={`Paginated (${PAGE_SIZE} per page).`} />
        </div>
        <div className="space-y-4 p-5 sm:p-6 md:p-7">
          <div className="mb-4 flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5">
            <div className="relative w-[min(100%,13rem)] shrink-0 sm:w-56">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                placeholder="Search name, note, reference…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 pl-9"
              />
            </div>
            <select
              value={filterBranchId === "" ? "" : String(filterBranchId)}
              onChange={(e) => setFilterBranchId(e.target.value ? Number(e.target.value) : "")}
              className={filterSelectClass}
            >
              <option value="">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className={filterSelectClass}>
              <option value="">All Categories</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 w-[9.25rem] shrink-0 rounded-xl" />
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 w-[9.25rem] shrink-0 rounded-xl" />
          </div>
          <DataTable columns={columns} data={rows} loading={loading} inventoryStyle />
          <InventoryTablePagination page={meta.page} lastPage={meta.lastPage} total={meta.total} loading={loading} onPageChange={setPage} />
        </div>
      </section>

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editItem ? "Edit Expense" : "Add Expense"}
        icon={<TrendingDown className="h-5 w-5" />}
        size="md"
        description="Active status debits the selected account and is included in Profit & Loss. Pending / cancelled are saved without ledger movement."
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving…" : editItem ? "Update" : "Save"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Expense name <span className="text-destructive">*</span></label>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Shop rent, Utilities" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Branch <span className="text-destructive">*</span></label>
            <select value={formBranchId} onChange={(e) => setFormBranchId(e.target.value)} className={selectClass}>
              <option value="">Select branch</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Category <span className="text-destructive">*</span></label>
            <select value={formCategoryId} onChange={(e) => setFormCategoryId(e.target.value)} className={selectClass}>
              <option value="">Select category</option>
              {cats.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">
              Account {formStatus.toLowerCase() === "active" ? <span className="text-destructive">*</span> : <span className="text-muted-foreground text-xs">(required if Active)</span>}
            </label>
            <select value={formAccountId} onChange={(e) => setFormAccountId(e.target.value)} className={selectClass}>
              <option value="">{formStatus.toLowerCase() === "active" ? "Select account" : "Optional if not Active"}</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                  {a.balance != null ? ` — ${formatPrice(Number(a.balance))}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Amount <span className="text-destructive">*</span></label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={formAmount}
              onChange={(e) => setFormAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Description</label>
            <Textarea
              value={formNote}
              onChange={(e) => setFormNote(e.target.value)}
              placeholder="Optional details"
              rows={3}
              className="resize-none rounded-xl"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Status</label>
            <select value={formStatus} onChange={(e) => setFormStatus(e.target.value)} className={selectClass}>
              <option value="active">Active (debit account, in P&amp;L)</option>
              <option value="pending">Pending (no ledger)</option>
              <option value="cancelled">Cancelled (no ledger)</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Reference</label>
            <Input value={formReference} onChange={(e) => setFormReference(e.target.value)} placeholder="Invoice / voucher no." />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Date <span className="text-destructive">*</span></label>
            <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
