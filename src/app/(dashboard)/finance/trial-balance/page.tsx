"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Scale,
  TrendingUp,
  TrendingDown,
  Building2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Banknote,
  Users,
  Package,
  ShoppingCart,
  UserCheck,
  Wallet,
  ArrowDownCircle,
} from "lucide-react";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
} from "@/components/inventory/InventoryCrudLayout";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { getSelectedBranch } from "@/lib/auth";
import { cn } from "@/lib/utils";

/** Same as seller-admin trial balance: ৳ + en-IN grouping, keeps minus, up to 2 dp, strips “.00”. */
function fmtTb(n: number): string {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return `৳${v
    .toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    .replace(/\.00$/, "")}`;
}

interface CashAccountRow {
  id: string;
  accountName: string;
  accountType: string;
  accountNumber: string | null;
  balance: number;
  branch: { id: string; name: string };
}

interface TrialBalanceData {
  branchId: number | null;
  assets: {
    cashAccounts: CashAccountRow[];
    totalCash: number;
    customerReceivable: number;
    customerInvoiceDue: number;
    customerManualDue: number;
    retailerReceivable: number;
    inventoryValue: number;
    employeeAdvanceReceivable: number;
    supplierAdvanceReceivable: number;
    totalAssets: number;
  };
  liabilities: {
    supplierPayable: number;
    customerAdvance: number;
    retailerAdvance: number;
    salaryDue: number;
    cashDepositPayable: number;
    totalLiabilities: number;
  };
  equity: {
    totalOpeningCapital: number;
    openingInventoryCapitalGross?: number;
    /** Capped at gross opening stock — same as seller TB “supplier due on opening stock” line. */
    openingInventoryCapitalSupplierDueOffset?: number;
    /** Full cumulative posted OI Due (for subtitle when it exceeds cap). */
    openingInventorySupplierDuePostedTotal?: number;
    openingInventoryCapital: number;
    netStockAdjustment: number;
    totalRevenue: number;
    totalExpense: number;
    cumulativeNetProfit: number;
    totalProfitWithdrawn: number;
    retainedEarnings: number;
    salaryAccrual?: number;
    totalOwnerEquity: number;
  };
  summary: {
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
    totalOwnerEquity: number;
    retainedEarnings: number;
    difference: number;
    isBalanced: boolean;
  };
}

