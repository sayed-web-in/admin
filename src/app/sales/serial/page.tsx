"use client";
import { useState } from "react";
import {
  Search,
  Barcode,
  Package,
  ShoppingCart,
  Layers,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { formatPrice, formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface SerialResult {
  id: number;
  serialNumber: string;
  status: string;
  product?: {
    id: number;
    name: string;
    images?: { url: string }[];
  };
  storeProduct?: {
    id: number;
    sellingPrice: number;
    branch?: { name: string };
  };
  batch?: {
    id: number;
    batchNumber: string;
    purchaseDate?: string;
  };
  sale?: {
    id: number;
    invoiceNumber: string;
    customer?: { name: string };
    createdAt: string;
  };
}

export default function SerialNumberPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SerialResult | null>(null);
  const [results, setResults] = useState<SerialResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await apiFetch<any>(`/serial-numbers?search=${encodeURIComponent(query)}`);
      const data = res.data || (Array.isArray(res) ? res : [res]);
      setResults(data);
      setResult(data.length === 1 ? data[0] : null);
    } catch {
      setResults([]);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value || "—"}</span>
    </div>
  );

  const SerialCard = ({ serial }: { serial: SerialResult }) => (
    <div className="bg-white rounded-xl border border-border overflow-hidden">
      <div className="bg-muted/50 px-5 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Barcode size={18} className="text-primary" />
          <span className="font-semibold">{serial.serialNumber}</span>
        </div>
        <StatusBadge status={serial.status} />
      </div>

      <div className="p-5 space-y-4">
        {serial.product && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Package size={16} className="text-muted-foreground" />
              <h3 className="text-sm font-semibold">Product Information</h3>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <InfoRow label="Product" value={serial.product.name} />
              <InfoRow
                label="Price"
                value={
                  serial.storeProduct
                    ? formatPrice(Number(serial.storeProduct.sellingPrice))
                    : "—"
                }
              />
              <InfoRow label="Branch" value={serial.storeProduct?.branch?.name} />
            </div>
          </div>
        )}

        {serial.batch && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Layers size={16} className="text-muted-foreground" />
              <h3 className="text-sm font-semibold">Batch Information</h3>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <InfoRow label="Batch Number" value={serial.batch.batchNumber} />
              {serial.batch.purchaseDate && (
                <InfoRow label="Purchase Date" value={formatDate(serial.batch.purchaseDate)} />
              )}
            </div>
          </div>
        )}

        {serial.sale && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart size={16} className="text-muted-foreground" />
              <h3 className="text-sm font-semibold">Sale Information</h3>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <InfoRow label="Invoice" value={serial.sale.invoiceNumber} />
              <InfoRow
                label="Customer"
                value={serial.sale.customer?.name || "Walking Customer"}
              />
              <InfoRow label="Sale Date" value={formatDate(serial.sale.createdAt)} />
            </div>
          </div>
        )}

        {!serial.product && !serial.batch && !serial.sale && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No additional information available
          </p>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Serial Number Lookup"
        description="Search and track serial numbers / IMEI"
      />

      <div className="max-w-xl mx-auto mb-8">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={16}
            />
            <Input
              placeholder="Enter serial number or IMEI..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch} disabled={loading || !query.trim()}>
            {loading ? "Searching..." : "Search"}
          </Button>
        </div>
      </div>

      {loading && (
        <div className="text-center py-12 text-muted-foreground">Searching...</div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="text-center py-12">
          <Barcode size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-muted-foreground">No serial number found for &quot;{query}&quot;</p>
        </div>
      )}

      {!loading && result && (
        <div className="max-w-xl mx-auto">
          <SerialCard serial={result} />
        </div>
      )}

      {!loading && !result && results.length > 1 && (
        <div className="max-w-xl mx-auto space-y-4">
          <p className="text-sm text-muted-foreground mb-2">
            Found {results.length} results
          </p>
          {results.map((serial) => (
            <SerialCard key={serial.id} serial={serial} />
          ))}
        </div>
      )}
    </div>
  );
}
