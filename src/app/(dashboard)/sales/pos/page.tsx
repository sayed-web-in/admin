"use client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Search, Plus, Minus, Trash2, User, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/common/Modal";
import { StatCard } from "@/components/common/StatCard";
import { apiFetch } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";

interface PosItem {
  storeProductId: number;
  name: string;
  image: string;
  price: number;
  quantity: number;
  variant?: string;
}

interface Product {
  id: number;
  name: string;
  images: { url: string }[];
  storeProducts: {
    id: number;
    sellingPrice: number;
    quantity: number;
    productVariant?: {
      attributes: { attributeValue: { value: string } }[];
    };
  }[];
}

interface Category {
  id: number;
  name: string;
}

interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string | null;
}

type MobileTab = "categories" | "products" | "cart";

export default function POSPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<PosItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [discount, setDiscount] = useState(0);
  const [confirmModal, setConfirmModal] = useState(false);
  const [receiptModal, setReceiptModal] = useState(false);
  const [customerModal, setCustomerModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [lastSale, setLastSale] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("products");
  const branchId = getSelectedBranch();

  useEffect(() => {
    apiFetch<any>("/categories?limit=50")
      .then((res) => setCategories(Array.isArray(res) ? res : res.data || res.categories || []))
      .catch(() => {});
  }, []);

  const fetchProducts = useCallback(async () => {
    const params = new URLSearchParams();
    if (branchId) params.set("branchId", String(branchId));
    if (selectedCategory) params.set("categoryId", String(selectedCategory));
    if (search) params.set("search", search);
    params.set("limit", "50");
    const res = await apiFetch<any>(`/products?${params}`).catch(() => ({ data: [] }));
    setProducts(res.data || (Array.isArray(res) ? res : []));
  }, [branchId, selectedCategory, search]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const addToCart = (product: Product) => {
    const sp = product.storeProducts?.[0];
    if (!sp) return;
    const variant = sp.productVariant?.attributes?.map((a) => a.attributeValue.value).join(", ");
    setCart((prev) => {
      const existing = prev.find((i) => i.storeProductId === sp.id);
      if (existing)
        return prev.map((i) =>
          i.storeProductId === sp.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      return [
        ...prev,
        {
          storeProductId: sp.id,
          name: product.name,
          image: product.images?.[0]?.url || "",
          price: Number(sp.sellingPrice),
          quantity: 1,
          variant,
        },
      ];
    });
    setMobileTab("cart");
  };

  const updateQty = (id: number, qty: number) => {
    if (qty <= 0) setCart((prev) => prev.filter((i) => i.storeProductId !== id));
    else setCart((prev) => prev.map((i) => (i.storeProductId === id ? { ...i, quantity: qty } : i)));
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const grandTotal = subtotal - discount;
  const received = Number(receivedAmount) || 0;
  const change = Math.max(0, received - grandTotal);
  const due = Math.max(0, grandTotal - received);

  const handleComplete = async (status: string = "COMPLETED") => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const sale = await apiFetch<any>("/sales", {
        method: "POST",
        body: JSON.stringify({
          customerId: customer?.id || null,
          branchId,
          items: cart.map((i) => ({
            storeProductId: i.storeProductId,
            quantity: i.quantity,
            unitPrice: i.price,
          })),
          discount,
          paymentMethod,
          status,
          totalAmount: subtotal,
          grandTotal,
          paidAmount: status === "PAY_LATER" ? 0 : received,
          changeAmount: change,
          dueAmount: status === "PAY_LATER" ? grandTotal : due,
        }),
      });
      setLastSale(sale);
      setConfirmModal(false);
      if (status === "COMPLETED") {
        setReceiptModal(true);
      } else {
        setCart([]);
        setCustomer(null);
        setReceivedAmount("");
        alert("Saved as Pay Later");
      }
    } catch (err: any) {
      alert(err.message);
    }
    setLoading(false);
  };

  const handleDone = () => {
    setReceiptModal(false);
    setCart([]);
    setCustomer(null);
    setReceivedAmount("");
    setDiscount(0);
    setLastSale(null);
  };

  const searchCustomers = async () => {
    if (!customerSearch.trim()) return;
    const res = await apiFetch<any>(`/customers?search=${customerSearch}&limit=10`).catch(() => ({
      data: [],
    }));
    setCustomerResults(res.data || (Array.isArray(res) ? res : []));
  };

  const CategorySidebar = () => (
    <>
      <h3 className="font-semibold text-sm mb-2">Categories</h3>
      <button
        onClick={() => setSelectedCategory(null)}
        className={`w-full text-left px-3 py-2 text-sm rounded-lg mb-1 transition-colors ${
          !selectedCategory ? "bg-primary text-white" : "hover:bg-muted"
        }`}
      >
        All
      </button>
      {categories.map((c) => (
        <button
          key={c.id}
          onClick={() => {
            setSelectedCategory(c.id);
            setMobileTab("products");
          }}
          className={`w-full text-left px-3 py-2 text-sm rounded-lg mb-1 transition-colors ${
            selectedCategory === c.id ? "bg-primary text-white" : "hover:bg-muted"
          }`}
        >
          {c.name}
        </button>
      ))}
    </>
  );

  const ProductGrid = () => (
    <>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <Input
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {products.map((p) => (
          <button
            key={p.id}
            onClick={() => addToCart(p)}
            className="bg-white border border-border rounded-lg p-2 hover:shadow-md hover:border-primary/30 transition-all text-left"
          >
            <div className="relative aspect-square bg-muted rounded-lg mb-2 overflow-hidden">
              {p.images?.[0]?.url && (
                <Image
                  src={p.images[0].url}
                  alt={p.name}
                  fill
                  className="object-contain p-1"
                  unoptimized
                />
              )}
            </div>
            <p className="text-xs font-medium line-clamp-2">{p.name}</p>
            <p className="text-sm font-bold text-primary mt-1">
              {formatPrice(Number(p.storeProducts?.[0]?.sellingPrice || 0))}
            </p>
          </button>
        ))}
        {products.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-400 text-sm">
            No products found
          </div>
        )}
      </div>
    </>
  );

  const CartPanel = () => (
    <>
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User size={16} className="text-gray-500" />
            <span className="text-sm font-medium">
              {customer ? customer.name : "Walking Customer"}
            </span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setCustomerModal(true)}>
            <Plus size={14} />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {cart.length === 0 && (
          <p className="text-center text-sm text-gray-400 py-8">No items in cart</p>
        )}
        {cart.map((item) => (
          <div
            key={item.storeProductId}
            className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg"
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{item.name}</p>
              {item.variant && <p className="text-[10px] text-gray-500">{item.variant}</p>}
              <p className="text-xs font-bold text-primary">
                {formatPrice(item.price * item.quantity)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => updateQty(item.storeProductId, item.quantity - 1)}
                className="w-6 h-6 flex items-center justify-center bg-white rounded border border-border"
              >
                <Minus size={12} />
              </button>
              <span className="text-xs w-6 text-center">{item.quantity}</span>
              <button
                onClick={() => updateQty(item.storeProductId, item.quantity + 1)}
                className="w-6 h-6 flex items-center justify-center bg-white rounded border border-border"
              >
                <Plus size={12} />
              </button>
              <button
                onClick={() => updateQty(item.storeProductId, 0)}
                className="w-6 h-6 flex items-center justify-center text-red-500"
              >
                <Trash2 size={12} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-border space-y-2">
        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span>{formatPrice(subtotal)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm shrink-0">Discount</span>
          <Input
            type="number"
            value={discount || ""}
            onChange={(e) => setDiscount(Number(e.target.value))}
            className="h-8 text-sm flex-1"
            placeholder="0"
          />
        </div>
        <div className="flex justify-between font-bold">
          <span>Total</span>
          <span className="text-primary">{formatPrice(grandTotal)}</span>
        </div>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value)}
          className="w-full h-9 px-3 text-sm border border-border rounded-lg bg-background"
        >
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="mobile_banking">Mobile Banking</option>
        </select>
        <Input
          type="number"
          placeholder="Received Amount"
          value={receivedAmount}
          onChange={(e) => setReceivedAmount(e.target.value)}
          className="h-9"
        />
        {received > 0 && (
          <div className="flex justify-between text-sm text-green-600">
            <span>Change</span>
            <span>{formatPrice(change)}</span>
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => handleComplete("PAY_LATER")}
            disabled={cart.length === 0 || loading}
          >
            Pay Later
          </Button>
          <Button
            className="flex-1"
            onClick={() => setConfirmModal(true)}
            disabled={cart.length === 0 || loading}
          >
            Complete Order
          </Button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] -m-4 md:-m-6">
      {/* Mobile tab bar */}
      <div className="flex lg:hidden border-b border-border bg-white">
        {(["categories", "products", "cart"] as MobileTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setMobileTab(tab)}
            className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors ${
              mobileTab === tab
                ? "text-primary border-b-2 border-primary"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
            {tab === "cart" && cart.length > 0 && (
              <span className="ml-1 bg-primary text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {cart.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left - Categories (desktop) */}
        <div className="hidden lg:block w-48 shrink-0 bg-white border-r border-border p-3 overflow-y-auto">
          <CategorySidebar />
        </div>

        {/* Mobile: conditional panels */}
        <div className="lg:hidden flex-1 overflow-y-auto">
          {mobileTab === "categories" && (
            <div className="p-3">
              <CategorySidebar />
            </div>
          )}
          {mobileTab === "products" && (
            <div className="p-3">
              <ProductGrid />
            </div>
          )}
          {mobileTab === "cart" && (
            <div className="flex flex-col h-full">
              <CartPanel />
            </div>
          )}
        </div>

        {/* Center - Products (desktop) */}
        <div className="hidden lg:block flex-1 p-3 overflow-y-auto">
          <ProductGrid />
        </div>

        {/* Right - Cart & Payment (desktop) */}
        <div className="hidden lg:flex w-80 shrink-0 bg-white border-l border-border flex-col">
          <CartPanel />
        </div>
      </div>

      {/* Confirm Modal */}
      <Modal
        open={confirmModal}
        onOpenChange={setConfirmModal}
        title="Confirm Order"
        className="max-w-lg"
      >
        <div className="space-y-3">
          <p className="text-sm">
            <strong>Customer:</strong> {customer?.name || "Walking Customer"}
          </p>
          <div className="border border-border rounded-lg divide-y divide-border">
            {cart.map((i) => (
              <div
                key={i.storeProductId}
                className="flex justify-between px-3 py-2 text-sm"
              >
                <span>
                  {i.name} x{i.quantity}
                </span>
                <span className="font-medium">{formatPrice(i.price * i.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <StatCard title="Total" value={formatPrice(grandTotal)} icon={User} />
            <StatCard title="Received" value={formatPrice(received)} icon={User} />
            <StatCard title="Change" value={formatPrice(change)} icon={User} />
            <StatCard title="Due" value={formatPrice(due)} icon={User} />
          </div>
          <Button
            className="w-full"
            onClick={() => handleComplete("COMPLETED")}
            disabled={loading}
          >
            {loading ? "Processing..." : "Confirm Order"}
          </Button>
        </div>
      </Modal>

      {/* Receipt Modal */}
      <Modal open={receiptModal} onOpenChange={setReceiptModal} title="Sale Complete">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-2xl text-green-600">✓</span>
          </div>
          <p className="font-semibold">Invoice: {lastSale?.invoiceNumber}</p>
          <p className="text-sm text-gray-500">
            Total: {formatPrice(lastSale?.grandTotal || 0)}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => window.print()}>
              <Printer size={16} className="mr-1" />
              Print
            </Button>
            <Button className="flex-1" onClick={handleDone}>
              Done
            </Button>
          </div>
        </div>
      </Modal>

      {/* Customer Search Modal */}
      <Modal open={customerModal} onOpenChange={setCustomerModal} title="Select Customer">
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Search by name or phone..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchCustomers()}
            />
            <Button onClick={searchCustomers}>Search</Button>
          </div>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {customerResults.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setCustomer(c);
                  setCustomerModal(false);
                }}
                className="w-full text-left p-3 border border-border rounded-lg hover:border-primary transition-colors"
              >
                <p className="font-medium text-sm">{c.name}</p>
                <p className="text-xs text-gray-500">{c.phone}</p>
              </button>
            ))}
          </div>
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => {
              setCustomer(null);
              setCustomerModal(false);
            }}
          >
            Use Walking Customer
          </Button>
        </div>
      </Modal>
    </div>
  );
}
