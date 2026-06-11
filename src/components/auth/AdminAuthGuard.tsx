"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAdminToken, validateAdminSession } from "@/lib/auth";

export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!getAdminToken()) {
        router.replace("/login");
        return;
      }

      const status = await validateAdminSession();
      if (cancelled) return;

      if (status === "ok") {
        setAllowed(true);
        return;
      }

      router.replace("/login");
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30">
        <div
          className="size-10 animate-spin rounded-full border-2 border-primary border-t-transparent"
          aria-label="Checking session"
        />
      </div>
    );
  }

  return <>{children}</>;
}
