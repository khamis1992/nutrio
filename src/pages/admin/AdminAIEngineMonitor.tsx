import { useState, useEffect } from "react";
import {
  AdminMetricTile,
  AdminPanel,
  AdminWorkbenchHeader,
} from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import {
  Cpu,
  Activity,
  Zap,
  Brain,
  Clock,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Users,
  Target,
  TrendingUp,
  Server,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { format } from "date-fns";
import { AdminLayout } from "@/components/AdminLayout";

interface AIEngineStatus {
  layer_name: string;
  status: "healthy" | "warning" | "error";
  last_run: string;
  avg_response_time: number;
  success_rate: number;
  total_requests: number;
}

interface RecommendationMetrics {
  date: string;
  plans_generated: number;
  plans_accepted: number;
  adjustments_made: number;
  accuracy_score: number;
}

export default function AdminAIEngineMonitor() {
  const [engineStatus, setEngineStatus] = useState<AIEngineStatus[]>([]);
  const [metrics, setMetrics] = useState<RecommendationMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const layerInfo = {
    "nutrition-profile": {
      name: "Nutrition Profile",
      icon: Target,
      color: "#38BDF8",
      bg: "#F6F8FB",
    },
    "meal-allocator": {
      name: "Meal Allocator",
      icon: Brain,
      color: "#7C83F6",
      bg: "#F6F8FB",
    },
    "dynamic-adjustment": {
      name: "Dynamic Adjustment",
      icon: Activity,
      color: "#22C7A1",
      bg: "#F6F8FB",
    },
    "behavior-prediction": {
      name: "Behavior Prediction",
      icon: Users,
      color: "#F97316",
      bg: "#F6F8FB",
    },
    "restaurant-intelligence": {
      name: "Restaurant Intelligence",
      icon: Server,
      color: "#38BDF8",
      bg: "#F6F8FB",
    },
  };

  const fetchAIEngineData = async () => {
    setIsLoading(true);
    try {
      setEngineStatus([]);
      setMetrics([]);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Error fetching AI engine data:", error);
      toast.error("Failed to load AI engine status");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "healthy":
        return "border-[#22C7A1]/25 bg-[#22C7A1]/10 text-[#22C7A1]";
      case "warning":
        return "border-[#F97316]/25 bg-[#F97316]/10 text-[#F97316]";
      case "error":
        return "border-[#FB6B7A]/25 bg-[#FB6B7A]/10 text-[#FB6B7A]";
      default:
        return "border-[#E5EAF1] bg-[#F6F8FB] text-[#94A3B8]";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle2 className="w-4 h-4" />;
      case "warning":
        return <AlertTriangle className="w-4 h-4" />;
      case "error":
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  useEffect(() => {
    fetchAIEngineData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchAIEngineData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <AdminLayout title="AI Engine" subtitle="Loading AI telemetry">
        <div className="flex min-h-[400px] items-center justify-center bg-[#F6F8FB]">
          <div className="rounded-[28px] border border-[#E5EAF1] bg-white p-8 text-center shadow-[0_18px_44px_rgba(2,6,23,0.06)]">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-[#E5EAF1] border-b-[#22C7A1]" />
            <p className="mt-4 text-sm font-black text-[#020617]">
              Loading AI engine status
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (engineStatus.length === 0) {
    return (
      <AdminLayout
        title="AI Engine"
        subtitle="Monitor AI layer health and recommendation telemetry"
      >
        <div className="space-y-5">
          <section className="overflow-hidden rounded-[30px] border border-[#E5EAF1] bg-white shadow-[0_18px_44px_rgba(2,6,23,0.06)]">
            <div className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center md:p-6">
              <div className="flex items-start gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[22px] bg-[#7C83F6]/10 text-[#7C83F6] ring-1 ring-[#7C83F6]/20">
                  <Brain className="h-6 w-6" strokeWidth={2.4} />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7C83F6]">
                    AI operations
                  </p>
                  <h1 className="mt-1 text-[24px] font-black leading-tight tracking-tight text-[#020617] md:text-[30px]">
                    AI Engine Monitor
                  </h1>
                  <p className="mt-1 max-w-2xl text-sm font-semibold leading-6 text-[#94A3B8]">
                    Monitor AI layer health, response speed, recommendation
                    throughput, and accuracy signals.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 rounded-[22px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                <span className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                  Last updated: {format(lastRefresh, "HH:mm:ss")}
                </span>
                <Button
                  variant="outline"
                  onClick={fetchAIEngineData}
                  className="h-11 rounded-[16px] border-[#E5EAF1] bg-white font-black text-[#020617]"
                >
                  <RefreshCw className="mr-2 h-4 w-4 text-[#7C83F6]" />
                  Refresh
                </Button>
              </div>
            </div>
          </section>

          <section className="rounded-[30px] border border-[#E5EAF1] bg-white p-8 text-center shadow-[0_18px_44px_rgba(2,6,23,0.06)]">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-[24px] bg-[#F6F8FB] text-[#94A3B8] ring-1 ring-[#E5EAF1]">
              <Server className="h-8 w-8" strokeWidth={2.2} />
            </div>
            <h3 className="mt-5 text-xl font-black text-[#020617]">
              No AI engine data yet
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-[#94A3B8]">
              Monitoring data will appear here after AI recommendations, goal
              adjustments, or restaurant intelligence jobs start reporting
              telemetry.
            </p>
            <div className="mx-auto mt-6 grid max-w-3xl gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Layer health",
                  icon: Activity,
                  color: "#22C7A1",
                  bg: "#F6F8FB",
                },
                {
                  label: "Response time",
                  icon: Clock,
                  color: "#38BDF8",
                  bg: "#F6F8FB",
                },
                {
                  label: "Accuracy score",
                  icon: Target,
                  color: "#7C83F6",
                  bg: "#F6F8FB",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-[22px] bg-[#F6F8FB] p-4 text-left ring-1 ring-[#E5EAF1]"
                  >
                    <div
                      className="grid h-10 w-10 place-items-center rounded-[15px]"
                      style={{ backgroundColor: item.bg, color: item.color }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="mt-3 text-sm font-black text-[#020617]">
                      {item.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </AdminLayout>
    );
  }

  const overallHealth = engineStatus.every((s) => s.status === "healthy")
    ? "healthy"
    : engineStatus.some((s) => s.status === "error")
      ? "error"
      : "warning";

  const avgSuccessRate =
    engineStatus.length > 0
      ? engineStatus.reduce((acc, s) => acc + s.success_rate, 0) /
        engineStatus.length
      : 0;

  const totalRequests = engineStatus.reduce(
    (acc, s) => acc + s.total_requests,
    0,
  );
  const avgAccuracy = metrics.length
    ? metrics.reduce((acc, m) => acc + m.accuracy_score, 0) / metrics.length
    : 0;

  return (
    <AdminLayout
      title="AI Engine"
      subtitle="Monitor AI layer performance and recommendation accuracy"
    >
      <div className="space-y-6">
        <AdminWorkbenchHeader
          eyebrow="AI operations"
          title="AI engine monitor"
          icon={Brain}
          accent="#7C83F6"
          description="Monitor AI layer performance, recommendation accuracy, response time, and the health of each intelligence service."
          meta={[
            { label: "Health", value: overallHealth },
            { label: "Success rate", value: `${avgSuccessRate.toFixed(1)}%` },
            { label: "Last updated", value: format(lastRefresh, "HH:mm:ss") },
          ]}
          actions={
            <Button
              variant="outline"
              onClick={fetchAIEngineData}
              className="h-11 rounded-[16px] border-[#E5EAF1] bg-white font-black text-[#020617]"
            >
              <RefreshCw className="mr-2 h-4 w-4 text-[#7C83F6]" />
              Refresh
            </Button>
          }
        />

        {/* Overall Health */}
        <AdminPanel
          className={cn(
            "overflow-hidden rounded-[30px] border-0 shadow-[0_18px_44px_rgba(2,6,23,0.06)] ring-1",
            overallHealth === "healthy"
              ? "bg-[#22C7A1]/10 ring-[#22C7A1]/20"
              : overallHealth === "warning"
                ? "bg-[#F97316]/10 ring-[#F97316]/20"
                : "bg-[#FB6B7A]/10 ring-[#FB6B7A]/20",
          )}
        >
          <div className="p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "flex h-16 w-16 shrink-0 items-center justify-center rounded-[24px] bg-white shadow-[0_10px_24px_rgba(2,6,23,0.045)] ring-1",
                    overallHealth === "healthy"
                      ? "text-[#22C7A1] ring-[#22C7A1]/20"
                      : overallHealth === "warning"
                        ? "text-[#F97316] ring-[#F97316]/20"
                        : "text-[#FB6B7A] ring-[#FB6B7A]/20",
                  )}
                >
                  {overallHealth === "healthy" ? (
                    <CheckCircle2 className="h-8 w-8" />
                  ) : overallHealth === "warning" ? (
                    <AlertTriangle className="h-8 w-8" />
                  ) : (
                    <AlertTriangle className="h-8 w-8" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-black text-[#020617]">
                    System{" "}
                    {overallHealth === "healthy"
                      ? "Healthy"
                      : overallHealth === "warning"
                        ? "Warning"
                        : "Critical"}
                  </h2>
                  <p className="text-sm font-semibold text-[#94A3B8]">
                    {engineStatus.filter((s) => s.status === "healthy").length}{" "}
                    of {engineStatus.length} layers operational
                  </p>
                </div>
              </div>
              <div className="rounded-[22px] bg-[#F6F8FB] px-5 py-4 text-left shadow-[0_10px_24px_rgba(2,6,23,0.045)] ring-1 ring-[#E5EAF1] sm:text-right">
                <div className="text-3xl font-black text-[#020617]">
                  {avgSuccessRate.toFixed(1)}%
                </div>
                <p className="text-sm font-bold text-[#94A3B8]">
                  Avg success rate
                </p>
              </div>
            </div>
          </div>
        </AdminPanel>

        {/* Layer Status Cards */}
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {engineStatus.map((layer) => {
            const info = layerInfo[
              layer.layer_name as keyof typeof layerInfo
            ] || {
              name: layer.layer_name,
              icon: Cpu,
              color: "#94A3B8",
              bg: "#F6F8FB",
            };
            const IconComponent = info.icon;

            return (
              <AdminPanel
                key={layer.layer_name}
                className={cn(
                  "rounded-[26px] border-0 bg-white shadow-[0_14px_34px_rgba(2,6,23,0.055)] ring-1 ring-[#E5EAF1]",
                  layer.status !== "healthy" && "ring-[#F97316]/40",
                )}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-[16px]"
                      style={{ backgroundColor: info.bg, color: info.color }}
                    >
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(getStatusColor(layer.status))}
                    >
                      {getStatusIcon(layer.status)}
                      <span className="ml-1 capitalize">{layer.status}</span>
                    </Badge>
                  </div>

                  <h3 className="mb-3 text-sm font-black text-[#020617]">
                    {info.name}
                  </h3>

                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#94A3B8]">Response</span>
                      <span className="font-black text-[#020617]">
                        {layer.avg_response_time}ms
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#94A3B8]">Success</span>
                      <span className="font-black text-[#020617]">
                        {layer.success_rate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#94A3B8]">Requests</span>
                      <span className="font-black text-[#020617]">
                        {layer.total_requests.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {layer.status !== "healthy" && (
                    <div className="mt-3 rounded-[14px] bg-[#F97316]/10 p-2 text-xs font-bold text-[#F97316]">
                      <AlertTriangle className="w-3 h-3 inline mr-1" />
                      High response time detected
                    </div>
                  )}
                </div>
              </AdminPanel>
            );
          })}
        </div>

        {/* Performance Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          <AdminPanel className="overflow-hidden rounded-[30px] border-0 bg-white shadow-[0_18px_44px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
            <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
              <h3 className="flex items-center gap-2 text-base font-black text-[#020617]">
                <TrendingUp className="h-4 w-4 text-[#38BDF8]" />
                Recommendation Performance
              </h3>
            </div>
            <div className="p-5">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF1" />
                    <XAxis dataKey="date" stroke="#94A3B8" fontSize={12} />
                    <YAxis stroke="#94A3B8" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #E5EAF1",
                        borderRadius: "14px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="plans_generated"
                      stroke="#38BDF8"
                      strokeWidth={2}
                      dot={{ fill: "#38BDF8", strokeWidth: 2 }}
                      name="Plans Generated"
                    />
                    <Line
                      type="monotone"
                      dataKey="plans_accepted"
                      stroke="#22C7A1"
                      strokeWidth={2}
                      dot={{ fill: "#22C7A1", strokeWidth: 2 }}
                      name="Plans Accepted"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </AdminPanel>

          <AdminPanel className="overflow-hidden rounded-[30px] border-0 bg-white shadow-[0_18px_44px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
            <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
              <h3 className="flex items-center gap-2 text-base font-black text-[#020617]">
                <Target className="h-4 w-4 text-[#7C83F6]" />
                AI Accuracy Score
              </h3>
            </div>
            <div className="p-5">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5EAF1" />
                    <XAxis dataKey="date" stroke="#94A3B8" fontSize={12} />
                    <YAxis stroke="#94A3B8" fontSize={12} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #E5EAF1",
                        borderRadius: "14px",
                      }}
                    />
                    <Bar
                      dataKey="accuracy_score"
                      fill="#7C83F6"
                      radius={[10, 10, 0, 0]}
                      name="Accuracy %"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="font-bold text-[#94A3B8]">
                  Average Accuracy
                </span>
                <span className="font-black text-[#7C83F6]">
                  {avgAccuracy.toFixed(1)}%
                </span>
              </div>
            </div>
          </AdminPanel>
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <AdminMetricTile
            label="Total AI Requests"
            value={totalRequests.toLocaleString()}
            icon={Zap}
            accent="#38BDF8"
            className="bg-white"
          />
          <AdminMetricTile
            label="Avg Response Time"
            value={`${Math.round(engineStatus.reduce((acc, s) => acc + s.avg_response_time, 0) / engineStatus.length)}ms`}
            icon={Clock}
            accent="#22C7A1"
            className="bg-white"
          />
          <AdminMetricTile
            label="Plans Accepted"
            value={metrics.reduce((acc, m) => acc + m.plans_accepted, 0)}
            subValue="7d"
            icon={Users}
            accent="#7C83F6"
            className="bg-white"
          />
          <AdminMetricTile
            label="Adjustments"
            value={metrics.reduce((acc, m) => acc + m.adjustments_made, 0)}
            subValue="7d"
            icon={Activity}
            accent="#F97316"
            className="bg-white"
          />
        </div>
      </div>
    </AdminLayout>
  );
}
