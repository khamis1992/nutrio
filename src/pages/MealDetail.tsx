import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { 
  ChevronLeft,
  Flame, 
  Beef, 
  Wheat,
  Droplets,
  Star,
  Clock,
  MapPin,
  CalendarIcon,
  Check,
  Loader2,
  Leaf,
  Crown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";
import { format } from "date-fns";

interface MealDetail {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  rating: number;
  prep_time_minutes: number;
  restaurant: {
    name: string;
    address: string | null;
  };
  diet_tags: string[];
}

const mealTypes = [
  { value: "breakfast", label: "Breakfast", icon: "🌅" },
  { value: "lunch", label: "Lunch", icon: "☀️" },
  { value: "dinner", label: "Dinner", icon: "🌙" },
  { value: "snack", label: "Snack", icon: "🍎" },
];

const MealDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { subscription, hasActiveSubscription, remainingMeals, isUnlimited, canOrderMeal, incrementMealUsage, loading: subscriptionLoading } = useSubscription();

  const [meal, setMeal] = useState<MealDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedMealType, setSelectedMealType] = useState<string>("lunch");
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  useEffect(() => {
    const fetchMeal = async () => {
      if (!id) return;

      try {
        const { data, error } = await supabase
          .from("meals")
          .select(`
            id,
            name,
            description,
            image_url,
            calories,
            protein_g,
            carbs_g,
            fat_g,
            fiber_g,
            rating,
            prep_time_minutes,
            restaurants (name, address),
            meal_diet_tags (
              diet_tags (name)
            )
          `)
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setMeal({
            id: data.id,
            name: data.name,
            description: data.description,
            image_url: data.image_url,
            calories: data.calories,
            protein_g: parseFloat(String(data.protein_g)),
            carbs_g: parseFloat(String(data.carbs_g)),
            fat_g: parseFloat(String(data.fat_g)),
            fiber_g: data.fiber_g ? parseFloat(String(data.fiber_g)) : null,
            rating: parseFloat(String(data.rating)) || 0,
            prep_time_minutes: data.prep_time_minutes || 15,
            restaurant: {
              name: (data.restaurants as any)?.name || "Unknown",
              address: (data.restaurants as any)?.address || null,
            },
            diet_tags: (data.meal_diet_tags as any[])?.map((mdt: any) => mdt.diet_tags?.name).filter(Boolean) || [],
          });
        }
      } catch (err) {
        console.error("Error fetching meal:", err);
        toast({
          title: "Error",
          description: "Failed to load meal details",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMeal();
  }, [id, toast]);

  const [success, setSuccess] = useState(false);

  const handleAddToSchedule = async () => {
    if (!user || !meal || !selectedDate) return;

    if (!hasActiveSubscription) {
      toast({
        title: "Subscription required",
        description: "Please subscribe to a plan to order meals.",
        variant: "destructive",
      });
      navigate("/subscription");
      return;
    }

    if (!canOrderMeal) {
      toast({
        title: "Meal limit reached",
        description: "You've used all your meals for this week. Consider upgrading your plan.",
        variant: "destructive",
      });
      return;
    }

    setScheduling(true);
    try {
      // Increment meal usage first
      const usageSuccess = await incrementMealUsage();
      if (!usageSuccess) {
        throw new Error("Failed to update meal quota");
      }

      const { error } = await supabase
        .from("meal_schedules")
        .insert({
          user_id: user.id,
          meal_id: meal.id,
          scheduled_date: format(selectedDate, "yyyy-MM-dd"),
          meal_type: selectedMealType,
        });

      if (error) throw error;

      setSuccess(true);
      toast({
        title: "Meal scheduled!",
        description: `${meal.name} added to ${selectedMealType} on ${format(selectedDate, "MMM d")}`,
      });

      // Navigate to schedule after brief animation
      setTimeout(() => {
        navigate("/schedule");
      }, 1200);
    } catch (err) {
      console.error("Error scheduling meal:", err);
      toast({
        title: "Error",
        description: "Failed to schedule meal",
        variant: "destructive",
      });
      setScheduling(false);
    }
  };

  // Calculate macro percentages
  const totalMacroCalories = meal 
    ? (meal.protein_g * 4) + (meal.carbs_g * 4) + (meal.fat_g * 9)
    : 0;
  
  const macroPercentages = meal ? {
    protein: Math.round((meal.protein_g * 4 / totalMacroCalories) * 100) || 0,
    carbs: Math.round((meal.carbs_g * 4 / totalMacroCalories) * 100) || 0,
    fat: Math.round((meal.fat_g * 9 / totalMacroCalories) * 100) || 0,
  } : { protein: 0, carbs: 0, fat: 0 };

  if (loading || subscriptionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!meal) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
          <div className="container mx-auto px-4 h-16 flex items-center">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </div>
        </header>
        <main className="container mx-auto px-4 py-12 text-center">
          <h2 className="text-xl font-bold mb-2">Meal not found</h2>
          <p className="text-muted-foreground mb-4">This meal doesn't exist or is no longer available.</p>
          <Link to="/meals">
            <Button>Browse Meals</Button>
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Hero Image */}
      <div className="relative h-80 bg-muted">
        {meal.image_url ? (
          <img 
            src={meal.image_url} 
            alt={meal.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-8xl bg-gradient-to-br from-muted to-muted-foreground/10">
            🍽️
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        
        {/* Back Button */}
        <Button 
          variant="secondary" 
          size="icon" 
          className="absolute top-4 left-4 bg-background/80 backdrop-blur-sm"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
      </div>

      <main className="container mx-auto px-4 -mt-16 relative z-10 space-y-6">
        {/* Header Card */}
        <Card className="animate-fade-in">
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h1 className="text-xl font-bold">{meal.name}</h1>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3" />
                  {meal.restaurant.name}
                </p>
              </div>
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                Included in plan
              </Badge>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
              <span className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-warning text-warning" />
                {meal.rating.toFixed(1)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {meal.prep_time_minutes} min
              </span>
              <span className="flex items-center gap-1">
                <Flame className="w-4 h-4 text-destructive" />
                {meal.calories} kcal
              </span>
            </div>

            {meal.diet_tags.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {meal.diet_tags.map((tag) => (
                  <Badge key={tag} variant="diet">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subscription Status Banner */}
        {!hasActiveSubscription ? (
          <Card className="animate-fade-in border-amber-500/50 bg-amber-500/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-amber-500" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Subscribe to order meals</p>
                  <p className="text-sm text-muted-foreground">Get access to all meals with a subscription plan</p>
                </div>
                <Button size="sm" onClick={() => navigate("/subscription")}>
                  Subscribe
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="animate-fade-in border-primary/50 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Crown className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium capitalize">{subscription?.plan} Plan</p>
                    <p className="text-sm text-muted-foreground">
                      {isUnlimited 
                        ? "Unlimited meals" 
                        : `${remainingMeals} of ${subscription?.meals_per_week} meals remaining`
                      }
                    </p>
                  </div>
                </div>
                {!canOrderMeal && !isUnlimited && (
                  <Badge variant="destructive">Limit reached</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Description */}
        {meal.description && (
          <Card className="animate-fade-in stagger-1">
            <CardContent className="p-5">
              <h2 className="font-semibold mb-2">About this meal</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {meal.description}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Nutrition Card */}
        <Card className="animate-fade-in stagger-2">
          <CardContent className="p-5">
            <h2 className="font-semibold mb-4">Nutrition Facts</h2>
            
            {/* Calorie Banner */}
            <div className="bg-primary/10 rounded-xl p-4 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <Flame className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{meal.calories}</p>
                  <p className="text-xs text-muted-foreground">calories per serving</p>
                </div>
              </div>
            </div>

            {/* Macro Breakdown */}
            <div className="space-y-4">
              {/* Macro Bar */}
              <div className="h-3 rounded-full overflow-hidden flex">
                <div 
                  className="bg-destructive transition-all"
                  style={{ width: `${macroPercentages.protein}%` }}
                />
                <div 
                  className="bg-warning transition-all"
                  style={{ width: `${macroPercentages.carbs}%` }}
                />
                <div 
                  className="bg-accent transition-all"
                  style={{ width: `${macroPercentages.fat}%` }}
                />
              </div>

              {/* Macro Details */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-2">
                    <Beef className="w-5 h-5 text-destructive" />
                  </div>
                  <p className="text-lg font-bold">{meal.protein_g}g</p>
                  <p className="text-xs text-muted-foreground">Protein</p>
                  <p className="text-xs text-muted-foreground">{macroPercentages.protein}%</p>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-2">
                    <Wheat className="w-5 h-5 text-warning" />
                  </div>
                  <p className="text-lg font-bold">{meal.carbs_g}g</p>
                  <p className="text-xs text-muted-foreground">Carbs</p>
                  <p className="text-xs text-muted-foreground">{macroPercentages.carbs}%</p>
                </div>
                <div className="text-center">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-2">
                    <Droplets className="w-5 h-5 text-accent" />
                  </div>
                  <p className="text-lg font-bold">{meal.fat_g}g</p>
                  <p className="text-xs text-muted-foreground">Fat</p>
                  <p className="text-xs text-muted-foreground">{macroPercentages.fat}%</p>
                </div>
              </div>

              {/* Fiber if available */}
              {meal.fiber_g !== null && meal.fiber_g > 0 && (
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <div className="flex items-center gap-2">
                    <Leaf className="w-4 h-4 text-primary" />
                    <span className="text-sm">Fiber</span>
                  </div>
                  <span className="font-medium">{meal.fiber_g}g</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Schedule Section */}
        {hasActiveSubscription && (
          <Card className="animate-fade-in stagger-3">
            <CardContent className="p-5">
              <h2 className="font-semibold mb-4">Schedule Delivery</h2>
              
              {/* Date Picker */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Select Date</label>
                  <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        {selectedDate ? format(selectedDate, "EEEE, MMMM d") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => {
                          setSelectedDate(date);
                          setDatePickerOpen(false);
                        }}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Meal Type Selection */}
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Meal Type</label>
                  <div className="grid grid-cols-4 gap-2">
                    {mealTypes.map((type) => (
                      <Button
                        key={type.value}
                        variant={selectedMealType === type.value ? "default" : "outline"}
                        className="flex flex-col h-auto py-3"
                        onClick={() => setSelectedMealType(type.value)}
                      >
                        <span className="text-lg mb-1">{type.icon}</span>
                        <span className="text-xs">{type.label}</span>
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Success Overlay */}
      {success && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-sm animate-fade-in">
          <div className="text-center animate-scale-in">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Check className="w-10 h-10 text-primary animate-scale-in" />
            </div>
            <h3 className="text-xl font-bold mb-1">Scheduled!</h3>
            <p className="text-muted-foreground text-sm">Redirecting to your schedule...</p>
          </div>
        </div>
      )}

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-lg border-t border-border z-50">
        <div className="container mx-auto">
          {hasActiveSubscription ? (
            <Button 
              className="w-full" 
              size="lg"
              onClick={handleAddToSchedule}
              disabled={scheduling || success || !selectedDate || !canOrderMeal}
            >
              {scheduling ? (
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
              ) : success ? (
                <Check className="w-5 h-5 mr-2" />
              ) : (
                <Check className="w-5 h-5 mr-2" />
              )}
              {success ? "Scheduled!" : !canOrderMeal ? "Meal Limit Reached" : "Schedule Meal"}
            </Button>
          ) : (
            <Button 
              className="w-full" 
              size="lg"
              onClick={() => navigate("/subscription")}
            >
              <Crown className="w-5 h-5 mr-2" />
              Subscribe to Order
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MealDetail;
