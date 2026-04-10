"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "@/components/layout/Sidebar";
import { AdminHeader } from "@/components/layout/Header";

const COLLAPSED_KEY = "admin_sidebar_collapsed";

export function DashboardShell({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  return (
    <>
      <Sidebar
        collapsed={hydrated && collapsed}
        onToggleCollapse={toggleCollapsed}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
      />
      <div
        className={cn(
          "min-h-screen flex flex-col transition-[margin] duration-200 ease-out",
          "lg:ml-64",
          hydrated && collapsed && "lg:ml-[4.5rem]"
        )}
      >
        <AdminHeader onToggleSidebar={() => setMobileOpen(true)} />
        <main className="flex-1 min-w-0 p-4 md:p-6">{children}</main>
      </div>
    </>
  );
}
