import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import {
  AdminFilterBar,
  AdminKpiStrip,
  AdminPanel,
  AdminSheetContent,
  AdminWorkbenchHeader,
} from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Search,
  Utensils,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Store,
  RefreshCw,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";
import { format } from "date-fns";

type ApprovalStatus = "pending" | "approved" | "rejected";

interface MealApproval {
  id: string;
  name: string;
  description: string | null;
  price: number;
  approval_status: ApprovalStatus;
  created_at: string;
  image_url: string | null;
  calories: number | null;
  restaurant: {
    id: string;
    name: string;
    commission_rate: number;
  } | null;
}

const STATUS_CONFIG: Record<
  ApprovalStatus,
  { label: string; color: string; bgColor: string }
> = {
  pending: {
    label: "Pending",
    color: "text-[#7C83F6]",
    bgColor: "bg-[#7C83F6]/10 border-[#7C83F6]/20",
  },
  approved: {
    label: "Approved",
    color: "text-[#22C7A1]",
    bgColor: "bg-[#22C7A1]/10 border-[#22C7A1]/20",
  },
  rejected: {
    label: "Rejected",
    color: "text-[#FB6B7A]",
    bgColor: "bg-[#FB6B7A]/10 border-[#FB6B7A]/20",
  },
};

const AdminMealApprovals = () => {
  const { toast } = useToast();
  const [meals, setMeals] = useState<MealApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | ApprovalStatus>("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<MealApproval | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const fetchMeals = useCallback(async () => {
    setLoading(true);
    try {
      const { data: mealsData, error } = await supabase
        .from("meals")
        .select(
          "id, name, description, price, approval_status, created_at, image_url, calories, restaurant_id",
        )
        .not("approval_status", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const restaurantIds = [
        ...new Set(
          (mealsData || [])
            .map((m) => m.restaurant_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      let restaurantsMap: Record<
        string,
        { id: string; name: string; commission_rate: number }
      > = {};

      if (restaurantIds.length > 0) {
        const { data: restaurants } = await supabase
          .from("restaurants")
          .select("id, name, commission_rate")
          .in("id", restaurantIds);

        if (restaurants) {
          restaurantsMap = restaurants.reduce(
            (acc, r) => {
              acc[r.id] = {
                id: r.id,
                name: r.name,
                commission_rate: r.commission_rate ?? 18,
              };
              return acc;
            },
            {} as Record<
              string,
              { id: string; name: string; commission_rate: number }
            >,
          );
        }
      }

      const mapped: MealApproval[] = (mealsData || []).map((m) => ({
        id: m.id,
        name: m.name,
        description: m.description,
        price: m.price || 0,
        approval_status: (m.approval_status as ApprovalStatus) || "pending",
        created_at: m.created_at || new Date().toISOString(),
        image_url: m.image_url,
        calories: m.calories,
        restaurant: m.restaurant_id
          ? restaurantsMap[m.restaurant_id] || null
          : null,
      }));

      setMeals(mapped);
    } catch (err) {
      console.error("Error fetching meals for approval:", err);
      toast({
        title: "Error",
        description: "Failed to load meal approvals",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchMeals();
  }, [fetchMeals]);

  const handleApprove = async (meal: MealApproval) => {
    setProcessingId(meal.id);
    try {
      const { data: updated, error } = await supabase
        .from("meals")
        .update({ approval_status: "approved", is_available: true })
        .eq("id", meal.id)
        .select("id, approval_status");

      if (error) throw error;

      // If no rows were returned the RLS policy silently blocked the update
      if (!updated || updated.length === 0) {
        throw new Error(
          "Update was blocked - check that the approval_status column exists and admin RLS policies allow updates.",
        );
      }

      setMeals((prev) =>
        prev.map((m) =>
          m.id === meal.id ? { ...m, approval_status: "approved" } : m,
        ),
      );
      if (selectedMeal?.id === meal.id) {
        setSelectedMeal((prev) =>
          prev ? { ...prev, approval_status: "approved" } : prev,
        );
      }

      toast({
        title: "Meal Approved",
        description: `"${meal.name}" is now live for customers.`,
      });
    } catch (err: unknown) {
      console.error("Error approving meal:", err);
      const message =
        err instanceof Error ? err.message : "Failed to approve meal";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (meal: MealApproval) => {
    setProcessingId(meal.id);
    try {
      const { data: updated, error } = await supabase
        .from("meals")
        .update({ approval_status: "rejected", is_available: false })
        .eq("id", meal.id)
        .select("id, approval_status");

      if (error) throw error;

      if (!updated || updated.length === 0) {
        throw new Error(
          "Update was blocked - check that the approval_status column exists and admin RLS policies allow updates.",
        );
      }

      setMeals((prev) =>
        prev.map((m) =>
          m.id === meal.id ? { ...m, approval_status: "rejected" } : m,
        ),
      );
      if (selectedMeal?.id === meal.id) {
        setSelectedMeal((prev) =>
          prev ? { ...prev, approval_status: "rejected" } : prev,
        );
      }

      toast({
        title: "Meal Rejected",
        description: `"${meal.name}" has been rejected.`,
      });
    } catch (err: unknown) {
      console.error("Error rejecting meal:", err);
      const message =
        err instanceof Error ? err.message : "Failed to reject meal";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setProcessingId(null);
    }
  };

  const filteredMeals = meals.filter((m) => {
    const matchesSearch =
      !searchQuery ||
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.restaurant?.name.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === "all") return matchesSearch;
    return matchesSearch && m.approval_status === activeTab;
  });

  const stats = {
    total: meals.length,
    pending: meals.filter((m) => m.approval_status === "pending").length,
    approved: meals.filter((m) => m.approval_status === "approved").length,
    rejected: meals.filter((m) => m.approval_status === "rejected").length,
  };

  const getStatusBadge = (status: ApprovalStatus) => {
    const config = STATUS_CONFIG[status];
    return (
      <Badge
        variant="outline"
        className={`${config.bgColor} ${config.color} rounded-full px-2.5 py-1 text-[11px] font-black`}
      >
        {status === "pending" && <Clock className="h-3 w-3 mr-1" />}
        {status === "approved" && <CheckCircle className="h-3 w-3 mr-1" />}
        {status === "rejected" && <XCircle className="h-3 w-3 mr-1" />}
        {config.label}
      </Badge>
    );
  };

  return (
    <AdminLayout
      title="Meal Approvals"
      subtitle="Review meals priced above 50 QAR"
    >
      <div className="space-y-5 bg-[#F6F8FB] p-3 text-[#020617] sm:p-5">
        <AdminWorkbenchHeader
          eyebrow="Approval queue"
          title="Meal review desk"
          icon={Utensils}
          accent="#22C7A1"
          description="Review high-value meals, validate pricing, inspect restaurant context, and publish approved items for customers."
          meta={[
            { label: "Pending", value: stats.pending },
            { label: "Approved", value: stats.approved },
            { label: "Rejected", value: stats.rejected },
          ]}
          actions={
            <Button
              variant="outline"
              onClick={fetchMeals}
              disabled={loading}
              className="h-11 rounded-[14px] border-[#22C7A1]/30 bg-[#22C7A1]/10 px-4 font-black text-[#020617] hover:bg-[#22C7A1]/15"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 text-[#22C7A1] ${
                  loading ? "animate-spin" : ""
                }`}
              />
              Refresh
            </Button>
          }
        />

        <AdminKpiStrip
          items={[
            {
              label: "Total meals",
              value: stats.total,
              helper: "All review items",
              icon: Utensils,
              accent: "#38BDF8",
            },
            {
              label: "Pending",
              value: stats.pending,
              helper: "Needs decision",
              icon: Clock,
              accent: "#7C83F6",
            },
            {
              label: "Approved",
              value: stats.approved,
              helper: "Published",
              icon: CheckCircle,
              accent: "#22C7A1",
            },
            {
              label: "Rejected",
              value: stats.rejected,
              helper: "Declined",
              icon: XCircle,
              accent: "#FB6B7A",
            },
          ]}
        />

        <AdminFilterBar title="Review queue">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2 rounded-[22px] bg-[#F6F8FB] p-1">
              {(["all", "pending", "approved", "rejected"] as const).map(
                (tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`min-h-11 rounded-[18px] border px-4 text-sm font-black capitalize transition-all ${
                      activeTab === tab
                        ? "border-[#22C7A1]/30 bg-[#22C7A1]/10 text-[#020617]"
                        : "border-transparent text-[#94A3B8] hover:bg-white hover:text-[#020617]"
                    }`}
                  >
                    {tab}
                    {tab !== "all" && stats[tab] > 0 && (
                      <span className="ml-2 rounded-full bg-white px-1.5 py-0.5 text-[11px] text-[#020617]">
                        {stats[tab]}
                      </span>
                    )}
                  </button>
                ),
              )}
            </div>
            <div className="relative min-w-0 flex-1 xl:max-w-md">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <Input
                placeholder="Search meal or restaurant"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 rounded-full border-[#E5EAF1] bg-[#F6F8FB] pl-11 text-[#020617] placeholder:text-[#94A3B8] focus-visible:ring-[#22C7A1]/30"
              />
            </div>
          </div>
        </AdminFilterBar>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="text-[18px] font-black text-[#020617]">
                Meals requiring approval
              </h3>
              <p className="text-sm font-medium text-[#94A3B8]">
                {filteredMeals.length} matching item
                {filteredMeals.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-[28px] bg-white p-10 text-center shadow-[0_14px_34px_rgba(2,6,23,0.05)] ring-1 ring-[#E5EAF1]">
              <Loader2 className="mx-auto h-9 w-9 animate-spin text-[#22C7A1]" />
              <p className="mt-3 text-sm font-bold text-[#94A3B8]">
                Loading approvals...
              </p>
            </div>
          ) : filteredMeals.length === 0 ? (
            <div className="rounded-[28px] bg-white p-10 text-center shadow-[0_14px_34px_rgba(2,6,23,0.05)] ring-1 ring-[#E5EAF1]">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F6F8FB] text-[#94A3B8]">
                <Utensils className="h-7 w-7" />
              </div>
              <p className="mt-4 text-base font-black text-[#020617]">
                No meals found
              </p>
              <p className="mt-1 text-sm font-medium text-[#94A3B8]">
                Try a different status or search term.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 2xl:grid-cols-2">
              {filteredMeals.map((meal) => {
                const commissionRate = meal.restaurant?.commission_rate ?? 18;
                const platformFee = meal.price * (commissionRate / 100);
                const payout = meal.price - platformFee;
                return (
                  <article
                    key={meal.id}
                    className="overflow-hidden rounded-[28px] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)] ring-1 ring-[#E5EAF1]"
                  >
                    <div className="grid gap-4 p-4 lg:grid-cols-[96px_minmax(0,1fr)_260px] lg:items-center">
                      <div className="h-24 w-full overflow-hidden rounded-[22px] bg-[#F6F8FB] lg:h-24 lg:w-24">
                        {meal.image_url ? (
                          <img
                            src={meal.image_url}
                            alt={meal.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[#38BDF8]">
                            <Utensils className="h-8 w-8" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          {getStatusBadge(meal.approval_status)}
                          <span className="rounded-full bg-[#F6F8FB] px-2.5 py-1 text-[11px] font-black text-[#94A3B8]">
                            {format(new Date(meal.created_at), "MMM d, yyyy")}
                          </span>
                        </div>
                        <h4 className="mt-3 truncate text-[18px] font-black text-[#020617]">
                          {meal.name}
                        </h4>
                        <div className="mt-1 flex min-w-0 items-center gap-1.5 text-sm font-bold text-[#94A3B8]">
                          <Store className="h-4 w-4 shrink-0 text-[#38BDF8]" />
                          <span className="truncate">
                            {meal.restaurant?.name || "Unknown restaurant"}
                          </span>
                        </div>
                        {meal.description && (
                          <p className="mt-2 line-clamp-2 text-sm font-medium leading-5 text-[#94A3B8]">
                            {meal.description}
                          </p>
                        )}
                      </div>

                      <div className="rounded-[22px] bg-[#F6F8FB] p-3">
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wide text-[#94A3B8]">
                              Price
                            </p>
                            <p className="mt-1 text-sm font-black text-[#22C7A1]">
                              {formatCurrency(meal.price)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wide text-[#94A3B8]">
                              Fee
                            </p>
                            <p className="mt-1 text-sm font-black text-[#FB6B7A]">
                              {formatCurrency(platformFee)}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-black uppercase tracking-wide text-[#94A3B8]">
                              Payout
                            </p>
                            <p className="mt-1 text-sm font-black text-[#7C83F6]">
                              {formatCurrency(payout)}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            className="min-h-[44px] flex-1 rounded-full border-[#E5EAF1] bg-white text-[#020617] hover:bg-[#F6F8FB]"
                            onClick={() => {
                              setSelectedMeal(meal);
                              setIsDetailOpen(true);
                            }}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </Button>
                          {meal.approval_status === "pending" && (
                            <>
                              <Button
                                className="min-h-[44px] flex-1 rounded-full bg-[#22C7A1] text-white hover:bg-[#22C7A1]/90"
                                onClick={() => handleApprove(meal)}
                                disabled={processingId === meal.id}
                              >
                                {processingId === meal.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                )}
                                Approve
                              </Button>
                              <Button
                                className="min-h-[44px] flex-1 rounded-full bg-[#FB6B7A] text-white hover:bg-[#FB6B7A]/90"
                                onClick={() => handleReject(meal)}
                                disabled={processingId === meal.id}
                              >
                                <XCircle className="mr-2 h-4 w-4" />
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Detail Sheet */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <AdminSheetContent size="md">
          {selectedMeal && (
            <>
              <SheetHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 text-left shadow-[0_12px_30px_rgba(2,6,23,0.05)]">
                <div className="flex items-center gap-4">
                  {selectedMeal.image_url ? (
                    <img
                      src={selectedMeal.image_url}
                      alt={selectedMeal.name}
                      className="h-16 w-16 rounded-2xl object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#38BDF8]/10">
                      <Utensils className="h-8 w-8 text-[#38BDF8]" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <SheetTitle className="truncate text-xl font-black text-[#020617]">
                      {selectedMeal.name}
                    </SheetTitle>
                    <SheetDescription>
                      {getStatusBadge(selectedMeal.approval_status)}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="space-y-5 p-5">
                {selectedMeal.description && (
                  <p className="rounded-2xl bg-white p-4 text-sm font-medium leading-6 text-[#94A3B8] ring-1 ring-[#E5EAF1]">
                    {selectedMeal.description}
                  </p>
                )}

                <AdminPanel className="rounded-[24px] shadow-none">
                  <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-3">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Restaurant
                    </h3>
                  </div>
                  <div className="px-5 pb-5 pt-4">
                    <div className="flex items-center gap-2">
                      <Store className="h-4 w-4 text-[#38BDF8]" />
                      <span className="font-bold text-[#020617]">
                        {selectedMeal.restaurant?.name || "Unknown"}
                      </span>
                    </div>
                  </div>
                </AdminPanel>

                <AdminPanel className="rounded-[24px] shadow-none">
                  <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-3">
                    <h3 className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Pricing Breakdown
                    </h3>
                  </div>
                  <div className="space-y-2 px-5 pb-5 pt-4">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-[#94A3B8]">
                        Meal Price (set by restaurant)
                      </span>
                      <span className="font-black text-[#22C7A1]">
                        {formatCurrency(selectedMeal.price)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-[#FB6B7A]">
                      <span>
                        Platform Fee (
                        {selectedMeal.restaurant?.commission_rate ?? 18}%)
                      </span>
                      <span>
                        -{" "}
                        {formatCurrency(
                          selectedMeal.price *
                            ((selectedMeal.restaurant?.commission_rate ?? 18) /
                              100),
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-[#E5EAF1] pt-2 text-sm font-black">
                      <span>Restaurant Payout</span>
                      <span className="text-[#7C83F6]">
                        {formatCurrency(
                          selectedMeal.price *
                            (1 -
                              (selectedMeal.restaurant?.commission_rate ?? 18) /
                                100),
                        )}
                      </span>
                    </div>
                  </div>
                </AdminPanel>

                {selectedMeal.approval_status === "pending" && (
                  <div className="flex gap-3">
                    <Button
                      className="min-h-[44px] flex-1 gap-2 rounded-full bg-[#22C7A1] font-black text-white hover:bg-[#22C7A1]/90"
                      onClick={() => handleApprove(selectedMeal)}
                      disabled={processingId === selectedMeal.id}
                    >
                      {processingId === selectedMeal.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle className="w-4 h-4" />
                      )}
                      Approve
                    </Button>
                    <Button
                      className="min-h-[44px] flex-1 gap-2 rounded-full bg-[#FB6B7A] font-black text-white hover:bg-[#FB6B7A]/90"
                      onClick={() => handleReject(selectedMeal)}
                      disabled={processingId === selectedMeal.id}
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </Button>
                  </div>
                )}

                {selectedMeal.approval_status !== "pending" && (
                  <div className="py-2 text-center text-sm font-medium text-[#94A3B8]">
                    This meal has already been {selectedMeal.approval_status}.
                  </div>
                )}
              </div>
            </>
          )}
        </AdminSheetContent>
      </Sheet>
    </AdminLayout>
  );
};

export default AdminMealApprovals;
