import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Truck,
  Clock,
  MapPin,
  User,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Navigation,
  Package,
  RotateCcw,
  X,
  Star,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "@/components/AdminLayout";
import { format } from "date-fns";
import {
  getPendingDeliveries,
  getActiveDeliveries,
  getOnlineDrivers,
  autoAssignAllPendingJobs,
  adminAssignDriver,
  adminReassignDriver,
  adminCancelJob,
  getDeliveryStats,
} from "@/integrations/supabase/delivery";

interface OnlineDriver {
  id: string;
  user_id: string;
  phone_number: string;
  vehicle_type: string;
  rating: number | null;
  total_deliveries: number | null;
  total_earnings: number | null;
  is_online: boolean;
  current_lat: number | null;
  current_lng: number | null;
  user?: {
    raw_user_meta_data?: {
      name?: string;
    };
  };
}

interface DeliveryJob {
  id: string;
  status: string;
  schedule_id: string;
  driver_id: string | null;
  assigned_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  driver_earnings: number;
  created_at: string;
  driver: {
    id: string;
    user_id: string;
    phone_number: string;
    vehicle_type: string;
    is_online: boolean;
    current_lat: number | null;
    current_lng: number | null;
    user?: {
      raw_user_meta_data?: {
        name?: string;
      };
    };
  } | null;
  schedule: {
    id: string;
    user_id: string;
    meal_type: string;
    order_status: string;
    meal: {
      id?: string;
      name: string;
      image_url?: string | null;
      restaurant?: {
        id?: string;
        name?: string;
        address?: string;
        phone_number?: string | null;
      };
    };
    user?: {
      email?: string;
      raw_user_meta_data?: {
        name?: string;
        phone?: string;
      };
    };
  };
}

