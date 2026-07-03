import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Trash2,
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

  const fetchRestaurants = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

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
  }, [toast]);

  useEffect(() => {
    fetchRestaurants();
  }, [fetchRestaurants]);

  // Load zones when dialog opens
  useEffect(() => {
    if (!addDialogOpen || addZones.length > 0) return;
    setAddLoadingZones(true);
    qnasFetch<QnasZone[]>("/get_zones").then((data) => {
      if (data) setAddZones(data);
      setAddLoadingZones(false);
    });
  }, [addDialogOpen, addZones.length]);

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

  const handleDeleteSelected = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedRestaurants.size} restaurant${selectedRestaurants.size > 1 ? "s" : ""}? This action cannot be undone.`)) {
      return;
    }
    try {
      const ids = [...selectedRestaurants];
      const { error } = await supabase.from("restaurants").delete().in("id", ids);
      if (error) throw error;
      setRestaurants((prev) => prev.filter((r) => !ids.includes(r.id)));
      setSelectedRestaurants(new Set());
      toast({ title: "Restaurants Deleted", description: `${ids.length} restaurant${ids.length > 1 ? "s" : ""} have been removed.` });
    } catch (error) {
      console.error("Error deleting restaurants:", error);
      toast({ title: "Error", description: "Failed to delete restaurants.", variant: "destructive" });
    }
  };

  const handleDeleteRestaurant = async (restaurant: Restaurant) => {
    if (!window.confirm(`Are you sure you want to delete "${restaurant.name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      const { error } = await supabase.from("restaurants").delete().eq("id", restaurant.id);
      if (error) throw error;
      setRestaurants((prev) => prev.filter((r) => r.id !== restaurant.id));
      setIsDetailOpen(false);
      toast({ title: "Restaurant Deleted", description: `${restaurant.name} has been removed.` });
    } catch (error) {
      console.error("Error deleting restaurant:", error);
      toast({ title: "Error", description: "Failed to delete restaurant.", variant: "destructive" });
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
          <Badge variant="outline" className="border-[#FDBA74]/40 bg-[#FFF7ED] text-[#F97316]">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="outline" className="border-[#22C7A1]/20 bg-[#EFFFFA] text-[#22C7A1]">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="border-[#FB6B7A]/20 bg-[#FFF0F2] text-[#FB6B7A]">
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
    <AdminLayout title="Restaurant Network" subtitle={`${stats.pending} partners need review`}>
      <div className="space-y-5 text-[#020617]">
        <section className="overflow-hidden rounded-[24px] bg-white shadow-[0_18px_42px_rgba(2,6,23,0.07)] ring-1 ring-[#E5EAF1]">
          <div className="flex flex-col gap-4 border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#94A3B8]">Operations Control</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-[#020617]">Restaurants</h2>
              <p className="mt-1 text-sm font-semibold text-[#94A3B8]">
                Review onboarding, commission rates, owner details, and approval status.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={exportToCSV}
                className="h-11 gap-2 rounded-[14px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-[#F6F8FB]"
              >
                <Download className="h-4 w-4 text-[#38BDF8]" />
                Export
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={fetchRestaurants}
                disabled={loading}
                className="h-11 w-11 rounded-[14px] border-[#E5EAF1] bg-white text-[#020617] hover:bg-[#F6F8FB]"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <Button
                onClick={() => setAddDialogOpen(true)}
                className="h-11 gap-2 rounded-[14px] bg-[#020617] px-4 font-black text-white hover:bg-[#020617]/90"
              >
                <Plus className="h-4 w-4" />
                Add Restaurant
              </Button>
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Total Restaurants", value: stats.total, Icon: Store, bg: "bg-[#F6F8FB]", color: "text-[#020617]", ring: "ring-[#E5EAF1]" },
              { label: "Pending Review", value: stats.pending, Icon: Clock, bg: "bg-[#FFF7ED]", color: "text-[#F97316]", ring: "ring-[#FDBA74]/35" },
              { label: "Approved", value: stats.approved, Icon: CheckCircle, bg: "bg-[#EFFFFA]", color: "text-[#22C7A1]", ring: "ring-[#22C7A1]/20" },
              { label: "Rejected", value: stats.rejected, Icon: XCircle, bg: "bg-[#FFF0F2]", color: "text-[#FB6B7A]", ring: "ring-[#FB6B7A]/20" },
            ].map(({ label, value, Icon, bg, color, ring }) => (
              <div key={label} className={`rounded-[20px] ${bg} p-4 ring-1 ${ring}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-3xl font-black leading-none text-[#020617]">{value}</p>
                    <p className="mt-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">{label}</p>
                  </div>
                  <div className={`flex h-11 w-11 items-center justify-center rounded-[16px] bg-white ${color} shadow-sm ring-1 ring-white/80`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] bg-white p-4 shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {[
                { value: "all", label: "All", count: stats.total },
                { value: "pending", label: "Pending", count: stats.pending },
                { value: "approved", label: "Approved", count: stats.approved },
                { value: "rejected", label: "Rejected", count: stats.rejected },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value as "all" | "pending" | "approved" | "rejected")}
                  className={`min-h-10 rounded-[14px] px-4 text-sm font-black transition ${
                    activeTab === tab.value
                      ? "bg-[#020617] text-white shadow-[0_10px_20px_rgba(2,6,23,0.14)]"
                      : "bg-[#F6F8FB] text-[#64748B] ring-1 ring-[#E5EAF1] hover:text-[#020617]"
                  }`}
                >
                  {tab.label}
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${activeTab === tab.value ? "bg-white/10 text-white" : "bg-white text-[#94A3B8]"}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="relative min-w-[280px] flex-1">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <Input
                  placeholder="Search by name, address, owner, or email"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] pl-10 font-semibold text-[#020617] placeholder:text-[#94A3B8] focus-visible:ring-[#020617]"
                />
              </div>
              <select
                value={cuisineFilter}
                onChange={(e) => setCuisineFilter(e.target.value)}
                className="h-11 rounded-[14px] border border-[#E5EAF1] bg-[#F6F8FB] px-3 text-sm font-black text-[#020617] outline-none focus:ring-2 focus:ring-[#020617]"
              >
                <option value="all">All Cuisines</option>
                {cuisineTypes.map((cuisine) => (
                  <option key={cuisine} value={cuisine}>
                    {cuisine}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {selectedRestaurants.size > 0 && (
          <div className="flex flex-col gap-3 rounded-[18px] border border-[#7C83F6]/20 bg-[#F3F4FF] p-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-black text-[#020617]">
              {selectedRestaurants.size} restaurant{selectedRestaurants.size > 1 ? "s" : ""} selected
            </span>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="rounded-[12px] border-[#22C7A1]/20 bg-white text-[#22C7A1]">
                Approve Selected
              </Button>
              <Button variant="outline" size="sm" className="rounded-[12px] border-[#FB6B7A]/20 bg-white text-[#FB6B7A]">
                Reject Selected
              </Button>
              <Button variant="outline" size="sm" className="rounded-[12px] border-[#FB6B7A]/20 bg-white text-[#FB6B7A] hover:bg-[#FFF0F2]" onClick={handleDeleteSelected}>
                <Trash2 className="w-3 h-3 mr-1" />
                Delete Selected
              </Button>
            </div>
          </div>
        )}

        <section className="overflow-hidden rounded-[24px] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="flex items-center justify-between gap-3 border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
            <div>
              <h3 className="text-lg font-black text-[#020617]">Partner Directory</h3>
              <p className="text-xs font-bold text-[#94A3B8]">{filteredRestaurants.length} visible from {restaurants.length} total</p>
            </div>
            <Badge variant="outline" className="border-[#38BDF8]/20 bg-[#EFF9FF] text-[#38BDF8]">
              Live network
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[#E5EAF1] hover:bg-transparent">
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
                        <Loader2 className="w-8 h-8 animate-spin text-[#020617]" />
                        <p className="text-sm font-semibold text-[#94A3B8]">Loading restaurants...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredRestaurants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-[18px] bg-[#F6F8FB] flex items-center justify-center ring-1 ring-[#E5EAF1]">
                          <Store className="w-6 h-6 text-[#94A3B8]" />
                        </div>
                        <p className="font-black text-[#020617]">No restaurants found</p>
                        <p className="text-sm font-semibold text-[#94A3B8]">Try adjusting your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRestaurants.map((restaurant) => (
                    <TableRow key={restaurant.id} className="border-[#E5EAF1] transition-colors hover:bg-[#F6F8FB]">
                      <TableCell className="pl-6">
                        <Checkbox
                          checked={selectedRestaurants.has(restaurant.id)}
                          onCheckedChange={() => toggleRestaurantSelection(restaurant.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-[14px] bg-[#F6F8FB] flex items-center justify-center overflow-hidden ring-1 ring-[#E5EAF1]">
                            {restaurant.logo_url ? (
                              <img src={restaurant.logo_url} alt={restaurant.name} className="w-full h-full object-cover" />
                            ) : (
                              <Store className="w-5 h-5 text-[#94A3B8]" />
                            )}
                          </div>
                          <div>
                            <p 
                              className="font-black text-[#020617] cursor-pointer hover:text-[#7C83F6]"
                              onClick={() => navigate(`/admin/restaurants/${restaurant.id}`)}
                            >
                              {restaurant.name}
                            </p>
                            {restaurant.address && (
                              <p className="text-xs font-semibold text-[#94A3B8] flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-[#38BDF8]" />
                                <span className="truncate max-w-[200px]">{restaurant.address}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {restaurant.cuisine_type ? (
                          <Badge variant="outline" className="bg-[#F3F4FF] text-[#7C83F6] border-[#7C83F6]/20">
                            <Utensils className="w-3 h-3 mr-1" />
                            {restaurant.cuisine_type}
                          </Badge>
                        ) : (
                          <span className="text-sm text-[#94A3B8]">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-bold text-[#020617]">{restaurant.owner?.full_name || "Unknown"}</p>
                          {restaurant.email && (
                            <p className="text-xs font-semibold text-[#94A3B8]">{restaurant.email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(restaurant.approval_status)}</TableCell>
                      <TableCell>
                        <span className="text-sm font-black text-[#020617]">
                          {restaurant.commission_rate != null ? `${restaurant.commission_rate}%` : "18%"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm font-semibold text-[#94A3B8]">
                          <Calendar className="w-3 h-3 text-[#38BDF8]" />
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
                                className="h-8 w-8 text-[#22C7A1] hover:text-[#22C7A1] hover:bg-[#EFFFFA]"
                                  onClick={() => openApproveDialog(restaurant)}
                                disabled={processing}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-[#FB6B7A] hover:text-[#FB6B7A] hover:bg-[#FFF0F2]"
                                onClick={() => handleReject(restaurant)}
                                disabled={processing}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-[#020617] hover:bg-[#F6F8FB]">
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
                                  className="text-[#22C7A1] focus:text-[#22C7A1] focus:bg-[#EFFFFA]"
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Approve
                                </DropdownMenuItem>
                              )}
                              {restaurant.approval_status !== "rejected" && (
                                <DropdownMenuItem
                                  onClick={() => handleReject(restaurant)}
                                  className="text-[#FB6B7A] focus:text-[#FB6B7A] focus:bg-[#FFF0F2]"
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Reject
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteRestaurant(restaurant)}
                                className="text-[#FB6B7A] focus:text-[#FB6B7A] focus:bg-[#FFF0F2]"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Restaurant
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        {/* Restaurant Detail Sheet */}
        <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <SheetContent className="w-full border-l border-[#E5EAF1] bg-[#F6F8FB] p-0 sm:max-w-xl">
            {selectedRestaurant && (
              <>
                <SheetHeader className="border-b border-[#E5EAF1] bg-white p-5 text-left">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-[20px] bg-[#F6F8FB] ring-1 ring-[#E5EAF1]">
                      {selectedRestaurant.logo_url ? (
                        <img
                          src={selectedRestaurant.logo_url}
                          alt={selectedRestaurant.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Store className="h-8 w-8 text-[#94A3B8]" />
                      )}
                    </div>
                    <div>
                      <SheetTitle className="text-xl font-black text-[#020617]">{selectedRestaurant.name}</SheetTitle>
                      <SheetDescription className="mt-2">
                        {getStatusBadge(selectedRestaurant.approval_status)}
                      </SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <div className="space-y-4 p-5">
                  {/* Description */}
                  {selectedRestaurant.description && (
                    <section className="rounded-[22px] bg-white p-4 shadow-[0_12px_28px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">About</p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-[#64748B]">{selectedRestaurant.description}</p>
                    </section>
                  )}

                  {/* Contact Info */}
                  <section className="rounded-[22px] bg-white p-4 shadow-[0_12px_28px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Contact Information
                    </p>
                    <div className="mt-4 space-y-3">
                      {selectedRestaurant.address && (
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#EFF9FF] text-[#38BDF8]">
                            <MapPin className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-[#020617]">Address</p>
                            <p className="text-sm font-semibold text-[#94A3B8]">{selectedRestaurant.address}</p>
                          </div>
                        </div>
                      )}
                      {selectedRestaurant.phone && (
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#EFFFFA] text-[#22C7A1]">
                            <Phone className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-[#020617]">Phone</p>
                            <p className="text-sm font-semibold text-[#94A3B8]">{selectedRestaurant.phone}</p>
                          </div>
                        </div>
                      )}
                      {selectedRestaurant.email && (
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#F3F4FF] text-[#7C83F6]">
                            <Mail className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-[#020617]">Email</p>
                            <p className="text-sm font-semibold text-[#94A3B8]">{selectedRestaurant.email}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Owner Info */}
                  <section className="rounded-[22px] bg-white p-4 shadow-[0_12px_28px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">Owner Information</p>
                    <div className="mt-4 flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-[#020617] text-white">
                          <Utensils className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-black text-[#020617]">{selectedRestaurant.owner?.full_name || "Unknown"}</p>
                          <p className="text-xs font-semibold text-[#94A3B8]">
                            Registered {format(new Date(selectedRestaurant.created_at), "MMM d, yyyy")}
                          </p>
                        </div>
                      </div>
                  </section>

                  {/* Actions */}
                  {selectedRestaurant.approval_status === "pending" && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        className="h-12 rounded-[16px] bg-[#020617] font-black text-white hover:bg-[#020617]/90"
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
                        className="h-12 rounded-[16px] border-[#FB6B7A]/25 bg-white font-black text-[#FB6B7A] hover:bg-[#FFF0F2] hover:text-[#FB6B7A]"
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
          <DialogContent className="max-h-[90vh] border-[#E5EAF1] bg-white p-0 shadow-[0_24px_60px_rgba(2,6,23,0.18)] sm:max-w-lg flex flex-col">
            <DialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 text-left">
              <DialogTitle className="flex items-center gap-2 text-xl font-black text-[#020617]">
                <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#020617] text-white">
                  <Store className="h-5 w-5" />
                </span>
                Add New Restaurant
              </DialogTitle>
              <DialogDescription className="font-semibold text-[#94A3B8]">
                Create a new restaurant. You'll be taken to the full detail page to complete the setup.
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 px-5">
            <div className="space-y-4 py-5 text-[#020617]">
              <div className="space-y-2">
                <Label htmlFor="new-name" className="font-black text-[#020617]">Restaurant Name <span className="text-[#FB6B7A]">*</span></Label>
                <Input
                  id="new-name"
                  placeholder="e.g. Healthy Bites"
                  value={newRestaurant.name}
                  onChange={(e) => setNewRestaurant((p) => ({ ...p, name: e.target.value }))}
                  className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] focus-visible:ring-[#020617]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-email" className="font-black text-[#020617]">Email</Label>
                  <Input
                    id="new-email"
                    type="email"
                    placeholder="info@restaurant.qa"
                    value={newRestaurant.email}
                    onChange={(e) => setNewRestaurant((p) => ({ ...p, email: e.target.value }))}
                    className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] focus-visible:ring-[#020617]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-phone" className="font-black text-[#020617]">Phone</Label>
                  <Input
                    id="new-phone"
                    placeholder="+974 XXXX XXXX"
                    value={newRestaurant.phone}
                    onChange={(e) => setNewRestaurant((p) => ({ ...p, phone: e.target.value }))}
                    className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] focus-visible:ring-[#020617]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="new-cuisine" className="font-black text-[#020617]">Cuisine Type</Label>
                  <Input
                    id="new-cuisine"
                    placeholder="e.g. Healthy, Arabic"
                    value={newRestaurant.cuisine_type}
                    onChange={(e) => setNewRestaurant((p) => ({ ...p, cuisine_type: e.target.value }))}
                    className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] focus-visible:ring-[#020617]"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-commission" className="font-black text-[#020617]">Commission Rate (%)</Label>
                  <Input
                    id="new-commission"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    placeholder="18"
                    value={newRestaurant.commission_rate}
                    onChange={(e) => setNewRestaurant((p) => ({ ...p, commission_rate: e.target.value }))}
                    className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] focus-visible:ring-[#020617]"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-description" className="font-black text-[#020617]">Description</Label>
                <Input
                  id="new-description"
                  placeholder="Short description of the restaurant"
                  value={newRestaurant.description}
                  onChange={(e) => setNewRestaurant((p) => ({ ...p, description: e.target.value }))}
                  className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] focus-visible:ring-[#020617]"
                />
              </div>

              {/* QNAS Location Picker */}
              <div className="space-y-3 rounded-[20px] border border-[#38BDF8]/20 bg-[#EFF9FF] p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-white text-[#38BDF8] ring-1 ring-[#38BDF8]/15">
                      <MapPin className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-black text-[#020617]">Qatar Address (QNAS)</span>
                  </div>
                  {addLoadingZones && <span className="animate-pulse text-xs font-bold text-[#38BDF8]">Loading zones...</span>}
                  {!addLoadingZones && addZones.length > 0 && (
                    <span className="text-xs font-bold text-[#38BDF8]">{addZones.length} zones loaded</span>
                  )}
                </div>

                {/* Zone */}
                <div className="space-y-1">
                  <Label className="text-xs font-black text-[#020617]">Zone</Label>
                  <Popover open={addZoneOpen} onOpenChange={setAddZoneOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        disabled={addLoadingZones || addZones.length === 0}
                        className="h-10 w-full justify-between rounded-[13px] border-[#E5EAF1] bg-white text-sm font-bold text-[#020617] hover:bg-[#F6F8FB]"
                      >
                        {addZone
                          ? (() => { const z = addZones.find((z) => z.zone_number === addZone); return z ? `${z.zone_number} - ${z.zone_name_en}` : addZone.toString(); })()
                          : addLoadingZones ? "Loading..." : "Select Zone"}
                        <Search className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[360px] border-[#E5EAF1] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search by zone number or name..." />
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
                                {z.zone_name_ar && <span className="ml-2 text-xs text-[#94A3B8]">{z.zone_name_ar}</span>}
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
                  <Label className="text-xs font-black text-[#020617]">Street</Label>
                  <Select
                    value={addStreet?.toString() ?? ""}
                    onValueChange={(v) => { setAddStreet(Number(v)); setAddBuilding(""); setAddLat(null); setAddLng(null); setAddAddress(""); }}
                    disabled={!addZone || addLoadingStreets}
                  >
                    <SelectTrigger className="h-10 rounded-[13px] border-[#E5EAF1] bg-white text-sm font-bold text-[#020617]">
                      <SelectValue placeholder={!addZone ? "Select Street" : addLoadingStreets ? "Loading..." : "Select Street"} />
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
                  <Label className="text-xs font-black text-[#020617]">Building Number</Label>
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
                    <SelectTrigger className="h-10 rounded-[13px] border-[#E5EAF1] bg-white text-sm font-bold text-[#020617]">
                      <SelectValue placeholder={!addStreet ? "Select Building" : addLoadingBuildings ? "Loading..." : "Select Building"} />
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
                  <div className="space-y-1 rounded-[14px] bg-white p-3 ring-1 ring-[#22C7A1]/15">
                    <p className="text-xs font-black text-[#22C7A1]">Location found - {addLat.toFixed(6)}, {addLng.toFixed(6)}</p>
                    <p className="break-words text-xs font-semibold text-[#94A3B8]">{addAddress}</p>
                  </div>
                )}
              </div>

              <p className="rounded-[16px] bg-[#F6F8FB] p-3 text-xs font-semibold text-[#94A3B8] ring-1 ring-[#E5EAF1]">
                The restaurant will be created as <strong>Approved & Active</strong>. After creation you'll be redirected to the detail page to complete the setup.
              </p>
            </div>
            </ScrollArea>

            <DialogFooter className="border-t border-[#E5EAF1] bg-[#F6F8FB] p-5">
              <Button
                variant="outline"
                onClick={() => setAddDialogOpen(false)}
                className="h-11 rounded-[14px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateRestaurant}
                disabled={adding || !newRestaurant.name.trim()}
                className="h-11 rounded-[14px] bg-[#020617] font-black text-white hover:bg-[#020617]/90"
              >
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
          <DialogContent className="border-[#E5EAF1] bg-white p-0 shadow-[0_24px_60px_rgba(2,6,23,0.18)] sm:max-w-md">
            <DialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 text-left">
              <DialogTitle className="text-xl font-black text-[#020617]">Approve Restaurant</DialogTitle>
              <DialogDescription className="font-semibold text-[#94A3B8]">
                Set the payout rate for {restaurantToApprove?.name}. This is the fixed amount the restaurant will receive per meal prepared.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 p-5 text-[#020617]">
              <div className="space-y-2">
                <Label htmlFor="payout-rate" className="font-black text-[#020617]">Payout Rate (QAR per meal) *</Label>
                <Input
                  id="payout-rate"
                  type="number"
                  min="1"
                  step="0.01"
                  value={payoutRate}
                  onChange={(e) => setPayoutRate(e.target.value)}
                  placeholder="25.00"
                  className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] focus-visible:ring-[#020617]"
                />
                <p className="text-xs font-semibold text-[#94A3B8]">
                  Default is 25 QAR. This can be adjusted later.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="commission-rate" className="font-black text-[#020617]">Commission Rate (%) *</Label>
                <Input
                  id="commission-rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(e.target.value)}
                  placeholder="18"
                  className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] focus-visible:ring-[#020617]"
                />
                <p className="text-xs font-semibold text-[#94A3B8]">
                  Platform commission percentage. Default is 18%.
                </p>
              </div>

              {/* Live preview */}
              {parseFloat(payoutRate) > 0 && parseFloat(commissionRate) >= 0 && (
                <div className="grid grid-cols-3 gap-2 rounded-[18px] border border-[#E5EAF1] bg-[#F6F8FB] p-3 text-center">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.08em] text-[#94A3B8]">Gross</p>
                    <p className="text-sm font-black text-[#020617]">QAR {parseFloat(payoutRate).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.08em] text-[#94A3B8]">Fee</p>
                    <p className="text-sm font-black text-[#FB6B7A]">
                      - QAR {(parseFloat(payoutRate) * parseFloat(commissionRate) / 100).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.08em] text-[#94A3B8]">Earns</p>
                    <p className="text-sm font-black text-[#22C7A1]">
                      QAR {(parseFloat(payoutRate) * (1 - parseFloat(commissionRate) / 100)).toFixed(2)}
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-[18px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                <p className="text-sm font-semibold text-[#020617]">
                  <strong>Restaurant:</strong> {restaurantToApprove?.name}
                </p>
                <p className="text-sm font-semibold text-[#94A3B8]">
                  {restaurantToApprove?.address}
                </p>
              </div>
            </div>

            <DialogFooter className="border-t border-[#E5EAF1] bg-[#F6F8FB] p-5">
              <Button
                variant="outline"
                onClick={() => setApproveDialogOpen(false)}
                className="h-11 rounded-[14px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-white"
              >
                Cancel
              </Button>
              <Button
                onClick={handleApprove}
                disabled={processing}
                className="h-11 rounded-[14px] bg-[#020617] font-black text-white hover:bg-[#020617]/90"
              >
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
