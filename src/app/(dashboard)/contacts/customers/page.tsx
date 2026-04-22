"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  UserCheck,
  DollarSign,
  UserPlus,
  Eye,
  RotateCcw,
  LayoutGrid,
  Layers,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { unwrapPaginated } from "@/lib/apiList";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
  InventorySectionHeader,
} from "@/components/inventory/InventoryCrudLayout";
import { StatCard } from "@/components/common/StatCard";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import { InventoryTablePagination } from "@/components/inventory/InventoryTablePagination";
import {
  TableRowActions,
  TableRowActionLink,
  tableActionIconClassName,
} from "@/components/common/TableRowActions";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 20;
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

interface Customer {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  division?: string | null;
  district?: string | null;
  totalAdvance?: number;
  sales?: { dueAmount: number }[];
  createdAt: string;
}

export default function CustomersPage() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tab, setTab] = useState<"all" | "due">("all");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, lastPage: 1, total: 0 });
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    totalDue: 0,
    newThisMonth: 0,
    dueCustomers: 0,
  });
  const [addModal, setAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    division: "",
    district: "",
  });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, tab]);

  const getCustomerDue = (c: Customer) => {
    const advance = Number(c.totalAdvance || 0);
    const salesDue = (c.sales ?? []).reduce(
      (sum, s) => sum + Number(s.dueAmount || 0),
      0
    );
    return Math.max(advance, salesDue);
  };

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (debouncedSearch) qs.set("search", debouncedSearch);
      const endpoint = tab === "due" ? "/customers/due" : "/customers";
      const res = await apiFetch<unknown>(`${endpoint}?${qs.toString()}`);
      const p = unwrapPaginated<Customer>(res);
      if (p) {
        setCustomers(p.data);
        setMeta({ page: p.page, lastPage: p.lastPage, total: p.total });
        if (p.page > p.lastPage) setPage(p.lastPage);
      } else {
        setCustomers([]);
        setMeta({ page: 1, lastPage: 1, total: 0 });
      }
    } catch {
      setCustomers([]);
      setMeta({ page: 1, lastPage: 1, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, tab]);

  const loadSummary = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (debouncedSearch) qs.set("search", debouncedSearch);
      const res = await apiFetch<unknown>(`/customers/summary?${qs.toString()}`);
      const body =
        res && typeof res === "object" ? (res as Record<string, unknown>) : {};
      setStats({
        total: Number(body.total) || 0,
        active: Number(body.active) || 0,
        totalDue: Number(body.totalDue) || 0,
        newThisMonth: Number(body.newThisMonth) || 0,
        dueCustomers: Number(body.dueCustomers) || 0,
      });
    } catch {
      setStats({ total: 0, active: 0, totalDue: 0, newThisMonth: 0, dueCustomers: 0 });
    }
  }, [debouncedSearch]);

  useEffect(() => {
    void fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const refresh = () => {
    void Promise.all([fetchCustomers(), loadSummary()]);
  };

  const handleAdd = async () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    setSaving(true);
    try {
      await apiFetch("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
          address: form.address.trim() || undefined,
          division: form.division || undefined,
          district: form.district.trim() || undefined,
        }),
      });
      setAddModal(false);
      setForm({ name: "", email: "", phone: "", address: "", division: "", district: "" });
      await Promise.all([fetchCustomers(), loadSummary()]);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      key: "index",
      label: "#",
      className: "w-12",
      render: (_: Customer, i: number) => (page - 1) * PAGE_SIZE + i + 1,
    },
    {
      key: "name",
      label: "Name",
      render: (item: Customer) => <span className="font-medium">{item.name}</span>,
    },
    { key: "phone", label: "Phone", render: (item: Customer) => item.phone || "—" },
    { key: "email", label: "Email", render: (item: Customer) => item.email || "—" },
    {
      key: "totalAdvance",
      label: "Advance",
      render: (item: Customer) => formatPrice(Number(item.totalAdvance || 0)),
    },
    {
      key: "due",
      label: "Due",
      render: (item: Customer) => {
        const due = getCustomerDue(item);
        return due > 0 ? (
          <span className="font-medium text-red-600">{formatPrice(due)}</span>
        ) : (
          <span className="text-green-600">{formatPrice(0)}</span>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: Customer) => (
        <TableRowActions>
          <TableRowActionLink href={`/contacts/customers/${item.id}`} title="View customer">
            <Eye className={tableActionIconClassName} />
          </TableRowActionLink>
        </TableRowActions>
      ),
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={Users}
        title="Customers"
        description="Manage customer profiles, dues, and activity with server-side pagination."
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
          onClick={() => setAddModal(true)}
        >
          <UserPlus className="h-4 w-4 shrink-0" /> Add Customer
        </Button>
      </InventoryListPageHeader>

      <div className="space-y-5 sm:space-y-6">
        <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
          <InventorySectionHeader
            icon={LayoutGrid}
            title="Overview"
            description="Summary uses GET /customers/summary with current search query."
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <StatCard title="Total Customers" value={stats.total} icon={Users} />
            <StatCard title="Active Customers" value={stats.active} icon={UserCheck} />
            <StatCard title="Due Customers" value={stats.dueCustomers} icon={DollarSign} />
            <StatCard title="Total Due" value={formatPrice(stats.totalDue)} icon={DollarSign} />
            <StatCard title="New This Month" value={stats.newThisMonth} icon={UserPlus} />
          </div>
        </section>

        <section className={INVENTORY_CARD_SHELL}>
          <div className="flex flex-col gap-4 border-b border-border/50 bg-muted/15 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-5">
            <InventorySectionHeader
              compact
              icon={Layers}
              title="Customer list"
              description={`Paginated (${PAGE_SIZE} per page). Due tab reads from /customers/due.`}
            />
            <div className="flex gap-1 rounded-xl bg-muted/50 p-1 ring-1 ring-border/40">
              <button
                type="button"
                onClick={() => setTab("all")}
                className={`min-h-9 rounded-lg px-4 py-2 text-sm font-medium ${
                  tab === "all"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setTab("due")}
                className={`min-h-9 rounded-lg px-4 py-2 text-sm font-medium ${
                  tab === "due"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Due
              </button>
            </div>
          </div>

          <div className="space-y-4 p-5 sm:p-6 md:p-7">
            <FilterBar
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by name or phone..."
            />
            <DataTable columns={columns} data={customers} loading={loading} inventoryStyle />
            <InventoryTablePagination
              page={meta.page}
              lastPage={meta.lastPage}
              total={meta.total}
              loading={loading}
              onPageChange={setPage}
            />
          </div>
        </section>
      </div>

      <Modal open={addModal} onOpenChange={setAddModal} title="Add Customer">
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Customer name"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Phone *</label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="01XXXXXXXXX"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Email</label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">Address</label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Street address"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Division</label>
              <select
                value={form.division}
                onChange={(e) => setForm({ ...form, division: e.target.value })}
                className={selectClasses}
              >
                <option value="">Select Division</option>
                {divisions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">District</label>
              <Input
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
                placeholder="District"
              />
            </div>
          </div>
          <Button className="mt-2 w-full" onClick={handleAdd} disabled={saving}>
            {saving ? "Saving..." : "Add Customer"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}