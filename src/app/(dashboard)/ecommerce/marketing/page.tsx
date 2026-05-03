"use client";

import { useCallback, useEffect, useState } from "react";
import { Megaphone, Save } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  INVENTORY_CARD_SHELL,
  InventoryListPageHeader,
  InventorySectionHeader,
} from "@/components/inventory/InventoryCrudLayout";

type MarketingState = {
  gtmContainerId: string;
  publicSiteUrl: string;
  gtmCurrency: string;
  metaPixelId: string;
};

const emptyMarketing: MarketingState = {
  gtmContainerId: "",
  publicSiteUrl: "",
  gtmCurrency: "BDT",
  metaPixelId: "",
};

export default function EcommerceMarketingPage() {
  const [marketing, setMarketing] = useState<MarketingState>(emptyMarketing);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ marketing?: Partial<MarketingState> }>(
        "/storefront-settings/public"
      );
      const m = res.marketing;
      setMarketing({
        gtmContainerId: m?.gtmContainerId ?? "",
        publicSiteUrl: m?.publicSiteUrl ?? "",
        gtmCurrency: m?.gtmCurrency?.trim() || "BDT",
        metaPixelId: m?.metaPixelId ?? "",
      });
    } catch {
      setMarketing(emptyMarketing);
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
          marketingGtmContainerId: marketing.gtmContainerId.trim(),
          marketingPublicSiteUrl: marketing.publicSiteUrl.trim(),
          marketingGtmCurrency: marketing.gtmCurrency.trim() || "BDT",
          marketingMetaPixelId: marketing.metaPixelId.trim(),
        }),
      });
      toast.success("Marketing settings saved");
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
        icon={Megaphone}
        title="Storefront marketing"
        description="GTM, public site URL (sitemap / SEO base), currency for dataLayer, Meta Pixel ID. Values are exposed on the public storefront API."
      >
        <Button type="button" onClick={save} disabled={saving || loading}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Saving…" : "Save"}
        </Button>
      </InventoryListPageHeader>

      <section className={`${INVENTORY_CARD_SHELL} space-y-4 p-5 sm:p-6 md:p-7`}>
        <InventorySectionHeader
          compact
          icon={Megaphone}
          title="Tags & analytics"
          description="Google Tag Manager loads on the shop when GTM ID is set here (or via NEXT_PUBLIC_GTM_ID on the storefront). Meta Pixel ID is stored for your own GTM tag or future use."
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">GTM container ID</label>
            <Input
              value={marketing.gtmContainerId}
              onChange={(e) =>
                setMarketing((m) => ({ ...m, gtmContainerId: e.target.value }))
              }
              placeholder="GTM-XXXXXXX"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Meta Pixel ID</label>
            <Input
              value={marketing.metaPixelId}
              onChange={(e) =>
                setMarketing((m) => ({ ...m, metaPixelId: e.target.value }))
              }
              placeholder="Optional — use in GTM or scripts"
              autoComplete="off"
            />
          </div>
        </div>
      </section>

      <section className={`${INVENTORY_CARD_SHELL} space-y-4 p-5 sm:p-6 md:p-7`}>
        <InventorySectionHeader
          compact
          icon={Megaphone}
          title="Site URL & currency"
          description="Public site URL overrides storefront env for sitemap.xml and robots.txt when non-empty. Ecommerce currency is sent to dataLayer (GTM / GA4)."
        />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-medium text-muted-foreground">Public site URL</label>
            <Input
              value={marketing.publicSiteUrl}
              onChange={(e) =>
                setMarketing((m) => ({ ...m, publicSiteUrl: e.target.value }))
              }
              placeholder="https://yourdomain.com (no trailing slash)"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">GTM / GA4 currency code</label>
            <Input
              value={marketing.gtmCurrency}
              onChange={(e) =>
                setMarketing((m) => ({ ...m, gtmCurrency: e.target.value.toUpperCase() }))
              }
              placeholder="BDT"
              maxLength={12}
              autoComplete="off"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
