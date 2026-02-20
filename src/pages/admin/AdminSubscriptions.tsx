import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  CreditCard,
  Calendar,
  User,
  Edit,
  XCircle,
  RefreshCw,
  MoreHorizontal,
  Eye,
  Download,
  ChevronDown,
  ChevronUp,
  Loader2,
  DollarSign,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";
import { format } from "date-fns";

interface SubscriptionData {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  price: number;
  start_date: string;
  end_date: string;
  auto_renew: boolean;
  meals_per_week: number;
  meals_used_this_week: number;
  created_at: string;
  profile?: {
    full_name: string | null;
    email?: string;
  } | null;
}

const AdminSubscriptions = () => {
  const [subscriptions, setSubscriptions] = useState<SubscriptionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSubscriptions, setSelectedSubscriptions] = useState<Set<string>>(new Set());
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionData | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "active" | "cancelled" | "expired" | "pending">("all");
  const [sortField, setSortField] = useState<"created_at" | "end_date" | "price">("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  const [editPlan, setEditPlan] = useState("");
  const [editMealsPerWeek, setEditMealsPerWeek] = useState("");
  const [editAutoRenew, setEditAutoRenew] = useState(true);

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const fetchSubscriptions = async () => {
    setLoading(true);
    try {
      const { data: subsData, error: subsError } = await supabase
        .from("subscriptions")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (subsError) throw subsError;

      if (subsData) {
        const userIds = [...new Set(subsData.map(s => s.user_id).filter(Boolean))];
        
        let profileMap = new Map();
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("user_id, full_name, email")
            .in("user_id", userIds);
          
          profileMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
        }
        
        const enrichedData = subsData.map(s => ({
          ...s,
          profile: profileMap.get(s.user_id) || null
        }));
        setSubscriptions(enrichedData as SubscriptionData[]);
      }
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
      toast({
        title: "Error",
        description: "Failed to load subscriptions",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (subscription: SubscriptionData) => {
    setSelectedSubscription(subscription);
    setEditPlan(subscription.plan);
    setEditMealsPerWeek(subscription.meals_per_week?.toString() || "5");
    setEditAutoRenew(subscription.auto_renew ?? true);
    setIsEditOpen(true);
  };

  const handleCancelClick = (subscription: SubscriptionData) => {
    setSelectedSubscription(subscription);
    setIsCancelOpen(true);
  };

  const handleUpdateSubscription = async () => {
    if (!selectedSubscription) return;
    
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("subscriptions")
        .update({
          plan: editPlan as "monthly" | "weekly",
          meals_per_week: parseInt(editMealsPerWeek),
          auto_renew: editAutoRenew,
        })
        .eq("id", selectedSubscription.id);

      if (error) throw error;

      setSubscriptions((prev) =>
        prev.map((sub) =>
          sub.id === selectedSubscription.id
            ? { ...sub, plan: editPlan, meals_per_week: parseInt(editMealsPerWeek), auto_renew: editAutoRenew }
            : sub
        )
      );

      toast({
        title: "Success",
        description: "Subscription updated successfully",
      });
      setIsEditOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update subscription",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!selectedSubscription) return;
    
    setProcessing(true);
    try {
      const { error } = await supabase
        .from("subscriptions")
        .update({
          status: "cancelled",
          auto_renew: false,
        })
        .eq("id", selectedSubscription.id);

      if (error) throw error;

      setSubscriptions((prev) =>
        prev.map((sub) =>
          sub.id === selectedSubscription.id
            ? { ...sub, status: "cancelled", auto_renew: false }
            : sub
        )
      );

      toast({
        title: "Success",
        description: "Subscription cancelled successfully",
      });
      setIsCancelOpen(false);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to cancel subscription",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const toggleSubscriptionSelection = (subscriptionId: string) => {
    setSelectedSubscriptions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(subscriptionId)) {
        newSet.delete(subscriptionId);
      } else {
        newSet.add(subscriptionId);
      }
      return newSet;
    });
  };

  const selectAllSubscriptions = () => {
    if (selectedSubscriptions.size === filteredSubscriptions.length) {
      setSelectedSubscriptions(new Set());
    } else {
      setSelectedSubscriptions(new Set(filteredSubscriptions.map((s) => s.id)));
    }
  };

  const handleSort = (field: "created_at" | "end_date" | "price") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const exportToCSV = () => {
    const headers = ["ID", "User", "Plan", "Status", "Price", "Start Date", "End Date", "Meals/Week", "Auto Renew"];
    const rows = filteredSubscriptions.map((s) => [
      s.id,
      s.profile?.full_name || "Unknown",
      s.plan,
      s.status,
      formatCurrency(s.price),
      format(new Date(s.start_date), "yyyy-MM-dd"),
      format(new Date(s.end_date), "yyyy-MM-dd"),
      s.meals_per_week,
      s.auto_renew ? "Yes" : "No",
    ]);
    
    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subscriptions-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({ title: "Export Complete", description: `${rows.length} subscriptions exported to CSV.` });
  };

  const filteredSubscriptions = subscriptions
    .filter((sub) => {
      const matchesSearch = 
        !searchQuery ||
        sub.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.plan.toLowerCase().includes(searchQuery.toLowerCase()) ||
        sub.id.toLowerCase().includes(searchQuery.toLowerCase());

      if (activeTab === "all") return matchesSearch;
      return matchesSearch && sub.status === activeTab;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === "created_at") {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortField === "end_date") {
        comparison = new Date(a.end_date).getTime() - new Date(b.end_date).getTime();
      } else if (sortField === "price") {
        comparison = a.price - b.price;
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
            Active
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
            Cancelled
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="outline" className="bg-slate-500/10 text-slate-600 border-slate-500/20">
            Expired
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
            Pending
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case "weekly":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
            Weekly
          </Badge>
        );
      case "monthly":
        return (
          <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20">
            Monthly
          </Badge>
        );
      default:
        return <Badge variant="outline">{plan}</Badge>;
    }
  };

  // Calculate stats
  const stats = {
    total: subscriptions.length,
    active: subscriptions.filter(s => s.status === "active").length,
    cancelled: subscriptions.filter(s => s.status === "cancelled").length,
    expired: subscriptions.filter(s => s.status === "expired").length,
    pending: subscriptions.filter(s => s.status === "pending").length,
    revenue: subscriptions
      .filter(s => s.status === "active")
      .reduce((acc, s) => acc + (s.price || 0), 0),
  };

  return (
    <AdminLayout title="Subscription Management" subtitle={`${stats.active} active subscriptions`}>
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-primary" />
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
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <RefreshCw className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.active}</p>
                  <p className="text-xs text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.cancelled}</p>
                  <p className="text-xs text-muted-foreground">Cancelled</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-500/10 flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-slate-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.expired}</p>
                  <p className="text-xs text-muted-foreground">Expired</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{formatCurrency(stats.revenue)}</p>
                  <p className="text-xs text-muted-foreground">Monthly Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { value: "all", label: "All", count: stats.total },
            { value: "active", label: "Active", count: stats.active },
            { value: "cancelled", label: "Cancelled", count: stats.cancelled },
            { value: "expired", label: "Expired", count: stats.expired },
            { value: "pending", label: "Pending", count: stats.pending },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {tab.count}
                </Badge>
              )}
            </button>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, plan, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={exportToCSV} className="gap-2">
                  <Download className="w-4 h-4" />
                  Export
                </Button>
                <Button variant="outline" size="icon" onClick={fetchSubscriptions} disabled={loading}>
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedSubscriptions.size > 0 && (
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between">
            <span className="text-sm text-primary font-medium">
              {selectedSubscriptions.size} subscription{selectedSubscriptions.size > 1 ? "s" : ""} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                Export Selected
              </Button>
            </div>
          </div>
        )}

        {/* Subscriptions Table */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Subscriptions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 pl-6">
                    <Checkbox
                      checked={selectedSubscriptions.size === filteredSubscriptions.length && filteredSubscriptions.length > 0}
                      onCheckedChange={selectAllSubscriptions}
                    />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <button onClick={() => handleSort("price")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Price
                      {sortField === "price" && (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </button>
                  </TableHead>
                  <TableHead>
                    <button onClick={() => handleSort("end_date")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      End Date
                      {sortField === "end_date" && (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </button>
                  </TableHead>
                  <TableHead>Meals</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-muted-foreground text-sm">Loading subscriptions...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredSubscriptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                          <CreditCard className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground">No subscriptions found</p>
                        <p className="text-muted-foreground/70 text-sm">Try adjusting your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSubscriptions.map((subscription) => (
                    <TableRow key={subscription.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="pl-6">
                        <Checkbox
                          checked={selectedSubscriptions.has(subscription.id)}
                          onCheckedChange={() => toggleSubscriptionSelection(subscription.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{subscription.profile?.full_name || "Unknown User"}</p>
                            <p className="text-xs text-muted-foreground">{subscription.profile?.email || "No email"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getPlanBadge(subscription.plan)}</TableCell>
                      <TableCell>{getStatusBadge(subscription.status)}</TableCell>
                      <TableCell>
                        <span className="font-medium">{formatCurrency(subscription.price)}</span>
                        <span className="text-xs text-muted-foreground">/month</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(subscription.end_date), "MMM d, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <span className="font-medium">{subscription.meals_used_this_week || 0}</span>
                          <span className="text-muted-foreground">/{subscription.meals_per_week || 0}</span>
                          <span className="text-xs text-muted-foreground ml-1">this week</span>
                        </div>
                        {subscription.auto_renew && (
                          <Badge variant="outline" className="text-xs mt-1">
                            <RefreshCw className="w-3 h-3 mr-1" />
                            Auto-renew
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditClick(subscription)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedSubscription(subscription);
                                  setIsDetailOpen(true);
                                }}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEditClick(subscription)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {subscription.status === "active" && (
                                <DropdownMenuItem
                                  onClick={() => handleCancelClick(subscription)}
                                  className="text-red-600 focus:text-red-600 focus:bg-red-500/10"
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Cancel
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Subscription Detail Sheet */}
        <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <SheetContent className="w-full sm:max-w-xl">
            {selectedSubscription && (
              <>
                <SheetHeader className="pb-6 border-b">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <SheetTitle className="text-xl">
                        {selectedSubscription.profile?.full_name || "Unknown User"}
                      </SheetTitle>
                      <SheetDescription>{getStatusBadge(selectedSubscription.status)}</SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {/* Subscription Info */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        Subscription Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Subscription ID</p>
                          <code className="text-sm font-mono">{selectedSubscription.id.substring(0, 16)}...</code>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Plan</p>
                          <p className="text-sm font-medium">{getPlanBadge(selectedSubscription.plan)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Price</p>
                          <p className="text-lg font-semibold">{formatCurrency(selectedSubscription.price)}<span className="text-sm text-muted-foreground">/month</span></p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Meals per Week</p>
                          <p className="text-sm font-medium">{selectedSubscription.meals_per_week}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Start Date</p>
                          <p className="text-sm">{format(new Date(selectedSubscription.start_date), "MMM d, yyyy")}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">End Date</p>
                          <p className="text-sm">{format(new Date(selectedSubscription.end_date), "MMM d, yyyy")}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Usage */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        This Week Usage
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                        <div>
                          <p className="text-sm text-muted-foreground">Meals Used</p>
                          <p className="text-2xl font-bold">
                            {selectedSubscription.meals_used_this_week || 0}
                            <span className="text-lg text-muted-foreground">/{selectedSubscription.meals_per_week || 0}</span>
                          </p>
                        </div>
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                          <CreditCard className="w-8 h-8 text-primary" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Auto Renew */}
                  {selectedSubscription.auto_renew && (
                    <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-emerald-600" />
                        <p className="text-sm text-emerald-700 font-medium">Auto-renewal is enabled</p>
                      </div>
                      <p className="text-xs text-emerald-600 mt-1">
                        This subscription will automatically renew on {format(new Date(selectedSubscription.end_date), "MMM d, yyyy")}
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  {selectedSubscription.status === "active" && (
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => {
                          setIsDetailOpen(false);
                          handleEditClick(selectedSubscription);
                        }}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Subscription
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => {
                          setIsDetailOpen(false);
                          handleCancelClick(selectedSubscription);
                        }}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Cancel
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* Edit Dialog */}
        <Sheet open={isEditOpen} onOpenChange={setIsEditOpen}>
          <SheetContent className="w-full sm:max-w-md">
            <SheetHeader className="pb-6">
              <SheetTitle>Edit Subscription</SheetTitle>
              <SheetDescription>
                Modify subscription details for {selectedSubscription?.profile?.full_name || "this user"}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={editPlan} onValueChange={setEditPlan}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Meals per Week</Label>
                <Select value={editMealsPerWeek} onValueChange={setEditMealsPerWeek}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 meals</SelectItem>
                    <SelectItem value="5">5 meals</SelectItem>
                    <SelectItem value="7">7 meals</SelectItem>
                    <SelectItem value="10">10 meals</SelectItem>
                    <SelectItem value="14">14 meals</SelectItem>
                    <SelectItem value="21">21 meals</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Auto-renew</Label>
                <Select
                  value={editAutoRenew ? "yes" : "no"}
                  onValueChange={(v) => setEditAutoRenew(v === "yes")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes</SelectItem>
                    <SelectItem value="no">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setIsEditOpen(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleUpdateSubscription} disabled={processing}>
                  {processing ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Edit className="w-4 h-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Cancel Dialog */}
        <Sheet open={isCancelOpen} onOpenChange={setIsCancelOpen}>
          <SheetContent className="w-full sm:max-w-md">
            <SheetHeader className="pb-6">
              <SheetTitle>Cancel Subscription</SheetTitle>
              <SheetDescription>
                Are you sure you want to cancel this subscription? This will disable auto-renewal and mark the subscription as cancelled.
              </SheetDescription>
            </SheetHeader>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setIsCancelOpen(false)}>
                Keep Subscription
              </Button>
              <Button 
                variant="destructive" 
                className="flex-1" 
                onClick={handleCancelSubscription} 
                disabled={processing}
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <XCircle className="w-4 h-4 mr-2" />
                )}
                Cancel Subscription
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </AdminLayout>
  );
};

export default AdminSubscriptions;
