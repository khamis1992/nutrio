import { useState, useEffect } from "react";
import { PartnerLayout } from "@/components/PartnerLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Check, Clock, Zap, Crown, Loader2, Calendar, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/currency";
import { format, differenceInDays, differenceInHours } from "date-fns";

interface FeaturedListing {
  id: string;
  package_type: string;
  price_paid: number;
  starts_at: string;
  ends_at: string;
  status: string;
  created_at: string;
}

interface Package {
  type: "weekly" | "biweekly" | "monthly";
  name: string;
  price: number;
  duration: number;
  discount?: number;
  popular?: boolean;
}

const defaultPackages: Package[] = [
  { type: "weekly", name: "Weekly Boost", price: 49, duration: 7 },
  { type: "biweekly", name: "Bi-Weekly Boost", price: 89, duration: 14, discount: 10 },
  { type: "monthly", name: "Monthly Boost", price: 149, duration: 30, discount: 25, popular: true },
];

export default function PartnerBoost() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [activeListing, setActiveListing] = useState<FeaturedListing | null>(null);
  const [pastListings, setPastListings] = useState<FeaturedListing[]>([]);
  const [packages, setPackages] = useState<Package[]>(defaultPackages);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
        // Fetch restaurant
        const { data: restaurant, error: restaurantError } = await supabase
          .from("restaurants")
          .select("id")
          .eq("owner_id", user.id)
          .maybeSingle();

        if (restaurantError) throw restaurantError;
        if (!restaurant) {
          setLoading(false);
          return;
        }

        setRestaurantId(restaurant.id);

        // Fetch featured listings
        const { data: listings, error: listingsError } = await supabase
          .from("featured_listings")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .order("created_at", { ascending: false });

        if (listingsError) throw listingsError;

        // Find active listing
        const now = new Date();
        const active = listings?.find(
          (l) => l.status === "active" && new Date(l.ends_at) > now
        );
        setActiveListing(active || null);

        // Set past listings
        setPastListings(
          listings?.filter(
            (l) => l.status === "expired" || (l.status === "active" && new Date(l.ends_at) <= now)
          ) || []
        );

        // Fetch pricing from platform settings
        const { data: pricingData } = await supabase
          .from("platform_settings")
          .select("value")
          .eq("key", "featured_listing_prices")
          .maybeSingle();

        if (pricingData?.value) {
          const prices = pricingData.value as { weekly: number; biweekly: number; monthly: number };
          setPackages([
            { type: "weekly", name: "Weekly Boost", price: prices.weekly || 49, duration: 7 },
            { type: "biweekly", name: "Bi-Weekly Boost", price: prices.biweekly || 89, duration: 14, discount: 10 },
            { type: "monthly", name: "Monthly Boost", price: prices.monthly || 149, duration: 30, discount: 25, popular: true },
          ]);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        toast.error("Failed to load boost data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  const handlePurchase = async (pkg: Package) => {
    if (!restaurantId) {
      toast.error("No restaurant found");
      return;
    }

    setPurchasing(pkg.type);

    try {
      const startsAt = new Date();
      const endsAt = new Date();
      endsAt.setDate(endsAt.getDate() + pkg.duration);

      const { data, error } = await supabase
        .from("featured_listings")
        .insert({
          restaurant_id: restaurantId,
          package_type: pkg.type,
          price_paid: pkg.price,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          status: "active",
          payment_reference: `demo_${Date.now()}`,
        })
        .select()
        .single();

      if (error) throw error;

      setActiveListing(data);
      toast.success(`🎉 ${pkg.name} activated! Your restaurant is now featured.`);
    } catch (err: any) {
      console.error("Error purchasing boost:", err);
      toast.error(err.message || "Failed to purchase boost");
    } finally {
      setPurchasing(null);
    }
  };

  const getTimeRemaining = (endsAt: string) => {
    const end = new Date(endsAt);
    const now = new Date();
    const days = differenceInDays(end, now);
    const hours = differenceInHours(end, now) % 24;
    
    if (days > 0) {
      return `${days}d ${hours}h remaining`;
    }
    return `${hours}h remaining`;
  };

  if (loading) {
    return (
      <PartnerLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </PartnerLayout>
    );
  }

  if (!restaurantId) {
    return (
      <PartnerLayout>
        <Card>
          <CardContent className="p-12 text-center">
            <Sparkles className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-2">No Restaurant Found</h3>
            <p className="text-muted-foreground">
              You need to register a restaurant before you can boost it.
            </p>
          </CardContent>
        </Card>
      </PartnerLayout>
    );
  }

  return (
    <PartnerLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Boost Your Restaurant
          </h1>
          <p className="text-muted-foreground">
            Get featured at the top of search results and attract more customers
          </p>
        </div>

        {/* Active Boost Status */}
        {activeListing && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Crown className="w-7 h-7 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-lg">Currently Featured</p>
                      <Badge variant="default" className="bg-primary">Active</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {activeListing.package_type.charAt(0).toUpperCase() + activeListing.package_type.slice(1)} package • {getTimeRemaining(activeListing.ends_at)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Expires</p>
                  <p className="font-semibold">{format(new Date(activeListing.ends_at), "MMM d, yyyy")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pricing Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          {packages.map((pkg) => (
            <Card
              key={pkg.type}
              className={`relative ${pkg.popular ? "border-primary shadow-lg" : ""}`}
            >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                </div>
              )}
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-lg">{pkg.name}</CardTitle>
                <CardDescription>{pkg.duration} days of featuring</CardDescription>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                <div>
                  <span className="text-4xl font-bold">{formatCurrency(pkg.price)}</span>
                  {pkg.discount && (
                    <Badge variant="secondary" className="ml-2">
                      Save {pkg.discount}%
                    </Badge>
                  )}
                </div>
                
                <ul className="space-y-2 text-sm text-left">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Top of search results
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Featured badge on profile
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Homepage spotlight
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    Priority in browse section
                  </li>
                </ul>

                <Button
                  className="w-full"
                  variant={pkg.popular ? "default" : "outline"}
                  onClick={() => handlePurchase(pkg)}
                  disabled={!!activeListing || purchasing !== null}
                >
                  {purchasing === pkg.type ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : activeListing ? (
                    "Already Active"
                  ) : (
                    <>
                      <Zap className="h-4 w-4 mr-2" />
                      Get {pkg.name}
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Benefits Section */}
        <Card>
          <CardHeader>
            <CardTitle>Why Boost Your Restaurant?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">3x More Visibility</p>
                  <p className="text-sm text-muted-foreground">
                    Featured restaurants get 3x more views on average
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5 text-warning" />
                </div>
                <div>
                  <p className="font-semibold">Increase Revenue</p>
                  <p className="text-sm text-muted-foreground">
                    Partners report 40% more orders during featured periods
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                  <Crown className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="font-semibold">Premium Badge</p>
                  <p className="text-sm text-muted-foreground">
                    Stand out with a featured badge on your profile
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Past Boosts */}
        {pastListings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Boost History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pastListings.map((listing) => (
                  <div
                    key={listing.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="font-medium capitalize">{listing.package_type} Boost</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(listing.starts_at), "MMM d")} - {format(new Date(listing.ends_at), "MMM d, yyyy")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(listing.price_paid)}</p>
                      <Badge variant="secondary">Expired</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PartnerLayout>
  );
}
