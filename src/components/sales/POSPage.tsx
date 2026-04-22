/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
"use client";
import { useState, useEffect, useCallback } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/common/Modal";
import { apiFetch } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";
import { POSCategorySidebar } from "@/components/sales/pos/CategorySidebar";
import { ProductSection } from "@/components/sales/pos/ProductSection";
import type { POSProduct } from "@/components/sales/pos/ProductCard";
import { OrderSection } from "@/components/sales/pos/OrderSection";
import type { POSCustomer } from "@/components/sales/pos/CustomerPopover";

interface PosItem {
  storeProductId: number;
  name: string;
  image: string;
  price: number;
  quantity: number;
  variant?: string;
}

interface PosService {
  id: number;
  name: string;
  price: number;
}

type MobileTab = "categories" | "products" | "cart";

export function POSPage() {
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [cart, setCart] = useState<PosItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState<POSCustomer | null>(null);
  const [discount, setDiscount] = useState(0);
  const [appliedServices, setAppliedServices] = useState<PosService[]>([]);
  const [receiptModal, setReceiptModal] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("products");
  const branchId = getSelectedBranch();

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

  const addToCart = (product: POSProduct, storeProductId?: number) => {
    const sp = storeProductId
      ? product.storeProducts?.find((s) => s.id === storeProductId)
      : product.storeProducts?.[0];
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

  const updateUnitPrice = (id: number, unitPrice: number) => {
    if (Number.isNaN(unitPrice) || unitPrice < 0) return;
    setCart((prev) =>
      prev.map((i) => (i.storeProductId === id ? { ...i, price: unitPrice } : i))
    );
  };

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const servicesTotal = appliedServices.reduce((sum, s) => sum + Number(s.price || 0), 0);
  const grandTotal = subtotal - discount + servicesTotal;

  const handleComplete = async (opts: { paymentMethod: string; receivedAmount: number; note: string }) => {
    if (cart.length === 0) return;
    setLoading(true);
    const paidAmt = opts.receivedAmount;
    const changeAmt = Math.max(0, paidAmt - grandTotal);
    const dueAmt = Math.max(0, grandTotal - paidAmt);
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
          paymentMethod: opts.paymentMethod,
          serviceIds: appliedServices.map((s) => s.id),
          servicesTotal,
          status: "COMPLETED",
          totalAmount: subtotal,
          grandTotal,
          paidAmount: paidAmt,
          changeAmount: changeAmt,
          dueAmount: dueAmt,
          note: opts.note || undefined,
        }),
      });
      setLastSale(sale);
      setReceiptModal(true);
    } catch (err: any) {
      alert(err.message);
    }
    setLoading(false);
  };

  const handlePayLater = async (note: string) => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      await apiFetch<any>("/sales", {
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
          paymentMethod: "cash",
          serviceIds: appliedServices.map((s) => s.id),
          servicesTotal,
          status: "PAY_LATER",
          totalAmount: subtotal,
          grandTotal,
          paidAmount: 0,
          changeAmount: 0,
          dueAmount: grandTotal,
          note: note || undefined,
        }),
      });
      setCart([]);
      setCustomer(null);
      setDiscount(0);
      setAppliedServices([]);
    } catch (err: any) {
      alert(err.message);
    }
    setLoading(false);
  };

  const handleDone = () => {
    setReceiptModal(false);
    setCart([]);
    setCustomer(null);
    setDiscount(0);
    setAppliedServices([]);
    setLastSale(null);
  };


  return (
    <div data-page="pos" className="overflow-hidden flex flex-col h-full min-h-0 flex-1 bg-slate-50">
      <div className="flex lg:hidden border-b border-slate-200 bg-white">
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

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-2 lg:gap-3 px-2 sm:px-4 lg:pl-2 lg:pr-6 py-2 overflow-hidden">
        <div className="hidden lg:flex lg:w-[8%] lg:min-w-0 lg:h-full lg:min-h-0 lg:flex-col overflow-hidden">
          <POSCategorySidebar
            branchId={branchId}
            selectedCategoryId={selectedCategory}
            onCategorySelect={(id) => setSelectedCategory(id)}
            variant="vertical"
          />
        </div>

        <div className="lg:hidden flex-1 overflow-y-auto min-h-0">
          {mobileTab === "categories" && (
            <div className="p-1">
              <POSCategorySidebar
                branchId={branchId}
                selectedCategoryId={selectedCategory}
                onCategorySelect={(id) => {
                  setSelectedCategory(id);
                  setMobileTab("products");
                }}
                variant="horizontal"
              />
            </div>
          )}
          {mobileTab === "products" && (
            <div className="p-1">
              <ProductSection
                products={products}
                search={search}
                onSearchChange={setSearch}
                onAddToCart={addToCart}
              />
            </div>
          )}
          {mobileTab === "cart" && (
            <div className="flex flex-col h-full">
              <OrderSection
                branchId={branchId}
                customer={customer}
                cart={cart}
                subtotal={subtotal}
                servicesTotal={servicesTotal}
                grandTotal={grandTotal}
                discount={discount}
                loading={loading}
                appliedServices={appliedServices}
                onSelectCustomer={(c) => setCustomer(c)}
                onClearCustomer={() => setCustomer(null)}
                onUpdateQty={updateQty}
                onSetDiscount={setDiscount}
                onAddService={(service) => {
                  setAppliedServices((prev) => {
                    if (prev.some((s) => s.id === service.id)) return prev;
                    return [...prev, service];
                  });
                }}
                onRemoveService={(serviceId) => {
                  setAppliedServices((prev) => prev.filter((s) => s.id !== serviceId));
                }}
                onPayLater={handlePayLater}
                onComplete={handleComplete}
                onEditUnitPrice={updateUnitPrice}
              />
            </div>
          )}
        </div>

        <div className="hidden lg:block flex-1 min-h-0 lg:w-[57%] lg:flex-shrink-0 overflow-hidden">
          <ProductSection
            products={products}
            search={search}
            onSearchChange={setSearch}
            onAddToCart={addToCart}
          />
        </div>

        <div className="hidden lg:flex lg:flex-col lg:w-[35%] lg:flex-shrink-0 h-full min-h-0 overflow-hidden bg-white border-l border-slate-200">
          <OrderSection
            branchId={branchId}
            customer={customer}
            cart={cart}
            subtotal={subtotal}
            servicesTotal={servicesTotal}
            grandTotal={grandTotal}
            discount={discount}
            loading={loading}
            appliedServices={appliedServices}
            onSelectCustomer={(c) => setCustomer(c)}
            onClearCustomer={() => setCustomer(null)}
            onUpdateQty={updateQty}
            onSetDiscount={setDiscount}
            onAddService={(service) => {
              setAppliedServices((prev) => {
                if (prev.some((s) => s.id === service.id)) return prev;
                return [...prev, service];
              });
            }}
            onRemoveService={(serviceId) => {
              setAppliedServices((prev) => prev.filter((s) => s.id !== serviceId));
            }}
            onPayLater={handlePayLater}
            onComplete={handleComplete}
            onEditUnitPrice={updateUnitPrice}
          />
        </div>
      </div>


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

    </div>
  );
}
