"use client";

import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface SpecRow {
  name: string;
  value: string;
}

interface SpecBuilderProps {
  specs: SpecRow[];
  onChange: (specs: SpecRow[]) => void;
}

export function SpecBuilder({ specs, onChange }: SpecBuilderProps) {
  const addRow = () => onChange([...specs, { name: "", value: "" }]);

  const removeRow = (idx: number) =>
    onChange(specs.filter((_, i) => i !== idx));

  const updateRow = (idx: number, field: keyof SpecRow, val: string) =>
    onChange(specs.map((s, i) => (i === idx ? { ...s, [field]: val } : s)));

  return (
    <div className="space-y-3">
      {specs.map((spec, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <Input
            value={spec.name}
            onChange={(e) => updateRow(idx, "name", e.target.value)}
            placeholder="Specification name"
            className="flex-1"
          />
          <Input
            value={spec.value}
            onChange={(e) => updateRow(idx, "value", e.target.value)}
            placeholder="Specification value"
            className="flex-1"
          />
          <Button variant="ghost" size="icon" onClick={() => removeRow(idx)}>
            <X size={14} className="text-red-500" />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={addRow}>
        <Plus size={14} className="mr-1" /> Add Specification
      </Button>
    </div>
  );
}
