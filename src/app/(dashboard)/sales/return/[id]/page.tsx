"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle, FileText, Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/utils";
import { Modal } from "@/components/common/Modal";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
  InventorySectionHeader,
} from "@/components/inventory/InventoryCrudLayout";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/common/DataTable";
import { Input } from "@/components/ui/input";

interface ReturnDetailItem {
  id: number;
  quantity: number;
  unitPrice: number;
  total: number;
  storeProductId: number;
  saleItemId?: number | null;
  damageDeductionType?: string | null;
  damageDeductionValue?: number | null;
  storeProduct?: {
    product?: { name?: string };
    productVariant?: { sku?: string | null };
  } | null;
}

interface ReturnDetail {
  id: number;
  saleId: number;
  reason?: string | null;
  totalAmount: number;
  refundAmount: number;
  returnGain: number;
  status?: string;
  pendingCashRefund?: number | string;
  cashRefundPaid?: number | string;
  refundAccountId?: number | null;
  refundAccount?: { id: number; name: string } | null;
  createdAt: string;
  sale?: {
    id: number;
    invoiceNumber: string;
    customer?: { name?: string };
    branch?: { name?: string };
  };
  items: ReturnDetailItem[];
  accounting?: {
    grossReturnValue: number;
    refundToCustomer: number;
    returnGainRetained: number;
    status?: string;
    pendingCashRefund?: number;
    cashRefundPaid?: number;
    remainingCashRefund?: number;
    refundAccountName?: string | null;
    steps: string[];
  };
}

