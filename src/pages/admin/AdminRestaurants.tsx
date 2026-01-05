import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  ArrowLeft,
  Store,
  MapPin,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Calendar,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  approval_status: "pending" | "approved" | "rejected";
  is_active: boolean;
  created_at: string;
  owner: {
    full_name: string | null;
    email: string | null;
  } | null;
}

const AdminRestaurants = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (user) {
      checkAdminAndFetch();
    }
  }, [user]);

  const checkAdminAndFetch = async () => {
    if (!user) return;

    try {
      // Check if user is admin
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      if (!roleData) {
        toast({
          title: "Access Denied",
          description: "You don't have admin privileges",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      await fetchRestaurants();
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRestaurants = async () => {
    const { data, error } = await supabase
      .from("restaurants")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching restaurants:", error);
      return;
    }

    // Fetch owner profiles
    const ownerIds = [...new Set((data || []).map((r) => r.owner_id).filter(Boolean))];
    let ownersMap: Record<string, { full_name: string | null; email: string | null }> = {};

    if (ownerIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", ownerIds);

      if (profiles) {
        ownersMap = profiles.reduce((acc, p) => {
          acc[p.user_id] = { full_name: p.full_name, email: null };
          return acc;
        }, {} as Record<string, { full_name: string | null; email: string | null }>);
      }
    }

    const restaurantsWithOwners = (data || []).map((r) => ({
      ...r,
      owner: r.owner_id ? ownersMap[r.owner_id] || null : null,
    }));

    setRestaurants(restaurantsWithOwners);
  };

  const handleAction = async () => {
    if (!selectedRestaurant || !actionType) return;

    try {
      setProcessing(true);

      const newStatus = actionType === "approve" ? "approved" : "rejected";

      const { error } = await supabase
        .from("restaurants")
        .update({ 
          approval_status: newStatus,
          is_active: actionType === "approve" 
        })
        .eq("id", selectedRestaurant.id);

      if (error) throw error;

      setRestaurants((prev) =>
        prev.map((r) =>
          r.id === selectedRestaurant.id
            ? { ...r, approval_status: newStatus, is_active: actionType === "approve" }
            : r
        )
      );

      toast({
        title: actionType === "approve" ? "Restaurant Approved" : "Restaurant Rejected",
        description: `${selectedRestaurant.name} has been ${newStatus}`,
      });

      setSelectedRestaurant(null);
      setActionType(null);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Error",
        description: "Failed to update restaurant status",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return null;
    }
  };

  const pendingRestaurants = restaurants.filter((r) => r.approval_status === "pending");
  const approvedRestaurants = restaurants.filter((r) => r.approval_status === "approved");
  const rejectedRestaurants = restaurants.filter((r) => r.approval_status === "rejected");

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container max-w-4xl mx-auto px-4 py-6 space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  const renderRestaurantList = (list: Restaurant[], showActions: boolean = false) => {
    if (list.length === 0) {
      return (
        <Card>
          <CardContent className="py-12 text-center">
            <Store className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p className="text-muted-foreground">No restaurants found</p>
          </CardContent>
        </Card>
      );
    }

    return list.map((restaurant) => (
      <Card key={restaurant.id}>
        <CardContent className="p-4">
          <div className="flex gap-4">
            {/* Logo */}
            <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0">
              {restaurant.logo_url ? (
                <img
                  src={restaurant.logo_url}
                  alt={restaurant.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <Store className="h-6 w-6 text-muted-foreground" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="font-semibold">{restaurant.name}</h3>
                  {restaurant.owner?.full_name && (
                    <p className="text-sm text-muted-foreground">
                      Owner: {restaurant.owner.full_name}
                    </p>
                  )}
                </div>
                {getStatusBadge(restaurant.approval_status)}
              </div>

              {restaurant.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {restaurant.description}
                </p>
              )}

              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
                {restaurant.address && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {restaurant.address}
                  </span>
                )}
                {restaurant.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {restaurant.phone}
                  </span>
                )}
                {restaurant.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {restaurant.email}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                <Calendar className="h-3 w-3" />
                Registered: {new Date(restaurant.created_at).toLocaleDateString()}
              </div>

              {showActions && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedRestaurant(restaurant);
                      setActionType("approve");
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      setSelectedRestaurant(restaurant);
                      setActionType("reject");
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    ));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="container max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold">Manage Restaurants</h1>
              <p className="text-sm text-muted-foreground">
                {pendingRestaurants.length} pending approval
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 w-full mb-6">
            <TabsTrigger value="pending" className="relative">
              Pending
              {pendingRestaurants.length > 0 && (
                <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {pendingRestaurants.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejected">Rejected</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {renderRestaurantList(pendingRestaurants, true)}
          </TabsContent>

          <TabsContent value="approved" className="space-y-4">
            {renderRestaurantList(approvedRestaurants)}
          </TabsContent>

          <TabsContent value="rejected" className="space-y-4">
            {renderRestaurantList(rejectedRestaurants)}
          </TabsContent>
        </Tabs>
      </main>

      {/* Confirmation Dialog */}
      <Dialog
        open={!!selectedRestaurant && !!actionType}
        onOpenChange={() => {
          setSelectedRestaurant(null);
          setActionType(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Approve Restaurant" : "Reject Restaurant"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve"
                ? `Are you sure you want to approve "${selectedRestaurant?.name}"? It will become visible to customers.`
                : `Are you sure you want to reject "${selectedRestaurant?.name}"? The owner will be notified.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedRestaurant(null);
                setActionType(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={processing}
              variant={actionType === "reject" ? "destructive" : "default"}
            >
              {processing
                ? "Processing..."
                : actionType === "approve"
                ? "Approve"
                : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminRestaurants;