"use client";
import { useState, useEffect } from "react";
import { Maximize, Minimize, User, Menu, Receipt, CreditCard } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { getAdminUser, clearAdminAuth, getSelectedBranch, setSelectedBranch } from "@/lib/auth";

interface Branch {
  id: number;
  name: string;
}

export function AdminHeader({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelected] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const user = getAdminUser();

  useEffect(() => {
    apiFetch<Branch[]>("/branches").then((data) => {
      setBranches(Array.isArray(data) ? data : []);
      const saved = getSelectedBranch();
      if (saved) setSelected(saved);
      else if (data.length > 0) {
        setSelected(data[0].id);
        setSelectedBranch(data[0].id);
      }
    }).catch(() => {});
  }, []);

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
    <header className="h-14 bg-white border-b border-border flex items-center justify-between px-4 sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <button onClick={onToggleSidebar} className="lg:hidden p-2 hover:bg-muted rounded-lg">
          <Menu size={20} />
        </button>
        <select
          value={selectedBranch || ""}
          onChange={handleBranchChange}
          className="h-9 px-3 text-sm border border-border rounded-lg bg-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1.5">
        <Link href="/sales/pos" className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
          <CreditCard size={16} />
          <span className="hidden sm:inline">POS</span>
        </Link>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors">
          <Receipt size={16} />
          <span className="hidden sm:inline">Quotation</span>
        </button>
        <button onClick={toggleFullscreen} className="p-2 hover:bg-muted rounded-lg transition-colors">
          {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>
        <div className="relative group">
          <button className="flex items-center gap-2 p-2 hover:bg-muted rounded-lg transition-colors">
            <div className="w-8 h-8 bg-primary-light rounded-full flex items-center justify-center">
              <User size={16} className="text-primary" />
            </div>
            <span className="text-sm font-medium hidden sm:block">{user?.name || "Admin"}</span>
          </button>
          <div className="absolute right-0 top-full mt-1 bg-white border border-border rounded-lg shadow-lg py-1.5 w-40 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all z-50">
            <Link href="/settings/profile" className="block px-4 py-2 text-sm hover:bg-muted transition-colors">Profile</Link>
            <button onClick={handleLogout} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-muted transition-colors">Logout</button>
          </div>
        </div>
      </div>
    </header>
  );
}
