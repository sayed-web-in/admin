"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Save, Settings, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, apiUpload } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/media";
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
  /** Logo file chosen in UI; uploaded + written to DB only on Save. */
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [pendingLogoPreview, setPendingLogoPreview] = useState<string | null>(null);
  const pendingPreviewRef = useRef<string | null>(null);

  const revokePendingPreview = useCallback(() => {
    if (pendingPreviewRef.current) {
      URL.revokeObjectURL(pendingPreviewRef.current);
      pendingPreviewRef.current = null;
    }
    setPendingLogoPreview(null);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<StorefrontSettings>("/storefront-settings/public");
      setState(res);
      setPendingLogoFile(null);
      revokePendingPreview();
    } catch {
      setState(emptyState);
      setPendingLogoFile(null);
      revokePendingPreview();
    } finally {
      setLoading(false);
    }
  }, [revokePendingPreview]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (pendingPreviewRef.current) {
        URL.revokeObjectURL(pendingPreviewRef.current);
        pendingPreviewRef.current = null;
      }
    };
  }, []);

  const save = async () => {
    if (state.headerBrand.mode === "TEXT" && !state.headerBrand.brandName.trim()) {
      toast.error("Brand / store name is required for text header.");
      return;
    }
    const hasSavedLogo = state.headerBrand.brandLogoUrl.trim().length > 0;
    if (
      state.headerBrand.mode === "IMAGE" &&
      !hasSavedLogo &&
      !pendingLogoFile
    ) {
      toast.error("Choose a logo file, then click Save — or switch to Text mode.");
      return;
    }

    setSaving(true);
    try {
      let brandLogoUrl = state.headerBrand.brandLogoUrl.trim();
      if (state.headerBrand.mode === "IMAGE" && pendingLogoFile) {
        const fd = new FormData();
        fd.append("file", pendingLogoFile);
        const uploaded = await apiUpload("/upload/logo", fd);
        const url =
          typeof uploaded?.url === "string"
            ? uploaded.url
            : typeof uploaded?.data?.url === "string"
              ? uploaded.data.url
              : "";
        if (!url) throw new Error("Logo upload did not return a URL");
        brandLogoUrl = url;
      }

      await apiFetch("/storefront-settings", {
        method: "PATCH",
        body: JSON.stringify({
          topPhoneLabel: state.topBar.phoneLabel,
          topPhoneHref: state.topBar.phoneHref,
          topLinks: state.topBar.links.filter((x) => x.label || x.href),
          headerBrandMode: state.headerBrand.mode,
          brandName: state.headerBrand.brandName.trim(),
          brandLogoUrl:
            state.headerBrand.mode === "IMAGE" ? brandLogoUrl : "",
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
      setPendingLogoFile(null);
      revokePendingPreview();
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

        <div className="space-y-3 rounded-xl border border-border/70 bg-muted/10 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <label className="text-sm font-medium text-foreground">Header brand type</label>
              <p className="text-xs text-muted-foreground">
                Text = store name in the navbar. Image = pick a file, then <strong>Save Settings</strong> uploads it
                and stores the URL in the database.
              </p>
            </div>
            <select
              value={state.headerBrand.mode}
              onChange={(e) => {
                const mode = e.target.value as HeaderBrandMode;
                setState((prev) => ({
                  ...prev,
                  headerBrand: {
                    ...prev.headerBrand,
                    mode,
                  },
                }));
                if (mode === "TEXT") {
                  setPendingLogoFile(null);
                  revokePendingPreview();
                }
              }}
              className="h-10 w-full max-w-xs shrink-0 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="TEXT">Text (store name)</option>
              <option value="IMAGE">Image (logo upload)</option>
            </select>
          </div>

          {state.headerBrand.mode === "TEXT" ? (
            <div>
              <label className="mb-1.5 block text-sm font-medium">Brand / store name *</label>
              <Input
                value={state.headerBrand.brandName}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    headerBrand: { ...prev.headerBrand, brandName: e.target.value },
                  }))
                }
                placeholder="e.g. Future Technology"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Logo image</label>
                <p className="mb-2 text-xs text-muted-foreground">
                  Choose PNG/SVG/WebP — file is sent to the server only when you click <strong>Save Settings</strong>{" "}
                  (then DB is updated). Preview ~200×33px on storefront.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex h-[33px] w-[200px] max-w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background px-1">
                    {pendingLogoPreview || state.headerBrand.brandLogoUrl ? (
                      <img
                        src={
                          pendingLogoPreview ||
                          resolveMediaUrl(state.headerBrand.brandLogoUrl)
                        }
                        alt=""
                        className="max-h-[33px] max-w-[200px] w-auto object-contain"
                      />
                    ) : (
                      <span className="text-[11px] text-muted-foreground">No logo yet</span>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      disabled={saving}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (!file) return;
                        revokePendingPreview();
                        const url = URL.createObjectURL(file);
                        pendingPreviewRef.current = url;
                        setPendingLogoPreview(url);
                        setPendingLogoFile(file);
                      }}
                      className="text-sm text-muted-foreground file:mr-2 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary hover:file:bg-primary/20"
                    />
                    {pendingLogoFile ? (
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        Unsaved logo — click Save Settings to upload and store in the database.
                      </p>
                    ) : null}
                    {state.headerBrand.brandLogoUrl || pendingLogoFile ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-fit"
                        disabled={saving}
                        onClick={() => {
                          setPendingLogoFile(null);
                          revokePendingPreview();
                          setState((prev) => ({
                            ...prev,
                            headerBrand: { ...prev.headerBrand, brandLogoUrl: "" },
                          }));
                        }}
                      >
                        Remove logo
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Site name (alt text & fallback)
                </label>
                <Input
                  value={state.headerBrand.brandName}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      headerBrand: { ...prev.headerBrand, brandName: e.target.value },
                    }))
                  }
                  placeholder="e.g. Future Technology — used as img alt if logo is set"
                />
              </div>
            </div>
          )}
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
