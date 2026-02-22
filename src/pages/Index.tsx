import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/Logo";
import { formatCurrency } from "@/lib/currency";
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
  Sparkles
} from "lucide-react";
import heroFood from "@/assets/hero-food.jpg";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionPricing {
  basic_price: number;
  premium_price: number;
  family_price: number;
  vip_price: number;
}

interface PlanType {
  id: string;
  name: string;
  price: number;
  period: string;
  mealsPerWeek: number;
  description: string;
  features: string[];
  popular: boolean;
  isVip: boolean;
  icon: typeof Star;
}

const getPlans = (pricing: SubscriptionPricing): PlanType[] => [
  {
    id: "basic",
    name: "Basic",
    price: pricing.basic_price,
    period: "week",
    mealsPerWeek: 5,
    description: "Perfect for getting started with healthy eating",
    icon: Star,
    features: [
      "5 meals per week",
      "Basic nutrition tracking",
      "Email support",
      "Access to 50+ restaurants",
      "Weekly meal planning",
    ],
    popular: false,
    isVip: false,
  },
  {
    id: "standard",
    name: "Standard",
    price: pricing.premium_price,
    period: "week",
    mealsPerWeek: 10,
    description: "Most popular choice for health enthusiasts",
    icon: Zap,
    features: [
      "10 meals per week",
      "Advanced nutrition analytics",
      "Priority support",
      "Access to all restaurants",
      "Custom meal planning",
      "Dietitian consultations",
    ],
    popular: true,
    isVip: false,
  },
  {
    id: "premium",
    name: "Premium",
    price: pricing.family_price,
    period: "week",
    mealsPerWeek: 15,
    description: "Ultimate plan for serious fitness goals",
    icon: Crown,
    features: [
      "15 meals per week",
      "Real-time nutrition coaching",
      "24/7 priority support",
      "All restaurants + premium partners",
      "AI-powered meal recommendations",
      "Family sharing (up to 4)",
    ],
    popular: false,
    isVip: false,
  },
  {
    id: "vip",
    name: "VIP",
    price: pricing.vip_price,
    period: "week",
    mealsPerWeek: 0,
    description: "Unlimited meals for the ultimate experience",
    icon: Sparkles,
    features: [
      "♾️ Unlimited meals per week",
      "Everything in Premium",
      "🚀 Priority delivery (always first)",
      "🌟 Exclusive VIP-only meals",
      "👨‍⚕️ Personal nutrition coach",
      "💎 Dedicated VIP support line",
    ],
    popular: false,
    isVip: true,
  },
];

