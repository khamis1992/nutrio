import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Scale, Plus, TrendingDown, TrendingUp, Minus, Target, Calendar, Trash2, Edit2, ChevronDown, ChevronUp, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays, startOfWeek, endOfWeek, isSameWeek, parseISO } from "date-fns";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CustomerNavigation } from "@/components/CustomerNavigation";
import { cn } from "@/lib/utils";

interface WeightEntry {
  id: string;
  weight_kg: number | null;
  log_date: string;
  notes?: string | null;
}

interface WeightStats {
  current: number | null;
  start: number | null;
  change: number | null;
  changePercent: number | null;
  weeklyAverage: number | null;
  monthlyAverage: number | null;
  goal: number | null;
  remainingToGoal: number | null;
  bmi: number | null;
}

export default function WeightTracking() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [currentWeight, setCurrentWeight] = useState("");
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WeightEntry | null>(null);
  const [showAllEntries, setShowAllEntries] = useState(false);
  const [timeRange, setTimeRange] = useState<"7" | "30" | "90" | "all">("30");

  useEffect(() => {
    fetchWeightEntries();
  }, [user]);

  const fetchWeightEntries = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from("body_measurements")
        .select("id, weight_kg, log_date, notes")
        .eq("user_id", user.id)
        .order("log_date", { ascending: false });

      if (error) throw error;
      
      setWeightEntries((data || []) as WeightEntry[]);
    } catch (err) {
      console.error("Error fetching weight entries:", err);
      toast.error("Failed to load weight history");
    }
  };

  const calculateStats = (): WeightStats => {
    const entries = weightEntries.filter(e => e.weight_kg !== null);
    if (entries.length === 0) {
      return {
        current: null,
        start: null,
        change: null,
        changePercent: null,
        weeklyAverage: null,
        monthlyAverage: null,
        goal: profile?.target_weight_kg || null,
        remainingToGoal: null,
        bmi: null,
      };
    }

    const current = entries[0].weight_kg!;
    const start = entries[entries.length - 1].weight_kg!;
    const change = current - start;
    const changePercent = ((change / start) * 100);
    const goal = profile?.target_weight_kg || null;
    const remainingToGoal = goal ? current - goal : null;

    // Calculate BMI
    const heightM = (profile?.height_cm || 170) / 100;
    const bmi = current / (heightM * heightM);

    // Weekly average (last 7 days)
    const last7Days = entries.filter(e => 
      new Date(e.log_date) >= subDays(new Date(), 7)
    );
    const weeklyAverage = last7Days.length > 0
      ? last7Days.reduce((sum, e) => sum + e.weight_kg!, 0) / last7Days.length
      : null;

    // Monthly average (last 30 days)
    const last30Days = entries.filter(e => 
      new Date(e.log_date) >= subDays(new Date(), 30)
    );
    const monthlyAverage = last30Days.length > 0
      ? last30Days.reduce((sum, e) => sum + e.weight_kg!, 0) / last30Days.length
      : null;

    return {
      current,
      start,
      change,
      changePercent,
      weeklyAverage,
      monthlyAverage,
      goal,
      remainingToGoal,
      bmi: Math.round(bmi * 10) / 10,
    };
  };

  const stats = calculateStats();

  const handleAddWeight = async () => {
    if (!user || !currentWeight) return;
    
    const weight = parseFloat(currentWeight);
    if (isNaN(weight) || weight <= 0) {
      toast.error("Please enter a valid weight");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from("body_measurements")
        .upsert({
          user_id: user.id,
          weight_kg: weight,
          log_date: selectedDate,
        }, {
          onConflict: 'user_id,log_date',
          ignoreDuplicates: false
        });

      if (error) throw error;
      
      toast.success("Weight logged successfully");
      setCurrentWeight("");
      fetchWeightEntries();
    } catch (err) {
      console.error("Error adding weight:", err);
      toast.error("Failed to log weight");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from("body_measurements")
        .delete()
        .eq("id", entryId);

      if (error) throw error;
      
      toast.success("Entry deleted");
      fetchWeightEntries();
    } catch (err) {
      console.error("Error deleting entry:", err);
      toast.error("Failed to delete entry");
    }
  };

  const getFilteredChartData = () => {
    let filtered = [...weightEntries];
    
    if (timeRange !== "all") {
      const days = parseInt(timeRange);
      filtered = filtered.filter(e => 
        new Date(e.log_date) >= subDays(new Date(), days)
      );
    }
    
    return filtered
      .slice()
      .reverse()
      .map((entry) => ({
        date: format(new Date(entry.log_date), "MMM dd"),
        weight: entry.weight_kg,
        fullDate: entry.log_date,
      }));
  };

  const chartData = getFilteredChartData();
  const displayEntries = showAllEntries ? weightEntries : weightEntries.slice(0, 10);

  const getBMICategory = (bmi: number) => {
    if (bmi < 18.5) return { label: "Underweight", color: "text-blue-500" };
    if (bmi < 25) return { label: "Normal", color: "text-green-500" };
    if (bmi < 30) return { label: "Overweight", color: "text-yellow-500" };
    return { label: "Obese", color: "text-red-500" };
  };

  const bmiCategory = stats.bmi ? getBMICategory(stats.bmi) : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-primary to-accent">
        <div className="flex items-center justify-between px-4 h-14">
          <button
            onClick={() => navigate("/progress")}
            className="p-2 -ml-2 rounded-full hover:bg-white/20 active:scale-95 transition-all"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-lg font-semibold text-white tracking-wide">Weight Tracker</h1>
          <div className="w-10" />
        </div>
      </header>

      <main className="px-4 py-4 space-y-4">
        {/* Current Weight Hero Card */}
        <Card className="border-0 overflow-hidden bg-gradient-to-br from-primary to-accent">
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-white/80 text-sm mb-1">Current Weight</p>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-6xl font-bold text-white">
                  {stats.current?.toFixed(1) || "--"}
                </span>
                <span className="text-xl text-white/80">kg</span>
              </div>
              
              {stats.change !== null && (
                <div className={cn(
                  "flex items-center justify-center gap-1 mt-3 px-3 py-1 rounded-full bg-white/20 w-fit mx-auto",
                  stats.change < 0 ? 'text-green-300' : stats.change > 0 ? 'text-red-300' : 'text-white'
                )}>
                  {stats.change < 0 ? <TrendingDown className="h-4 w-4" /> : 
                   stats.change > 0 ? <TrendingUp className="h-4 w-4" /> : 
                   <Minus className="h-4 w-4" />}
                  <span className="text-sm font-medium">
                    {Math.abs(stats.change).toFixed(1)} kg 
                    {stats.change < 0 ? 'lost' : stats.change > 0 ? 'gained' : 'no change'}
                    {stats.changePercent !== null && ` (${stats.changePercent > 0 ? '+' : ''}${stats.changePercent.toFixed(1)}%)`}
                  </span>
                </div>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-white/20">
              <div className="text-center">
                <p className="text-white/70 text-xs">Weekly Avg</p>
                <p className="text-white font-bold text-lg">
                  {stats.weeklyAverage?.toFixed(1) || "--"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-white/70 text-xs">Monthly Avg</p>
                <p className="text-white font-bold text-lg">
                  {stats.monthlyAverage?.toFixed(1) || "--"}
                </p>
              </div>
              <div className="text-center">
                <p className="text-white/70 text-xs">Entries</p>
                <p className="text-white font-bold text-lg">{weightEntries.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Goal & BMI Cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Goal Card */}
          <Card className="border-0 bg-muted">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-primary" />
                <p className="text-xs text-muted-foreground">Goal Weight</p>
              </div>
              <p className="text-2xl font-bold">
                {stats.goal?.toFixed(1) || "--"}
                <span className="text-sm font-normal text-muted-foreground ml-1">kg</span>
              </p>
              {stats.remainingToGoal !== null && (
                <p className={cn(
                  "text-xs mt-1",
                  stats.remainingToGoal > 0 ? "text-red-500" : "text-green-500"
                )}>
                  {stats.remainingToGoal > 0 ? '+' : ''}{stats.remainingToGoal.toFixed(1)} kg to go
                </p>
              )}
            </CardContent>
          </Card>

          {/* BMI Card */}
          <Card className="border-0 bg-muted">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Info className="w-4 h-4 text-primary" />
                <p className="text-xs text-muted-foreground">BMI</p>
              </div>
              <p className="text-2xl font-bold">
                {stats.bmi?.toFixed(1) || "--"}
              </p>
              {bmiCategory && (
                <p className={cn("text-xs mt-1", bmiCategory.color)}>
                  {bmiCategory.label}
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Add Weight Card */}
        <Card className="border-0 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Log Weight</CardTitle>
            <CardDescription>Track your progress</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="date" className="text-sm">Date</Label>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <Input
                  id="date"
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="flex-1"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="weight" className="text-sm">Weight (kg)</Label>
              <div className="flex gap-2">
                <Input
                  id="weight"
                  type="number"
                  step="0.1"
                  placeholder="0.0"
                  value={currentWeight}
                  onChange={(e) => setCurrentWeight(e.target.value)}
                  className="flex-1 text-lg"
                />
                <Button 
                  onClick={handleAddWeight}
                  disabled={isSubmitting || !currentWeight}
                  className="px-6"
                >
                  {isSubmitting ? (
                    <span className="animate-spin">⏳</span>
                  ) : (
                    <Plus className="h-5 w-5" />
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Weight Chart */}
        {chartData.length > 1 && (
          <Card className="border-0">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Weight Trend</CardTitle>
                <div className="flex gap-1">
                  {(["7", "30", "90", "all"] as const).map((range) => (
                    <Button
                      key={range}
                      variant={timeRange === range ? "default" : "ghost"}
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setTimeRange(range)}
                    >
                      {range === "all" ? "All" : `${range}d`}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10 }}
                      interval="preserveStartEnd"
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }}
                      domain={['dataMin - 1', 'dataMax + 1']}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    {stats.goal && (
                      <ReferenceLine 
                        y={stats.goal} 
                        stroke="#10b981" 
                        strokeDasharray="5 5"
                        label={{ value: "Goal", fill: "#10b981", fontSize: 10 }}
                      />
                    )}
                    <Line 
                      type="monotone" 
                      dataKey="weight" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))", r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}

        {/* History List */}
        <Card className="border-0">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">History</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllEntries(!showAllEntries)}
                className="h-8 text-xs"
              >
                {showAllEntries ? (
                  <><ChevronUp className="w-4 h-4 mr-1" /> Show Less</>
                ) : (
                  <><ChevronDown className="w-4 h-4 mr-1" /> Show All</>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {displayEntries.map((entry, index) => (
                <div 
                  key={entry.id} 
                  className="flex items-center justify-between p-3 bg-muted rounded-xl"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Scale className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">{entry.weight_kg?.toFixed(1) ?? '--'} kg</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(entry.log_date), "MMM dd, yyyy")}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {index < displayEntries.length - 1 && entry.weight_kg && displayEntries[index + 1]?.weight_kg && (
                      <Badge 
                        variant={entry.weight_kg < displayEntries[index + 1].weight_kg! ? "default" : "destructive"}
                        className={cn(
                          "text-xs",
                          entry.weight_kg < displayEntries[index + 1].weight_kg! 
                            ? "bg-green-100 text-green-700 hover:bg-green-100" 
                            : entry.weight_kg > displayEntries[index + 1].weight_kg!
                              ? "bg-red-100 text-red-700 hover:bg-red-100"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-100"
                        )}
                      >
                        {entry.weight_kg < displayEntries[index + 1].weight_kg! ? (
                          <><TrendingDown className="w-3 h-3 mr-1" /> -{(displayEntries[index + 1].weight_kg! - entry.weight_kg).toFixed(1)}</>
                        ) : entry.weight_kg > displayEntries[index + 1].weight_kg! ? (
                          <><TrendingUp className="w-3 h-3 mr-1" /> +{(entry.weight_kg - displayEntries[index + 1].weight_kg!).toFixed(1)}</>
                        ) : (
                          <><Minus className="w-3 h-3 mr-1" /> 0</>
                        )}
                      </Badge>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDeleteEntry(entry.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
              
              {weightEntries.length === 0 && (
                <div className="text-center py-8">
                  <Scale className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">No weight entries yet</p>
                  <p className="text-sm text-muted-foreground">Start tracking your progress today!</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </main>

      <CustomerNavigation />
    </div>
  );
}
