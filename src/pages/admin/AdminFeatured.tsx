import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  DollarSign, 
  TrendingUp, 
  Store,
  Calendar,
  CheckCircle,
  XCircle,
  Plus,
  Search
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/currency";
import { format, addDays, addMonths } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const C = {
  ink: "#020617",
  muted: "#94A3B8",
  panel: "#F6F8FB",
  water: "#38BDF8",
  fat: "#FB6B7A",
  protein: "#7C83F6",
  calories: "#22C7A1",
};

interface FeaturedListing {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  package_type: string;
  price_paid: number;
  starts_at: string;
  ends_at: string;
  status: string;
  created_at: string;
}

interface Stats {
  totalRevenue: number;
  activeListings: number;
  totalListings: number;
  thisMonthRevenue: number;
}

interface Restaurant {
  id: string;
  name: string;
}

export default function AdminFeatured() {
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<FeaturedListing[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalRevenue: 0,
    activeListings: 0,
    totalListings: 0,
    thisMonthRevenue: 0,
  });
  
  // Add listing dialog state
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [filteredRestaurants, setFilteredRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState("");
  const [selectedPackage, setSelectedPackage] = useState("weekly");
  const [customPrice, setCustomPrice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [restaurantSearch, setRestaurantSearch] = useState("");

  useEffect(() => {
    fetchData();
    fetchRestaurants();
  }, []);
  
  const fetchRestaurants = async () => {
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name")
        .eq("approval_status", "approved")
        .order("name");
      
      if (error) throw error;
      setRestaurants(data || []);
      setFilteredRestaurants(data || []);
    } catch (err) {
      console.error("Error fetching restaurants:", err);
    }
  };

  // Filter restaurants based on search
  useEffect(() => {
    if (!restaurantSearch.trim()) {
      setFilteredRestaurants(restaurants);
    } else {
      const query = restaurantSearch.toLowerCase();
      const filtered = restaurants.filter((r) =>
        r.name.toLowerCase().includes(query)
      );
      setFilteredRestaurants(filtered);
    }
  }, [restaurantSearch, restaurants]);

  const fetchData = async () => {
    try {
      // Fetch all featured listings with restaurant names
      const { data: listingsData, error: listingsError } = await supabase
        .from("featured_listings")
        .select(`
          id,
          restaurant_id,
          package_type,
          price_paid,
          starts_at,
          ends_at,
          status,
          created_at,
          restaurants (name)
        `)
        .order("created_at", { ascending: false });

      if (listingsError) throw listingsError;

      const formattedListings: FeaturedListing[] = (listingsData || []).map((l: { id: string; restaurant_id: string; package_type: string; price_paid: number; starts_at: string; ends_at: string; status: string; created_at: string; restaurants?: { name: string } | null }) => ({
        id: l.id,
        restaurant_id: l.restaurant_id,
        restaurant_name: l.restaurants?.name || "Unknown",
        package_type: l.package_type,
        price_paid: l.price_paid,
        starts_at: l.starts_at,
        ends_at: l.ends_at,
        status: l.status,
        created_at: l.created_at,
      }));

      setListings(formattedListings);

      // Calculate stats
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const activeCount = formattedListings.filter(
        (l) => l.status === "active" && new Date(l.ends_at) > now
      ).length;
      
      const totalRevenue = formattedListings.reduce((sum, l) => sum + l.price_paid, 0);
      
      const thisMonthRevenue = formattedListings
        .filter((l) => new Date(l.created_at) >= monthStart)
        .reduce((sum, l) => sum + l.price_paid, 0);

      setStats({
        totalRevenue,
        activeListings: activeCount,
        totalListings: formattedListings.length,
        thisMonthRevenue,
      });
    } catch (err) {
      console.error("Error fetching featured listings:", err);
      toast.error("Failed to load featured listings");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("featured_listings")
        .update({ status: newStatus })
        .eq("id", id);

      if (error) throw error;

      setListings((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l))
      );

      toast.success(`Listing ${newStatus === "active" ? "activated" : "cancelled"}`);
    } catch (err) {
      console.error("Error updating status:", err);
      toast.error("Failed to update listing status");
    }
  };
  
  const handleAddListing = async () => {
    if (!selectedRestaurant || !selectedPackage) {
      toast.error("Please select a restaurant and package type");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Calculate price based on package
      const prices: Record<string, number> = {
        weekly: 49,
        biweekly: 89,
        monthly: 149
      };
      const price = customPrice ? parseFloat(customPrice) : prices[selectedPackage];
      
      // Calculate dates
      const startsAt = new Date();
      const endsAt = selectedPackage === "weekly" 
        ? addDays(startsAt, 7)
        : selectedPackage === "biweekly"
        ? addDays(startsAt, 14)
        : addMonths(startsAt, 1);
      
      const { error } = await supabase
        .from("featured_listings")
        .insert({
          restaurant_id: selectedRestaurant,
          package_type: selectedPackage,
          price_paid: price,
          starts_at: startsAt.toISOString(),
          ends_at: endsAt.toISOString(),
          status: "active"
        });
      
      if (error) throw error;
      
      toast.success("Featured listing created successfully");
      setShowAddDialog(false);
      setSelectedRestaurant("");
      setSelectedPackage("weekly");
      setCustomPrice("");
      fetchData();
    } catch (err) {
      console.error("Error creating listing:", err);
      toast.error("Failed to create featured listing");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (listing: FeaturedListing) => {
    const now = new Date();
    const isExpired = new Date(listing.ends_at) <= now;
    
    if (listing.status === "cancelled") {
      return <Badge variant="outline" className="rounded-full border-[#FB6B7A]/20 bg-[#FB6B7A]/10 px-2.5 py-1 text-[11px] font-black text-[#FB6B7A]">Cancelled</Badge>;
    }
    if (isExpired || listing.status === "expired") {
      return <Badge variant="outline" className="rounded-full border-[#94A3B8]/20 bg-[#F6F8FB] px-2.5 py-1 text-[11px] font-black text-[#94A3B8]">Expired</Badge>;
    }
    if (listing.status === "pending") {
      return <Badge variant="outline" className="rounded-full border-[#7C83F6]/20 bg-[#7C83F6]/10 px-2.5 py-1 text-[11px] font-black text-[#7C83F6]">Pending</Badge>;
    }
    return <Badge variant="outline" className="rounded-full border-[#22C7A1]/20 bg-[#22C7A1]/10 px-2.5 py-1 text-[11px] font-black text-[#22C7A1]">Active</Badge>;
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex h-64 items-center justify-center bg-[#F6F8FB]">
          <div className="rounded-[28px] bg-white p-8 text-center shadow-[0_18px_42px_rgba(2,6,23,0.06)] ring-1 ring-[#020617]/5">
            <Loader2 className="mx-auto h-9 w-9 animate-spin text-[#22C7A1]" />
            <p className="mt-3 text-sm font-bold text-[#94A3B8]">Loading featured listings...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-5 bg-[#F6F8FB] p-3 text-[#020617] sm:p-5">
        <section className="overflow-hidden rounded-[28px] bg-white p-5 shadow-[0_18px_42px_rgba(2,6,23,0.06)] ring-1 ring-[#020617]/5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#7C83F6]">Featured inventory</p>
              <h1 className="mt-1 text-[30px] font-black tracking-[-0.04em] text-[#020617]">Featured Listings</h1>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[#94A3B8]">
                Manage promoted restaurant placements, package duration, and featured revenue.
              </p>
            </div>
            <Button
              onClick={() => setShowAddDialog(true)}
              className="h-11 rounded-full bg-[#020617] px-5 text-white shadow-[0_12px_26px_rgba(2,6,23,0.18)] hover:bg-[#020617]/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Featured Listing
            </Button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            {[
              { label: "Total Revenue", value: formatCurrency(stats.totalRevenue), icon: DollarSign, color: C.calories, bg: "bg-[#22C7A1]/10" },
              { label: "This Month", value: formatCurrency(stats.thisMonthRevenue), icon: TrendingUp, color: C.protein, bg: "bg-[#7C83F6]/10" },
              { label: "Active Listings", value: String(stats.activeListings), icon: CheckCircle, color: C.water, bg: "bg-[#38BDF8]/10" },
              { label: "Total Listings", value: String(stats.totalListings), icon: Store, color: C.fat, bg: "bg-[#FB6B7A]/10" },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="rounded-[22px] bg-[#F6F8FB] p-4 ring-1 ring-[#020617]/5">
                <div className="flex items-center justify-between gap-3">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${bg}`} style={{ color }}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <p className="mt-4 truncate text-[22px] font-black leading-tight text-[#020617]">{value}</p>
                <p className="mt-1 text-[11px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">{label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-4 px-1">
            <div>
              <h2 className="text-[19px] font-black tracking-[-0.02em] text-[#020617]">All Featured Listings</h2>
              <p className="text-sm font-medium text-[#94A3B8]">View and manage all restaurant featured purchases.</p>
            </div>
          </div>

          {listings.length === 0 ? (
            <div className="rounded-[28px] bg-white p-10 text-center shadow-sm ring-1 ring-[#020617]/5">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F6F8FB] text-[#94A3B8]">
                <Store className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-base font-black text-[#020617]">No featured listings yet</h3>
              <p className="mt-1 text-sm font-medium text-[#94A3B8]">When partners purchase featured listings, they'll appear here.</p>
            </div>
          ) : (
            <div className="grid gap-3 2xl:grid-cols-2">
              {listings.map((listing) => {
                const isActive = listing.status === "active" && new Date(listing.ends_at) > new Date();
                return (
                  <article
                    key={listing.id}
                    className="rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(2,6,23,0.05)] ring-1 ring-[#020617]/5"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {getStatusBadge(listing)}
                          <span className="rounded-full bg-[#F6F8FB] px-2.5 py-1 text-[11px] font-black capitalize text-[#94A3B8]">
                            {listing.package_type}
                          </span>
                        </div>
                        <h3 className="mt-3 truncate text-[18px] font-black text-[#020617]">{listing.restaurant_name}</h3>
                        <div className="mt-2 flex flex-wrap gap-2 text-sm font-bold text-[#94A3B8]">
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#F6F8FB] px-2.5 py-1">
                            <Calendar className="h-3.5 w-3.5 text-[#38BDF8]" />
                            {format(new Date(listing.starts_at), "MMM d")} - {format(new Date(listing.ends_at), "MMM d, yyyy")}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#22C7A1]/10 px-2.5 py-1 text-[#22C7A1]">
                            <DollarSign className="h-3.5 w-3.5" />
                            {formatCurrency(listing.price_paid)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {listing.status === "pending" && (
                          <>
                            <Button
                              className="h-10 rounded-full bg-[#22C7A1] px-4 text-white hover:bg-[#22C7A1]/90"
                              onClick={() => updateStatus(listing.id, "active")}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              className="h-10 rounded-full bg-[#FB6B7A] px-4 text-white hover:bg-[#FB6B7A]/90"
                              onClick={() => updateStatus(listing.id, "cancelled")}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Reject
                            </Button>
                          </>
                        )}
                        {isActive && (
                          <Button
                            variant="outline"
                            className="h-10 rounded-full border-[#FB6B7A]/20 bg-[#FB6B7A]/10 px-4 text-[#FB6B7A] hover:bg-[#FB6B7A]/15"
                            onClick={() => updateStatus(listing.id, "cancelled")}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
        
        {/* Add Featured Listing Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="border-0 bg-[#F6F8FB] text-[#020617] shadow-[0_24px_60px_rgba(2,6,23,0.16)] sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="text-[22px] font-black text-[#020617]">Add Featured Listing</DialogTitle>
              <DialogDescription className="font-medium text-[#94A3B8]">
                Create a new featured listing for a restaurant
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">Restaurant</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                  <Input
                    placeholder="Search restaurants..."
                    value={restaurantSearch}
                    onChange={(e) => setRestaurantSearch(e.target.value)}
                    className="mb-2 h-11 rounded-2xl border-0 bg-white pl-10 text-[#020617] placeholder:text-[#94A3B8] ring-1 ring-[#020617]/5 focus-visible:ring-[#38BDF8]"
                  />
                </div>
                <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
                  <SelectTrigger className="h-11 rounded-2xl border-0 bg-white text-[#020617] ring-1 ring-[#020617]/5">
                    <SelectValue placeholder={filteredRestaurants.length === 0 ? "No restaurants found" : `Select a restaurant (${filteredRestaurants.length} available)`} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {filteredRestaurants.length === 0 ? (
                      <SelectItem value="" disabled>
                        No restaurants match your search
                      </SelectItem>
                    ) : (
                      filteredRestaurants.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">Package Type</Label>
                <Select value={selectedPackage} onValueChange={setSelectedPackage}>
                  <SelectTrigger className="h-11 rounded-2xl border-0 bg-white text-[#020617] ring-1 ring-[#020617]/5">
                    <SelectValue placeholder="Select package" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly (QAR 49)</SelectItem>
                    <SelectItem value="biweekly">Bi-Weekly (QAR 89)</SelectItem>
                    <SelectItem value="monthly">Monthly (QAR 149)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">Custom Price (optional)</Label>
                <input
                  type="number"
                  placeholder="Leave empty for default price"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="h-11 w-full rounded-2xl border-0 bg-white px-4 text-sm font-medium text-[#020617] outline-none ring-1 ring-[#020617]/5 placeholder:text-[#94A3B8] focus:ring-2 focus:ring-[#22C7A1]"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                className="rounded-full border-[#020617]/10 bg-white text-[#020617] hover:bg-white"
                onClick={() => setShowAddDialog(false)}
              >
                Cancel
              </Button>
              <Button
                className="rounded-full bg-[#020617] text-white hover:bg-[#020617]/90"
                onClick={handleAddListing}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Add Listing
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
