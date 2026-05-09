/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
"use client";
import { useState, useEffect, useCallback } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/common/Modal";
import { apiFetch } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";
import { toast } from "sonner";
import { POSCategorySidebar } from "@/components/sales/pos/CategorySidebar";
import { ProductSection } from "@/components/sales/pos/ProductSection";
import type { POSProduct } from "@/components/sales/pos/ProductCard";
import { OrderSection } from "@/components/sales/pos/OrderSection";
import type { POSCustomer } from "@/components/sales/pos/CustomerPopover";
import { InvoicePreviewModal } from "@/components/sales/pos/InvoicePreviewModal";

interface PosItem {
  storeProductId: number;
  name: string;
  image: string;
  price: number;
  quantity: number;
  stockAvailable: number;
  variant?: string;
  serialNumbers?: string[];
  batchNumber?: string;
  batchNumbers?: string[];
  serialBatchMap?: Record<string, string>;
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
  const [invoicePreviewOpen, setInvoicePreviewOpen] = useState(false);
  const [invoicePreviewData, setInvoicePreviewData] = useState<any>(null);
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

  const applySoldStockToProducts = (soldItems: Array<{ storeProductId: number; quantity: number }>) => {
    if (!Array.isArray(soldItems) || soldItems.length === 0) return;
    const soldMap = new Map<number, number>();
    for (const item of soldItems) {
      const qty = Number(item.quantity || 0);
      if (qty <= 0) continue;
      soldMap.set(item.storeProductId, (soldMap.get(item.storeProductId) || 0) + qty);
    }
    if (soldMap.size === 0) return;

    setProducts((prev) =>
      prev.map((product) => ({
        ...product,
        storeProducts: (product.storeProducts || []).map((sp) => {
          const soldQty = soldMap.get(sp.id) || 0;
          if (soldQty <= 0) return sp;
          return {
            ...sp,
            quantity: Math.max(0, Number(sp.quantity || 0) - soldQty),
          };
        }),
      }))
    );
  };

  const addToCart = (
    product: POSProduct,
    storeProductId?: number,
    serialNumbers?: string[],
    meta?: { batchNumber?: string; batchNumbers?: string[]; serialBatchMap?: Record<string, string> }
  ) => {
    const sp = storeProductId
      ? product.storeProducts?.find((s) => s.id === storeProductId)
      : product.storeProducts?.[0];
    if (!sp) return;
    const stockAvailable = Number(sp.quantity || 0);
    if (stockAvailable <= 0) return;
    const discountType = String(sp.discountType || "").toLowerCase();
    const discountValue = Number(sp.discountValue || 0);
    let effectiveUnitPrice = Number(sp.sellingPrice || 0);
    if (discountType === "percentage" && discountValue > 0) {
      effectiveUnitPrice = effectiveUnitPrice - (effectiveUnitPrice * discountValue) / 100;
    } else if (discountType === "fixed" && discountValue > 0) {
      effectiveUnitPrice = effectiveUnitPrice - discountValue;
    }
    effectiveUnitPrice = Math.max(0, effectiveUnitPrice);
    const variant = sp.productVariant?.attributes
      ?.map((a) => a?.attributeValue?.value)
      .filter((v): v is string => Boolean(v && v.trim()))
      .join(", ");
    const normalizedSerials = Array.isArray(serialNumbers)
      ? Array.from(new Set(serialNumbers.map((s) => String(s).trim()).filter(Boolean)))
      : [];
    const isImeiProduct = Boolean(product.hasImei);
    setCart((prev) => {
      const existing = prev.find((i) => i.storeProductId === sp.id);
      if (existing) {
        if (isImeiProduct) {
          const mergedSerials = Array.from(
            new Set([...(existing.serialNumbers || []), ...normalizedSerials])
          );
          const cappedQty = Math.min(mergedSerials.length, existing.stockAvailable || stockAvailable);
          return prev.map((i) =>
            i.storeProductId === sp.id
              ? {
                  ...i,
                  serialNumbers: mergedSerials.slice(0, cappedQty),
                  quantity: cappedQty,
                  stockAvailable: stockAvailable || i.stockAvailable,
                  batchNumber: meta?.batchNumber ?? i.batchNumber,
                  batchNumbers: meta?.batchNumbers ?? i.batchNumbers,
                  serialBatchMap: {
                    ...(i.serialBatchMap || {}),
                    ...(meta?.serialBatchMap || {}),
                  },
                }
              : i
          );
        }
        return prev.map((i) =>
          i.storeProductId === sp.id
            ? {
                ...i,
                quantity: Math.min(i.quantity + 1, i.stockAvailable || stockAvailable),
                stockAvailable: stockAvailable || i.stockAvailable,
                batchNumber: meta?.batchNumber ?? i.batchNumber,
                batchNumbers: meta?.batchNumber
                  ? [...(i.batchNumbers ?? []), meta.batchNumber]
                  : i.batchNumbers,
              }
            : i
        );
      }

      const initialQuantity = isImeiProduct
        ? normalizedSerials.length
        : 1;
      const safeInitialQuantity = Math.min(initialQuantity, stockAvailable);
      if (safeInitialQuantity <= 0) return prev;
      return [
        ...prev,
        {
          storeProductId: sp.id,
          name: product.name,
          image: sp.productVariant?.image || product.images?.[0]?.url || "",
          price: effectiveUnitPrice,
          quantity: safeInitialQuantity,
          stockAvailable,
          variant,
          serialNumbers: isImeiProduct ? normalizedSerials.slice(0, safeInitialQuantity) : undefined,
          batchNumber: meta?.batchNumber,
          batchNumbers: meta?.batchNumbers,
          serialBatchMap: meta?.serialBatchMap,
        },
      ];
    });
    setMobileTab("cart");
    if (isImeiProduct) {
      toast.success(
        normalizedSerials.length > 0
          ? `${normalizedSerials.length} IMEI added to cart`
          : "Added to cart"
      );
    } else {
      toast.success("Added to cart");
    }
  };

