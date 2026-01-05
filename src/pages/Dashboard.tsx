import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Salad, 
  Flame, 
  Beef, 
  Wheat, 
  Droplets,
  Calendar,
  TrendingUp,
  Plus,
  Filter,
  ChevronRight,
  Star,
  Clock,
  Utensils,
  LogOut,
  User,
  Bell
} from "lucide-react";

// Mock data
const mockMeals = [
  {
    id: 1,
    name: "Grilled Chicken Bowl",
    restaurant: "Green Kitchen",
    image: "🥗",
    calories: 485,
    protein: 42,
    carbs: 35,
    fat: 18,
    price: 12.99,
    dietTags: ["High Protein", "Low Carb"],
    rating: 4.8,
    prepTime: 15
  },
  {
    id: 2,
    name: "Salmon Avocado Salad",
    restaurant: "Fresh & Fit",
    image: "🥙",
    calories: 520,
    protein: 38,
    carbs: 22,
    fat: 28,
    price: 15.99,
    dietTags: ["Keto", "Omega-3"],
    rating: 4.9,
    prepTime: 12
  },
  {
    id: 3,
    name: "Veggie Buddha Bowl",
    restaurant: "Plant Power",
    image: "🥦",
    calories: 380,
    protein: 18,
    carbs: 52,
    fat: 12,
    price: 10.99,
    dietTags: ["Vegan", "High Fiber"],
    rating: 4.7,
    prepTime: 10
  },
  {
    id: 4,
    name: "Turkey Quinoa Wrap",
    restaurant: "Green Kitchen",
    image: "🌯",
    calories: 420,
    protein: 35,
    carbs: 42,
    fat: 14,
    price: 11.99,
    dietTags: ["Balanced", "Lean"],
    rating: 4.6,
    prepTime: 8
  },
];

const Dashboard = () => {
  const [selectedFilter, setSelectedFilter] = useState("All");
  
  // Mock user data
  const userStats = {
    dailyCalories: 1850,
    consumedCalories: 1120,
    protein: { target: 150, consumed: 95 },
    carbs: { target: 180, consumed: 110 },
    fat: { target: 60, consumed: 35 },
  };

  const filters = ["All", "High Protein", "Low Carb", "Keto", "Vegan"];

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center">
              <Salad className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Good morning,</p>
              <p className="font-semibold">Alex</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="icon" size="icon">
              <Bell className="w-5 h-5" />
            </Button>
            <Link to="/profile">
              <Button variant="icon" size="icon">
                <User className="w-5 h-5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 pb-24">
        {/* Daily Summary Card */}
        <Card variant="stat" className="animate-fade-in">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-muted-foreground">Today's Progress</p>
                <p className="text-2xl font-bold">
                  {userStats.consumedCalories} 
                  <span className="text-base font-normal text-muted-foreground">
                    /{userStats.dailyCalories} kcal
                  </span>
                </p>
              </div>
              <div className="w-16 h-16 relative">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth="6"
                  />
                  <circle
                    cx="32"
                    cy="32"
                    r="28"
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${(userStats.consumedCalories / userStats.dailyCalories) * 175.9} 175.9`}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Flame className="w-6 h-6 text-primary" />
                </div>
              </div>
            </div>

            {/* Macros */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Beef className="w-4 h-4 text-destructive" />
                  <span className="text-xs text-muted-foreground">Protein</span>
                </div>
                <Progress 
                  value={(userStats.protein.consumed / userStats.protein.target) * 100} 
                  className="h-1.5"
                />
                <p className="text-xs font-medium">{userStats.protein.consumed}g / {userStats.protein.target}g</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Wheat className="w-4 h-4 text-warning" />
                  <span className="text-xs text-muted-foreground">Carbs</span>
                </div>
                <Progress 
                  value={(userStats.carbs.consumed / userStats.carbs.target) * 100} 
                  variant="warning"
                  className="h-1.5"
                />
                <p className="text-xs font-medium">{userStats.carbs.consumed}g / {userStats.carbs.target}g</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Droplets className="w-4 h-4 text-accent" />
                  <span className="text-xs text-muted-foreground">Fat</span>
                </div>
                <Progress 
                  value={(userStats.fat.consumed / userStats.fat.target) * 100} 
                  variant="accent"
                  className="h-1.5"
                />
                <p className="text-xs font-medium">{userStats.fat.consumed}g / {userStats.fat.target}g</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 animate-fade-in stagger-1">
          <Link to="/schedule">
            <Card variant="interactive" className="h-full">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Meal Schedule</p>
                  <p className="text-xs text-muted-foreground">Plan your week</p>
                </div>
              </CardContent>
            </Card>
          </Link>
          <Link to="/progress">
            <Card variant="interactive" className="h-full">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Progress</p>
                  <p className="text-xs text-muted-foreground">View analytics</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Browse Meals Section */}
        <section className="space-y-4 animate-fade-in stagger-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Browse Meals</h2>
            <Button variant="ghost" size="sm" className="text-primary">
              View All <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Filters */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {filters.map((filter) => (
              <Button
                key={filter}
                variant={selectedFilter === filter ? "default" : "secondary"}
                size="sm"
                onClick={() => setSelectedFilter(filter)}
                className="whitespace-nowrap"
              >
                {filter}
              </Button>
            ))}
          </div>

          {/* Meal Cards */}
          <div className="grid gap-4">
            {mockMeals.map((meal) => (
              <Card key={meal.id} variant="interactive">
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center text-4xl">
                      {meal.image}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold truncate">{meal.name}</h3>
                          <p className="text-sm text-muted-foreground">{meal.restaurant}</p>
                        </div>
                        <p className="font-bold text-primary">${meal.price}</p>
                      </div>
                      
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Flame className="w-3 h-3" />
                          {meal.calories} kcal
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {meal.prepTime} min
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-warning text-warning" />
                          {meal.rating}
                        </span>
                      </div>

                      <div className="flex gap-1.5 mt-2">
                        {meal.dietTags.map((tag) => (
                          <Badge key={tag} variant="diet" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-lg border-t border-border z-50">
        <div className="container mx-auto px-4">
          <div className="flex justify-around items-center h-16">
            {[
              { icon: Salad, label: "Home", active: true, to: "/dashboard" },
              { icon: Utensils, label: "Meals", active: false, to: "/meals" },
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

export default Dashboard;
