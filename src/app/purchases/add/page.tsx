"use client";
import { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Search, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Supplier {
  id: number;
  name: string;
  phone?: string;
}

interface StoreProduct {
  id: number;
  productId: number;
  product?: { name: string };
  variant?: { label: string };
  quantity: number;
  unitPrice: number;
}

interface PurchaseLineItem {
  uid: string;
  storeProductId: number;
  productName: string;
  variantLabel: string;
  quantity: number;
  unitCost: number;
}

export default function AddPurchasePage() {
  const router = useRouter();
  const branchId = getSelectedBranch();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [items, setItems] = useState<PurchaseLineItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [productResults, setProductResults] = useState<StoreProduct[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paidAmount, setPaidAmount] = useState(0);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiFetch<any>("/contacts/suppliers")
      .then((d) => setSuppliers(d.suppliers || d.data || (Array.isArray(d) ? d : [])))
      .catch(() => {});
  }, []);

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
    const exists = items.find((i) => i.storeProductId === sp.id);
    if (exists) {
      setItems((prev) =>
        prev.map((i) =>
          i.storeProductId === sp.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      );
    } else {
      setItems((prev) => [
        ...prev,
        {
          uid: `${sp.id}-${Date.now()}`,
          storeProductId: sp.id,
          productName: sp.product?.name || "Product",
          variantLabel: sp.variant?.label || "—",
          quantity: 1,
          unitCost: sp.unitPrice || 0,
        },
      ]);
    }
    setProductSearch("");
    setProductResults([]);
    setShowDropdown(false);
  };

  const updateItem = (uid: string, field: "quantity" | "unitCost", value: number) => {
    setItems((prev) =>
      prev.map((i) => (i.uid === uid ? { ...i, [field]: Math.max(0, value) } : i))
    );
  };

  const removeItem = (uid: string) => {
    setItems((prev) => prev.filter((i) => i.uid !== uid));
  };

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.quantity * i.unitCost, 0), [items]);
  const grandTotal = useMemo(() => subtotal - discount + tax, [subtotal, discount, tax]);
  const dueAmount = useMemo(() => Math.max(0, grandTotal - paidAmount), [grandTotal, paidAmount]);

  const selectClasses = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const handleSubmit = async () => {
    if (!supplierId) { alert("Please select a supplier"); return; }
    if (items.length === 0) { alert("Add at least one product"); return; }
    setSaving(true);
    try {
      await apiFetch("/purchases", {
        method: "POST",
        body: JSON.stringify({
          supplierId: Number(supplierId),
          branchId: branchId || undefined,
          items: items.map((i) => ({
            storeProductId: i.storeProductId,
            quantity: i.quantity,
            unitCost: i.unitCost,
          })),
          discount,
          tax,
          paymentMethod,
          paidAmount,
          note: note || undefined,
        }),
      });
      router.push("/purchases");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Add Purchase"
        description="Create a new purchase order"
        action={
          <Link href="/purchases">
            <Button variant="outline">
              <ArrowLeft size={16} className="mr-2" /> Back
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-border p-5">
            <h3 className="text-sm font-semibold mb-4">Purchase Info</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Supplier <span className="text-red-500">*</span>
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className={selectClasses}
                >
                  <option value="">Select supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Branch</label>
                <Input value={branchId ? `Branch #${branchId}` : "All"} disabled />
              </div>
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
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Variant</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground w-24">Qty</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground w-32">Unit Cost</th>
                      <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Total</th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((item) => (
                      <tr key={item.uid}>
                        <td className="px-3 py-2 font-medium">{item.productName}</td>
                        <td className="px-3 py-2 text-muted-foreground">{item.variantLabel}</td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            value={item.quantity || ""}
                            onChange={(e) => updateItem(item.uid, "quantity", Number(e.target.value))}
                            className="h-8 text-center text-sm"
                            min={1}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            value={item.unitCost || ""}
                            onChange={(e) => updateItem(item.uid, "unitCost", Number(e.target.value))}
                            className="h-8 text-center text-sm"
                            min={0}
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          {formatPrice(item.quantity * item.unitCost)}
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
            <h3 className="text-sm font-semibold mb-4">Note</h3>
            <textarea
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[80px]"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional note for this purchase..."
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-border p-5 sticky top-4">
            <h3 className="text-sm font-semibold mb-4">Payment Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatPrice(subtotal)}</span>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Discount</label>
                <Input
                  type="number"
                  value={discount || ""}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  min={0}
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Tax</label>
                <Input
                  type="number"
                  value={tax || ""}
                  onChange={(e) => setTax(Number(e.target.value))}
                  min={0}
                  placeholder="0"
                />
              </div>
              <div className="flex justify-between text-base font-bold border-t border-border pt-3">
                <span>Grand Total</span>
                <span className="text-primary">{formatPrice(grandTotal)}</span>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className={selectClasses}
                >
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="mobile_banking">Mobile Banking</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1 block">Paid Amount</label>
                <Input
                  type="number"
                  value={paidAmount || ""}
                  onChange={(e) => setPaidAmount(Number(e.target.value))}
                  min={0}
                  placeholder="0"
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Due Amount</span>
                <span className={dueAmount > 0 ? "text-red-600 font-medium" : "text-green-600 font-medium"}>
                  {formatPrice(dueAmount)}
                </span>
              </div>
              <Button className="w-full mt-2" onClick={handleSubmit} disabled={saving}>
                {saving ? "Saving..." : "Submit Purchase"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