const Index = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [plans, setPlans] = useState<PlanType[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const { data, error } = await supabase
          .from("platform_settings")
          .select("value")
          .eq("key", "subscription_plans")
          .single();

        if (error) throw error;

        const pricing = (data?.value as unknown as SubscriptionPricing) || {
          basic_price: 49.99,
          premium_price: 99.99,
          family_price: 149.99,
          vip_price: 199.99,
        };

        setPlans(getPlans(pricing));
      } catch (error) {
        console.error("Error fetching pricing:", error);
        // Use default pricing on error
        setPlans(getPlans({
          basic_price: 49.99,
          premium_price: 99.99,
          family_price: 149.99,
          vip_price: 199.99,
        }));
      } finally {
        setLoadingPlans(false);
      }
    };

    fetchPlans();
  }, []);

  const navLinks = [
    { href: "#features", label: "Features" },
    { href: "#how-it-works", label: "How it Works" },
    { href: "#pricing", label: "Pricing" },
    { to: "/faq", label: "FAQ" },
    { to: "/about", label: "About" },
    { to: "/contact", label: "Contact" },
    { to: "/partner/auth", label: "For Restaurants" },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (href.startsWith("#")) {
      e.preventDefault();
      const element = document.querySelector(href);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
        setMobileMenuOpen(false);
      }
    }
  };

  return (
    <div className="min-h-screen gradient-hero">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" onClick={() => setMobileMenuOpen(false)}>
            <Logo size="md" />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">How it Works</a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            <Link to="/faq" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">FAQ</Link>
            <Link to="/about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">About</Link>
            <Link to="/contact" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
            <Link to="/partner/auth" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">For Restaurants</Link>
          </div>

          {/* Desktop CTA Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link to="/onboarding">
              <Button variant="gradient" size="sm">Get Started</Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <Link to="/auth" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" size="sm" className="text-sm">Log in</Button>
            </Link>
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11 touch-manipulation">
                  <Menu className="h-6 w-6" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] sm:w-[320px] p-0">
                <div className="flex flex-col h-full">
                  {/* Mobile Menu Header */}
                  <div className="flex items-center justify-between p-6 border-b border-border">
                    <Link
                      to="/"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      <Logo size="sm" />
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setMobileMenuOpen(false)}
                      className="h-9 w-9 touch-manipulation"
                    >
                      <X className="h-5 w-5" />
                      <span className="sr-only">Close menu</span>
                    </Button>
                  </div>

                  {/* Mobile Menu Links */}
                  <nav className="flex-1 overflow-y-auto py-6 px-4">
                    <div className="space-y-1">
                      {navLinks.map((link) => (
                        link.href ? (
                          <a
                            key={link.label}
                            href={link.href}
                            onClick={(e) => handleNavClick(e, link.href)}
                            className="flex items-center px-4 py-4 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors touch-manipulation min-h-[48px]"
                          >
                            {link.label}
                          </a>
                        ) : (
                          <Link
                            key={link.label}
                            to={link.to!}
                            onClick={() => setMobileMenuOpen(false)}
                            className="flex items-center px-4 py-4 text-base font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors touch-manipulation min-h-[48px]"
                          >
                            {link.label}
                          </Link>
                        )
                      ))}
                    </div>
                  </nav>

                  {/* Mobile Menu Footer CTA */}
                  <div className="p-6 border-t border-border bg-muted/30">
                    <Link
                      to="/onboarding"
                      onClick={() => setMobileMenuOpen(false)}
                      className="block"
                    >
                      <Button variant="gradient" size="lg" className="w-full min-h-[48px]">
                        Get Started
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8 animate-slide-up">
              <Badge variant="soft" className="text-sm">
                <Flame className="w-3 h-3 mr-1" />
                Your personalized nutrition journey starts here
              </Badge>
              
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight">
                Eat Smart,{" "}
                <span className="text-gradient">Live Better</span>
              </h1>
              
              <p className="text-lg text-muted-foreground max-w-lg">
                Personalized meal plans from partner restaurants, tailored to your health goals. 
                Track nutrition, schedule meals, and achieve real results.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/onboarding">
                  <Button variant="hero">
                    Start Your Journey
                    <ArrowRight className="w-5 h-5" />
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button variant="hero-outline">
                    I Have an Account
                  </Button>
                </Link>
              </div>

              <div className="flex items-center gap-6 pt-4">
                <div className="flex -space-x-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div 
                      key={i} 
                      className="w-10 h-10 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium text-muted-foreground"
                    >
                      {i}K
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-warning text-warning" />
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">Trusted by 15,000+ users</p>
                </div>
              </div>
            </div>

            <div className="relative animate-fade-in stagger-2">
              <div className="relative rounded-3xl overflow-hidden shadow-card-hover">
                <img 
                  src={heroFood} 
                  alt="Healthy meals and nutrition" 
                  className="w-full h-auto object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background/60 via-transparent to-transparent" />
              </div>

              {/* Floating Cards */}
              <Card variant="elevated" className="absolute -left-4 bottom-20 max-w-[200px] animate-float">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                      <Target className="w-5 h-5 text-success" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">Daily Goal</p>
                      <p className="text-xs text-muted-foreground">1,850 cal</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card variant="elevated" className="absolute -right-4 top-20 max-w-[180px] animate-float" style={{ animationDelay: "0.5s" }}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold">-5 kg</p>
                      <p className="text-xs text-muted-foreground">This month</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-card/50">
        <div className="container mx-auto">
          <div className="text-center mb-16 animate-fade-in">
            <Badge variant="soft" className="mb-4">Features</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need to{" "}
              <span className="text-gradient">Succeed</span>
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              A complete nutrition management platform designed to help you reach your health goals
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Target,
                title: "Personalized Goals",
                description: "AI-calculated daily targets based on your body metrics and health objectives"
              },
              {
                icon: ChefHat,
                title: "Partner Restaurants",
                description: "Browse curated meals from local restaurants with full nutrition info"
              },
              {
                icon: Calendar,
                title: "Meal Scheduling",
                description: "Plan your breakfast, lunch, and dinner for the entire week ahead"
              },
              {
                icon: TrendingUp,
                title: "Progress Tracking",
                description: "Visualize your journey with detailed charts and analytics"
              },
              {
                icon: Utensils,
                title: "Diet Filters",
                description: "Keto, vegan, low-carb, high-protein — find what fits your lifestyle"
              },
              {
                icon: Users,
                title: "Community Support",
                description: "Connect with others on similar journeys for motivation"
              }
            ].map((feature, index) => (
              <Card 
                key={index} 
                variant="interactive"
                className="animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <Badge variant="soft" className="mb-4">How It Works</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Start in <span className="text-gradient">3 Simple Steps</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Set Your Goals",
                description: "Tell us about yourself and what you want to achieve"
              },
              {
                step: "02",
                title: "Get Your Plan",
                description: "Receive personalized daily calorie and macro targets"
              },
              {
                step: "03",
                title: "Order & Track",
                description: "Browse meals, schedule orders, and track your progress"
              }
            ].map((item, index) => (
              <div 
                key={index}
                className="relative text-center animate-slide-up"
                style={{ animationDelay: `${index * 0.15}s` }}
              >
                <div className="text-6xl font-bold text-primary/10 mb-4">{item.step}</div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
                {index < 2 && (
                  <ArrowRight className="hidden md:block absolute top-8 -right-4 w-8 h-8 text-primary/30" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-4 bg-card/50">
        <div className="container mx-auto">
          <div className="text-center mb-16">
            <Badge variant="soft" className="mb-4">Pricing</Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Plans That <span className="text-gradient">Fit Your Life</span>
            </h2>
          </div>

          {loadingPlans ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
              {plans.map((plan, index) => {
                const Icon = plan.icon;
                return (
                  <Card 
                    key={plan.id}
                    variant={plan.popular || plan.isVip ? "elevated" : "interactive"}
                    className={`animate-scale-in ${plan.popular ? 'border-2 border-primary scale-105 z-10' : plan.isVip ? 'border-2 border-violet-500 shadow-lg shadow-violet-500/20' : ''}`}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <CardContent className="p-6 relative">
                      {plan.popular && (
                        <Badge className="absolute -top-3 right-4">Most Popular</Badge>
                      )}
                      {plan.isVip && (
                        <Badge className="absolute -top-3 right-4 bg-gradient-to-r from-violet-500 to-purple-600">
                          <Sparkles className="w-3 h-3 mr-1" />
                          VIP
                        </Badge>
                      )}
                      
                      <div className="flex items-center gap-2 mb-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${plan.isVip ? 'bg-gradient-to-r from-violet-500 to-purple-600' : 'bg-primary/10'}`}>
                          <Icon className={`w-5 h-5 ${plan.isVip ? 'text-white' : 'text-primary'}`} />
                        </div>
                        <h3 className="text-lg font-bold">{plan.name}</h3>
                      </div>
                      
                      <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>
                      
                      <div className="mb-4">
                        <span className="text-3xl font-bold">{formatCurrency(plan.price)}</span>
                        <span className="text-muted-foreground">/{plan.period}</span>
                      </div>
                      
                      <div className={`mb-4 p-2 rounded-lg ${plan.isVip ? 'bg-violet-500/10' : 'bg-primary/10'}`}>
                        <p className={`text-sm font-medium ${plan.isVip ? 'text-violet-600' : 'text-primary'}`}>
                          {plan.mealsPerWeek === 0 ? "♾️ Unlimited meals" : `🍽️ ${plan.mealsPerWeek} meals/week`}
                        </p>
                      </div>
                      
                      <ul className="space-y-2 mb-6">
                        {plan.features.slice(0, 4).map((feature, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.isVip ? 'text-violet-500' : 'text-success'}`} />
                            <span className="text-muted-foreground">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      
                      <Link to="/subscription" className="block">
                        <Button 
                          variant={plan.popular || plan.isVip ? "gradient" : "outline"} 
                          className={`w-full ${plan.isVip ? 'bg-gradient-to-r from-violet-500 to-purple-600' : ''}`}
                        >
                          {plan.isVip ? 'Go VIP' : 'Get Started'}
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

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <Card variant="elevated" className="gradient-primary p-12 text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
              Ready to Transform Your Health?
            </h2>
            <p className="text-primary-foreground/80 max-w-xl mx-auto mb-8">
              Join thousands of users who have already achieved their health goals with NUTRIO
            </p>
            <Link to="/onboarding">
              <Button 
                size="xl"
                className="bg-background text-primary hover:bg-background/90"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5" />
              </Button>
            </Link>
          </Card>
        </div>
      </section>

      {/* Partner CTA Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Store className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Own a Restaurant?</h3>
                <p className="text-muted-foreground">Partner with us and reach health-conscious customers</p>
              </div>
            </div>
            <Link to="/partner/auth">
              <Button variant="outline" size="lg" className="gap-2">
                Become a Partner
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <Logo size="sm" />
            <div className="flex flex-wrap items-center justify-center gap-6">
              <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                About
              </Link>
              <Link to="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Contact
              </Link>
              <Link to="/partner/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Partner Portal
              </Link>
              <Link to="/faq" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                FAQ
              </Link>
              <Link to="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Terms of Service
              </Link>
              <p className="text-sm text-muted-foreground">
                © 2026 NUTRIO. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
