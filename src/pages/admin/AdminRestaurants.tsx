import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { downloadCsv } from "@/lib/csv";
import { openExternalUrl } from "@/lib/external-links";
import { AdminLayout } from "@/components/AdminLayout";
import {
  AdminSheetContent,
  AdminDialogContent,
  AdminAlertDialogContent,
  AdminFilterBar,
  AdminKpiStrip,
  AdminWorkbenchHeader,
} from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
interface QnasZone {
  zone_number: number;
  zone_name_en: string;
  zone_name_ar: string;
}
interface QnasStreet {
  street_number: number;
  street_name_en: string;
  street_name_ar: string;
}
interface QnasBuilding {
  building_number: string;
  x: string;
  y: string;
}

async function qnasFetch<T>(path: string): Promise<T | null> {
  try {
    const { data, error } = await supabase.functions.invoke("qnas-proxy", {
      body: { path },
    });
    if (error || !data) return null;
    return Array.isArray(data) ? (data as T) : null;
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
  const [selectedRestaurants, setSelectedRestaurants] = useState<Set<string>>(
    new Set(),
  );
  const [selectedRestaurant, setSelectedRestaurant] =
    useState<Restaurant | null>(null);
  const [activeTab, setActiveTab] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");
  const [cuisineFilter, setCuisineFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<"created_at" | "name">(
    "created_at",
  );
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [restaurantToApprove, setRestaurantToApprove] =
    useState<Restaurant | null>(null);
  const [deleteRequest, setDeleteRequest] = useState<
    | { mode: "single"; restaurant: Restaurant }
    | { mode: "bulk"; ids: string[] }
    | null
  >(null);
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

      const ownerIds = [
        ...new Set(
          (data || [])
            .map((r) => r.owner_id)
            .filter((id): id is string => Boolean(id)),
        ),
      ];
      let ownersMap: Record<
        string,
        { full_name: string | null; email: string | null }
      > = {};

      if (ownerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", ownerIds);

        if (profiles) {
          ownersMap = profiles.reduce(
            (acc, p) => {
              acc[p.user_id] = { full_name: p.full_name, email: null };
              return acc;
            },
            {} as Record<
              string,
              { full_name: string | null; email: string | null }
            >,
          );
        }
      }

      const restaurantsWithOwners: Restaurant[] = (data || []).map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        logo_url: r.logo_url,
        address: r.address,
        phone: r.phone,
        email: r.email,
        cuisine_type: r.cuisine_type,
        website: r.website,
        approval_status: r.approval_status || "pending",
        is_active: r.is_active ?? false,
        payout_rate: r.payout_rate,
        commission_rate: r.commission_rate,
        created_at: r.created_at || new Date(0).toISOString(),
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
    if (!addZone) {
      setAddStreets([]);
      setAddBuildings([]);
      return;
    }
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
    if (!addZone || !addStreet) {
      setAddBuildings([]);
      return;
    }
    setAddLoadingBuildings(true);
    qnasFetch<QnasBuilding[]>(`/get_buildings/${addZone}/${addStreet}`).then(
      (data) => {
        if (data) setAddBuildings(data);
        setAddLoadingBuildings(false);
      },
    );
  }, [addZone, addStreet]);

  const resetAddDialog = () => {
    setNewRestaurant({
      name: "",
      email: "",
      phone: "",
      cuisine_type: "",
      description: "",
      commission_rate: "18",
    });
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
      toast({
        title: "Name required",
        description: "Please enter a restaurant name.",
        variant: "destructive",
      });
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

      toast({
        title: "Restaurant Created",
        description: `${newRestaurant.name} has been created successfully.`,
      });
      setAddDialogOpen(false);
      resetAddDialog();
      navigate(`/admin/restaurants/${data.id}`);
    } catch (error) {
      console.error("Error creating restaurant:", error);
      toast({
        title: "Error",
        description: "Failed to create restaurant. Please try again.",
        variant: "destructive",
      });
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
            ? {
                ...r,
                approval_status: "approved",
                is_active: true,
                payout_rate: rate,
                commission_rate: commRate,
              }
            : r,
        ),
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
          r.id === restaurant.id
            ? { ...r, approval_status: "rejected", is_active: false }
            : r,
        ),
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

  const handleBulkApproveSelected = async () => {
    const ids = [...selectedRestaurants];
    if (ids.length === 0) return;

    try {
      setProcessing(true);
      const { error } = await supabase
        .from("restaurants")
        .update({
          approval_status: "approved",
          is_active: true,
          payout_rate: 25,
          commission_rate: 18,
          payout_rate_set_at: new Date().toISOString(),
        })
        .in("id", ids);

      if (error) throw error;

      setRestaurants((prev) =>
        prev.map((restaurant) =>
          ids.includes(restaurant.id)
            ? {
                ...restaurant,
                approval_status: "approved",
                is_active: true,
                payout_rate: 25,
                commission_rate: 18,
              }
            : restaurant,
        ),
      );
      setSelectedRestaurants(new Set());

      toast({
        title: "Restaurants Approved",
        description: `${ids.length} restaurant${ids.length > 1 ? "s" : ""} approved with standard commission settings.`,
      });
    } catch (error) {
      console.error("Error approving restaurants:", error);
      toast({
        title: "Error",
        description: "Failed to approve selected restaurants.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkRejectSelected = async () => {
    const ids = [...selectedRestaurants];
    if (ids.length === 0) return;

    try {
      setProcessing(true);
      const { error } = await supabase
        .from("restaurants")
        .update({ approval_status: "rejected", is_active: false })
        .in("id", ids);

      if (error) throw error;

      setRestaurants((prev) =>
        prev.map((restaurant) =>
          ids.includes(restaurant.id)
            ? { ...restaurant, approval_status: "rejected", is_active: false }
            : restaurant,
        ),
      );
      setSelectedRestaurants(new Set());

      toast({
        title: "Restaurants Rejected",
        description: `${ids.length} restaurant${ids.length > 1 ? "s" : ""} rejected.`,
      });
    } catch (error) {
      console.error("Error rejecting restaurants:", error);
      toast({
        title: "Error",
        description: "Failed to reject selected restaurants.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  const requestDeleteSelected = () => {
    setDeleteRequest({ mode: "bulk", ids: [...selectedRestaurants] });
  };

  const handleDeleteSelected = async (ids: string[]) => {
    try {
      const { error } = await supabase
        .from("restaurants")
        .delete()
        .in("id", ids);
      if (error) throw error;
      setRestaurants((prev) => prev.filter((r) => !ids.includes(r.id)));
      setSelectedRestaurants(new Set());
      toast({
        title: "Restaurants Deleted",
        description: `${ids.length} restaurant${ids.length > 1 ? "s" : ""} have been removed.`,
      });
    } catch (error) {
      console.error("Error deleting restaurants:", error);
      toast({
        title: "Error",
        description: "Failed to delete restaurants.",
        variant: "destructive",
      });
    }
  };

  const requestDeleteRestaurant = (restaurant: Restaurant) => {
    setDeleteRequest({ mode: "single", restaurant });
  };

  const handleDeleteRestaurant = async (restaurant: Restaurant) => {
    try {
      const { error } = await supabase
        .from("restaurants")
        .delete()
        .eq("id", restaurant.id);
      if (error) throw error;
      setRestaurants((prev) => prev.filter((r) => r.id !== restaurant.id));
      setIsDetailOpen(false);
      toast({
        title: "Restaurant Deleted",
        description: `${restaurant.name} has been removed.`,
      });
    } catch (error) {
      console.error("Error deleting restaurant:", error);
      toast({
        title: "Error",
        description: "Failed to delete restaurant.",
        variant: "destructive",
      });
    }
  };

  const confirmDeleteRequest = async () => {
    if (!deleteRequest) return;
    const request = deleteRequest;
    setDeleteRequest(null);
    if (request.mode === "bulk") {
      await handleDeleteSelected(request.ids);
      return;
    }
    await handleDeleteRestaurant(request.restaurant);
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
    const headers = [
      "Name",
      "Cuisine",
      "Owner",
      "Status",
      "Address",
      "Phone",
      "Email",
      "Created At",
    ];
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

    downloadCsv(
      [headers, ...rows],
      `restaurants-export-${format(new Date(), "yyyy-MM-dd")}.csv`,
    );

    toast({
      title: "Export Complete",
      description: `${rows.length} restaurants exported to CSV.`,
    });
  };

  // Get unique cuisine types
  const cuisineTypes = [
    ...new Set(
      restaurants
        .map((r) => r.cuisine_type)
        .filter((cuisine): cuisine is string => Boolean(cuisine)),
    ),
  ];

  const filteredRestaurants = restaurants
    .filter((r) => {
      const matchesSearch =
        !searchQuery ||
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.address &&
          r.address.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.owner?.full_name &&
          r.owner.full_name
            .toLowerCase()
            .includes(searchQuery.toLowerCase())) ||
        (r.email && r.email.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesTab = activeTab === "all" || r.approval_status === activeTab;
      const matchesCuisine =
        cuisineFilter === "all" || r.cuisine_type === cuisineFilter;
      return matchesSearch && matchesTab && matchesCuisine;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === "created_at") {
        comparison =
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortField === "name") {
        comparison = a.name.localeCompare(b.name);
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge
            variant="outline"
            className="border-[#F97316]/40 bg-[#F97316]/10 text-[#F97316]"
          >
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge
            variant="outline"
            className="border-[#22C7A1]/20 bg-[#22C7A1]/10 text-[#22C7A1]"
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="outline"
            className="border-[#FB6B7A]/20 bg-[#FB6B7A]/10 text-[#FB6B7A]"
          >
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
    approved: restaurants.filter((r) => r.approval_status === "approved")
      .length,
    rejected: restaurants.filter((r) => r.approval_status === "rejected")
      .length,
  };

  return (
    <AdminLayout
      title="Restaurant Network"
      subtitle={`${stats.pending} partners need review`}
    >
      <div className="space-y-5 text-[#020617]">
        <AdminWorkbenchHeader
          eyebrow="Supply network"
          title="Restaurant review desk"
          icon={Store}
          accent="#22C7A1"
          description="Approve partners, check owner records, monitor cuisine coverage, and keep commission setup visible from one workspace."
          meta={[
            { label: "Pending review", value: stats.pending },
            { label: "Approved", value: stats.approved },
            { label: "Selected", value: selectedRestaurants.size },
          ]}
          actions={
            <>
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
                aria-label="Refresh restaurants"
                className="h-11 w-11 rounded-[14px] border-[#E5EAF1] bg-white text-[#020617] hover:bg-[#F6F8FB]"
              >
                <RefreshCw
                  className={`h-4 w-4 text-[#22C7A1] ${
                    loading ? "animate-spin" : ""
                  }`}
                />
              </Button>
              <Button
                variant="outline"
                onClick={() => setAddDialogOpen(true)}
                className="h-11 gap-2 rounded-[14px] border-[#22C7A1]/30 bg-[#22C7A1]/10 px-4 font-black text-[#020617] hover:bg-[#22C7A1]/15"
              >
                <Plus className="h-4 w-4 text-[#22C7A1]" />
                Add Restaurant
              </Button>
            </>
          }
        />

        <AdminKpiStrip
          items={[
            {
              label: "Total Restaurants",
              value: stats.total,
              helper: "Partner records",
              icon: Store,
              accent: "#7C83F6",
            },
            {
              label: "Pending Review",
              value: stats.pending,
              helper: "Needs approval action",
              icon: Clock,
              accent: "#F97316",
            },
            {
              label: "Approved",
              value: stats.approved,
              helper: "Live supply",
              icon: CheckCircle,
              accent: "#22C7A1",
            },
            {
              label: "Rejected",
              value: stats.rejected,
              helper: "Declined onboarding",
              icon: XCircle,
              accent: "#FB6B7A",
            },
          ]}
        />

        <AdminFilterBar title="Partner queue">
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
                  onClick={() =>
                    setActiveTab(
                      tab.value as "all" | "pending" | "approved" | "rejected",
                    )
                  }
                  className={`min-h-11 rounded-[14px] border px-4 text-sm font-black transition ${
                    activeTab === tab.value
                      ? "border-[#22C7A1]/30 bg-[#22C7A1]/10 text-[#020617]"
                      : "border-[#E5EAF1] bg-[#F6F8FB] text-[#94A3B8] hover:text-[#020617]"
                  }`}
                >
                  {tab.label}
                  <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-[11px] text-[#94A3B8]">
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
                  className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] pl-10 font-semibold text-[#020617] placeholder:text-[#94A3B8] focus-visible:ring-[#22C7A1]/30"
                />
              </div>
              <Select value={cuisineFilter} onValueChange={setCuisineFilter}>
                <SelectTrigger className="h-11 min-w-[180px] rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] text-sm font-black text-[#020617] focus:ring-2 focus:ring-[#22C7A1]/30">
                  <SelectValue placeholder="All Cuisines" />
                </SelectTrigger>
                <SelectContent className="rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]">
                  <SelectItem value="all">All Cuisines</SelectItem>
                  {cuisineTypes.map((cuisine) => (
                    <SelectItem key={cuisine} value={cuisine}>
                      {cuisine}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </AdminFilterBar>

        {selectedRestaurants.size > 0 && (
          <div className="flex flex-col gap-3 rounded-[18px] border border-[#7C83F6]/20 bg-[#7C83F6]/10 p-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-black text-[#020617]">
              {selectedRestaurants.size} restaurant
              {selectedRestaurants.size > 1 ? "s" : ""} selected
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="min-h-11 rounded-[12px] border-[#22C7A1]/20 bg-white text-[#22C7A1]"
                onClick={handleBulkApproveSelected}
                disabled={processing}
              >
                Approve Selected
              </Button>
              <Button
                variant="outline"
                className="min-h-11 rounded-[12px] border-[#FB6B7A]/20 bg-white text-[#FB6B7A]"
                onClick={handleBulkRejectSelected}
                disabled={processing}
              >
                Reject Selected
              </Button>
              <Button
                variant="outline"
                className="min-h-11 rounded-[12px] border-[#FB6B7A]/20 bg-white text-[#FB6B7A] hover:bg-[#FB6B7A]/10"
                onClick={requestDeleteSelected}
                disabled={processing}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete Selected
              </Button>
            </div>
          </div>
        )}

        <section className="hidden overflow-hidden rounded-[24px] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1] md:block">
          <div className="flex items-center justify-between gap-3 border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
            <div>
              <h3 className="text-lg font-black text-[#020617]">
                Partner Directory
              </h3>
              <p className="text-xs font-bold text-[#94A3B8]">
                {filteredRestaurants.length} visible from {restaurants.length}{" "}
                total
              </p>
            </div>
            <Badge
              variant="outline"
              className="border-[#38BDF8]/20 bg-[#38BDF8]/10 text-[#38BDF8]"
            >
              Live network
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#F6F8FB]">
                <TableRow className="border-[#E5EAF1] hover:bg-transparent">
                  <TableHead className="w-10 pl-6">
                    <Checkbox
                      checked={
                        selectedRestaurants.size ===
                          filteredRestaurants.length &&
                        filteredRestaurants.length > 0
                      }
                      onCheckedChange={selectAllRestaurants}
                    />
                  </TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                    Restaurant
                  </TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                    Cuisine
                  </TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                    Owner
                  </TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                    Commission
                  </TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                    <button
                      onClick={() => handleSort("created_at")}
                      className="flex min-h-11 items-center gap-1 rounded-2xl px-2 text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8] transition-colors hover:text-[#020617]"
                    >
                      Registered
                      {sortField === "created_at" &&
                        (sortDirection === "asc" ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        ))}
                    </button>
                  </TableHead>
                  <TableHead className="w-20 text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-[#020617]" />
                        <p className="text-sm font-semibold text-[#94A3B8]">
                          Loading restaurants...
                        </p>
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
                        <p className="font-black text-[#020617]">
                          No restaurants found
                        </p>
                        <p className="text-sm font-semibold text-[#94A3B8]">
                          Try adjusting your filters
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRestaurants.map((restaurant) => (
                    <TableRow
                      key={restaurant.id}
                      className="border-[#E5EAF1] transition-colors hover:bg-[#F6F8FB]/70"
                    >
                      <TableCell className="pl-6">
                        <Checkbox
                          checked={selectedRestaurants.has(restaurant.id)}
                          onCheckedChange={() =>
                            toggleRestaurantSelection(restaurant.id)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-[14px] bg-[#F6F8FB] flex items-center justify-center overflow-hidden ring-1 ring-[#E5EAF1]">
                            {restaurant.logo_url ? (
                              <img
                                src={restaurant.logo_url}
                                alt={restaurant.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Store className="w-5 h-5 text-[#94A3B8]" />
                            )}
                          </div>
                          <div>
                            <button
                              type="button"
                              className="-ml-2 inline-flex min-h-11 max-w-full items-center rounded-2xl px-2 text-left font-black text-[#020617] transition-colors hover:text-[#7C83F6]"
                              onClick={() =>
                                navigate(`/admin/restaurants/${restaurant.id}`)
                              }
                            >
                              {restaurant.name}
                            </button>
                            {restaurant.address && (
                              <p className="text-xs font-semibold text-[#94A3B8] flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-[#38BDF8]" />
                                <span className="truncate max-w-[200px]">
                                  {restaurant.address}
                                </span>
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {restaurant.cuisine_type ? (
                          <Badge
                            variant="outline"
                            className="bg-[#7C83F6]/10 text-[#7C83F6] border-[#7C83F6]/20"
                          >
                            <Utensils className="w-3 h-3 mr-1" />
                            {restaurant.cuisine_type}
                          </Badge>
                        ) : (
                          <span className="text-sm text-[#94A3B8]">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-bold text-[#020617]">
                            {restaurant.owner?.full_name || "Unknown"}
                          </p>
                          {restaurant.email && (
                            <p className="text-xs font-semibold text-[#94A3B8]">
                              {restaurant.email}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(restaurant.approval_status)}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-black text-[#020617]">
                          {restaurant.commission_rate != null
                            ? `${restaurant.commission_rate}%`
                            : "18%"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm font-semibold text-[#94A3B8]">
                          <Calendar className="w-3 h-3 text-[#38BDF8]" />
                          {format(
                            new Date(restaurant.created_at),
                            "MMM d, yyyy",
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {restaurant.approval_status === "pending" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11 rounded-2xl text-[#22C7A1] hover:text-[#22C7A1] hover:bg-[#22C7A1]/10"
                                aria-label="Approve restaurant"
                                onClick={() => openApproveDialog(restaurant)}
                                disabled={processing}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11 rounded-2xl text-[#FB6B7A] hover:text-[#FB6B7A] hover:bg-[#FB6B7A]/10"
                                aria-label="Reject restaurant"
                                onClick={() => handleReject(restaurant)}
                                disabled={processing}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11 rounded-2xl text-[#020617] hover:bg-[#F6F8FB]"
                                aria-label="Open restaurant actions"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]"
                            >
                              <DropdownMenuItem
                                onClick={() =>
                                  navigate(
                                    `/admin/restaurants/${restaurant.id}`,
                                  )
                                }
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
                                <DropdownMenuItem
                                  onClick={() => {
                                    openExternalUrl(restaurant.website!);
                                  }}
                                >
                                  <ExternalLink className="w-4 h-4 mr-2" />
                                  Visit Website
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              {restaurant.approval_status !== "approved" && (
                                <DropdownMenuItem
                                  onClick={() => openApproveDialog(restaurant)}
                                  className="text-[#22C7A1] focus:text-[#22C7A1] focus:bg-[#22C7A1]/10"
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Approve
                                </DropdownMenuItem>
                              )}
                              {restaurant.approval_status !== "rejected" && (
                                <DropdownMenuItem
                                  onClick={() => handleReject(restaurant)}
                                  className="text-[#FB6B7A] focus:text-[#FB6B7A] focus:bg-[#FB6B7A]/10"
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Reject
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() =>
                                  requestDeleteRestaurant(restaurant)
                                }
                                className="text-[#FB6B7A] focus:text-[#FB6B7A] focus:bg-[#FB6B7A]/10"
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

        <section className="space-y-3 md:hidden">
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="text-lg font-black text-[#020617]">
                Partner Directory
              </h3>
              <p className="text-xs font-bold text-[#94A3B8]">
                {filteredRestaurants.length} visible from {restaurants.length}{" "}
                total
              </p>
            </div>
            <Badge
              variant="outline"
              className="rounded-full border-[#38BDF8]/20 bg-[#38BDF8]/10 px-3 py-1 text-[#38BDF8]"
            >
              Live
            </Badge>
          </div>

          {loading ? (
            <div className="rounded-[24px] bg-white p-8 text-center ring-1 ring-[#E5EAF1]">
              <Loader2 className="mx-auto h-7 w-7 animate-spin text-[#22C7A1]" />
              <p className="mt-3 text-sm font-bold text-[#94A3B8]">
                Loading restaurants...
              </p>
            </div>
          ) : filteredRestaurants.length === 0 ? (
            <div className="rounded-[24px] bg-white p-8 text-center ring-1 ring-[#E5EAF1]">
              <Store className="mx-auto h-8 w-8 text-[#94A3B8]" />
              <p className="mt-3 font-black text-[#020617]">
                No restaurants found
              </p>
              <p className="text-sm font-semibold text-[#94A3B8]">
                Try changing search or filters.
              </p>
            </div>
          ) : (
            filteredRestaurants.map((restaurant) => (
              <article
                key={restaurant.id}
                className="rounded-[24px] bg-white p-4 shadow-[0_14px_34px_rgba(2,6,23,0.05)] ring-1 ring-[#E5EAF1]"
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedRestaurants.has(restaurant.id)}
                    onCheckedChange={() =>
                      toggleRestaurantSelection(restaurant.id)
                    }
                    className="mt-3"
                  />
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-[#F6F8FB] ring-1 ring-[#E5EAF1]">
                    {restaurant.logo_url ? (
                      <img
                        src={restaurant.logo_url}
                        alt={restaurant.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Store className="h-5 w-5 text-[#94A3B8]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-base font-black text-[#020617]">
                          {restaurant.name}
                        </p>
                        <p className="truncate text-xs font-semibold text-[#94A3B8]">
                          {restaurant.owner?.full_name || "Unknown owner"}
                        </p>
                      </div>
                      {getStatusBadge(restaurant.approval_status)}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {restaurant.cuisine_type && (
                        <Badge
                          variant="outline"
                          className="rounded-full border-[#7C83F6]/20 bg-[#7C83F6]/10 px-2.5 py-1 text-[11px] font-bold text-[#7C83F6]"
                        >
                          {restaurant.cuisine_type}
                        </Badge>
                      )}
                      <Badge
                        variant="outline"
                        className="rounded-full border-[#E5EAF1] bg-[#F6F8FB] px-2.5 py-1 text-[11px] font-bold text-[#94A3B8]"
                      >
                        {restaurant.commission_rate != null
                          ? `${restaurant.commission_rate}%`
                          : "18%"}{" "}
                        commission
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 rounded-[18px] bg-[#F6F8FB] p-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                      Registered
                    </p>
                    <p className="mt-1 text-xs font-black text-[#020617]">
                      {format(new Date(restaurant.created_at), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                      Contact
                    </p>
                    <p className="mt-1 truncate text-xs font-black text-[#020617]">
                      {restaurant.email || restaurant.phone || "Not set"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    className="h-11 rounded-[16px] border-[#E5EAF1] bg-white font-black text-[#020617]"
                    onClick={() =>
                      navigate(`/admin/restaurants/${restaurant.id}`)
                    }
                  >
                    <ExternalLink className="mr-2 h-4 w-4 text-[#38BDF8]" />
                    Open
                  </Button>
                  {restaurant.approval_status === "pending" ? (
                    <Button
                      variant="outline"
                      className="h-11 rounded-[16px] border-[#22C7A1]/30 bg-[#22C7A1]/10 font-black text-[#020617] hover:bg-[#22C7A1]/15"
                      onClick={() => openApproveDialog(restaurant)}
                      disabled={processing}
                    >
                      <CheckCircle className="mr-2 h-4 w-4 text-[#22C7A1]" />
                      Approve
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      className="h-11 rounded-[16px] border-[#E5EAF1] bg-white font-black text-[#020617]"
                      onClick={() => {
                        setSelectedRestaurant(restaurant);
                        setIsDetailOpen(true);
                      }}
                    >
                      <Eye className="mr-2 h-4 w-4 text-[#7C83F6]" />
                      View
                    </Button>
                  )}
                </div>
              </article>
            ))
          )}
        </section>

        {/* Restaurant Detail Sheet */}
        <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <AdminSheetContent size="xl">
            {selectedRestaurant && (
              <>
                <SheetHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 text-left">
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
                      <SheetTitle className="text-xl font-black text-[#020617]">
                        {selectedRestaurant.name}
                      </SheetTitle>
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
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                        About
                      </p>
                      <p className="mt-2 text-sm font-semibold leading-6 text-[#94A3B8]">
                        {selectedRestaurant.description}
                      </p>
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
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#38BDF8]/10 text-[#38BDF8]">
                            <MapPin className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-[#020617]">
                              Address
                            </p>
                            <p className="text-sm font-semibold text-[#94A3B8]">
                              {selectedRestaurant.address}
                            </p>
                          </div>
                        </div>
                      )}
                      {selectedRestaurant.phone && (
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#22C7A1]/10 text-[#22C7A1]">
                            <Phone className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-[#020617]">
                              Phone
                            </p>
                            <p className="text-sm font-semibold text-[#94A3B8]">
                              {selectedRestaurant.phone}
                            </p>
                          </div>
                        </div>
                      )}
                      {selectedRestaurant.email && (
                        <div className="flex items-start gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#7C83F6]/10 text-[#7C83F6]">
                            <Mail className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-black text-[#020617]">
                              Email
                            </p>
                            <p className="text-sm font-semibold text-[#94A3B8]">
                              {selectedRestaurant.email}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </section>

                  {/* Owner Info */}
                  <section className="rounded-[22px] bg-white p-4 shadow-[0_12px_28px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Owner Information
                    </p>
                    <div className="mt-4 flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-[15px] bg-[#22C7A1]/10 text-[#22C7A1] ring-1 ring-[#22C7A1]/20">
                        <Utensils className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-black text-[#020617]">
                          {selectedRestaurant.owner?.full_name || "Unknown"}
                        </p>
                        <p className="text-xs font-semibold text-[#94A3B8]">
                          Registered{" "}
                          {format(
                            new Date(selectedRestaurant.created_at),
                            "MMM d, yyyy",
                          )}
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* Actions */}
                  {selectedRestaurant.approval_status === "pending" && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        variant="outline"
                        className="h-12 rounded-[16px] border-[#22C7A1]/30 bg-[#22C7A1]/10 font-black text-[#020617] hover:bg-[#22C7A1]/15"
                        onClick={() => {
                          openApproveDialog(selectedRestaurant);
                          setIsDetailOpen(false);
                        }}
                        disabled={processing}
                      >
                        <CheckCircle className="mr-2 h-4 w-4 text-[#22C7A1]" />
                        Approve Restaurant
                      </Button>
                      <Button
                        variant="outline"
                        className="h-12 rounded-[16px] border-[#FB6B7A]/25 bg-white font-black text-[#FB6B7A] hover:bg-[#FB6B7A]/10 hover:text-[#FB6B7A]"
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
          </AdminSheetContent>
        </Sheet>

        {/* Add Restaurant Dialog */}
        <Dialog
          open={addDialogOpen}
          onOpenChange={(open) => {
            setAddDialogOpen(open);
            if (!open) resetAddDialog();
          }}
        >
          <AdminDialogContent size="form" className="flex flex-col">
            <DialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 text-left">
              <DialogTitle className="flex items-center gap-2 text-xl font-black text-[#020617]">
                <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#22C7A1]/10 text-[#22C7A1] ring-1 ring-[#22C7A1]/20">
                  <Store className="h-5 w-5" />
                </span>
                Add New Restaurant
              </DialogTitle>
              <DialogDescription className="font-semibold text-[#94A3B8]">
                Create a new restaurant. You'll be taken to the full detail page
                to complete the setup.
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="flex-1 px-5">
              <div className="space-y-4 py-5 text-[#020617]">
                <div className="space-y-2">
                  <Label
                    htmlFor="new-name"
                    className="font-black text-[#020617]"
                  >
                    Restaurant Name <span className="text-[#FB6B7A]">*</span>
                  </Label>
                  <Input
                    id="new-name"
                    placeholder="e.g. Healthy Bites"
                    value={newRestaurant.name}
                    onChange={(e) =>
                      setNewRestaurant((p) => ({ ...p, name: e.target.value }))
                    }
                    className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] focus-visible:ring-[#020617]"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="new-email"
                      className="font-black text-[#020617]"
                    >
                      Email
                    </Label>
                    <Input
                      id="new-email"
                      type="email"
                      placeholder="info@restaurant.qa"
                      value={newRestaurant.email}
                      onChange={(e) =>
                        setNewRestaurant((p) => ({
                          ...p,
                          email: e.target.value,
                        }))
                      }
                      className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] focus-visible:ring-[#020617]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="new-phone"
                      className="font-black text-[#020617]"
                    >
                      Phone
                    </Label>
                    <Input
                      id="new-phone"
                      placeholder="+974 XXXX XXXX"
                      value={newRestaurant.phone}
                      onChange={(e) =>
                        setNewRestaurant((p) => ({
                          ...p,
                          phone: e.target.value,
                        }))
                      }
                      className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] focus-visible:ring-[#020617]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label
                      htmlFor="new-cuisine"
                      className="font-black text-[#020617]"
                    >
                      Cuisine Type
                    </Label>
                    <Input
                      id="new-cuisine"
                      placeholder="e.g. Healthy, Arabic"
                      value={newRestaurant.cuisine_type}
                      onChange={(e) =>
                        setNewRestaurant((p) => ({
                          ...p,
                          cuisine_type: e.target.value,
                        }))
                      }
                      className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] focus-visible:ring-[#020617]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label
                      htmlFor="new-commission"
                      className="font-black text-[#020617]"
                    >
                      Commission Rate (%)
                    </Label>
                    <Input
                      id="new-commission"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder="18"
                      value={newRestaurant.commission_rate}
                      onChange={(e) =>
                        setNewRestaurant((p) => ({
                          ...p,
                          commission_rate: e.target.value,
                        }))
                      }
                      className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] focus-visible:ring-[#020617]"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label
                    htmlFor="new-description"
                    className="font-black text-[#020617]"
                  >
                    Description
                  </Label>
                  <Input
                    id="new-description"
                    placeholder="Short description of the restaurant"
                    value={newRestaurant.description}
                    onChange={(e) =>
                      setNewRestaurant((p) => ({
                        ...p,
                        description: e.target.value,
                      }))
                    }
                    className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] focus-visible:ring-[#020617]"
                  />
                </div>

                {/* QNAS Location Picker */}
                <div className="space-y-3 rounded-[20px] border border-[#38BDF8]/20 bg-[#38BDF8]/10 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-white text-[#38BDF8] ring-1 ring-[#38BDF8]/15">
                        <MapPin className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-black text-[#020617]">
                        Qatar Address (QNAS)
                      </span>
                    </div>
                    {addLoadingZones && (
                      <span className="animate-pulse text-xs font-bold text-[#38BDF8]">
                        Loading zones...
                      </span>
                    )}
                    {!addLoadingZones && addZones.length > 0 && (
                      <span className="text-xs font-bold text-[#38BDF8]">
                        {addZones.length} zones loaded
                      </span>
                    )}
                  </div>

                  {/* Zone */}
                  <div className="space-y-1">
                    <Label className="text-xs font-black text-[#020617]">
                      Zone
                    </Label>
                    <Popover open={addZoneOpen} onOpenChange={setAddZoneOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          disabled={addLoadingZones || addZones.length === 0}
                          className="h-11 w-full justify-between rounded-2xl border-[#E5EAF1] bg-white text-sm font-bold text-[#020617] hover:bg-[#F6F8FB]"
                        >
                          {addZone
                            ? (() => {
                                const z = addZones.find(
                                  (z) => z.zone_number === addZone,
                                );
                                return z
                                  ? `${z.zone_number} - ${z.zone_name_en}`
                                  : addZone.toString();
                              })()
                            : addLoadingZones
                              ? "Loading..."
                              : "Select Zone"}
                          <Search className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[calc(100vw-32px)] max-w-[360px] overflow-hidden rounded-[22px] border-[#E5EAF1] bg-white p-0 text-[#020617] shadow-[0_18px_44px_rgba(2,6,23,0.12)]"
                        align="start"
                      >
                        <Command className="bg-white text-[#020617]">
                          <CommandInput
                            placeholder="Search by zone number or name..."
                            className="h-12 border-b border-[#E5EAF1] text-sm font-semibold text-[#020617] placeholder:text-[#94A3B8]"
                          />
                          <CommandList className="max-h-[280px] p-1">
                            <CommandEmpty className="py-8 text-center text-sm font-semibold text-[#94A3B8]">
                              No zones found.
                            </CommandEmpty>
                            <CommandGroup className="p-1">
                              {addZones.map((z) => (
                                <CommandItem
                                  key={z.zone_number}
                                  value={`${z.zone_number} ${z.zone_name_en} ${z.zone_name_ar}`}
                                  className="min-h-11 rounded-2xl px-3 font-semibold text-[#020617] data-[selected=true]:bg-[#F6F8FB]"
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
                                  <span className="font-medium mr-1 text-[#020617]">
                                    {z.zone_number}
                                  </span>
                                  {" - "}
                                  <span className="ml-1 text-[#020617]">
                                    {z.zone_name_en}
                                  </span>
                                  {z.zone_name_ar && (
                                    <span className="ml-2 text-xs text-[#94A3B8]">
                                      {z.zone_name_ar}
                                    </span>
                                  )}
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
                    <Label className="text-xs font-black text-[#020617]">
                      Street
                    </Label>
                    <Select
                      value={addStreet?.toString() ?? ""}
                      onValueChange={(v) => {
                        setAddStreet(Number(v));
                        setAddBuilding("");
                        setAddLat(null);
                        setAddLng(null);
                        setAddAddress("");
                      }}
                      disabled={!addZone || addLoadingStreets}
                    >
                      <SelectTrigger className="h-11 rounded-[13px] border-[#E5EAF1] bg-white text-sm font-bold text-[#020617]">
                        <SelectValue
                          placeholder={
                            !addZone
                              ? "Select Street"
                              : addLoadingStreets
                                ? "Loading..."
                                : "Select Street"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]">
                        {addStreets.map((s) => (
                          <SelectItem
                            key={s.street_number}
                            value={s.street_number.toString()}
                          >
                            <span className="font-medium">
                              {s.street_number}
                            </span>
                            {" - "}
                            <span>{s.street_name_en}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Building */}
                  <div className="space-y-1">
                    <Label className="text-xs font-black text-[#020617]">
                      Building Number
                    </Label>
                    <Select
                      value={addBuilding}
                      onValueChange={(v) => {
                        setAddBuilding(v);
                        const bld = addBuildings.find(
                          (b) => b.building_number === v,
                        );
                        if (bld) {
                          const lat = parseFloat(bld.x);
                          const lng = parseFloat(bld.y);
                          setAddLat(lat);
                          setAddLng(lng);
                          const zone = addZones.find(
                            (z) => z.zone_number === addZone,
                          );
                          const street = addStreets.find(
                            (s) => s.street_number === addStreet,
                          );
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
                      <SelectTrigger className="h-11 rounded-[13px] border-[#E5EAF1] bg-white text-sm font-bold text-[#020617]">
                        <SelectValue
                          placeholder={
                            !addStreet
                              ? "Select Building"
                              : addLoadingBuildings
                                ? "Loading..."
                                : "Select Building"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]">
                        {addBuildings.map((b) => (
                          <SelectItem
                            key={b.building_number}
                            value={b.building_number}
                          >
                            {b.building_number}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Result */}
                  {addLat && addLng && (
                    <div className="space-y-1 rounded-[14px] bg-white p-3 ring-1 ring-[#22C7A1]/15">
                      <p className="text-xs font-black text-[#22C7A1]">
                        Location found - {addLat.toFixed(6)},{" "}
                        {addLng.toFixed(6)}
                      </p>
                      <p className="break-words text-xs font-semibold text-[#94A3B8]">
                        {addAddress}
                      </p>
                    </div>
                  )}
                </div>

                <p className="rounded-[16px] bg-[#F6F8FB] p-3 text-xs font-semibold text-[#94A3B8] ring-1 ring-[#E5EAF1]">
                  The restaurant will be created as{" "}
                  <strong>Approved & Active</strong>. After creation you'll be
                  redirected to the detail page to complete the setup.
                </p>
              </div>
            </ScrollArea>

            <DialogFooter className="gap-2 sm:gap-3 border-t border-[#E5EAF1] bg-[#F6F8FB] p-5">
              <Button
                variant="outline"
                onClick={() => setAddDialogOpen(false)}
                className="h-11 rounded-[14px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-white"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={handleCreateRestaurant}
                disabled={adding || !newRestaurant.name.trim()}
                className="h-11 rounded-[14px] border-[#22C7A1]/30 bg-[#22C7A1]/10 font-black text-[#020617] hover:bg-[#22C7A1]/15"
              >
                {adding ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4 text-[#22C7A1]" />
                    Create Restaurant
                  </>
                )}
              </Button>
            </DialogFooter>
          </AdminDialogContent>
        </Dialog>

        {/* Approval Dialog with Payout Rate */}
        <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
          <AdminDialogContent size="md">
            <DialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 text-left">
              <DialogTitle className="text-xl font-black text-[#020617]">
                Approve Restaurant
              </DialogTitle>
              <DialogDescription className="font-semibold text-[#94A3B8]">
                Set the payout rate for {restaurantToApprove?.name}. This is the
                fixed amount the restaurant will receive per meal prepared.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 p-5 text-[#020617]">
              <div className="space-y-2">
                <Label
                  htmlFor="payout-rate"
                  className="font-black text-[#020617]"
                >
                  Payout Rate (QAR per meal) *
                </Label>
                <Input
                  id="payout-rate"
                  type="number"
                  min="1"
                  step="0.01"
                  value={payoutRate}
                  onChange={(e) => setPayoutRate(e.target.value)}
                  placeholder="25.00"
                  className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] focus-visible:ring-[#22C7A1]/30"
                />
                <p className="text-xs font-semibold text-[#94A3B8]">
                  Default is 25 QAR. This can be adjusted later.
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="commission-rate"
                  className="font-black text-[#020617]"
                >
                  Commission Rate (%) *
                </Label>
                <Input
                  id="commission-rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={commissionRate}
                  onChange={(e) => setCommissionRate(e.target.value)}
                  placeholder="18"
                  className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] font-semibold text-[#020617] focus-visible:ring-[#22C7A1]/30"
                />
                <p className="text-xs font-semibold text-[#94A3B8]">
                  Platform commission percentage. Default is 18%.
                </p>
              </div>

              {/* Live preview */}
              {parseFloat(payoutRate) > 0 &&
                parseFloat(commissionRate) >= 0 && (
                  <div className="grid grid-cols-3 gap-2 rounded-[18px] border border-[#E5EAF1] bg-[#F6F8FB] p-3 text-center">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.08em] text-[#94A3B8]">
                        Gross
                      </p>
                      <p className="text-sm font-black text-[#020617]">
                        QAR {parseFloat(payoutRate).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.08em] text-[#94A3B8]">
                        Fee
                      </p>
                      <p className="text-sm font-black text-[#FB6B7A]">
                        - QAR{" "}
                        {(
                          (parseFloat(payoutRate) *
                            parseFloat(commissionRate)) /
                          100
                        ).toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.08em] text-[#94A3B8]">
                        Earns
                      </p>
                      <p className="text-sm font-black text-[#22C7A1]">
                        QAR{" "}
                        {(
                          parseFloat(payoutRate) *
                          (1 - parseFloat(commissionRate) / 100)
                        ).toFixed(2)}
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

            <DialogFooter className="gap-2 sm:gap-3 border-t border-[#E5EAF1] bg-[#F6F8FB] p-5">
              <Button
                variant="outline"
                onClick={() => setApproveDialogOpen(false)}
                className="h-11 rounded-[14px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-white"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={handleApprove}
                disabled={processing}
                className="h-11 rounded-[14px] border-[#22C7A1]/30 bg-[#22C7A1]/10 font-black text-[#020617] hover:bg-[#22C7A1]/15"
              >
                {processing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4 text-[#22C7A1]" />
                    Approve Restaurant
                  </>
                )}
              </Button>
            </DialogFooter>
          </AdminDialogContent>
        </Dialog>

        <AlertDialog
          open={!!deleteRequest}
          onOpenChange={(open) => !open && setDeleteRequest(null)}
        >
          <AdminAlertDialogContent>
            <AlertDialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4 text-left">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FB6B7A]/10 text-[#FB6B7A]">
                  <Trash2 className="h-5 w-5" />
                </span>
                <div>
                  <AlertDialogTitle className="text-xl font-black text-[#020617]">
                    Delete restaurant{deleteRequest?.mode === "bulk" ? "s" : ""}
                    ?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="mt-1 font-semibold leading-6 text-[#94A3B8]">
                    {deleteRequest?.mode === "bulk"
                      ? `${deleteRequest.ids.length} selected restaurant${deleteRequest.ids.length > 1 ? "s" : ""} will be removed from the partner directory.`
                      : `${deleteRequest?.restaurant.name || "This restaurant"} will be removed from the partner directory.`}
                  </AlertDialogDescription>
                </div>
              </div>
            </AlertDialogHeader>
            <div className="px-5 py-4">
              <div className="rounded-[20px] border border-[#FB6B7A]/20 bg-[#FB6B7A]/10 p-4">
                <p className="text-sm font-black text-[#020617]">
                  This action cannot be undone.
                </p>
                <p className="mt-1 text-sm font-semibold leading-6 text-[#94A3B8]">
                  Use delete only for duplicate or invalid partner records. For
                  operational pauses, update approval or active status instead.
                </p>
              </div>
            </div>
            <AlertDialogFooter className="gap-2 sm:gap-3 border-t border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
              <AlertDialogCancel className="min-h-[44px] rounded-2xl border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-white">
                Keep restaurant{deleteRequest?.mode === "bulk" ? "s" : ""}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDeleteRequest}
                className="min-h-[44px] rounded-2xl bg-[#FB6B7A] font-black text-white hover:bg-[#FB6B7A]/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AdminAlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
};

export default AdminRestaurants;
