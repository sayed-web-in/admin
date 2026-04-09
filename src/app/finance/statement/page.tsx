"use client";

import { useEffect, useState } from "react";
import { FileText, Search } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";

interface Account {
  id: number;
  name: string;
  accountNumber: string;
  type: string;
}

interface StatementTransaction {
  id: number;
  date: string;
  description: string;
  reference: string;
  debit: number;
  credit: number;
  runningBalance: number;
}

interface StatementData {
  account: Account;
  dateFrom: string;
  dateTo: string;
  openingBalance: number;
  closingBalance: number;
  transactions: StatementTransaction[];
}

export default function AccountStatementPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statement, setStatement] = useState<StatementData | null>(null);
  const [loading, setLoading] = useState(false);

  const branchId = getSelectedBranch();

  useEffect(() => {
    const load = async () => {
      try {
        const params = new URLSearchParams();
        if (branchId) params.set("branchId", String(branchId));
        const data = await apiFetch<Account[]>(`/finance/accounts?${params}`);
        setAccounts(data);
      } catch {
        setAccounts([]);
      }
    };
    load();
  }, [branchId]);

  const handleGenerate = async () => {
    if (!selectedAccountId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("accountId", selectedAccountId);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (branchId) params.set("branchId", String(branchId));
      const res = await apiFetch<StatementData>(`/finance/account-statement?${params}`);
      setStatement(res);
    } catch {
      setStatement(null);
    } finally {
      setLoading(false);
    }
  };

  const totalDebit = statement?.transactions.reduce((s, t) => s + t.debit, 0) || 0;
  const totalCredit = statement?.transactions.reduce((s, t) => s + t.credit, 0) || 0;

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Account Statement" description="Generate detailed account statements" />

      <div className="bg-white rounded-xl border border-border p-5 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
          <div className="w-full sm:w-auto sm:min-w-[220px]">
            <label className="text-sm font-medium text-foreground mb-1.5 block">Account</label>
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Select Account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name} ({a.accountNumber})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">From</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-auto" />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">To</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-auto" />
          </div>
          <Button onClick={handleGenerate} disabled={loading || !selectedAccountId}>
            <Search size={16} className="mr-1.5" /> {loading ? "Generating..." : "Generate"}
          </Button>
        </div>
      </div>

      {loading && (
        <div className="bg-white rounded-xl border border-border p-8 text-center text-muted-foreground">
          Generating statement...
        </div>
      )}

      {!loading && statement && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-border p-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">{statement.account.name}</h2>
                <p className="text-sm text-muted-foreground">
                  Account: {statement.account.accountNumber} &middot; Type: {statement.account.type}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Period: {formatDate(statement.dateFrom)} — {formatDate(statement.dateTo)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Opening Balance</p>
                <p className="text-xl font-bold text-foreground">{formatPrice(statement.openingBalance)}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reference</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Debit</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Credit</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {statement.transactions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        No transactions in this period
                      </td>
                    </tr>
                  ) : (
                    statement.transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 text-sm">{formatDate(t.date)}</td>
                        <td className="px-4 py-3 text-sm">{t.description || "—"}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{t.reference || "—"}</td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-red-600">
                          {t.debit > 0 ? formatPrice(t.debit) : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-green-600">
                          {t.credit > 0 ? formatPrice(t.credit) : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold">
                          {formatPrice(t.runningBalance)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-muted/30">
                    <td colSpan={3} className="px-4 py-3 text-sm font-bold text-foreground">Total</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-red-600">{formatPrice(totalDebit)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-green-600">{formatPrice(totalCredit)}</td>
                    <td className="px-4 py-3 text-sm text-right font-bold">{formatPrice(statement.closingBalance)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-border p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground">Closing Balance</span>
              <span className={`text-2xl font-bold ${statement.closingBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatPrice(statement.closingBalance)}
              </span>
            </div>
          </div>
        </div>
      )}

      {!loading && !statement && (
        <div className="bg-white rounded-xl border border-border p-8 text-center">
          <FileText size={48} className="mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">Select an account and date range, then click Generate to view the statement.</p>
        </div>
      )}
    </div>
  );
}
