import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Logo } from "@/components/Logo";
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
  X
} from "lucide-react";
import heroFood from "@/assets/hero-food.jpg";

const Index = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {/* Weekly Plan */}
            <Card variant="interactive" className="animate-scale-in">
              <CardContent className="p-8">
                <h3 className="text-xl font-bold mb-2">Weekly Plan</h3>
                <p className="text-muted-foreground text-sm mb-6">Perfect for trying out</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold">106</span>
                  <span className="text-muted-foreground"> QAR/week</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {[
                    "Personalized meal plan",
                    "Access to all partner restaurants",
                    "Basic nutrition tracking",
                    "Email support"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-success" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button variant="outline" className="w-full">Choose Weekly</Button>
              </CardContent>
            </Card>

            {/* Monthly Plan */}
            <Card variant="elevated" className="border-2 border-primary animate-scale-in stagger-1">
              <CardContent className="p-8 relative">
                <Badge className="absolute -top-3 right-6">Most Popular</Badge>
                <h3 className="text-xl font-bold mb-2">Monthly Plan</h3>
                <p className="text-muted-foreground text-sm mb-6">Best value for results</p>
                <div className="mb-6">
                  <span className="text-4xl font-bold">324</span>
                  <span className="text-muted-foreground"> QAR/month</span>
                  <Badge variant="success" className="ml-2">Save 23%</Badge>
                </div>
                <ul className="space-y-3 mb-8">
                  {[
                    "Everything in Weekly",
                    "Advanced progress analytics",
                    "Priority meal scheduling",
                    "24/7 priority support",
                    "Free delivery on all orders"
                  ].map((item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-success" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button variant="gradient" className="w-full">Choose Monthly</Button>
              </CardContent>
            </Card>
          </div>
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
