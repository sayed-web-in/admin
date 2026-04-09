"use client";

import { useEffect, useState, useMemo } from "react";
import { Palette, Pencil, Trash2, Plus, X } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { PageHeader } from "@/components/common/PageHeader";
import { FilterBar } from "@/components/common/FilterBar";
import { DataTable } from "@/components/common/DataTable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface AttributeValue {
  id?: number;
  value: string;
}

interface Attribute {
  id: number;
  name: string;
  status: string;
  values: AttributeValue[];
}

export default function VariantsPage() {
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Attribute | null>(null);

  const [formName, setFormName] = useState("");
  const [formStatus, setFormStatus] = useState(true);
  const [formValues, setFormValues] = useState<string[]>([""]);
  const [saving, setSaving] = useState(false);

  const fetchAttributes = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<{ attributes: Attribute[] }>("/attributes");
      setAttributes(data.attributes || []);
    } catch {
      setAttributes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttributes();
  }, []);

  const filtered = useMemo(
    () =>
      attributes.filter((a) =>
        a.name.toLowerCase().includes(search.toLowerCase())
      ),
    [attributes, search]
  );

  const openAdd = () => {
    setEditing(null);
    setFormName("");
    setFormStatus(true);
    setFormValues([""]);
    setModalOpen(true);
  };

  const openEdit = (attr: Attribute) => {
    setEditing(attr);
    setFormName(attr.name);
    setFormStatus(attr.status === "active");
    setFormValues(
      attr.values.length > 0 ? attr.values.map((v) => v.value) : [""]
    );
    setModalOpen(true);
  };

  const addValueField = () => setFormValues((prev) => [...prev, ""]);

  const removeValueField = (idx: number) => {
    setFormValues((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateValue = (idx: number, val: string) => {
    setFormValues((prev) => prev.map((v, i) => (i === idx ? val : v)));
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    const values = formValues.filter((v) => v.trim());
    if (values.length === 0) return;
    setSaving(true);
    try {
      const payload = {
        name: formName,
        status: formStatus ? "active" : "inactive",
        values,
      };
      if (editing) {
        await apiFetch(`/attributes/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/attributes", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setModalOpen(false);
      fetchAttributes();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this attribute?")) return;
    try {
      await apiFetch(`/attributes/${id}`, { method: "DELETE" });
      fetchAttributes();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const columns = [
    {
      key: "index",
      label: "#",
      className: "w-12",
      render: (_: Attribute, i: number) => i + 1,
    },
    { key: "name", label: "Attribute Name" },
    {
      key: "values",
      label: "Values",
      render: (item: Attribute) => (
        <div className="flex flex-wrap gap-1">
          {item.values.map((v, i) => (
            <Badge key={i} variant="secondary">
              {v.value}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (item: Attribute) => <StatusBadge status={item.status} />,
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: Attribute) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => openEdit(item)}>
            <Pencil size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(item.id)}
          >
            <Trash2 size={14} className="text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Variants & Attributes"
        description="Manage product attributes and their values"
        action={
          <Button onClick={openAdd}>
            <Plus size={16} className="mr-2" /> Add Attribute
          </Button>
        }
      />

      <FilterBar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search attributes..."
      />

      <DataTable columns={columns} data={filtered} loading={loading} />

      <Modal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? "Edit Attribute" : "Add Attribute"}
      >
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Attribute Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. Color, Size"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">
              Values <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2">
              {formValues.map((val, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={val}
                    onChange={(e) => updateValue(idx, e.target.value)}
                    placeholder={`Value ${idx + 1}`}
                  />
                  {formValues.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeValueField(idx)}
                    >
                      <X size={14} className="text-red-500" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={addValueField}
                className="mt-1"
              >
                <Plus size={14} className="mr-1" /> Add Value
              </Button>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Status</label>
            <button
              type="button"
              onClick={() => setFormStatus(!formStatus)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formStatus ? "bg-orange-500" : "bg-gray-300"}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${formStatus ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
            <span className="ml-2 text-sm">
              {formStatus ? "Active" : "Inactive"}
            </span>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !formName.trim()}>
              {saving ? "Saving..." : editing ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
