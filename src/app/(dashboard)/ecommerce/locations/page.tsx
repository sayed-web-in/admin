"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPin, Plus, Pencil, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  TableRowActions,
  TableRowActionButton,
  tableActionIconClassName,
} from "@/components/common/TableRowActions";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
  InventorySectionHeader,
} from "@/components/inventory/InventoryCrudLayout";

interface StoreLocation {
  id: number;
  name: string;
  address: string;
  phone: string;
  hours: string;
  mapUrl?: string | null;
  displayOrder: number;
  isActive: boolean;
}

export default function EcommerceLocationsPage() {
  const [rows, setRows] = useState<StoreLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<StoreLocation | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [hours, setHours] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [displayOrder, setDisplayOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<StoreLocation[]>("/store-locations");
      setRows(res ?? []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((x) =>
      `${x.name} ${x.address} ${x.phone}`.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const openCreate = () => {
    const next = rows.length ? Math.max(...rows.map((x) => x.displayOrder ?? 0)) + 1 : 1;
    setEditing(null);
    setName("");
    setAddress("");
    setPhone("");
    setHours("");
    setMapUrl("");
    setDisplayOrder(next);
    setIsActive(true);
    setModalOpen(true);
  };

  const openEdit = (row: StoreLocation) => {
    setEditing(row);
    setName(row.name);
    setAddress(row.address);
    setPhone(row.phone);
    setHours(row.hours);
    setMapUrl(row.mapUrl ?? "");
    setDisplayOrder(row.displayOrder ?? 0);
    setIsActive(row.isActive);
    setModalOpen(true);
  };

  const save = async () => {
    if (!name.trim()) return toast.error("Location name is required");
    if (!address.trim()) return toast.error("Address is required");
    if (!phone.trim()) return toast.error("Phone is required");
    if (!hours.trim()) return toast.error("Hours is required");
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        hours: hours.trim(),
        mapUrl: mapUrl.trim() || undefined,
        displayOrder: Number.isFinite(displayOrder) ? displayOrder : 0,
        isActive,
      };
      if (editing) {
        await apiFetch(`/store-locations/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        toast.success("Location updated");
      } else {
        await apiFetch("/store-locations", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast.success("Location created");
      }
      setModalOpen(false);
      void fetchRows();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Delete this location?")) return;
    try {
      await apiFetch(`/store-locations/${id}`, { method: "DELETE" });
      toast.success("Location deleted");
      void fetchRows();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const columns = [
    { key: "index", label: "#", className: "w-12", render: (_: StoreLocation, i: number) => i + 1 },
    {
      key: "name",
      label: "Location",
      render: (row: StoreLocation) => (
        <div>
          <p className="font-semibold text-foreground">{row.name}</p>
          <p className="text-xs text-muted-foreground">Order: {row.displayOrder}</p>
        </div>
      ),
    },
    { key: "address", label: "Address", render: (row: StoreLocation) => row.address },
    { key: "phone", label: "Phone", render: (row: StoreLocation) => row.phone },
    { key: "hours", label: "Hours", render: (row: StoreLocation) => row.hours },
    {
      key: "actions",
      label: "Actions",
      render: (row: StoreLocation) => (
        <TableRowActions>
          <TableRowActionButton title="Edit" onClick={() => openEdit(row)}>
            <Pencil className={tableActionIconClassName} />
          </TableRowActionButton>
          <TableRowActionButton variant="danger" title="Delete" onClick={() => remove(row.id)}>
            <Trash2 className={tableActionIconClassName} />
          </TableRowActionButton>
        </TableRowActions>
      ),
    },
  ];

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={MapPin}
        title="Locations"
        description="Manage storefront location list."
      >
        <Button type="button" variant="outline" onClick={() => void fetchRows()}>
          <RotateCcw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
        <Button type="button" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Add Location
        </Button>
      </InventoryListPageHeader>

      <section className={INVENTORY_CARD_SHELL}>
        <div className="border-b border-border/50 bg-muted/15 px-5 py-4 sm:px-6 sm:py-5">
          <InventorySectionHeader compact icon={MapPin} title="Location list" description={`${filtered.length} items`} />
        </div>
        <div className="p-5 sm:p-6">
          <FilterBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search locations..."
          />
          <DataTable columns={columns} data={filtered} loading={loading} />
        </div>
      </section>

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit Location" : "Add Location"}
        icon={<MapPin className="h-5 w-5" />}
        size="lg"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Location name" />
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
            <Input value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Hours" />
          </div>
          <Input value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} placeholder="Google map URL (optional)" />
          <Input
            type="number"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(Number(e.target.value))}
            placeholder="Display order"
          />
          <div className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3">
            <span className="text-sm font-medium">Active</span>
            <button
              type="button"
              onClick={() => setIsActive((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                isActive ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  isActive ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
