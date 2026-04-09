"use client";

import { useEffect, useState } from "react";
import {
  ImageIcon,
  Trash2,
  Plus,
  Package,
  Store,
} from "lucide-react";
import { apiFetch, apiUpload } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/common/DataTable";
import { SpecBuilder, type SpecRow } from "./SpecBuilder";
import { VariantModal, type VariantEntry } from "./VariantModal";
import { StoreProductModal } from "./StoreProductModal";

interface Category {
  id: number;
  name: string;
  subcategories?: { id: number; name: string }[];
}
interface Brand {
  id: number;
  name: string;
}
interface Unit {
  id: number;
  name: string;
}
interface TaxRate {
  id: number;
  name: string;
  rate: number;
}

export function ProductForm() {
  const [productType, setProductType] = useState<"SINGLE" | "VARIABLE">("SINGLE");
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [taxRates, setTaxRates] = useState<TaxRate[]>([]);

  const [categoryId, setCategoryId] = useState(0);
  const [subcategoryId, setSubcategoryId] = useState(0);
  const [brandId, setBrandId] = useState(0);
  const [unitId, setUnitId] = useState(0);
  const [taxRateId, setTaxRateId] = useState(0);
  const [productName, setProductName] = useState("");
  const [sku, setSku] = useState("");
  const [hasImei, setHasImei] = useState(false);

  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  const [variants, setVariants] = useState<VariantEntry[]>([]);
  const [variantModalOpen, setVariantModalOpen] = useState(false);

  const [specs, setSpecs] = useState<SpecRow[]>([{ name: "", value: "" }]);
  const [description, setDescription] = useState("");

  const [savedProductId, setSavedProductId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [storeModalOpen, setStoreModalOpen] = useState(false);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const subcategories = selectedCategory?.subcategories || [];

  useEffect(() => {
    apiFetch<{ categories: Category[] }>("/categories")
      .then((d) => setCategories(d.categories || []))
      .catch(() => {});
    apiFetch<{ brands: Brand[] }>("/brands")
      .then((d) => setBrands(d.brands || []))
      .catch(() => {});
    apiFetch<{ units: Unit[] }>("/units")
      .then((d) => setUnits(d.units || []))
      .catch(() => {});
    apiFetch<{ taxRates: TaxRate[] }>("/settings/tax-rates")
      .then((d) => setTaxRates(d.taxRates || []))
      .catch(() => {});
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setImages((prev) => [...prev, ...files]);
    setImagePreviews((prev) => [
      ...prev,
      ...files.map((f) => URL.createObjectURL(f)),
    ]);
  };

  const removeImage = (idx: number) => {
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddVariant = (variant: VariantEntry) => {
    setVariants((prev) => [...prev, variant]);
  };

  const removeVariant = (id: string) => {
    setVariants((prev) => prev.filter((v) => v.id !== id));
  };

  const handleSaveDraft = async () => {
    if (!productName.trim()) {
      alert("Product name is required");
      return;
    }
    setSaving(true);
    try {
      let uploadedImages: string[] = [];
      if (productType === "SINGLE" && images.length > 0) {
        for (const file of images) {
          const fd = new FormData();
          fd.append("file", file);
          const res = await apiUpload("/upload", fd);
          uploadedImages.push(res.url || res.path);
        }
      }

      const payload: Record<string, any> = {
        name: productName,
        type: productType,
        categoryId: categoryId || undefined,
        subcategoryId: subcategoryId || undefined,
        brandId: brandId || undefined,
        unitId: unitId || undefined,
        taxRateId: taxRateId || undefined,
        sku: productType === "SINGLE" ? sku || undefined : undefined,
        hasImei,
        images: uploadedImages.length > 0 ? uploadedImages : undefined,
        variants:
          productType === "VARIABLE"
            ? variants.map((v) => ({
                image: v.image,
                sku: v.sku,
                attributes: v.attributes.map((a) => ({
                  attributeId: a.attributeId,
                  valueId: a.valueId,
                })),
              }))
            : undefined,
        specifications: specs.filter((s) => s.name.trim() && s.value.trim()),
        description: description || undefined,
        status: "DRAFT",
      };

      const result = await apiFetch<{ product: { id: number } }>("/products", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setSavedProductId(result.product.id);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const selectClasses =
    "w-full h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const variantColumns = [
    {
      key: "index",
      label: "#",
      className: "w-12",
      render: (_: VariantEntry, i: number) => i + 1,
    },
    {
      key: "image",
      label: "Image",
      className: "w-16",
      render: (item: VariantEntry) =>
        item.image ? (
          <img src={item.image} alt="" className="w-10 h-10 rounded-lg object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
            <ImageIcon size={14} className="text-muted-foreground" />
          </div>
        ),
    },
    {
      key: "attributes",
      label: "Attributes",
      render: (item: VariantEntry) => (
        <div className="flex flex-wrap gap-1">
          {item.attributes.map((a, i) => (
            <Badge key={i} variant="secondary">
              {a.attributeName}: {a.valueName}
            </Badge>
          ))}
        </div>
      ),
    },
    { key: "sku", label: "SKU" },
    {
      key: "actions",
      label: "Actions",
      render: (item: VariantEntry) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => removeVariant(item.id!)}
        >
          <Trash2 size={14} className="text-red-500" />
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Section 1: Basic Details */}
      <div className="bg-white rounded-xl border border-border p-5">
        <h2 className="text-lg font-semibold mb-4">Basic Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Product Type
            </label>
            <select
              value={productType}
              onChange={(e) =>
                setProductType(e.target.value as "SINGLE" | "VARIABLE")
              }
              className={selectClasses}
            >
              <option value="SINGLE">Single Product</option>
              <option value="VARIABLE">Variable Product</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => {
                setCategoryId(Number(e.target.value));
                setSubcategoryId(0);
              }}
              className={selectClasses}
            >
              <option value={0}>Select Category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Subcategory
            </label>
            <select
              value={subcategoryId}
              onChange={(e) => setSubcategoryId(Number(e.target.value))}
              className={selectClasses}
              disabled={!categoryId}
            >
              <option value={0}>Select Subcategory</option>
              {subcategories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Brand</label>
            <select
              value={brandId}
              onChange={(e) => setBrandId(Number(e.target.value))}
              className={selectClasses}
            >
              <option value={0}>Select Brand</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Unit</label>
            <select
              value={unitId}
              onChange={(e) => setUnitId(Number(e.target.value))}
              className={selectClasses}
            >
              <option value={0}>Select Unit</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Tax Rate
            </label>
            <select
              value={taxRateId}
              onChange={(e) => setTaxRateId(Number(e.target.value))}
              className={selectClasses}
            >
              <option value={0}>No Tax</option>
              {taxRates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.rate}%)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Product Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Enter product name"
            />
          </div>
          {productType === "SINGLE" && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">
                SKU (auto-generates if empty)
              </label>
              <Input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="Leave blank to auto-generate"
              />
            </div>
          )}
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Unique Serial / IMEI
            </label>
            <select
              value={hasImei ? "yes" : "no"}
              onChange={(e) => setHasImei(e.target.value === "yes")}
              className={selectClasses}
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>
        </div>
      </div>

      {/* Section 2: Images (Single) or Variants (Variable) */}
      {productType === "SINGLE" ? (
        <div className="bg-white rounded-xl border border-border p-5">
          <h2 className="text-lg font-semibold mb-4">Product Images</h2>
          <div className="flex flex-wrap gap-3 mb-3">
            {imagePreviews.map((src, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={src}
                  alt=""
                  className="w-24 h-24 rounded-lg object-cover border border-border"
                />
                <button
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <Input type="file" accept="image/*" multiple onChange={handleImageUpload} />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Variants</h2>
            <Button onClick={() => setVariantModalOpen(true)}>
              <Plus size={16} className="mr-2" /> Add Variant
            </Button>
          </div>
          {variants.length > 0 ? (
            <DataTable columns={variantColumns} data={variants} />
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No variants added yet. Click "Add Variant" to begin.
            </p>
          )}
        </div>
      )}

      {/* Section 3: Specifications */}
      <div className="bg-white rounded-xl border border-border p-5">
        <h2 className="text-lg font-semibold mb-4">Specifications</h2>
        <SpecBuilder specs={specs} onChange={setSpecs} />
      </div>

      {/* Section 4: Description */}
      <div className="bg-white rounded-xl border border-border p-5">
        <h2 className="text-lg font-semibold mb-4">Description</h2>
        <textarea
          className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[160px]"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Detailed product description..."
        />
      </div>

      {/* Section 5: Actions */}
      <div className="bg-white rounded-xl border border-border p-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSaveDraft} disabled={saving}>
            <Package size={16} className="mr-2" />
            {saving ? "Saving..." : savedProductId ? "Update Draft" : "Save as Draft"}
          </Button>
          {savedProductId && (
            <Button
              variant="outline"
              onClick={() => setStoreModalOpen(true)}
              className="border-orange-500 text-orange-500 hover:bg-orange-50"
            >
              <Store size={16} className="mr-2" /> Add to Store
            </Button>
          )}
        </div>
      </div>

      <VariantModal
        open={variantModalOpen}
        onOpenChange={setVariantModalOpen}
        onAdd={handleAddVariant}
      />

      <StoreProductModal
        open={storeModalOpen}
        onOpenChange={setStoreModalOpen}
        productId={savedProductId}
        productType={productType}
        hasImei={hasImei}
        variants={variants}
      />
    </div>
  );
}
