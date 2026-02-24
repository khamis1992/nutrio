import { useEffect, useState, useCallback } from "react";
import { useOutletContext } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  getDriverCurrentJob, 
  getDriverJobHistory 
} from "@/integrations/supabase/delivery";
import { supabase } from "@/integrations/supabase/client";
import { 
  MapPin, 
  Clock, 
  Star, 
  Navigation,
  Phone,
  CheckCircle2,
  DollarSign,
  Package,
  Loader2,
  AlertCircle
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { DriverLayoutContext } from "@/components/driver/DriverLayout";

export default function DriverHome() {
  const { driver, isOnline } = useOutletContext<DriverLayoutContext>();
  const [currentJob, setCurrentJob] = useState<any>(null);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewJobModal, setShowNewJobModal] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [job, history] = await Promise.all([
        getDriverCurrentJob(driver.id),
        getDriverJobHistory(driver.id, 5)
      ]);
      
      setCurrentJob(job);
      setRecentJobs(history || []);
      
      // Check if there's a newly assigned job waiting for acceptance
      if (job?.status === "assigned" && !showNewJobModal) {
        setShowNewJobModal(true);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }, [driver.id, showNewJobModal]);

  useEffect(() => {
    fetchData();
    
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Subscribe to real-time job updates
  useEffect(() => {
    const subscription = supabase
      .channel(`driver-jobs-${driver.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "delivery_jobs",
          filter: `driver_id=eq.${driver.id}`
        },
        (payload) => {
          if (payload.new.status === "assigned") {
            setShowNewJobModal(true);
          }
          fetchData();
        }
      )
      .subscribe();

    return () => subscription.unsubscribe();
  }, [driver.id, fetchData]);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-24 bg-muted rounded-lg animate-pulse" />
        <div className="h-48 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Stats Card */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-background rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <DollarSign className="w-4 h-4 text-primary" />
                <p className="text-2xl font-bold">{driver.total_earnings || 0}</p>
              </div>
              <p className="text-xs text-muted-foreground">QAR Earned</p>
            </div>
            <div className="text-center p-3 bg-background rounded-lg">
              <div className="flex items-center justify-center gap-1 mb-1">
                <Package className="w-4 h-4 text-primary" />
                <p className="text-2xl font-bold">{driver.total_deliveries || 0}</p>
              </div>
              <p className="text-xs text-muted-foreground">Deliveries</p>
            </div>
          </div>
          
          <div className="mt-4 flex items-center justify-center gap-2 text-sm">
            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
            <span className="font-medium">{driver.rating || 5.0}</span>
            <span className="text-muted-foreground">rating</span>
          </div>
        </CardContent>
      </Card>

      {/* Current Job */}
      {currentJob ? (
        <ActiveJobCard 
          job={currentJob} 
          onUpdate={fetchData}
        />
      ) : isOnline ? (
        <Card className="bg-muted/50 border-2 border-dashed">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold mb-2">No Active Jobs</h3>
            <p className="text-sm text-muted-foreground mb-4">
              You're online and ready to receive delivery requests
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span>Waiting for assignments...</span>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-muted/50">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-semibold mb-2">You're Offline</h3>
            <p className="text-sm text-muted-foreground">
              Go online to start receiving delivery requests
            </p>
          </CardContent>
        </Card>
      )}

      {/* Recent Jobs */}
      {recentJobs.length > 0 && (
        <div>
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Recent Deliveries
          </h2>
          <div className="space-y-2">
            {recentJobs.map((job) => (
              <JobHistoryCard key={job.id} job={job} />
            ))}
          </div>
        </div>
      )}

      {/* New Job Modal */}
      {showNewJobModal && currentJob?.status === "assigned" && (
        <NewJobModal 
          job={currentJob}
          driverId={driver.id}
          onClose={() => setShowNewJobModal(false)}
          onAccept={fetchData}
        />
      )}
    </div>
  );
}

// Active Job Card Component
function ActiveJobCard({ job, onUpdate }: { job: any; onUpdate: () => void }) {
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    try {
      const { driverAcceptJob } = await import("@/integrations/supabase/delivery");
      await driverAcceptJob(job.driver_id, job.id);
      toast({ title: "Job accepted!" });
      onUpdate();
    } catch (err) {
      toast({ 
        title: "Error", 
        description: "Could not accept job",
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePickup = async () => {
    setLoading(true);
    try {
      const { driverPickupJob } = await import("@/integrations/supabase/delivery");
      await driverPickupJob(job.driver_id, job.id);
      toast({ title: "Pickup confirmed!" });
      onUpdate();
    } catch (err) {
      toast({ 
        title: "Error", 
        description: "Could not confirm pickup",
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeliver = async () => {
    setLoading(true);
    try {
      const { driverDeliverJob } = await import("@/integrations/supabase/delivery");
      await driverDeliverJob(job.driver_id, job.id);
      toast({ title: "Delivery completed!" });
      onUpdate();
    } catch (err) {
      toast({ 
        title: "Error", 
        description: "Could not confirm delivery",
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const statusConfig = {
    assigned: { 
      label: "New Job", 
      color: "bg-blue-500",
      description: "Accept to start"
    },
    accepted: { 
      label: "Navigate to Pickup", 
      color: "bg-yellow-500",
      description: "Go to restaurant"
    },
    picked_up: { 
      label: "Deliver to Customer", 
      color: "bg-orange-500",
      description: "On the way"
    }
  };

  const config = statusConfig[job.status as keyof typeof statusConfig];
  const restaurant = job.schedule?.meal?.restaurant;
  const customer = job.schedule?.user;

  return (
    <Card className="border-2 border-primary shadow-lg">
      <CardContent className="p-4 space-y-4">
        {/* Status Header */}
        <div className="flex items-center justify-between">
          <Badge className={config.color}>{config.label}</Badge>
          <span className="text-sm text-muted-foreground">
            {config.description}
          </span>
        </div>

        {/* Restaurant Info (Pickup Phase) */}
        {(job.status === "assigned" || job.status === "accepted") && restaurant && (
          <div className="bg-muted/50 p-4 rounded-lg space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold">{restaurant.name}</h3>
                <p className="text-sm text-muted-foreground truncate">
                  {restaurant.address}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => window.open(
                  `https://maps.google.com/?q=${encodeURIComponent(restaurant.address)}`,
                  '_blank'
                )}
              >
                <Navigation className="w-4 h-4 mr-2" />
                Navigate
              </Button>
              {restaurant.phone_number && (
                <Button 
                  variant="outline"
                  onClick={() => window.open(`tel:${restaurant.phone_number}`)}
                >
                  <Phone className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Customer Info (Delivery Phase) */}
        {job.status === "picked_up" && customer && (
          <div className="bg-muted/50 p-4 rounded-lg space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold">
                  {customer.raw_user_meta_data?.name || "Customer"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  Order: {job.schedule?.meal?.name}
                </p>
              </div>
            </div>
            
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => window.open(`tel:${customer.raw_user_meta_data?.phone}`)}
            >
              <Phone className="w-4 h-4 mr-2" />
              Call Customer
            </Button>
          </div>
        )}

        {/* Action Buttons */}
        {job.status === "assigned" && (
          <Button 
            className="w-full h-14 text-lg font-semibold"
            onClick={handleAccept}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            Accept Job
          </Button>
        )}

        {job.status === "accepted" && (
          <Button 
            className="w-full h-14 text-lg font-semibold"
            onClick={handlePickup}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            Confirm Pickup
          </Button>
        )}

        {job.status === "picked_up" && (
          <Button 
            className="w-full h-14 text-lg font-semibold bg-green-600 hover:bg-green-700"
            onClick={handleDeliver}
            disabled={loading}
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
            Complete Delivery
          </Button>
        )}

        {/* Earnings */}
        <div className="flex items-center justify-between pt-3 border-t">
          <span className="text-sm text-muted-foreground">Earnings</span>
          <span className="text-lg font-bold text-primary">
            +{job.driver_earnings} QAR
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// Job History Card Component
function JobHistoryCard({ job }: { job: any }) {
  const mealName = job.schedule?.meal?.name || "Order";
  const customerName = job.schedule?.user?.raw_user_meta_data?.name || "Customer";
  
  return (
    <Card className="bg-muted/30">
      <CardContent className="p-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
            job.status === "delivered" ? "bg-green-100" : "bg-red-100"
          }`}>
            {job.status === "delivered" ? (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
          </div>
          <div>
            <p className="font-medium text-sm">{mealName}</p>
            <p className="text-xs text-muted-foreground">
              {format(new Date(job.created_at), "MMM d, h:mm a")}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-semibold text-sm">+{job.driver_earnings} QAR</p>
          <Badge variant={job.status === "delivered" ? "default" : "destructive"} className="text-xs">
            {job.status}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// New Job Modal Component
function NewJobModal({ 
  job, 
  driverId, 
  onClose, 
  onAccept 
}: { 
  job: any; 
  driverId: string; 
  onClose: () => void;
  onAccept: () => void;
}) {
  const [countdown, setCountdown] = useState(60);
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      handleReject();
    }
  }, [countdown]);

  const handleAccept = async () => {
    setResponding(true);
    try {
      const { driverAcceptJob } = await import("@/integrations/supabase/delivery");
      await driverAcceptJob(driverId, job.id);
      toast({ title: "Job accepted!" });
      onAccept();
      onClose();
    } catch (err) {
      toast({ 
        title: "Error", 
        description: "Job no longer available",
        variant: "destructive" 
      });
      onClose();
    }
  };

  const handleReject = async () => {
    setResponding(true);
    try {
      const { driverRejectJob } = await import("@/integrations/supabase/delivery");
      await driverRejectJob(driverId, job.id);
    } catch (err) {
      console.error("Error rejecting job:", err);
    }
    onClose();
  };

  const restaurant = job.schedule?.meal?.restaurant;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-sm animate-in zoom-in-95">
        <CardContent className="p-6">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
              <Navigation className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-bold">New Delivery Request</h2>
            <p className="text-sm text-muted-foreground">
              Auto-decline in {countdown}s
            </p>
          </div>

          {restaurant && (
            <div className="space-y-3 mb-6 bg-muted/50 p-4 rounded-lg">
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{restaurant.name}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {restaurant.address}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="text-center mb-6">
            <p className="text-sm text-muted-foreground mb-1">You'll earn</p>
            <p className="text-3xl font-bold text-primary">{job.driver_earnings} QAR</p>
          </div>

          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1 h-12"
              onClick={handleReject}
              disabled={responding}
            >
              Decline
            </Button>
            <Button 
              className="flex-1 h-12"
              onClick={handleAccept}
              disabled={responding}
            >
              Accept
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
