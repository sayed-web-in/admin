"use client";
import { useState } from "react";
import { Plus, Trash2, Search, PackagePlus, PackageMinus } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface StoreProduct {
  id: number;
  product?: { name: string };
  variant?: { label: string };
  quantity: number;
  unitPrice: number;
}

interface AdjustmentItem {
  uid: string;
  storeProductId: number;
  productName: string;
  variantLabel: string;
  currentQty: number;
  adjustmentQty: number;
}

export default function StockAdjustmentPage() {
  const branchId = getSelectedBranch();
  const [type, setType] = useState<"addition" | "subtraction">("addition");
  const [items, setItems] = useState<AdjustmentItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<StoreProduct[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const searchProducts = async (query: string) => {
    setProductSearch(query);
    if (query.length < 2) {
      setProductResults([]);
      setShowDropdown(false);
      return;
    }
    setSearching(true);
    try {
      const params = new URLSearchParams({ search: query, limit: "20" });
      if (branchId) params.set("branchId", String(branchId));
      const res = await apiFetch<any>(`/products/store?${params}`);
      const list = res.data || (Array.isArray(res) ? res : []);
      setProductResults(list);
      setShowDropdown(true);
    } catch {
      setProductResults([]);
    } finally {
      setSearching(false);
    }
  };

  const addProduct = (sp: StoreProduct) => {
    if (items.find((i) => i.storeProductId === sp.id)) {
      setProductSearch("");
      setShowDropdown(false);
      return;
    }
    setItems((prev) => [
      ...prev,
      {
        uid: `${sp.id}-${Date.now()}`,
        storeProductId: sp.id,
        productName: sp.product?.name || "Product",
        variantLabel: sp.variant?.label || "—",
        currentQty: sp.quantity,
        adjustmentQty: 1,
      },
    ]);
    setProductSearch("");
    setProductResults([]);
    setShowDropdown(false);
  };

  const updateQty = (uid: string, qty: number) => {
    setItems((prev) =>
      prev.map((i) => (i.uid === uid ? { ...i, adjustmentQty: Math.max(1, qty) } : i))
    );
  };

  const removeItem = (uid: string) => {
    setItems((prev) => prev.filter((i) => i.uid !== uid));
  };

  const handleSubmit = async () => {
    if (items.length === 0) { alert("Add at least one product"); return; }
    if (!reason.trim()) { alert("Please provide a reason"); return; }
    setSaving(true);
    try {
      await apiFetch("/stock/adjustment", {
        method: "POST",
        body: JSON.stringify({
          type,
          branchId: branchId || undefined,
          reason,
          items: items.map((i) => ({
            storeProductId: i.storeProductId,
            quantity: i.adjustmentQty,
          })),
        }),
      });
      alert("Stock adjustment saved successfully");
      setItems([]);
      setReason("");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Stock Adjustment" description="Add or subtract stock quantities" />

      <div className="max-w-4xl space-y-6">
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold mb-4">Adjustment Type</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setType("addition")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                type === "addition"
                  ? "bg-green-100 text-green-700 border border-green-300"
                  : "bg-muted text-muted-foreground border border-border hover:bg-gray-100"
              }`}
            >
              <PackagePlus size={18} /> Addition
            </button>
            <button
              onClick={() => setType("subtraction")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                type === "subtraction"
                  ? "bg-red-100 text-red-700 border border-red-300"
                  : "bg-muted text-muted-foreground border border-border hover:bg-gray-100"
              }`}
            >
              <PackageMinus size={18} /> Subtraction
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold mb-4">Products</h3>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Search products to add..."
              value={productSearch}
              onChange={(e) => searchProducts(e.target.value)}
              onFocus={() => productResults.length > 0 && setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              className="pl-9"
            />
            {searching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                Searching...
              </div>
            )}
            {showDropdown && productResults.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {productResults.map((sp) => (
                  <button
                    key={sp.id}
                    className="w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors text-sm flex justify-between items-center"
                    onMouseDown={() => addProduct(sp)}
                  >
                    <div>
                      <p className="font-medium">{sp.product?.name}</p>
                      {sp.variant?.label && (
                        <p className="text-xs text-muted-foreground">{sp.variant.label}</p>
                      )}
                    </div>
                    <span className="text-muted-foreground text-xs">Stock: {sp.quantity}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Search and add products above
            </div>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Product</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground w-28">Current Qty</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground w-28">
                      {type === "addition" ? "Add Qty" : "Subtract Qty"}
                    </th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {items.map((item) => (
                    <tr key={item.uid}>
                      <td className="px-3 py-2">
                        <p className="font-medium">{item.productName}</p>
                        <p className="text-xs text-muted-foreground">{item.variantLabel}</p>
                      </td>
                      <td className="px-3 py-2 text-center">{item.currentQty}</td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          value={item.adjustmentQty || ""}
                          onChange={(e) => updateQty(item.uid, Number(e.target.value))}
                          className="h-8 text-center text-sm"
                          min={1}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Button variant="ghost" size="sm" onClick={() => removeItem(item.uid)} className="text-red-500 hover:text-red-700">
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold mb-4">Reason <span className="text-red-500">*</span></h3>
          <textarea
            className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px]"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this adjustment is being made..."
          />
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={saving} className="px-8">
            {saving ? "Saving..." : "Submit Adjustment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
