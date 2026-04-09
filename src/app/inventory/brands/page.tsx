"use client";

import { useEffect, useState, useMemo } from "react";
import {
  Tags,
  CheckCircle,
  XCircle,
  Star,
  Pencil,
  Trash2,
  Plus,
  ImageIcon,
} from "lucide-react";
import { apiFetch, apiUpload } from "@/lib/api";
import { getSelectedBranch } from "@/lib/auth";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Branch {
  id: number;
  name: string;
}

interface Brand {
  id: number;
  name: string;
  description?: string;
  image?: string;
  status: string;
  branches?: { id: number; name: string }[];
}

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);

  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formStatus, setFormStatus] = useState(true);
  const [formBranches, setFormBranches] = useState<number[]>([]);
  const [formImage, setFormImage] = useState<File | null>(null);
  const [formImagePreview, setFormImagePreview] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const fetchBrands = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ brands: Brand[] }>("/brands");
      setBrands(data.brands || []);
    } catch {
      setBrands([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const data = await apiFetch<{ branches: Branch[] }>("/branches");
      setBranches(data.branches || []);
    } catch {
      setBranches([]);
    }
  };

  useEffect(() => {
    fetchBrands();
    fetchBranches();
  }, []);

  const filtered = useMemo(
    () =>
      brands.filter((b) =>
        b.name.toLowerCase().includes(search.toLowerCase())
      ),
    [brands, search]
  );

  const stats = useMemo(() => {
    const active = brands.filter((b) => b.status === "active").length;
    const inactive = brands.length - active;
    const latest = brands.length > 0 ? brands[brands.length - 1].name : "N/A";
    return { total: brands.length, active, inactive, latest };
  }, [brands]);

  const openAdd = () => {
    setEditing(null);
    setFormName("");
    setFormDesc("");
    setFormStatus(true);
    setFormBranches([]);
    setFormImage(null);
    setFormImagePreview("");
    setModalOpen(true);
  };

  const openEdit = (brand: Brand) => {
    setEditing(brand);
    setFormName(brand.name);
    setFormDesc(brand.description || "");
    setFormStatus(brand.status === "active");
    setFormBranches(brand.branches?.map((b) => b.id) || []);
    setFormImage(null);
    setFormImagePreview(brand.image || "");
    setModalOpen(true);
  };

  const toggleBranch = (id: number) => {
    setFormBranches((prev) =>
      prev.includes(id) ? prev.filter((b) => b !== id) : [...prev, id]
    );
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormImage(file);
      setFormImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setSaving(true);
    try {
      let imageUrl = editing?.image || "";
      if (formImage) {
        const fd = new FormData();
        fd.append("file", formImage);
        const res = await apiUpload("/upload", fd);
        imageUrl = res.url || res.path;
      }

      const payload = {
        name: formName,
        description: formDesc,
        status: formStatus ? "active" : "inactive",
        branchIds: formBranches,
        image: imageUrl,
      };

      if (editing) {
        await apiFetch(`/brands/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/brands", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      fetchBrands();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this brand?")) return;
    try {
      await apiFetch(`/brands/${id}`, { method: "DELETE" });
      fetchBrands();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const columns = [
    {
      key: "index",
      label: "#",
      className: "w-12",
      render: (_: Brand, i: number) => i + 1,
    },
    {
      key: "image",
      label: "Image",
      className: "w-16",
      render: (item: Brand) =>
        item.image ? (
          <img
            src={item.image}
            alt={item.name}
            className="w-10 h-10 rounded-lg object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <ImageIcon size={16} className="text-muted-foreground" />
          </div>
        ),
    },
    { key: "name", label: "Name" },
    {
      key: "description",
      label: "Description",
      render: (item: Brand) => (
        <span className="text-muted-foreground line-clamp-1">
          {item.description || "—"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (item: Brand) => <StatusBadge status={item.status} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: Brand) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
            <Pencil size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(item.id)}
          >
            <Trash2 size={14} className="text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Brand Management"
        description="Manage your product brands"
        action={
          <Button onClick={openAdd}>
            <Plus size={16} className="mr-2" /> Add Brand
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Brands" value={stats.total} icon={Tags} />
        <StatCard title="Active" value={stats.active} icon={CheckCircle} />
        <StatCard title="Inactive" value={stats.inactive} icon={XCircle} />
        <StatCard title="Latest Brand" value={stats.latest} icon={Star} />
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search brands..."
      />

      <DataTable columns={columns} data={filtered} loading={loading} />

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit Brand" : "Add Brand"}
        description={editing ? "Update brand details" : "Create a new brand"}
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Image</label>
            {formImagePreview && (
              <img
                src={formImagePreview}
                alt="Preview"
                className="w-20 h-20 rounded-lg object-cover mb-2"
              />
            )}
            <Input type="file" accept="image/*" onChange={handleImageChange} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Brand Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="Enter brand name"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Description
            </label>
            <textarea
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px]"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              placeholder="Brand description"
            />
          </div>
          {branches.length > 0 && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                Branches
              </label>
              <div className="flex flex-wrap gap-2">
                {branches.map((b) => (
                  <label
                    key={b.id}
                    className="flex items-center gap-1.5 text-sm cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={formBranches.includes(b.id)}
                      onChange={() => toggleBranch(b.id)}
                      className="accent-orange-500"
                    />
                    {b.name}
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Status</label>
            <button
              type="button"
              onClick={() => setFormStatus(!formStatus)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formStatus ? "bg-orange-500" : "bg-gray-300"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formStatus ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
            <span className="ml-2 text-sm">
              {formStatus ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
