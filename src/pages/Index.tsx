import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Logo } from "@/components/Logo";
import { formatCurrency } from "@/lib/currency";
import { PromoVideo } from "@/components/PromoVideo";
import { useSubscriptionPlans, type DbSubscriptionPlan } from "@/hooks/useSubscriptionPlans";
import {
  Utensils,
  Target,
  TrendingUp,
  Calendar,
  ChefHat,
  Flame,
  Users,
  ArrowRight,
  Check,
  Star,
  Store,
  Menu,
  X,
  Zap,
  Crown,
  User,
  Sparkles,
  ChevronRight,
  Heart,
  Timer,
  Leaf,
  Dumbbell,
  ChevronLeft,
} from "lucide-react";
import heroFood from "@/assets/Gemini_Generated_Image_j18tosj18tosj18t.png";
import meal1 from "@/assets/1.png";
import meal2 from "@/assets/2.png";
import meal3 from "@/assets/3.png";

const TIER_META: Record<string, { icon: typeof Star; color: string; description: string; popular: boolean; isVip: boolean }> = {
  basic:    { icon: Star,     color: "from-emerald-400 to-teal-500",  description: "Perfect start",   popular: false, isVip: false },
  standard: { icon: Zap,     color: "from-violet-500 to-purple-600",  description: "Most popular",    popular: true,  isVip: false },
  premium:  { icon: Crown,   color: "from-amber-400 to-orange-500",   description: "Serious goals",   popular: false, isVip: false },
  vip:      { icon: Sparkles,color: "from-rose-400 to-pink-500",      description: "Unlimited",       popular: false, isVip: true  },
};

function dbToLandingPlan(p: DbSubscriptionPlan) {
  const meta = TIER_META[p.tier] ?? TIER_META.basic;
  return {
    id: p.id,
    name: p.tier.charAt(0).toUpperCase() + p.tier.slice(1),
    price: p.price_qar ?? 0,
    period: "month",
    mealsPerWeek: p.meals_per_week ?? 0,
    mealsPerMonth: p.meals_per_month ?? 0,
    description: meta.description,
    icon: meta.icon,
    color: meta.color,
    features: Array.isArray(p.features) ? p.features : [],
    popular: meta.popular,
    isVip: meta.isVip,
  };
}

// Story/Highlight data
const stories = [
  { id: 1, emoji: "🥗", label: "Healthy", color: "bg-emerald-100" },
  { id: 2, emoji: "💪", label: "Protein", color: "bg-blue-100" },
  { id: 3, emoji: "🌱", label: "Vegan", color: "bg-green-100" },
  { id: 4, emoji: "🔥", label: "Keto", color: "bg-orange-100" },
  { id: 5, emoji: "⚡", label: "Quick", color: "bg-yellow-100" },
  { id: 6, emoji: "🍰", label: "Low Cal", color: "bg-pink-100" },
];

// Featured meals data
const featuredMeals = [
  {
    id: 1,
    name: "Grilled Salmon Bowl",
    calories: 485,
    protein: "32g",
    time: "15 min",
    rating: 4.9,
    image: meal1,
    tag: "High Protein",
    tagColor: "bg-blue-500",
  },
  {
    id: 2,
    name: "Quinoa Power Salad",
    calories: 320,
    protein: "18g",
    time: "10 min",
    rating: 4.8,
    image: meal2,
    tag: "Vegan",
    tagColor: "bg-green-500",
  },
  {
    id: 3,
    name: "Lean Beef Stir-fry",
    calories: 420,
    protein: "45g",
    time: "20 min",
    rating: 4.9,
    image: meal3,
    tag: "Keto",
    tagColor: "bg-orange-500",
  },
];