interface FinanceAccountRow {
  id: number;
  name: string;
  balance: number | string;
  isActive?: boolean;
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

function lineDamage(row: ReturnDetailItem): number {
  const lineTotal = Number(row.total);
  const t = row.damageDeductionType;
  const v = Number(row.damageDeductionValue ?? 0);
  if (!t || t === "none" || v <= 0) return 0;
  if (t === "percentage") return (lineTotal * Math.min(100, v)) / 100;
  if (t === "fixed") return Math.min(lineTotal, v);
  return 0;
}

export default function SalesReturnDetailPage() {
  const params = useParams<{ id: string }>();
  const returnId = useMemo(() => {
    const n = parseInt(String(params?.id ?? ""), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params?.id]);

  const [data, setData] = useState<ReturnDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [accounts, setAccounts] = useState<FinanceAccountRow[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [modalAccountId, setModalAccountId] = useState("");
  const [modalAmount, setModalAmount] = useState(0);
  const [modalError, setModalError] = useState("");
  const [submittingRefund, setSubmittingRefund] = useState(false);

  const load = useCallback(async () => {
    if (!returnId) {
      setError("Invalid return id");
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<ReturnDetail>(`/sales/returns/${returnId}`);
      setData(res);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load return");
    } finally {
      setLoading(false);
    }
  }, [returnId]);

  useEffect(() => {
    void load();
  }, [load]);

  const remainingCash = useMemo(() => {
    if (data?.accounting?.remainingCashRefund != null) {
      return Math.max(0, num(data.accounting.remainingCashRefund));
    }
    const cap = num(data?.pendingCashRefund);
    const paid = num(data?.cashRefundPaid);
    return Math.max(0, Math.round((cap - paid) * 100) / 100);
  }, [data]);

  useEffect(() => {
    if (!refundModalOpen || !returnId) return;
    let cancelled = false;
    setAccountsLoading(true);
    void (async () => {
      try {
        const raw = await apiFetch<FinanceAccountRow[] | { data?: FinanceAccountRow[] }>("/finance/accounts");
        const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data! : [];
        if (!cancelled) {
          setAccounts(list.filter((a) => a.isActive !== false));
        }
      } catch {
        if (!cancelled) setAccounts([]);
      } finally {
        if (!cancelled) setAccountsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refundModalOpen, returnId]);

  const openRefundModal = () => {
    if (!data || !returnId) return;
    setModalError("");
    setModalAmount(remainingCash);
    setModalAccountId(data.refundAccountId ? String(data.refundAccountId) : "");
    setRefundModalOpen(true);
  };

  const submitRefundPayment = async () => {
    if (!returnId || !data) return;
    const amt = Number(modalAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setModalError("Enter a positive refund amount.");
      return;
    }
    if (amt > remainingCash + 1e-6) {
      setModalError(`Amount cannot exceed remaining ${formatPrice(remainingCash)}.`);
      return;
    }
    const accId = parseInt(modalAccountId, 10);
    if (!accId) {
      setModalError("Select a refund account.");
      return;
    }
    const acc = accounts.find((a) => a.id === accId);
    const bal = acc ? num(acc.balance) : 0;
    if (amt > bal + 1e-6) {
      setModalError(`Selected account balance is ${formatPrice(bal)} — reduce the amount or pick another account.`);
      return;
    }
    setSubmittingRefund(true);
    setModalError("");
    try {
      const updated = await apiFetch<ReturnDetail>(`/sales/returns/${returnId}`, {
        method: "PATCH",
        body: JSON.stringify({
          paymentAmount: amt,
          refundAccountId: accId,
        }),
      });
      setData(updated);
      toast.success("Refund payment recorded");
      setRefundModalOpen(false);
    } catch (e) {
      setModalError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSubmittingRefund(false);
    }
  };

  const itemColumns = useMemo(
    () => [
      { key: "name", label: "Product", render: (row: ReturnDetailItem) => row.storeProduct?.product?.name || "—" },
      { key: "sku", label: "SKU", render: (row: ReturnDetailItem) => row.storeProduct?.productVariant?.sku || "—" },
      { key: "qty", label: "Qty", className: "text-center", render: (row: ReturnDetailItem) => row.quantity },
      {
        key: "dmg",
        label: "Damage",
        render: (row: ReturnDetailItem) =>
          row.damageDeductionType && row.damageDeductionType !== "none"
            ? `${row.damageDeductionType} ${row.damageDeductionValue ?? ""}`
            : "—",
      },
      {
        key: "refundLine",
        label: "Refund line",
        className: "text-right",
        render: (row: ReturnDetailItem) =>
          formatPrice(Number(row.total) - lineDamage(row)),
      },
    ],
    []
  );

  if (!returnId) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Invalid id.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link href="/sales/return">Back</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={FileText}
        title="Sales return details"
        description={data ? `Return #${data.id} · ${data.sale?.invoiceNumber ?? ""}` : "Loading…"}
      >
        <Button type="button" variant="outline" size="sm" className="h-10 rounded-xl sm:h-9" asChild>
          <Link href="/sales/return">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        {data?.sale?.id ? (
          <Button type="button" variant="outline" size="sm" className="h-10 rounded-xl sm:h-9" asChild>
            <Link href={`/sales/history/${data.sale.id}`}>View sale</Link>
          </Button>
        ) : null}
        <Button type="button" variant="outline" size="sm" className="h-10 rounded-xl sm:h-9" onClick={() => void load()}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </InventoryListPageHeader>

      {loading ? (
        <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : error || !data ? (
        <div className="p-6">
          <p className="text-destructive">{error || "Not found"}</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/sales/return">Back to list</Link>
          </Button>
        </div>
      ) : (
        <>
          <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6`}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div>
                <p className="text-muted-foreground">Sale invoice</p>
                <p className="font-medium">{data.sale?.invoiceNumber || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Customer</p>
                <p className="font-medium">{data.sale?.customer?.name || "Walk-in"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Branch</p>
                <p className="font-medium">{data.sale?.branch?.name || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date</p>
                <p className="font-medium">{formatDate(data.createdAt)}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 border-t border-border/50 pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <p className="mt-1">
                  <span
                    className={
                      (data.status ?? data.accounting?.status) === "pending"
                        ? "rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-200"
                        : "rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:text-emerald-200"
                    }
                  >
                    {(data.status ?? data.accounting?.status ?? "completed").replace(/_/g, " ")}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gross return</p>
                <p className="text-lg font-semibold">{formatPrice(Number(data.totalAmount))}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Refund to customer (net)</p>
                <p className="text-lg font-semibold text-primary">{formatPrice(Number(data.refundAmount))}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Return gain (P&L)</p>
                <p className="text-lg font-semibold text-emerald-600">{formatPrice(Number(data.returnGain))}</p>
              </div>
            </div>
            {remainingCash > 0.005 ? (
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="font-medium text-foreground">Cash refund pending</p>
                  <p className="text-muted-foreground">
                    Due / advance were adjusted when the return was created. Pay the remaining{" "}
                    <span className="font-semibold text-foreground">{formatPrice(remainingCash)}</span> from a finance
                    account (seller-admin style).
                  </p>
                  {num(data.cashRefundPaid) > 0 ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Paid so far: {formatPrice(num(data.cashRefundPaid))}
                      {data.refundAccount?.name ? ` · Last account: ${data.refundAccount.name}` : ""}
                    </p>
                  ) : null}
                </div>
                <Button type="button" className="shrink-0 rounded-xl" onClick={openRefundModal}>
                  Record refund payment
                </Button>
              </div>
            ) : null}
          </section>

          {data.reason ? (
            <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6`}>
              <InventorySectionHeader compact icon={FileText} title="Reason / notes" />
              <pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{data.reason}</pre>
            </section>
          ) : null}

          <section className={INVENTORY_CARD_SHELL}>
            <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6">
              <InventorySectionHeader compact icon={FileText} title="Returned lines" />
            </div>
            <div className="p-4 sm:p-5">
              <DataTable columns={itemColumns} data={data.items} loading={false} inventoryStyle />
            </div>
          </section>

          {data.accounting?.steps?.length ? (
            <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6`}>
              <InventorySectionHeader compact icon={FileText} title="Accounting" description="What was posted for this return" />
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                {data.accounting.steps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            </section>
          ) : null}

          <Modal
            open={refundModalOpen}
            onOpenChange={setRefundModalOpen}
            title="Record cash refund"
            description="Choose the account to debit and how much to pay out now. You can pay in one or more steps until the pending amount is cleared."
            icon={<CheckCircle className="h-6 w-6" />}
            size="sm"
            footer={
              <div className="flex w-full justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={submittingRefund}
                  onClick={() => setRefundModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="button" size="sm" disabled={submittingRefund} onClick={() => void submitRefundPayment()}>
                  {submittingRefund ? "Saving…" : "Save"}
                </Button>
              </div>
            }
          >
            <div className="space-y-4 py-1">
              {modalError ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {modalError}
                </div>
              ) : null}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                <p className="text-xs text-muted-foreground">Remaining to pay from account</p>
                <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{formatPrice(remainingCash)}</p>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Refund account</label>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
                  value={modalAccountId}
                  disabled={accountsLoading}
                  onChange={(e) => {
                    setModalAccountId(e.target.value);
                    setModalError("");
                  }}
                >
                  <option value="">{accountsLoading ? "Loading…" : "Select account"}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={String(a.id)}>
                      {a.name} — {formatPrice(num(a.balance))}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">Pay now</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  max={remainingCash > 0 ? remainingCash : undefined}
                  value={modalAmount || ""}
                  onChange={(e) => {
                    const v = e.target.value === "" ? 0 : parseFloat(e.target.value);
                    if (Number.isNaN(v)) return;
                    setModalAmount(Math.min(Math.max(0, v), remainingCash));
                    setModalError("");
                  }}
                  onBlur={() => setModalAmount((prev) => Math.min(Math.max(0, prev), remainingCash))}
                  className="rounded-xl"
                />
              </div>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}
