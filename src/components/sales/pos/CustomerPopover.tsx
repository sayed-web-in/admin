"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Search, Plus, User, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice } from "@/lib/utils";
import { AddCustomerModal } from "@/components/sales/pos/AddCustomerModal";

export interface POSCustomer {
  id: number;
  name: string;
  phone: string;
  email: string | null;
  /** Customer wallet balance (POS advance apply). */
  totalAdvance?: number | string | null;
}

interface CustomerPopoverProps {
  branchId?: number | null;
  customer: POSCustomer | null;
  onSelect: (customer: POSCustomer) => void;
  onClear: () => void;
}

export function CustomerPopover({
  customer,
  onSelect,
  onClear,
}: CustomerPopoverProps) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [customers, setCustomers] = useState<POSCustomer[]>([]);
  const [loading, setLoading] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [addModalPhone, setAddModalPhone] = useState("");

  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // fetch customers
  const fetchCustomers = async (search: string) => {
    if (search) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await apiFetch<POSCustomer[] | { data?: POSCustomer[] }>(
        `/customers?${params.toString()}`
      );
      const list = Array.isArray(res) ? res : res.data || [];
      setCustomers(Array.isArray(list) ? list : []);
    } catch {
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  // debounced search
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => fetchCustomers(searchTerm), 300);
    return () => clearTimeout(t);
  }, [searchTerm, open]);

  // initial load on open
  useEffect(() => {
    if (open) {
      setSearchTerm("");
      fetchCustomers("");
    } else {
      setCustomers([]);
      setSearchTerm("");
    }
  }, [open]);

  // position update
  useEffect(() => {
    if (!open) return;
    const update = () => {
      if (!buttonRef.current) return;
      const r = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: r.bottom + window.scrollY + 4,
        left: r.left + window.scrollX,
        width: r.width,
      });
    };
    update();
    requestAnimationFrame(() => inputRef.current?.focus());
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  // click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current?.contains(e.target as Node) ||
        buttonRef.current?.contains(e.target as Node)
      )
        return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const normalizePhone = (phone: string) => {
    let n = phone.replace(/[\s\-()]/g, "");
    if (n.startsWith("+88")) n = n.slice(3);
    else if (n.startsWith("88")) n = n.slice(2);
    return n;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || !searchTerm.trim()) return;
    e.preventDefault();
    const norm = normalizePhone(searchTerm.trim());
    const isPhone = /^[0-9]{10,}$/.test(norm);
    if (!isPhone) return;

    const found = customers.find(
      (c) => c.phone && normalizePhone(c.phone) === norm
    );
      if (found) {
        onSelect(found);
        setOpen(false);
      } else {
        setAddModalPhone(searchTerm.trim());
        setAddModalOpen(true);
        setOpen(false);
      }
  };

  const popoverContent = open && typeof window !== "undefined" ? (
    <div
      ref={popoverRef}
      className="fixed rounded-lg shadow-xl border border-border bg-card text-card-foreground z-[99999]"
      style={{
        top: position.top > 0 ? position.top : "auto",
        left: position.left > 0 ? position.left : "auto",
        minWidth: Math.max(position.width, 280),
        maxHeight: 400,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* search */}
      <div className="relative px-2 pt-2 pb-1 shrink-0">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search or enter phone number..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          className="w-full h-9 rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* list */}
      <div className="flex-1 overflow-y-auto">
        {loading && searchTerm ? (
          <p className="text-sm text-center text-muted-foreground py-6">Searching...</p>
        ) : customers.length === 0 ? (
          <p className="text-sm text-center text-muted-foreground py-6">
            {searchTerm ? "No customers found" : "No customers available"}
          </p>
        ) : (
          customers.map((c) => (
            <div
              key={c.id}
              onClick={() => {
                onSelect(c);
                setOpen(false);
              }}
              className={`px-3 py-2.5 cursor-pointer text-sm whitespace-nowrap transition-colors hover:bg-accent hover:text-accent-foreground ${
                customer?.id === c.id ? "bg-primary/10 text-primary font-medium" : ""
              }`}
            >
              {c.name}
              {c.phone ? ` -- (${c.phone})` : ""}
            </div>
          ))
        )}
      </div>
    </div>
  ) : null;

  return (
    <div className="p-4 mb-1 rounded-xl border border-slate-200 bg-white">
      {/* header */}
      <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
        <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
          <User className="w-4 h-4 text-indigo-600" />
          Order Details
        </h3>
        {customer && (
          <button
            onClick={onClear}
            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
            aria-label="Clear customer"
          >
            <X className="w-3.5 h-3.5 text-red-500" />
          </button>
        )}
      </div>

      {/* search trigger + plus */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="w-full text-left flex items-center gap-2 px-3 py-2.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-sm"
          >
            <User className="w-4 h-4 text-slate-400 shrink-0" />
            <span className={customer ? "text-slate-900 truncate" : "text-slate-400 truncate"}>
              {customer ? `${customer.name}${customer.phone ? ` (${customer.phone})` : ""}` : "Walk-in Customer"}
            </span>
          </button>

          {popoverContent && createPortal(popoverContent, document.body)}
        </div>

        {/* plus button — open add-new modal */}
        <button
          type="button"
          onClick={() => { setAddModalPhone(""); setAddModalOpen(true); }}
          className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0 text-white"
          style={{
            background:
              "linear-gradient(135deg, rgba(99,102,241,0.9), rgba(139,92,246,0.9))",
            border: "1px solid rgba(99,102,241,0.3)",
          }}
          title="Add new customer"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <AddCustomerModal
        open={addModalOpen}
        initialPhone={addModalPhone}
        onOpenChange={setAddModalOpen}
        onSuccess={(newCustomer) => {
          onSelect(newCustomer);
          setAddModalOpen(false);
        }}
      />

      {/* selected customer info */}
      {customer && (
        <div className="mt-3 p-3 rounded-lg border border-slate-100 bg-slate-50 flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{customer.name}</p>
            {customer.phone && (
              <p className="text-xs text-slate-500">{customer.phone}</p>
            )}
            {customer.totalAdvance != null && Number(customer.totalAdvance) > 0 ? (
              <p className="text-xs font-medium text-emerald-700">
                Advance {formatPrice(Number(customer.totalAdvance))}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
