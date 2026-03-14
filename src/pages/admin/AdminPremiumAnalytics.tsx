import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Crown,
  Check,
  X,
  Search,
  Loader2,
  RefreshCw,
  Gift,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";
import { format } from "date-fns";

interface PurchaseRequest {
  id: string;
  restaurant_id: string;
  partner_id: string;
  package_type: string;
  price_paid: number;
  ends_at: string;
  payment_reference: string | null;
  status: string;
  created_at: string;
  restaurant_name: string;
}

interface Restaurant {
  id: string;
  name: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800 border-amber-200" },
  active: { label: "Active", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800 border-red-200" },
  expired: { label: "Expired", className: "bg-gray-100 text-gray-600 border-gray-200" },
};

const packageDurations: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12,
};

export default function AdminPremiumAnalytics() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Approve/reject dialog
  const [actionTarget, setActionTarget] = useState<PurchaseRequest | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // Manual grant dialog
  const [grantOpen, setGrantOpen] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [grantRestaurantId, setGrantRestaurantId] = useState("");
  const [grantPackage, setGrantPackage] = useState("monthly");
  const [grantSubmitting, setGrantSubmitting] = useState(false);

  useEffect(() => {
    fetchRequests();
    fetchRestaurants();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("premium_analytics_purchases")
        .select("*, restaurants(name)")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setRequests(
        (data || []).map((row: any) => ({
          ...row,
          restaurant_name: row.restaurants?.name || "Unknown",
        }))
      );
    } catch (err) {
      console.error("Error fetching premium requests:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRestaurants = async () => {
    const { data } = await supabase.from("restaurants").select("id, name").order("name");
    setRestaurants(data || []);
  };

  const openAction = (req: PurchaseRequest, type: "approve" | "reject") => {
    setActionTarget(req);
    setActionType(type);
  };

  const handleAction = async () => {
    if (!actionTarget || !actionType) return;
    setActionSubmitting(true);

    try {
      if (actionType === "approve") {
        // Mark the purchase as active — the hook checks this directly
        const { error: purchaseError } = await supabase
          .from("premium_analytics_purchases")
          .update({ status: "active" } as never)
          .eq("id", actionTarget.id);

        if (purchaseError) {
          throw new Error(`Failed to activate purchase: ${purchaseError.message}`);
        }

        // Also try to update premium_analytics_until on the restaurant (best-effort,
        // works once the column migration has been applied to the remote DB)
        await supabase
          .from("restaurants")
          .update({ premium_analytics_until: actionTarget.ends_at } as never)
          .eq("id", actionTarget.restaurant_id);

        toast({ title: "Approved", description: "Premium access has been activated." });
      } else {
        const { error: purchaseError } = await supabase
          .from("premium_analytics_purchases")
          .update({ status: "rejected" } as never)
          .eq("id", actionTarget.id);

        if (purchaseError) {
          throw new Error(`Failed to reject: ${purchaseError.message}`);
        }

        toast({ title: "Rejected", description: "The request has been rejected." });
      }

      setActionTarget(null);
      setActionType(null);
      fetchRequests();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to process request.";
      console.error("Error processing action:", err);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setActionSubmitting(false);
    }
  };

  const handleManualGrant = async () => {
    if (!grantRestaurantId || !grantPackage) return;
    setGrantSubmitting(true);

    try {
      const months = packageDurations[grantPackage] || 1;
      const endsAt = new Date();
      endsAt.setMonth(endsAt.getMonth() + months);

      // Fetch the restaurant's owner_id first so we store the correct partner_id
      const { data: restaurantData, error: fetchErr } = await supabase
        .from("restaurants")
        .select("id, owner_id")
        .eq("id", grantRestaurantId)
        .maybeSingle();

      if (fetchErr || !restaurantData) {
        throw new Error("Could not find restaurant.");
      }

      // Best-effort: update premium_analytics_until if the column exists
      await supabase
        .from("restaurants")
        .update({ premium_analytics_until: endsAt.toISOString() } as never)
        .eq("id", grantRestaurantId);

      const { error: insertError } = await supabase.from("premium_analytics_purchases").insert({
        restaurant_id: grantRestaurantId,
        partner_id: restaurantData.owner_id,
        package_type: grantPackage,
        price_paid: 0,
        ends_at: endsAt.toISOString(),
        payment_reference: "manual-grant",
        status: "active",
      } as never);

      if (insertError) throw new Error(`Failed to create grant record: ${insertError.message}`);

      toast({ title: "Access Granted", description: "Premium access has been manually activated." });
      setGrantOpen(false);
      setGrantRestaurantId("");
      fetchRequests();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to grant access.";
      console.error("Error granting access:", err);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setGrantSubmitting(false);
    }
  };

  const filtered = requests.filter((r) => {
    const matchSearch =
      !search ||
      r.restaurant_name.toLowerCase().includes(search.toLowerCase()) ||
      (r.payment_reference || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <AdminLayout>
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Crown className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Premium Analytics</h1>
            <p className="text-sm text-muted-foreground">Manage partner subscription requests</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchRequests}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setGrantOpen(true)}>
            <Gift className="h-4 w-4 mr-1.5" />
            Manual Grant
          </Button>
        </div>
      </div>

      {/* Summary stat */}
      {pendingCount > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-amber-700">
              <span className="font-bold text-lg text-amber-800">{pendingCount}</span> request{pendingCount !== 1 ? "s" : ""} awaiting review
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search restaurant or ref..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              No requests found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Restaurant</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Package</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Price</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Payment Ref</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Expires</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((req) => {
                    const cfg = statusConfig[req.status] || statusConfig.expired;
                    return (
                      <tr key={req.id} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium">{req.restaurant_name}</td>
                        <td className="px-4 py-3 capitalize">{req.package_type}</td>
                        <td className="px-4 py-3">{req.price_paid > 0 ? formatCurrency(req.price_paid) : "—"}</td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {req.payment_reference || "—"}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {format(new Date(req.ends_at), "dd MMM yyyy")}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {format(new Date(req.created_at), "dd MMM yyyy")}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-xs ${cfg.className}`}>
                            {cfg.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {req.status === "pending" && (
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                onClick={() => openAction(req, "approve")}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-red-700 border-red-200 hover:bg-red-50"
                                onClick={() => openAction(req, "reject")}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approve / Reject dialog */}
      <Dialog open={!!actionTarget} onOpenChange={() => { setActionTarget(null); setActionType(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Approve Request" : "Reject Request"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve"
                ? `This will activate Premium Analytics for "${actionTarget?.restaurant_name}" until ${actionTarget ? format(new Date(actionTarget.ends_at), "dd MMM yyyy") : ""}.`
                : `This will reject the request from "${actionTarget?.restaurant_name}". No access will be granted.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={actionSubmitting} onClick={() => { setActionTarget(null); setActionType(null); }}>
              Cancel
            </Button>
            <Button
              variant={actionType === "approve" ? "default" : "destructive"}
              disabled={actionSubmitting}
              onClick={handleAction}
            >
              {actionSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {actionType === "approve" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Grant dialog */}
      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              Manual Grant
            </DialogTitle>
            <DialogDescription>
              Activate Premium Analytics for a restaurant without payment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Restaurant</Label>
              <Select value={grantRestaurantId} onValueChange={setGrantRestaurantId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select restaurant..." />
                </SelectTrigger>
                <SelectContent>
                  {restaurants.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Package</Label>
              <Select value={grantPackage} onValueChange={setGrantPackage}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly (1 month)</SelectItem>
                  <SelectItem value="quarterly">Quarterly (3 months)</SelectItem>
                  <SelectItem value="yearly">Yearly (12 months)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setGrantOpen(false)} disabled={grantSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleManualGrant} disabled={!grantRestaurantId || grantSubmitting}>
              {grantSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Grant Access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </AdminLayout>
  );
}
