"use client";

import { useState, useEffect, useMemo } from "react";
import { Receipt } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { formatPrice, cn } from "@/lib/utils";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

export type CustomerSaleDueOption = {
  id: number;
  invoiceNumber: string;
  dueAmount: number;
};

type TxKind = "payment" | "advance" | "due";

interface FinanceAccount {
  id: number;
  name: string;
  accountNumber?: string | null;
  type?: string;
  balance?: number | string;
  isActive?: boolean;
}

function getTodayLocalDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function paymentYmdToApiIso(ymd: string): string {
  const s = ymd.trim();
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return new Date().toISOString();
  return new Date(y, m - 1, d, 12, 0, 0, 0).toISOString();
}

const selectClasses =
  "h-10 w-full rounded-xl border border-input bg-background/80 px-3 text-sm shadow-sm backdrop-blur-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface CustomerTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: number;
  manualDue: number;
  salesWithDue: CustomerSaleDueOption[];
  totalDue: number;
  onSuccess: () => void;
}

export function CustomerTransactionModal({
  open,
  onOpenChange,
  customerId,
  manualDue,
  salesWithDue,
  totalDue,
  onSuccess,
}: CustomerTransactionModalProps) {
  const [kind, setKind] = useState<TxKind>("payment");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [note, setNote] = useState("");
  const [transactionDate, setTransactionDate] = useState(getTodayLocalDate());
  /** `manual` = settle customer manual due only; otherwise sale id */
  const [paymentTarget, setPaymentTarget] = useState<string>("manual");
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const manualDueNum = Number(manualDue || 0);
  const payMax = useMemo(() => {
    if (paymentTarget === "manual") return manualDueNum;
    const s = salesWithDue.find((x) => String(x.id) === paymentTarget);
    return s ? Number(s.dueAmount || 0) : 0;
  }, [paymentTarget, manualDueNum, salesWithDue]);

  const canPaySomething = manualDueNum > 0 || salesWithDue.some((s) => Number(s.dueAmount || 0) > 0);
  const numAmount = parseFloat(amount) || 0;
  const selectedAccount = accounts.find((a) => String(a.id) === accountId);
  const selectedBalance = selectedAccount
    ? Number(selectedAccount.balance ?? 0)
    : 0;

  useEffect(() => {
    if (!open) return;
    setKind("payment");
    setAmount("");
    setAccountId("");
    setNote("");
    setTransactionDate(getTodayLocalDate());
    if (salesWithDue.length > 0) {
      setPaymentTarget(String(salesWithDue[0].id));
    } else if (manualDueNum > 0) {
      setPaymentTarget("manual");
    } else {
      setPaymentTarget("manual");
    }

    let cancelled = false;
    (async () => {
      setLoadingAccounts(true);
      try {
        const res = await apiFetch<FinanceAccount[] | { data?: FinanceAccount[] }>(
          "/finance/accounts",
        );
        const list = Array.isArray(res) ? res : (res.data ?? []);
        const rows = Array.isArray(list)
          ? list.filter((a) => {
              if (!a || a.id == null) return false;
              return (a as FinanceAccount).isActive !== false;
            })
          : [];
        if (!cancelled) setAccounts(rows);
      } catch {
        if (!cancelled) {
          setAccounts([]);
          toast.error("Failed to load accounts");
        }
      } finally {
        if (!cancelled) setLoadingAccounts(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, manualDueNum, salesWithDue]);

  useEffect(() => {
    if (!open || kind !== "payment") return;
    const valid = new Set<string>();
    if (manualDueNum > 0) valid.add("manual");
    for (const s of salesWithDue) valid.add(String(s.id));
    if (valid.has(paymentTarget)) return;
    if (salesWithDue.length > 0) setPaymentTarget(String(salesWithDue[0].id));
    else if (manualDueNum > 0) setPaymentTarget("manual");
  }, [open, kind, paymentTarget, manualDueNum, salesWithDue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) {
      toast.error("Please select an account");
      return;
    }
    if (numAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    const ymd = transactionDate.trim() || getTodayLocalDate();
    const iso = paymentYmdToApiIso(ymd);

    try {
      setLoading(true);
      if (kind === "payment") {
        if (!canPaySomething || payMax <= 0) {
          toast.error("No due amount to receive for this selection");
          return;
        }
        if (numAmount > payMax) {
          toast.error(`Amount cannot exceed ${formatPrice(payMax)} for this target`);
          return;
        }
        const body: Record<string, unknown> = {
          type: "payment",
          amount: numAmount,
          accountId: Number(accountId),
          transactionDate: iso,
          note: note.trim() || undefined,
        };
        if (paymentTarget !== "manual") {
          body.saleId = Number(paymentTarget);
        }
        await apiFetch(`/customers/${customerId}/transactions`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      } else if (kind === "advance") {
        await apiFetch(`/customers/${customerId}/transactions`, {
          method: "POST",
          body: JSON.stringify({
            type: "advance",
            amount: numAmount,
            accountId: Number(accountId),
            transactionDate: iso,
            note: note.trim() || undefined,
          }),
        });
      } else {
        if (numAmount > selectedBalance) {
          toast.error("Insufficient account balance");
          return;
        }
        await apiFetch(`/customers/${customerId}/transactions`, {
          method: "POST",
          body: JSON.stringify({
            type: "due",
            amount: numAmount,
            accountId: Number(accountId),
            transactionDate: iso,
            note: note.trim() || undefined,
          }),
        });
      }
      toast.success("Transaction recorded");
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Transaction failed");
    } finally {
      setLoading(false);
    }
  };

  const paymentTargetSelect =
    salesWithDue.length > 0 || manualDueNum > 0 ? (
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Apply to <span className="text-destructive">*</span>
        </label>
        <select
          value={paymentTarget}
          onChange={(e) => setPaymentTarget(e.target.value)}
          className={selectClasses}
        >
          {manualDueNum > 0 ? (
            <option value="manual">
              Customer due (no invoice) — {formatPrice(manualDueNum)}
            </option>
          ) : null}
          {salesWithDue.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.invoiceNumber || `Sale #${s.id}`} — due{" "}
              {formatPrice(Number(s.dueAmount || 0))}
            </option>
          ))}
        </select>
      </div>
    ) : null;

  const submitDisabled =
    loading ||
    loadingAccounts ||
    !accountId ||
    (kind === "payment" && (!canPaySomething || payMax <= 0)) ||
    (kind === "due" && numAmount > selectedBalance);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Quick Transaction"
      icon={<Receipt className="h-5 w-5" />}
      size="md"
      description={
        totalDue > 0 ? `Total due: ${formatPrice(totalDue)}` : undefined
      }
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="customer-quick-tx-form"
            disabled={submitDisabled}
          >
            {loading ? "Saving..." : "Save"}
          </Button>
        </div>
      }
    >
      <form
        id="customer-quick-tx-form"
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium">Transaction type</label>
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-border bg-muted/30 p-1">
            <button
              type="button"
              onClick={() => setKind("payment")}
              className={cn(
                "rounded-lg px-2 py-2 text-xs font-medium transition sm:text-sm",
                kind === "payment"
                  ? "bg-blue-600 text-white shadow"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              Payment
            </button>
            <button
              type="button"
              onClick={() => setKind("advance")}
              className={cn(
                "rounded-lg px-2 py-2 text-xs font-medium transition sm:text-sm",
                kind === "advance"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              Advance
            </button>
            <button
              type="button"
              onClick={() => setKind("due")}
              className={cn(
                "rounded-lg px-2 py-2 text-xs font-medium transition sm:text-sm",
                kind === "due"
                  ? "bg-rose-600 text-white shadow"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              Due
            </button>
          </div>
        </div>

        {kind === "payment" ? (
          <div className="rounded-xl border border-primary/25 bg-primary/5 p-3">
            <p className="text-sm text-muted-foreground">
              Payment is posted to the selected account and reduces the chosen
              invoice due or customer-only due.
            </p>
            {!canPaySomething ? (
              <p className="mt-2 text-sm font-medium text-destructive">
                No outstanding due for this customer.
              </p>
            ) : null}
          </div>
        ) : null}

        {kind === "payment" ? paymentTargetSelect : null}

        <div className="space-y-2">
          <label className="text-sm font-medium">
            {kind === "due" ? "Account" : "Receive account"}
            <span className="text-destructive"> *</span>
          </label>
          {loadingAccounts ? (
            <p className="text-sm text-muted-foreground">Loading accounts…</p>
          ) : (
            <Select value={accountId || undefined} onValueChange={setAccountId}>
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[1200]">
                {accounts.map((account) => {
                  const label = `${account.name} — ${formatPrice(Number(account.balance ?? 0))}`;
                  return (
                    <SelectItem key={account.id} value={String(account.id)}>
                      {label}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label className="text-sm font-medium">
              Amount <span className="text-destructive">*</span>
            </label>
            {kind === "payment" && payMax > 0 ? (
              <button
                type="button"
                onClick={() =>
                  setAmount(
                    payMax % 1 === 0 ? String(Math.round(payMax)) : String(payMax),
                  )
                }
                className="text-xs text-primary underline-offset-4 hover:underline"
              >
                Pay max
              </button>
            ) : null}
          </div>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            max={kind === "payment" && payMax > 0 ? payMax : undefined}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onWheel={(e) => e.currentTarget.blur()}
            placeholder="0.00"
            required
            className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          {kind === "payment" && numAmount > 0 && numAmount > payMax ? (
            <p className="text-xs text-destructive">
              Exceeds selected due of {formatPrice(payMax)}
            </p>
          ) : null}
          {kind === "due" &&
          selectedAccount &&
          numAmount > 0 &&
          numAmount > selectedBalance ? (
            <p className="text-xs text-destructive">
              Exceeds account balance of {formatPrice(selectedBalance)}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            Date <span className="text-destructive">*</span>
          </label>
          <Input
            type="date"
            value={transactionDate}
            onChange={(e) => setTransactionDate(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Notes</label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Optional notes"
            className="resize-none"
          />
        </div>
      </form>
    </Modal>
  );
}
