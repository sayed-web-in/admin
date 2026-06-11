"use client";

import { AdminAuthGuard } from "@/components/auth/AdminAuthGuard";
import { AdminHeader } from "@/components/layout/Header";
import { POSPage } from "@/components/sales/POSPage";

export default function StandalonePOSPage() {
  return (
    <AdminAuthGuard>
      <div className="h-screen flex flex-col overflow-hidden">
        <AdminHeader showSidebarToggle={false} />
        <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <POSPage />
        </main>
      </div>
    </AdminAuthGuard>
  );
}
