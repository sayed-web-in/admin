"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ImageIcon,
  AlertTriangle,
  Layers,
} from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/common/PageHeader";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BatchModal } from "@/components/inventory/BatchModal";

interface ProductDetail {
  id: number;
  name: string;
  type: string;
  sku?: string;
  categoryName?: string;
  brandName?: string;
  unitName?: string;
  status: string;
  description?: string;
  images?: string[];
  hasImei?: boolean;
}

interface BranchVariant {
  id: number;
  branchName: string;
  image?: string;
  variantLabel?: string;
  quantity: number;
  sellingPrice: number;
  date: string;
  quantityAlert?: number;
}

export default function ProductDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [branchVariants, setBranchVariants] = useState<BranchVariant[]>([]);
  const [loading, setLoading] = useState(true);

  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [selectedBvId, setSelectedBvId] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([
      apiFetch<{ product: ProductDetail }>(`/products/${id}`),
      apiFetch<{ variants: BranchVariant[] }>(
        `/products/${id}/branch-variants`
      ),
    ])
      .then(([pRes, vRes]) => {
        setProduct(pRes.product);
        setBranchVariants(vRes.variants || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const openBatch = (bvId: number) => {
    setSelectedBvId(bvId);
    setBatchModalOpen(true);
  };

  const variantColumns = [
    {
      key: "index",
      label: "#",
      className: "w-10",
      render: (_: BranchVariant, i: number) => i + 1,
    },
    { key: "branchName", label: "Branch" },
    {
      key: "image",
      label: "Image",
      className: "w-14",
      render: (item: BranchVariant) =>
        item.image ? (
          <img
            src={item.image}
            alt=""
            className="w-10 h-10 rounded-lg object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <ImageIcon size={14} className="text-muted-foreground" />
          </div>
        ),
    },
    {
      key: "variantLabel",
      label: "Variant",
      render: (item: BranchVariant) => item.variantLabel || "Default",
    },
    { key: "quantity", label: "Qty" },
    {
      key: "sellingPrice",
      label: "Price",
      render: (item: BranchVariant) => formatPrice(item.sellingPrice),
    },
    {
      key: "date",
      label: "Date",
      render: (item: BranchVariant) => formatDate(item.date),
    },
    {
      key: "lowStock",
      label: "Stock Alert",
      render: (item: BranchVariant) => {
        if (
          item.quantityAlert &&
          item.quantity <= item.quantityAlert
        ) {
          return (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle size={12} /> Low
            </Badge>
          );
        }
        return <Badge variant="success">OK</Badge>;
      },
    },
    {
      key: "actions",
      label: "Batches",
      render: (item: BranchVariant) => (
        <Button variant="ghost" size="sm" onClick={() => openBatch(item.id)}>
          <Layers size={14} className="mr-1" /> Batches
        </Button>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <div className="py-12 text-center text-muted-foreground">
          Loading product details...
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-4 md:p-6">
        <div className="py-12 text-center text-muted-foreground">
          Product not found
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title={product.name}
        description="Product details and branch inventory"
        action={
          <Link href="/inventory/manage-product">
            <Button variant="outline">
              <ArrowLeft size={16} className="mr-2" /> Back
            </Button>
          </Link>
        }
      />

      {/* Product Info Card */}
      <div className="bg-white rounded-xl border border-border p-5 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3 text-sm">
            <div className="flex gap-2">
              <span className="text-muted-foreground w-28">Name:</span>
              <span className="font-medium">{product.name}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-28">Type:</span>
              <Badge variant={product.type === "VARIABLE" ? "warning" : "secondary"}>
                {product.type}
              </Badge>
            </div>
            {product.sku && (
              <div className="flex gap-2">
                <span className="text-muted-foreground w-28">SKU:</span>
                <span className="font-mono">{product.sku}</span>
              </div>
            )}
            <div className="flex gap-2">
              <span className="text-muted-foreground w-28">Category:</span>
              <span>{product.categoryName || "—"}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-28">Brand:</span>
              <span>{product.brandName || "—"}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-muted-foreground w-28">Status:</span>
              <StatusBadge status={product.status} />
            </div>
          </div>
          {product.description && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Description</p>
              <p className="text-sm whitespace-pre-wrap">
                {product.description}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Product Images */}
      {product.images && product.images.length > 0 && (
        <div className="bg-white rounded-xl border border-border p-5 mb-6">
          <h2 className="text-lg font-semibold mb-3">Images</h2>
          <div className="flex flex-wrap gap-3">
            {product.images.map((src, idx) => (
              <img
                key={idx}
                src={src}
                alt={`${product.name} ${idx + 1}`}
                className="w-24 h-24 rounded-lg object-cover border border-border"
              />
            ))}
          </div>
        </div>
      )}

      {/* Branch Product Variant List */}
      <div className="bg-white rounded-xl border border-border p-5">
        <h2 className="text-lg font-semibold mb-4">
          Branch Inventory
        </h2>
        <DataTable columns={variantColumns} data={branchVariants} />
      </div>

      <BatchModal
        open={batchModalOpen}
        onOpenChange={setBatchModalOpen}
        branchProductVariantId={selectedBvId}
      />
    </div>
  );
}