  const updateQty = (id: number, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.storeProductId !== id));
      return;
    }
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.storeProductId !== id) return i;
          const cappedQty = Math.min(qty, Math.max(0, i.stockAvailable || 0));
          if (cappedQty <= 0)
            return { ...i, quantity: 0, serialNumbers: i.serialNumbers ? [] : undefined };
          if (i.serialNumbers && i.serialNumbers.length > 0) {
            if (cappedQty > i.quantity) return i;
            const nextSerials = i.serialNumbers.slice(0, cappedQty);
            return { ...i, quantity: nextSerials.length, serialNumbers: nextSerials };
          }
          return { ...i, quantity: cappedQty };
        })
        .filter((i) => i.quantity > 0)
    );
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

  const handleComplete = async (opts: {
    paymentMethod: string;
    receivedAmount: number;
    payments?: Array<{ id: string; accountId: string; amount: number | "" }>;
    note: string;
    advanceApplied?: number;
  }): Promise<boolean> => {
    if (cart.length === 0) return false;
    const advanceApplied = Math.max(0, Number(opts.advanceApplied || 0));
    if (!customer && advanceApplied > 0) {
      toast.error("Advance can only be used for a registered customer.");
      return false;
    }
    const totalPaid = Number(opts.receivedAmount || 0) + advanceApplied;
    if (!customer && totalPaid < grandTotal) {
      toast.error("Walking customer due sale is not allowed. Please pay full amount.");
      return false;
    }
    setLoading(true);
    const paidAmt = opts.receivedAmount;
    const changeAmt = Math.max(0, totalPaid - grandTotal);
    const dueAmt = Math.max(0, grandTotal - totalPaid);
    const primaryPaymentRow = (opts.payments || []).find(
      (p) => p.accountId && Number(p.amount || 0) > 0
    );
    const paymentAccountId = primaryPaymentRow?.accountId
      ? Number(primaryPaymentRow.accountId)
      : undefined;
    try {
      let previousDue = 0;
      if (customer?.id) {
        const customerRes = await apiFetch<any>(`/customers/${customer.id}`).catch(() => null);
        const customerData =
          customerRes && typeof customerRes === "object" && "data" in customerRes
            ? (customerRes as { data?: { totalDue?: number } }).data
            : (customerRes as { totalDue?: number } | null);
        previousDue = Number(customerData?.totalDue || 0);
      }

      const sale = await apiFetch<any>("/sales", {
        method: "POST",
        body: JSON.stringify({
          customerId: customer?.id || null,
          branchId,
          items: cart.map((i) => ({
            storeProductId: i.storeProductId,
            quantity: i.quantity,
            unitPrice: i.price,
            serialNumbers: i.serialNumbers,
          })),
          discount,
          paymentMethod: opts.paymentMethod,
          paymentAccountId,
          payments: (opts.payments || [])
            .filter((p) => p.accountId && Number(p.amount || 0) > 0)
            .map((p) => ({
              accountId: Number(p.accountId),
              amount: Number(p.amount || 0),
            })),
          serviceIds: appliedServices.map((s) => s.id),
          servicesTotal,
          status: "COMPLETED",
          totalAmount: subtotal,
          grandTotal,
          paidAmount: paidAmt,
          changeAmount: changeAmt,
          dueAmount: dueAmt,
          advanceApplied: advanceApplied > 0 ? advanceApplied : undefined,
          note: opts.note || undefined,
        }),
      });
      applySoldStockToProducts(
        cart.map((i) => ({
          storeProductId: i.storeProductId,
          quantity: i.quantity,
        }))
      );
      const invoicePayload = {
        invoiceNo: sale?.invoiceNumber || "",
        orderNo: sale?.invoiceNumber || "",
        date: sale?.createdAt || new Date().toISOString(),
        branchName: sale?.branch?.name || "",
        customerName: sale?.customer?.name || customer?.name || "Walk-in Customer",
        customerPhone: sale?.customer?.phone || customer?.phone || "",
        items: Array.isArray(sale?.items)
          ? sale.items.map((it: any) => ({
              productName: it?.storeProduct?.product?.name || "Unknown Product",
              sku: it?.storeProduct?.productVariant?.sku || it?.storeProduct?.product?.sku || "N/A",
              quantity: Number(it?.quantity || 0),
              unitPrice: Number(it?.unitPrice || 0),
              total: Number(it?.total || Number(it?.unitPrice || 0) * Number(it?.quantity || 0)),
              serialNumbers: Array.isArray(it?.serialNumbers)
                ? it.serialNumbers.map((s: any) => String(s?.serial || s?.serialNumber || s))
                : [],
              attributeValues: Array.isArray(it?.storeProduct?.productVariant?.attributes)
                ? it.storeProduct.productVariant.attributes
                    .map((a: any) => a?.attributeValue?.value)
                    .filter(Boolean)
                : [],
            }))
          : cart.map((i) => ({
              productName: i.name,
              sku: "",
              quantity: i.quantity,
              unitPrice: i.price,
              total: i.quantity * i.price,
              serialNumbers: i.serialNumbers || [],
            })),
        subtotal,
        discountAmount: discount,
        taxAmount: 0,
        shippingCost: 0,
        grandTotal,
        paidAmount: Math.min(grandTotal, totalPaid),
        advanceApplied,
        receivedAmount: paidAmt,
        changeAmount: changeAmt,
        dueAmount: dueAmt,
        previousDue,
        paymentStatus: dueAmt > 0 ? "partial" : "paid",
        paymentMethod: opts.paymentMethod,
      };
      setLastSale(sale);
      setInvoicePreviewData(invoicePayload);
      setInvoicePreviewOpen(true);
      return true;
    } catch (err: any) {
      toast.error(err?.message || "Failed to complete order");
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handlePayLater = async (opts: { note: string; advanceApplied?: number }) => {
    if (cart.length === 0) return;
    const advanceApplied = Math.max(0, Number(opts.advanceApplied || 0));
    if (advanceApplied > 0 && !customer?.id) {
      toast.error("Advance requires a registered customer.");
      return;
    }
    setLoading(true);
    try {
      const totalPaid = advanceApplied;
      const dueAmt = Math.max(0, grandTotal - totalPaid);
      const paidAmt = Math.min(grandTotal, totalPaid);
      await apiFetch<any>("/sales", {
        method: "POST",
        body: JSON.stringify({
          customerId: customer?.id || null,
          branchId,
          items: cart.map((i) => ({
            storeProductId: i.storeProductId,
            quantity: i.quantity,
            unitPrice: i.price,
            serialNumbers: i.serialNumbers,
          })),
          discount,
          paymentMethod: "cash",
          serviceIds: appliedServices.map((s) => s.id),
          servicesTotal,
          status: "PAY_LATER",
          totalAmount: subtotal,
          grandTotal,
          paidAmount: paidAmt,
          changeAmount: 0,
          dueAmount: dueAmt,
          advanceApplied: advanceApplied > 0 ? advanceApplied : undefined,
          note: opts.note || undefined,
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
    setInvoicePreviewOpen(false);
    setInvoicePreviewData(null);
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
                cart={cart}
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
            cart={cart}
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

      <InvoicePreviewModal
        open={invoicePreviewOpen}
        invoiceData={invoicePreviewData}
        onOpenChange={(open) => {
          if (!open) handleDone();
          else setInvoicePreviewOpen(true);
        }}
      />

    </div>
  );
}
