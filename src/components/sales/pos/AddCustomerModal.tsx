"use client";

import { useEffect, useState } from "react";
import { User, Phone, MapPin, Mail } from "lucide-react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import type { POSCustomer } from "@/components/sales/pos/CustomerPopover";

interface AddCustomerModalProps {
  open: boolean;
  initialPhone?: string;
  onOpenChange: (open: boolean) => void;
  onSuccess: (customer: POSCustomer) => void;
}

const INPUT =
  "w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

export function AddCustomerModal({
  open,
  initialPhone = "",
  onOpenChange,
  onSuccess,
}: AddCustomerModalProps) {
  const [form, setForm] = useState({ phone: initialPhone, name: "", address: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) setForm((prev) => ({ ...prev, phone: initialPhone }));
  }, [open, initialPhone]);

  const close = () => {
    onOpenChange(false);
    setForm({ phone: "", name: "", address: "", email: "" });
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const phone = form.phone.trim();
    const name = form.name.trim();
    if (!name || !phone) { setError("Name and phone are required"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch<{ data?: POSCustomer } & POSCustomer>("/customers", {
        method: "POST",
        body: JSON.stringify({
          phone,
          name,
          address: form.address.trim() || undefined,
          email: form.email.trim() || undefined,
        }),
      });
      const created: POSCustomer = {
        id: (res.data?.id ?? (res as POSCustomer).id) as number,
        name,
        phone,
        email: form.email.trim() || null,
      };
      onSuccess(created);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create customer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Add New Customer"
      icon={<User className="w-5 h-5" />}
      className="max-w-md"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button variant="outline" onClick={close} disabled={loading}>Cancel</Button>
          <Button type="submit" form="add-customer-form" disabled={loading}>
            {loading ? "Creating..." : "Create Customer"}
          </Button>
        </div>
      }
    >
      <form id="add-customer-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
            <Phone className="w-4 h-4" /> Phone Number *
          </label>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={11}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/\D/g, "") })}
            className={INPUT}
            placeholder="01XXXXXXXXX"
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
            <User className="w-4 h-4" /> Customer Name *
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={INPUT}
            placeholder="Enter customer name"
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Address
          </label>
          <textarea
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className={INPUT + " min-h-[72px] resize-none"}
            placeholder="Enter address (optional)"
            rows={3}
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-700 flex items-center gap-2">
            <Mail className="w-4 h-4" /> Email
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className={INPUT}
            placeholder="customer@example.com (optional)"
            disabled={loading}
          />
        </div>
      </form>
    </Modal>
  );
}
