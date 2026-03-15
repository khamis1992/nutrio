import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Store,
  MapPin,
  Phone,
  Mail,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  MoreHorizontal,
  Eye,
  Download,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Utensils,
  RefreshCw,
  Loader2,
  Plus,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

// ── QNAS helpers ────────────────────────────────────────────────────────────
interface QnasZone { zone_number: number; zone_name_en: string; zone_name_ar: string; }
interface QnasStreet { street_number: number; street_name_en: string; street_name_ar: string; }
interface QnasBuilding { building_number: string; x: string; y: string; }

async function qnasFetch<T>(path: string): Promise<T | null> {
  try {
    const { data, error } = await supabase.functions.invoke("qnas-proxy", { body: { path } });
    if (error || !data) return null;
    return Array.isArray(data) ? data as T : null;
  } catch {
    return null;
  }
}

interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  cuisine_type: string | null;
  website: string | null;
  approval_status: "pending" | "approved" | "rejected";
  is_active: boolean;
  payout_rate: number | null;
  commission_rate: number | null;
  created_at: string;
  owner: {
    full_name: string | null;
    email: string | null;
  } | null;
}

const AdminRestaurants = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRestaurants, setSelectedRestaurants] = useState<Set<string>>(new Set());
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [cuisineFilter, setCuisineFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<"created_at" | "name">("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [restaurantToApprove, setRestaurantToApprove] = useState<Restaurant | null>(null);
  const [payoutRate, setPayoutRate] = useState<string>("25.00");
  const [commissionRate, setCommissionRate] = useState<string>("18");

  // Add restaurant
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newRestaurant, setNewRestaurant] = useState({
    name: "",
    email: "",
    phone: "",
    cuisine_type: "",
    description: "",
    commission_rate: "18",
  });

  // QNAS state for add dialog
  const [addZones, setAddZones] = useState<QnasZone[]>([]);
  const [addStreets, setAddStreets] = useState<QnasStreet[]>([]);
  const [addBuildings, setAddBuildings] = useState<QnasBuilding[]>([]);
  const [addZone, setAddZone] = useState<number | null>(null);
  const [addStreet, setAddStreet] = useState<number | null>(null);
  const [addBuilding, setAddBuilding] = useState<string>("");
  const [addLat, setAddLat] = useState<number | null>(null);
  const [addLng, setAddLng] = useState<number | null>(null);
  const [addAddress, setAddAddress] = useState<string>("");
  const [addZoneOpen, setAddZoneOpen] = useState(false);
  const [addLoadingZones, setAddLoadingZones] = useState(false);
  const [addLoadingStreets, setAddLoadingStreets] = useState(false);
  const [addLoadingBuildings, setAddLoadingBuildings] = useState(false);

  useEffect(() => {
    fetchRestaurants();
  }, []);

  // Load zones when dialog opens
  useEffect(() => {
    if (!addDialogOpen || addZones.length > 0) return;
    setAddLoadingZones(true);
    qnasFetch<QnasZone[]>("/get_zones").then((data) => {
      if (data) setAddZones(data);
      setAddLoadingZones(false);
    });
  }, [addDialogOpen]);

  // Load streets when zone selected
  useEffect(() => {
    if (!addZone) { setAddStreets([]); setAddBuildings([]); return; }
    setAddLoadingStreets(true);
    setAddStreet(null);
    setAddBuildings([]);
    qnasFetch<QnasStreet[]>(`/get_streets/${addZone}`).then((data) => {
      if (data) setAddStreets(data);
      setAddLoadingStreets(false);
    });
  }, [addZone]);

  // Load buildings when street selected
  useEffect(() => {
    if (!addZone || !addStreet) { setAddBuildings([]); return; }
    setAddLoadingBuildings(true);
    qnasFetch<QnasBuilding[]>(`/get_buildings/${addZone}/${addStreet}`).then((data) => {
      if (data) setAddBuildings(data);
      setAddLoadingBuildings(false);
    });
  }, [addZone, addStreet]);

  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch owner profiles
      const ownerIds = [...new Set((data || []).map((r) => r.owner_id).filter(Boolean))];
      let ownersMap: Record<string, { full_name: string | null; email: string | null }> = {};

      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", ownerIds);

        if (profiles) {
          ownersMap = profiles.reduce((acc, p) => {
            acc[p.user_id] = { full_name: p.full_name, email: null };
            return acc;
          }, {} as Record<string, { full_name: string | null; email: string | null }>);
        }
      }

      const restaurantsWithOwners = (data || []).map((r) => ({
        ...r,
        owner: r.owner_id ? ownersMap[r.owner_id] || null : null,
      }));

      setRestaurants(restaurantsWithOwners);
    } catch (error) {
      console.error("Error fetching restaurants:", error);
      toast({
        title: "Error",
        description: "Failed to load restaurants. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetAddDialog = () => {
    setNewRestaurant({ name: "", email: "", phone: "", cuisine_type: "", description: "", commission_rate: "18" });
    setAddZone(null);
    setAddStreet(null);
    setAddBuilding("");
    setAddLat(null);
    setAddLng(null);
    setAddAddress("");
    setAddStreets([]);
    setAddBuildings([]);
  };

  const handleCreateRestaurant = async () => {
    if (!newRestaurant.name.trim()) {
      toast({ title: "Name required", description: "Please enter a restaurant name.", variant: "destructive" });
      return;
    }
    setAdding(true);
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .insert({
          name: newRestaurant.name.trim(),
          email: newRestaurant.email.trim() || null,
          phone: newRestaurant.phone.trim() || null,
          cuisine_type: newRestaurant.cuisine_type.trim() || null,
          description: newRestaurant.description.trim() || null,
          commission_rate: parseFloat(newRestaurant.commission_rate) || 18,
          address: addAddress || null,
          latitude: addLat,
          longitude: addLng,
          zone_number: addZone,
          street_number: addStreet,
          building_number: addBuilding || null,
          approval_status: "approved",
          is_active: true,
        })
        .select("id")
        .single();

      if (error) throw error;

      toast({ title: "Restaurant Created", description: `${newRestaurant.name} has been created successfully.` });
      setAddDialogOpen(false);
      resetAddDialog();
      navigate(`/admin/restaurants/${data.id}`);
    } catch (error) {
      console.error("Error creating restaurant:", error);
      toast({ title: "Error", description: "Failed to create restaurant. Please try again.", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const openApproveDialog = (restaurant: Restaurant) => {
    setRestaurantToApprove(restaurant);
    setPayoutRate(restaurant.payout_rate?.toString() || "25.00");
    setCommissionRate(restaurant.commission_rate?.toString() || "18");
    setApproveDialogOpen(true);
  };

  const handleApprove = async () => {
    if (!restaurantToApprove) return;

    try {
      setProcessing(true);
      const rate = parseFloat(payoutRate);
      const commRate = parseFloat(commissionRate);
      
      if (isNaN(rate) || rate <= 0) {
        toast({
          title: "Invalid Payout Rate",
          description: "Please enter a valid payout rate greater than 0.",
          variant: "destructive",
        });
        return;
      }

      if (isNaN(commRate) || commRate < 0 || commRate > 100) {
        toast({
          title: "Invalid Commission Rate",
          description: "Commission rate must be between 0 and 100.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("restaurants")
        .update({ 
          approval_status: "approved", 
          is_active: true,
          payout_rate: rate,
          commission_rate: commRate,
          payout_rate_set_at: new Date().toISOString(),
        })
        .eq("id", restaurantToApprove.id);

      if (error) throw error;

      setRestaurants((prev) =>
        prev.map((r) =>
          r.id === restaurantToApprove.id 
            ? { ...r, approval_status: "approved", is_active: true, payout_rate: rate, commission_rate: commRate } 
            : r
        )
      );

      setApproveDialogOpen(false);
      setRestaurantToApprove(null);

      toast({
        title: "Restaurant Approved",
        description: `${restaurantToApprove.name} has been approved with ${commRate}% commission rate.`,
      });
    } catch (error) {
      console.error("Error approving restaurant:", error);
      toast({
        title: "Error",
        description: "Failed to approve restaurant.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (restaurant: Restaurant) => {
    try {
      setProcessing(true);
      const { error } = await supabase
        .from("restaurants")
        .update({ approval_status: "rejected", is_active: false })
        .eq("id", restaurant.id);

      if (error) throw error;

      setRestaurants((prev) =>
        prev.map((r) =>
          r.id === restaurant.id ? { ...r, approval_status: "rejected", is_active: false } : r
        )
      );

      toast({
        title: "Restaurant Rejected",
        description: `${restaurant.name} has been rejected.`,
      });
    } catch (error) {
      console.error("Error rejecting restaurant:", error);
      toast({
        title: "Error",
        description: "Failed to reject restaurant.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const toggleRestaurantSelection = (restaurantId: string) => {
    setSelectedRestaurants((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(restaurantId)) {
        newSet.delete(restaurantId);
      } else {
        newSet.add(restaurantId);
      }
      return newSet;
    });
  };

  const selectAllRestaurants = () => {
    if (selectedRestaurants.size === filteredRestaurants.length) {
      setSelectedRestaurants(new Set());
    } else {
      setSelectedRestaurants(new Set(filteredRestaurants.map((r) => r.id)));
    }
  };

  const handleSort = (field: "created_at" | "name") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const exportToCSV = () => {
    const headers = ["Name", "Cuisine", "Owner", "Status", "Address", "Phone", "Email", "Created At"];
    const rows = filteredRestaurants.map((r) => [
      r.name,
      r.cuisine_type || "N/A",
      r.owner?.full_name || "N/A",
      r.approval_status,
      r.address || "N/A",
      r.phone || "N/A",
      r.email || "N/A",
      format(new Date(r.created_at), "yyyy-MM-dd"),
    ]);
    
    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `restaurants-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({ title: "Export Complete", description: `${rows.length} restaurants exported to CSV.` });
  };

  // Get unique cuisine types
  const cuisineTypes = [...new Set(restaurants.map((r) => r.cuisine_type).filter(Boolean))];

  const filteredRestaurants = restaurants
    .filter((r) => {
      const matchesSearch =
        !searchQuery ||
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.address && r.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.owner?.full_name && r.owner.full_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.email && r.email.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesTab = activeTab === "all" || r.approval_status === activeTab;
      const matchesCuisine = cuisineFilter === "all" || r.cuisine_type === cuisineFilter;
      return matchesSearch && matchesTab && matchesCuisine;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === "created_at") {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortField === "name") {
        comparison = a.name.localeCompare(b.name);
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return null;
    }
  };

  // Calculate stats
  const stats = {
    total: restaurants.length,
    pending: restaurants.filter((r) => r.approval_status === "pending").length,
    approved: restaurants.filter((r) => r.approval_status === "approved").length,
    rejected: restaurants.filter((r) => r.approval_status === "rejected").length,
  };

  return (
    <AdminLayout title="Manage Restaurants" subtitle={`${stats.pending} pending approval`}>
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Store className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Restaurants</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.approved}</p>
                  <p className="text-xs text-muted-foreground">Approved</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.rejected}</p>
                  <p className="text-xs text-muted-foreground">Rejected</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { value: "all", label: "All", count: stats.total },
            { value: "pending", label: "Pending", count: stats.pending },
            { value: "approved", label: "Approved", count: stats.approved },
            { value: "rejected", label: "Rejected", count: stats.rejected },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {tab.count}
                </Badge>
              )}
            </button>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search restaurants by name, address, owner, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <select
                  value={cuisineFilter}
                  onChange={(e) => setCuisineFilter(e.target.value)}
                  className="px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">All Cuisines</option>
                  {cuisineTypes.map((cuisine) => (
                    <option key={cuisine} value={cuisine}>
                      {cuisine}
                    </option>
                  ))}
                </select>
                <Button variant="outline" onClick={exportToCSV} className="gap-2">
                  <Download className="w-4 h-4" />
                  Export
                </Button>
                <Button variant="outline" size="icon" onClick={fetchRestaurants} disabled={loading}>
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
                <Button onClick={() => setAddDialogOpen(true)} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Restaurant
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedRestaurants.size > 0 && (
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between">
            <span className="text-sm text-primary font-medium">
              {selectedRestaurants.size} restaurant{selectedRestaurants.size > 1 ? "s" : ""} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                Approve Selected
              </Button>
              <Button variant="outline" size="sm" className="text-red-600 border-red-200">
                Reject Selected
              </Button>
            </div>
          </div>
        )}

        {/* Restaurants Table */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Restaurants</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 pl-6">
                    <Checkbox
                      checked={selectedRestaurants.size === filteredRestaurants.length && filteredRestaurants.length > 0}
                      onCheckedChange={selectAllRestaurants}
                    />
                  </TableHead>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Cuisine</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Commission</TableHead>
                  <TableHead>
                    <button onClick={() => handleSort("created_at")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Registered
                      {sortField === "created_at" && (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </button>
                  </TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-muted-foreground text-sm">Loading restaurants...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredRestaurants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                          <Store className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground">No restaurants found</p>
                        <p className="text-muted-foreground/70 text-sm">Try adjusting your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRestaurants.map((restaurant) => (
                    <TableRow key={restaurant.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="pl-6">
                        <Checkbox
                          checked={selectedRestaurants.has(restaurant.id)}
                          onCheckedChange={() => toggleRestaurantSelection(restaurant.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                            {restaurant.logo_url ? (
                              <img src={restaurant.logo_url} alt={restaurant.name} className="w-full h-full object-cover" />
                            ) : (
                              <Store className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p 
                              className="font-medium cursor-pointer hover:text-primary hover:underline"
                              onClick={() => navigate(`/admin/restaurants/${restaurant.id}`)}
                            >
                              {restaurant.name}
                            </p>
                            {restaurant.address && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                <span className="truncate max-w-[200px]">{restaurant.address}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {restaurant.cuisine_type ? (
                          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                            <Utensils className="w-3 h-3 mr-1" />
                            {restaurant.cuisine_type}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">{restaurant.owner?.full_name || "Unknown"}</p>
                          {restaurant.email && (
                            <p className="text-xs text-muted-foreground">{restaurant.email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(restaurant.approval_status)}</TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">
                          {restaurant.commission_rate != null ? `${restaurant.commission_rate}%` : "18%"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(restaurant.created_at), "MMM d, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {restaurant.approval_status === "pending" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                                  onClick={() => openApproveDialog(restaurant)}
                                disabled={processing}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                                onClick={() => handleReject(restaurant)}
                                disabled={processing}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => navigate(`/admin/restaurants/${restaurant.id}`)}
                              >
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Open / Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedRestaurant(restaurant);
                                  setIsDetailOpen(true);
                                }}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                Quick View
                              </DropdownMenuItem>
                              {restaurant.website && (
                                <DropdownMenuItem onClick={() => window.open(restaurant.website!, "_blank")}>
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  Visit Website
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {restaurant.approval_status !== "approved" && (
                                <DropdownMenuItem
                                onClick={() => openApproveDialog(restaurant)}
                                  className="text-emerald-600 focus:text-emerald-600 focus:bg-emerald-500/10"
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Approve
                                </DropdownMenuItem>
                              )}
                              {restaurant.approval_status !== "rejected" && (
                                <DropdownMenuItem
                                  onClick={() => handleReject(restaurant)}
                                  className="text-red-600 focus:text-red-600 focus:bg-red-500/10"
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Reject
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Restaurant Detail Sheet */}
        <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <SheetContent className="w-full sm:max-w-xl">
            {selectedRestaurant && (
              <>
                <SheetHeader className="pb-6 border-b">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                      {selectedRestaurant.logo_url ? (
                        <img
                          src={selectedRestaurant.logo_url}
                          alt={selectedRestaurant.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Store className="w-8 h-8 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <SheetTitle className="text-xl">{selectedRestaurant.name}</SheetTitle>
                      <SheetDescription>
                        {getStatusBadge(selectedRestaurant.approval_status)}
                      </SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {/* Description */}
                  {selectedRestaurant.description && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                          About
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{selectedRestaurant.description}</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Contact Info */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        Contact Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedRestaurant.address && (
                        <div className="flex items-start gap-3">
                          <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">Address</p>
                            <p className="text-sm text-muted-foreground">{selectedRestaurant.address}</p>
                          </div>
                        </div>
                      )}
                      {selectedRestaurant.phone && (
                        <div className="flex items-start gap-3">
                          <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">Phone</p>
                            <p className="text-sm text-muted-foreground">{selectedRestaurant.phone}</p>
                          </div>
                        </div>
                      )}
                      {selectedRestaurant.email && (
                        <div className="flex items-start gap-3">
                          <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-sm font-medium">Email</p>
                            <p className="text-sm text-muted-foreground">{selectedRestaurant.email}</p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Owner Info */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        Owner Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Utensils className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{selectedRestaurant.owner?.full_name || "Unknown"}</p>
                          <p className="text-xs text-muted-foreground">
                            Registered {format(new Date(selectedRestaurant.created_at), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Actions */}
                  {selectedRestaurant.approval_status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => {
                          openApproveDialog(selectedRestaurant);
                          setIsDetailOpen(false);
                        }}
                        disabled={processing}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve Restaurant
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => {
                          handleReject(selectedRestaurant);
                          setIsDetailOpen(false);
                        }}
                        disabled={processing}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* Add Restaurant Dialog */}
        <Dialog open={addDialogOpen} onOpenChange={(open) => { setAddDialogOpen(open); if (!open) resetAddDialog(); }}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Store className="w-5 h-5 text-primary" />
                Add New Restaurant
              </DialogTitle>
              <DialogDescription>
                Create a new restaurant. You'll be taken to the full detail page to complete the setup.
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="new-name">Restaurant Name <span className="text-destructive">*</span></Label>
                <Input
                  id="new-name"
                  placeholder="e.g. Healthy Bites"
                  value={newRestaurant.name}
                  onChange={(e) => setNewRestaurant((p) => ({ ...p, name: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-email">Email</Label>
                  <Input
                    id="new-email"
                    type="email"
                    placeholder="info@restaurant.qa"
                    value={newRestaurant.email}
                    onChange={(e) => setNewRestaurant((p) => ({ ...p, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-phone">Phone</Label>
                  <Input
                    id="new-phone"
                    placeholder="+974 XXXX XXXX"
                    value={newRestaurant.phone}
                    onChange={(e) => setNewRestaurant((p) => ({ ...p, phone: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-cuisine">Cuisine Type</Label>
                  <Input
                    id="new-cuisine"
                    placeholder="e.g. Healthy, Arabic"
                    value={newRestaurant.cuisine_type}
                    onChange={(e) => setNewRestaurant((p) => ({ ...p, cuisine_type: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-commission">Commission Rate (%)</Label>
                  <Input
                    id="new-commission"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="18"
                    value={newRestaurant.commission_rate}
                    onChange={(e) => setNewRestaurant((p) => ({ ...p, commission_rate: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-description">Description</Label>
                <Input
                  id="new-description"
                  placeholder="Short description of the restaurant"
                  value={newRestaurant.description}
                  onChange={(e) => setNewRestaurant((p) => ({ ...p, description: e.target.value }))}
                />
              </div>

              {/* QNAS Location Picker */}
              <div className="rounded-xl border-2 border-blue-300 bg-blue-600 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-white" />
                    <span className="text-sm font-bold text-white">Qatar Address (QNAS)</span>
                  </div>
                  {addLoadingZones && <span className="text-xs text-blue-200 animate-pulse">Loading zones…</span>}
                  {!addLoadingZones && addZones.length > 0 && (
                    <span className="text-xs text-blue-200">{addZones.length} zones loaded</span>
                  )}
                </div>

                {/* Zone */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-white">Zone | <span>منطقة</span></Label>
                  <Popover open={addZoneOpen} onOpenChange={setAddZoneOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        disabled={addLoadingZones || addZones.length === 0}
                        className="w-full justify-between bg-white border-blue-300 text-blue-700 font-medium h-9 hover:bg-blue-50 text-sm"
                      >
                        {addZone
                          ? (() => { const z = addZones.find((z) => z.zone_number === addZone); return z ? `${z.zone_number} - ${z.zone_name_en}` : addZone.toString(); })()
                          : addLoadingZones ? "⏱️ Loading…" : "Select Zone"}
                        <Search className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[360px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search by zone number or name…" />
                        <CommandList>
                          <CommandEmpty>No zones found.</CommandEmpty>
                          <CommandGroup>
                            {addZones.map((z) => (
                              <CommandItem
                                key={z.zone_number}
                                value={`${z.zone_number} ${z.zone_name_en} ${z.zone_name_ar}`}
                                onSelect={() => {
                                  setAddZone(z.zone_number);
                                  setAddStreet(null);
                                  setAddBuilding("");
                                  setAddLat(null);
                                  setAddLng(null);
                                  setAddAddress("");
                                  setAddZoneOpen(false);
                                }}
                              >
                                <span className="font-medium mr-1">{z.zone_number}</span>
                                {" - "}
                                <span className="ml-1">{z.zone_name_en}</span>
                                {z.zone_name_ar && <span className="text-muted-foreground ml-2 text-xs">{z.zone_name_ar}</span>}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Street */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-white">Street | <span>شارع</span></Label>
                  <Select
                    value={addStreet?.toString() ?? ""}
                    onValueChange={(v) => { setAddStreet(Number(v)); setAddBuilding(""); setAddLat(null); setAddLng(null); setAddAddress(""); }}
                    disabled={!addZone || addLoadingStreets}
                  >
                    <SelectTrigger className="bg-white border-blue-300 text-blue-700 font-medium h-9 text-sm">
                      <SelectValue placeholder={!addZone ? "Select Street" : addLoadingStreets ? "⏱️ Loading…" : "Select Street"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {addStreets.map((s) => (
                        <SelectItem key={s.street_number} value={s.street_number.toString()}>
                          <span className="font-medium">{s.street_number}</span>{" - "}<span>{s.street_name_en}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Building */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-white">Building Number | <span>رقم البناية</span></Label>
                  <Select
                    value={addBuilding}
                    onValueChange={(v) => {
                      setAddBuilding(v);
                      const bld = addBuildings.find((b) => b.building_number === v);
                      if (bld) {
                        const lat = parseFloat(bld.x);
                        const lng = parseFloat(bld.y);
                        setAddLat(lat);
                        setAddLng(lng);
                        const zone = addZones.find((z) => z.zone_number === addZone);
                        const street = addStreets.find((s) => s.street_number === addStreet);
                        const addr = [
                          `Zone ${addZone}${zone ? ` - ${zone.zone_name_en}` : ""}`,
                          `Street ${addStreet}${street ? ` - ${street.street_name_en}` : ""}`,
                          `Building ${v}`,
                          "Doha, Qatar",
                        ].join(", ");
                        setAddAddress(addr);
                      }
                    }}
                    disabled={!addStreet || addLoadingBuildings}
                  >
                    <SelectTrigger className="bg-white border-blue-300 text-blue-700 font-medium h-9 text-sm">
                      <SelectValue placeholder={!addStreet ? "Select Building" : addLoadingBuildings ? "⏱️ Loading…" : "Select Building"} />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {addBuildings.map((b) => (
                        <SelectItem key={b.building_number} value={b.building_number}>{b.building_number}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Result */}
                {addLat && addLng && (
                  <div className="bg-white/10 rounded-lg p-2 space-y-1">
                    <p className="text-xs text-green-300 font-medium">✓ Location found — {addLat.toFixed(6)}, {addLng.toFixed(6)}</p>
                    <p className="text-xs text-white/80 break-words">{addAddress}</p>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                The restaurant will be created as <strong>Approved & Active</strong>. After creation you'll be redirected to the detail page to complete the setup.
              </p>
            </div>
            </ScrollArea>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateRestaurant} disabled={adding || !newRestaurant.name.trim()}>
                {adding ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Restaurant
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Approval Dialog with Payout Rate */}
        <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Approve Restaurant</DialogTitle>
              <DialogDescription>
                Set the payout rate for {restaurantToApprove?.name}. This is the fixed amount the restaurant will receive per meal prepared.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="payout-rate">Payout Rate (QAR per meal) *</Label>
                <Input
                  id="payout-rate"
                  type="number"
                  min="1"
                  step="0.01"
                  value={payoutRate}
                  onChange={(e) => setPayoutRate(e.target.value)}
                  placeholder="25.00"
                />
                <p className="text-xs text-muted-foreground">
                  Default is 25 QAR. This can be adjusted later.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="commission-rate">Commission Rate (%) *</Label>
                <Input
                  id="commission-rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(e.target.value)}
                  placeholder="18"
                />
                <p className="text-xs text-muted-foreground">
                  Platform commission percentage. Default is 18%.
                </p>
              </div>

              {/* Live preview */}
              {parseFloat(payoutRate) > 0 && parseFloat(commissionRate) >= 0 && (
                <div className="rounded-lg bg-muted/60 border p-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Gross/Meal</p>
                    <p className="text-sm font-bold">QAR {parseFloat(payoutRate).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Commission ({commissionRate}%)</p>
                    <p className="text-sm font-bold text-destructive">
                      − QAR {(parseFloat(payoutRate) * parseFloat(commissionRate) / 100).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Restaurant Earns</p>
                    <p className="text-sm font-bold text-emerald-600">
                      QAR {(parseFloat(payoutRate) * (1 - parseFloat(commissionRate) / 100)).toFixed(2)}
                    </p>
                  </div>
                </div>
              )}

              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-sm">
                  <strong>Restaurant:</strong> {restaurantToApprove?.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {restaurantToApprove?.address}
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setApproveDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleApprove} disabled={processing}>
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve Restaurant
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminRestaurants;
