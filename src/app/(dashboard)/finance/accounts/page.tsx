"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Landmark,
  Wallet,
  Building2,
  CreditCard,
  Smartphone,
  Pencil,
  Trash2,
  Plus,
  RotateCcw,
  LayoutGrid,
  Layers,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
  InventorySectionHeader,
} from "@/components/inventory/InventoryCrudLayout";
import { StatCard } from "@/components/common/StatCard";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import { Modal } from "@/components/common/Modal";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InventoryTablePagination } from "@/components/inventory/InventoryTablePagination";
import {
  TableRowActions,
  TableRowActionButton,
  tableActionIconClassName,
} from "@/components/common/TableRowActions";

const PAGE_SIZE = 20;
const ACCOUNT_TYPES = ["CASH", "BANK", "MOBILE_BANKING"] as const;
type AccountType = (typeof ACCOUNT_TYPES)[number];

interface Account {
  id: number;
  name: string;
  accountNumber?: string;
  type: AccountType;
  balance: number;
  isActive?: boolean;
  status?: string;
}

function labelForType(type: AccountType) {
  if (type === "MOBILE_BANKING") return "Mobile Banking";
  if (type === "BANK") return "Bank";
  return "Cash";
}

export default function AccountsPage() {
  const router = useRouter();
  const branchId = getSelectedBranch();
  const [rows, setRows] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<Account | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState("");
  const [formNumber, setFormNumber] = useState("");
  const [formType, setFormType] = useState<AccountType>("CASH");
  const [formBalance, setFormBalance] = useState("");
  const [formStatus, setFormStatus] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch<unknown>("/finance/accounts");
      const list = Array.isArray(res) ? (res as Account[]) : [];
      setRows(
        list.map((r) => ({
          ...r,
          status: (r.isActive ?? r.status === "active") ? "active" : "inactive",
        })),
      );
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
  }, [branchId]);

  useEffect(() => setPage(1), [search, status, type]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((a) => {
      const okSearch =
        !q ||
        a.name.toLowerCase().includes(q) ||
        (a.accountNumber || "").toLowerCase().includes(q);
      const rowStatus = a.status || "inactive";
      const okStatus = status === "all" || rowStatus === status;
      const okType = type === "all" || a.type === type;
      return okSearch && okStatus && okType;
    });
  }, [rows, search, status, type]);

  const meta = {
    total: filtered.length,
    page,
    lastPage: Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
  };
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalBalance = rows.reduce((s, a) => s + Number(a.balance || 0), 0);
  const cashCount = rows.filter((a) => a.type === "CASH").length;
  const bankCount = rows.filter((a) => a.type === "BANK").length;
  const mobileCount = rows.filter((a) => a.type === "MOBILE_BANKING").length;

  const openAdd = () => {
    setEditItem(null);
    setFormName("");
    setFormNumber("");
    setFormType("CASH");
    setFormBalance("");
    setFormStatus(true);
    setModalOpen(true);
  };

  const openEdit = (item: Account) => {
    setEditItem(item);
    setFormName(item.name);
    setFormNumber(item.accountNumber || "");
    setFormType(item.type);
    setFormBalance(String(item.balance || 0));
    setFormStatus((item.status || "inactive") === "active");
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        name: formName.trim(),
        accountNumber: formNumber.trim() || undefined,
        type: formType,
        balance: parseFloat(formBalance) || 0,
        isActive: formStatus,
      };
      if (editItem) {
        await apiFetch(`/finance/accounts/${editItem.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await apiFetch("/finance/accounts", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      setModalOpen(false);
      await fetchData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this account?")) return;
    try {
      await apiFetch(`/finance/accounts/${id}`, { method: "DELETE" });
      await fetchData();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const columns = [
    { key: "#", label: "#", className: "w-12", render: (_: Account, i: number) => (page - 1) * PAGE_SIZE + i + 1 },
    { key: "name", label: "Account Name", render: (a: Account) => <span className="font-medium">{a.name}</span> },
    { key: "accountNumber", label: "Account Number", render: (a: Account) => a.accountNumber || "—" },
    {
      key: "type",
      label: "Type",
      render: (a: Account) => (
        <Badge variant={a.type === "CASH" ? "warning" : a.type === "BANK" ? "default" : "secondary"}>
          {labelForType(a.type)}
        </Badge>
      ),
    },
    { key: "balance", label: "Balance", render: (a: Account) => <span className="font-semibold">{formatPrice(Number(a.balance || 0))}</span> },
    { key: "status", label: "Status", render: (a: Account) => <StatusBadge status={a.status || "inactive"} /> },
    {
      key: "actions",
      label: "Actions",
      render: (a: Account) => (
        <TableRowActions>
          <TableRowActionButton title="Edit" onClick={() => openEdit(a)}>
            <Pencil className={tableActionIconClassName} />
          </TableRowActionButton>
          <TableRowActionButton variant="danger" title="Delete" onClick={() => handleDelete(a.id)}>
            <Trash2 className={tableActionIconClassName} />
          </TableRowActionButton>
        </TableRowActions>
      ),
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader icon={Landmark} title="Accounts" description="Manage financial accounts in a consistent list view.">
        <Button type="button" variant="outline" size="sm" className="h-10 w-full rounded-xl sm:h-9 sm:w-auto" onClick={() => router.back()}>
          Back
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-10 w-full gap-2 rounded-xl sm:h-9 sm:w-auto" onClick={() => void fetchData()}>
          <RotateCcw className="h-4 w-4" /> Refresh
        </Button>
        <Button type="button" className="h-10 w-full gap-2 rounded-xl sm:h-9 sm:w-auto" onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add Account
        </Button>
      </InventoryListPageHeader>

      <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
        <InventorySectionHeader icon={LayoutGrid} title="Overview" description="Quick account breakdown." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard title="Total Accounts" value={String(rows.length)} icon={Landmark} />
          <StatCard title="Total Balance" value={formatPrice(totalBalance)} icon={Wallet} />
          <StatCard title="Cash" value={String(cashCount)} icon={CreditCard} />
          <StatCard title="Bank" value={String(bankCount)} icon={Building2} />
          <StatCard title="Mobile Banking" value={String(mobileCount)} icon={Smartphone} />
        </div>
      </section>

      <section className={INVENTORY_CARD_SHELL}>
        <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
          <InventorySectionHeader compact icon={Layers} title="Account list" description="Inventory style table and actions." />
        </div>
        <div className="space-y-4 p-5 sm:p-6 md:p-7">
          <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search accounts...">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-10 rounded-xl border border-input bg-background/80 px-3 text-sm shadow-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">All Types</option>
              <option value="CASH">Cash</option>
              <option value="BANK">Bank</option>
              <option value="MOBILE_BANKING">Mobile Banking</option>
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-10 rounded-xl border border-input bg-background/80 px-3 text-sm shadow-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </FilterBar>
          <DataTable columns={columns} data={paged} loading={loading} inventoryStyle />
          <InventoryTablePagination page={meta.page} lastPage={meta.lastPage} total={meta.total} loading={loading} onPageChange={setPage} />
        </div>
      </section>

      <Modal open={modalOpen} onOpenChange={setModalOpen} title={editItem ? "Edit Account" : "Add Account"}>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Account Name</label>
            <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Main Cash" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Account Number</label>
            <Input value={formNumber} onChange={(e) => setFormNumber(e.target.value)} placeholder="e.g. 1001" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Type</label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value as AccountType)}
              className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {ACCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {labelForType(t)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">{editItem ? "Balance" : "Initial Balance"}</label>
            <Input type="number" value={formBalance} onChange={(e) => setFormBalance(e.target.value)} placeholder="0" />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium">Status</label>
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
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving ? "Saving..." : editItem ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
