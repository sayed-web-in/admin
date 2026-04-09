import { Badge } from "@/components/ui/badge";

const statusMap: Record<string, { label: string; variant: "default" | "success" | "warning" | "destructive" | "secondary" }> = {
  active: { label: "Active", variant: "success" },
  inactive: { label: "Inactive", variant: "secondary" },
  draft: { label: "Draft", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  pending: { label: "Pending", variant: "warning" },
  cancelled: { label: "Cancelled", variant: "destructive" },
  returned: { label: "Returned", variant: "destructive" },
  received: { label: "Received", variant: "success" },
  processing: { label: "Processing", variant: "default" },
  shipped: { label: "Shipped", variant: "default" },
  delivered: { label: "Delivered", variant: "success" },
  confirmed: { label: "Confirmed", variant: "success" },
  pay_later: { label: "Pay Later", variant: "warning" },
  partial: { label: "Partial", variant: "warning" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusMap[status.toLowerCase()] || { label: status, variant: "secondary" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
