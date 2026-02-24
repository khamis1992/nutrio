import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar
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
  Server
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subHours } from "date-fns";

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
    "nutrition-profile": { name: "Nutrition Profile", icon: Target, color: "blue" },
    "meal-allocator": { name: "Meal Allocator", icon: Brain, color: "violet" },
    "dynamic-adjustment": { name: "Dynamic Adjustment", icon: Activity, color: "emerald" },
    "behavior-prediction": { name: "Behavior Prediction", icon: Users, color: "amber" },
    "restaurant-intelligence": { name: "Restaurant Intelligence", icon: Server, color: "cyan" },
  };

  const fetchAIEngineData = async () => {
    setIsLoading(true);
    try {
      // In production, this would fetch from actual monitoring tables
      // For now, simulating with realistic data
      const mockStatus: AIEngineStatus[] = [
        {
          layer_name: "nutrition-profile",
          status: "healthy",
          last_run: new Date().toISOString(),
          avg_response_time: 245,
          success_rate: 99.8,
          total_requests: 15234,
        },
        {
          layer_name: "meal-allocator",
          status: "healthy",
          last_run: new Date().toISOString(),
          avg_response_time: 890,
          success_rate: 98.5,
          total_requests: 8756,
        },
        {
          layer_name: "dynamic-adjustment",
          status: "warning",
          last_run: subHours(new Date(), 2).toISOString(),
          avg_response_time: 1200,
          success_rate: 94.2,
          total_requests: 3421,
        },
        {
          layer_name: "behavior-prediction",
          status: "healthy",
          last_run: new Date().toISOString(),
          avg_response_time: 567,
          success_rate: 97.8,
          total_requests: 12345,
        },
        {
          layer_name: "restaurant-intelligence",
          status: "healthy",
          last_run: new Date().toISOString(),
          avg_response_time: 1450,
          success_rate: 96.5,
          total_requests: 2890,
        },
      ];

      setEngineStatus(mockStatus);

      // Mock recommendation metrics
      const mockMetrics: RecommendationMetrics[] = Array.from({ length: 7 }, (_, i) => ({
        date: format(subHours(new Date(), (6 - i) * 24), "MMM d"),
        plans_generated: Math.floor(Math.random() * 200) + 100,
        plans_accepted: Math.floor(Math.random() * 150) + 80,
        adjustments_made: Math.floor(Math.random() * 50) + 20,
        accuracy_score: Math.floor(Math.random() * 15) + 80,
      }));

      setMetrics(mockMetrics);
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
        return "text-emerald-600 bg-emerald-50 border-emerald-200";
      case "warning":
        return "text-amber-600 bg-amber-50 border-amber-200";
      case "error":
        return "text-red-600 bg-red-50 border-red-200";
      default:
        return "text-slate-600 bg-slate-50 border-slate-200";
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
      <div className="flex items-center justify-center min-h-[400px] bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  const overallHealth = engineStatus.every(s => s.status === "healthy") 
    ? "healthy" 
    : engineStatus.some(s => s.status === "error")
    ? "error"
    : "warning";

  const avgSuccessRate = engineStatus.length > 0
    ? engineStatus.reduce((acc, s) => acc + s.success_rate, 0) / engineStatus.length
    : 0;

  const totalRequests = engineStatus.reduce((acc, s) => acc + s.total_requests, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Brain className="w-6 h-6 text-violet-600" />
                AI Engine Monitor
              </h1>
              <p className="text-slate-500 text-sm mt-0.5">
                Monitor AI layer performance and recommendation accuracy
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">
                Last updated: {format(lastRefresh, "HH:mm:ss")}
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchAIEngineData}
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Overall Health */}
        <Card className={cn(
          "mb-8 border-2",
          overallHealth === "healthy" ? "border-emerald-200 bg-emerald-50/50" :
          overallHealth === "warning" ? "border-amber-200 bg-amber-50/50" :
          "border-red-200 bg-red-50/50"
        )}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center",
                  overallHealth === "healthy" ? "bg-emerald-100" :
                  overallHealth === "warning" ? "bg-amber-100" :
                  "bg-red-100"
                )}>
                  {overallHealth === "healthy" ? (
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  ) : overallHealth === "warning" ? (
                    <AlertTriangle className="w-8 h-8 text-amber-600" />
                  ) : (
                    <AlertTriangle className="w-8 h-8 text-red-600" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    System {overallHealth === "healthy" ? "Healthy" : overallHealth === "warning" ? "Warning" : "Critical"}
                  </h2>
                  <p className="text-slate-600">
                    {engineStatus.filter(s => s.status === "healthy").length} of {engineStatus.length} layers operational
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-slate-900">
                  {avgSuccessRate.toFixed(1)}%
                </div>
                <p className="text-slate-500 text-sm">Avg Success Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Layer Status Cards */}
        <div className="grid md:grid-cols-5 gap-4 mb-8">
          {engineStatus.map((layer) => {
            const info = layerInfo[layer.layer_name as keyof typeof layerInfo] || {
              name: layer.layer_name,
              icon: Cpu,
              color: "slate",
            };
            const IconComponent = info.icon;

            return (
              <Card 
                key={layer.layer_name}
                className={cn(
                  "bg-white border-slate-200 hover:shadow-lg transition-all cursor-pointer",
                  layer.status !== "healthy" && "ring-2 ring-amber-500/50"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center",
                      `bg-${info.color}-50`
                    )}>
                      <IconComponent className={cn("w-5 h-5", `text-${info.color}-600`)} />
                    </div>
                    <Badge 
                      variant="outline" 
                      className={cn(getStatusColor(layer.status))}
                    >
                      {getStatusIcon(layer.status)}
                      <span className="ml-1 capitalize">{layer.status}</span>
                    </Badge>
                  </div>
                  
                  <h3 className="font-semibold text-slate-900 text-sm mb-1">
                    {info.name}
                  </h3>
                  
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Response</span>
                      <span className="font-medium text-slate-700">
                        {layer.avg_response_time}ms
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Success</span>
                      <span className="font-medium text-slate-700">
                        {layer.success_rate.toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Requests</span>
                      <span className="font-medium text-slate-700">
                        {layer.total_requests.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {layer.status !== "healthy" && (
                    <div className="mt-3 p-2 bg-amber-50 rounded text-xs text-amber-700">
                      <AlertTriangle className="w-3 h-3 inline mr-1" />
                      High response time detected
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Performance Charts */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <Card className="bg-white border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-slate-900 text-base font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-600" />
                Recommendation Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "white", 
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px"
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="plans_generated"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: "#3b82f6", strokeWidth: 2 }}
                      name="Plans Generated"
                    />
                    <Line
                      type="monotone"
                      dataKey="plans_accepted"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={{ fill: "#10b981", strokeWidth: 2 }}
                      name="Plans Accepted"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-slate-900 text-base font-semibold flex items-center gap-2">
                <Target className="w-4 h-4 text-violet-600" />
                AI Accuracy Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "white", 
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px"
                      }}
                    />
                    <Bar
                      dataKey="accuracy_score"
                      fill="#8b5cf6"
                      radius={[4, 4, 0, 0]}
                      name="Accuracy %"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-slate-600">Average Accuracy</span>
                <span className="font-bold text-violet-600">
                  {(metrics.reduce((acc, m) => acc + m.accuracy_score, 0) / metrics.length).toFixed(1)}%
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-4 gap-4">
          <Card className="bg-white border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{totalRequests.toLocaleString()}</p>
                  <p className="text-sm text-slate-500">Total AI Requests</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {Math.round(engineStatus.reduce((acc, s) => acc + s.avg_response_time, 0) / engineStatus.length)}ms
                  </p>
                  <p className="text-sm text-slate-500">Avg Response Time</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center">
                  <Users className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {metrics.reduce((acc, m) => acc + m.plans_accepted, 0)}
                  </p>
                  <p className="text-sm text-slate-500">Plans Accepted (7d)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Activity className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {metrics.reduce((acc, m) => acc + m.adjustments_made, 0)}
                  </p>
                  <p className="text-sm text-slate-500">Adjustments (7d)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
