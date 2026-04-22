"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  DollarSign,
  ShoppingBag,
  Loader2,
  RotateCcw,
  LayoutGrid,
  Layers,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const PAGE_SIZE = 20;
const filterFieldClass =
  "h-10 rounded-xl border border-input bg-background/80 px-3 text-sm shadow-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-44";

interface PurchasedProduct {
  id: number;
  quantity: number;
  unitCost: number;
  total: number;
  purchase: { referenceNo: string; createdAt: string };
  storeProduct?: {
    product?: { name: string };
    productVariant?: {
      attributes?: { attributeValue?: { value: string } | null }[];
    } | null;
  };
}

export default function PurchaseProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<PurchasedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, lastPage: 1, total: 0 });
  const [applied, setApplied] = useState(false);
  const branchId = getSelectedBranch();

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchProducts = useCallback(async () => {
    if (!dateFrom || !dateTo) {
      setProducts([]);
      setMeta({ page: 1, lastPage: 1, total: 0 });
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        dateFrom,
        dateTo,
      });
      if (branchId) params.set("branchId", String(branchId));
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await apiFetch<unknown>(`/purchases/products?${params.toString()}`);
      const p = unwrapPaginated<PurchasedProduct>(res);
      if (p) {
        setProducts(p.data);
        setMeta({ page: p.page, lastPage: p.lastPage, total: p.total });
        if (p.page > p.lastPage) setPage(p.lastPage);
      } else {
        setProducts([]);
        setMeta({ page: 1, lastPage: 1, total: 0 });
      }
    } catch {
      setProducts([]);
      setMeta({ page: 1, lastPage: 1, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [page, dateFrom, dateTo, branchId, debouncedSearch]);

  const applyFilters = () => {
    if (!dateFrom || !dateTo) {
      alert("Please select both dates");
      return;
    }
    setApplied(true);
    setPage(1);
  };

  useEffect(() => {
    if (!applied) return;
    void fetchProducts();
  }, [applied, fetchProducts]);

  useEffect(() => {
    if (!applied) return;
    setPage(1);
  }, [debouncedSearch]);

  const refresh = () => {
    if (!applied) return;
    void fetchProducts();
  };

  const stats = useMemo(() => {
    const totalQty = products.reduce((s, p) => s + Number(p.quantity || 0), 0);
    const totalAmount = products.reduce(
      (s, p) => s + Number(p.total || p.unitCost * p.quantity || 0),
      0
    );
    return { total: meta.total, totalQty, totalAmount };
  }, [products, meta.total]);

  const variantLabel = (item: PurchasedProduct) =>
    item.storeProduct?.productVariant?.attributes
      ?.map((a) => a.attributeValue?.value)
      .filter(Boolean)
      .join(" / ");

  const columns = [
    { key: "index", label: "#", className: "w-12", render: (_: PurchasedProduct, i: number) => (page - 1) * PAGE_SIZE + i + 1 },
    {
      key: "productName",
      label: "Product",
      render: (item: PurchasedProduct) => item.storeProduct?.product?.name || "—",
    },
    {
      key: "variantLabel",
      label: "Variant",
      render: (item: PurchasedProduct) => variantLabel(item) || "—",
    },
    {
      key: "quantity",
      label: "Qty",
      className: "text-center",
      render: (item: PurchasedProduct) => item.quantity,
    },
    {
      key: "unitCost",
      label: "Unit Cost",
      render: (item: PurchasedProduct) => formatPrice(Number(item.unitCost)),
    },
    {
      key: "total",
      label: "Total",
      render: (item: PurchasedProduct) => (
        <span className="font-medium">{formatPrice(Number(item.total || item.unitCost * item.quantity))}</span>
      ),
    },
    {
      key: "purchaseRef",
      label: "Purchase Ref",
      render: (item: PurchasedProduct) => item.purchase?.referenceNo || "—",
    },
    {
      key: "purchaseDate",
      label: "Date",
      render: (item: PurchasedProduct) => formatDate(item.purchase?.createdAt),
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={Package}
        title="Purchase Products"
        description="Item-wise purchase report by date range with server-side pagination."
      >
        <Button type="button" variant="outline" size="sm" className="h-10 w-full gap-2 rounded-xl border-border/80 bg-background/80 backdrop-blur-sm sm:h-9 sm:w-auto" onClick={() => router.back()}>
          Back
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-10 w-full gap-2 rounded-xl border-border/80 bg-background/80 backdrop-blur-sm sm:h-9 sm:w-auto" onClick={refresh} disabled={!applied || loading}>
          <RotateCcw className="h-4 w-4 shrink-0" /> Refresh
        </Button>
      </InventoryListPageHeader>

      <div className="space-y-5 sm:space-y-6">
        <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
          <InventorySectionHeader icon={LayoutGrid} title="Overview" description="Totals are based on current page/date filter. Total products uses server total rows." />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard title="Total Products" value={stats.total} icon={Package} />
            <StatCard title="Page Quantity" value={stats.totalQty} icon={ShoppingBag} />
            <StatCard title="Page Amount" value={formatPrice(stats.totalAmount)} icon={DollarSign} />
          </div>
        </section>

        <section className={INVENTORY_CARD_SHELL}>
          <div className="flex flex-col gap-4 border-b border-border/50 bg-muted/15 px-5 py-4 sm:flex-row sm:items-end sm:justify-between sm:px-6 sm:py-5">
            <InventorySectionHeader compact icon={Layers} title="Purchased items" description={`Paginated (${PAGE_SIZE} per page). Date range required.`} />
          </div>
          <div className="space-y-4 p-5 sm:p-6 md:p-7">
            <FilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder="Search product name...">
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className={filterFieldClass} />
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className={filterFieldClass} />
              <Button type="button" onClick={applyFilters} disabled={loading} className="h-10 rounded-xl">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {loading ? "Loading..." : "Apply"}
              </Button>
            </FilterBar>

            <DataTable columns={columns} data={products} loading={loading} inventoryStyle />
            <InventoryTablePagination page={meta.page} lastPage={meta.lastPage} total={meta.total} loading={loading} onPageChange={setPage} />
          </div>
        </section>
      </div>
    </div>
  );
}
