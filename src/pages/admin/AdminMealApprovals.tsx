import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
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
  DollarSign,
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
  } | null;
}

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; color: string; bgColor: string }> = {
  pending: {
    label: "Pending",
    color: "text-amber-600",
    bgColor: "bg-amber-500/10 border-amber-500/20",
  },
  approved: {
    label: "Approved",
    color: "text-green-600",
    bgColor: "bg-green-500/10 border-green-500/20",
  },
  rejected: {
    label: "Rejected",
    color: "text-red-600",
    bgColor: "bg-red-500/10 border-red-500/20",
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
        .select("id, name, description, price, approval_status, created_at, image_url, calories, restaurant_id")
        .not("approval_status", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const restaurantIds = [
        ...new Set((mealsData || []).map((m) => m.restaurant_id).filter(Boolean)),
      ];
      let restaurantsMap: Record<string, { id: string; name: string }> = {};

      if (restaurantIds.length > 0) {
        const { data: restaurants } = await supabase
          .from("restaurants")
          .select("id, name")
          .in("id", restaurantIds);

        if (restaurants) {
          restaurantsMap = restaurants.reduce(
            (acc, r) => {
              acc[r.id] = { id: r.id, name: r.name };
              return acc;
            },
            {} as Record<string, { id: string; name: string }>
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
        restaurant: m.restaurant_id ? restaurantsMap[m.restaurant_id] || null : null,
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
        throw new Error("Update was blocked — check that the approval_status column exists and admin RLS policies allow updates.");
      }

      setMeals((prev) =>
        prev.map((m) => (m.id === meal.id ? { ...m, approval_status: "approved" } : m))
      );
      if (selectedMeal?.id === meal.id) {
        setSelectedMeal((prev) => prev ? { ...prev, approval_status: "approved" } : prev);
      }

      toast({ title: "Meal Approved", description: `"${meal.name}" is now live for customers.` });
    } catch (err: unknown) {
      console.error("Error approving meal:", err);
      const message = err instanceof Error ? err.message : "Failed to approve meal";
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
        throw new Error("Update was blocked — check that the approval_status column exists and admin RLS policies allow updates.");
      }

      setMeals((prev) =>
        prev.map((m) => (m.id === meal.id ? { ...m, approval_status: "rejected" } : m))
      );
      if (selectedMeal?.id === meal.id) {
        setSelectedMeal((prev) => prev ? { ...prev, approval_status: "rejected" } : prev);
      }

      toast({ title: "Meal Rejected", description: `"${meal.name}" has been rejected.` });
    } catch (err: unknown) {
      console.error("Error rejecting meal:", err);
      const message = err instanceof Error ? err.message : "Failed to reject meal";
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
      <Badge variant="outline" className={config.bgColor}>
        {status === "pending" && <Clock className="h-3 w-3 mr-1" />}
        {status === "approved" && <CheckCircle className="h-3 w-3 mr-1" />}
        {status === "rejected" && <XCircle className="h-3 w-3 mr-1" />}
        {config.label}
      </Badge>
    );
  };

  return (
    <AdminLayout title="Meal Approvals" subtitle="Review meals priced above 50 QAR">
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Utensils className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.approved}</p>
                  <p className="text-xs text-muted-foreground">Approved</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.rejected}</p>
                  <p className="text-xs text-muted-foreground">Rejected</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {(["all", "pending", "approved", "rejected"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                activeTab === tab
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {tab}
              {tab !== "all" && stats[tab] > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {stats[tab]}
                </Badge>
              )}
            </button>
          ))}
        </div>

        {/* Search & Refresh */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by meal name or restaurant..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" size="icon" onClick={fetchMeals} disabled={loading}>
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Meals Requiring Approval</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Meal</TableHead>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Price (QAR)</TableHead>
                  <TableHead>Platform Fee (18%)</TableHead>
                  <TableHead>Restaurant Payout</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="w-36">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-muted-foreground text-sm">Loading...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredMeals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                          <Utensils className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground">No meals found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMeals.map((meal) => (
                    <TableRow key={meal.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {meal.image_url ? (
                            <img
                              src={meal.image_url}
                              alt={meal.name}
                              className="w-10 h-10 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <Utensils className="w-5 h-5 text-primary" />
                            </div>
                          )}
                          <p className="font-medium">{meal.name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Store className="w-3 h-3" />
                          {meal.restaurant?.name || "Unknown"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-primary">
                          {formatCurrency(meal.price)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-destructive">
                          {formatCurrency(meal.price * 0.18)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-green-600">
                          {formatCurrency(meal.price * 0.82)}
                        </span>
                      </TableCell>
                      <TableCell>{getStatusBadge(meal.approval_status)}</TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(meal.created_at), "MMM d, yyyy")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => {
                              setSelectedMeal(meal);
                              setIsDetailOpen(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {meal.approval_status === "pending" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                                onClick={() => handleApprove(meal)}
                                disabled={processingId === meal.id}
                              >
                                {processingId === meal.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                                onClick={() => handleReject(meal)}
                                disabled={processingId === meal.id}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Detail Sheet */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent className="w-full sm:max-w-md">
          {selectedMeal && (
            <>
              <SheetHeader className="pb-6 border-b">
                <div className="flex items-center gap-4">
                  {selectedMeal.image_url ? (
                    <img
                      src={selectedMeal.image_url}
                      alt={selectedMeal.name}
                      className="w-16 h-16 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Utensils className="w-8 h-8 text-primary" />
                    </div>
                  )}
                  <div>
                    <SheetTitle className="text-xl">{selectedMeal.name}</SheetTitle>
                    <SheetDescription>{getStatusBadge(selectedMeal.approval_status)}</SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <div className="mt-6 space-y-5">
                {selectedMeal.description && (
                  <p className="text-sm text-muted-foreground">{selectedMeal.description}</p>
                )}

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Restaurant
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{selectedMeal.restaurant?.name || "Unknown"}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                      Pricing Breakdown
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Meal Price (set by restaurant)</span>
                      <span className="font-semibold text-primary">{formatCurrency(selectedMeal.price)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-destructive">
                      <span>Platform Fee (18%)</span>
                      <span>- {formatCurrency(selectedMeal.price * 0.18)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-semibold border-t pt-2">
                      <span>Restaurant Payout</span>
                      <span className="text-green-600">{formatCurrency(selectedMeal.price * 0.82)}</span>
                    </div>
                  </CardContent>
                </Card>

                {selectedMeal.approval_status === "pending" && (
                  <div className="flex gap-3">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
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
                      variant="destructive"
                      className="flex-1 gap-2"
                      onClick={() => handleReject(selectedMeal)}
                      disabled={processingId === selectedMeal.id}
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </Button>
                  </div>
                )}

                {selectedMeal.approval_status !== "pending" && (
                  <div className="text-sm text-muted-foreground text-center py-2">
                    This meal has already been {selectedMeal.approval_status}.
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
};

export default AdminMealApprovals;
