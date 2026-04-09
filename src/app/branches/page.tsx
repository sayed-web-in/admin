"use client";
import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/common/StatusBadge";
import { StatCard } from "@/components/common/StatCard";
import { apiFetch } from "@/lib/api";

interface Branch {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [form, setForm] = useState({ name: "", address: "", phone: "" });

  const fetchBranches = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<Branch[]>("/branches");
      setBranches(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchBranches(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: "", address: "", phone: "" });
    setModalOpen(true);
  };

  const openEdit = (branch: Branch) => {
    setEditing(branch);
    setForm({ name: branch.name, address: branch.address || "", phone: branch.phone || "" });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await apiFetch(`/branches/${editing.id}`, { method: "PATCH", body: JSON.stringify(form) });
      } else {
        await apiFetch("/branches", { method: "POST", body: JSON.stringify(form) });
      }
      setModalOpen(false);
      fetchBranches();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure?")) return;
    try {
      await apiFetch(`/branches/${id}`, { method: "DELETE" });
      fetchBranches();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const columns = [
    { key: "#", label: "#", render: (_: Branch, i: number) => i + 1 },
    { key: "name", label: "Name" },
    { key: "address", label: "Address", render: (b: Branch) => b.address || "-" },
    { key: "phone", label: "Phone", render: (b: Branch) => b.phone || "-" },
    { key: "status", label: "Status", render: (b: Branch) => <StatusBadge status={b.isActive ? "active" : "inactive"} /> },
    {
      key: "actions", label: "Actions",
      render: (b: Branch) => (
        <div className="flex items-center gap-1.5">
          <button onClick={() => openEdit(b)} className="p-1.5 hover:bg-muted rounded-lg transition-colors"><Pencil size={15} /></button>
          <button onClick={() => handleDelete(b.id)} className="p-1.5 hover:bg-red-50 text-red-500 rounded-lg transition-colors"><Trash2 size={15} /></button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Branch Management" action={<Button onClick={openCreate}><Plus size={16} className="mr-1.5" />Add Branch</Button>} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Branches" value={branches.length} icon={Building2} />
        <StatCard title="Active" value={branches.filter((b) => b.isActive).length} icon={Building2} />
        <StatCard title="Inactive" value={branches.filter((b) => !b.isActive).length} icon={Building2} />
        <StatCard title="Latest" value={branches[0]?.name || "-"} icon={Building2} />
      </div>
      <DataTable columns={columns} data={branches} loading={loading} />
      <Modal open={modalOpen} onOpenChange={setModalOpen} title={editing ? "Edit Branch" : "Add Branch"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="text-sm font-medium mb-1.5 block">Name *</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div><label className="text-sm font-medium mb-1.5 block">Address</label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div><label className="text-sm font-medium mb-1.5 block">Phone</label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit">{editing ? "Update" : "Create"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
