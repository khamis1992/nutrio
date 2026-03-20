import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/contexts/AuthContext";
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

import { useLanguage } from "@/contexts/LanguageContext";

const TIER_META: Record<string, { icon: typeof Star; color: string; description: string; popular: boolean; isVip: boolean }> = {
  basic:    { icon: Star,     color: "from-emerald-700 to-teal-600",  description: "perfect_start",   popular: false, isVip: false },
  standard: { icon: Zap,     color: "from-orange-600 to-amber-500",  description: "most_popular",    popular: true,  isVip: false },
  premium:  { icon: Crown,   color: "from-amber-600 to-orange-500",   description: "serious_goals",   popular: false, isVip: false },
  vip:      { icon: Sparkles,color: "from-rose-600 to-pink-500",      description: "unlimited_desc",       popular: false, isVip: true  },
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

const getStories = (t: (key: string) => string) => [
  { id: 1, emoji: "🥗", label: t("category_healthy"), color: "bg-emerald-700" },
  { id: 2, emoji: "💪", label: t("category_protein"), color: "bg-stone-700" },
  { id: 3, emoji: "🌱", label: t("category_vegan"), color: "bg-forest-700" },
  { id: 4, emoji: "🔥", label: t("category_keto"), color: "bg-orange-700" },
  { id: 5, emoji: "⚡", label: t("category_quick"), color: "bg-amber-700" },
  { id: 6, emoji: "🍰", label: t("category_low_cal"), color: "bg-rose-700" },
];

const getFeaturedMeals = (_t: (key: string) => string) => [
  {
    id: 1,
    nameKey: "meal_salmon_bowl",
    calories: 485,
    protein: "32g",
    timeKey: "time_15_min",
    rating: 4.9,
    image: meal1,
    tagKey: "high_protein",
    tagColor: "bg-orange-700",
  },
  {
    id: 2,
    nameKey: "meal_quinoa_salad",
    calories: 320,
    protein: "18g",
    timeKey: "time_10_min",
    rating: 4.8,
    image: meal2,
    tagKey: "vegan",
    tagColor: "bg-forest-700",
  },
  {
    id: 3,
    nameKey: "meal_beef_stirfry",
    calories: 420,
    protein: "45g",
    timeKey: "time_20_min",
    rating: 4.9,
    image: meal3,
    tagKey: "keto",
    tagColor: "bg-orange-700",
  },
];

const Index = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const isNative =
      Capacitor.isNativePlatform() ||
      (window.location.hostname === "localhost" &&
        window.location.protocol === "https:" &&
        !window.location.port);

    if (isNative && !authLoading) {
      navigate(user ? "/dashboard" : "/walkthrough", { replace: true });
    }
  }, [authLoading, user, navigate]);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { plans: dbPlans, loading: loadingPlans } = useSubscriptionPlans();
  const plans = dbPlans.map(dbToLandingPlan);
  const [activeStory, setActiveStory] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { t } = useLanguage();

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }));
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
    <div className="min-h-screen bg-[#FAF7F2] text-[#2C2416]">
      {/* Custom Styles for Warm Organic Luxury */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
        
        .organic-blob {
          background: radial-gradient(circle at 30% 70%, rgba(196, 112, 75, 0.1) 0%, transparent 50%);
        }
        
        .organic-blob-reverse {
          background: radial-gradient(circle at 70% 30%, rgba(45, 90, 61, 0.1) 0%, transparent 50%);
        }
        
        .text-foreground-strong {
          color: #2C2416;
        }
        
        .text-foreground-muted {
          color: #5C4E3F;
        }
        
        .bg-forest-700 {
          background-color: #2D5A3D;
        }
        
        .shadow-terracotta {
          box-shadow: 0 10px 25px -5px rgba(196, 112, 75, 0.2), 0 8px 10px -6px rgba(196, 112, 75, 0.1);
        }
        
        .shadow-forest {
          box-shadow: 0 10px 25px -5px rgba(45, 90, 61, 0.2), 0 8px 10px -6px rgba(45, 90, 61, 0.1);
        }
        
        .shadow-stone {
          box-shadow: 0 10px 25px -5px rgba(120, 113, 108, 0.2), 0 8px 10px -6px rgba(120, 113, 108, 0.1);
        }
        
        .border-warm {
          border-color: rgba(196, 112, 75, 0.2);
        }
        
        .hover-lift {
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .hover-lift:hover {
          transform: translateY(-4px);
        }
        
        .gradient-terracotta {
          background: linear-gradient(135deg, #C4704B 0%, #B85C3E 100%);
        }
        
        .gradient-forest {
          background: linear-gradient(135deg, #2D5A3D 0%, #1F3D2A 100%);
        }
        
        .gradient-amber {
          background: linear-gradient(135deg, #A9752A 0%, #D4A853 100%);
        }
        
        .gradient-stone {
          background: linear-gradient(135deg, #78716C 0%, #57534E 100%);
        }
        
        .reveal-on-scroll {
          opacity: 0;
          transform: translateY(20px);
          transition: opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .reveal-on-scroll.revealed {
          opacity: 1;
          transform: translateY(0);
        }
        
        .stagger-delay-1 { transition-delay: 0.1s; }
        .stagger-delay-2 { transition-delay: 0.2s; }
        .stagger-delay-3 { transition-delay: 0.3s; }
        
        @keyframes organic-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(1deg); }
        }
        
        .animate-organic-float {
          animation: organic-float 6s ease-in-out infinite;
        }
        
        @keyframes organic-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
        
        .animate-organic-pulse {
          animation: organic-pulse 4s ease-in-out infinite;
        }
        
        .font-display {
          font-family: 'DM Serif Display', serif;
        }
        
        .text-gradient-terracotta {
          background: linear-gradient(135deg, #C4704B 0%, #A9752A 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .text-gradient-forest {
          background: linear-gradient(135deg, #2D5A3D 0%, #1F3D2A 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}</style>

      {/* Enhanced Status Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-[60] px-6 py-2 flex justify-between items-center text-xs font-medium text-foreground-strong/80 bg-[#FAF7F2]/80 backdrop-blur-md safe-area-top">
        <span className="font-medium">{currentTime || "9:41"}</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded-sm bg-stone-400/30" />
          <div className="w-4 h-4 rounded-sm bg-stone-400/30" />
          <div className="w-6 h-3 rounded border border-stone-400/30 relative">
            <div className="absolute inset-0.5 right-1 bg-stone-600 rounded-sm" />
          </div>
        </div>
      </div>

      {/* Navigation - Warm Organic Style */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 safe-area-top pt-8 md:pt-0 ${scrolled ? 'bg-[#FAF7F2]/95 backdrop-blur-2xl border-b border-warm' : 'bg-[#FAF7F2]/80 backdrop-blur-xl border-b border-warm/30'}`}>
        <div className="flex items-center justify-between px-4 py-4 max-w-md mx-auto md:max-w-none md:container md:px-8">
          <Link to="/" className="flex items-center gap-3 group">
            <Logo size="md" />
            <span className="text-xl font-display font-bold text-foreground-strong">Nutrio</span>
          </Link>
          
          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-forest-700 hover:text-terracotta transition-colors">Features</a>
            <a href="#meals" className="text-sm font-medium text-forest-700 hover:text-terracotta transition-colors">Meals</a>
            <a href="#pricing" className="text-sm font-medium text-forest-700 hover:text-terracotta transition-colors">Pricing</a>
            <Link to="/faq" className="text-sm font-medium text-forest-700 hover:text-terracotta transition-colors">FAQ</Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link to="/auth" className="hidden md:block">
              <Button variant="ghost" className="text-forest-700 font-medium hover:text-terracotta">Sign In</Button>
            </Link>
            <Link to="/onboarding" className="hidden md:block">
              <Button className="gradient-terracotta text-white font-semibold rounded-full hover-lift px-6 shadow-terracotta">Get Started</Button>
            </Link>
            
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden h-11 w-11 rounded-full bg-white/80 shadow-stone hover:bg-white">
                  <Menu className="h-5 w-5 text-forest-700" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:w-[420px] p-0 rounded-t-3xl sm:rounded-none bg-[#FAF7F2]">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="flex flex-col h-full">
                  <div className="flex justify-center pt-3 pb-2">
                    <div className="w-10 h-1 rounded-full bg-stone-400/30" />
                  </div>
                  
                  <div className="flex items-center justify-between px-6 py-6 border-b border-warm/30">
                    <div className="flex items-center gap-3">
                      <Logo size="sm" />
                      <span className="text-lg font-display font-bold text-foreground-strong">Nutrio</span>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)} className="rounded-full bg-white/80 shadow-stone">
                      <X className="h-5 w-5 text-forest-700" />
                    </Button>
                  </div>

                  <nav className="flex-1 px-6 py-6 space-y-2">
                    {[
                      { label: "Home", to: "/" },
                      { label: "Browse Meals", to: "/meals" },
                      { label: "How It Works", href: "#how-it-works" },
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
                          className="flex items-center justify-between py-4 text-lg font-medium border-b border-warm/20 text-forest-700 hover:text-terracotta transition-colors"
                        >
                          {item.label}
                          <ChevronRight className="h-5 w-5 text-stone-400" />
                        </a>
                      ) : (
                        <Link
                          key={item.label}
                          to={item.to!}
                          onClick={() => setMobileMenuOpen(false)}
                          className="flex items-center justify-between py-4 text-lg font-medium border-b border-warm/20 text-forest-700 hover:text-terracotta transition-colors"
                        >
                          {item.label}
                          <ChevronRight className="h-5 w-5 text-stone-400" />
                        </Link>
                      )
                    ))}
                  </nav>

                  <div className="p-6 space-y-3 bg-gradient-to-t from-white/50 to-transparent">
                    <Link to="/onboarding" onClick={() => setMobileMenuOpen(false)}>
                      <Button className="w-full rounded-2xl h-14 text-base font-semibold gradient-terracotta text-white shadow-terracotta hover-lift">
                        Start Your Journey
                      </Button>
                    </Link>
                    <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
                      <Button variant="outline" className="w-full rounded-2xl h-14 text-base font-semibold border-2 border-stone-300 text-forest-700 hover:bg-stone-100">
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

      <div className="h-24 lg:h-28" />

      {/* Hero Section - Asymmetric Luxury Layout */}
      <main className="pb-32 lg:pb-8">
        <section className="px-4 pt-4 lg:pt-8 reveal-on-scroll stagger-delay-1">
          <div className="max-w-md mx-auto lg:max-w-none lg:container lg:px-8">
            <div className="relative lg:grid lg:grid-cols-12 lg:gap-8 lg:items-center">
              {/* Hero Image - Left Side, Large */}
              <div className="lg:col-span-7 lg:order-1 mb-8 lg:mb-0">
                <div className="relative">
                  <div className="organic-blob absolute inset-0 rounded-3xl animate-organic-pulse" />
                  <div className="relative rounded-3xl overflow-hidden shadow-terracotta group">
                    <img 
                      src={heroFood} 
                      alt="Healthy meals and nutrition" 
                      className="w-full h-[400px] lg:h-[600px] object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
                  </div>
                  
                  {/* Floating Achievement Cards with Organic Luxury Style */}
                  <Card className="absolute -right-6 top-1/3 max-w-[180px] shadow-terracotta reveal-on-scroll stagger-delay-2 hover-lift bg-white/95 backdrop-blur-sm border-warm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                          <Target className="w-5 h-5 text-orange-700" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-forest-700">Daily Goal</p>
                          <p className="text-xs text-stone-600">1,850 Calories</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="absolute -left-6 bottom-1/4 max-w-[170px] shadow-forest reveal-on-scroll stagger-delay-3 hover-lift bg-white/95 backdrop-blur-sm border-stone-200">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-forest-700/10 flex items-center justify-center">
                          <TrendingUp className="w-5 h-5 text-forest-700" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-forest-700">-5 kg</p>
                          <p className="text-xs text-stone-600">This month</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
              
              {/* Hero Content - Right Side, Overlapping */}
              <div className="lg:col-span-5 lg:order-2 lg:-ml-16 relative z-10">
                <div className="bg-[#FAF7F2]/95 backdrop-blur-md rounded-3xl p-6 lg:p-10 shadow-stone border border-stone-200">
                  {/* Premium Badge */}
                  <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-2 rounded-full mb-6">
                    <Sparkles className="w-4 h-4 text-orange-700" />
                    <span className="text-sm font-semibold">#1 Nutrition Platform in Qatar</span>
                  </div>
                  
                  {/* Headline with Serif Display */}
                  <h1 className="text-4xl lg:text-6xl font-display font-bold leading-tight mb-6">
                    <span className="text-forest-700">Eat Smart,</span><br/>
                    <span className="text-gradient-terracotta">Live Better</span>
                  </h1>
                  
                  <p className="text-lg text-stone-700 mb-8 leading-relaxed max-w-lg">
                    Personalized meal plans from Qatar's finest restaurants, crafted for your health journey with premium ingredients and expert nutrition guidance.
                  </p>
                  
                  {/* Category Pills - Organic Style */}
                  <div className="flex flex-wrap gap-3 mb-8">
                    {getStories(t).map((story) => (
                      <button
                        key={story.id}
                        onClick={() => setActiveStory(activeStory === story.id ? null : story.id)}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all hover-lift ${activeStory === story.id ? 'bg-forest-700 text-white shadow-forest' : 'bg-white/80 text-forest-700 border border-stone-300 shadow-stone'}`}
                      >
                        <span className="text-lg">{story.emoji}</span>
                        <span>{story.label}</span>
                      </button>
                    ))}
                  </div>
                  
                  {/* CTA Buttons - Luxury Style */}
                  <div className="flex flex-col sm:flex-row gap-4">
                    <Link to="/onboarding" className="flex-1">
                      <Button className="w-full h-14 rounded-2xl text-lg font-semibold gradient-terracotta text-white hover-lift shadow-terracotta">
                        Start Your Journey
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>
                    </Link>
                    <Link to="/auth" className="flex-1">
                      <Button variant="outline" className="w-full h-14 rounded-2xl text-lg font-semibold border-2 border-stone-300 text-forest-700 hover:bg-stone-100 hover-lift">
                        Sign In
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Meals - Editorial Grid */}
        <section id="meals" className="mb-16 lg:mb-20 reveal-on-scroll stagger-delay-2">
          <div className="px-4 mb-8 max-w-md mx-auto lg:max-w-none lg:container lg:px-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-3xl lg:text-4xl font-display font-bold text-forest-700 mb-2">Featured Meals</h2>
                <p className="text-lg text-stone-700">Handpicked by our nutritionists for you today</p>
              </div>
              <Link to="/meals" className="text-foreest-700 font-medium hover:text-orange-700 transition-colors flex items-center gap-2">
                View All
                <ChevronRight className="w-5 h-5" />
              </Link>
            </div>

            <div className="relative">
              <button 
                onClick={() => scroll("left")}
                className="hidden lg:flex absolute -left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white shadow-stone items-center justify-center hover:bg-stone-50 transition-colors hover-lift"
              >
                <ChevronLeft className="w-5 h-5 text-stone-600" />
              </button>
              <button 
                onClick={() => scroll("right")}
                className="hidden lg:flex absolute -right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white shadow-stone items-center justify-center hover:bg-stone-50 transition-colors hover-lift"
              >
                <ChevronRight className="w-5 h-5 text-stone-600" />
              </button>

              <div 
                ref={scrollContainerRef}
                className="flex gap-6 overflow-x-auto scrollbar-hide lg:grid lg:grid-cols-3 lg:gap-8"
              >
                {getFeaturedMeals(t).map((meal) => (
                  <Card 
                    key={meal.id}
                    className="flex-shrink-0 w-[320px] lg:w-auto overflow-hidden group hover-lift bg-white border border-stone-200 shadow-stone"
                  >
                    <div className="relative h-56 lg:h-64 overflow-hidden">
                      <img 
                        src={meal.image} 
                        alt={t(meal.nameKey)}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                      <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-semibold text-white shadow-lg ${meal.tagColor}`}>
                        {t(meal.tagKey)}
                      </div>
                      <button className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-md hover:scale-110 transition-transform">
                        <Heart className="w-4 h-4 text-stone-600 hover:text-orange-700" />
                      </button>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <h3 className="text-xl font-semibold font-display text-forest-700">{t(meal.nameKey)}</h3>
                        <div className="flex items-center gap-1 text-sm text-stone-700">
                          <Star className="w-4 h-4 fill-orange-500 text-orange-500" />
                          {meal.rating}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm text-stone-700">
                        <div className="flex items-center gap-6">
                          <span className="flex items-center gap-2">
                            <Flame className="w-4 h-4 text-orange-700" />
                            {meal.calories} cal
                          </span>
                          <span className="flex items-center gap-2">
                            <Dumbbell className="w-4 h-4 text-forest-700" />
                            {meal.protein}
                          </span>
                        </div>
                        <span className="flex items-center gap-2">
                          <Timer className="w-4 h-4 text-stone-600" />
                          15 min
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Features - Editorial Magazine Grid */}
        <section id="features" className="mb-16 lg:mb-20 reveal-on-scroll stagger-delay-3">
          <div className="px-4 max-w-md mx-auto lg:max-w-none lg:container lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-5xl font-display font-bold text-forest-700 mb-4">Crafted for Excellence</h2>
              <p className="text-xl text-stone-700 max-w-3xl mx-auto">Every detail designed to elevate your healthy lifestyle journey</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[
                { 
                  icon: Target, 
                  title: "Precision Nutrition", 
                  desc: "AI-powered targets calibrated to your unique biochemistry and lifestyle goals", 
                  color: "bg-orange-100",
                  iconColor: "text-orange-700"
                },
                { 
                  icon: ChefHat, 
                  title: "Culinary Partners", 
                  desc: "50+ of Qatar's finest restaurants crafting meals that nourish and delight", 
                  color: "bg-amber-100",
                  iconColor: "text-amber-700"
                },
                { 
                  icon: Calendar, 
                  title: "Intelligent Planning", 
                  desc: "Schedule weeks ahead with flexible delivery that adapts to your lifestyle", 
                  color: "bg-green-100",
                  iconColor: "text-green-700"
                },
                { 
                  icon: TrendingUp, 
                  title: "Visual Progress", 
                  desc: "Track your journey with elegant analytics that celebrate every milestone", 
                  color: "bg-blue-100",
                  iconColor: "text-blue-700"
                },
                { 
                  icon: Leaf, 
                  title: "Diverse Lifestyles", 
                  desc: "Keto, vegan, high-protein, and more — all crafted with premium ingredients", 
                  color: "bg-emerald-100",
                  iconColor: "text-emerald-700"
                },
                { 
                  icon: Users, 
                  title: "Expert Support", 
                  desc: "Nutritionists and wellness coaches ready to guide your transformation", 
                  color: "bg-rose-100",
                  iconColor: "text-rose-700"
                },
              ].map((feature, index) => (
                <Card 
                  key={index} 
                  className="p-8 hover-lift bg-white border border-stone-200 shadow-stone group"
                >
                  <div className={`w-16 h-16 rounded-2xl ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    <feature.icon className={`w-8 h-8 ${feature.iconColor}`} />
                  </div>
                  <h3 className="text-2xl font-display font-semibold text-forest-700 mb-3">{feature.title}</h3>
                  <p className="text-stone-700 leading-relaxed">{feature.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works - Organic Flow */}
        <section id="how-it-works" className="mb-16 lg:mb-20 reveal-on-scroll stagger-delay-1">
          <div className="px-4 max-w-md mx-auto lg:max-w-none lg:container lg:px-8">
            <div className="organic-blob rounded-3xl p-8 lg:p-12">
              <div className="text-center mb-12">
                <h2 className="text-3xl lg:text-5xl font-display font-bold text-forest-700 mb-4">Your Journey to Wellness</h2>
                <p className="text-xl text-stone-700">Three simple steps to transform your relationship with food</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
                {[
                  { 
                    step: "01", 
                    title: "Discover Your Goals", 
                    desc: "Share your wellness vision, dietary preferences, and lifestyle. Our nutritionists craft your personalized roadmap.", 
                    icon: Target, 
                    color: "from-orange-600 to-amber-500",
                    accent: "border-orange-600"
                  },
                  { 
                    step: "02", 
                    title: "Receive Your Blueprint", 
                    desc: "Get your custom nutrition plan with precise macro targets and curated meal selections from Qatar's best kitchens.", 
                    icon: Sparkles, 
                    color: "from-forest-700 to-emerald-600",
                    accent: "border-forest-700"
                  },
                  { 
                    step: "03", 
                    title: "Nourish & Flourish", 
                    desc: "Order with confidence, track your progress, and watch your transformation unfold with elegant visual insights.", 
                    icon: TrendingUp, 
                    color: "from-amber-600 to-orange-500",
                    accent: "border-amber-600"
                  },
                ].map((item, index) => (
                  <Card key={index} className={`p-8 hover-lift bg-white border-2 ${item.accent} shadow-stone relative overflow-hidden`}>
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-stone-50 to-transparent rounded-bl-full" />
                    <div className="relative">
                      <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${item.color} flex items-center justify-center mb-6 shadow-lg`}>
                        <item.icon className="w-8 h-8 text-white" />
                      </div>
                      <div className="text-4xl font-display font-bold text-stone-300 mb-2">{item.step}</div>
                      <h3 className="text-2xl font-display font-semibold text-forest-700 mb-4">{item.title}</h3>
                      <p className="text-stone-700 leading-relaxed">{item.desc}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Pricing - Warm Organic Cards */}
        <section id="pricing" className="mb-16 lg:mb-20 reveal-on-scroll stagger-delay-2">
          <div className="px-4 max-w-md mx-auto lg:max-w-none lg:container lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl lg:text-5xl font-display font-bold text-forest-700 mb-4">Choose Your Wellness Plan</h2>
              <p className="text-xl text-stone-700">Flexible options designed for every lifestyle and goal</p>
            </div>

            {loadingPlans ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-600"></div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
                {plans.map((plan) => {
                  const Icon = plan.icon;
                  return (
                    <Card 
                      key={plan.id}
                      className={`overflow-hidden hover-lift bg-white border border-stone-200 shadow-stone relative ${plan.popular ? 'md:scale-105 md:z-10' : ''}`}
                    >
                      {plan.popular && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-600 to-amber-500" />
                      )}
                      <CardContent className="p-8">
                        <div className="flex items-center gap-4 mb-6">
                          <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center shadow-md`}>
                            <Icon className="w-6 h-6 text-white" />
                          </div>
                          <div>
                            <h3 className="text-2xl font-display font-semibold text-forest-700">{plan.name}</h3>
                            {plan.popular && (
                              <Badge className="bg-orange-100 text-orange-700 text-xs mt-1">Most Popular</Badge>
                            )}
                          </div>
                        </div>

                        <div className="mb-6">
                          <span className="text-3xl font-bold text-forest-700">{formatCurrency(plan.price)}</span>
                          <span className="text-stone-600">/week</span>
                        </div>

                        <p className="text-stone-700 mb-6 leading-relaxed">{t(plan.description)}</p>

                        <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gradient-to-br ${plan.color} text-white mb-6`}>
                          <Utensils className="w-4 h-4" />
                          {plan.mealsPerWeek === 0 ? "Unlimited" : `${plan.mealsPerWeek} meals/week`}
                        </div>

                        <ul className="space-y-3 mb-8">
                          {plan.features.slice(0, 4).map((feature, i) => (
                            <li key={i} className="flex items-start gap-3 text-sm text-stone-700">
                              <Check className="w-5 h-5 shrink-0 text-orange-600 mt-0.5" />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>

                        <Link to="/subscription" className="block">
                          <Button 
                            className={`w-full rounded-xl h-12 font-semibold ${plan.popular ? 'gradient-terracotta text-white shadow-terracotta' : 'border-2 border-stone-300 text-forest-700 hover:bg-stone-100'}`}
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
          </div>
        </section>

        {/* Restaurant Partner CTA - Warm Organic */}
        <section className="mb-16 lg:mb-20 reveal-on-scroll stagger-delay-3">
          <div className="px-4 max-w-md mx-auto lg:max-w-none lg:container lg:px-8">
            <Card className="overflow-hidden bg-gradient-to-br from-orange-50 via-[#FAF7F2] to-green-50 border-orange-200">
              <CardContent className="p-8 lg:p-12 flex flex-col lg:flex-row items-center gap-8">
                <div className="lg:flex-1 text-center lg:text-left">
                  <div className="w-20 h-20 rounded-2xl gradient-terracotta flex items-center justify-center shadow-terracotta mb-6 lg:mb-0 lg:absolute lg:-left-10">
                    <Store className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-3xl lg:text-4xl font-display font-bold text-forest-700 mb-4 lg:pl-16">Own a Restaurant?</h3>
                  <p className="text-xl text-stone-700 lg:pl-16 mb-6 lg:mb-0">Partner with Qatar's leading nutrition platform and reach thousands of health-conscious customers who value quality ingredients and exceptional taste.</p>
                </div>
                <Link to="/partner/auth">
                  <Button className="gradient-terracotta text-white font-semibold rounded-xl px-8 h-14 hover-lift shadow-terracotta whitespace-nowrap">
                    Join Our Network
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Footer - Minimal Luxury */}
        <footer className="px-4 max-w-md mx-auto lg:max-w-none lg:container lg:px-8">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm text-stone-600 mb-8">
            <Link to="/about" className="hover:text-forest-700 transition-colors font-medium">About</Link>
            <Link to="/contact" className="hover:text-forest-700 transition-colors font-medium">Contact</Link>
            <Link to="/faq" className="hover:text-forest-700 transition-colors font-medium">FAQ</Link>
            <Link to="/privacy" className="hover:text-forest-700 transition-colors font-medium">Privacy</Link>
            <Link to="/terms" className="hover:text-forest-700 transition-colors font-medium">Terms</Link>
          </div>
          <p className="text-center text-sm text-stone-600">
            © 2026 NUTRIO. Crafted with care for Qatar's wellness community.
          </p>
        </footer>
      </main>

      {/* Floating Action Button */}
      <div className="lg:hidden fixed bottom-8 right-4 z-40">
        <Link to="/onboarding">
          <Button className="w-16 h-16 rounded-full gradient-terracotta text-white hover-lift shadow-terracotta">
            <ArrowRight className="w-7 h-7" />
          </Button>
        </Link>
      </div>

      <PromoVideo />

      {/* Scroll Reveal Script */}
      <script dangerouslySetInnerHTML={{
        __html: `
          function initScrollReveal() {
            const revealElements = document.querySelectorAll('.reveal-on-scroll');
            
            const observer = new IntersectionObserver((entries) => {
              entries.forEach(entry => {
                if (entry.isIntersecting) {
                  entry.target.classList.add('revealed');
                }
              });
            }, {
              threshold: 0.1,
              rootMargin: '0px 0px -50px 0px'
            });
            
            revealElements.forEach(el => observer.observe(el));
          }
          
          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initScrollReveal);
          } else {
            initScrollReveal();
          }
        `
      }} />
    </div>
  );
};

export default Index;