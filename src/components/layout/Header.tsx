"use client";

import { useState, useEffect } from "react";
import { Maximize, Minimize, User, Menu } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import {
  getAdminUser,
  clearAdminAuth,
  getSelectedBranch,
  setSelectedBranch,
} from "@/lib/auth";
import { cn } from "@/lib/utils";

interface Branch {
  id: number;
  name: string;
}

export function AdminHeader({
  onToggleSidebar,
}: {
  onToggleSidebar?: () => void;
}) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelected] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [userOpen, setUserOpen] = useState(false);

  useEffect(() => {
    setUserName(getAdminUser()?.name ?? "Admin");
  }, []);

  useEffect(() => {
    apiFetch<Branch[]>("/branches")
      .then((data) => {
        setBranches(Array.isArray(data) ? data : []);
        const saved = getSelectedBranch();
        if (saved) setSelected(saved);
        else if (data.length > 0) {
          setSelected(data[0].id);
          setSelectedBranch(data[0].id);
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

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = Number(e.target.value);
    setSelected(id);
    setSelectedBranch(id);
  };

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
        "sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-2 sm:gap-3 sm:px-4"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="shrink-0 rounded-lg p-2 text-foreground hover:bg-muted lg:hidden"
          aria-label="Open menu"
        >
          <Menu className="size-5" aria-hidden />
        </button>
        <label className="sr-only" htmlFor="header-branch">
          Branch
        </label>
        <select
          id="header-branch"
          value={selectedBranch || ""}
          onChange={handleBranchChange}
          className={cn(
            "h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-2 text-sm outline-none",
            "focus:border-primary focus:ring-2 focus:ring-primary/25 sm:px-3",
            "max-w-[min(100%,11rem)] sm:max-w-[200px] md:max-w-[240px]"
          )}
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
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
