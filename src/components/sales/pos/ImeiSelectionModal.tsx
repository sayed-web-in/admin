"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/common/Modal";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";

interface ImeiSelectionModalProps {
  open: boolean;
  productName: string;
  variantName: string;
  serials: string[];
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (serials: string[]) => void;
}

export function ImeiSelectionModal({
  open,
  productName,
  variantName,
  serials,
  loading,
  onOpenChange,
  onConfirm,
}: ImeiSelectionModalProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const anchor = useComboboxAnchor();

  const title = useMemo(() => {
    if (!variantName) return `Select IMEI for ${productName}`;
    return `Select IMEI for ${productName} (${variantName})`;
  }, [productName, variantName]);

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setSelected([]);
      }}
      title="IMEI Selection"
      description={title}
      className="max-w-2xl"
    >
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Select one or more IMEI numbers to add to cart.
        </div>
        <Combobox
          multiple
          autoHighlight
          items={serials}
          value={selected}
          onValueChange={(value) => setSelected(value ?? [])}
        >
          <ComboboxChips
            ref={anchor}
            className="w-full min-h-9 max-h-28 overflow-y-auto rounded-md border border-slate-300 bg-white px-2.5 py-1.5"
          >
            <ComboboxValue>
              {(values: string[]) => (
                <>
                  {values.map((value) => (
                    <ComboboxChip key={value} className="font-mono text-[11px]">
                      {value}
                    </ComboboxChip>
                  ))}
                  <ComboboxChipsInput
                    placeholder={loading ? "Loading..." : "Search IMEI/Serial..."}
                    disabled={loading || serials.length === 0}
                    className="min-w-[140px] bg-transparent text-slate-900 placeholder-slate-500 border-0 focus:ring-0 focus:outline-none text-xs"
                  />
                </>
              )}
            </ComboboxValue>
          </ComboboxChips>
          <ComboboxContent
            anchor={anchor}
            side="top"
            className="rounded-md border border-slate-200 bg-white shadow-lg max-h-52 overflow-hidden"
          >
            <ComboboxEmpty className="py-3 text-center text-slate-500 text-xs">
              {loading ? "Loading IMEI numbers..." : "No IMEI numbers found."}
            </ComboboxEmpty>
            <ComboboxList className="max-h-44 overflow-y-auto p-1">
              {(item: string) => (
                <ComboboxItem
                  key={item}
                  value={item}
                  className="font-mono text-xs text-slate-900 hover:bg-slate-100 rounded py-1.5 px-2"
                >
                  {item}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        {!loading && serials.length === 0 && (
          <p className="text-sm text-slate-500">No available IMEI numbers for this variant.</p>
        )}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-500">Selected: {selected.length}</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              disabled={selected.length === 0}
              onClick={() => {
                onConfirm(selected);
                setSelected([]);
              }}
            >
              Add Selected
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
