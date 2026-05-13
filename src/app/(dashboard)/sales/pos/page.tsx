import { POSPage } from "@/components/sales/POSPage";

/** Fixed viewport slice so category + product columns scroll like seller-admin POS (flex min-h-0 chain). */
export default function POSDashboardPage() {
  return (
    <div className="-mx-3 -mt-2 flex h-[calc(100dvh-7.5rem)] max-h-[calc(100dvh-7.5rem)] min-h-0 flex-col md:-mx-4 md:-mt-3">
      <POSPage />
    </div>
  );
}
