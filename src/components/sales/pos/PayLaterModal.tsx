"use client";

import { useState } from "react";
import { AlertCircle, Clock, Package, User, Phone } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { formatPrice } from "@/lib/utils";
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

interface PayLaterModalProps {
  open: boolean;
  customer: POSCustomer | null;
  cart: PosItem[];
  subtotal: number;
  discount: number;
  servicesTotal: number;
  grandTotal: number;
  appliedServices: PosService[];
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (note: string) => Promise<void>;
}

export function PayLaterModal({
  open,
  customer,
  cart,
  subtotal,
  discount,
  servicesTotal,
  grandTotal,
  appliedServices,
  loading,
  onOpenChange,
  onConfirm,
}: PayLaterModalProps) {
  const [note, setNote] = useState("");

  const handleSubmit = async () => {
    await onConfirm(note);
    setNote("");
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Save for Pay Later"
      icon={<Clock className="w-5 h-5" />}
      size="md"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={loading || cart.length === 0}
            className="bg-amber-600 hover:bg-amber-500"
          >
            {loading ? "Saving..." : "Save Pay Later"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Info alert */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-700 mb-1">No changes will be made now</p>
            <p className="text-xs text-amber-600">
              Stock will not reduce and no transaction will be created.
              Payment and order will be processed when customer pays.
            </p>
          </div>
        </div>

        {/* Customer info */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Customer</p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-indigo-600" />
              <span className="text-sm font-semibold text-slate-900">
                {customer?.name ?? "Walk-in Customer"}
              </span>
            </div>
            {customer?.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-slate-500" />
                <span className="text-sm text-slate-600">{customer.phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Cart items */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
            Products ({cart.length})
          </p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {cart.map((item) => (
              <div
                key={item.storeProductId}
                className="flex items-center justify-between gap-2 py-2 border-b border-slate-200 last:border-0"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <Package className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                    {item.variant && (
                      <p className="text-xs text-slate-500">{item.variant}</p>
                    )}
                    <p className="text-xs text-slate-500">×{item.quantity}</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-slate-900 shrink-0">
                  {formatPrice(item.price * item.quantity)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        {(discount > 0 || servicesTotal > 0) && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal</span>
              <span className="text-slate-900">{formatPrice(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600">Discount</span>
                <span className="text-amber-600">-{formatPrice(discount)}</span>
              </div>
            )}
            {servicesTotal > 0 && (
              <div className="flex justify-between">
                <span className="text-slate-600">Services ({appliedServices.length})</span>
                <span className="text-slate-900">{formatPrice(servicesTotal)}</span>
              </div>
            )}
          </div>
        )}

        {/* Grand Total */}
        <div className="flex items-center justify-between p-4 rounded-xl border border-indigo-200 bg-indigo-50">
          <div>
            <p className="text-sm font-semibold text-indigo-700">Total Amount</p>
            {subtotal !== grandTotal && (
              <p className="text-xs text-slate-400 line-through">{formatPrice(subtotal)}</p>
            )}
          </div>
          <span className="text-lg font-bold text-indigo-600">{formatPrice(grandTotal)}</span>
        </div>

        {/* Note */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">
            Note (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note for this pay later order..."
            rows={2}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
    </Modal>
  );
}
