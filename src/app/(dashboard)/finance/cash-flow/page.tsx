"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpCircle,
  ArrowDownCircle,
  Activity,
  Search,
  RotateCcw,
  LayoutGrid,
  Layers,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice, firstDayOfMonthYmdInDhaka, todayYmdInDhaka } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
  InventorySectionHeader,
} from "@/components/inventory/InventoryCrudLayout";
import { StatCard } from "@/components/common/StatCard";
import { DataTable } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MonthlyRow {
  month: string;
  inflow: number;
  outflow: number;
  net: number;
}

export default function CashFlowPage() {
  const router = useRouter();
  const branchId = getSelectedBranch();
  const firstDay = firstDayOfMonthYmdInDhaka();
  const today = todayYmdInDhaka();

  const [dateFrom, setDateFrom] = useState(firstDay);
  const [dateTo, setDateTo] = useState(today);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState({ totalInflow: 0, totalOutflow: 0, netCashFlow: 0 });
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      if (dateFrom) q.set("dateFrom", dateFrom);
      if (dateTo) q.set("dateTo", dateTo);
      if (branchId) q.set("branchId", String(branchId));
      const raw = (await apiFetch<unknown>(`/finance/cash-flow?${q.toString()}`)) as Record<string, unknown>;

      const totalInflow = Number(raw.totalInflow) || 0;
      const totalOutflow = Number(raw.totalOutflow) || 0;
      const netCashFlow = Number(raw.netFlow ?? raw.netCashFlow) || 0;
      const breakdown = (raw.monthlyBreakdown ?? raw.monthly) as Record<string, unknown> | undefined;
      const rows: MonthlyRow[] = breakdown
        ? Object.entries(breakdown).map(([month, value]) => {
            const v = value as Record<string, unknown>;
            return {
              month,
              inflow: Number(v.inflow) || 0,
              outflow: Number(v.outflow) || 0,
              net: Number(v.net) || 0,
            };
          })
        : [];
      rows.sort((a, b) => a.month.localeCompare(b.month));

      setSummary({ totalInflow, totalOutflow, netCashFlow });
      setMonthly(rows);
    } catch {
      setSummary({ totalInflow: 0, totalOutflow: 0, netCashFlow: 0 });
      setMonthly([]);
    } finally {
      setLoading(false);
    }
  };

  const columns = useMemo(
    () => [
      { key: "month", label: "Month", render: (m: MonthlyRow) => <span className="font-medium">{m.month}</span> },
      { key: "inflow", label: "Inflow", render: (m: MonthlyRow) => <span className="font-semibold text-emerald-600">{formatPrice(m.inflow)}</span> },
      { key: "outflow", label: "Outflow", render: (m: MonthlyRow) => <span className="font-semibold text-red-600">{formatPrice(m.outflow)}</span> },
      {
        key: "net",
        label: "Net",
        render: (m: MonthlyRow) => (
          <span className={`font-bold ${m.net >= 0 ? "text-emerald-600" : "text-red-600"}`}>{formatPrice(m.net)}</span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader icon={Activity} title="Cash Flow" description="Analyze inflow and outflow by date range.">
        <Button type="button" variant="outline" size="sm" className="h-10 w-full rounded-xl sm:h-9 sm:w-auto" onClick={() => router.back()}>
          Back
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-10 w-full gap-2 rounded-xl sm:h-9 sm:w-auto" onClick={fetchData}>
          <RotateCcw className="h-4 w-4" /> Refresh
        </Button>
      </InventoryListPageHeader>

      <section className={INVENTORY_CARD_SHELL}>
        <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
          <InventorySectionHeader compact icon={Search} title="Generate cash flow" description="Pick a date range and run report." />
        </div>
        <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end sm:p-6 md:p-7">
          <div>
            <label className="mb-1.5 block text-sm font-medium">From</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 rounded-xl" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium">To</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 rounded-xl" />
          </div>
          <Button onClick={fetchData} disabled={loading} className="h-10 gap-2 rounded-xl">
            <Search className="h-4 w-4" /> {loading ? "Loading..." : "Generate"}
          </Button>
        </div>
      </section>

      <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7`}>
        <InventorySectionHeader icon={LayoutGrid} title="Overview" description="Totals for selected range." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard title="Total Inflow" value={formatPrice(summary.totalInflow)} icon={ArrowUpCircle} />
          <StatCard title="Total Outflow" value={formatPrice(summary.totalOutflow)} icon={ArrowDownCircle} />
          <StatCard title="Net Cash Flow" value={formatPrice(summary.netCashFlow)} icon={Activity} />
        </div>
      </section>

      <section className={INVENTORY_CARD_SHELL}>
        <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
          <InventorySectionHeader compact icon={Layers} title="Monthly breakdown" description="Grouped by month from API response." />
        </div>
        <div className="p-5 sm:p-6 md:p-7">
          <DataTable columns={columns} data={monthly} loading={loading} inventoryStyle />
        </div>
      </section>
    </div>
  );
}
