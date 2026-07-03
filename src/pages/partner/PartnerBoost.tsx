import { useEffect, useState } from "react";
import { format, differenceInDays, differenceInHours } from "date-fns";
import {
  Calendar,
  Check,
  Clock,
  Crown,
  DollarSign,
  Loader2,
  Search,
  Sparkles,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PartnerLayout } from "@/components/PartnerLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";
import { toast } from "sonner";

interface FeaturedListing {
  id: string;
  package_type: string;
  price_paid: number;
  starts_at: string;
  ends_at: string;
  status: string;
  created_at: string;
}

interface BoostPackage {
  type: "weekly" | "biweekly" | "monthly";
  name: string;
  price: number;
  duration: number;
  discount?: number;
  popular?: boolean;
}

const defaultPackages: BoostPackage[] = [
  { type: "weekly", name: "Weekly Boost", price: 49, duration: 7 },
  {
    type: "biweekly",
    name: "Bi-Weekly Boost",
    price: 89,
    duration: 14,
    discount: 10,
  },
  {
    type: "monthly",
    name: "Monthly Boost",
    price: 149,
    duration: 30,
    discount: 25,
    popular: true,
  },
];

export default function PartnerBoost() {
  return (
    <PartnerLayout
      title="Boost"
      subtitle="Get featured at the top of search results and attract more customers"
    >
      <BoostContent />
    </PartnerLayout>
  );
}

