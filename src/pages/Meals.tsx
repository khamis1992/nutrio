import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { 
  Salad, 
  Flame, 
  Beef, 
  Star,
  Clock,
  Utensils,
  Calendar,
  TrendingUp,
  Search,
  SlidersHorizontal,
  X,
  Loader2,
  ChevronLeft
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Meal {
  id: string;
  name: string;
  restaurant_name: string;
  image_url: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  price: number;
  rating: number;
  prep_time_minutes: number;
  diet_tags: string[];
}

interface DietTag {
  id: string;
  name: string;
}

interface Filters {
  search: string;
  maxCalories: number;
  minProtein: number;
  maxPrice: number;
  dietTags: string[];
}

const defaultFilters: Filters = {
  search: "",
  maxCalories: 1500,
  minProtein: 0,
  maxPrice: 50,
  dietTags: [],
};

const Meals = () => {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [dietTags, setDietTags] = useState<DietTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Fetch meals and diet tags
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch meals with restaurant names
        const { data: mealsData, error: mealsError } = await supabase
          .from("meals")
          .select(`
            id,
            name,
            image_url,
            calories,
            protein_g,
            carbs_g,
            fat_g,
            price,
            rating,
            prep_time_minutes,
            restaurants (name),
            meal_diet_tags (
              diet_tags (id, name)
            )
          `)
          .eq("is_available", true);

        if (mealsError) throw mealsError;

        // Fetch all diet tags
        const { data: tagsData, error: tagsError } = await supabase
          .from("diet_tags")
          .select("id, name")
          .order("name");

        if (tagsError) throw tagsError;

        // Transform meals data
        const transformedMeals: Meal[] = (mealsData || []).map((meal: any) => ({
          id: meal.id,
          name: meal.name,
          restaurant_name: meal.restaurants?.name || "Unknown",
          image_url: meal.image_url,
          calories: meal.calories,
          protein_g: parseFloat(meal.protein_g),
          carbs_g: parseFloat(meal.carbs_g),
          fat_g: parseFloat(meal.fat_g),
          price: parseFloat(meal.price),
          rating: parseFloat(meal.rating) || 0,
          prep_time_minutes: meal.prep_time_minutes || 15,
          diet_tags: meal.meal_diet_tags?.map((mdt: any) => mdt.diet_tags?.name).filter(Boolean) || [],
        }));

        setMeals(transformedMeals);
        setDietTags(tagsData || []);
      } catch (err) {
        console.error("Error fetching meals:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter meals based on current filters
  const filteredMeals = useMemo(() => {
    return meals.filter((meal) => {
      // Search filter
      if (filters.search && !meal.name.toLowerCase().includes(filters.search.toLowerCase()) &&
          !meal.restaurant_name.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }

      // Calories filter
      if (meal.calories > filters.maxCalories) {
        return false;
      }

      // Protein filter
      if (meal.protein_g < filters.minProtein) {
        return false;
      }

      // Price filter
      if (meal.price > filters.maxPrice) {
        return false;
      }

      // Diet tags filter
      if (filters.dietTags.length > 0) {
        const hasMatchingTag = filters.dietTags.some(tag => meal.diet_tags.includes(tag));
        if (!hasMatchingTag) return false;
      }

      return true;
    });
  }, [meals, filters]);

  const toggleDietTag = (tagName: string) => {
    setFilters(prev => ({
      ...prev,
      dietTags: prev.dietTags.includes(tagName)
        ? prev.dietTags.filter(t => t !== tagName)
        : [...prev.dietTags, tagName]
    }));
  };

  const clearFilters = () => {
    setFilters(defaultFilters);
  };

  const activeFiltersCount = 
    (filters.maxCalories < 1500 ? 1 : 0) +
    (filters.minProtein > 0 ? 1 : 0) +
    (filters.maxPrice < 50 ? 1 : 0) +
    filters.dietTags.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold">Browse Meals</h1>
            <p className="text-xs text-muted-foreground">{filteredMeals.length} meals available</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 space-y-4 pb-24">
        {/* Search and Filter Bar */}
        <div className="flex gap-2 animate-fade-in">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search meals or restaurants..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="pl-9"
            />
          </div>
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="relative shrink-0">
                <SlidersHorizontal className="w-4 h-4" />
                {activeFiltersCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
              <SheetHeader className="mb-6">
                <div className="flex items-center justify-between">
                  <SheetTitle>Filters</SheetTitle>
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    Clear all
                  </Button>
                </div>
              </SheetHeader>

              <div className="space-y-8 overflow-y-auto max-h-[calc(85vh-10rem)]">
                {/* Calories Filter */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="font-medium flex items-center gap-2">
                      <Flame className="w-4 h-4 text-destructive" />
                      Max Calories
                    </label>
                    <span className="text-sm text-muted-foreground">{filters.maxCalories} kcal</span>
                  </div>
                  <Slider
                    value={[filters.maxCalories]}
                    onValueChange={([value]) => setFilters(prev => ({ ...prev, maxCalories: value }))}
                    max={1500}
                    min={200}
                    step={50}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>200 kcal</span>
                    <span>1500 kcal</span>
                  </div>
                </div>

                {/* Protein Filter */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="font-medium flex items-center gap-2">
                      <Beef className="w-4 h-4 text-destructive" />
                      Min Protein
                    </label>
                    <span className="text-sm text-muted-foreground">{filters.minProtein}g</span>
                  </div>
                  <Slider
                    value={[filters.minProtein]}
                    onValueChange={([value]) => setFilters(prev => ({ ...prev, minProtein: value }))}
                    max={60}
                    min={0}
                    step={5}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>0g</span>
                    <span>60g</span>
                  </div>
                </div>

                {/* Price Filter */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="font-medium">Max Price</label>
                    <span className="text-sm text-muted-foreground">${filters.maxPrice}</span>
                  </div>
                  <Slider
                    value={[filters.maxPrice]}
                    onValueChange={([value]) => setFilters(prev => ({ ...prev, maxPrice: value }))}
                    max={50}
                    min={5}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>$5</span>
                    <span>$50</span>
                  </div>
                </div>

                {/* Diet Tags */}
                <div className="space-y-4">
                  <label className="font-medium">Diet Preferences</label>
                  <div className="flex flex-wrap gap-2">
                    {dietTags.map((tag) => (
                      <Button
                        key={tag.id}
                        variant={filters.dietTags.includes(tag.name) ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleDietTag(tag.name)}
                        className="rounded-full"
                      >
                        {tag.name}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={() => setFiltersOpen(false)}
                >
                  Show {filteredMeals.length} results
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Active Filters Tags */}
        {(filters.dietTags.length > 0 || filters.maxCalories < 1500 || filters.minProtein > 0 || filters.maxPrice < 50) && (
          <div className="flex gap-2 flex-wrap animate-fade-in">
            {filters.maxCalories < 1500 && (
              <Badge variant="secondary" className="gap-1">
                ≤{filters.maxCalories} kcal
                <X 
                  className="w-3 h-3 cursor-pointer" 
                  onClick={() => setFilters(prev => ({ ...prev, maxCalories: 1500 }))}
                />
              </Badge>
            )}
            {filters.minProtein > 0 && (
              <Badge variant="secondary" className="gap-1">
                ≥{filters.minProtein}g protein
                <X 
                  className="w-3 h-3 cursor-pointer" 
                  onClick={() => setFilters(prev => ({ ...prev, minProtein: 0 }))}
                />
              </Badge>
            )}
            {filters.maxPrice < 50 && (
              <Badge variant="secondary" className="gap-1">
                ≤${filters.maxPrice}
                <X 
                  className="w-3 h-3 cursor-pointer" 
                  onClick={() => setFilters(prev => ({ ...prev, maxPrice: 50 }))}
                />
              </Badge>
            )}
            {filters.dietTags.map(tag => (
              <Badge key={tag} variant="diet" className="gap-1">
                {tag}
                <X 
                  className="w-3 h-3 cursor-pointer" 
                  onClick={() => toggleDietTag(tag)}
                />
              </Badge>
            ))}
          </div>
        )}

        {/* Meal Grid */}
        <div className="grid gap-4 animate-fade-in stagger-1">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredMeals.length === 0 ? (
            <Card variant="default">
              <CardContent className="p-12 text-center">
                <Utensils className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">No meals found</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Try adjusting your filters to see more options
                </p>
                <Button variant="outline" onClick={clearFilters}>
                  Clear filters
                </Button>
              </CardContent>
            </Card>
          ) : (
            filteredMeals.map((meal) => (
              <Link key={meal.id} to={`/meals/${meal.id}`}>
                <Card variant="interactive">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className="w-24 h-24 rounded-xl bg-muted flex items-center justify-center text-4xl overflow-hidden shrink-0">
                      {meal.image_url ? (
                        <img 
                          src={meal.image_url} 
                          alt={meal.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        "🍽️"
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h3 className="font-semibold truncate">{meal.name}</h3>
                          <p className="text-sm text-muted-foreground truncate">{meal.restaurant_name}</p>
                        </div>
                        <p className="font-bold text-primary shrink-0">${meal.price.toFixed(2)}</p>
                      </div>
                      
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <Flame className="w-3 h-3" />
                          {meal.calories} kcal
                        </span>
                        <span className="flex items-center gap-1">
                          <Beef className="w-3 h-3" />
                          {meal.protein_g}g protein
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {meal.prep_time_minutes} min
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-warning text-warning" />
                          {meal.rating.toFixed(1)}
                        </span>
                      </div>

                      {meal.diet_tags.length > 0 && (
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {meal.diet_tags.slice(0, 3).map((tag) => (
                            <Badge key={tag} variant="diet" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {meal.diet_tags.length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{meal.diet_tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              </Link>
            ))
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border z-50">
        <div className="container mx-auto px-4">
          <div className="flex justify-around items-center h-16">
            {[
              { icon: Salad, label: "Home", active: false, to: "/dashboard" },
              { icon: Utensils, label: "Meals", active: true, to: "/meals" },
              { icon: Calendar, label: "Schedule", active: false, to: "/schedule" },
              { icon: TrendingUp, label: "Progress", active: false, to: "/progress" },
            ].map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className={`flex flex-col items-center gap-1 py-2 px-4 rounded-xl transition-colors ${
                  item.active 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <item.icon className={`w-5 h-5 ${item.active ? "fill-primary/20" : ""}`} />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Meals;
