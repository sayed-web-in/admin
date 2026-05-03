"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Maximize, Minimize, User, Menu, Store, CreditCard } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import {
  getAdminUser,
  clearAdminAuth,
  getSelectedBranch,
  setSelectedBranch,
} from "@/lib/auth";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Branch {
  id: number;
  name: string;
}

function normalizeBranchesPayload(raw: unknown): Branch[] {
  if (Array.isArray(raw)) return raw as Branch[];
  if (
    raw &&
    typeof raw === "object" &&
    "data" in raw &&
    Array.isArray((raw as { data: unknown }).data)
  ) {
    return (raw as { data: Branch[] }).data;
  }
  return [];
}

export function AdminHeader({
  onToggleSidebar,
  showSidebarToggle = true,
}: {
  onToggleSidebar?: () => void;
  showSidebarToggle?: boolean;
}) {
  const pathname = usePathname();
  const isPosRoute =
    pathname === "/pos" || pathname.startsWith("/pos/");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelected] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [userOpen, setUserOpen] = useState(false);

  useEffect(() => {
    setUserName(getAdminUser()?.name ?? "Admin");
  }, []);

  useEffect(() => {
    apiFetch<unknown>("/branches")
      .then((raw) => {
        const list = normalizeBranchesPayload(raw);
        setBranches(list);
        const saved = getSelectedBranch();
        const savedOk = saved && list.some((b) => b.id === saved);
        if (savedOk) {
          setSelected(saved);
        } else if (list.length > 0) {
          setSelected(list[0].id);
          setSelectedBranch(list[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!userOpen) return;
    const close = () => setUserOpen(false);
    const id = window.setTimeout(() => {
      document.addEventListener("click", close);
    }, 0);
    return () => {
      clearTimeout(id);
      document.removeEventListener("click", close);
    };
  }, [userOpen]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleLogout = () => {
    clearAdminAuth();
    window.location.href = "/login";
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-2 sm:gap-3 sm:px-4",
        "shadow-[0_4px_6px_-1px_rgba(0,0,0,0.06),0_10px_20px_-5px_rgba(0,0,0,0.08)]",
        "dark:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.25),0_12px_24px_-6px_rgba(0,0,0,0.45)]"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3">
        {showSidebarToggle && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="shrink-0 rounded-lg p-2 text-foreground hover:bg-muted lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-5" aria-hidden />
          </button>
        )}
        <div className="relative flex min-w-0 max-w-[min(100%,20rem)] flex-1 items-center gap-2 sm:max-w-[280px]">
          <span className="hidden shrink-0 text-sm font-medium text-muted-foreground sm:inline">
            Branch:
          </span>
          <Select
            value={selectedBranch != null ? String(selectedBranch) : ""}
            onValueChange={(val) => {
              const id = Number(val);
              setSelected(id);
              setSelectedBranch(id);
            }}
            disabled={branches.length === 0}
          >
            <SelectTrigger
              aria-label="Branch"
              size="default"
              className={cn(
                "h-auto min-h-9 flex-1 justify-start gap-2 rounded-lg border border-border/80 bg-muted/50 py-2 pr-3 pl-2.5 shadow-[0_1px_0_0_rgba(255,255,255,0.06),0_2px_4px_rgba(0,0,0,0.06)]",
                "hover:bg-muted/70 hover:shadow-[0_1px_0_0_rgba(255,255,255,0.08),0_3px_6px_rgba(0,0,0,0.08)]",
                "focus-visible:border-primary/40 focus-visible:ring-primary/15",
                "data-[size=default]:h-auto data-[size=default]:min-h-9 dark:bg-muted/25",
                "[&>svg:last-of-type]:hidden"
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-md",
                  "bg-gradient-to-br from-indigo-500 to-violet-600 text-white",
                  "shadow-[0_1px_0_0_rgba(255,255,255,0.22),0_2px_4px_rgba(99,102,241,0.35),0_3px_6px_rgba(124,58,237,0.18)]"
                )}
              >
                <Store className="size-3.5 shrink-0" aria-hidden />
              </span>
              <SelectValue placeholder="Loading…" />
            </SelectTrigger>
            <SelectContent
              position="popper"
              side="bottom"
              align="start"
              sideOffset={4}
              className="z-[120]"
            >
              <SelectGroup>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {!isPosRoute && (
          <button
            type="button"
            onClick={() =>
              window.open("/pos", "_blank", "noopener,noreferrer")
            }
            className={cn(
              "ml-2 flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-violet-600/90",
              "bg-gradient-to-br from-indigo-500 to-violet-600 px-2.5 py-2 text-sm font-semibold text-white",
              "shadow-[0_2px_10px_rgba(99,102,241,0.35)] transition-[transform,box-shadow,filter]",
              "hover:-translate-y-0.5 hover:shadow-[0_4px_14px_rgba(99,102,241,0.45)] hover:brightness-110",
              "active:translate-y-0 sm:ml-4 sm:px-3.5"
            )}
            title="Point of Sale"
            aria-label="Open Point of Sale in new tab"
          >
            <CreditCard className="size-[1.125rem] shrink-0" aria-hidden />
            <span className="hidden sm:inline">POS</span>
          </button>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
        <button
          type="button"
          onClick={toggleFullscreen}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? (
            <Minimize className="size-[1.125rem] sm:size-5" aria-hidden />
          ) : (
            <Maximize className="size-[1.125rem] sm:size-5" aria-hidden />
          )}
        </button>

        <div className="relative" data-user-menu>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setUserOpen((o) => !o);
            }}
            className={cn(
              "flex items-center gap-1.5 rounded-lg p-1.5 sm:p-2",
              "text-foreground hover:bg-muted",
              userOpen && "bg-muted"
            )}
            aria-expanded={userOpen}
            aria-haspopup="menu"
          >
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <User className="size-4 text-primary" aria-hidden />
            </div>
            <span className="hidden max-w-[100px] truncate text-sm font-medium sm:max-w-[140px] md:inline">
              {userName ?? "Admin"}
            </span>
          </button>
          {userOpen && (
            <div
              className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-border bg-card py-1 shadow-lg"
              role="menu"
            >
              <Link
                href="/settings/profile"
                className="block px-3 py-2 text-sm hover:bg-muted"
                role="menuitem"
                onClick={() => setUserOpen(false)}
              >
                Profile
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full px-3 py-2 text-left text-sm text-destructive hover:bg-muted"
                role="menuitem"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
