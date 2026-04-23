"use client";

import { useCallback, useEffect, useState } from "react";
import { Save, Settings, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
  InventorySectionHeader,
} from "@/components/inventory/InventoryCrudLayout";

type HeaderBrandMode = "TEXT" | "IMAGE";

interface LinkItem {
  label: string;
  href: string;
}

interface StorefrontSettings {
  topBar: {
    phoneLabel: string;
    phoneHref: string;
    links: LinkItem[];
  };
  headerBrand: {
    mode: HeaderBrandMode;
    brandName: string;
    brandLogoUrl: string;
  };
  footer: {
    description: string;
    address: string;
    phone: string;
    email: string;
    hours: string;
    copyrightText: string;
    quickLinks: LinkItem[];
    customerLinks: LinkItem[];
  };
}

const emptyState: StorefrontSettings = {
  topBar: { phoneLabel: "", phoneHref: "", links: [] },
  headerBrand: { mode: "TEXT", brandName: "", brandLogoUrl: "" },
  footer: {
    description: "",
    address: "",
    phone: "",
    email: "",
    hours: "",
    copyrightText: "",
    quickLinks: [],
    customerLinks: [],
  },
};

function LinkEditor({
  title,
  links,
  onChange,
}: {
  title: string;
  links: LinkItem[];
  onChange: (next: LinkItem[]) => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-border/70 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange([...links, { label: "", href: "" }])}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add
        </Button>
      </div>
      <div className="space-y-2">
        {links.length === 0 ? (
          <p className="text-xs text-muted-foreground">No links added.</p>
        ) : (
          links.map((row, idx) => (
            <div key={`${title}-${idx}`} className="grid grid-cols-12 gap-2">
              <Input
                value={row.label}
                onChange={(e) => {
                  const next = [...links];
                  next[idx] = { ...next[idx], label: e.target.value };
                  onChange(next);
                }}
                placeholder="Label"
                className="col-span-5"
              />
              <Input
                value={row.href}
                onChange={(e) => {
                  const next = [...links];
                  next[idx] = { ...next[idx], href: e.target.value };
                  onChange(next);
                }}
                placeholder="Href"
                className="col-span-6"
              />
              <Button
                type="button"
                variant="outline"
                className="col-span-1 px-0"
                onClick={() => onChange(links.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function EcommerceSettingsPage() {
  const [state, setState] = useState<StorefrontSettings>(emptyState);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<StorefrontSettings>("/storefront-settings/public");
      setState(res);
    } catch {
      setState(emptyState);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await apiFetch("/storefront-settings", {
        method: "PATCH",
        body: JSON.stringify({
          topPhoneLabel: state.topBar.phoneLabel,
          topPhoneHref: state.topBar.phoneHref,
          topLinks: state.topBar.links.filter((x) => x.label || x.href),
          headerBrandMode: state.headerBrand.mode,
          brandName: state.headerBrand.brandName,
          brandLogoUrl: state.headerBrand.brandLogoUrl,
          footerDescription: state.footer.description,
          footerQuickLinks: state.footer.quickLinks.filter((x) => x.label || x.href),
          footerCustomerLinks: state.footer.customerLinks.filter((x) => x.label || x.href),
          footerAddress: state.footer.address,
          footerPhone: state.footer.phone,
          footerEmail: state.footer.email,
          footerHours: state.footer.hours,
          copyrightText: state.footer.copyrightText,
        }),
      });
      toast.success("Ecommerce settings saved");
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-5 pb-8 pt-1 sm:space-y-6 sm:pb-10 sm:pt-2">
      <InventoryListPageHeader
        icon={Settings}
        title="Ecommerce Settings"
        description="Manage storefront header, topbar and footer contents."
      >
        <Button type="button" onClick={save} disabled={saving || loading}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </InventoryListPageHeader>

      <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7 space-y-4`}>
        <InventorySectionHeader
          compact
          icon={Settings}
          title="Header / Topbar"
          description="Phone number, links and brand mode."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            value={state.topBar.phoneLabel}
            onChange={(e) =>
              setState((prev) => ({ ...prev, topBar: { ...prev.topBar, phoneLabel: e.target.value } }))
            }
            placeholder="Top phone text"
          />
          <Input
            value={state.topBar.phoneHref}
            onChange={(e) =>
              setState((prev) => ({ ...prev, topBar: { ...prev.topBar, phoneHref: e.target.value } }))
            }
            placeholder="Top phone href (e.g. tel:...)"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            value={state.headerBrand.mode}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                headerBrand: { ...prev.headerBrand, mode: e.target.value as HeaderBrandMode },
              }))
            }
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="TEXT">Header name text</option>
            <option value="IMAGE">Header image logo</option>
          </select>
          <Input
            value={state.headerBrand.brandName}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                headerBrand: { ...prev.headerBrand, brandName: e.target.value },
              }))
            }
            placeholder="Brand name"
          />
          <Input
            value={state.headerBrand.brandLogoUrl}
            onChange={(e) =>
              setState((prev) => ({
                ...prev,
                headerBrand: { ...prev.headerBrand, brandLogoUrl: e.target.value },
              }))
            }
            placeholder="Brand logo URL"
          />
        </div>

        <LinkEditor
          title="Topbar Links"
          links={state.topBar.links}
          onChange={(next) => setState((prev) => ({ ...prev, topBar: { ...prev.topBar, links: next } }))}
        />
      </section>

      <section className={`${INVENTORY_CARD_SHELL} p-5 sm:p-6 md:p-7 space-y-4`}>
        <InventorySectionHeader
          compact
          icon={Settings}
          title="Footer"
          description="Footer text, contacts and links."
        />

        <Input
          value={state.footer.description}
          onChange={(e) =>
            setState((prev) => ({ ...prev, footer: { ...prev.footer, description: e.target.value } }))
          }
          placeholder="Footer description"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            value={state.footer.address}
            onChange={(e) =>
              setState((prev) => ({ ...prev, footer: { ...prev.footer, address: e.target.value } }))
            }
            placeholder="Footer address"
          />
          <Input
            value={state.footer.phone}
            onChange={(e) =>
              setState((prev) => ({ ...prev, footer: { ...prev.footer, phone: e.target.value } }))
            }
            placeholder="Footer phone"
          />
          <Input
            value={state.footer.email}
            onChange={(e) =>
              setState((prev) => ({ ...prev, footer: { ...prev.footer, email: e.target.value } }))
            }
            placeholder="Footer email"
          />
          <Input
            value={state.footer.hours}
            onChange={(e) =>
              setState((prev) => ({ ...prev, footer: { ...prev.footer, hours: e.target.value } }))
            }
            placeholder="Footer working hours"
          />
        </div>

        <Input
          value={state.footer.copyrightText}
          onChange={(e) =>
            setState((prev) => ({ ...prev, footer: { ...prev.footer, copyrightText: e.target.value } }))
          }
          placeholder="Copyright text"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <LinkEditor
            title="Quick Links"
            links={state.footer.quickLinks}
            onChange={(next) =>
              setState((prev) => ({ ...prev, footer: { ...prev.footer, quickLinks: next } }))
            }
          />
          <LinkEditor
            title="Customer Links"
            links={state.footer.customerLinks}
            onChange={(next) =>
              setState((prev) => ({ ...prev, footer: { ...prev.footer, customerLinks: next } }))
            }
          />
        </div>
      </section>
    </div>
  );
}
