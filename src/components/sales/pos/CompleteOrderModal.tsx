"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle,
  Phone,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
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

interface AccountOption {
  id: string | number;
  name?: string;
  accountName?: string;
  accountType?: string;
  currentBalance?: number;
}

interface PaymentRow {
  id: string;
  accountId: string;
  amount: number | "";
}

interface CompleteOrderModalProps {
  open: boolean;
  customer: POSCustomer | null;
  cart: PosItem[];
  subtotal: number;
  discount: number;
  servicesTotal: number;
  grandTotal: number;
  appliedServices: PosService[];
  branchId: number | null;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (opts: {
    paymentMethod: string;
    receivedAmount: number;
    payments: PaymentRow[];
    note: string;
  }) => Promise<void>;
}

function getAccountLabel(a: AccountOption) {
  const name = a.accountName ?? a.name ?? String(a.id);
  const type = a.accountType ? ` (${a.accountType})` : "";
  const bal = typeof a.currentBalance === "number" ? ` - ${formatPrice(a.currentBalance)}` : "";
  return `${name}${type}${bal}`;
}

export function CompleteOrderModal({
  open,
  customer,
  cart,
  subtotal,
  discount,
  servicesTotal,
  grandTotal,
  appliedServices,
  branchId,
  loading,
  onOpenChange,
  onConfirm,
}: CompleteOrderModalProps) {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>([
    { id: "1", accountId: "", amount: "" },
  ]);
  const [note, setNote] = useState("");

  const totalReceived = paymentRows.reduce(
    (s, r) => s + (typeof r.amount === "number" ? r.amount : Number(r.amount) || 0),
    0
  );
  const change = Math.max(0, totalReceived - grandTotal);
  const due = Math.max(0, grandTotal - totalReceived);
  const paymentStatus = totalReceived >= grandTotal ? "paid" : totalReceived > 0 ? "partial" : "due";

  const statusBadge: Record<string, string> = {
    paid: "bg-emerald-100 text-emerald-700 border-emerald-300",
    partial: "bg-amber-100 text-amber-700 border-amber-300",
    due: "bg-red-100 text-red-700 border-red-300",
  };

  const fetchAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const res = await apiFetch<AccountOption[] | { data?: AccountOption[] }>("/accounts/selection");
      const list = Array.isArray(res) ? res : res.data || [];
      setAccounts(Array.isArray(list) ? list : []);
    } catch {
      setAccounts([]);
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchAccounts();
      setNote("");
      setPaymentRows([{ id: String(Date.now()), accountId: "", amount: "" }]);
    }
  }, [open, fetchAccounts]);

  const defaultCashId = useMemo(() => {
    const branchCash = accounts.find(
      (a) =>
        (a.accountType ?? "").toLowerCase() === "cash" &&
        String((a as Record<string, unknown>)?.branchId ?? "") === String(branchId)
    );
    if (branchCash) return String(branchCash.id);
    const any = accounts.find((a) => (a.accountType ?? "").toLowerCase() === "cash");
    return any ? String(any.id) : "";
  }, [accounts, branchId]);

  // Auto-fill first row with default cash account
  useEffect(() => {
    if (!open || !defaultCashId) return;
    setPaymentRows((prev) => {
      if (!prev.length) return prev;
      if (prev[0].accountId) return prev;
      return [{ ...prev[0], accountId: defaultCashId }, ...prev.slice(1)];
    });
  }, [open, defaultCashId]);

  const handleRowChange = (id: string, field: "accountId" | "amount", value: string) => {
    setPaymentRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        if (field === "accountId") return { ...r, accountId: value };
        return { ...r, amount: value === "" ? "" : parseFloat(value) || 0 };
      })
    );
  };

  const handleConfirm = async () => {
    const primaryRow = paymentRows[0];
    const paymentMethod = primaryRow?.accountId
      ? (accounts.find((a) => String(a.id) === primaryRow.accountId)?.accountType?.toLowerCase() ?? "cash")
      : "cash";
    await onConfirm({ paymentMethod, receivedAmount: totalReceived, payments: paymentRows, note });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Complete Order"
      icon={<CheckCircle className="w-5 h-5" />}
      size="lg"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={loading || cart.length === 0}>
            {loading ? "Processing..." : "Confirm Order"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto pr-1">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* LEFT */}
          <div className="flex flex-col gap-3">
            {/* Customer */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">Customer</p>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
                  <span className="text-sm font-semibold text-slate-900">
                    {customer?.name ?? "Walk-in Customer"}
                  </span>
                </div>
                {customer?.phone && (
                  <div className="flex items-center gap-2 pl-5">
                    <Phone className="h-3 w-3 text-slate-500" />
                    <span className="text-xs text-slate-600">{customer.phone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Cart items */}
            {cart.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Products <span className="ml-1 rounded-full bg-indigo-100 px-1.5 py-0.5 text-indigo-600">{cart.length}</span>
                </p>
                <div className="space-y-0 max-h-44 overflow-y-auto">
                  {cart.map((item, idx) => (
                    <div
                      key={item.storeProductId}
                      className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-200 last:border-0"
                    >
                      <div className="flex items-start gap-1.5 min-w-0">
                        <span className="mt-0.5 shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-[9px] font-bold text-indigo-600">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium text-slate-900">{item.name}</p>
                          {item.variant && (
                            <p className="text-[10px] text-slate-500">{item.variant}</p>
                          )}
                          <p className="text-[10px] text-slate-500">×{item.quantity}</p>
                        </div>
                      </div>
                      <p className="text-xs font-bold tabular-nums text-slate-900 shrink-0">
                        {formatPrice(item.price * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Order summary */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Summary</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Subtotal</span>
                  <span className="font-medium text-slate-900">{formatPrice(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">Discount</span>
                    <span className="font-medium text-amber-600">-{formatPrice(discount)}</span>
                  </div>
                )}
                {servicesTotal > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">
                      Services ({appliedServices.length})
                    </span>
                    <span className="font-medium text-slate-900">{formatPrice(servicesTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-1.5 border-t border-slate-200">
                  <span className="font-bold text-slate-900">Grand Total</span>
                  <span className="font-bold text-indigo-600">{formatPrice(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex flex-col gap-3">
            {/* Payment rows */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Payment</p>
              <div className="space-y-2">
                {paymentRows.map((row, index) => {
                  const usedIds = paymentRows.filter((r) => r.id !== row.id && r.accountId).map((r) => r.accountId);
                  const available = accounts.filter((a) => !usedIds.includes(String(a.id)));
                  return (
                    <div key={row.id} className="flex items-end gap-2">
                      <div className="flex-1 min-w-0">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                          Account {index + 1}
                        </label>
                        <select
                          value={row.accountId}
                          onChange={(e) => handleRowChange(row.id, "accountId", e.target.value)}
                          className="w-full h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                        >
                          <option value="">Select account</option>
                          {accountsLoading ? (
                            <option disabled>Loading…</option>
                          ) : (
                            available.map((a) => (
                              <option key={a.id} value={String(a.id)}>
                                {getAccountLabel(a)}
                              </option>
                            ))
                          )}
                        </select>
                      </div>
                      <div className="w-28 shrink-0">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">Amount</label>
                        <input
                          type="number"
                          min={0}
                          value={row.amount === "" ? "" : row.amount}
                          disabled={!row.accountId}
                          onChange={(e) => handleRowChange(row.id, "amount", e.target.value)}
                          placeholder="0"
                          className="w-full h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-400 disabled:opacity-40"
                        />
                      </div>
                      {paymentRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setPaymentRows((prev) => prev.filter((r) => r.id !== row.id))}
                          className="mb-0.5 p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={() =>
                  setPaymentRows((prev) => [
                    ...prev,
                    { id: String(Date.now()), accountId: "", amount: "" },
                  ])
                }
                className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600 hover:text-indigo-500 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add account
              </button>
            </div>

            {/* Payment details */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Status</span>
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold capitalize ${statusBadge[paymentStatus] ?? ""}`}>
                  {paymentStatus}
                </span>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] font-semibold text-slate-500">Note (optional)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add a note…"
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-4 gap-2 flex-shrink-0">
          <div className="flex flex-col rounded-xl border border-indigo-300 bg-indigo-50 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500">Total</span>
            <span className="text-sm font-bold tabular-nums text-indigo-700">{formatPrice(grandTotal)}</span>
          </div>
          <div className="flex flex-col rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Receive</span>
            <span className="text-sm font-bold tabular-nums text-emerald-700">{formatPrice(totalReceived)}</span>
          </div>
          <div className="flex flex-col rounded-xl border border-sky-300 bg-sky-50 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-600">Change</span>
            <span className="text-sm font-bold tabular-nums text-sky-700">{formatPrice(change)}</span>
          </div>
          <div className="flex flex-col rounded-xl border border-amber-300 bg-amber-50 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Due</span>
            <span className="text-sm font-bold tabular-nums text-amber-700">{formatPrice(due)}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
