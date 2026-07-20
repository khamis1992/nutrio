import {
  AdminDialogContent,
  AdminFilterBar,
  AdminKpiStrip,
  AdminWorkbenchHeader,
} from "@/components/admin/AdminPrimitives";
import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
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
  restaurant_id: string | null;
  partner_id: string | null;
  package_type: string | null;
  price_paid: number | null;
  ends_at: string | null;
  payment_reference: string | null;
  status: string;
  created_at: string | null;
  restaurant_name: string;
}

interface Restaurant {
  id: string;
  name: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "border-[#F97316]/40 bg-[#F97316]/10 text-[#F97316]",
  },
  active: {
    label: "Active",
    className: "border-[#22C7A1]/20 bg-[#22C7A1]/10 text-[#22C7A1]",
  },
  rejected: {
    label: "Rejected",
    className: "border-[#FB6B7A]/20 bg-[#FB6B7A]/10 text-[#FB6B7A]",
  },
  expired: {
    label: "Expired",
    className: "border-[#E5EAF1] bg-[#F6F8FB] text-[#94A3B8]",
  },
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

  const [actionTarget, setActionTarget] = useState<PurchaseRequest | null>(
    null,
  );
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(
    null,
  );
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const [grantOpen, setGrantOpen] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [grantRestaurantId, setGrantRestaurantId] = useState("");
  const [grantPackage, setGrantPackage] = useState("monthly");
  const [grantSubmitting, setGrantSubmitting] = useState(false);

  useEffect(() => {
    fetchRequests();
    fetchRestaurants();
    // Initial administrative data load; both functions are defined in this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        (data || []).map((row) => ({
          ...row,
          restaurant_name: row.restaurants?.name || "Unknown",
        })),
      );
    } catch (err) {
      console.error("Error fetching premium requests:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchRestaurants = async () => {
    const { data, error } = await supabase
      .from("restaurants")
      .select("id, name")
      .order("name");
    if (error) {
      console.error("Error fetching restaurants:", error);
      toast({
        title: "Error",
        description: "Could not load restaurants.",
        variant: "destructive",
      });
      return;
    }
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
        if (!actionTarget.restaurant_id || !actionTarget.ends_at) {
          throw new Error(
            "This purchase is missing its restaurant or expiry date.",
          );
        }

        const { error: purchaseError } = await supabase
          .from("premium_analytics_purchases")
          .update({ status: "active" })
          .eq("id", actionTarget.id);

        if (purchaseError) {
          throw new Error(
            `Failed to activate purchase: ${purchaseError.message}`,
          );
        }

        toast({
          title: "Approved",
          description: "Premium access has been activated.",
        });
      } else {
        const { error: purchaseError } = await supabase
          .from("premium_analytics_purchases")
          .update({ status: "rejected" })
          .eq("id", actionTarget.id);

        if (purchaseError) {
          throw new Error(`Failed to reject: ${purchaseError.message}`);
        }

        toast({
          title: "Rejected",
          description: "The request has been rejected.",
        });
      }

      setActionTarget(null);
      setActionType(null);
      fetchRequests();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to process request.";
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

      const { data: restaurantData, error: fetchErr } = await supabase
        .from("restaurants")
        .select("id, owner_id")
        .eq("id", grantRestaurantId)
        .maybeSingle();

      if (fetchErr || !restaurantData) {
        throw new Error("Could not find restaurant.");
      }

      const { error: insertError } = await supabase
        .from("premium_analytics_purchases")
        .insert({
          restaurant_id: grantRestaurantId,
          partner_id: restaurantData.owner_id,
          package_type: grantPackage,
          price_paid: 0,
          ends_at: endsAt.toISOString(),
          payment_reference: "manual-grant",
          status: "active",
        });

      if (insertError)
        throw new Error(
          `Failed to create grant record: ${insertError.message}`,
        );

      toast({
        title: "Access Granted",
        description: "Premium access has been manually activated.",
      });
      setGrantOpen(false);
      setGrantRestaurantId("");
      fetchRequests();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to grant access.";
      console.error("Error granting access:", err);
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setGrantSubmitting(false);
    }
  };

  const filtered = requests.filter((request) => {
    const matchSearch =
      !search ||
      request.restaurant_name.toLowerCase().includes(search.toLowerCase()) ||
      (request.payment_reference || "")
        .toLowerCase()
        .includes(search.toLowerCase());
    const matchStatus =
      statusFilter === "all" || request.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: requests.length,
    pending: requests.filter((request) => request.status === "pending").length,
    active: requests.filter((request) => request.status === "active").length,
    rejected: requests.filter((request) => request.status === "rejected")
      .length,
  };

  return (
    <AdminLayout
      title="Premium Analytics"
      subtitle={`${stats.pending} requests awaiting review`}
    >
      <div className="space-y-5 text-[#020617]">
        <AdminWorkbenchHeader
          eyebrow="Partner revenue"
          title="Premium analytics access"
          icon={Crown}
          accent="#7C83F6"
          description="Review paid analytics requests, approve partner access, reject invalid submissions, and grant access manually when support needs it."
          meta={[
            { label: "Pending review", value: stats.pending },
            { label: "Active access", value: stats.active },
            { label: "Rejected", value: stats.rejected },
          ]}
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchRequests}
                className="h-11 gap-2 rounded-[14px] border-[#E5EAF1] bg-white px-4 font-black text-[#020617] hover:bg-[#F6F8FB]"
              >
                <RefreshCw className="h-4 w-4 text-[#38BDF8]" />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={() => setGrantOpen(true)}
                variant="outline"
                className="h-11 gap-2 rounded-[14px] border-[#7C83F6]/30 bg-[#7C83F6]/10 px-4 font-black text-[#020617] hover:bg-[#7C83F6]/15"
              >
                <Gift className="h-4 w-4" />
                Manual Grant
              </Button>
            </>
          }
        />

        <AdminKpiStrip
          items={[
            {
              label: "Total requests",
              value: stats.total,
              helper: "All packages",
              icon: Crown,
              accent: "#7C83F6",
            },
            {
              label: "Pending review",
              value: stats.pending,
              helper: loading ? "Refreshing" : "Needs action",
              icon: Loader2,
              accent: "#F97316",
            },
            {
              label: "Active access",
              value: stats.active,
              helper: "Partner enabled",
              icon: Check,
              accent: "#22C7A1",
            },
            {
              label: "Rejected",
              value: stats.rejected,
              helper: "Declined",
              icon: X,
              accent: "#FB6B7A",
            },
          ]}
        />

        <AdminFilterBar title="Access queue">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative min-w-[280px] flex-1 lg:max-w-md">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <Input
                placeholder="Search restaurant or payment reference"
                className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] pl-10 font-semibold text-[#020617] placeholder:text-[#94A3B8] focus-visible:ring-[#020617]"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-11 w-full rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-black text-[#020617] lg:w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]">
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </AdminFilterBar>

        <section className="overflow-hidden rounded-[24px] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="flex items-center justify-between gap-3 border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
            <div>
              <h2 className="text-lg font-black text-[#020617]">
                Purchase Requests
              </h2>
              <p className="text-xs font-bold text-[#94A3B8]">
                {filtered.length} visible from {requests.length} total
              </p>
            </div>
            <Badge
              variant="outline"
              className="border-[#38BDF8]/20 bg-[#38BDF8]/10 text-[#38BDF8]"
            >
              Premium
            </Badge>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-[#020617]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm font-black text-[#020617]">
                No requests found
              </p>
              <p className="mt-1 text-xs font-semibold text-[#94A3B8]">
                Try adjusting the search or status filter.
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 p-4 md:hidden">
                {filtered.map((request) => {
                  const cfg =
                    statusConfig[request.status] || statusConfig.expired;
                  return (
                    <div
                      key={request.id}
                      className="rounded-[24px] border border-[#E5EAF1] bg-white p-4 shadow-[0_12px_30px_rgba(2,6,23,0.05)]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-black text-[#020617]">
                            {request.restaurant_name}
                          </p>
                          <p className="mt-1 truncate text-xs font-semibold capitalize text-[#94A3B8]">
                            {request.package_type || "No package"} package
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-xs font-black ${cfg.className}`}
                        >
                          {cfg.label}
                        </Badge>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="rounded-2xl border border-[#E5EAF1] bg-[#22C7A1]/10 p-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">
                            Price
                          </p>
                          <p className="mt-1 text-lg font-black text-[#020617]">
                            {request.price_paid && request.price_paid > 0
                              ? formatCurrency(request.price_paid)
                              : "-"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                            Expires
                          </p>
                          <p className="mt-1 text-sm font-black text-[#020617]">
                            {request.ends_at
                              ? format(new Date(request.ends_at), "dd MMM yyyy")
                              : "-"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 rounded-2xl bg-[#F6F8FB] p-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Payment Ref
                        </p>
                        <p className="mt-1 truncate font-mono text-sm font-semibold text-[#020617]">
                          {request.payment_reference || "-"}
                        </p>
                        <p className="mt-2 text-xs font-semibold text-[#94A3B8]">
                          Requested{" "}
                          {request.created_at
                            ? format(
                                new Date(request.created_at),
                                "dd MMM yyyy",
                              )
                            : "-"}
                        </p>
                      </div>

                      {request.status === "pending" && (
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="min-h-[44px] rounded-2xl border-[#22C7A1]/20 bg-[#22C7A1]/10 font-black text-[#22C7A1] hover:bg-[#22C7A1]/10 hover:text-[#22C7A1]"
                            onClick={() => openAction(request, "approve")}
                          >
                            <Check className="mr-2 h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="min-h-[44px] rounded-2xl border-[#FB6B7A]/20 bg-[#FB6B7A]/10 font-black text-[#FB6B7A] hover:bg-[#FB6B7A]/10 hover:text-[#FB6B7A]"
                            onClick={() => openAction(request, "reject")}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#E5EAF1] bg-white">
                      {[
                        "Restaurant",
                        "Package",
                        "Price",
                        "Payment Ref",
                        "Expires",
                        "Date",
                        "Status",
                        "Actions",
                      ].map((head) => (
                        <th
                          key={head}
                          className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.12em] text-[#94A3B8]"
                        >
                          {head}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5EAF1]">
                    {filtered.map((request) => {
                      const cfg =
                        statusConfig[request.status] || statusConfig.expired;
                      return (
                        <tr
                          key={request.id}
                          className="transition-colors hover:bg-[#F6F8FB]"
                        >
                          <td className="px-4 py-3 font-black text-[#020617]">
                            {request.restaurant_name}
                          </td>
                          <td className="px-4 py-3 font-semibold capitalize text-[#020617]">
                            {request.package_type || "-"}
                          </td>
                          <td className="px-4 py-3 font-black text-[#22C7A1]">
                            {request.price_paid && request.price_paid > 0
                              ? formatCurrency(request.price_paid)
                              : "-"}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs font-semibold text-[#94A3B8]">
                            {request.payment_reference || "-"}
                          </td>
                          <td className="px-4 py-3 font-semibold text-[#94A3B8]">
                            {request.ends_at
                              ? format(new Date(request.ends_at), "dd MMM yyyy")
                              : "-"}
                          </td>
                          <td className="px-4 py-3 font-semibold text-[#94A3B8]">
                            {request.created_at
                              ? format(
                                  new Date(request.created_at),
                                  "dd MMM yyyy",
                                )
                              : "-"}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              variant="outline"
                              className={`text-xs font-black ${cfg.className}`}
                            >
                              {cfg.label}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {request.status === "pending" && (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-11 min-w-11 rounded-2xl border-[#22C7A1]/20 bg-white px-3 text-[#22C7A1] hover:bg-[#22C7A1]/10 hover:text-[#22C7A1]"
                                  onClick={() => openAction(request, "approve")}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-11 min-w-11 rounded-2xl border-[#FB6B7A]/20 bg-white px-3 text-[#FB6B7A] hover:bg-[#FB6B7A]/10 hover:text-[#FB6B7A]"
                                  onClick={() => openAction(request, "reject")}
                                >
                                  <X className="h-4 w-4" />
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
            </>
          )}
        </section>

        <Dialog
          open={!!actionTarget}
          onOpenChange={() => {
            setActionTarget(null);
            setActionType(null);
          }}
        >
          <AdminDialogContent size="sm">
            <DialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 text-left">
              <DialogTitle className="text-xl font-black text-[#020617]">
                {actionType === "approve"
                  ? "Approve Request"
                  : "Reject Request"}
              </DialogTitle>
              <DialogDescription className="font-semibold text-[#94A3B8]">
                {actionType === "approve"
                  ? `This will activate Premium Analytics for "${actionTarget?.restaurant_name}" until ${actionTarget?.ends_at ? format(new Date(actionTarget.ends_at), "dd MMM yyyy") : "an unspecified date"}.`
                  : `This will reject the request from "${actionTarget?.restaurant_name}". No access will be granted.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 border-t border-[#E5EAF1] bg-[#F6F8FB] p-5 sm:gap-3">
              <Button
                variant="outline"
                disabled={actionSubmitting}
                onClick={() => {
                  setActionTarget(null);
                  setActionType(null);
                }}
                className="h-11 rounded-[14px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-white"
              >
                Cancel
              </Button>
              <Button
                disabled={actionSubmitting}
                onClick={handleAction}
                variant="outline"
                className={`h-11 rounded-[14px] font-black ${actionType === "approve" ? "border-[#22C7A1]/30 bg-[#22C7A1]/10 text-[#020617] hover:bg-[#22C7A1]/15" : "border-[#FB6B7A]/30 bg-[#FB6B7A]/10 text-[#FB6B7A] hover:bg-[#FB6B7A]/15"}`}
              >
                {actionSubmitting && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {actionType === "approve" ? "Approve" : "Reject"}
              </Button>
            </DialogFooter>
          </AdminDialogContent>
        </Dialog>

        <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
          <AdminDialogContent size="sm">
            <DialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 text-left">
              <DialogTitle className="flex items-center gap-2 text-xl font-black text-[#020617]">
                <span className="flex h-10 w-10 items-center justify-center rounded-[14px] border border-[#7C83F6]/25 bg-[#7C83F6]/10 text-[#7C83F6]">
                  <Gift className="h-5 w-5" />
                </span>
                Manual Grant
              </DialogTitle>
              <DialogDescription className="font-semibold text-[#94A3B8]">
                Activate Premium Analytics for a restaurant without payment.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 p-5">
              <div className="space-y-1.5">
                <Label className="font-black text-[#020617]">Restaurant</Label>
                <Select
                  value={grantRestaurantId}
                  onValueChange={setGrantRestaurantId}
                >
                  <SelectTrigger className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617]">
                    <SelectValue placeholder="Select restaurant..." />
                  </SelectTrigger>
                  <SelectContent className="rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]">
                    {restaurants.map((restaurant) => (
                      <SelectItem key={restaurant.id} value={restaurant.id}>
                        {restaurant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="font-black text-[#020617]">Package</Label>
                <Select value={grantPackage} onValueChange={setGrantPackage}>
                  <SelectTrigger className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]">
                    <SelectItem value="monthly">Monthly (1 month)</SelectItem>
                    <SelectItem value="quarterly">
                      Quarterly (3 months)
                    </SelectItem>
                    <SelectItem value="yearly">Yearly (12 months)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="gap-2 border-t border-[#E5EAF1] bg-[#F6F8FB] p-5 sm:gap-3">
              <Button
                variant="outline"
                onClick={() => setGrantOpen(false)}
                disabled={grantSubmitting}
                className="h-11 rounded-[14px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleManualGrant}
                disabled={!grantRestaurantId || grantSubmitting}
                variant="outline"
                className="h-11 rounded-[14px] border-[#22C7A1]/30 bg-[#22C7A1]/10 font-black text-[#020617] hover:bg-[#22C7A1]/15"
              >
                {grantSubmitting && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Grant Access
              </Button>
            </DialogFooter>
          </AdminDialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
