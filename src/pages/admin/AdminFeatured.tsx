import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Sparkles, 
  Loader2, 
  DollarSign, 
  TrendingUp, 
  Store,
  Calendar,
  CheckCircle,
  XCircle,
  Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/currency";
import { format } from "date-fns";

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

export default function AdminFeatured() {
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<FeaturedListing[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalRevenue: 0,
    activeListings: 0,
    totalListings: 0,
    thisMonthRevenue: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

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

      const formattedListings: FeaturedListing[] = (listingsData || []).map((l: any) => ({
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
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Featured Listings
          </h1>
          <p className="text-muted-foreground">
            Manage restaurant featured listings and view revenue
          </p>
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
                  <Sparkles className="w-6 h-6 text-warning" />
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
                <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
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
      </div>
    </AdminLayout>
  );
}