function Row({
  label,
  value,
  sub,
  indent = false,
  bold = false,
  valueClass = "text-foreground",
}: {
  label: string;
  value: number;
  sub?: string;
  indent?: boolean;
  bold?: boolean;
  valueClass?: string;
}) {
  return (
    <div
      className={`flex items-center justify-between py-2 ${indent ? "pl-6" : ""} ${
        bold ? "mt-1 border-t border-border pt-3" : "border-b border-border/60"
      }`}
    >
      <div>
        <span className={`text-sm ${bold ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
          {label}
        </span>
        {sub ? <span className="mt-0.5 block text-xs text-muted-foreground">{sub}</span> : null}
      </div>
      <span className={`text-sm font-medium tabular-nums tracking-tight ${bold ? "text-base font-bold" : ""} ${valueClass}`}>
        {fmtTb(value)}
      </span>
    </div>
  );
}

export default function TrialBalancePage() {
  const [data, setData] = useState<TrialBalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const branchId = getSelectedBranch();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", String(branchId));
      const res = await apiFetch<TrialBalanceData>(`/finance/trial-balance?${params.toString()}`);
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={Scale}
        title="Trial Balance"
        description="Complete financial position — assets, liabilities, owner’s equity, and balance check (seller-admin style amounts)."
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 w-full gap-2 rounded-xl sm:h-9 sm:w-auto"
          onClick={() => void fetchData()}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </InventoryListPageHeader>

      <div
        className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent"
        aria-hidden
      />

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
          Loading trial balance…
        </div>
      ) : !data ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
          Failed to load trial balance.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          {/* Assets — seller-style card shell */}
          <div className={cn(INVENTORY_CARD_SHELL, "border-emerald-500/25")}>
            <div className="border-b border-border/60 bg-emerald-500/10 p-4 sm:p-5">
              <h2 className="m-0 flex items-center gap-2 text-lg font-semibold text-foreground">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                Assets
              </h2>
              <p className="m-0 mt-1 text-xs text-muted-foreground">Cash, receivables, inventory, and supplier prepayments</p>
            </div>
            <div className="p-4">
              <div className="mb-3">
                <div className="mb-2 flex items-center gap-2">
                  <Banknote className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Cash &amp; bank
                  </span>
                </div>
                {(data.assets.cashAccounts ?? []).map((acc) => (
                  <div
                    key={acc.id}
                    className="flex items-center justify-between border-b border-border/60 py-1.5 pl-6"
                  >
                    <div>
                      <span className="text-sm text-foreground">{acc.accountName}</span>
                      <span className="block text-xs text-muted-foreground">
                        {acc.accountType}
                        {acc.accountNumber ? ` · ${acc.accountNumber}` : ""} · {acc.branch.name}
                      </span>
                    </div>
                    <span className={`text-sm font-medium tabular-nums ${acc.balance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {fmtTb(acc.balance)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between py-2 pl-6 text-sm font-semibold text-foreground">
                  <span>Total cash &amp; bank</span>
                  <span className="text-emerald-600">{fmtTb(data.assets.totalCash)}</span>
                </div>
              </div>

              <div className="mb-3 mt-2">
                <div className="mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Receivables</span>
                </div>
                <Row
                  label="Customer receivable"
                  sub="Sale due (branch-scoped when a branch is selected) + manual customer due"
                  value={data.assets.customerReceivable}
                  indent
                  valueClass="text-blue-600"
                />
                {(data.assets.customerInvoiceDue > 0 || data.assets.customerManualDue > 0) && (
                  <>
                    <Row
                      label="  └ Invoice due"
                      value={data.assets.customerInvoiceDue}
                      indent
                      valueClass="text-muted-foreground"
                    />
                    <Row
                      label="  └ Manual due"
                      value={data.assets.customerManualDue}
                      indent
                      valueClass="text-muted-foreground"
                    />
                  </>
                )}
                <Row
                  label="Retailer / wholesale receivable"
                  sub="Not tracked in this ledger"
                  value={data.assets.retailerReceivable}
                  indent
                  valueClass="text-blue-600"
                />
                <Row
                  label="Employee advance receivable"
                  sub="Not tracked in this ledger"
                  value={data.assets.employeeAdvanceReceivable ?? 0}
                  indent
                  valueClass="text-cyan-600"
                />
                <Row
                  label="Supplier advance (prepayment)"
                  sub="Advance paid to suppliers"
                  value={data.assets.supplierAdvanceReceivable ?? 0}
                  indent
                  valueClass="text-cyan-600"
                />
              </div>

              <div className="mb-3 mt-2">
                <div className="mb-2 flex items-center gap-2">
                  <Package className="h-4 w-4 text-amber-600" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Inventory</span>
                </div>
                <Row
                  label="Inventory (at cost)"
                  sub="From batches: available quantity × unit cost"
                  value={data.assets.inventoryValue}
                  indent
                  valueClass="text-amber-600"
                />
              </div>

              <div className="mt-4 border-t-2 border-emerald-500/40 pt-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">Total assets</span>
                  <span className="text-xl font-bold text-emerald-600">{fmtTb(data.assets.totalAssets)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {/* Liabilities */}
            <div className={cn(INVENTORY_CARD_SHELL, "border-rose-500/25")}>
              <div className="border-b border-border/60 bg-rose-500/10 p-4 sm:p-5">
                <h2 className="m-0 flex items-center gap-2 text-lg font-semibold text-foreground">
                  <TrendingDown className="h-5 w-5 text-rose-600" />
                  Liabilities
                </h2>
                <p className="m-0 mt-1 text-xs text-muted-foreground">Payables and customer advances</p>
              </div>
              <div className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-rose-600" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payables</span>
                </div>
                <Row
                  label="Supplier payable"
                  sub="Sum of supplier total due"
                  value={data.liabilities.supplierPayable}
                  indent
                  valueClass="text-rose-600"
                />

                <div className="mb-2 mt-3 flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-orange-600" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Advances</span>
                </div>
                <Row
                  label="Customer advance"
                  sub="Customer wallet / advance not yet applied"
                  value={data.liabilities.customerAdvance}
                  indent
                  valueClass="text-orange-600"
                />
                <Row
                  label="Retailer advance"
                  sub="Not tracked in this ledger"
                  value={data.liabilities.retailerAdvance}
                  indent
                  valueClass="text-orange-600"
                />

                <div className="mb-2 mt-3 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-fuchsia-600" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Other</span>
                </div>
                <Row
                  label="Cash deposit payable"
                  sub="Not tracked in this ledger"
                  value={data.liabilities.cashDepositPayable ?? 0}
                  indent
                  valueClass="text-fuchsia-600"
                />

                <div className="mb-2 mt-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-600" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payroll</span>
                </div>
                <Row
                  label="Salary due"
                  sub="Not tracked in this ledger"
                  value={data.liabilities.salaryDue}
                  indent
                  valueClass="text-purple-600"
                />

                <div className="mt-4 border-t-2 border-rose-500/40 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">Total liabilities</span>
                    <span className="text-xl font-bold text-rose-600">{fmtTb(data.liabilities.totalLiabilities)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Owner's equity */}
            <div className={cn(INVENTORY_CARD_SHELL, "border-indigo-500/25")}>
              <div className="border-b border-border/60 bg-indigo-500/10 p-4 sm:p-5">
                <h2 className="m-0 flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Building2 className="h-5 w-5 text-indigo-600" />
                  Owner&apos;s equity
                </h2>
                <p className="m-0 mt-1 text-xs text-muted-foreground">Opening capital and accumulated results</p>
              </div>
              <div className="p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-teal-600" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Initial capital</span>
                </div>
                <Row
                  label="Cash / bank opening capital"
                  sub="Sum of opening balances on cash, bank, and mobile accounts"
                  value={data.equity.totalOpeningCapital}
                  indent
                  valueClass="text-teal-600"
                />
                {(data.equity.openingInventoryCapitalSupplierDueOffset ?? 0) > 0 && (
                  <>
                    <Row
                      label="Opening inventory capital (gross)"
                      sub="Initial stock at cost; supplier-funded slice is subtracted using cumulative posted Due (capped at this gross)"
                      value={data.equity.openingInventoryCapitalGross ?? 0}
                      indent
                      valueClass="text-muted-foreground"
                    />
                    <Row
                      label="Less: supplier due linked to opening stock"
                      sub={
                        (data.equity.openingInventorySupplierDuePostedTotal ?? 0) >
                        (data.equity.openingInventoryCapitalSupplierDueOffset ?? 0)
                          ? `Posted ${fmtTb(data.equity.openingInventorySupplierDuePostedTotal ?? 0)} total; only ${fmtTb(data.equity.openingInventoryCapitalSupplierDueOffset ?? 0)} reduces opening inventory equity (seller cap).`
                          : "Total posted opening-stock Due (unchanged when you pay supplier — cash and supplier payable already reflect payment)"
                      }
                      value={-(data.equity.openingInventoryCapitalSupplierDueOffset ?? 0)}
                      indent
                      valueClass="text-amber-600"
                    />
                  </>
                )}
                <Row
                  label="Opening inventory capital"
                  sub={
                    (data.equity.openingInventoryCapitalSupplierDueOffset ?? 0) > 0
                      ? "Net after opening-stock supplier due (used in equity total)"
                      : "Initial stock added via Add to Store (owner in-kind contribution)"
                  }
                  value={data.equity.openingInventoryCapital ?? 0}
                  indent
                  valueClass="text-teal-600"
                />
                {(data.equity.netStockAdjustment ?? 0) !== 0 && (
                  <Row
                    label="Net stock adjustment"
                    value={data.equity.netStockAdjustment ?? 0}
                    indent
                    valueClass={(data.equity.netStockAdjustment ?? 0) >= 0 ? "text-teal-600" : "text-rose-600"}
                  />
                )}

                <div className="mb-2 mt-3 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-indigo-600" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    All-time P&amp;L
                  </span>
                </div>
                <Row
                  label="Total revenue (net)"
                  sub="Completed sales (grand total) + income − sale-return refunds + return gain"
                  value={data.equity.totalRevenue}
                  indent
                  valueClass="text-emerald-600"
                />
                <Row
                  label="Total expense"
                  sub="COGS from sold lines (same basis as profit report) minus return COGS, plus operating expenses"
                  value={data.equity.totalExpense}
                  indent
                  valueClass="text-rose-600"
                />
                <Row
                  label="Cumulative net profit"
                  value={data.equity.cumulativeNetProfit}
                  indent
                  bold
                  valueClass={data.equity.cumulativeNetProfit >= 0 ? "text-emerald-600" : "text-rose-600"}
                />

                <div className="mb-2 mt-3 flex items-center gap-2">
                  <ArrowDownCircle className="h-4 w-4 text-amber-600" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Drawings</span>
                </div>
                <Row
                  label="Profit withdrawn"
                  sub="Not tracked in this ledger"
                  value={data.equity.totalProfitWithdrawn}
                  indent
                  valueClass="text-amber-600"
                />

                <Row
                  label="Retained earnings"
                  sub="Net profit minus drawings and accruals"
                  value={data.equity.retainedEarnings}
                  indent
                  valueClass={data.equity.retainedEarnings >= 0 ? "text-indigo-600" : "text-rose-600"}
                />
                {(data.equity.salaryAccrual ?? 0) > 0 && (
                  <Row
                    label="Salary accrual (unpaid)"
                    value={-(data.equity.salaryAccrual ?? 0)}
                    indent
                    valueClass="text-amber-600"
                  />
                )}

                <div className="mt-4 border-t-2 border-indigo-500/40 pt-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="font-bold text-foreground">Total owner&apos;s equity</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        Opening capital + opening inventory capital + adjustments + retained earnings
                      </span>
                    </div>
                    <span
                      className={`text-xl font-bold ${data.equity.totalOwnerEquity >= 0 ? "text-indigo-600" : "text-rose-600"}`}
                    >
                      {fmtTb(data.equity.totalOwnerEquity)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Balance verification */}
          <div
            className={cn(
              INVENTORY_CARD_SHELL,
              "xl:col-span-2",
              data.summary.isBalanced
                ? "border-emerald-500/35 bg-emerald-500/[0.07]"
                : "border-red-500/35 bg-red-500/[0.07]",
            )}
          >
            <div
              className={`border-b p-4 ${data.summary.isBalanced ? "border-emerald-500/30" : "border-red-500/30"}`}
            >
              <h2 className="m-0 flex items-center gap-2 text-lg font-semibold text-foreground">
                {data.summary.isBalanced ? (
                  <CheckCircle className="h-6 w-6 text-emerald-600" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-600" />
                )}
                Balance verification
              </h2>
              <p className="m-0 mt-1 text-xs text-muted-foreground">
                Assets = Liabilities + Owner&apos;s equity. A non-zero difference usually means opening inventory capital,
                drawings, or other off–ledger items are not yet modeled.
              </p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                  <div className="mb-1 text-xs text-muted-foreground">Total assets</div>
                  <div className="text-lg font-bold text-emerald-600">{fmtTb(data.summary.totalAssets)}</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                  <div className="mb-1 text-xs text-muted-foreground">Total liabilities</div>
                  <div className="text-lg font-bold text-rose-600">{fmtTb(data.summary.totalLiabilities)}</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                  <div className="mb-1 text-xs text-muted-foreground">Net worth (A − L)</div>
                  <div className={`text-lg font-bold ${data.summary.netWorth >= 0 ? "text-indigo-600" : "text-red-600"}`}>
                    {fmtTb(data.summary.netWorth)}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-card p-4 text-center">
                  <div className="mb-1 text-xs text-muted-foreground">Owner&apos;s equity</div>
                  <div
                    className={`text-lg font-bold ${
                      (data.summary.totalOwnerEquity ?? data.summary.retainedEarnings) >= 0 ? "text-indigo-600" : "text-red-600"
                    }`}
                  >
                    {fmtTb(data.summary.totalOwnerEquity ?? data.summary.retainedEarnings)}
                  </div>
                </div>
              </div>

              <div className="mt-4 text-center">
                {data.summary.isBalanced ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle className="h-4 w-4" />
                    Balanced — net worth equals owner&apos;s equity
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-700 dark:text-red-400">
                      <XCircle className="h-4 w-4" />
                      Out of balance — gap (net worth − equity) ={" "}
                      {fmtTb(
                        Number(data.summary.netWorth) - Number(data.summary.totalOwnerEquity),
                      )}
                    </div>
                    <p className="max-w-lg text-center text-xs text-muted-foreground">
                      When books match, this gap should be ৳0. If not, review opening inventory, supplier “opening stock”
                      due, and other off-ledger items.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
