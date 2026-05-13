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
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  type?: string;
  balance?: number;
  isActive?: boolean;
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
    advanceApplied?: number;
  }) => Promise<void>;
}

function getAccountLabel(a: AccountOption) {
  const name = a.accountName ?? a.name ?? String(a.id);
  const accountType = a.accountType ?? a.type;
  const type = accountType ? ` (${accountType})` : "";
  const balance = a.currentBalance ?? a.balance;
  const bal = typeof balance === "number" ? ` - ${formatPrice(balance)}` : "";
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
  const [advanceApplied, setAdvanceApplied] = useState(0);
  const [note, setNote] = useState("");

  const customerAdvanceBalance =
    customer?.totalAdvance != null ? Number(customer.totalAdvance) || 0 : 0;

  const getRowAmount = (row: PaymentRow) =>
    typeof row.amount === "number" ? row.amount : Number(row.amount) || 0;

  const getAccountTypeById = (accountId: string) =>
    String(
      accounts.find((a) => String(a.id) === accountId)?.accountType ??
        accounts.find((a) => String(a.id) === accountId)?.type ??
        ""
    ).toLowerCase();

  const isCashType = (accountType: string) => accountType === "cash";
  const isNonCashType = (accountType: string) =>
    Boolean(accountType) &&
    !isCashType(accountType) &&
    (accountType.includes("bank") ||
      accountType.includes("mobile") ||
      accountType.includes("bkash") ||
      accountType.includes("nagad") ||
      accountType.includes("card"));

  const totalCashRows = paymentRows.reduce(
    (s, r) => s + (typeof r.amount === "number" ? r.amount : Number(r.amount) || 0),
    0
  );
  const displayReceive = totalCashRows + advanceApplied;
  const change = Math.max(0, displayReceive - grandTotal);
  const due = Math.max(0, grandTotal - displayReceive);
  const paymentStatus =
    displayReceive >= grandTotal ? "paid" : displayReceive > 0 ? "partial" : "due";

  const maxAdvanceApplicable =
    customer && customerAdvanceBalance > 0
      ? Math.min(customerAdvanceBalance, Math.max(0, grandTotal - totalCashRows))
      : 0;

  const statusBadge: Record<string, string> = {
    paid: "bg-emerald-100 text-emerald-700 border-emerald-300",
    partial: "bg-amber-100 text-amber-700 border-amber-300",
    due: "bg-red-100 text-red-700 border-red-300",
  };

  const fetchAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const res = await apiFetch<AccountOption[] | { data?: AccountOption[] }>("/finance/accounts");
      const list = Array.isArray(res) ? res : res.data || [];
      const normalized = Array.isArray(list)
        ? list.filter((a) => a && a.id != null && (a.isActive ?? true))
        : [];
      setAccounts(normalized);
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
      setAdvanceApplied(0);
      setPaymentRows([{ id: String(Date.now()), accountId: "", amount: "" }]);
    }
  }, [open, fetchAccounts]);

  useEffect(() => {
    if (!open) return;
    if (advanceApplied > maxAdvanceApplicable) {
      setAdvanceApplied(maxAdvanceApplicable);
    }
  }, [open, maxAdvanceApplicable, advanceApplied]);

  useEffect(() => {
    if (!open || accountsLoading || accounts.length === 0) return;
    const cashAccount =
      accounts.find((a) => String(a.accountType ?? a.type ?? "").toLowerCase() === "cash") ||
      accounts[0];
    if (!cashAccount) return;

    setPaymentRows((prev) => {
      if (!prev.length) return [{ id: String(Date.now()), accountId: String(cashAccount.id), amount: "" }];
      const first = prev[0];
      if (first.accountId) return prev;
      return [{ ...first, accountId: String(cashAccount.id) }, ...prev.slice(1)];
    });
  }, [open, accounts, accountsLoading]);

  const handleRowChange = (id: string, field: "accountId" | "amount", value: string) => {
    setPaymentRows((prev) => {
      const nextRows: PaymentRow[] = prev.map((r): PaymentRow => {
        if (r.id !== id) return r;
        if (field === "accountId") return { ...r, accountId: value };
        if (value === "") return { ...r, amount: "" as const };
        return { ...r, amount: parseFloat(value) || 0 };
      });

      const changedRow = nextRows.find((r) => r.id === id);
      if (!changedRow) return prev;

      const changedType = getAccountTypeById(changedRow.accountId);
      const changedIsCash = isCashType(changedType);
      const changedAmount = getRowAmount(changedRow);

      const remGrand = Math.max(0, grandTotal - advanceApplied);
      if (!changedIsCash && changedAmount > remGrand) {
        toast.error(
          `Online/Bank account cannot receive more than ${formatPrice(remGrand)} (after advance).`
        );
        return prev;
      }

      const hasAnyNonCash = nextRows.some((r) => {
        const t = getAccountTypeById(r.accountId);
        return isNonCashType(t) && getRowAmount(r) > 0;
      });
      const total = nextRows.reduce((sum, r) => sum + getRowAmount(r), 0);

      if (hasAnyNonCash && total + advanceApplied > grandTotal) {
        toast.error(
          `Bank/Mobile payment selected, total receive cannot exceed ${formatPrice(grandTotal - advanceApplied)} (plus advance).`
        );
        return prev;
      }

      return nextRows;
    });
  };

  const handleConfirm = async () => {
    const hasAnyNonCash = paymentRows.some((r) => {
      const t = getAccountTypeById(r.accountId);
      return isNonCashType(t) && getRowAmount(r) > 0;
    });
    if (hasAnyNonCash && totalCashRows + advanceApplied > grandTotal) {
      toast.error(
        `When bank/mobile account is used, cash accounts plus advance cannot exceed ${formatPrice(grandTotal)}.`
      );
      return;
    }
    const primaryRow = paymentRows[0];
    const paymentMethod = primaryRow?.accountId
      ? (accounts.find((a) => String(a.id) === primaryRow.accountId)?.accountType?.toLowerCase() ?? "account")
      : "account";
    await onConfirm({
      paymentMethod,
      receivedAmount: totalCashRows,
      payments: paymentRows,
      note,
      advanceApplied: advanceApplied > 0 ? advanceApplied : undefined,
    });
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
                  <User className="h-3.5 w-3.5 shrink-0 text-primary" />
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
                  Products <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-primary">{cart.length}</span>
                </p>
                <div className="space-y-0 max-h-44 overflow-y-auto">
                  {cart.map((item, idx) => (
                    <div
                      key={item.storeProductId}
                      className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-200 last:border-0"
                    >
                      <div className="flex items-start gap-1.5 min-w-0">
                        <span className="mt-0.5 shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary">
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
                  <span className="font-bold text-primary">{formatPrice(grandTotal)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="flex flex-col gap-3">
            {customer && customerAdvanceBalance > 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                    Advance balance
                  </span>
                  <span className="text-sm font-bold tabular-nums text-emerald-800">
                    {formatPrice(customerAdvanceBalance)}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-emerald-800/80">
                  Apply to this order (max {formatPrice(maxAdvanceApplicable)}).
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
                <label className="mt-2 block text-[10px] font-semibold text-emerald-800">Apply amount</label>
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

            {/* Payment rows */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Payment</p>
              <div className="space-y-2">
                {paymentRows.map((row, index) => {
                  const usedIds = paymentRows.filter((r) => r.id !== row.id && r.accountId).map((r) => r.accountId);
                  const available = accounts.filter((a) => !usedIds.includes(String(a.id)));
                  const rowType = getAccountTypeById(row.accountId);
                  const rowIsCash = isCashType(rowType);
                  const hasOtherNonCash = paymentRows.some((r) => {
                    if (r.id === row.id) return false;
                    const t = getAccountTypeById(r.accountId);
                    return isNonCashType(t) && getRowAmount(r) > 0;
                  });
                  const shouldCapByGrandTotal = !rowIsCash || hasOtherNonCash;
                  const otherRowsTotal = paymentRows
                    .filter((r) => r.id !== row.id)
                    .reduce((sum, r) => sum + getRowAmount(r), 0);
                  const maxForRow = Math.max(0, grandTotal - advanceApplied - otherRowsTotal);
                  return (
                    <div key={row.id} className="flex items-end gap-2">
                      <div className="flex-1 min-w-0">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                          Account {index + 1}
                        </label>
                        <Select
                          value={row.accountId}
                          onValueChange={(value) => handleRowChange(row.id, "accountId", value)}
                        >
                          <SelectTrigger className="h-8 w-full rounded-lg border-slate-300 bg-white px-2 text-xs text-slate-900">
                            <SelectValue placeholder={accountsLoading ? "Loading..." : "Select account"} />
                          </SelectTrigger>
                          <SelectContent position="popper" side="bottom" align="start">
                            {!accountsLoading && available.length === 0 ? (
                              <SelectItem value="__no_accounts__" disabled>
                                No accounts available
                              </SelectItem>
                            ) : (
                              available.map((a) => (
                                <SelectItem key={a.id} value={String(a.id)}>
                                  {getAccountLabel(a)}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-28 shrink-0">
                        <label className="block text-[10px] font-semibold text-slate-500 mb-1">Amount</label>
                        <input
                          type="number"
                          min={0}
                          max={shouldCapByGrandTotal ? maxForRow : undefined}
                          value={row.amount === "" ? "" : row.amount}
                          disabled={!row.accountId}
                          onChange={(e) => handleRowChange(row.id, "amount", e.target.value)}
                          placeholder="0"
                          className="w-full h-8 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-40"
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
                className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-primary transition-colors hover:text-primary/80"
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
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-4 gap-2 flex-shrink-0">
          <div className="flex flex-col rounded-xl border border-primary/25 bg-primary/5 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-primary/80">Total</span>
            <span className="text-sm font-bold tabular-nums text-primary">{formatPrice(grandTotal)}</span>
          </div>
          <div className="flex flex-col rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Receive</span>
            <span className="text-sm font-bold tabular-nums text-emerald-700">{formatPrice(displayReceive)}</span>
          </div>
          <div className="flex flex-col rounded-xl border border-muted-foreground/20 bg-muted/40 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Change</span>
            <span className="text-sm font-bold tabular-nums text-foreground">{formatPrice(change)}</span>
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
