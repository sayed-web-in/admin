"use client";

import { useState, useEffect } from "react";
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
  onConfirm: (opts: { note: string; advanceApplied?: number }) => Promise<void>;
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
  const [advanceApplied, setAdvanceApplied] = useState(0);

  const customerAdvanceBalance =
    customer?.totalAdvance != null ? Number(customer.totalAdvance) || 0 : 0;

  const maxAdvanceApplicable =
    customer && customerAdvanceBalance > 0
      ? Math.min(customerAdvanceBalance, grandTotal)
      : 0;

  useEffect(() => {
    if (!open) return;
    setAdvanceApplied(0);
    setNote("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (advanceApplied > maxAdvanceApplicable) {
      setAdvanceApplied(maxAdvanceApplicable);
    }
  }, [open, maxAdvanceApplicable, advanceApplied]);

  const dueAfterAdvance = Math.max(0, grandTotal - advanceApplied);

  const handleSubmit = async () => {
    await onConfirm({
      note,
      advanceApplied: advanceApplied > 0 ? advanceApplied : undefined,
    });
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
            <p className="text-sm font-semibold text-amber-700 mb-1">Invoice saved with due</p>
            <p className="text-xs text-amber-600">
              The sale is saved with due amount. Stock is reserved/sold per system rules.
              Any advance you apply now reduces the customer wallet and the invoice due.
            </p>
          </div>
        </div>

        {/* Customer info */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Customer</p>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
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
        <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">Total Amount</p>
            {subtotal !== grandTotal && (
              <p className="text-xs text-slate-400 line-through">{formatPrice(subtotal)}</p>
            )}
          </div>
          <span className="text-lg font-bold text-primary">{formatPrice(grandTotal)}</span>
        </div>

        {customer && customerAdvanceBalance > 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                Apply customer advance
              </span>
              <span className="text-sm font-bold tabular-nums text-emerald-800">
                {formatPrice(customerAdvanceBalance)} avail.
              </span>
            </div>
            <p className="mt-1 text-[10px] text-emerald-800/80">
              Due after advance: {formatPrice(dueAfterAdvance)} (max apply {formatPrice(maxAdvanceApplicable)}).
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setAdvanceApplied(maxAdvanceApplicable)}
                disabled={maxAdvanceApplicable <= 0}
                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
              >
                Use full
              </button>
              <button
                type="button"
                onClick={() => setAdvanceApplied(0)}
                disabled={advanceApplied <= 0}
                className="rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-40"
              >
                Clear
              </button>
            </div>
            <label className="mt-2 block text-[10px] font-semibold text-emerald-800">Amount</label>
            <input
              type="number"
              min={0}
              max={maxAdvanceApplicable}
              step="0.01"
              value={advanceApplied || ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "") {
                  setAdvanceApplied(0);
                  return;
                }
                const num = parseFloat(v);
                if (!Number.isFinite(num) || num < 0) return;
                setAdvanceApplied(Math.min(num, maxAdvanceApplicable));
              }}
              className="mt-1 w-full h-8 rounded-lg border border-emerald-200 bg-white px-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        ) : null}

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
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>
    </Modal>
  );
}
