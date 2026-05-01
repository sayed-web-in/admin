"use client";

import { useMemo } from "react";
import { ChevronRight, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  PRODUCT_SPEC_SECTIONS,
  buildProductSpecsPayload,
  parseProductSpecs,
  productSpecRowName,
} from "@/components/inventory/productSpecTemplate";

export interface SpecRow {
  name: string;
  value: string;
}

interface SpecBuilderProps {
  specs: SpecRow[];
  onChange: (specs: SpecRow[]) => void;
}

export function SpecBuilder({ specs, onChange }: SpecBuilderProps) {
  const { templateValues, customRows } = useMemo(
    () => parseProductSpecs(specs),
    [specs]
  );

  const setTemplateField = (
    sectionTitle: string,
    fieldLabel: string,
    value: string
  ) => {
    const name = productSpecRowName(sectionTitle, fieldLabel);
    const nextVals = { ...templateValues, [name]: value };
    onChange(buildProductSpecsPayload(nextVals, customRows));
  };

  const addCustomRow = () => {
    onChange(
      buildProductSpecsPayload(templateValues, [
        ...customRows,
        { name: "", value: "" },
      ])
    );
  };

  const removeCustomRow = (idx: number) => {
    onChange(
      buildProductSpecsPayload(
        templateValues,
        customRows.filter((_, i) => i !== idx)
      )
    );
  };

  const updateCustomRow = (
    idx: number,
    field: keyof SpecRow,
    val: string
  ) => {
    const next = customRows.map((r, i) =>
      i === idx ? { ...r, [field]: val } : r
    );
    onChange(buildProductSpecsPayload(templateValues, next));
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Open a section to fill values. Only non-empty fields are saved. Names are
        stored as &quot;Section — Field&quot; on the storefront.
      </p>

      <div className="space-y-2">
        {PRODUCT_SPEC_SECTIONS.map((section) => (
          <details
            key={section.id}
            className={cn(
              "rounded-lg border border-border bg-card shadow-sm",
              "[&[open]>summary_svg.chevron]:rotate-90"
            )}
          >
            <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/40">
              <ChevronRight
                className="chevron h-4 w-4 shrink-0 text-muted-foreground transition-transform"
                aria-hidden
              />
              {section.title}
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {section.fields.length} fields
              </span>
            </summary>
            <div className="space-y-3 border-t border-border px-4 pb-4 pt-3">
              {section.fields.map((field, fieldIdx) => {
                const rowKey = productSpecRowName(section.title, field.label);
                const value = templateValues[rowKey] ?? "";
                const inputId = `spec-${section.id}-${fieldIdx}`;
                return (
                  <div
                    key={inputId}
                    className="grid gap-2 sm:grid-cols-[minmax(140px,200px)_1fr] sm:items-center"
                  >
                    <label
                      className="text-sm text-muted-foreground"
                      htmlFor={inputId}
                    >
                      {field.label}
                    </label>
                    <Input
                      id={inputId}
                      value={value}
                      onChange={(e) =>
                        setTemplateField(
                          section.title,
                          field.label,
                          e.target.value
                        )
                      }
                      placeholder={`${field.label}…`}
                      className="h-9"
                    />
                  </div>
                );
              })}
            </div>
          </details>
        ))}
      </div>

      <div className="rounded-lg border border-dashed border-border bg-muted/15 p-4">
        <p className="mb-3 text-sm font-medium text-foreground">
          Additional specifications
        </p>
        <p className="mb-3 text-xs text-muted-foreground">
          Extra rows beyond the template (optional).
        </p>
        <div className="space-y-3">
          {customRows.map((spec, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                value={spec.name}
                onChange={(e) =>
                  updateCustomRow(idx, "name", e.target.value)
                }
                placeholder="Name"
                className="flex-1"
              />
              <Input
                value={spec.value}
                onChange={(e) =>
                  updateCustomRow(idx, "value", e.target.value)
                }
                placeholder="Value"
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeCustomRow(idx)}
              >
                <X size={14} className="text-red-500" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCustomRow}
          >
            <Plus size={14} className="mr-1" /> Add custom row
          </Button>
        </div>
      </div>
    </div>
  );
}
