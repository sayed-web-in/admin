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
type TxType = "advance" | "due";

interface FinanceAccount {
  id: number;
  name: string;
  accountNumber?: string | null;
  type?: string;
  balance?: number | string;
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

interface AddCustomTransactionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplierId: number;
  onSuccess: () => void;
}

export function AddCustomTransactionModal({
  open,
  onOpenChange,
  supplierId,
  onSuccess,
}: AddCustomTransactionModalProps) {
  const [type, setType] = useState<TxType>("advance");
  const [amount, setAmount] = useState<string>("");
  const [accountId, setAccountId] = useState<string>("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [purchaseId, setPurchaseId] = useState("");
  const [note, setNote] = useState("");
  const [transactionDate, setTransactionDate] = useState(getTodayLocalDate());
  const [offsetsOpeningInventory, setOffsetsOpeningInventory] = useState(false);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);

  const activeType = type === "due" ? "due" : "advance";

  const filteredAccounts = useMemo(() => accounts, [accounts]);

  useEffect(() => {
    if (!open) return;
    setTransactionDate(getTodayLocalDate());
    setType("advance");
    setAmount("");
    setAccountId("");
    setInvoiceNo("");
    setPurchaseId("");
    setNote("");
    setOffsetsOpeningInventory(false);

    let cancelled = false;
    (async () => {
      setLoadingAccounts(true);
      try {
        const res = await apiFetch<FinanceAccount[] | { data?: FinanceAccount[] }>(
          "/finance/accounts",
        );
        const list = Array.isArray(res) ? res : res.data ?? [];
        const rows = Array.isArray(list)
          ? list.filter((a) => {
              if (!a || a.id == null) return false;
              const active = (a as FinanceAccount & { isActive?: boolean })
                .isActive;
              return active !== false;
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
  }, [open, supplierId]);

  const numAmount = parseFloat(amount) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    const useOiOffset = type === "due" && offsetsOpeningInventory;
    if (!useOiOffset && !accountId) {
      toast.error("Please select an account");
      return;
    }

    const purchaseIdNum = purchaseId.trim()
      ? parseInt(purchaseId.trim(), 10)
      : undefined;
    if (purchaseId.trim() && (!Number.isFinite(purchaseIdNum) || purchaseIdNum! < 1)) {
      toast.error("Purchase ID must be a valid number");
      return;
    }

    try {
      setLoading(true);
      const ymd = transactionDate.trim() || getTodayLocalDate();
      const body: Record<string, unknown> = {
        type,
        amount: numAmount,
        invoiceNo: invoiceNo.trim() || undefined,
        note: note.trim() || undefined,
        transactionDate: paymentYmdToApiIso(ymd),
      };
      if (purchaseIdNum != null && Number.isFinite(purchaseIdNum) && purchaseIdNum >= 1) {
        body.purchaseId = purchaseIdNum;
      }
      if (useOiOffset) {
        body.offsetsOpeningInventory = true;
      } else {
        body.accountId = Number(accountId);
      }

      await apiFetch(`/suppliers/${supplierId}/transactions`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      onSuccess();
      onOpenChange(false);
      toast.success("Transaction added");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add transaction");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add Custom Transaction"
      icon={<Receipt className="h-5 w-5" />}
      size="md"
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
            form="supplier-custom-tx-form"
            disabled={loading || loadingAccounts}
          >
            {loading ? "Adding..." : "Add Transaction"}
          </Button>
        </div>
      }
    >
      <form
        id="supplier-custom-tx-form"
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium">Transaction Type</label>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-muted/30 p-1">
            <button
              type="button"
              onClick={() => {
                setType("advance");
                setOffsetsOpeningInventory(false);
              }}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition",
                activeType === "advance"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              Advance
            </button>
            <button
              type="button"
              onClick={() => {
                setType("due");
                setOffsetsOpeningInventory(false);
              }}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-medium transition",
                activeType === "due"
                  ? "bg-rose-600 text-white shadow"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              Due
            </button>
          </div>
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
          <label className="text-sm font-medium">
            Amount <span className="text-destructive">*</span>
          </label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onWheel={(e) => e.currentTarget.blur()}
            placeholder="0.00"
            required
            className="[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>

        {activeType === "due" ? (
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-muted/20 px-3 py-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-input"
              checked={offsetsOpeningInventory}
              onChange={(e) => {
                setOffsetsOpeningInventory(e.target.checked);
                if (e.target.checked) setAccountId("");
              }}
            />
            <span className="leading-snug">
              <span className="font-medium">Funded from opening stock</span>
            </span>
          </label>
        ) : null}

        <div className="space-y-2">
          <label className="text-sm font-medium">
            {activeType === "due" ? "Account" : "Receive Account"}
            {!(activeType === "due" && offsetsOpeningInventory) ? (
              <span className="text-destructive"> *</span>
            ) : null}
          </label>
          {activeType === "due" && offsetsOpeningInventory ? (
            <div className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              Not required — offset is tied to initial inventory only.
            </div>
          ) : loadingAccounts ? (
            <div className="rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              Loading accounts…
            </div>
          ) : (
            <Select value={accountId || undefined} onValueChange={setAccountId}>
              <SelectTrigger className="w-full rounded-xl">
                <SelectValue placeholder="Select Account" />
              </SelectTrigger>
              <SelectContent position="popper" className="z-[1200]">
                {filteredAccounts.map((account) => {
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
          <label className="text-sm font-medium">Invoice No (Optional)</label>
          <Input
            value={invoiceNo}
            onChange={(e) => setInvoiceNo(e.target.value)}
            placeholder="Enter invoice number if any"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Purchase ID (Optional)</label>
          <Input
            value={purchaseId}
            onChange={(e) => setPurchaseId(e.target.value)}
            placeholder="Enter purchase ID if related"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Note (Optional)</label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Add any additional notes"
            className="resize-none"
          />
        </div>
      </form>
    </Modal>
  );
}
