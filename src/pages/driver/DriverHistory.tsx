import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDriverJobHistory } from "@/integrations/supabase/delivery";
import { 
  CheckCircle2, 
  AlertCircle,
  DollarSign,
  Calendar,
  MapPin,
  Package
} from "lucide-react";
import { format } from "date-fns";
import type { DriverLayoutContext } from "@/components/driver/DriverLayout";

export default function DriverHistory() {
  const { driver } = useOutletContext<DriverLayoutContext>();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [driver.id]);

  const fetchHistory = async () => {
    try {
      const data = await getDriverJobHistory(driver.id, 50);
      setJobs(data || []);
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  // Group jobs by date
  const groupedJobs = jobs.reduce((groups: any, job) => {
    const date = format(new Date(job.created_at), "yyyy-MM-dd");
    if (!groups[date]) groups[date] = [];
    groups[date].push(job);
    return groups;
  }, {});

  const totalEarnings = jobs
    .filter(j => j.status === "delivered")
    .reduce((sum, j) => sum + (j.driver_earnings || 0), 0);

  const totalDeliveries = jobs.filter(j => j.status === "delivered").length;

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Summary Card */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-background rounded-lg">
              <DollarSign className="w-5 h-5 mx-auto mb-1 text-primary" />
              <p className="text-xl font-bold">{totalEarnings.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">QAR Total</p>
            </div>
            <div className="text-center p-3 bg-background rounded-lg">
              <CheckCircle2 className="w-5 h-5 mx-auto mb-1 text-primary" />
              <p className="text-xl font-bold">{totalDeliveries}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Job History */}
      <div className="space-y-4">
        {Object.entries(groupedJobs).map(([date, dayJobs]: [string, any]) => (
          <div key={date}>
            <h3 className="font-semibold text-sm text-muted-foreground mb-2 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              {format(new Date(date), "EEEE, MMMM d")}
            </h3>
            <div className="space-y-2">
              {dayJobs.map((job: any) => (
                <HistoryCard key={job.id} job={job} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {jobs.length === 0 && (
        <Card className="bg-muted/50">
          <CardContent className="p-8 text-center">
            <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
            <h3 className="font-semibold mb-1">No History Yet</h3>
            <p className="text-sm text-muted-foreground">
              Complete your first delivery to see it here
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function HistoryCard({ job }: { job: any }) {
  const mealName = job.schedule?.meal?.name || "Order";
  const restaurantName = job.schedule?.meal?.restaurant?.name || "Restaurant";
  const isDelivered = job.status === "delivered";
  const isFailed = job.status === "failed";

  return (
    <Card className={`${isDelivered ? "bg-green-50/50" : isFailed ? "bg-red-50/50" : "bg-muted/30"}`}>
      <CardContent className="p-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              isDelivered ? "bg-green-100" : isFailed ? "bg-red-100" : "bg-gray-100"
            }`}>
              {isDelivered ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : isFailed ? (
                <AlertCircle className="w-5 h-5 text-red-600" />
              ) : (
                <MapPin className="w-5 h-5 text-gray-600" />
              )}
            </div>
            <div>
              <p className="font-medium text-sm">{mealName}</p>
              <p className="text-xs text-muted-foreground">{restaurantName}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {format(new Date(job.created_at), "h:mm a")}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className={`font-semibold text-sm ${isDelivered ? "text-green-600" : ""}`}>
              {isDelivered ? `+${job.driver_earnings} QAR` : "—"}
            </p>
            <Badge 
              variant={isDelivered ? "default" : isFailed ? "destructive" : "secondary"}
              className="text-xs mt-1"
            >
              {job.status}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
