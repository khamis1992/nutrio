import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Salad, 
  Target, 
  Heart, 
  Users, 
  Award,
  ArrowRight,
  ChefHat,
  TrendingUp
} from "lucide-react";

const About = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 gradient-primary rounded-xl flex items-center justify-center">
              <Salad className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">NUTRIO</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            <Link to="/about" className="text-sm font-medium text-primary transition-colors">About</Link>
            <Link to="/contact" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Contact</Link>
            <Link to="/partner/auth" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">For Restaurants</Link>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link to="/onboarding">
              <Button variant="gradient" size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <Badge variant="soft" className="mb-4">
            <Heart className="w-3 h-3 mr-1" />
            Our Story
          </Badge>
          <h1 className="text-4xl md:text-5xl font-extrabold leading-tight mb-6">
            Transforming Lives Through{" "}
            <span className="text-gradient">Better Nutrition</span>
          </h1>
          <p className="text-lg text-muted-foreground">
            NUTRIO was founded with a simple mission: make healthy eating accessible, 
            personalized, and enjoyable for everyone.
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-16 px-4 bg-card/50">
        <div className="container mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
            <div>
              <h2 className="text-3xl font-bold mb-6">Our Mission</h2>
              <p className="text-muted-foreground mb-4">
                We believe that everyone deserves access to nutritious, delicious meals 
                tailored to their unique health goals. Whether you're looking to lose weight, 
                build muscle, or simply maintain a healthier lifestyle, NUTRIO is here to help.
              </p>
              <p className="text-muted-foreground">
                By partnering with local restaurants and leveraging technology, we make it easy 
                to plan, order, and track meals that align with your nutritional needs.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Card variant="stat">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-primary mb-2">15K+</div>
                  <p className="text-sm text-muted-foreground">Active Users</p>
                </CardContent>
              </Card>
              <Card variant="stat">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-primary mb-2">200+</div>
                  <p className="text-sm text-muted-foreground">Partner Restaurants</p>
                </CardContent>
              </Card>
              <Card variant="stat">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-primary mb-2">50K+</div>
                  <p className="text-sm text-muted-foreground">Meals Delivered</p>
                </CardContent>
              </Card>
              <Card variant="stat">
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-primary mb-2">4.8★</div>
                  <p className="text-sm text-muted-foreground">Average Rating</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <Badge variant="soft" className="mb-4">Our Values</Badge>
            <h2 className="text-3xl font-bold">What Drives Us</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: Target,
                title: "Personalization",
                description: "Every body is different. We create nutrition plans tailored to your unique needs and goals."
              },
              {
                icon: ChefHat,
                title: "Quality",
                description: "We partner only with restaurants committed to fresh, high-quality ingredients."
              },
              {
                icon: Users,
                title: "Community",
                description: "Health journeys are better together. We foster a supportive community of like-minded individuals."
              },
              {
                icon: TrendingUp,
                title: "Results",
                description: "We're focused on helping you achieve measurable, sustainable health improvements."
              },
              {
                icon: Heart,
                title: "Wellness",
                description: "Nutrition is just one part of wellness. We promote a holistic approach to health."
              },
              {
                icon: Award,
                title: "Excellence",
                description: "We continuously improve our platform to deliver the best possible experience."
              }
            ].map((value, index) => (
              <Card key={index} variant="interactive">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <value.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{value.title}</h3>
                  <p className="text-sm text-muted-foreground">{value.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-card/50">
        <div className="container mx-auto">
          <Card variant="elevated" className="gradient-primary p-12 text-center max-w-3xl mx-auto">
            <h2 className="text-3xl font-bold text-primary-foreground mb-4">
              Ready to Start Your Journey?
            </h2>
            <p className="text-primary-foreground/80 mb-8">
              Join thousands of users transforming their health with NUTRIO
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

      {/* Footer */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center">
                <Salad className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold">NUTRIO</span>
            </div>
            <div className="flex items-center gap-6">
              <Link to="/about" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                About
              </Link>
              <Link to="/contact" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Contact
              </Link>
              <Link to="/partner/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Partner Portal
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

export default About;
