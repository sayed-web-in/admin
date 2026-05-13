"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Percent, Wrench, Clock, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { DiscountModal } from "@/components/sales/pos/DiscountModal";
import { ServiceModal } from "@/components/sales/pos/ServiceModal";
import { CartItemsSection } from "@/components/sales/pos/CartItemsSection";
import { EditUnitPriceModal } from "@/components/sales/pos/EditUnitPriceModal";
import { CustomerPopover, type POSCustomer } from "@/components/sales/pos/CustomerPopover";
import { CompleteOrderModal } from "@/components/sales/pos/CompleteOrderModal";
import { PayLaterModal } from "@/components/sales/pos/PayLaterModal";

interface PosItem {
  storeProductId: number;
  name: string;
  image: string;
  price: number;
  quantity: number;
  variant?: string;
  serialNumbers?: string[];
  batchNumber?: string;
  batchNumbers?: string[];
  serialBatchMap?: Record<string, string>;
}

interface OrderSectionProps {
  branchId: number | null;
  customer: POSCustomer | null;
  cart: PosItem[];
  subtotal: number;
  servicesTotal: number;
  grandTotal: number;
  discount: number;
  loading: boolean;
  appliedServices: { id: number; name: string; price: number }[];
  onSelectCustomer: (customer: POSCustomer) => void;
  onClearCustomer: () => void;
  onUpdateQty: (id: number, qty: number) => void;
  onSetDiscount: (value: number) => void;
  onAddService: (service: { id: number; name: string; price: number }) => void;
  onRemoveService: (serviceId: number) => void;
  onPayLater: (opts: { note: string; advanceApplied?: number }) => Promise<void>;
  onComplete: (opts: {
    paymentMethod: string;
    receivedAmount: number;
    payments?: Array<{ id: string; accountId: string; amount: number | "" }>;
    note: string;
    advanceApplied?: number;
  }) => Promise<boolean>;
  onEditUnitPrice: (id: number, price: number) => void;
  /** When POS order panel is shown in a mobile bottom sheet (seller-admin style), close it after pay / complete. */
  onCloseMobileSheet?: () => void;
}

