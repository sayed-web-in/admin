"use client";

import { useEffect, useState } from "react";
import { Plus, X, ImageIcon } from "lucide-react";
import { apiFetch, apiUpload } from "@/lib/api";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AttributeValue {
  id: number;
  value: string;
}

interface Attribute {
  id: number;
  name: string;
  values: AttributeValue[];
}

export interface VariantEntry {
  id?: string;
  image?: string;
  sku: string;
  attributes: { attributeId: number; attributeName: string; valueId: number; valueName: string }[];
}

interface VariantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (variant: VariantEntry) => void;
}

export function VariantModal({ open, onOpenChange, onAdd }: VariantModalProps) {
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [selectedAttrs, setSelectedAttrs] = useState<
    { attributeId: number; valueId: number }[]
  >([]);
  const [sku, setSku] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      apiFetch<{ attributes: Attribute[] }>("/attributes")
        .then((d) => setAttributes(d.attributes || []))
        .catch(() => setAttributes([]));
      setSelectedAttrs([{ attributeId: 0, valueId: 0 }]);
      setSku("");
      setImage(null);
      setImagePreview("");
    }
  }, [open]);

  const addAttrRow = () =>
    setSelectedAttrs((prev) => [...prev, { attributeId: 0, valueId: 0 }]);

  const removeAttrRow = (idx: number) =>
    setSelectedAttrs((prev) => prev.filter((_, i) => i !== idx));

  const updateAttrRow = (
    idx: number,
    field: "attributeId" | "valueId",
    val: number
  ) => {
    setSelectedAttrs((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        if (field === "attributeId") return { attributeId: val, valueId: 0 };
        return { ...row, valueId: val };
      })
    );
  };

  const getAttrValues = (attrId: number): AttributeValue[] => {
    return attributes.find((a) => a.id === attrId)?.values || [];
  };

  const handleAdd = async () => {
    const validAttrs = selectedAttrs.filter(
      (a) => a.attributeId > 0 && a.valueId > 0
    );
    if (validAttrs.length === 0) return;
    setSaving(true);
    try {
      let imageUrl = "";
      if (image) {
        const fd = new FormData();
        fd.append("file", image);
        const res = await apiUpload("/upload", fd);
        imageUrl = res.url || res.path;
      }

      const attrDetails = validAttrs.map((a) => {
        const attr = attributes.find((x) => x.id === a.attributeId)!;
        const val = attr.values.find((v) => v.id === a.valueId)!;
        return {
          attributeId: attr.id,
          attributeName: attr.name,
          valueId: val.id,
          valueName: val.value,
        };
      });

      const autoSku =
        sku ||
        `VAR-${attrDetails.map((a) => a.valueName.substring(0, 3).toUpperCase()).join("-")}-${Date.now().toString(36).slice(-4)}`;

      onAdd({
        id: crypto.randomUUID(),
        image: imageUrl,
        sku: autoSku,
        attributes: attrDetails,
      });
      onOpenChange(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Add Variant">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-1.5 block">
            Variant Image
          </label>
          {imagePreview && (
            <img
              src={imagePreview}
              alt="Preview"
              className="w-16 h-16 rounded-lg object-cover mb-2"
            />
          )}
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setImage(f);
                setImagePreview(URL.createObjectURL(f));
              }
            }}
          />
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">
            Attributes <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2">
            {selectedAttrs.map((row, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  value={row.attributeId}
                  onChange={(e) =>
                    updateAttrRow(idx, "attributeId", Number(e.target.value))
                  }
                  className="flex-1 h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value={0}>Select Attribute</option>
                  {attributes.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
                <select
                  value={row.valueId}
                  onChange={(e) =>
                    updateAttrRow(idx, "valueId", Number(e.target.value))
                  }
                  className="flex-1 h-10 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  disabled={!row.attributeId}
                >
                  <option value={0}>Select Value</option>
                  {getAttrValues(row.attributeId).map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.value}
                    </option>
                  ))}
                </select>
                {selectedAttrs.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeAttrRow(idx)}
                  >
                    <X size={14} className="text-red-500" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addAttrRow}>
              <Plus size={14} className="mr-1" /> Add Attribute
            </Button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-1.5 block">
            SKU (auto-generated if empty)
          </label>
          <Input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="Leave empty to auto-generate"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAdd} disabled={saving}>
            {saving ? "Adding..." : "Add Variant"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
