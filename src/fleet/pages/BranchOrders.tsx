import { FleetBranchOrders } from "@/fleet/components/FleetBranchOrders";

export default function BranchOrders() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Branch Orders</h1>
        <p className="text-muted-foreground">
          View and manage active orders grouped by restaurant branch.
        </p>
      </div>

      <FleetBranchOrders />
    </div>
  );
}
