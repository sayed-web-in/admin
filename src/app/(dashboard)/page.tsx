"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DollarSign,
  ShoppingCart,
  Package,
  AlertTriangle,
  ArrowRight,
  Plus,
  Monitor,
  ClipboardList,
} from "lucide-react";
import { StatCard } from "@/components/common/StatCard";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/utils";
import { getSelectedBranch } from "@/lib/auth";

interface DashboardStats {
  todayRevenue: number;
  todayOrders: number;
  totalProducts: number;
  lowStockCount: number;
}

interface RecentSale {
  id: number;
  invoice: string;
  customer: string;
  total: number;
  date: string;
}

interface RecentOrder {
  id: number;
  orderNumber: string;
  customer: string;
  status: string;
  total: number;
  date: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    todayRevenue: 0,
    todayOrders: 0,
    totalProducts: 0,
    lowStockCount: 0,
  });
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const branchId = getSelectedBranch();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const today = new Date().toISOString().split("T")[0];
      const params = new URLSearchParams();
      if (branchId) params.set("branchId", String(branchId));

      const [salesRes, stockRes, ordersRes] = await Promise.allSettled([
        apiFetch<any>(`/reports/sales?dateFrom=${today}&dateTo=${today}&${params}`),
        apiFetch<any>(`/reports/stock?${params}`),
        apiFetch<any>(`/orders?status=PENDING&limit=5&${params}`),
      ]);

      const salesData = salesRes.status === "fulfilled" ? salesRes.value : null;
      const stockData = stockRes.status === "fulfilled" ? stockRes.value : null;
      const ordersData = ordersRes.status === "fulfilled" ? ordersRes.value : null;

      setStats({
        todayRevenue: salesData?.revenue || salesData?.totalRevenue || 0,
        todayOrders: salesData?.totalSales || salesData?.sales?.length || 0,
        totalProducts: stockData?.totalProducts || 0,
        lowStockCount: stockData?.lowStock || stockData?.lowStockCount || 0,
      });

      const salesList = salesData?.sales || salesData?.recentSales || [];
      setRecentSales(salesList.slice(0, 5));

      const ordersList = ordersData?.orders || ordersData?.data || (Array.isArray(ordersData) ? ordersData : []);
      setRecentOrders(ordersList.slice(0, 5));

      setLoading(false);
    };
    load();
  }, [branchId]);

  const salesColumns = [
    { key: "invoice", label: "Invoice", render: (r: RecentSale) => <span className="font-medium">{r.invoice || `#${r.id}`}</span> },
    { key: "customer", label: "Customer", render: (r: RecentSale) => r.customer || "Walk-in" },
    { key: "total", label: "Total", render: (r: RecentSale) => formatPrice(r.total) },
    { key: "date", label: "Date", render: (r: RecentSale) => r.date ? formatDate(r.date) : "—" },
  ];

  const orderColumns = [
    { key: "orderNumber", label: "Order #", render: (r: RecentOrder) => <span className="font-medium">{r.orderNumber || `#${r.id}`}</span> },
    { key: "customer", label: "Customer", render: (r: RecentOrder) => r.customer || "—" },
    { key: "status", label: "Status", render: (r: RecentOrder) => <StatusBadge status={r.status} /> },
    { key: "total", label: "Total", render: (r: RecentOrder) => formatPrice(r.total) },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Welcome back! Here&apos;s your business overview for today.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/pos" target="_blank" rel="noopener noreferrer">
            <Button size="sm">
              <Monitor size={16} className="mr-1.5" /> POS
            </Button>
          </Link>
          <Link href="/inventory/add-product">
            <Button variant="outline" size="sm">
              <Plus size={16} className="mr-1.5" /> Add Product
            </Button>
          </Link>
          <Link href="/orders">
            <Button variant="outline" size="sm">
              <ClipboardList size={16} className="mr-1.5" /> Orders
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Today's Revenue"
          value={loading ? "..." : formatPrice(stats.todayRevenue)}
          icon={DollarSign}
        />
        <StatCard
          title="Today's Orders"
          value={loading ? "..." : stats.todayOrders}
          icon={ShoppingCart}
        />
        <StatCard
          title="Total Products"
          value={loading ? "..." : stats.totalProducts}
          icon={Package}
        />
        <StatCard
          title="Low Stock"
          value={loading ? "..." : stats.lowStockCount}
          icon={AlertTriangle}
          className={stats.lowStockCount > 0 ? "ring-1 ring-amber-200" : ""}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground">Recent Sales</h2>
            <Link href="/sales/history" className="text-sm text-primary hover:underline flex items-center gap-1">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          <DataTable columns={salesColumns} data={recentSales} loading={loading} />
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-foreground">Recent Orders</h2>
            <Link href="/orders" className="text-sm text-primary hover:underline flex items-center gap-1">
              View All <ArrowRight size={14} />
            </Link>
          </div>
          <DataTable columns={orderColumns} data={recentOrders} loading={loading} />
        </div>
      </div>
    </div>
  );
}
