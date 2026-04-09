"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Package, Warehouse, ShoppingCart, Receipt, Users, Wallet, Building2, ClipboardList, BarChart3, Trash2, Settings, ChevronDown, ChevronRight, Plus, List, AlertTriangle, Tags, Layers, Ruler, Puzzle, Barcode, QrCode, ArrowLeftRight, Download, Upload, CreditCard, Clock, Wrench, History, RotateCcw, Hash, Store, UserPlus, UserCheck, DollarSign, TrendingUp, BookOpen, FileText, PieChart, Archive
} from "lucide-react";

interface MenuItem {
  label: string;
  href?: string;
  icon: any;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  {
    label: "Inventory", icon: Package,
    children: [
      { label: "Add Product", href: "/inventory/add-product", icon: Plus },
      { label: "Manage Product", href: "/inventory/manage-product", icon: List },
      { label: "Low Stock", href: "/inventory/low-stock", icon: AlertTriangle },
      { label: "Brand Management", href: "/inventory/brands", icon: Tags },
      { label: "Category Management", href: "/inventory/categories", icon: Layers },
      { label: "Unit Management", href: "/inventory/units", icon: Ruler },
      { label: "Variants & Attributes", href: "/inventory/variants", icon: Puzzle },
      { label: "Print Barcode", href: "/inventory/barcode", icon: Barcode },
      { label: "Print QR Code", href: "/inventory/qrcode", icon: QrCode },
    ],
  },
  {
    label: "Stock", icon: Warehouse,
    children: [
      { label: "Stock Adjustment", href: "/stock/adjustment", icon: ArrowLeftRight },
      { label: "Stock Export", href: "/stock/export", icon: Download },
      { label: "Stock Transfer", href: "/stock/transfer", icon: Upload },
    ],
  },
  {
    label: "Sales & POS", icon: ShoppingCart,
    children: [
      { label: "POS", href: "/sales/pos", icon: CreditCard },
      { label: "Pay Later", href: "/sales/pay-later", icon: Clock },
      { label: "Services", href: "/sales/services", icon: Wrench },
      { label: "Sales History", href: "/sales/history", icon: History },
      { label: "Sales Return", href: "/sales/return", icon: RotateCcw },
      { label: "Serial Number", href: "/sales/serial", icon: Hash },
    ],
  },
  {
    label: "Purchases", icon: Receipt,
    children: [
      { label: "Purchases", href: "/purchases", icon: Store },
      { label: "Purchase Return", href: "/purchases/return", icon: RotateCcw },
      { label: "Purchase Products", href: "/purchases/products", icon: Package },
    ],
  },
  {
    label: "Contacts", icon: Users,
    children: [
      { label: "Customers", href: "/contacts/customers", icon: UserPlus },
      { label: "Suppliers", href: "/contacts/suppliers", icon: UserCheck },
    ],
  },
  {
    label: "Finance & Accounts", icon: Wallet,
    children: [
      {
        label: "Expenses", icon: DollarSign,
        children: [
          { label: "Expenses", href: "/finance/expenses", icon: DollarSign },
          { label: "Category", href: "/finance/expenses/categories", icon: Layers },
        ],
      },
      {
        label: "Income", icon: TrendingUp,
        children: [
          { label: "Income", href: "/finance/income", icon: TrendingUp },
          { label: "Category", href: "/finance/income/categories", icon: Layers },
        ],
      },
      { label: "Accounts List", href: "/finance/accounts", icon: BookOpen },
      { label: "Transactions", href: "/finance/transactions", icon: FileText },
      { label: "Trial Balance", href: "/finance/trial-balance", icon: PieChart },
      { label: "Cash Flow", href: "/finance/cash-flow", icon: TrendingUp },
      { label: "Account Statement", href: "/finance/statement", icon: FileText },
    ],
  },
  { label: "Branch Management", href: "/branches", icon: Building2 },
  { label: "Orders", href: "/orders", icon: ClipboardList },
  {
    label: "Reports", icon: BarChart3,
    children: [
      { label: "Sales Report", href: "/reports/sales", icon: BarChart3 },
      { label: "Purchase Report", href: "/reports/purchase", icon: BarChart3 },
      { label: "Stock Report", href: "/reports/stock", icon: BarChart3 },
      {
        label: "Supplier Report", icon: BarChart3,
        children: [
          { label: "Supplier Report", href: "/reports/supplier", icon: BarChart3 },
          { label: "Supplier Due", href: "/reports/supplier-due", icon: BarChart3 },
        ],
      },
      {
        label: "Customer Report", icon: BarChart3,
        children: [
          { label: "Customer Report", href: "/reports/customer", icon: BarChart3 },
          { label: "Customer Due", href: "/reports/customer-due", icon: BarChart3 },
        ],
      },
      {
        label: "Product Report", icon: BarChart3,
        children: [
          { label: "Product Report", href: "/reports/product", icon: BarChart3 },
          { label: "Product Expiry", href: "/reports/product-expiry", icon: BarChart3 },
          { label: "Product Quantity", href: "/reports/product-quantity", icon: BarChart3 },
        ],
      },
      { label: "Expense Report", href: "/reports/expense", icon: BarChart3 },
      { label: "Income Report", href: "/reports/income", icon: BarChart3 },
      { label: "Profit & Loss", href: "/reports/profit-loss", icon: BarChart3 },
    ],
  },
  { label: "Recycle Bin", href: "/recycle-bin", icon: Trash2 },
  {
    label: "Settings", icon: Settings,
    children: [
      {
        label: "Financial Settings", icon: Settings,
        children: [
          { label: "Tax Rates", href: "/settings/tax-rates", icon: Settings },
        ],
      },
      { label: "Profile", href: "/settings/profile", icon: Settings },
    ],
  },
];

function SidebarItem({ item, depth = 0 }: { item: MenuItem; depth?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const hasChildren = item.children && item.children.length > 0;
  const isActive = item.href === pathname || (item.href && pathname.startsWith(item.href + "/"));

  const isChildActive = hasChildren && item.children!.some(
    (child) => child.href === pathname || (child.href && pathname.startsWith(child.href + "/")) ||
    child.children?.some((sub) => sub.href === pathname || (sub.href && pathname.startsWith(sub.href + "/")))
  );

  const expanded = open || isChildActive;

  const Icon = item.icon;

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setOpen(!expanded)}
          className={cn(
            "w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors",
            isChildActive ? "text-primary bg-primary-light" : "text-foreground hover:bg-muted"
          )}
          style={{ paddingLeft: `${12 + depth * 12}px` }}
        >
          <Icon size={18} />
          <span className="flex-1 text-left">{item.label}</span>
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        {expanded && (
          <div className="mt-0.5 space-y-0.5">
            {item.children!.map((child) => (
              <SidebarItem key={child.label} item={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href || "#"}
      className={cn(
        "flex items-center gap-2.5 px-3 py-2 text-sm rounded-lg transition-colors",
        isActive ? "text-primary bg-primary-light font-medium" : "text-foreground hover:bg-muted"
      )}
      style={{ paddingLeft: `${12 + depth * 12}px` }}
    >
      <Icon size={18} />
      <span>{item.label}</span>
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-border h-screen overflow-y-auto shrink-0 fixed left-0 top-0 z-40 hidden lg:block">
      <div className="p-4 border-b border-border">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold">F</span>
          </div>
          <span className="font-bold text-foreground">Future <span className="text-primary">Tech</span></span>
        </Link>
      </div>
      <nav className="p-3 space-y-0.5">
        {menuItems.map((item) => (
          <SidebarItem key={item.label} item={item} />
        ))}
      </nav>
    </aside>
  );
}
