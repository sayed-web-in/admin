"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Package,
  Store,
  FileText,
  AlertTriangle,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Branch {
  id: number;
  name: string;
}
interface Brand {
  id: number;
  name: string;
}
interface Category {
  id: number;
  name: string;
}

interface StoreProduct {
  id: number;
  productId: number;
  productName: string;
  type: string;
  variantLabel?: string;
  sku: string;
  quantity: number;
  sellingPrice: number;
  discountType?: string;
  discountValue?: number;
  status: string;
}

interface DraftProduct {
  id: number;
  name: string;
  type: string;
  sku?: string;
  categoryName?: string;
  brandName?: string;
  createdAt: string;
  status: string;
}

export default function ManageProductPage() {
  const [tab, setTab] = useState<"store" | "draft">("store");
  const [storeProducts, setStoreProducts] = useState<StoreProduct[]>([]);
  const [draftProducts, setDraftProducts] = useState<DraftProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [branches, setBranches] = useState<Branch[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [filterBrand, setFilterBrand] = useState(0);
  const [filterCategory, setFilterCategory] = useState(0);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterBranch, setFilterBranch] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [storeRes, draftRes] = await Promise.all([
        apiFetch<{ products: StoreProduct[] }>("/products/store"),
        apiFetch<{ products: DraftProduct[] }>("/products/drafts"),
      ]);
      setStoreProducts(storeRes.products || []);
      setDraftProducts(draftRes.products || []);
    } catch {
      setStoreProducts([]);
      setDraftProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    apiFetch<{ branches: Branch[] }>("/branches")
      .then((d) => setBranches(d.branches || []))
      .catch(() => {});
    apiFetch<{ brands: Brand[] }>("/brands")
      .then((d) => setBrands(d.brands || []))
      .catch(() => {});
    apiFetch<{ categories: Category[] }>("/categories")
      .then((d) => setCategories(d.categories || []))
      .catch(() => {});
  }, []);

  const stats = useMemo(() => {
    const lowStock = storeProducts.filter((p) => p.quantity <= 5).length;
    return {
      total: storeProducts.length + draftProducts.length,
      store: storeProducts.length,
      draft: draftProducts.length,
      lowStock,
    };
  }, [storeProducts, draftProducts]);

  const filteredStore = useMemo(() => {
    return storeProducts.filter((p) => {
      if (search && !p.productName.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (filterStatus && p.status !== filterStatus) return false;
      return true;
    });
  }, [storeProducts, search, filterStatus]);

  const filteredDraft = useMemo(() => {
    return draftProducts.filter((p) => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()))
        return false;
      if (filterStatus && p.status !== filterStatus) return false;
      return true;
    });
  }, [draftProducts, search, filterStatus]);

  const handleDeleteStore = async (id: number, qty: number) => {
    const msg =
      qty === 0
        ? "This product has 0 stock. It will be archived."
        : "Are you sure you want to delete this store product?";
    if (!confirm(msg)) return;
    try {
      await apiFetch(`/products/store/${id}`, { method: "DELETE" });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteDraft = async (id: number) => {
    if (!confirm("Are you sure you want to delete this draft?")) return;
    try {
      await apiFetch(`/products/${id}`, { method: "DELETE" });
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const selectClasses =
    "h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const storeColumns = [
    {
      key: "index",
      label: "#",
      className: "w-12",
      render: (_: StoreProduct, i: number) => i + 1,
    },
    { key: "productName", label: "Product" },
    {
      key: "type",
      label: "Type",
      render: (item: StoreProduct) => (
        <Badge variant={item.type === "VARIABLE" ? "warning" : "secondary"}>
          {item.type}
        </Badge>
      ),
    },
    {
      key: "variant",
      label: "Variant",
      render: (item: StoreProduct) => item.variantLabel || "—",
    },
    { key: "sku", label: "SKU" },
    { key: "quantity", label: "Qty" },
    {
      key: "sellingPrice",
      label: "Selling Price",
      render: (item: StoreProduct) => formatPrice(item.sellingPrice),
    },
    {
      key: "discount",
      label: "Discount",
      render: (item: StoreProduct) =>
        item.discountType && item.discountType !== "none"
          ? `${item.discountValue}${item.discountType === "percentage" ? "%" : ""}`
          : "—",
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: StoreProduct) => (
        <div className="flex items-center gap-1">
          <Link href={`/inventory/manage-product/${item.productId}`}>
            <Button variant="ghost" size="sm">
              <Eye size={14} />
            </Button>
          </Link>
          <Button variant="ghost" size="sm">
            <Pencil size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteStore(item.id, item.quantity)}
          >
            <Trash2 size={14} className="text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  const draftColumns = [
    {
      key: "index",
      label: "#",
      className: "w-12",
      render: (_: DraftProduct, i: number) => i + 1,
    },
    { key: "name", label: "Product" },
    {
      key: "type",
      label: "Type",
      render: (item: DraftProduct) => (
        <Badge variant={item.type === "VARIABLE" ? "warning" : "secondary"}>
          {item.type}
        </Badge>
      ),
    },
    {
      key: "sku",
      label: "SKU",
      render: (item: DraftProduct) => item.sku || "—",
    },
    {
      key: "categoryName",
      label: "Category",
      render: (item: DraftProduct) => item.categoryName || "—",
    },
    {
      key: "brandName",
      label: "Brand",
      render: (item: DraftProduct) => item.brandName || "—",
    },
    {
      key: "createdAt",
      label: "Created",
      render: (item: DraftProduct) => formatDate(item.createdAt),
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: DraftProduct) => (
        <div className="flex items-center gap-1">
          <Link href={`/inventory/manage-product/${item.id}`}>
            <Button variant="ghost" size="sm">
              <Eye size={14} />
            </Button>
          </Link>
          <Button variant="ghost" size="sm">
            <Pencil size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDeleteDraft(item.id)}
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
        title="Manage Products"
        description="View and manage store and draft products"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Products" value={stats.total} icon={Package} />
        <StatCard title="Store Products" value={stats.store} icon={Store} />
        <StatCard title="Draft Products" value={stats.draft} icon={FileText} />
        <StatCard
          title="Low Stock"
          value={stats.lowStock}
          icon={AlertTriangle}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-muted/50 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab("store")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === "store"
              ? "bg-white text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Store Products
        </button>
        <button
          onClick={() => setTab("draft")}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
            tab === "draft"
              ? "bg-white text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Draft Products
        </button>
      </div>

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search products..."
      >
        <select
          value={filterBrand}
          onChange={(e) => setFilterBrand(Number(e.target.value))}
          className={selectClasses}
        >
          <option value={0}>All Brands</option>
          {brands.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(Number(e.target.value))}
          className={selectClasses}
        >
          <option value={0}>All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className={selectClasses}
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          value={filterBranch}
          onChange={(e) => setFilterBranch(Number(e.target.value))}
          className={selectClasses}
        >
          <option value={0}>All Branches</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </FilterBar>

      {tab === "store" ? (
        <DataTable
          columns={storeColumns}
          data={filteredStore}
          loading={loading}
        />
      ) : (
        <DataTable
          columns={draftColumns}
          data={filteredDraft}
          loading={loading}
        />
      )}
    </div>
  );
}