export default function AdminDeliveries() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [pendingJobs, setPendingJobs] = useState<DeliveryJob[]>([]);
  const [activeJobs, setActiveJobs] = useState<DeliveryJob[]>([]);
  const [onlineDrivers, setOnlineDrivers] = useState<OnlineDriver[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    assigned: 0,
    picked_up: 0,
    delivered: 0,
    failed: 0,
  });
  const [assigning, setAssigning] = useState(false);
  const [_selectedDriver, _setSelectedDriver] = useState<string | null>(null);
  const [_selectedJob, _setSelectedJob] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [pending, active, drivers, statsData] = await Promise.all([
        getPendingDeliveries(),
        getActiveDeliveries(),
        getOnlineDrivers(),
        getDeliveryStats(),
      ]);

      setPendingJobs((pending as DeliveryJob[]) || []);
      setActiveJobs((active as DeliveryJob[]) || []);
      setOnlineDrivers((drivers as unknown as OnlineDriver[]) || []);
      setStats(statsData);
    } catch (err) {
      console.error("Error fetching data:", err);
      toast({
        title: "Error",
        description: "Failed to load delivery data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleAutoAssign = async () => {
    setAssigning(true);
    try {
      const result = await autoAssignAllPendingJobs();
      toast({
        title: "Auto-assign complete",
        description: `${result.assigned} assigned, ${result.failed} failed`,
      });
      fetchData();
    } catch (err) {
      toast({
        title: "Error",
        description: "Could not auto-assign",
        variant: "destructive",
      });
    } finally {
      setAssigning(false);
    }
  };

  const handleManualAssign = async (jobId: string, driverId: string) => {
    try {
      await adminAssignDriver(jobId, driverId);
      toast({ title: "Driver assigned" });
      fetchData();
    } catch (err) {
      toast({
        title: "Error",
        description: "Could not assign driver",
        variant: "destructive",
      });
    }
  };

  const handleReassign = async (jobId: string, newDriverId: string) => {
    try {
      await adminReassignDriver(jobId, newDriverId);
      toast({ title: "Driver reassigned" });
      fetchData();
    } catch (err) {
      toast({
        title: "Error",
        description: "Could not reassign driver",
        variant: "destructive",
      });
    }
  };

  const handleCancel = async (jobId: string) => {
    try {
      await adminCancelJob(jobId, "Cancelled by admin");
      toast({ title: "Job cancelled" });
      fetchData();
    } catch (err) {
      toast({
        title: "Error",
        description: "Could not cancel job",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Delivery Management">
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Delivery Management" subtitle="Manage all delivery operations">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatsCard
            title="Pending"
            value={stats.pending}
            icon={Clock}
            color="bg-yellow-500"
            description="Waiting for driver"
          />
          <StatsCard
            title="Assigned"
            value={stats.assigned}
            icon={User}
            color="bg-blue-500"
            description="Driver assigned"
          />
          <StatsCard
            title="In Transit"
            value={stats.picked_up}
            icon={Truck}
            color="bg-orange-500"
            description="Out for delivery"
          />
          <StatsCard
            title="Delivered"
            value={stats.delivered}
            icon={CheckCircle}
            color="bg-green-500"
            description="Completed today"
          />
        </div>

        {/* Actions Bar */}
        <div className="flex justify-between items-center">
          <div className="flex gap-2">
            <Button
              onClick={handleAutoAssign}
              disabled={assigning || pendingJobs.length === 0}
            >
              <Truck className="w-4 h-4 mr-2" />
              {assigning ? "Assigning..." : "Auto-Assign All"}
            </Button>
            <Button variant="outline" onClick={fetchData}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {onlineDrivers.length} drivers online
          </p>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="pending">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">
              Pending ({pendingJobs.length})
            </TabsTrigger>
            <TabsTrigger value="active">
              Active ({activeJobs.length})
            </TabsTrigger>
            <TabsTrigger value="drivers">
              Online Drivers ({onlineDrivers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            <PendingDeliveriesTable
              jobs={pendingJobs}
              onlineDrivers={onlineDrivers}
              onAssign={handleManualAssign}
              onCancel={handleCancel}
            />
          </TabsContent>

          <TabsContent value="active" className="mt-4">
            <ActiveDeliveriesTable
              jobs={activeJobs}
              onlineDrivers={onlineDrivers}
              onReassign={handleReassign}
            />
          </TabsContent>

          <TabsContent value="drivers" className="mt-4">
            <OnlineDriversTable drivers={onlineDrivers} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

// Stats Card Component
function StatsCard({
  title,
  value,
  icon: Icon,
  color,
  description,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </div>
          <div className={`w-12 h-12 ${color} rounded-lg flex items-center justify-center`}>
            <Icon className="w-6 h-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Pending Deliveries Table
function PendingDeliveriesTable({
  jobs,
  onlineDrivers,
  onAssign,
  onCancel,
}: {
  jobs: DeliveryJob[];
  onlineDrivers: OnlineDriver[];
  onAssign: (jobId: string, driverId: string) => void;
  onCancel: (jobId: string) => void;
}) {
  if (jobs.length === 0) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="p-12 text-center">
          <CheckCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold mb-1">No Pending Deliveries</h3>
          <p className="text-sm text-muted-foreground">
            All deliveries have been assigned to drivers
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Pending Deliveries
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Restaurant</TableHead>
                <TableHead>Waiting</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                        <Package className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{job.schedule.meal.name}</p>
                        <p className="text-xs text-muted-foreground">
                          #{job.id.slice(-6)}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">
                        {job.schedule.user?.raw_user_meta_data?.name || "Customer"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {job.schedule.user?.email}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{job.schedule.meal.restaurant?.name || "Restaurant"}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {job.schedule.meal.restaurant?.address}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {format(new Date(job.created_at), "mm")}m ago
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button size="sm">Assign Driver</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md">
                          <DialogHeader>
                            <DialogTitle>Assign Driver</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-2 max-h-[300px] overflow-y-auto">
                            {onlineDrivers.length === 0 ? (
                              <p className="text-center text-muted-foreground py-4">
                                No online drivers available
                              </p>
                            ) : (
                              onlineDrivers.map((driver) => (
                                <Button
                                  key={driver.id}
                                  variant="outline"
                                  className="w-full justify-start"
                                  onClick={() => onAssign(job.id, driver.id)}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                      <Truck className="w-4 h-4" />
                                    </div>
                                    <div className="text-left">
                                      <p className="font-medium">
                                        {driver.user?.raw_user_meta_data?.name || "Driver"}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        ⭐ {driver.rating} • {driver.vehicle_type}
                                      </p>
                                    </div>
                                  </div>
                                </Button>
                              ))
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onCancel(job.id)}
                      >
                        <X className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Active Deliveries Table
function ActiveDeliveriesTable({
  jobs,
  onlineDrivers,
  onReassign,
}: {
  jobs: DeliveryJob[];
  onlineDrivers: OnlineDriver[];
  onReassign: (jobId: string, driverId: string) => void;
}) {
  if (jobs.length === 0) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="p-12 text-center">
          <Truck className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold mb-1">No Active Deliveries</h3>
          <p className="text-sm text-muted-foreground">
            Drivers are currently not on any deliveries
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Navigation className="w-5 h-5" />
          Active Deliveries
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="space-y-4">
            {jobs.map((job) => (
              <Card key={job.id} className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            job.status === "picked_up"
                              ? "bg-orange-500"
                              : "bg-blue-500"
                          }
                        >
                          {job.status === "picked_up"
                            ? "Out for Delivery"
                            : "Assigned"}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(job.created_at), "h:mm a")}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-background rounded-lg flex items-center justify-center">
                          <Package className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium">{job.schedule.meal.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {job.schedule.meal.restaurant?.name}
                          </p>
                        </div>
                      </div>

                      {job.driver && (
                        <div className="flex items-center gap-2 text-sm">
                          <Truck className="w-4 h-4 text-muted-foreground" />
                          <span>
                            {job.driver.user?.raw_user_meta_data?.name || "Driver"}
                          </span>
                          <span className="text-muted-foreground">
                            ({job.driver.phone_number})
                          </span>
                        </div>
                      )}
                    </div>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <RotateCcw className="w-4 h-4 mr-1" />
                          Reassign
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Reassign Driver</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto">
                          {onlineDrivers
                            .filter((d) => d.id !== job.driver_id)
                            .map((driver) => (
                              <Button
                                key={driver.id}
                                variant="outline"
                                className="w-full justify-start"
                                onClick={() => onReassign(job.id, driver.id)}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                                    <Truck className="w-4 h-4" />
                                  </div>
                                  <div className="text-left">
                                    <p className="font-medium">
                                      {driver.user?.raw_user_meta_data?.name || "Driver"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      ⭐ {driver.rating} • {driver.vehicle_type}
                                    </p>
                                  </div>
                                </div>
                              </Button>
                            ))}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// Online Drivers Table
function OnlineDriversTable({ drivers }: { drivers: OnlineDriver[] }) {
  if (drivers.length === 0) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="p-12 text-center">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold mb-1">No Drivers Online</h3>
          <p className="text-sm text-muted-foreground">
            All drivers are currently offline
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <User className="w-5 h-5" />
          Online Drivers
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {drivers.map((driver) => (
              <Card key={driver.id} className="bg-muted/30">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <Truck className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {driver.user?.raw_user_meta_data?.name || "Driver"}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                          <span>{driver.rating || 5.0}</span>
                          <span>•</span>
                          <span>{driver.total_deliveries || 0} deliveries</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                      <span className="text-xs text-muted-foreground">Online</span>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {driver.vehicle_type === "bike" ? (
                        <span className="text-xl">🚲</span>
                      ) : (
                        <span className="text-xl">🚗</span>
                      )}
                      <span className="text-sm capitalize">{driver.vehicle_type}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Earned: </span>
                      <span className="font-medium">{driver.total_earnings || 0} QAR</span>
                    </div>
                  </div>

                  {driver.current_lat && driver.current_lng && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      <span>
                        Lat: {driver.current_lat.toFixed(4)}, Lng:{" "}
                        {driver.current_lng.toFixed(4)}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
