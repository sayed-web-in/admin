"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Users,
  UserCheck,
  DollarSign,
  UserPlus,
  Eye,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  division: string | null;
  district: string | null;
  totalPurchase: number;
  totalPaid: number;
  totalDue: number;
  createdAt: string;
}

const divisions = [
  "Dhaka", "Chittagong", "Rajshahi", "Khulna",
  "Barisal", "Sylhet", "Rangpur", "Mymensingh",
];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"all" | "due">("all");
  const [addModal, setAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", phone: "", address: "", division: "", district: "",
  });

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (search) params.set("search", search);
      const res = await apiFetch<any>(`/customers?${params}`);
      setCustomers(res.data || (Array.isArray(res) ? res : []));
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const active = customers.filter((c) => Number(c.totalPurchase) > 0).length;
    const totalDue = customers.reduce((s, c) => s + Number(c.totalDue || 0), 0);
    const newThisMonth = customers.filter((c) => new Date(c.createdAt) >= monthStart).length;
    return { total: customers.length, active, totalDue, newThisMonth };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    if (tab === "due") return customers.filter((c) => Number(c.totalDue) > 0);
    return customers;
  }, [customers, tab]);

  const handleAdd = async () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    setSaving(true);
    try {
      await apiFetch("/customers", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setAddModal(false);
      setForm({ name: "", email: "", phone: "", address: "", division: "", district: "" });
      fetchCustomers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: "index", label: "#", className: "w-12", render: (_: Customer, i: number) => i + 1 },
    {
      key: "name",
      label: "Name",
      render: (item: Customer) => (
        <span className="font-medium text-foreground">{item.name}</span>
      ),
    },
    { key: "phone", label: "Phone", render: (item: Customer) => item.phone || "—" },
    { key: "email", label: "Email", render: (item: Customer) => item.email || "—" },
    {
      key: "totalPurchase",
      label: "Total Purchase",
      render: (item: Customer) => formatPrice(Number(item.totalPurchase || 0)),
    },
    {
      key: "totalPaid",
      label: "Total Paid",
      render: (item: Customer) => (
        <span className="text-green-600">{formatPrice(Number(item.totalPaid || 0))}</span>
      ),
    },
    {
      key: "totalDue",
      label: "Due",
      render: (item: Customer) => {
        const due = Number(item.totalDue || 0);
        return due > 0 ? (
          <span className="text-red-600 font-medium">{formatPrice(due)}</span>
        ) : (
          <span className="text-green-600">{formatPrice(0)}</span>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: Customer) => (
        <Link href={`/contacts/customers/${item.id}`}>
          <Button variant="ghost" size="sm">
            <Eye size={14} className="mr-1" /> View
          </Button>
        </Link>
      ),
    },
  ];

  const selectClasses = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Customers"
        description="Manage your customer base"
        action={
          <Button onClick={() => setAddModal(true)}>
            <UserPlus size={16} className="mr-2" /> Add Customer
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Customers" value={stats.total} icon={Users} />
        <StatCard title="Active Customers" value={stats.active} icon={UserCheck} />
        <StatCard title="Total Due" value={formatPrice(stats.totalDue)} icon={DollarSign} />
        <StatCard title="New This Month" value={stats.newThisMonth} icon={UserPlus} />
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, phone or email..."
      />

      <div className="flex gap-1 mb-4">
        {(["all", "due"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t
                ? "bg-primary text-white"
                : "bg-muted text-muted-foreground hover:bg-gray-200"
            }`}
          >
            {t === "all" ? "All Customers" : "Due Customers"}
          </button>
        ))}
      </div>

      <DataTable columns={columns} data={filteredCustomers} loading={loading} />

      <Modal open={addModal} onOpenChange={setAddModal} title="Add Customer">
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Name *</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Customer name"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Phone *</label>
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="01XXXXXXXXX"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Email</label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Address</label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Street address"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Division</label>
              <select
                value={form.division}
                onChange={(e) => setForm({ ...form, division: e.target.value })}
                className={selectClasses}
              >
                <option value="">Select Division</option>
                {divisions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">District</label>
              <Input
                value={form.district}
                onChange={(e) => setForm({ ...form, district: e.target.value })}
                placeholder="District"
              />
            </div>
          </div>
          <Button className="w-full mt-2" onClick={handleAdd} disabled={saving}>
            {saving ? "Saving..." : "Add Customer"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
