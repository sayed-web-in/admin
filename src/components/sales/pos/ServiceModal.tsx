"use client";

import { Modal } from "@/components/common/Modal";
import { formatPrice } from "@/lib/utils";

interface ServiceItem {
  id: number;
  name: string;
  price: number;
}

interface ServiceModalProps {
  open: boolean;
  loading: boolean;
  services: ServiceItem[];
  onOpenChange: (open: boolean) => void;
  onSelect: (service: ServiceItem) => void;
}

export function ServiceModal({
  open,
  loading,
  services,
  onOpenChange,
  onSelect,
}: ServiceModalProps) {
  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Select Service" className="max-w-lg">
      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-slate-500 py-6 text-center">Loading services...</p>
        ) : services.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">No services found</p>
        ) : (
          services.map((s) => (
            <button
              key={s.id}
              type="button"
              className="w-full flex items-center justify-between p-3 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-left text-sm text-slate-900 transition-colors"
              onClick={() => onSelect(s)}
            >
              <span className="font-medium">{s.name}</span>
              <span className="font-semibold text-primary">{formatPrice(s.price)}</span>
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}