function BoostContent() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [activeListing, setActiveListing] = useState<FeaturedListing | null>(
    null,
  );
  const [pastListings, setPastListings] = useState<FeaturedListing[]>([]);
  const [packages, setPackages] = useState<BoostPackage[]>(defaultPackages);

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      try {
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

        const { data: listings, error: listingsError } = await supabase
          .from("featured_listings")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .order("created_at", { ascending: false });

        if (listingsError) throw listingsError;

        const now = new Date();
        const active = listings?.find(
          (listing) =>
            listing.status === "active" && new Date(listing.ends_at) > now,
        );
        setActiveListing(active || null);

        setPastListings(
          listings?.filter(
            (listing) =>
              listing.status === "expired" ||
              (listing.status === "active" && new Date(listing.ends_at) <= now),
          ) || [],
        );

        const { data: pricingData } = await supabase
          .from("platform_settings")
          .select("value")
          .eq("key", "featured_listing_prices")
          .maybeSingle();

        if (pricingData?.value) {
          const prices = pricingData.value as {
            weekly: number;
            biweekly: number;
            monthly: number;
          };
          setPackages([
            {
              type: "weekly",
              name: "Weekly Boost",
              price: prices.weekly || 49,
              duration: 7,
            },
            {
              type: "biweekly",
              name: "Bi-Weekly Boost",
              price: prices.biweekly || 89,
              duration: 14,
              discount: 10,
            },
            {
              type: "monthly",
              name: "Monthly Boost",
              price: prices.monthly || 149,
              duration: 30,
              discount: 25,
              popular: true,
            },
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

  const handlePurchase = async (pkg: BoostPackage) => {
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
      toast.success(`${pkg.name} activated. Your restaurant is now featured.`);
    } catch (err: unknown) {
      console.error("Error purchasing boost:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to purchase boost",
      );
    } finally {
      setPurchasing(null);
    }
  };

  const getTimeRemaining = (endsAt: string) => {
    const end = new Date(endsAt);
    const now = new Date();
    const days = differenceInDays(end, now);
    const hours = differenceInHours(end, now) % 24;

    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  if (loading) {
    return (
      <div className="-m-6 min-h-screen bg-[#F6F8FB] p-4 sm:p-6">
        <div className="mx-auto max-w-6xl space-y-4">
          <Skeleton className="h-52 rounded-[30px] bg-white" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-72 rounded-[28px] bg-white" />
            <Skeleton className="h-72 rounded-[28px] bg-white" />
            <Skeleton className="h-72 rounded-[28px] bg-white" />
          </div>
        </div>
      </div>
    );
  }

  if (!restaurantId) {
    return (
      <div className="-m-6 min-h-screen bg-[#F6F8FB] p-4 text-[#020617] sm:p-6">
        <div className="mx-auto max-w-3xl rounded-[30px] border border-[#E5EAF1] bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F97316]/10 text-[#F97316]">
            <Crown className="h-6 w-6" />
          </div>
          <h3 className="text-xl font-black text-[#020617]">
            No Restaurant Found
          </h3>
          <p className="mt-2 text-sm font-medium leading-6 text-[#64748B]">
            You need to register a restaurant before you can boost it.
          </p>
        </div>
      </div>
    );
  }

  const activePackageName = activeListing
    ? `${activeListing.package_type.charAt(0).toUpperCase()}${activeListing.package_type.slice(1)} Boost`
    : "No active boost";

  return (
    <div className="-m-6 min-h-screen bg-[#F6F8FB] p-4 text-[#020617] sm:p-6">
      <div className="mx-auto max-w-6xl space-y-4">
        <section className="overflow-hidden rounded-[30px] border border-[#E5EAF1] bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[1.06fr_0.94fr]">
            <div className="space-y-5 p-5 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-[#7C83F6]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                    <Zap className="h-3.5 w-3.5" />
                    Featured placement
                  </div>
                  <h1 className="mt-3 text-2xl font-black tracking-tight text-[#020617] sm:text-3xl">
                    Boost your restaurant
                  </h1>
                  <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-[#64748B]">
                    Push your restaurant higher in discovery surfaces and make
                    your profile easier to spot when customers browse meals.
                  </p>
                </div>
                <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#020617] text-white sm:flex">
                  <Crown className="h-6 w-6" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-[#22C7A1]/20 bg-[#22C7A1]/10 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0B9B7E]">
                    Visibility
                  </p>
                  <p className="mt-1 text-sm font-black text-[#020617]">
                    Top search
                  </p>
                </div>
                <div className="rounded-2xl border border-[#38BDF8]/20 bg-[#38BDF8]/10 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0284C7]">
                    Badge
                  </p>
                  <p className="mt-1 text-sm font-black text-[#020617]">
                    Featured
                  </p>
                </div>
                <div className="rounded-2xl border border-[#F97316]/20 bg-[#F97316]/10 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#F97316]">
                    Plans
                  </p>
                  <p className="mt-1 text-sm font-black text-[#020617]">
                    {packages.length}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[#020617] p-5 text-white sm:p-6">
              <div className="flex h-full flex-col justify-between gap-6 rounded-[24px] border border-white/10 bg-white/5 p-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">
                    Current boost
                  </p>
                  <p className="mt-3 text-3xl font-black tracking-tight">
                    {activePackageName}
                  </p>
                  <p className="mt-3 text-sm font-semibold leading-6 text-white/65">
                    {activeListing
                      ? `${getTimeRemaining(activeListing.ends_at)}. Expires ${format(new Date(activeListing.ends_at), "MMM d, yyyy")}.`
                      : "Choose a package below to activate featured placement."}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-white/10 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
                      Status
                    </p>
                    <p className="mt-1 text-lg font-black text-white">
                      {activeListing ? "Active" : "Ready"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
                      History
                    </p>
                    <p className="mt-1 text-lg font-black text-white">
                      {pastListings.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {activeListing && (
          <section className="rounded-[28px] border border-[#22C7A1]/25 bg-[#22C7A1]/10 p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[#0B9B7E] shadow-sm">
                  <Crown className="h-7 w-7" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-black text-[#020617]">
                      Currently featured
                    </p>
                    <Badge className="rounded-full bg-[#22C7A1] font-black text-white hover:bg-[#22C7A1]">
                      Active
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm font-bold text-[#64748B]">
                    {activePackageName} •{" "}
                    {getTimeRemaining(activeListing.ends_at)}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 text-left sm:text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                  Expires
                </p>
                <p className="mt-1 font-black text-[#020617]">
                  {format(new Date(activeListing.ends_at), "MMM d, yyyy")}
                </p>
              </div>
            </div>
          </section>
        )}

        <section className="grid gap-4 md:grid-cols-3">
          {packages.map((pkg) => {
            const isPurchasing = purchasing === pkg.type;
            return (
              <article
                key={pkg.type}
                className={`relative overflow-hidden rounded-[28px] border bg-white p-5 shadow-sm ${
                  pkg.popular
                    ? "border-[#7C83F6] ring-4 ring-[#7C83F6]/10"
                    : "border-[#E5EAF1]"
                }`}
              >
                {pkg.popular && (
                  <div className="absolute right-4 top-4">
                    <Badge className="rounded-full bg-[#7C83F6] font-black text-white hover:bg-[#7C83F6]">
                      Most popular
                    </Badge>
                  </div>
                )}

                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#020617] text-white">
                  <Zap className="h-6 w-6" />
                </div>
                <p className="text-xl font-black text-[#020617]">{pkg.name}</p>
                <p className="mt-1 text-sm font-bold text-[#94A3B8]">
                  {pkg.duration} days of featuring
                </p>

                <div className="mt-5 flex items-end gap-2">
                  <span className="text-4xl font-black tracking-tight text-[#020617]">
                    {formatCurrency(pkg.price)}
                  </span>
                  {pkg.discount && (
                    <Badge className="mb-1 rounded-full bg-[#F97316]/10 font-black text-[#F97316] hover:bg-[#F97316]/10">
                      Save {pkg.discount}%
                    </Badge>
                  )}
                </div>

                <ul className="mt-5 space-y-3 text-sm font-bold text-[#64748B]">
                  {[
                    "Top of search results",
                    "Featured badge on profile",
                    "Homepage spotlight",
                    "Priority in browse section",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#22C7A1]/10 text-[#0B9B7E]">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>

                <Button
                  className={`mt-6 min-h-12 w-full rounded-2xl font-black ${
                    pkg.popular
                      ? "bg-[#020617] text-white hover:bg-[#020617]/90"
                      : "border border-[#E5EAF1] bg-[#F6F8FB] text-[#020617] hover:bg-white"
                  }`}
                  onClick={() => handlePurchase(pkg)}
                  disabled={!!activeListing || purchasing !== null}
                >
                  {isPurchasing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : activeListing ? (
                    "Already active"
                  ) : (
                    <>
                      <Zap className="mr-2 h-4 w-4" />
                      Get {pkg.name}
                    </>
                  )}
                </Button>
              </article>
            );
          })}
        </section>

        <section className="rounded-[28px] border border-[#E5EAF1] bg-white p-5 shadow-sm">
          <div className="mb-5">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7C83F6]">
              Impact
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-[#020617]">
              Why boost your restaurant?
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                icon: Search,
                title: "More visibility",
                text: "Featured restaurants are easier to find across discovery and browse surfaces.",
                color: "text-[#38BDF8]",
                bg: "bg-[#38BDF8]/10",
              },
              {
                icon: DollarSign,
                title: "More revenue",
                text: "Boost periods are designed to bring more attention to your menu and offers.",
                color: "text-[#0B9B7E]",
                bg: "bg-[#22C7A1]/10",
              },
              {
                icon: Sparkles,
                title: "Premium signal",
                text: "A featured badge helps your restaurant stand out in crowded customer views.",
                color: "text-[#7C83F6]",
                bg: "bg-[#7C83F6]/10",
              },
            ].map((benefit) => (
              <div
                key={benefit.title}
                className="rounded-[22px] border border-[#E5EAF1] bg-[#F6F8FB] p-4"
              >
                <div
                  className={`mb-3 flex h-11 w-11 items-center justify-center rounded-2xl ${benefit.bg} ${benefit.color}`}
                >
                  <benefit.icon className="h-5 w-5" />
                </div>
                <p className="font-black text-[#020617]">{benefit.title}</p>
                <p className="mt-2 text-sm font-medium leading-6 text-[#64748B]">
                  {benefit.text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {pastListings.length > 0 && (
          <section className="rounded-[28px] border border-[#E5EAF1] bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                  History
                </p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-[#020617]">
                  Past boosts
                </h2>
              </div>
              <Clock className="h-5 w-5 text-[#94A3B8]" />
            </div>

            <div className="space-y-3">
              {pastListings.map((listing) => (
                <div
                  key={listing.id}
                  className="grid gap-3 rounded-[22px] border border-[#E5EAF1] bg-[#F6F8FB] p-4 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#7C83F6]">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="font-black capitalize text-[#020617]">
                        {listing.package_type} Boost
                      </p>
                      <p className="text-sm font-bold text-[#94A3B8]">
                        {format(new Date(listing.starts_at), "MMM d")} -{" "}
                        {format(new Date(listing.ends_at), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <p className="font-black text-[#020617]">
                      {formatCurrency(listing.price_paid)}
                    </p>
                    <Badge className="rounded-full bg-[#E5EAF1] font-black text-[#64748B] hover:bg-[#E5EAF1]">
                      Expired
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