const Index = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { plans: dbPlans, loading: loadingPlans } = useSubscriptionPlans();
  const plans = dbPlans.map(dbToLandingPlan);
  const [activeStory, setActiveStory] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Update time for status bar simulation
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);


  // Horizontal scroll handlers
  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      {/* Mobile Status Bar Simulation */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-[60] px-6 py-2 flex justify-between items-center text-xs font-medium text-foreground/80 bg-background/80 backdrop-blur-md safe-area-top">
        <span>{currentTime || "9:41"}</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-sm bg-foreground/20" />
          <div className="w-4 h-4 rounded-sm bg-foreground/20" />
          <div className="w-6 h-3 rounded border border-foreground/30 relative">
            <div className="absolute inset-0.5 right-1 bg-foreground/80 rounded-sm" />
          </div>
        </div>
      </div>

      {/* Header - iOS Style */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-b border-border/30 safe-area-top pt-8 md:pt-0">
        <div className="flex items-center justify-between px-4 py-3 md:py-4 max-w-md mx-auto md:max-w-none md:container md:px-6">
          <Link to="/" className="flex items-center gap-2">
            <Logo size="sm" />
          </Link>
          
          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#meals" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Meals</a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            <Link to="/faq" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">FAQ</Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link to="/auth" className="hidden md:block">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link to="/onboarding" className="hidden md:block">
              <Button variant="gradient" size="sm" className="rounded-full">Get Started</Button>
            </Link>
            
            {/* Mobile Menu */}
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-10 w-10 rounded-full">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:w-[380px] p-0 rounded-t-3xl sm:rounded-none">
                <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
                <div className="flex flex-col h-full bg-background">
                  {/* Sheet Handle */}
                  <div className="flex justify-center pt-3 pb-2">
                    <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
                  </div>
                  
                  <div className="flex items-center justify-between px-6 py-4">
                    <Logo size="sm" />
                    <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)} className="rounded-full">
                      <X className="h-5 w-5" />
                    </Button>
                  </div>

                  <nav className="flex-1 px-6 py-4 space-y-1">
                    {[
                      { label: "Home", to: "/" },
                      { label: "Browse Meals", to: "/meals" },
                      { label: "How it Works", href: "#how-it-works" },
                      { label: "Pricing", href: "#pricing" },
                      { label: "FAQ", to: "/faq" },
                      { label: "Contact", to: "/contact" },
                      { label: "Partner Portal", to: "/partner/auth" },
                    ].map((item) => (
                      item.href ? (
                        <a
                          key={item.label}
                          href={item.href}
                          onClick={(e) => {
                            e.preventDefault();
                            const element = document.querySelector(item.href!);
                            if (element) {
                              element.scrollIntoView({ behavior: "smooth" });
                              setMobileMenuOpen(false);
                            }
                          }}
                          className="flex items-center justify-between py-4 text-lg font-medium border-b border-border/50"
                        >
                          {item.label}
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </a>
                      ) : (
                        <Link
                          key={item.label}
                          to={item.to!}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center justify-between py-4 text-lg font-medium border-b border-border/50"
                        >
                          {item.label}
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </Link>
                      )
                    ))}
                  </nav>

                  <div className="p-6 space-y-3">
                    <Link to="/onboarding" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="gradient" size="lg" className="w-full rounded-2xl h-14 text-base">
                        Get Started Free
                      </Button>
                    </Link>
                    <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" size="lg" className="w-full rounded-2xl h-14 text-base">
                        I Have an Account
                      </Button>
                    </Link>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* Spacer for fixed header */}
      <div className="h-20 md:h-20" />

      {/* Main Content */}
      <main className="pb-32 md:pb-8">
        {/* Hero Section - App Style */}
        <section className="px-4 pt-4 md:pt-8">
          <div className="max-w-md mx-auto md:max-w-none md:container">
            {/* Hero Image - At the Top */}
            <div className="relative mb-6 animate-fade-in">
              <div className="relative rounded-3xl overflow-hidden shadow-2xl shadow-primary/10 bg-gradient-to-br from-primary/5 to-accent/5 p-4">
                <img 
                  src={heroFood} 
                  alt="Healthy meals and nutrition" 
                  className="w-full h-auto object-contain rounded-2xl"
                />
              </div>
              
              {/* Floating Stats Cards */}
              <Card className="absolute -left-2 bottom-4 max-w-[140px] shadow-lg animate-float">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center">
                      <Target className="w-4 h-4 text-success" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold">Daily Goal</p>
                      <p className="text-[10px] text-muted-foreground">1,850 cal</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="absolute -right-2 top-4 max-w-[130px] shadow-lg animate-float" style={{ animationDelay: "0.5s" }}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <TrendingUp className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold">-5 kg</p>
                      <p className="text-[10px] text-muted-foreground">This month</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Welcome Card */}
            <div className="mb-6 animate-slide-up">
              <Badge variant="soft" className="mb-3 rounded-full px-3 py-1">
                <Sparkles className="w-3 h-3 mr-1" />
                #1 Nutrition App in Qatar
              </Badge>
              <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-3">
                Eat Smart,
                <br />
                <span className="text-gradient">Live Better</span>
              </h1>
              <p className="text-muted-foreground text-base md:text-lg max-w-md">
                Personalized meal plans from 50+ partner restaurants, tailored to your health goals.
              </p>
            </div>

            {/* Story/Category Circles - Instagram Style */}
            <div className="mb-8 -mx-4 px-4 overflow-x-auto scrollbar-hide">
              <div className="flex gap-4 pb-2">
                {stories.map((story, index) => (
                  <button
                    key={story.id}
                    onClick={() => setActiveStory(activeStory === story.id ? null : story.id)}
                    className="flex flex-col items-center gap-2 flex-shrink-0 animate-fade-in"
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className={`w-16 h-16 md:w-20 md:h-20 rounded-full ${story.color} flex items-center justify-center text-2xl md:text-3xl border-4 border-background shadow-lg transition-transform active:scale-95 ${activeStory === story.id ? 'ring-2 ring-primary ring-offset-2' : ''}`}>
                      {story.emoji}
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{story.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* CTA Buttons - Native App Style */}
            <div className="flex flex-col sm:flex-row gap-3 mb-8">
              <Link to="/onboarding" className="flex-1">
                <Button 
                  variant="gradient" 
                  size="lg" 
                  className="w-full h-14 rounded-2xl text-base font-semibold shadow-lg shadow-primary/25 active:scale-[0.98] transition-transform"
                >
                  Start Your Journey
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <Link to="/auth" className="flex-1 md:flex-none">
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="w-full md:w-auto h-14 rounded-2xl text-base font-semibold border-2"
                >
                  Sign In
                </Button>
              </Link>
            </div>

          </div>
        </section>

        {/* Featured Meals - Horizontal Scroll (App Store Style) */}
        <section id="meals" className="mb-10">
          <div className="px-4 mb-4 flex items-center justify-between max-w-md mx-auto md:max-w-none md:container">
            <div>
              <h2 className="text-xl font-bold">Featured Meals</h2>
              <p className="text-sm text-muted-foreground">Handpicked for you today</p>
            </div>
            <Link to="/meals" className="text-sm font-medium text-primary flex items-center gap-1">
              See All
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="relative">
            {/* Scroll Buttons - Desktop Only */}
            <button 
              onClick={() => scroll("left")}
              className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-background/90 shadow-lg items-center justify-center hover:bg-background transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={() => scroll("right")}
              className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-background/90 shadow-lg items-center justify-center hover:bg-background transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <div 
              ref={scrollContainerRef}
              className="flex gap-4 overflow-x-auto scrollbar-hide px-4 pb-4 snap-x snap-mandatory md:container md:mx-auto"
            >
              {featuredMeals.map((meal, index) => (
                <Card 
                  key={meal.id}
                  variant="elevated" 
                  className="flex-shrink-0 w-[280px] md:w-[320px] snap-start overflow-hidden group cursor-pointer active:scale-[0.98] transition-transform"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="relative h-40 overflow-hidden">
                    <img 
                      src={meal.image} 
                      alt={meal.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <Badge className={`absolute top-3 left-3 ${meal.tagColor} text-white border-0 rounded-full`}>
                      {meal.tag}
                    </Badge>
                    <button className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/90 flex items-center justify-center shadow-md active:scale-90 transition-transform">
                      <Heart className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-base">{meal.name}</h3>
                      <div className="flex items-center gap-1 text-xs">
                        <Star className="w-3 h-3 fill-warning text-warning" />
                        {meal.rating}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5" />
                        {meal.calories} cal
                      </span>
                      <span className="flex items-center gap-1">
                        <Dumbbell className="w-3.5 h-3.5" />
                        {meal.protein}
                      </span>
                      <span className="flex items-center gap-1">
                        <Timer className="w-3.5 h-3.5" />
                        {meal.time}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Features Grid - App Style Cards */}
        <section id="features" className="px-4 mb-10 max-w-md mx-auto md:max-w-none md:container">
          <div className="mb-4">
            <h2 className="text-xl font-bold">Why Choose Us</h2>
            <p className="text-sm text-muted-foreground">Everything you need to succeed</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { icon: Target, title: "Smart Goals", desc: "AI-powered targets", color: "bg-blue-500" },
              { icon: ChefHat, title: "Top Restaurants", desc: "50+ partners", color: "bg-orange-500" },
              { icon: Calendar, title: "Easy Planning", desc: "Schedule ahead", color: "bg-purple-500" },
              { icon: TrendingUp, title: "Track Progress", desc: "Visual analytics", color: "bg-green-500" },
              { icon: Leaf, title: "Diet Options", desc: "All lifestyles", color: "bg-emerald-500" },
              { icon: Users, title: "Community", desc: "Get support", color: "bg-pink-500" },
            ].map((feature, index) => (
              <Card 
                key={index} 
                variant="elevated"
                className="p-4 active:scale-[0.98] transition-transform cursor-pointer"
              >
                <div className={`w-10 h-10 rounded-xl ${feature.color} flex items-center justify-center mb-3`}>
                  <feature.icon className="w-5 h-5 text-white" />
                </div>
                <h3 className="font-semibold text-sm mb-0.5">{feature.title}</h3>
                <p className="text-xs text-muted-foreground">{feature.desc}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* How It Works - Step Cards */}
        <section id="how-it-works" className="px-4 mb-10 max-w-md mx-auto md:max-w-none md:container">
          <div className="mb-4">
            <h2 className="text-xl font-bold">How It Works</h2>
            <p className="text-sm text-muted-foreground">Get started in 3 simple steps</p>
          </div>

          <div className="space-y-3">
            {[
              { step: "01", title: "Set Your Goals", desc: "Tell us about your body and objectives", icon: Target, color: "from-blue-500 to-cyan-500" },
              { step: "02", title: "Get Your Plan", desc: "Receive personalized nutrition targets", icon: Sparkles, color: "from-violet-500 to-purple-500" },
              { step: "03", title: "Order & Track", desc: "Browse meals and monitor progress", icon: TrendingUp, color: "from-emerald-500 to-teal-500" },
            ].map((item, index) => (
              <Card key={index} variant="elevated" className="overflow-hidden">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                    <item.icon className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-primary">Step {item.step}</span>
                    </div>
                    <h3 className="font-semibold text-base mb-0.5">{item.title}</h3>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Pricing - Horizontal Scroll Cards */}
        <section id="pricing" className="mb-10">
          <div className="px-4 mb-4 max-w-md mx-auto md:max-w-none md:container">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Choose Your Plan</h2>
                <p className="text-sm text-muted-foreground">Flexible options for every lifestyle</p>
              </div>
            </div>
          </div>

          {loadingPlans ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto scrollbar-hide px-4 pb-4 snap-x snap-mandatory md:container md:mx-auto md:grid md:grid-cols-4 md:gap-4">
              {plans.map((plan, index) => {
                const Icon = plan.icon;
                return (
                  <Card 
                    key={plan.id}
                    variant={plan.popular ? "elevated" : "default"}
                    className={`flex-shrink-0 w-[260px] snap-start overflow-hidden ${plan.popular ? 'ring-2 ring-primary ring-offset-2' : ''} md:w-auto active:scale-[0.98] transition-transform cursor-pointer`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <div className={`h-2 bg-gradient-to-r ${plan.color}`} />
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center shadow-md`}>
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-base">{plan.name}</h3>
                          {plan.popular && (
                            <Badge className="rounded-full text-[10px] px-2 py-0 h-4">Popular</Badge>
                          )}
                        </div>
                      </div>

                      <div className="mb-3">
                        <span className="text-2xl font-bold">{formatCurrency(plan.price)}</span>
                        <span className="text-sm text-muted-foreground">/{plan.period}</span>
                      </div>

                      <p className="text-xs text-muted-foreground mb-3">{plan.description}</p>

                      <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-gradient-to-r ${plan.color} text-white mb-3`}>
                        <Utensils className="w-3 h-3" />
                        {plan.mealsPerWeek === 0 ? "Unlimited" : `${plan.mealsPerWeek} meals/week`}
                      </div>

                      <ul className="space-y-2 mb-4">
                        {plan.features.slice(0, 3).map((feature, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs">
                            <Check className="w-3.5 h-3.5 shrink-0 text-success mt-0.5" />
                            <span className="text-muted-foreground">{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <Link to="/subscription" className="block">
                        <Button 
                          variant={plan.popular ? "gradient" : "outline"} 
                          size="sm"
                          className={`w-full rounded-xl ${plan.popular ? '' : 'border-2'}`}
                        >
                          {plan.popular ? 'Get Started' : 'Choose Plan'}
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Partner CTA - App Style Banner */}
        <section className="px-4 mb-10 max-w-md mx-auto md:max-w-none md:container">
          <Card className="overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10 border-primary/20">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg flex-shrink-0">
                <Store className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-base mb-1">Own a Restaurant?</h3>
                <p className="text-xs text-muted-foreground line-clamp-2">Partner with us and reach thousands of health-conscious customers in Qatar.</p>
              </div>
              <Link to="/partner/auth">
                <Button variant="gradient" size="sm" className="rounded-xl flex-shrink-0">
                  Join
                </Button>
              </Link>
            </CardContent>
          </Card>
        </section>

        {/* Footer - Minimal */}
        <footer className="px-4 max-w-md mx-auto md:max-w-none md:container">
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground mb-4">
            <Link to="/about" className="hover:text-foreground transition-colors">About</Link>
            <Link to="/contact" className="hover:text-foreground transition-colors">Contact</Link>
            <Link to="/faq" className="hover:text-foreground transition-colors">FAQ</Link>
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            © 2026 NUTRIO. All rights reserved.
          </p>
        </footer>
      </main>


      {/* Floating Action Button - Mobile Only */}
      <div className="md:hidden fixed bottom-24 right-4 z-40">
        <Link to="/onboarding">
          <Button 
            size="icon" 
            className="w-14 h-14 rounded-full shadow-lg shadow-primary/30 gradient-primary hover:scale-105 active:scale-95 transition-transform"
          >
            <ArrowRight className="w-6 h-6" />
          </Button>
        </Link>
      </div>

      {/* Promo Video Modal */}
      <PromoVideo />

      {/* Hide scrollbar for horizontal scrolls */}
      <style>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .safe-area-top {
          padding-top: max(env(safe-area-inset-top), 8px);
        }
        .safe-area-bottom {
          padding-bottom: max(env(safe-area-inset-bottom), 8px);
        }
      `}</style>
    </div>
  );
};

export default Index;
