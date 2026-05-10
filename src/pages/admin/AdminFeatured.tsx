import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
      return <Badge variant="destructive">Cancelled</Badge>;
    }
    if (isExpired || listing.status === "expired") {
      return <Badge variant="secondary">Expired</Badge>;
    }
    if (listing.status === "pending") {
      return <Badge variant="outline" className="border-warning text-warning">Pending</Badge>;
    }
    return <Badge variant="default" className="bg-primary">Active</Badge>;
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Featured Listings
            </h1>
            <p className="text-muted-foreground">
              Manage restaurant featured listings and view revenue
            </p>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Featured Listing
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalRevenue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">This Month</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.thisMonthRevenue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Active Listings</p>
                  <p className="text-2xl font-bold">{stats.activeListings}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                  <Store className="w-6 h-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Listings</p>
                  <p className="text-2xl font-bold">{stats.totalListings}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Listings Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Featured Listings</CardTitle>
            <CardDescription>
              View and manage all restaurant featured listing purchases
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
            {listings.length === 0 ? (
              <div className="text-center py-12">
                <h3 className="font-semibold mb-2">No featured listings yet</h3>
                <p className="text-sm text-muted-foreground">
                  When partners purchase featured listings, they'll appear here.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Restaurant</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {listings.map((listing) => (
                    <TableRow key={listing.id}>
                      <TableCell className="font-medium">{listing.restaurant_name}</TableCell>
                      <TableCell className="capitalize">{listing.package_type}</TableCell>
                      <TableCell>{formatCurrency(listing.price_paid)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(listing.starts_at), "MMM d")} -{" "}
                          {format(new Date(listing.ends_at), "MMM d, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(listing)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {listing.status === "pending" && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="min-h-[44px] min-w-[44px]"
                                onClick={() => updateStatus(listing.id, "active")}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="min-h-[44px] min-w-[44px]"
                                onClick={() => updateStatus(listing.id, "cancelled")}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                          {listing.status === "active" && new Date(listing.ends_at) > new Date() && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="min-h-[44px] min-w-[44px]"
                              onClick={() => updateStatus(listing.id, "cancelled")}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Cancel
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            </div>
          </CardContent>
        </Card>
        
        {/* Add Featured Listing Dialog */}
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Featured Listing</DialogTitle>
              <DialogDescription>
                Create a new featured listing for a restaurant
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Restaurant</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search restaurants..."
                    value={restaurantSearch}
                    onChange={(e) => setRestaurantSearch(e.target.value)}
                    className="pl-10 mb-2"
                  />
                </div>
                <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
                  <SelectTrigger>
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
                <Label>Package Type</Label>
                <Select value={selectedPackage} onValueChange={setSelectedPackage}>
                  <SelectTrigger>
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
                <Label>Custom Price (optional)</Label>
                <input
                  type="number"
                  placeholder="Leave empty for default price"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddListing} disabled={isSubmitting}>
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
