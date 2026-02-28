import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts";
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  Clock,
  Users,
  ChefHat,
  ArrowRight,
  CheckCircle2,
  Info,
  UtensilsCrossed,
  Zap
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface RestaurantAnalytics {
  demand_score: number;
  capacity_utilization: number;
  order_growth_rate: number;
  customer_satisfaction: number;
  avg_prep_time_minutes: number;
  popular_macro_categories: Record<string, number>;
  peak_ordering_hours: number[];
  is_overloaded: boolean;
  analyzed_date: string;
}

interface AIInsight {
  id: string;
  insight_type: string;
  insight_data: {
    title: string;
    message: string;
    recommendation: string;
    [key: string]: any;
  };
  priority: string;
  is_read: boolean;
  created_at: string;
}

export default function PartnerAIInsights() {
  const [analytics, setAnalytics] = useState<RestaurantAnalytics | null>(null);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInsight, setSelectedInsight] = useState<string | null>(null);

  const fetchAIInsights = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get restaurant ID
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (!restaurant) return;

      const restaurantId = restaurant.id;

      // Fetch analytics
      const { data: analyticsData } = await supabase
        .from("restaurant_analytics")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("analyzed_date", { ascending: false })
        .limit(1)
        .single();

      setAnalytics(analyticsData);

      // Fetch insights
      const { data: insightsData } = await supabase
        .from("restaurant_ai_insights")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(10);

      setInsights(insightsData || []);
    } catch (error) {
      console.error("Error fetching AI insights:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const markInsightAsRead = async (insightId: string) => {
    try {
      await supabase
        .from("restaurant_ai_insights")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", insightId);

      setInsights(prev => 
        prev.map(insight => 
          insight.id === insightId ? { ...insight, is_read: true } : insight
        )
      );
    } catch (error) {
      console.error("Error marking insight as read:", error);
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case "capacity_adjustment":
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case "menu_optimization":
        return <ChefHat className="w-5 h-5 text-cyan-500" />;
      case "demand_forecast":
        return <TrendingUp className="w-5 h-5 text-emerald-500" />;
      default:
        return <Lightbulb className="w-5 h-5 text-violet-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-500/20 text-red-400 border-red-500/50";
      case "medium":
        return "bg-amber-500/20 text-amber-400 border-amber-500/50";
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/50";
    }
  };

  useEffect(() => {
    fetchAIInsights();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-slate-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-violet-500" />
                AI Insights & Analytics
              </h1>
              <p className="text-slate-400 mt-1">
                Data-driven recommendations to optimize your restaurant performance
              </p>
            </div>
            <Button
              variant="outline"
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={fetchAIInsights}
            >
              <Zap className="w-4 h-4 mr-2" />
              Refresh Analysis
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {analytics ? (
          <>
            {/* Performance Score */}
            <Card className="bg-slate-900 border-slate-800 mb-8">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-lg font-semibold text-white">Overall Performance Score</h2>
                    <p className="text-slate-400 text-sm">Based on demand, satisfaction, and efficiency</p>
                  </div>
                  <div className="text-right">
                    <div className={cn(
                      "text-4xl font-bold",
                      analytics.demand_score >= 70 ? "text-emerald-400" :
                      analytics.demand_score >= 40 ? "text-amber-400" :
                      "text-red-400"
                    )}>
                      {analytics.demand_score}/100
                    </div>
                    <Badge 
                      variant="outline" 
                      className={cn(
                        analytics.demand_score >= 70 ? "border-emerald-500/50 text-emerald-400" :
                        analytics.demand_score >= 40 ? "border-amber-500/50 text-amber-400" :
                        "border-red-500/50 text-red-400"
                      )}
                    >
                      {analytics.demand_score >= 70 ? "Excellent" :
                       analytics.demand_score >= 40 ? "Good" : "Needs Improvement"}
                    </Badge>
                  </div>
                </div>
                <Progress 
                  value={analytics.demand_score} 
                  className="h-3 bg-slate-800"
                />
              </CardContent>
            </Card>

            {/* Stats Grid */}
            <div className="grid md:grid-cols-4 gap-4 mb-8">
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 text-sm">Capacity Utilization</span>
                    <Clock className="w-5 h-5 text-cyan-500" />
                  </div>
                  <div className={cn(
                    "text-3xl font-bold",
                    analytics.capacity_utilization > 0.85 ? "text-red-400" :
                    analytics.capacity_utilization > 0.5 ? "text-emerald-400" :
                    "text-amber-400"
                  )}>
                    {Math.round(analytics.capacity_utilization * 100)}%
                  </div>
                  {analytics.is_overloaded && (
                    <Badge className="mt-2 bg-red-500/20 text-red-400 border-red-500/50">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Overloaded
                    </Badge>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 text-sm">Growth Rate</span>
                    {analytics.order_growth_rate >= 0 ? (
                      <TrendingUp className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  <div className={cn(
                    "text-3xl font-bold",
                    analytics.order_growth_rate >= 0 ? "text-emerald-400" : "text-red-400"
                  )}>
                    {analytics.order_growth_rate >= 0 ? "+" : ""}
                    {analytics.order_growth_rate}%
                  </div>
                  <span className="text-slate-500 text-sm">vs last period</span>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 text-sm">Customer Rating</span>
                    <Users className="w-5 h-5 text-violet-500" />
                  </div>
                  <div className="text-3xl font-bold text-violet-400">
                    {analytics.customer_satisfaction?.toFixed(1) || "4.5"}
                  </div>
                  <span className="text-slate-500 text-sm">out of 5.0</span>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-400 text-sm">Avg Prep Time</span>
                    <Clock className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="text-3xl font-bold text-amber-400">
                    {analytics.avg_prep_time_minutes || 25}
                  </div>
                  <span className="text-slate-500 text-sm">minutes</span>
                </CardContent>
              </Card>
            </div>

            {/* Popular Categories */}
            {analytics.popular_macro_categories && Object.keys(analytics.popular_macro_categories).length > 0 && (
              <Card className="bg-slate-900 border-slate-800 mb-8">
                <CardHeader>
                  <CardTitle className="text-slate-100 flex items-center gap-2">
                    <UtensilsCrossed className="w-5 h-5 text-cyan-500" />
                    Popular Categories
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={Object.entries(analytics.popular_macro_categories).map(([name, value]) => ({
                          name: name.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
                          value,
                        }))}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                        <YAxis stroke="#64748b" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#0f172a",
                            border: "1px solid #1e293b",
                            borderRadius: "8px",
                            color: "#f1f5f9",
                          }}
                        />
                        <Bar dataKey="value" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Peak Hours */}
            {analytics.peak_ordering_hours && analytics.peak_ordering_hours.length > 0 && (
              <Card className="bg-slate-900 border-slate-800 mb-8">
                <CardHeader>
                  <CardTitle className="text-slate-100 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-amber-500" />
                    Peak Ordering Hours
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {analytics.peak_ordering_hours.map((hour) => (
                      <Badge
                        key={hour}
                        className="bg-amber-500/20 text-amber-400 border-amber-500/50 text-lg py-2 px-4"
                      >
                        {hour}:00
                      </Badge>
                    ))}
                  </div>
                  <p className="text-slate-400 text-sm mt-4">
                    Consider increasing staff during these hours to handle higher demand efficiently.
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card className="bg-slate-900 border-slate-800 mb-8">
            <CardContent className="p-12 text-center">
              <Sparkles className="w-16 h-16 mx-auto mb-4 text-slate-600" />
              <h3 className="text-xl font-semibold text-slate-200 mb-2">
                No Analytics Data Yet
              </h3>
              <p className="text-slate-400 max-w-md mx-auto mb-4">
                Analytics will be generated once you start receiving orders. Check back soon for AI-powered insights!
              </p>
              <Button
                variant="outline"
                className="border-primary/50 text-cyan-400 hover:bg-cyan-950"
                onClick={fetchAIInsights}
              >
                <Zap className="w-4 h-4 mr-2" />
                Check Again
              </Button>
            </CardContent>
          </Card>
        )}

        {/* AI Insights List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-violet-500" />
              AI Recommendations
            </h2>
            <Badge variant="outline" className="border-slate-700 text-slate-400">
              {insights.filter(i => !i.is_read).length} New
            </Badge>
          </div>

          {insights.length > 0 ? (
            insights.map((insight) => (
              <Card
                key={insight.id}
                className={cn(
                  "bg-slate-900 border-slate-800 transition-all cursor-pointer",
                  !insight.is_read && "border-l-4 border-l-violet-500",
                  selectedInsight === insight.id && "ring-1 ring-violet-500/50"
                )}
                onClick={() => {
                  setSelectedInsight(insight.id);
                  if (!insight.is_read) {
                    markInsightAsRead(insight.id);
                  }
                }}
              >
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0",
                      insight.priority === "high" ? "bg-red-500/20" :
                      insight.priority === "medium" ? "bg-amber-500/20" :
                      "bg-slate-500/20"
                    )}>
                      {getInsightIcon(insight.insight_type)}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-slate-200">
                          {insight.insight_data.title}
                        </h3>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={cn(getPriorityColor(insight.priority))}
                          >
                            {insight.priority}
                          </Badge>
                          {!insight.is_read && (
                            <div className="w-2 h-2 rounded-full bg-violet-500" />
                          )}
                        </div>
                      </div>

                      <p className="text-slate-400 text-sm mb-3">
                        {insight.insight_data.message}
                      </p>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-cyan-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Recommendation: {insight.insight_data.recommendation}</span>
                        </div>
                        <span className="text-xs text-slate-500">
                          {format(new Date(insight.created_at), "MMM d, h:mm a")}
                        </span>
                      </div>
                    </div>

                    <ChevronRight className="w-5 h-5 text-slate-600 flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-12 text-center">
                <Info className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                <p className="text-slate-400">No AI recommendations yet</p>
                <p className="text-sm text-slate-500 mt-1">
                  Insights are generated based on your order patterns and performance
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
