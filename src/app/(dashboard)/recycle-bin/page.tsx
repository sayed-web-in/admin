"use client";

import { useEffect, useState } from "react";
import { Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { FilterBar } from "@/components/common/FilterBar";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";

interface ArchivedProduct {
  id: number;
  name: string;
  category: string;
  brand: string;
  archivedAt: string;
}

export default function RecycleBinPage() {
  const [products, setProducts] = useState<ArchivedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const branchId = getSelectedBranch();

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ isArchived: "true" });
      if (branchId) params.set("branchId", String(branchId));
      const res = await apiFetch<any>(`/products?${params}`);
      const list = res.products || res.data || (Array.isArray(res) ? res : []);
      setProducts(list);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [branchId]);

  const filtered = products.filter((p) =>
    p.name?.toLowerCase().includes(search.toLowerCase()) ||
    p.category?.toLowerCase().includes(search.toLowerCase()) ||
    p.brand?.toLowerCase().includes(search.toLowerCase())
  );

  const handleRestore = async (id: number) => {
    if (!confirm("Restore this product?")) return;
    try {
      await apiFetch(`/products/${id}/restore`, { method: "POST" });
      fetchData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDeletePermanently = async (id: number) => {
    if (!confirm("Permanently delete this product? This action cannot be undone.")) return;
    try {
      await apiFetch(`/products/${id}`, { method: "DELETE" });
      fetchData();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const columns = [
    { key: "#", label: "#", className: "w-12", render: (_: ArchivedProduct, i: number) => i + 1 },
    { key: "name", label: "Product Name", render: (p: ArchivedProduct) => <span className="font-medium">{p.name}</span> },
    { key: "category", label: "Category", render: (p: ArchivedProduct) => p.category || "—" },
    { key: "brand", label: "Brand", render: (p: ArchivedProduct) => p.brand || "—" },
    { key: "archivedAt", label: "Archived Date", render: (p: ArchivedProduct) => p.archivedAt ? formatDate(p.archivedAt) : "—" },
    {
      key: "actions",
      label: "Actions",
      render: (p: ArchivedProduct) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => handleRestore(p.id)} className="text-green-600 hover:text-green-700">
            <RotateCcw size={15} className="mr-1" /> Restore
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDeletePermanently(p.id)} className="text-red-600 hover:text-red-700">
            <Trash2 size={15} className="mr-1" /> Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Recycle Bin / Archived Products"
        description="Manage archived and deleted products"
      />

      {products.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">
            These products have been archived. You can restore them or permanently delete them.
          </p>
        </div>
      )}

      <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search archived products..." />

      <DataTable columns={columns} data={filtered} loading={loading} />
    </div>
  );
}