export function OrderSection({
  branchId,
  customer,
  cart,
  subtotal,
  servicesTotal,
  grandTotal,
  discount,
  loading,
  appliedServices,
  onSelectCustomer,
  onClearCustomer,
  onUpdateQty,
  onSetDiscount,
  onAddService,
  onRemoveService,
  onPayLater,
  onComplete,
  onEditUnitPrice,
  onCloseMobileSheet,
}: OrderSectionProps) {
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountInput, setDiscountInput] = useState<string>("");
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showPayLaterModal, setShowPayLaterModal] = useState(false);
  const [servicesLoading, setServicesLoading] = useState(false);
  const [services, setServices] = useState<Array<{ id: number; name: string; price: number }>>([]);
  const [priceEditItem, setPriceEditItem] = useState<PosItem | null>(null);
  const [priceInput, setPriceInput] = useState<string>("");

  useEffect(() => {
    if (!showServiceModal || !branchId) return;
    const load = async () => {
      setServicesLoading(true);
      try {
        const res = await apiFetch<{ data?: Array<{ id: number | string; name: string; price: number | string }> } | Array<{ id: number | string; name: string; price: number | string }>>(
          `/services?branchId=${branchId}`
        );
        const list = Array.isArray(res) ? res : res.data || [];
        setServices(
          (Array.isArray(list) ? list : []).map((s) => ({
            id: Number(s.id),
            name: String(s.name ?? ""),
            price: Number(s.price ?? 0),
          }))
        );
      } catch {
        setServices([]);
      } finally {
        setServicesLoading(false);
      }
    };
    void load();
  }, [showServiceModal, branchId]);

  const quickActionBtn =
    "flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 rounded-lg text-[10px] sm:text-xs font-medium py-2 px-1 sm:px-2.5 border transition-colors bg-slate-100 border-slate-200 text-slate-900 hover:bg-slate-200 hover:border-slate-300";

  return (
    <div className="h-full min-h-0 flex flex-col relative overflow-hidden max-h-full">
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 pb-2 space-y-3 relative min-h-0">
        <CustomerPopover
          branchId={branchId}
          customer={customer}
          onSelect={onSelectCustomer}
          onClear={onClearCustomer}
        />

        <CartItemsSection
          cart={cart}
          onUpdateQty={onUpdateQty}
          onEditPrice={(item) => {
            setPriceEditItem(item);
            setPriceInput(String(item.price || ""));
          }}
        />

        <div className="p-4 mb-3 rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Payments Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-medium text-slate-900">{formatPrice(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Discount</span>
                <span className="font-medium text-amber-600">-{formatPrice(discount)}</span>
              </div>
            )}
            {servicesTotal > 0 && (
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Service</span>
                <span className="font-medium text-slate-900">{formatPrice(servicesTotal)}</span>
              </div>
            )}
            <div className="pt-2 mt-2 border-t border-slate-200 flex justify-between items-center">
              <span className="font-bold text-slate-900">Grand Total</span>
              <span className="text-lg font-bold text-primary">{formatPrice(grandTotal)}</span>
            </div>
          </div>
        </div>
        {appliedServices.length > 0 && (
          <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-2">
            <p className="text-xs font-semibold text-slate-700">Applied Services</p>
            {appliedServices.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-700 truncate">{s.name}</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">{formatPrice(s.price)}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveService(s.id)}
                    className="text-red-500 hover:text-red-600"
                    aria-label="Remove service"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-slate-200 bg-slate-50/98 backdrop-blur-sm shadow-[0_-4px_12px_rgba(0,0,0,0.05)] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="p-3 pt-2 space-y-2">
          <div className="grid grid-cols-2 gap-1.5">
            <button type="button" className={quickActionBtn} title="Discount" onClick={() => {
              setDiscountInput(discount > 0 ? String(discount) : "");
              setShowDiscountModal(true);
            }}>
              <Percent className="w-3.5 h-3.5 shrink-0" />
              <span className="leading-tight text-center sm:inline">Discount</span>
            </button>
            <button type="button" className={quickActionBtn} title="Service" onClick={() => setShowServiceModal(true)}>
              <Wrench className="w-3.5 h-3.5 shrink-0" />
              <span className="leading-tight text-center sm:inline">Service</span>
            </button>
          </div>

          <div className="flex gap-2">
            {customer && (
              <button
                type="button"
                onClick={() => setShowPayLaterModal(true)}
                disabled={loading || cart.length === 0}
                className="flex-1 flex items-center justify-center gap-2 py-3 min-h-[48px] text-sm sm:text-base font-semibold rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Clock className="w-5 h-5 shrink-0" />
                Pay Later
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowCompleteModal(true)}
              disabled={loading || cart.length === 0}
              className={`flex min-h-[48px] items-center justify-center gap-2 rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 sm:text-base ${customer ? "flex-1" : "w-full"}`}
            >
              <CheckCircle className="w-5 h-5 shrink-0" />
              <span className="sm:hidden">Complete</span>
              <span className="hidden sm:inline">Complete Order</span>
            </button>
          </div>
        </div>
      </div>

      <DiscountModal
        open={showDiscountModal}
        value={discountInput}
        onValueChange={setDiscountInput}
        onOpenChange={setShowDiscountModal}
        onApply={() => {
          const value = Number(discountInput) || 0;
          onSetDiscount(value < 0 ? 0 : value);
          setShowDiscountModal(false);
        }}
      />

      <ServiceModal
        open={showServiceModal}
        loading={servicesLoading}
        services={services}
        onOpenChange={setShowServiceModal}
        onSelect={(service) => {
          onAddService(service);
          setShowServiceModal(false);
        }}
      />

      <CompleteOrderModal
        open={showCompleteModal}
        customer={customer}
        cart={cart}
        subtotal={subtotal}
        discount={discount}
        servicesTotal={servicesTotal}
        grandTotal={grandTotal}
        appliedServices={appliedServices}
        branchId={branchId}
        loading={loading}
        onOpenChange={setShowCompleteModal}
        onConfirm={async (opts) => {
          const ok = await onComplete(opts);
          if (ok) {
            setShowCompleteModal(false);
            onCloseMobileSheet?.();
          }
        }}
      />

      <PayLaterModal
        open={showPayLaterModal}
        customer={customer}
        cart={cart}
        subtotal={subtotal}
        discount={discount}
        servicesTotal={servicesTotal}
        grandTotal={grandTotal}
        appliedServices={appliedServices}
        loading={loading}
        onOpenChange={setShowPayLaterModal}
        onConfirm={async (opts) => {
          await onPayLater(opts);
          setShowPayLaterModal(false);
          onCloseMobileSheet?.();
        }}
      />

      <EditUnitPriceModal
        open={!!priceEditItem}
        item={priceEditItem}
        priceInput={priceInput}
        onPriceInputChange={setPriceInput}
        onOpenChange={(open) => {
          if (!open) {
            setPriceEditItem(null);
            setPriceInput("");
          }
        }}
        onSave={() => {
          const parsed = parseFloat(priceInput.replace(/,/g, ""));
          if (isNaN(parsed) || parsed < 0 || !priceEditItem) return;
          onEditUnitPrice(priceEditItem.storeProductId, parsed);
          setPriceEditItem(null);
          setPriceInput("");
        }}
      />
    </div>
  );
}
