import { useCallback, useEffect, useState, type ReactNode } from "react";
import { differenceInMinutes, format } from "date-fns";
import {
  AlertCircle,
  ArrowRightLeft,
  Bike,
  CheckCircle,
  Clock,
  MapPin,
  Navigation,
  Package,
  RefreshCw,
  Route,
  Star,
  Truck,
  User,
  X,
} from "lucide-react";

import { AdminLayout } from "@/components/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  adminAssignDriver,
  adminCancelJob,
  adminReassignDriver,
  autoAssignAllPendingJobs,
  getActiveDeliveries,
  getDeliveryStats,
  getOnlineDrivers,
  getPendingDeliveries,
} from "@/integrations/supabase/delivery";
const C = {
  text: "#020617",
  muted: "#94A3B8",
  panel: "#F6F8FB",
  border: "#E5EAF1",
  water: "#38BDF8",
  fat: "#FB6B7A",
  protein: "#7C83F6",
  progress: "#22C7A1",
};

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
  schedule_id: string | null;
  order_id: string | null;
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
    source_type: "meal_schedule" | "order";
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

  const fetchData = useCallback(async () => {
    try {
      const [pending, active, drivers, statsData] = await Promise.all([
        getPendingDeliveries(),
        getActiveDeliveries(),
        getOnlineDrivers(),
        getDeliveryStats(),
      ]);

      setPendingJobs((pending as unknown as DeliveryJob[]) || []);
      setActiveJobs((active as unknown as DeliveryJob[]) || []);
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
      console.error("Auto assign failed:", err);
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
      console.error("Assign failed:", err);
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
      console.error("Reassign failed:", err);
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
      console.error("Cancel failed:", err);
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
        <div className="space-y-6">
          <Skeleton className="h-40 w-full rounded-[28px]" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 rounded-[22px]" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-[24px]" />
        </div>
      </AdminLayout>
    );
  }

  const activeCount = stats.assigned + stats.picked_up;
  const completionTotal = stats.delivered + stats.failed;
  const completionRate = completionTotal > 0 ? Math.round((stats.delivered / completionTotal) * 100) : 0;

  return (
    <AdminLayout title="Delivery Management" subtitle="Manage all delivery operations">
      <div className="space-y-6">
        <section className="overflow-hidden rounded-[24px] bg-white shadow-[0_18px_42px_rgba(2,6,23,0.07)] ring-1 ring-[#E5EAF1]">
          <div className="flex flex-col gap-4 border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-[#22C7A1] ring-1 ring-[#E5EAF1]">
                <Route className="h-4 w-4 text-[#22C7A1]" />
                Live Operations
              </div>
              <h1 className="text-2xl font-black tracking-tight text-[#020617]">Delivery Control</h1>
              <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-[#94A3B8]">
                Assign pending orders, monitor active handoffs, and keep online drivers moving through one dispatch-focused workspace.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="outline"
                className="h-11 rounded-[14px] border-[#E5EAF1] bg-white px-5 font-black text-[#020617] shadow-sm hover:bg-[#F6F8FB]"
                onClick={fetchData}
              >
                <RefreshCw className="mr-2 h-4 w-4 text-[#38BDF8]" />
                Refresh
              </Button>
              <Button
                onClick={handleAutoAssign}
                disabled={assigning || pendingJobs.length === 0}
                className="h-11 rounded-[14px] bg-[#020617] px-5 font-black text-white shadow-[0_12px_24px_rgba(2,6,23,0.14)] hover:bg-[#020617]/90"
              >
                <Truck className="mr-2 h-4 w-4" />
                {assigning ? "Assigning..." : "Auto-Assign All"}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-3 border-t border-[#E5EAF1] bg-white">
            <div className="p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">Pending</p>
              <p className="mt-1 text-lg font-black text-[#020617]">{pendingJobs.length}</p>
            </div>
            <div className="border-x border-[#E5EAF1] p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">Active</p>
              <p className="mt-1 text-lg font-black text-[#020617]">{activeJobs.length}</p>
            </div>
            <div className="p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">Drivers</p>
              <p className="mt-1 text-lg font-black text-[#020617]">{onlineDrivers.length}</p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatsCard title="Pending" value={stats.pending} icon={<Clock className="h-5 w-5" />} color={C.water} description="Waiting for driver" />
          <StatsCard title="Active" value={activeCount} icon={<Navigation className="h-5 w-5" />} color={C.protein} description="Assigned or moving" />
          <StatsCard title="In Transit" value={stats.picked_up} icon={<Truck className="h-5 w-5" />} color={C.fat} description="Out for delivery" />
          <StatsCard title="Delivered" value={stats.delivered} icon={<CheckCircle className="h-5 w-5" />} color={C.progress} description={`${completionRate}% completion`} />
          <StatsCard title="Drivers Online" value={onlineDrivers.length} icon={<User className="h-5 w-5" />} color={C.progress} description="Available now" />
        </section>

        <section className="rounded-[24px] bg-white p-4 shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-[16px] bg-[#EFFFFA] text-[#22C7A1] ring-1 ring-[#22C7A1]/15">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-black text-[#020617]">Dispatch snapshot</p>
                <p className="text-xs font-semibold text-[#94A3B8]">Auto-refreshes every 10 seconds</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill label={`${pendingJobs.length} pending`} color={C.water} />
              <Pill label={`${activeJobs.length} active`} color={C.protein} />
              <Pill label={`${onlineDrivers.length} drivers online`} color={C.progress} />
            </div>
          </div>
        </section>

        <Tabs defaultValue="pending" className="space-y-4">
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-[22px] bg-white p-1.5 shadow-[0_10px_26px_rgba(2,6,23,0.045)] ring-1 ring-[#E5EAF1]">
            <TabsTrigger value="pending" className="rounded-[18px] py-3 text-sm font-black data-[state=active]:bg-[#020617] data-[state=active]:text-white">
              Pending ({pendingJobs.length})
            </TabsTrigger>
            <TabsTrigger value="active" className="rounded-[18px] py-3 text-sm font-black data-[state=active]:bg-[#020617] data-[state=active]:text-white">
              Active ({activeJobs.length})
            </TabsTrigger>
            <TabsTrigger value="drivers" className="rounded-[18px] py-3 text-sm font-black data-[state=active]:bg-[#020617] data-[state=active]:text-white">
              Drivers ({onlineDrivers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <PendingDeliveriesTable jobs={pendingJobs} onlineDrivers={onlineDrivers} onAssign={handleManualAssign} onCancel={handleCancel} />
          </TabsContent>

          <TabsContent value="active">
            <ActiveDeliveriesTable jobs={activeJobs} onlineDrivers={onlineDrivers} onReassign={handleReassign} />
          </TabsContent>

          <TabsContent value="drivers">
            <OnlineDriversTable drivers={onlineDrivers} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

function StatsCard({
  title,
  value,
  icon,
  color,
  description,
}: {
  title: string;
  value: number;
  icon: ReactNode;
  color: string;
  description: string;
}) {
  return (
    <Card className="rounded-[22px] border-[#E5EAF1] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.06)]">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-[16px] bg-[#F6F8FB] ring-1 ring-[#E5EAF1]" style={{ color }}>
            {icon}
          </div>
          <p className="text-3xl font-black tracking-tight text-[#020617]">{value}</p>
        </div>
        <p className="mt-4 text-[11px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">{title}</p>
        <p className="mt-1 text-xs font-semibold text-[#94A3B8]">{description}</p>
      </CardContent>
    </Card>
  );
}

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
    return <EmptyState icon={<CheckCircle className="h-8 w-8" />} title="No Pending Deliveries" description="All deliveries have been assigned to drivers." color={C.progress} />;
  }

  return (
    <Card className="overflow-hidden rounded-[24px] border-[#E5EAF1] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.06)]">
      <CardContent className="p-0">
        <SectionTitle icon={<Clock className="h-5 w-5" />} title="Pending Deliveries" description="Orders waiting for driver assignment." color={C.water} />
        <ScrollArea className="h-[560px]">
          <div className="divide-y divide-[#E5EAF1]">
            {jobs.map((job) => (
              <DeliveryRow key={job.id} job={job} accent={C.water}>
                <DriverDialog title="Assign Driver" onlineDrivers={onlineDrivers} onSelect={(driverId) => onAssign(job.id, driverId)} />
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-[#FB6B7A] hover:bg-[#FB6B7A]/10 hover:text-[#FB6B7A]" onClick={() => onCancel(job.id)}>
                  <X className="h-4 w-4" />
                </Button>
              </DeliveryRow>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

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
    return <EmptyState icon={<Truck className="h-8 w-8" />} title="No Active Deliveries" description="Drivers are currently not on active delivery jobs." color={C.protein} />;
  }

  return (
    <Card className="overflow-hidden rounded-[24px] border-[#E5EAF1] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.06)]">
      <CardContent className="p-0">
        <SectionTitle icon={<Navigation className="h-5 w-5" />} title="Active Deliveries" description="Assigned and in-transit jobs currently moving." color={C.protein} />
        <ScrollArea className="h-[560px]">
          <div className="grid gap-3 p-4">
            {jobs.map((job) => (
              <ActiveDeliveryCard key={job.id} job={job} onlineDrivers={onlineDrivers} onReassign={onReassign} />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function OnlineDriversTable({ drivers }: { drivers: OnlineDriver[] }) {
  if (drivers.length === 0) {
    return <EmptyState icon={<AlertCircle className="h-8 w-8" />} title="No Drivers Online" description="All drivers are currently offline." color={C.fat} />;
  }

  return (
    <Card className="overflow-hidden rounded-[24px] border-[#E5EAF1] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.06)]">
      <CardContent className="p-0">
        <SectionTitle icon={<User className="h-5 w-5" />} title="Online Drivers" description="Available drivers with live status and recent performance." color={C.progress} />
        <ScrollArea className="h-[560px]">
          <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
            {drivers.map((driver) => (
              <DriverCard key={driver.id} driver={driver} />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function DeliveryRow({
  job,
  accent,
  children,
}: {
  job: DeliveryJob;
  accent: string;
  children: ReactNode;
}) {
  const waitingMinutes = Math.max(0, differenceInMinutes(new Date(), new Date(job.created_at)));

  return (
    <div
      data-testid={`admin-delivery-job-${job.id}`}
      data-order-id={job.schedule_id || job.order_id || undefined}
      data-order-source={job.schedule.source_type}
      className="grid gap-4 p-4 lg:grid-cols-[1.3fr_1fr_1fr_auto] lg:items-center"
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-[#F6F8FB] shadow-sm ring-1 ring-[#E5EAF1]" style={{ color: accent }}>
          <Package className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-[#020617]">{job.schedule.meal.name}</p>
          <p className="mt-1 text-xs font-semibold text-[#94A3B8]">#{job.id.slice(-6)} - {job.schedule.meal_type}</p>
        </div>
      </div>

      <InfoBlock title="Customer" value={job.schedule.user?.raw_user_meta_data?.name || "Customer"} meta={job.schedule.user?.email || "No email"} />
      <InfoBlock title="Restaurant" value={job.schedule.meal.restaurant?.name || "Restaurant"} meta={job.schedule.meal.restaurant?.address || "Address not set"} />

      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <Badge className="rounded-full border-[#38BDF8]/20 bg-[#EFF9FF] px-3 py-1 font-black text-[#38BDF8]">
          {waitingMinutes}m waiting
        </Badge>
        {children}
      </div>
    </div>
  );
}

function ActiveDeliveryCard({
  job,
  onlineDrivers,
  onReassign,
}: {
  job: DeliveryJob;
  onlineDrivers: OnlineDriver[];
  onReassign: (jobId: string, driverId: string) => void;
}) {
  const isPickedUp = ["picked_up", "in_transit", "on_the_way"].includes(job.status);
  const accent = isPickedUp ? C.fat : C.protein;

  return (
    <div
      data-testid={`admin-delivery-job-${job.id}`}
      data-order-id={job.schedule_id || job.order_id || undefined}
      data-order-source={job.schedule.source_type}
      className="rounded-[22px] border border-[#E5EAF1] bg-[#F6F8FB] p-4"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="rounded-full border-transparent bg-white px-3 py-1 font-black ring-1 ring-[#E5EAF1]" style={{ color: accent }}>
              {isPickedUp ? "Out for Delivery" : "Assigned"}
            </Badge>
            <span className="text-xs font-semibold text-[#94A3B8]">{format(new Date(job.created_at), "h:mm a")}</span>
          </div>

          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-white text-[#94A3B8] ring-1 ring-[#E5EAF1]">
              <Package className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[#020617]">{job.schedule.meal.name}</p>
              <p className="mt-1 truncate text-xs font-semibold text-[#94A3B8]">{job.schedule.meal.restaurant?.name || "Restaurant"}</p>
            </div>
          </div>

          {job.driver && (
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#020617]">
              <Truck className="h-4 w-4 text-[#22C7A1]" />
              <span>{driverName(job.driver)}</span>
              <span className="text-[#94A3B8]">({job.driver.phone_number})</span>
            </div>
          )}
        </div>

        <DriverDialog
          title="Reassign Driver"
          onlineDrivers={onlineDrivers.filter((d) => d.id !== job.driver_id)}
          onSelect={(driverId) => onReassign(job.id, driverId)}
          trigger={
            <Button variant="outline" size="sm" className="h-10 rounded-[14px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-[#F6F8FB]">
              <ArrowRightLeft className="mr-2 h-4 w-4 text-[#94A3B8]" />
              Reassign
            </Button>
          }
        />
      </div>
    </div>
  );
}

function DriverCard({ driver }: { driver: OnlineDriver }) {
  return (
    <div className="rounded-[22px] border border-[#E5EAF1] bg-[#F6F8FB] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-white text-[#22C7A1] ring-1 ring-[#E5EAF1]">
            <Truck className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-[#020617]">{driverName(driver)}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#94A3B8]">
              <Star className="h-3.5 w-3.5 fill-[#7C83F6] text-[#7C83F6]" />
              <span>{driver.rating || 5.0}</span>
              <span>-</span>
              <span>{driver.total_deliveries || 0} deliveries</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-[#22C7A1]/10 px-2.5 py-1 text-xs font-black text-[#0F9F82]">
          <span className="h-2 w-2 rounded-full bg-[#22C7A1]" />
          Online
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniMetric label="Vehicle" value={driver.vehicle_type || "Vehicle"} icon={driver.vehicle_type === "bike" ? <Bike className="h-4 w-4" /> : <Truck className="h-4 w-4" />} color={C.water} />
        <MiniMetric label="Earned" value={`${driver.total_earnings || 0} QAR`} icon={<CheckCircle className="h-4 w-4" />} color={C.progress} />
      </div>

      {driver.current_lat && driver.current_lng && (
        <div className="mt-3 flex items-center gap-2 rounded-[16px] bg-white px-3 py-2 text-xs font-semibold text-[#94A3B8]">
          <MapPin className="h-3.5 w-3.5 text-[#FB6B7A]" />
          <span>
            Lat: {driver.current_lat.toFixed(4)}, Lng: {driver.current_lng.toFixed(4)}
          </span>
        </div>
      )}
    </div>
  );
}

function DriverDialog({
  title,
  onlineDrivers,
  onSelect,
  trigger,
}: {
  title: string;
  onlineDrivers: OnlineDriver[];
  onSelect: (driverId: string) => void;
  trigger?: ReactNode;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="h-10 rounded-[14px] bg-[#020617] px-4 font-black text-white hover:bg-[#020617]/90">
            Assign Driver
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-[24px] border-[#E5EAF1] bg-white p-0 shadow-[0_24px_60px_rgba(2,6,23,0.18)]">
        <DialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 text-left">
          <DialogTitle className="text-xl font-black tracking-tight text-[#020617]">{title}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[360px] space-y-2 overflow-y-auto p-5">
          {onlineDrivers.length === 0 ? (
            <p className="rounded-[18px] bg-[#F6F8FB] py-8 text-center text-sm font-semibold text-[#94A3B8]">No online drivers available</p>
          ) : (
            onlineDrivers.map((driver) => (
              <Button
                key={driver.id}
                variant="outline"
                className="h-auto w-full justify-start rounded-[18px] border-[#E5EAF1] bg-white p-3 hover:bg-[#F6F8FB]"
                onClick={() => onSelect(driver.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#F6F8FB] text-[#22C7A1] ring-1 ring-[#E5EAF1]">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="font-black text-[#020617]">{driverName(driver)}</p>
                    <p className="text-xs font-semibold text-[#94A3B8]">
                      Rating {driver.rating || 5.0} - {driver.vehicle_type}
                    </p>
                  </div>
                </div>
              </Button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionTitle({
  icon,
  title,
  description,
  color,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-[#E5EAF1] bg-[#F6F8FB] p-4">
      <div className="grid h-11 w-11 place-items-center rounded-[16px] bg-white ring-1 ring-[#E5EAF1]" style={{ color }}>
        {icon}
      </div>
      <div>
        <h2 className="text-xl font-black tracking-tight text-[#020617]">{title}</h2>
        <p className="mt-1 text-sm font-semibold text-[#94A3B8]">{description}</p>
      </div>
    </div>
  );
}

function InfoBlock({ title, value, meta }: { title: string; value: string; meta: string }) {
  return (
    <div className="min-w-0 rounded-[16px] bg-[#F6F8FB] p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#94A3B8]">{title}</p>
      <p className="mt-1 truncate text-sm font-black text-[#020617]">{value}</p>
      <p className="mt-1 truncate text-xs font-semibold text-[#94A3B8]">{meta}</p>
    </div>
  );
}

function MiniMetric({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-[16px] bg-white p-3">
      <div className="mb-2 flex items-center gap-2" style={{ color }}>
        {icon}
        <span className="text-[11px] font-black uppercase tracking-[0.08em]">{label}</span>
      </div>
      <p className="truncate text-sm font-black capitalize text-[#020617]">{value}</p>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  color,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <Card className="rounded-[24px] border-[#E5EAF1] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.06)]">
      <CardContent className="px-6 py-14 text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-[#F6F8FB]" style={{ color }}>
          {icon}
        </div>
        <h3 className="text-lg font-black text-[#020617]">{title}</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm font-medium text-[#94A3B8]">{description}</p>
      </CardContent>
    </Card>
  );
}

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span className="rounded-full px-3 py-1.5 text-xs font-black" style={{ background: `${color}1A`, color }}>
      {label}
    </span>
  );
}

function driverName(driver: Pick<OnlineDriver, "user"> | NonNullable<DeliveryJob["driver"]>) {
  return driver.user?.raw_user_meta_data?.name || "Driver";
}
