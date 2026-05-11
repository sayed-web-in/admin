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
          "main-shell min-h-screen flex flex-col transition-[margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none motion-reduce:duration-0",
          "lg:ml-64",
          hydrated && collapsed && "lg:ml-[4.5rem]"
        )}
      >
        <AdminHeader onToggleSidebar={() => setMobileOpen(true)} />
        <main className="flex-1 min-w-0 px-3 pt-2 pb-4 md:px-4 md:pt-3 md:pb-5">
          {children}
        </main>
      </div>
    </>
  );
}
