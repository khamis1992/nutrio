import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Search, CreditCard, Calendar, User, Edit, XCircle, RefreshCw } from "lucide-react";
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
  } | null;
}

export default function AdminSubscriptions() {
  const { user } = useAuth();
  const [subscriptions, setSubscriptions] = useState<SubscriptionData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [selectedSubscription, setSelectedSubscription] = useState<SubscriptionData | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  
  const [editPlan, setEditPlan] = useState("");
  const [editMealsPerWeek, setEditMealsPerWeek] = useState("");
  const [editAutoRenew, setEditAutoRenew] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSubscriptions();
    }
  }, [user]);

  const fetchSubscriptions = async () => {
    const { data: subsData, error: subsError } = await supabase
      .from("subscriptions")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (subsError) {
      console.error("Error fetching subscriptions:", subsError);
      return;
    }

    if (subsData) {
      const userIds = [...new Set(subsData.map(s => s.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      
      const profileMap = new Map(profilesData?.map(p => [p.user_id, p]) || []);
      const enrichedData = subsData.map(s => ({
        ...s,
        profile: profileMap.get(s.user_id) || null
      }));
      setSubscriptions(enrichedData as SubscriptionData[]);
    }
  };

  const handleEditClick = (subscription: SubscriptionData) => {
    setSelectedSubscription(subscription);
    setEditPlan(subscription.plan);
    setEditMealsPerWeek(subscription.meals_per_week?.toString() || "5");
    setEditAutoRenew(subscription.auto_renew ?? true);
    setEditDialogOpen(true);
  };

  const handleCancelClick = (subscription: SubscriptionData) => {
    setSelectedSubscription(subscription);
    setCancelDialogOpen(true);
  };

  const handleUpdateSubscription = async () => {
    if (!selectedSubscription) return;
    
    setProcessing(true);
    const { error } = await supabase
      .from("subscriptions")
      .update({
        plan: editPlan as "monthly" | "weekly",
        meals_per_week: parseInt(editMealsPerWeek),
        auto_renew: editAutoRenew,
      })
      .eq("id", selectedSubscription.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to update subscription",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Subscription updated successfully",
      });
      fetchSubscriptions();
      setEditDialogOpen(false);
    }
    setProcessing(false);
  };

  const handleCancelSubscription = async () => {
    if (!selectedSubscription) return;
    
    setProcessing(true);
    const { error } = await supabase
      .from("subscriptions")
      .update({
        status: "cancelled",
        auto_renew: false,
      })
      .eq("id", selectedSubscription.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to cancel subscription",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Subscription cancelled successfully",
      });
      fetchSubscriptions();
      setCancelDialogOpen(false);
    }
    setProcessing(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>;
      case "cancelled":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Cancelled</Badge>;
      case "expired":
        return <Badge className="bg-gray-500/10 text-gray-600 border-gray-500/20">Expired</Badge>;
      case "pending":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case "weekly":
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">Weekly</Badge>;
      case "monthly":
        return <Badge className="bg-purple-500/10 text-purple-600 border-purple-500/20">Monthly</Badge>;
      default:
        return <Badge variant="outline">{plan}</Badge>;
    }
  };

  const filteredSubscriptions = subscriptions.filter((sub) => {
    const matchesSearch = 
      sub.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.plan.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sub.id.toLowerCase().includes(searchQuery.toLowerCase());

    if (activeTab === "all") return matchesSearch;
    return matchesSearch && sub.status === activeTab;
  });

  const stats = {
    total: subscriptions.length,
    active: subscriptions.filter(s => s.status === "active").length,
    cancelled: subscriptions.filter(s => s.status === "cancelled").length,
    revenue: subscriptions
      .filter(s => s.status === "active")
      .reduce((acc, s) => acc + (s.price || 0), 0),
  };

  return (
    <AdminLayout title="Subscription Management" subtitle="View and manage all user subscriptions">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Active</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Cancelled</span>
            </div>
            <p className="text-2xl font-bold text-red-600">{stats.cancelled}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Monthly Revenue</span>
            </div>
            <p className="text-2xl font-bold">${stats.revenue.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, plan, or ID..."
          className="pl-10"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
          <TabsTrigger value="active">Active ({stats.active})</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled ({stats.cancelled})</TabsTrigger>
          <TabsTrigger value="expired">Expired</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {filteredSubscriptions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No subscriptions found
              </CardContent>
            </Card>
          ) : (
            filteredSubscriptions.map((subscription) => (
              <Card key={subscription.id}>
                <CardContent className="py-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {subscription.profile?.full_name || "Unknown User"}
                        </span>
                        {getStatusBadge(subscription.status)}
                        {getPlanBadge(subscription.plan)}
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CreditCard className="h-3 w-3" />
                          ${subscription.price}/month
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(subscription.start_date), "MMM d, yyyy")} - {format(new Date(subscription.end_date), "MMM d, yyyy")}
                        </span>
                        <span>
                          Meals: {subscription.meals_used_this_week || 0}/{subscription.meals_per_week || 0} this week
                        </span>
                        {subscription.auto_renew && (
                          <Badge variant="outline" className="text-xs">
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Auto-renew
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditClick(subscription)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                      {subscription.status === "active" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleCancelClick(subscription)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Subscription</DialogTitle>
            <DialogDescription>
              Modify subscription details for {selectedSubscription?.profile?.full_name || "this user"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
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
                  <SelectItem value="21">21 meals (unlimited)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label>Auto-renew</Label>
              <Select 
                value={editAutoRenew ? "yes" : "no"} 
                onValueChange={(v) => setEditAutoRenew(v === "yes")}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes</SelectItem>
                  <SelectItem value="no">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSubscription} disabled={processing}>
              {processing ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Subscription</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this subscription? This action will disable auto-renewal and mark the subscription as cancelled.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Subscription
            </Button>
            <Button variant="destructive" onClick={handleCancelSubscription} disabled={processing}>
              {processing ? "Cancelling..." : "Cancel Subscription"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}