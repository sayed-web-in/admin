"use client";

import { useEffect, useState } from "react";
import { ArrowUpCircle, ArrowDownCircle, Activity, Search } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { DataTable } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";

interface MonthlyBreakdown {
  month: string;
  inflow: number;
  outflow: number;
  net: number;
}

interface CashFlowData {
  totalInflow: number;
  totalOutflow: number;
  netCashFlow: number;
  monthly: MonthlyBreakdown[];
}

export default function CashFlowPage() {
  const [data, setData] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState(false);

  const now = new Date();
  const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const today = now.toISOString().slice(0, 10);

  const [dateFrom, setDateFrom] = useState(firstDay);
  const [dateTo, setDateTo] = useState(today);

  const branchId = getSelectedBranch();

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", String(branchId));
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await apiFetch<CashFlowData>(`/finance/cash-flow?${params}`);
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [branchId]);

  const monthly = data?.monthly || [];

  const columns = [
    { key: "month", label: "Month", render: (m: MonthlyBreakdown) => <span className="font-medium">{m.month}</span> },
    {
      key: "inflow",
      label: "Inflow",
      render: (m: MonthlyBreakdown) => <span className="text-green-600 font-semibold">{formatPrice(m.inflow)}</span>,
    },
    {
      key: "outflow",
      label: "Outflow",
      render: (m: MonthlyBreakdown) => <span className="text-red-600 font-semibold">{formatPrice(m.outflow)}</span>,
    },
    {
      key: "net",
      label: "Net",
      render: (m: MonthlyBreakdown) => (
        <span className={`font-bold ${m.net >= 0 ? "text-green-600" : "text-red-600"}`}>
          {formatPrice(m.net)}
        </span>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6">
      <PageHeader title="Cash Flow" description="Cash flow analysis over time" />

      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 mb-6">
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">From</label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-auto" />
        </div>
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">To</label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-auto" />
        </div>
        <Button onClick={fetchData} disabled={loading}>
          <Search size={16} className="mr-1.5" /> {loading ? "Loading..." : "Generate"}
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Total Inflow"
          value={formatPrice(data?.totalInflow || 0)}
          icon={ArrowUpCircle}
          className="border-l-4 border-l-green-500"
        />
        <StatCard
          title="Total Outflow"
          value={formatPrice(data?.totalOutflow || 0)}
          icon={ArrowDownCircle}
          className="border-l-4 border-l-red-500"
        />
        <StatCard
          title="Net Cash Flow"
          value={formatPrice(data?.netCashFlow || 0)}
          icon={Activity}
          className={`border-l-4 ${(data?.netCashFlow || 0) >= 0 ? "border-l-green-500" : "border-l-red-500"}`}
        />
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center text-muted-foreground">Loading...</div>
      ) : !data ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center text-muted-foreground">
          Select a date range and click Generate to view cash flow.
        </div>
      ) : monthly.length > 0 ? (
        <>
          <h2 className="text-lg font-semibold text-foreground mb-3">Monthly Breakdown</h2>
          <DataTable columns={columns} data={monthly} />
        </>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/50">
            <h2 className="text-sm font-semibold text-foreground">Summary</h2>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Inflow</p>
                <p className="text-xl font-bold text-green-600">{formatPrice(data.totalInflow)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Outflow</p>
                <p className="text-xl font-bold text-red-600">{formatPrice(data.totalOutflow)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Net</p>
                <p className={`text-xl font-bold ${data.netCashFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatPrice(data.netCashFlow)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
