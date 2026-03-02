import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle, Store, Mail, Phone, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface RestaurantStatus {
  id: string;
  name: string;
  approval_status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  submitted_at: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export default function PendingApproval() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [restaurant, setRestaurant] = useState<RestaurantStatus | null>(null);

  useEffect(() => {
    if (user) {
      fetchRestaurantStatus();
    }
  }, [user]);

  const fetchRestaurantStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, approval_status, rejection_reason, created_at, email, phone, address")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        // No restaurant found, redirect to onboarding
        navigate("/partner/onboarding");
        return;
      }

      // If approved, redirect to dashboard
      if (data.approval_status === "approved") {
        navigate("/partner");
        return;
      }

      setRestaurant({
        id: data.id as string,
        name: data.name,
        approval_status: (data.approval_status || "pending") as "pending" | "approved" | "rejected",
        rejection_reason: data.rejection_reason || null,
        submitted_at: data.created_at,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
      });
    } catch (error) {
      console.error("Error fetching restaurant status:", error);
      toast({
        title: "Error",
        description: "Failed to load your application status. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/partner/auth");
  };

  const getStatusIcon = () => {
    switch (restaurant?.approval_status) {
      case "pending":
        return <Clock className="h-12 w-12 text-amber-500" />;
      case "approved":
        return <CheckCircle className="h-12 w-12 text-green-500" />;
      case "rejected":
        return <XCircle className="h-12 w-12 text-red-500" />;
      default:
        return <Clock className="h-12 w-12 text-amber-500" />;
    }
  };

  const getStatusBadge = () => {
    switch (restaurant?.approval_status) {
      case "pending":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pending Review</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Approved</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Rejected</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-muted"></div>
          <div className="h-4 w-48 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Store className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Nutrio Partner</h1>
              <p className="text-muted-foreground">Restaurant Application Status</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>

        {/* Status Card */}
        <Card className="border-2">
          <CardHeader className="text-center pb-4">
            <div className="flex justify-center mb-4">
              {getStatusIcon()}
            </div>
            <CardTitle className="text-2xl">
              {restaurant?.approval_status === "pending" && "Application Under Review"}
              {restaurant?.approval_status === "rejected" && "Application Declined"}
            </CardTitle>
            <CardDescription className="text-lg">
              {getStatusBadge()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {restaurant?.approval_status === "pending" && (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h3 className="font-semibold text-amber-900 mb-2">What happens next?</h3>
                  <ul className="space-y-2 text-amber-800">
                    <li className="flex items-start gap-2">
                      <span className="font-bold">1.</span>
                      <span>Our team is reviewing your application and documents</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold">2.</span>
                      <span>We may contact you for additional information</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold">3.</span>
                      <span>You will receive an email notification once approved</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="font-bold">4.</span>
                      <span>Typical review time: 1-2 business days</span>
                    </li>
                  </ul>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Restaurant Name</label>
                    <p className="font-medium">{restaurant?.name}</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Submitted</label>
                    <p className="font-medium">
                      {restaurant?.submitted_at 
                        ? formatDistanceToNow(new Date(restaurant.submitted_at), { addSuffix: true })
                        : "Unknown"}
                    </p>
                  </div>
                  {restaurant?.email && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email
                      </label>
                      <p className="font-medium">{restaurant.email}</p>
                    </div>
                  )}
                  {restaurant?.phone && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Phone
                      </label>
                      <p className="font-medium">{restaurant.phone}</p>
                    </div>
                  )}
                </div>

                <div className="bg-muted rounded-lg p-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Need help? Contact our partner support team at{" "}
                    <a href="mailto:partners@nutriofuel.com" className="text-primary hover:underline">
                      partners@nutriofuel.com
                    </a>
                  </p>
                </div>
              </>
            )}

            {restaurant?.approval_status === "rejected" && (
              <>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h3 className="font-semibold text-red-900 mb-2">Reason for Decline</h3>
                  <p className="text-red-800">
                    {restaurant.rejection_reason || "Your application did not meet our partner requirements at this time."}
                  </p>
                </div>

                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    If you believe this decision was made in error or would like to provide additional information, please contact our partner support team.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => window.location.href = "mailto:partners@nutriofuel.com"}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Contact Support
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={handleSignOut}
                    >
                      Sign Out
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-sm text-muted-foreground">
          Thank you for your interest in partnering with Nutrio
        </p>
      </div>
    </div>
  );
}
