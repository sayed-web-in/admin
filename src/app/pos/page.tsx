"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminHeader } from "@/components/layout/Header";
import { POSPage } from "@/components/sales/POSPage";
import { getAdminToken } from "@/lib/auth";

export default function StandalonePOSPage() {
  const router = useRouter();

  useEffect(() => {
    if (!getAdminToken()) {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <AdminHeader showSidebarToggle={false} />
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <POSPage />
      </main>
    </div>
  );
}
