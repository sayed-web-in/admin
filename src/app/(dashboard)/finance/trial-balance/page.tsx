"use client";

import { useEffect, useState } from "react";
import { BookOpen, TrendingUp, TrendingDown, Scale, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";

interface TrialBalanceAccount {
  id: number;
  name: string;
  accountNumber: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
}

interface TrialBalanceData {
  accounts: TrialBalanceAccount[];
  totalDebit: number;
  totalCredit: number;
  totalAssets: number;
  netBalance: number;
}

export default function TrialBalancePage() {
  const [data, setData] = useState<TrialBalanceData | null>(null);
  const [loading, setLoading] = useState(true);

  const branchId = getSelectedBranch();

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", String(branchId));
      const res = await apiFetch<TrialBalanceData>(`/finance/trial-balance?${params}`);
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [branchId]);

  const accounts = data?.accounts || [];
  const cashAccounts = accounts.filter((a) => a.type === "Cash");
  const bankAccounts = accounts.filter((a) => a.type === "Bank");
  const mobileAccounts = accounts.filter((a) => a.type === "Mobile Banking");

  const renderAccountSection = (title: string, items: TrialBalanceAccount[]) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-4">{title}</h3>
        <div className="divide-y divide-border">
          {items.map((acc) => (
            <div key={acc.id} className="flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors">
              <div>
                <p className="text-sm font-medium text-foreground">{acc.name}</p>
                <p className="text-xs text-muted-foreground">{acc.accountNumber}</p>
              </div>
              <div className="flex items-center gap-8 text-sm">
                <div className="text-right w-28">
                  <p className="text-xs text-muted-foreground">Debit</p>
                  <p className="font-medium">{formatPrice(acc.debit)}</p>
                </div>
                <div className="text-right w-28">
                  <p className="text-xs text-muted-foreground">Credit</p>
                  <p className="font-medium">{formatPrice(acc.credit)}</p>
                </div>
                <div className="text-right w-32">
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className={`font-semibold ${acc.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatPrice(acc.balance)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Trial Balance"
        description="Overview of all account balances"
        action={
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw size={16} className={`mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard title="Total Assets" value={formatPrice(data?.totalAssets || 0)} icon={BookOpen} />
        <StatCard title="Total Debits" value={formatPrice(data?.totalDebit || 0)} icon={TrendingDown} />
        <StatCard title="Total Credits" value={formatPrice(data?.totalCredit || 0)} icon={TrendingUp} />
        <StatCard title="Net Balance" value={formatPrice(data?.netBalance || 0)} icon={Scale} />
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center text-muted-foreground">Loading...</div>
      ) : !data ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center text-muted-foreground">Failed to load trial balance data.</div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/50">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Account Balances</h2>
              <div className="flex items-center gap-8 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <span className="w-28 text-right">Debit</span>
                <span className="w-28 text-right">Credit</span>
                <span className="w-32 text-right">Balance</span>
              </div>
            </div>
          </div>

          {renderAccountSection("Cash Accounts", cashAccounts)}
          {renderAccountSection("Bank Accounts", bankAccounts)}
          {renderAccountSection("Mobile Banking", mobileAccounts)}

          <div className="border-t-2 border-border px-4 py-4 bg-muted/30">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">Total</p>
              <div className="flex items-center gap-8 text-sm">
                <div className="text-right w-28">
                  <p className="font-bold">{formatPrice(data.totalDebit)}</p>
                </div>
                <div className="text-right w-28">
                  <p className="font-bold">{formatPrice(data.totalCredit)}</p>
                </div>
                <div className="text-right w-32">
                  <p className={`font-bold ${data.netBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatPrice(data.netBalance)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
