"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  Warehouse,
  ShoppingCart,
  Receipt,
  Users,
  Wallet,
  Building2,
  ClipboardList,
  BarChart3,
  Trash2,
  Settings,
  ChevronDown,
  ChevronRight,
  Plus,
  List,
  AlertTriangle,
  Tags,
  Layers,
  Ruler,
  Puzzle,
  Barcode,
  QrCode,
  ArrowLeftRight,
  Download,
  Upload,
  CreditCard,
  Clock,
  Wrench,
  History,
  RotateCcw,
  Hash,
  Store,
  ShoppingBag,
  Image,
  ClipboardList as OrdersIcon,
  UserPlus,
  UserCheck,
  DollarSign,
  TrendingUp,
  BookOpen,
  FileText,
  PieChart,
  PanelLeft,
  PanelLeftClose,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface MenuItem {
  label: string;
  href?: string;
  icon: LucideIcon;
  children?: MenuItem[];
}

const menuItems: MenuItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  {
    label: "Inventory",
    icon: Package,
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
    label: "Stock",
    icon: Warehouse,
    children: [
      { label: "Stock Adjustment", href: "/stock/adjustment", icon: ArrowLeftRight },
      { label: "Stock Export", href: "/stock/export", icon: Download },
      { label: "Stock Transfer", href: "/stock/transfer", icon: Upload },
    ],
  },
  {
    label: "Sales & POS",
    icon: ShoppingCart,
    children: [
      { label: "POS", href: "/pos", icon: CreditCard },
      { label: "Pay Later", href: "/sales/pay-later", icon: Clock },
      { label: "Services", href: "/sales/services", icon: Wrench },
      { label: "Sales History", href: "/sales/history", icon: History },
      { label: "Sales Return", href: "/sales/return", icon: RotateCcw },
      { label: "Serial Number", href: "/sales/serial", icon: Hash },
    ],
  },
  {
    label: "Purchases",
    icon: Receipt,
    children: [
      { label: "Purchases", href: "/purchases", icon: Store },
      { label: "Purchase Return", href: "/purchases/return", icon: RotateCcw },
      { label: "Purchase Products", href: "/purchases/products", icon: Package },
    ],
  },
  {
    label: "Contacts",
    icon: Users,
    children: [
      { label: "Customers", href: "/contacts/customers", icon: UserPlus },
      { label: "Suppliers", href: "/contacts/suppliers", icon: UserCheck },
    ],
  },
  {
    label: "Finance & Accounts",
    icon: Wallet,
    children: [
      {
        label: "Expenses",
        icon: DollarSign,
        children: [
          { label: "Expenses", href: "/finance/expenses", icon: DollarSign },
          { label: "Category", href: "/finance/expenses/categories", icon: Layers },
        ],
      },
      {
        label: "Income",
        icon: TrendingUp,
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
  {
    label: "Ecommerce",
    icon: ShoppingBag,
    children: [
      { label: "Banner", href: "/ecommerce/banners", icon: Image },
      { label: "Orders", href: "/ecommerce/orders", icon: OrdersIcon },
    ],
  },
  {
    label: "Reports",
    icon: BarChart3,
    children: [
      { label: "Sales Report", href: "/reports/sales", icon: BarChart3 },
      { label: "Purchase Report", href: "/reports/purchase", icon: BarChart3 },
      { label: "Stock Report", href: "/reports/stock", icon: BarChart3 },
      {
        label: "Supplier Report",
        icon: BarChart3,
        children: [
          { label: "Supplier Report", href: "/reports/supplier", icon: BarChart3 },
          { label: "Supplier Due", href: "/reports/supplier-due", icon: BarChart3 },
        ],
      },
      {
        label: "Customer Report",
        icon: BarChart3,
        children: [
          { label: "Customer Report", href: "/reports/customer", icon: BarChart3 },
          { label: "Customer Due", href: "/reports/customer-due", icon: BarChart3 },
        ],
      },
      {
        label: "Product Report",
        icon: BarChart3,
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
    label: "Settings",
    icon: Settings,
    children: [
      {
        label: "Financial Settings",
        icon: Settings,
        children: [{ label: "Tax Rates", href: "/settings/tax-rates", icon: Settings }],
      },
      { label: "Profile", href: "/settings/profile", icon: Settings },
    ],
  },
];

function pathActive(pathname: string, href?: string) {
  if (!href) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function subtreeActive(pathname: string, item: MenuItem): boolean {
  if (pathActive(pathname, item.href)) return true;
  return item.children?.some((c) => subtreeActive(pathname, c)) ?? false;
}

function FlyoutLinks({
  item,
  pathname,
  depth,
  onPick,
}: {
  item: MenuItem;
  pathname: string;
  depth?: number;
  onPick: () => void;
}) {
  const pad = 8 + (depth ?? 0) * 10;
  if (item.href && (!item.children || item.children.length === 0)) {
    const active = pathActive(pathname, item.href);
    return (
      <Link
        href={item.href}
        onClick={onPick}
        className={cn(
          "block rounded-lg py-2 text-sm transition-colors",
          active
            ? "bg-primary/10 font-medium text-primary"
            : "text-foreground hover:bg-muted"
        )}
        style={{ paddingLeft: pad, paddingRight: 12 }}
      >
        {item.label}
      </Link>
    );
  }
  if (item.children?.length) {
    return (
      <div className="py-0.5">
        <div
          className="px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground"
          style={{ paddingLeft: pad }}
        >
          {item.label}
        </div>
        <div className="space-y-0.5">
          {item.children.map((c) => (
            <FlyoutLinks
              key={c.label}
              item={c}
              pathname={pathname}
              depth={(depth ?? 0) + 1}
              onPick={onPick}
            />
          ))}
        </div>
      </div>
    );
  }
  return null;
}

function CollapsedFlyout({
  open,
  anchor,
  item,
  pathname,
  onClose,
  onPick,
}: {
  open: boolean;
  anchor: HTMLElement | null;
  item: MenuItem;
  pathname: string;
  onClose: () => void;
  onPick: () => void;
}) {
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open || !anchor) return;
    const r = anchor.getBoundingClientRect();
    const left = Math.min(r.right + 8, window.innerWidth - 280);
    setPos({ top: Math.max(8, r.top), left });
  }, [open, anchor]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <>
      <button
        type="button"
        className="fixed inset-0 z-[90] cursor-default bg-black/40 backdrop-blur-[1px] lg:bg-black/20"
        aria-label="Close menu"
        onClick={onClose}
      />
      <div
        className="fixed z-[100] max-h-[min(72vh,440px)] w-[min(17rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-xl border border-border bg-card py-2 shadow-2xl ring-1 ring-black/5"
        style={{ top: pos.top, left: pos.left }}
        role="menu"
      >
        <div className="border-b border-border px-3 py-2 text-sm font-semibold text-foreground">
          {item.label}
        </div>
        <div className="p-1.5">
          {item.children?.map((c) => (
            <FlyoutLinks key={c.label} item={c} pathname={pathname} onPick={onPick} />
          ))}
        </div>
      </div>
    </>,
    document.body
  );
}

function SidebarItem({
  item,
  depth,
  collapsedDesktop,
  pathname,
  onMobileNav,
  flyout,
  setFlyout,
}: {
  item: MenuItem;
  depth?: number;
  collapsedDesktop: boolean;
  pathname: string;
  onMobileNav?: () => void;
  flyout: { key: string; anchor: HTMLElement } | null;
  setFlyout: (v: { key: string; anchor: HTMLElement } | null) => void;
}) {
  const d = depth ?? 0;
  const [open, setOpen] = useState(false);
  const hasChildren = Boolean(item.children?.length);
  const isActive = pathActive(pathname, item.href);
  const childActive = hasChildren && subtreeActive(pathname, item);
  const expanded = open || childActive;
  const Icon = item.icon;

  const closeFlyout = useCallback(() => setFlyout(null), [setFlyout]);
  const pick = useCallback(() => {
    closeFlyout();
    onMobileNav?.();
  }, [closeFlyout, onMobileNav]);

  const flyoutOpen = flyout?.key === item.label;

  if (hasChildren && collapsedDesktop) {
    return (
      <div className="relative">
        <button
          type="button"
          title={item.label}
          aria-expanded={flyoutOpen}
          onClick={(e) => {
            if (flyout?.key === item.label) setFlyout(null);
            else setFlyout({ key: item.label, anchor: e.currentTarget });
          }}
          className={cn(
            "flex w-full items-center justify-center rounded-xl p-2.5 transition-colors",
            childActive
              ? "bg-primary/12 text-primary shadow-sm ring-1 ring-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Icon className="size-[1.35rem] shrink-0" strokeWidth={1.75} />
        </button>
        <CollapsedFlyout
          open={flyoutOpen}
          anchor={flyoutOpen && flyout ? flyout.anchor : null}
          item={item}
          pathname={pathname}
          onClose={closeFlyout}
          onPick={pick}
        />
      </div>
    );
  }

  if (hasChildren) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors",
            childActive
              ? "bg-primary/10 font-medium text-primary"
              : "text-foreground hover:bg-muted/80"
          )}
          style={{ paddingLeft: 12 + d * 12 }}
        >
          <Icon className="size-[1.125rem] shrink-0" strokeWidth={1.75} />
          <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
          {expanded ? (
            <ChevronDown className="size-4 shrink-0 opacity-70" />
          ) : (
            <ChevronRight className="size-4 shrink-0 opacity-70" />
          )}
        </button>
        {expanded && (
          <div className="mt-0.5 space-y-0.5 border-l border-border/60 ml-3 pl-1">
            {item.children!.map((child) => (
              <SidebarItem
                key={child.label}
                item={child}
                depth={d + 1}
                collapsedDesktop={collapsedDesktop}
                pathname={pathname}
                onMobileNav={onMobileNav}
                flyout={flyout}
                setFlyout={setFlyout}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (item.href) {
    const isPOSStandaloneLink = item.href === "/pos";
    if (collapsedDesktop) {
      if (isPOSStandaloneLink) {
        return (
          <a
            href={item.href}
            title={item.label}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex items-center justify-center rounded-xl p-2.5 transition-colors text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-[1.35rem] shrink-0" strokeWidth={1.75} />
          </a>
        );
      }
      return (
        <Link
          href={item.href}
          title={item.label}
          onClick={onMobileNav}
          className={cn(
            "flex items-center justify-center rounded-xl p-2.5 transition-colors",
            isActive
              ? "bg-primary/12 text-primary shadow-sm ring-1 ring-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          <Icon className="size-[1.35rem] shrink-0" strokeWidth={1.75} />
        </Link>
      );
    }
    if (isPOSStandaloneLink) {
      return (
        <a
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors text-foreground hover:bg-muted/80"
          )}
          style={{ paddingLeft: 12 + d * 12 }}
        >
          <Icon className="size-[1.125rem] shrink-0" strokeWidth={1.75} />
          <span className="truncate">{item.label}</span>
        </a>
      );
    }
    return (
      <Link
        href={item.href}
        onClick={onMobileNav}
        className={cn(
          "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors",
          isActive
            ? "bg-primary/10 font-medium text-primary"
            : "text-foreground hover:bg-muted/80"
        )}
        style={{ paddingLeft: 12 + d * 12 }}
      >
        <Icon className="size-[1.125rem] shrink-0" strokeWidth={1.75} />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  }

  return null;
}

export interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onMobileOpenChange,
}: SidebarProps) {
  const pathname = usePathname();
  const [isLg, setIsLg] = useState(true);
  const [flyout, setFlyout] = useState<{
    key: string;
    anchor: HTMLElement;
  } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const fn = () => setIsLg(mq.matches);
    fn();
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  useEffect(() => {
    if (!isLg) setFlyout(null);
  }, [isLg]);

  useEffect(() => {
    if (!mobileOpen) setFlyout(null);
  }, [mobileOpen]);

  useEffect(() => {
    setFlyout(null);
  }, [pathname]);

  const collapsedDesktop = collapsed && isLg;

  const closeMobile = useCallback(() => onMobileOpenChange(false), [onMobileOpenChange]);

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="fixed bottom-0 left-0 right-0 top-16 z-[50] bg-black/45 backdrop-blur-[2px] transition-opacity duration-300 ease-out lg:hidden"
          aria-label="Close sidebar"
          onClick={closeMobile}
        />
      )}

      <aside
        className={cn(
          "sidebar-shell fixed left-0 z-[55] flex w-[min(18rem,calc(100vw-2.5rem))] flex-col border-r border-border bg-card shadow-[4px_0_24px_-8px_rgba(0,0,0,0.08)]",
          /* Mobile: under header (4rem / h-16), smooth horizontal slide */
          "top-16 h-[calc(100dvh-4rem)] max-h-[calc(100dvh-4rem)] transition-[transform] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform",
          "lg:top-0 lg:z-50 lg:h-dvh lg:max-h-screen lg:will-change-auto lg:transition-[transform,width] lg:duration-200 lg:ease-out",
          collapsedDesktop ? "lg:w-[4.5rem]" : "lg:w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        {/* Sticky header: same height as main AdminHeader (h-16) */}
        <div className="flex h-16 shrink-0 items-center border-b border-border bg-card/95 px-3 backdrop-blur-md supports-[backdrop-filter]:bg-card/80">
          {!collapsedDesktop ? (
            <>
              <Link
                href="/"
                onClick={closeMobile}
                className="flex min-w-0 flex-1 flex-col justify-center rounded-xl px-1 py-0.5 leading-tight transition-opacity hover:opacity-90"
              >
                <span className="block truncate text-sm font-bold tracking-tight text-foreground">
                  Future <span className="text-primary">Tech</span>
                </span>
                <span className="text-[0.65rem] font-medium uppercase tracking-widest text-muted-foreground">
                  Admin
                </span>
              </Link>
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  className="hidden rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:flex"
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <PanelLeftClose className="size-5" strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  onClick={closeMobile}
                  className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden"
                  aria-label="Close menu"
                >
                  <X className="size-5" />
                </button>
              </div>
            </>
          ) : (
            <div className="flex w-full items-center justify-center">
              <button
                type="button"
                onClick={onToggleCollapse}
                className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <PanelLeft className="size-5" strokeWidth={1.5} />
              </button>
            </div>
          )}
        </div>

        <nav
          className={cn(
            "min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 scroll-smooth",
            collapsedDesktop ? "space-y-1.5 px-1.5" : "space-y-0.5"
          )}
        >
          {menuItems.map((item) => (
            <SidebarItem
              key={item.label}
              item={item}
              collapsedDesktop={collapsedDesktop}
              pathname={pathname}
              onMobileNav={closeMobile}
              flyout={flyout}
              setFlyout={setFlyout}
            />
          ))}
        </nav>
      </aside>
    </>
  );
}
