import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Store,
  MapPin,
  Phone,
  Mail,
  Globe,
  CheckCircle,
  XCircle,
  Clock,
  Save,
  Trash2,
  RefreshCw,
  Loader2,
  Package,
  TrendingUp,
  DollarSign,
  Star,
  AlertTriangle,
  Upload,
  Image as ImageIcon,
  Eye,
  MoreHorizontal,
  Users,
  RotateCcw,
  CreditCard,
  Building2,
  Shield,
  History,
  ChevronLeft,
  ChevronRight,
  Search,
  Filter,
  Plus,
  FileSpreadsheet,
  UserPlus,
  KeyRound,
  Copy,
  CheckCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { z } from "zod";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  AreaChart,
  Area,
} from "recharts";
import { formatCurrency } from "@/lib/currency";

// Types
interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  cover_image_url?: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  cuisine_type: string | null;
  approval_status: "pending" | "approved" | "rejected";
  is_active: boolean;
  payout_rate: number | null;
  commission_rate: number | null;
  max_meals_per_day: number | null;
  created_at: string | null;
  updated_at: string | null;
  owner_id: string | null;
  owner: {
    id: string;
    full_name: string | null;
    email: string | null;
  } | null;
}

interface RestaurantDetails {
  id: string;
  restaurant_id: string;
  bank_name: string | null;
  bank_name_encrypted: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_iban: string | null;
  swift_code: string | null;
  alternate_phone: string | null;
  avg_prep_time_minutes: number | null;
  max_meals_per_day: number | null;
  operating_hours: any;
  website_url: string | null;
}

interface RestaurantStats {
  total_orders: number;
  total_revenue: number;
  average_order_value: number;
  rating: number;
  review_count: number;
}

interface Order {
  id: string;
  scheduled_date: string;
  meal_type: string;
  order_status: OrderStatus;
  is_completed: boolean;
  created_at: string;
  meal: {
    name: string;
    price: number;
  };
  profile: {
    full_name: string | null;
    email?: string;
  } | null;
}

type OrderStatus = 
  | "pending" 
  | "confirmed" 
  | "preparing" 
  | "ready" 
  | "out_for_delivery" 
  | "delivered" 
  | "completed" 
  | "cancelled";


interface AuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  field: string;
  oldValue: string;
  newValue: string;
}

// Status configuration for display
const STATUS_CONFIG: Record<OrderStatus, { 
  label: string; 
  color: string;
  bgColor: string;
}> = {
  pending: {
    label: "Pending",
    color: "text-amber-600",
    bgColor: "bg-amber-500/10 border-amber-500/20",
  },
  confirmed: {
    label: "Confirmed",
    color: "text-blue-600",
    bgColor: "bg-blue-500/10 border-blue-500/20",
  },
  preparing: {
    label: "Preparing",
    color: "text-purple-600",
    bgColor: "bg-purple-500/10 border-purple-500/20",
  },
  ready: {
    label: "Ready",
    color: "text-cyan-600",
    bgColor: "bg-cyan-500/10 border-cyan-500/20",
  },
  out_for_delivery: {
    label: "Out for Delivery",
    color: "text-indigo-600",
    bgColor: "bg-indigo-500/10 border-indigo-500/20",
  },
  delivered: {
    label: "Delivered",
    color: "text-green-600",
    bgColor: "bg-green-500/10 border-green-500/20",
  },
  completed: {
    label: "Completed",
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/10 border-emerald-500/20",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-red-600",
    bgColor: "bg-red-500/10 border-red-500/20",
  },
};

// ── QNAS (Qatar National Address System) ────────────────────────────────────
// All calls go through the Supabase edge function proxy to avoid CORS issues.

interface QnasZone { zone_number: number; zone_name_en: string; zone_name_ar: string; }
interface QnasStreet { street_number: number; street_name_en: string; street_name_ar: string; }
interface QnasBuilding { building_number: string; x: string; y: string; }

async function qnasFetch<T>(path: string): Promise<T | null> {
  try {
    const { data, error } = await supabase.functions.invoke("qnas-proxy", {
      body: { path },
    });
    if (error || !data) return null;
    // QNAS returns plain arrays directly
    return data as T;
  } catch {
    return null;
  }
}

// Validation schema
const restaurantSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name must be less than 100 characters"),
  description: z.string().max(500, "Description must be less than 500 characters").nullable(),
  email: z.string().email("Invalid email address").nullable().or(z.literal("")),
  phone: z.string().regex(/^\+?[0-9\s()-]{8,20}$/, "Invalid phone number").nullable().or(z.literal("")),
  website: z.string().url("Invalid URL").nullable().or(z.literal("")),
  address: z.string().max(300, "Address must be less than 300 characters").nullable().or(z.literal("")),
  cuisine_type: z.string().max(50, "Cuisine type must be less than 50 characters").nullable().or(z.literal("")),
  payout_rate: z.number().min(1, "Payout rate must be at least 1").max(1000, "Payout rate must be less than 1000"),
  commission_rate: z.number().min(0, "Commission must be 0% or more").max(100, "Commission cannot exceed 100%"),
  max_meals_per_day: z.number().min(1, "Must be at least 1").max(10000, "Must be less than 10000").nullable(),
  is_active: z.boolean(),
  approval_status: z.enum(["pending", "approved", "rejected"]),
});

type RestaurantFormData = z.infer<typeof restaurantSchema>;

// Analytics data types
interface DailyRevenue {
  date: string;
  revenue: number;
  orders: number;
}

interface RatingDistribution {
  rating: number;
  count: number;
}

const AdminRestaurantDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Main state
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [restaurantDetails, setRestaurantDetails] = useState<RestaurantDetails | null>(null);
  const [stats, setStats] = useState<RestaurantStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Create owner account dialog
  const [ownerDialogOpen, setOwnerDialogOpen] = useState(false);
  const [ownerCreating, setOwnerCreating] = useState(false);
  const [ownerForm, setOwnerForm] = useState({ full_name: "", email: "", password: "" });
  const [ownerCreated, setOwnerCreated] = useState<{ email: string; password: string } | null>(null);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialFormData, setInitialFormData] = useState<RestaurantFormData | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<RestaurantFormData>({
    name: "",
    description: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    cuisine_type: "",
    payout_rate: 25,
    commission_rate: 18,
    max_meals_per_day: 100,
    is_active: true,
    approval_status: "pending",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof RestaurantFormData, string>>>({});
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  // QNAS address state
  const [qnasZones, setQnasZones] = useState<QnasZone[]>([]);
  const [qnasStreets, setQnasStreets] = useState<QnasStreet[]>([]);
  const [qnasBuildings, setQnasBuildings] = useState<QnasBuilding[]>([]);
  const [qnasZone, setQnasZone] = useState<number | null>(null);
  const [qnasStreet, setQnasStreet] = useState<number | null>(null);
  const [qnasBuilding, setQnasBuilding] = useState<string>("");
  const [qnasLat, setQnasLat] = useState<number | null>(null);
  const [qnasLng, setQnasLng] = useState<number | null>(null);
  const [qnasLoadingZones, setQnasLoadingZones] = useState(false);
  const [qnasLoadingStreets, setQnasLoadingStreets] = useState(false);
  const [qnasLoadingBuildings, setQnasLoadingBuildings] = useState(false);
  const [qnasZoneOpen, setQnasZoneOpen] = useState(false);
  
  // Analytics state
  const [revenueData, setRevenueData] = useState<DailyRevenue[]>([]);
  const [ratingDistribution, setRatingDistribution] = useState<RatingDistribution[]>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  
  // Orders state
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderFilter, setOrderFilter] = useState<OrderStatus | "all">("all");
  const [orderSearch, setOrderSearch] = useState("");
  const [orderPage, setOrderPage] = useState(1);
  const [ordersPerPage] = useState(10);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderDetailOpen, setOrderDetailOpen] = useState(false);
  
  // Partner payouts state
  const [restaurantPayouts, setRestaurantPayouts] = useState<Array<{
    id: string;
    amount: number;
    status: string;
    period_start: string;
    period_end: string;
    processed_at: string | null;
    reference_number: string | null;
    payout_method: string | null;
    created_at: string;
  }>>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);

  // Audit log state
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  
  // Image upload state
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // Navigation warning for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges]);

  // Fetch restaurant data
  useEffect(() => {
    if (id) {
      fetchRestaurant();
    }
  }, [id]);

  // QNAS: load zones once on mount
  useEffect(() => {
    setQnasLoadingZones(true);
    qnasFetch<QnasZone[]>("/get_zones").then((data) => {
      if (Array.isArray(data)) setQnasZones(data);
      setQnasLoadingZones(false);
    });
  }, []);

  // QNAS: load streets when zone changes
  useEffect(() => {
    if (!qnasZone) { setQnasStreets([]); setQnasBuildings([]); return; }
    setQnasLoadingStreets(true);
    setQnasStreet(null);
    setQnasBuildings([]);
    qnasFetch<QnasStreet[]>(`/get_streets/${qnasZone}`).then((data) => {
      if (Array.isArray(data)) setQnasStreets(data);
      setQnasLoadingStreets(false);
    });
  }, [qnasZone]);

  // QNAS: load buildings when street changes
  useEffect(() => {
    if (!qnasZone || !qnasStreet) { setQnasBuildings([]); return; }
    setQnasLoadingBuildings(true);
    qnasFetch<QnasBuilding[]>(`/get_buildings/${qnasZone}/${qnasStreet}`).then((data) => {
      if (Array.isArray(data)) setQnasBuildings(data);
      setQnasLoadingBuildings(false);
    });
  }, [qnasZone, qnasStreet]);

  const fetchRestaurant = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      // Fetch restaurant details
      const { data: restaurantData, error: restaurantError } = await supabase
        .from("restaurants")
        .select("*")
        .eq("id", id)
        .single();

      if (restaurantError) throw restaurantError;
      if (!restaurantData) {
        toast({
          title: "Restaurant not found",
          description: "The requested restaurant could not be found.",
          variant: "destructive",
        });
        navigate("/admin/restaurants");
        return;
      }

      // Fetch owner details
      let owner = null;
      if (restaurantData.owner_id) {
        const { data: ownerData } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .eq("user_id", restaurantData.owner_id)
          .single();
        
        if (ownerData) {
          owner = {
            id: ownerData.user_id,
            full_name: ownerData.full_name,
            email: ownerData.email,
          };
        }
      }

      // Fetch restaurant details (banking info, etc.)
      const { data: detailsData } = await supabase
        .from("restaurant_details")
        .select("*")
        .eq("restaurant_id", id)
        .single();

      const restaurantWithOwner: Restaurant = {
        ...restaurantData,
        approval_status: restaurantData.approval_status || "pending",
        is_active: restaurantData.is_active ?? true,
        owner,
      };

      setRestaurant(restaurantWithOwner);
      setRestaurantDetails(detailsData || null);
      
      // Set form data
      const initialData = {
        name: restaurantData.name,
        description: restaurantData.description || "",
        email: restaurantData.email || "",
        phone: restaurantData.phone || "",
        website: restaurantData.website || "",
        address: restaurantData.address || "",
        cuisine_type: restaurantData.cuisine_type || "",
        payout_rate: restaurantData.payout_rate || 25,
        commission_rate: restaurantData.commission_rate ?? 18,
        max_meals_per_day: restaurantData.max_meals_per_day || 100,
        is_active: restaurantData.is_active ?? true,
        approval_status: restaurantData.approval_status || "pending",
      };
      
      setFormData(initialData);
      setInitialFormData(initialData);
      setHasChanges(false);

      // Restore saved QNAS location values
      const rd = restaurantData as any;
      if (rd.zone_number) setQnasZone(rd.zone_number);
      if (rd.street_number) setQnasStreet(rd.street_number);
      if (rd.building_number) setQnasBuilding(rd.building_number);
      if (rd.latitude) setQnasLat(Number(rd.latitude));
      if (rd.longitude) setQnasLng(Number(rd.longitude));

      // Fetch stats
      await fetchRestaurantStats(id);
      
    } catch (error) {
      console.error("Error fetching restaurant:", error);
      toast({
        title: "Error",
        description: "Failed to load restaurant details.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRestaurantStats = async (restaurantId: string) => {
    try {
      // Get order stats
      const { data: ordersData } = await supabase
        .from("meal_schedules")
        .select("created_at, meal_id")
        .eq("restaurant_id", restaurantId);

      // Get meal prices
      const mealIds = [...new Set((ordersData || []).map((o) => o.meal_id).filter(Boolean))];
      let mealsMap: Record<string, number> = {};
      
      if (mealIds.length > 0) {
        const { data: meals } = await supabase
          .from("meals")
          .select("id, price")
          .in("id", mealIds);
        
        if (meals) {
          mealsMap = meals.reduce((acc, m) => {
            acc[m.id] = m.price || 0;
            return acc;
          }, {} as Record<string, number>);
        }
      }

      // Get reviews
      const { data: reviewsData } = await supabase
        .from("restaurant_reviews")
        .select("rating")
        .eq("restaurant_id", restaurantId);

      const totalOrders = ordersData?.length || 0;
      const totalRevenue = (ordersData || []).reduce((sum, order) => {
        return sum + (mealsMap[order.meal_id] || 0);
      }, 0);
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      
      const reviewCount = reviewsData?.length || 0;
      const averageRating = reviewCount > 0 && reviewsData
        ? reviewsData.reduce((sum, review) => sum + (review.rating || 0), 0) / reviewCount
        : 0;

      setStats({
        total_orders: totalOrders,
        total_revenue: totalRevenue,
        average_order_value: averageOrderValue,
        rating: Math.round(averageRating * 10) / 10,
        review_count: reviewCount,
      });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const fetchAnalytics = async () => {
    if (!id) return;
    
    setAnalyticsLoading(true);
    try {
      // Get last 30 days of orders
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: ordersData } = await supabase
        .from("meal_schedules")
        .select("created_at, meal_id")
        .eq("restaurant_id", id)
        .gte("created_at", thirtyDaysAgo.toISOString());

      // Get meal prices
      const mealIds = [...new Set((ordersData || []).map((o) => o.meal_id).filter(Boolean))];
      let mealsMap: Record<string, number> = {};
      
      if (mealIds.length > 0) {
        const { data: meals } = await supabase
          .from("meals")
          .select("id, price")
          .in("id", mealIds);
        
        if (meals) {
          mealsMap = meals.reduce((acc, m) => {
            acc[m.id] = m.price || 0;
            return acc;
          }, {} as Record<string, number>);
        }
      }

      // Build daily revenue data
      const dailyMap: Record<string, { revenue: number; orders: number }> = {};
      
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        dailyMap[dateStr] = { revenue: 0, orders: 0 };
      }

      (ordersData || []).forEach((order) => {
        if (!order.created_at) return;
        const dateStr = new Date(order.created_at).toISOString().split("T")[0];
        if (dailyMap[dateStr]) {
          dailyMap[dateStr].revenue += mealsMap[order.meal_id] || 0;
          dailyMap[dateStr].orders += 1;
        }
      });

      const revenueChartData: DailyRevenue[] = Object.entries(dailyMap).map(([date, data]) => ({
        date: format(new Date(date), "MMM d"),
        revenue: data.revenue,
        orders: data.orders,
      }));

      setRevenueData(revenueChartData);

      // Get rating distribution
      const { data: reviewsData } = await supabase
        .from("restaurant_reviews")
        .select("rating")
        .eq("restaurant_id", id);

      const ratingCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      (reviewsData || []).forEach((review) => {
        const rating = Math.round(review.rating || 0);
        if (rating >= 1 && rating <= 5) {
          ratingCounts[rating]++;
        }
      });

      const ratingChartData: RatingDistribution[] = Object.entries(ratingCounts).map(([rating, count]) => ({
        rating: parseInt(rating),
        count,
      }));

      setRatingDistribution(ratingChartData);
    } catch (error) {
      console.error("Error fetching analytics:", error);
      toast({
        title: "Error",
        description: "Failed to load analytics data.",
        variant: "destructive",
      });
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchOrders = async () => {
    if (!id) return;
    
    setOrdersLoading(true);
    try {
      // Fetch meal schedules (orders) for this restaurant
      const { data: schedulesData, error: schedulesError } = await supabase
        .from("meal_schedules")
        .select(`
          id,
          scheduled_date,
          meal_type,
          is_completed,
          order_status,
          created_at,
          user_id,
          meal_id
        `)
        .eq("restaurant_id", id)
        .order("created_at", { ascending: false });

      if (schedulesError) throw schedulesError;

      // Get meal details
      const mealIds = [...new Set((schedulesData || []).map((o) => o.meal_id).filter(Boolean))];
      let mealsMap: Record<string, { name: string; price: number }> = {};

      if (mealIds.length > 0) {
        const { data: meals } = await supabase
          .from("meals")
          .select("id, name, price")
          .in("id", mealIds);

        if (meals) {
          mealsMap = meals.reduce((acc, m) => {
            acc[m.id] = { name: m.name, price: m.price || 0 };
            return acc;
          }, {} as Record<string, { name: string; price: number }>);
        }
      }

      // Get user profiles
      const userIds = [...new Set((schedulesData || []).map((o) => o.user_id))];
      let profilesMap: Record<string, { full_name: string | null; email?: string }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

        if (profiles) {
          profilesMap = profiles.reduce((acc, p: any) => {
            acc[p.user_id] = { full_name: p.full_name };
            return acc;
          }, {} as Record<string, { full_name: string | null }>);
        }
      }

      const ordersWithDetails: Order[] = (schedulesData || []).map((o: any) => {
        const meal = mealsMap[o.meal_id] || { name: "Unknown", price: 0 };
        
        return {
          id: o.id,
          scheduled_date: o.scheduled_date,
          meal_type: o.meal_type,
          order_status: (o.order_status || "pending") as OrderStatus,
          is_completed: o.is_completed || false,
          created_at: o.created_at,
          meal: {
            name: meal.name,
            price: meal.price,
          },
          profile: profilesMap[o.user_id] || null,
        };
      });

      setOrders(ordersWithDetails);
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast({
        title: "Error",
        description: "Failed to load orders.",
        variant: "destructive",
      });
    } finally {
      setOrdersLoading(false);
    }
  };

  const fetchRestaurantPayouts = async () => {
    if (!id) return;
    setPayoutsLoading(true);
    try {
      const { data, error } = await supabase
        .from("partner_payouts")
        .select("id, amount, status, period_start, period_end, processed_at, reference_number, payout_method, created_at")
        .eq("restaurant_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRestaurantPayouts(data || []);
    } catch (error) {
      console.error("Error fetching restaurant payouts:", error);
    } finally {
      setPayoutsLoading(false);
    }
  };

  // Form handling
  const validateForm = (): boolean => {
    try {
      restaurantSchema.parse(formData);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Partial<Record<keyof RestaurantFormData, string>> = {};
        error.errors.forEach((err) => {
          const path = err.path[0] as keyof RestaurantFormData;
          newErrors[path] = err.message;
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleInputChange = (field: keyof RestaurantFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    
    // Check if value differs from initial
    if (initialFormData) {
      const hasFormChanges = Object.keys(formData).some((key) => {
        const k = key as keyof RestaurantFormData;
        const currentValue = k === field ? value : formData[k];
        const initialValue = initialFormData[k];
        return currentValue !== initialValue;
      });
      setHasChanges(hasFormChanges);
    }
    
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }

    // Add to audit log
    if (initialFormData && initialFormData[field] !== value) {
      addAuditLogEntry(field, String(initialFormData[field] || ""), String(value || ""));
    }
  };

  const addAuditLogEntry = (field: string, oldValue: string, newValue: string) => {
    const entry: AuditLogEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      user: "Admin",
      action: "updated",
      field,
      oldValue,
      newValue,
    };
    
    setAuditLog((prev) => [entry, ...prev].slice(0, 50)); // Keep last 50 entries
  };

  const handleCreateOwner = async () => {
    if (!ownerForm.email || !ownerForm.password || !restaurant?.id) return;
    setOwnerCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-partner-user", {
        body: {
          email: ownerForm.email.trim(),
          password: ownerForm.password,
          full_name: ownerForm.full_name.trim() || ownerForm.email.split("@")[0],
          restaurant_id: restaurant.id,
        },
      });

      if (error || data?.error) throw new Error(data?.error ?? error?.message ?? "Failed to create account");

      // Refresh restaurant so owner info updates
      await fetchRestaurant();
      setOwnerCreated({ email: ownerForm.email.trim(), password: ownerForm.password });
      setOwnerForm({ full_name: "", email: "", password: "" });
      toast({ title: "Owner Account Created", description: `${ownerForm.email} can now log in at /partner/auth` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setOwnerCreating(false);
    }
  };

  const copyPassword = (pwd: string) => {
    navigator.clipboard.writeText(pwd);
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!id) return;
    
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors in the form.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("restaurants")
        .update({
          name: formData.name,
          description: formData.description || null,
          email: formData.email || null,
          phone: formData.phone || null,
          website: formData.website || null,
          address: formData.address || null,
          cuisine_type: formData.cuisine_type || null,
          payout_rate: formData.payout_rate,
          commission_rate: formData.commission_rate,
          max_meals_per_day: formData.max_meals_per_day,
          is_active: formData.is_active,
          approval_status: formData.approval_status,
          zone_number: qnasZone,
          street_number: qnasStreet,
          building_number: qnasBuilding || null,
          latitude: qnasLat,
          longitude: qnasLng,
          updated_at: new Date().toISOString(),
        } as any)
        .eq("id", id);

      if (error) throw error;

      setInitialFormData(formData);
      setHasChanges(false);
      toast({
        title: "Changes Saved",
        description: "Restaurant details have been updated successfully.",
      });

      // Refresh data
      await fetchRestaurant();
    } catch (error) {
      console.error("Error saving restaurant:", error);
      toast({
        title: "Save Failed",
        description: "Failed to save changes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (initialFormData) {
      setFormData(initialFormData);
      setHasChanges(false);
      setErrors({});
      toast({
        title: "Form Reset",
        description: "All changes have been discarded.",
      });
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    
    if (deleteConfirmText !== restaurant?.name) {
      toast({
        title: "Confirmation Failed",
        description: "Please type the restaurant name exactly to confirm deletion.",
        variant: "destructive",
      });
      return;
    }

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("restaurants")
        .update({
          deleted_at: new Date().toISOString(),
          is_active: false,
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Restaurant Deleted",
        description: `${restaurant?.name} has been deleted.`,
      });

      navigate("/admin/restaurants");
    } catch (error) {
      console.error("Error deleting restaurant:", error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete restaurant. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges) {
      const confirmed = window.confirm("You have unsaved changes. Are you sure you want to leave?");
      if (!confirmed) return;
    }
    navigate("/admin/restaurants");
  };

  // Image upload handlers
  const handleImageUpload = async (file: File, type: "logo" | "cover") => {
    if (!id) return;
    
    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (JPG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 5MB",
        variant: "destructive",
      });
      return;
    }

    const setUploading = type === "logo" ? setUploadingLogo : setUploadingCover;
    setUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${id}-${Date.now()}.${fileExt}`;
      const filePath = `${type === "logo" ? "logos" : "covers"}/${fileName}`;
      const bucket = type === "logo" ? "restaurant-logos" : "restaurant-covers";

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      // Update restaurant record
      const updateField = type === "logo" ? "logo_url" : "cover_image_url";
      const { error: updateError } = await supabase
        .from("restaurants")
        .update({ [updateField]: publicUrl })
        .eq("id", id);

      if (updateError) throw updateError;

      // Update local state
      setRestaurant((prev) => prev ? { ...prev, [updateField]: publicUrl } : null);

      toast({
        title: `${type === "logo" ? "Logo" : "Cover image"} uploaded successfully`,
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description: error.message || `Failed to upload ${type}`,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  // Export functionality
  const exportToCSV = () => {
    if (!restaurant) return;

    const headers = ["Field", "Value"];
    const rows = [
      ["ID", restaurant.id],
      ["Name", restaurant.name],
      ["Description", restaurant.description || ""],
      ["Email", restaurant.email || ""],
      ["Phone", restaurant.phone || ""],
      ["Address", restaurant.address || ""],
      ["Cuisine Type", restaurant.cuisine_type || ""],
      ["Website", restaurant.website || ""],
      ["Status", restaurant.is_active ? "Active" : "Inactive"],
      ["Approval Status", restaurant.approval_status],
      ["Payout Rate", String(restaurant.payout_rate)],
      ["Max Meals/Day", String(restaurant.max_meals_per_day)],
      ["Total Orders", String(stats?.total_orders || 0)],
      ["Total Revenue", String(stats?.total_revenue || 0)],
      ["Average Rating", String(stats?.rating || 0)],
      ["Created At", restaurant.created_at || ""],
    ];

    const csv = [headers.join(","), ...rows.map((row) => `"${row[0]}","${row[1]}"`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${restaurant.name}-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Complete",
      description: "Restaurant data exported to CSV.",
    });
  };

  // Filtered orders
  const filteredOrders = orders.filter((order) => {
    const matchesStatus = orderFilter === "all" || order.order_status === orderFilter;
    const matchesSearch = !orderSearch || 
      order.meal.name.toLowerCase().includes(orderSearch.toLowerCase()) ||
      order.profile?.full_name?.toLowerCase().includes(orderSearch.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
  const paginatedOrders = filteredOrders.slice(
    (orderPage - 1) * ordersPerPage,
    orderPage * ordersPerPage
  );

  // UI Helpers
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

  const getOrderStatusBadge = (status: OrderStatus) => {
    const config = STATUS_CONFIG[status];
    return (
      <Badge variant="outline" className={config?.bgColor || "bg-gray-500/10 text-gray-600 border-gray-500/20"}>
        {config?.label || status}
      </Badge>
    );
  };

  const COLORS = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];

  if (loading) {
    return (
      <AdminLayout title="Restaurant Details">
        <div className="flex items-center justify-center h-96">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading restaurant details...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!restaurant) {
    return (
      <AdminLayout title="Restaurant Not Found">
        <div className="flex flex-col items-center justify-center h-96 gap-4">
          <Store className="w-16 h-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Restaurant Not Found</h2>
          <p className="text-muted-foreground">The requested restaurant could not be found.</p>
          <Button onClick={() => navigate("/admin/restaurants")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Restaurants
          </Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={restaurant.name} subtitle={`ID: ${restaurant.id.slice(0, 8)}...`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={handleCancel}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{restaurant.name}</h1>
                {getStatusBadge(restaurant.approval_status)}
                {restaurant.is_active ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-gray-500/10 text-gray-600">
                    Inactive
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Created {restaurant.created_at ? format(new Date(restaurant.created_at as string), "MMM d, yyyy") : "Unknown"} • 
                Last updated {restaurant.updated_at ? format(new Date(restaurant.updated_at as string), "MMM d, yyyy") : "Unknown"}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {hasChanges && (
              <Badge variant="secondary" className="mr-2">
                Unsaved Changes
              </Badge>
            )}
            <Button
              variant="outline"
              onClick={() => fetchRestaurant()}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={!hasChanges}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
            <Button
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || saving}
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-2xl font-bold">{stats.total_orders}</p>
                    <p className="text-xs text-muted-foreground">Total Orders</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-500" />
                  <div>
                    <p className="text-2xl font-bold">{formatCurrency(stats.total_revenue)}</p>
                    <p className="text-xs text-muted-foreground">Total Revenue</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold">{formatCurrency(stats.average_order_value)}</p>
                    <p className="text-xs text-muted-foreground">Avg Order Value</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-500" />
                  <div>
                    <p className="text-2xl font-bold">{stats.rating.toFixed(1)}</p>
                    <p className="text-xs text-muted-foreground">{stats.review_count} Reviews</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="details" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:w-auto">
            <TabsTrigger value="details" className="gap-2">
              <Store className="w-4 h-4" />
              Details
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2" onClick={fetchAnalytics}>
              <TrendingUp className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="orders" className="gap-2" onClick={fetchOrders}>
              <Package className="w-4 h-4" />
              Orders
            </TabsTrigger>
            <TabsTrigger value="payouts" className="gap-2" onClick={fetchRestaurantPayouts}>
              <DollarSign className="w-4 h-4" />
              Payouts
            </TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Form */}
              <div className="lg:col-span-2 space-y-6">
                {/* Images Section */}
                <Card>
                  <CardHeader>
                    <CardTitle>Restaurant Images</CardTitle>
                    <CardDescription>Upload logo and cover image</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Logo Upload */}
                    <div className="space-y-3">
                      <Label className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Restaurant Logo
                      </Label>
                      <div className="flex items-start gap-4">
                        <div className="relative w-24 h-24 rounded-xl border-2 border-dashed border-border bg-muted/50 flex items-center justify-center overflow-hidden">
                          {restaurant.logo_url ? (
                            <>
                              <img
                                src={restaurant.logo_url}
                                alt="Logo"
                                className="w-full h-full object-cover"
                              />
                            </>
                          ) : (
                            <div className="text-center text-muted-foreground">
                              <ImageIcon className="w-8 h-8 mx-auto mb-1 opacity-50" />
                              <span className="text-xs">No logo</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 space-y-2">
                          <input
                            ref={logoInputRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], "logo")}
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={uploadingLogo}
                            onClick={() => logoInputRef.current?.click()}
                            className="gap-2"
                          >
                            {uploadingLogo ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                            {uploadingLogo ? "Uploading..." : "Upload Logo"}
                          </Button>
                          <p className="text-xs text-muted-foreground">
                            JPG, PNG or WebP. Max 5MB. Recommended: 400x400px
                          </p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Cover Image Upload */}
                    <div className="space-y-3">
                      <Label className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Cover Image
                      </Label>
                      <div className="space-y-3">
                        <div className="relative w-full h-32 rounded-xl border-2 border-dashed border-border bg-muted/50 flex items-center justify-center overflow-hidden">
                          {restaurant.cover_image_url ? (
                            <img
                              src={restaurant.cover_image_url}
                              alt="Cover"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="text-center text-muted-foreground">
                              <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                              <span className="text-sm">No cover image</span>
                            </div>
                          )}
                        </div>
                        <input
                          ref={coverInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0], "cover")}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploadingCover}
                          onClick={() => coverInputRef.current?.click()}
                          className="gap-2"
                        >
                          {uploadingCover ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          {uploadingCover ? "Uploading..." : "Upload Cover"}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          JPG, PNG or WebP. Max 5MB. Recommended: 1200x400px
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Basic Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Restaurant Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => handleInputChange("name", e.target.value)}
                        className={errors.name ? "border-red-500" : ""}
                      />
                      {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description || ""}
                        onChange={(e) => handleInputChange("description", e.target.value)}
                        rows={3}
                        className={errors.description ? "border-red-500" : ""}
                      />
                      {errors.description && <p className="text-sm text-red-500">{errors.description}</p>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cuisine_type">Cuisine Type</Label>
                        <Input
                          id="cuisine_type"
                          value={formData.cuisine_type || ""}
                          onChange={(e) => handleInputChange("cuisine_type", e.target.value)}
                          placeholder="e.g., Healthy, Italian, Asian"
                          className={errors.cuisine_type ? "border-red-500" : ""}
                        />
                        {errors.cuisine_type && <p className="text-sm text-red-500">{errors.cuisine_type}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="website">Website</Label>
                        <Input
                          id="website"
                          value={formData.website || ""}
                          onChange={(e) => handleInputChange("website", e.target.value)}
                          placeholder="https://..."
                          className={errors.website ? "border-red-500" : ""}
                        />
                        {errors.website && <p className="text-sm text-red-500">{errors.website}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">

                    {/* ── QNAS Address Picker ── */}
                    <div className="rounded-xl border-2 border-blue-300 bg-blue-600 p-5 space-y-4">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-white" />
                          <span className="text-sm font-bold text-white">Find Qatar Address</span>
                        </div>
                        {qnasLoadingZones && (
                          <div className="flex items-center gap-1 text-xs text-blue-200">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Loading zones…
                          </div>
                        )}
                        {!qnasLoadingZones && qnasZones.length > 0 && (
                          <span className="text-xs text-blue-200">{qnasZones.length} zones loaded</span>
                        )}
                      </div>

                      {/* Zone — searchable combobox */}
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold text-white">
                          Zone | <span className="font-arabic">منطقة</span>
                        </Label>
                        <Popover open={qnasZoneOpen} onOpenChange={setQnasZoneOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              disabled={qnasLoadingZones || qnasZones.length === 0}
                              className="w-full justify-between bg-white border-blue-300 text-blue-700 font-medium h-10 hover:bg-blue-50"
                            >
                              {qnasZone
                                ? (() => {
                                    const z = qnasZones.find((z) => z.zone_number === qnasZone);
                                    return z ? `${z.zone_number} - ${z.zone_name_en}` : qnasZone.toString();
                                  })()
                                : qnasLoadingZones
                                ? "⏱️ Loading List ..."
                                : "Select Zone"}
                              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[380px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Search by zone number or name..." />
                              <CommandList>
                                <CommandEmpty>No zones found.</CommandEmpty>
                                <CommandGroup>
                                  {qnasZones.map((z) => (
                                    <CommandItem
                                      key={z.zone_number}
                                      value={`${z.zone_number} ${z.zone_name_en} ${z.zone_name_ar}`}
                                      onSelect={() => {
                                        setQnasZone(z.zone_number);
                                        setQnasStreet(null);
                                        setQnasBuilding("");
                                        setQnasLat(null);
                                        setQnasLng(null);
                                        setQnasZoneOpen(false);
                                      }}
                                    >
                                      <span className="font-medium mr-1">{z.zone_number}</span>
                                      {" - "}
                                      <span className="ml-1">{z.zone_name_en}</span>
                                      {z.zone_name_ar && (
                                        <span className="text-muted-foreground ml-2 text-xs">{z.zone_name_ar}</span>
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
                        <Label className="text-sm font-semibold text-white">
                          Street | <span className="font-arabic">شارع</span>
                        </Label>
                        <Select
                          value={qnasStreet?.toString() ?? ""}
                          onValueChange={(v) => {
                            setQnasStreet(Number(v));
                            setQnasBuilding("");
                            setQnasLat(null);
                            setQnasLng(null);
                          }}
                          disabled={!qnasZone || qnasLoadingStreets}
                        >
                          <SelectTrigger className="bg-white border-blue-300 text-blue-700 font-medium h-10">
                            <SelectValue placeholder={
                              !qnasZone ? "Select Street" :
                              qnasLoadingStreets ? "⏱️ Loading List ..." : "Select Street"
                            } />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            {qnasStreets.map((s) => (
                              <SelectItem key={s.street_number} value={s.street_number.toString()}>
                                <span className="font-medium">{s.street_number}</span>
                                {" - "}
                                <span>{s.street_name_en}</span>
                                {s.street_name_ar && <span className="text-muted-foreground mr-1"> {s.street_name_ar}</span>}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Building */}
                      <div className="space-y-1">
                        <Label className="text-sm font-semibold text-white">
                          Building Number | <span className="font-arabic">رقم البناية</span>
                        </Label>
                        <Select
                          value={qnasBuilding}
                          onValueChange={(v) => {
                            setQnasBuilding(v);
                            // Find lat/lng from the buildings list
                            const bld = qnasBuildings.find((b) => b.building_number === v);
                            if (bld?.x && bld?.y) {
                              setQnasLat(parseFloat(bld.x));
                              setQnasLng(parseFloat(bld.y));
                              const zone = qnasZones.find((z) => z.zone_number === qnasZone);
                              const street = qnasStreets.find((s) => s.street_number === qnasStreet);
                              const composed = [
                                `Zone ${qnasZone}${zone ? ` - ${zone.zone_name_en}` : ""}`,
                                `Street ${qnasStreet}${street ? ` - ${street.street_name_en}` : ""}`,
                                `Building ${v}`,
                                "Doha, Qatar",
                              ].join(", ");
                              handleInputChange("address", composed);
                            }
                          }}
                          disabled={!qnasStreet || qnasLoadingBuildings}
                        >
                          <SelectTrigger className="bg-white border-blue-300 text-blue-700 font-medium h-10">
                            <SelectValue placeholder={
                              !qnasStreet ? "Select Building" :
                              qnasLoadingBuildings ? "⏱️ Loading List ..." : "Select Building"
                            } />
                          </SelectTrigger>
                          <SelectContent className="max-h-72">
                            {qnasBuildings.map((b) => (
                              <SelectItem key={b.building_number} value={b.building_number}>
                                {b.building_number}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Coordinates + success */}
                      {qnasLat && qnasLng && (
                        <div className="flex items-center gap-2 bg-blue-500/60 rounded-lg px-3 py-2">
                          <MapPin className="w-4 h-4 text-green-300 shrink-0" />
                          <span className="text-xs text-green-200 font-medium">
                            Location found — {qnasLat.toFixed(6)}, {qnasLng.toFixed(6)}
                          </span>
                        </div>
                      )}

                      {/* Map preview */}
                      {qnasLat && qnasLng && (
                        <div className="rounded-lg overflow-hidden border-2 border-blue-400" style={{ height: 240 }}>
                          <iframe
                            title="Restaurant location"
                            width="100%"
                            height="240"
                            style={{ border: 0 }}
                            src={`https://www.openstreetmap.org/export/embed.html?bbox=${qnasLng - 0.006},${qnasLat - 0.006},${qnasLng + 0.006},${qnasLat + 0.006}&layer=mapnik&marker=${qnasLat},${qnasLng}`}
                            loading="lazy"
                          />
                        </div>
                      )}
                    </div>

                    {/* Address text field (auto-filled by QNAS, editable manually) */}
                    <div className="space-y-2">
                      <Label htmlFor="address">
                        <MapPin className="w-4 h-4 inline mr-1" />
                        Address
                        <span className="text-xs text-muted-foreground ml-2">Auto-filled by QNAS or enter manually</span>
                      </Label>
                      <Textarea
                        id="address"
                        value={formData.address || ""}
                        onChange={(e) => handleInputChange("address", e.target.value)}
                        rows={2}
                        className={errors.address ? "border-red-500" : ""}
                      />
                      {errors.address && <p className="text-sm text-red-500">{errors.address}</p>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">
                          <Mail className="w-4 h-4 inline mr-1" />
                          Email
                        </Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email || ""}
                          onChange={(e) => handleInputChange("email", e.target.value)}
                          className={errors.email ? "border-red-500" : ""}
                        />
                        {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone">
                          <Phone className="w-4 h-4 inline mr-1" />
                          Phone
                        </Label>
                        <Input
                          id="phone"
                          value={formData.phone || ""}
                          onChange={(e) => handleInputChange("phone", e.target.value)}
                          className={errors.phone ? "border-red-500" : ""}
                        />
                        {errors.phone && <p className="text-sm text-red-500">{errors.phone}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Business Settings</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="commission_rate">Platform Commission (%) *</Label>
                        <Input
                          id="commission_rate"
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={formData.commission_rate}
                          onChange={(e) => handleInputChange("commission_rate", parseFloat(e.target.value))}
                          className={errors.commission_rate ? "border-red-500" : ""}
                        />
                        {errors.commission_rate && <p className="text-sm text-red-500">{errors.commission_rate}</p>}
                        <p className="text-xs text-muted-foreground">% Nutrio takes from each meal sale</p>
                      </div>

                      {/* Commission preview */}
                      {formData.commission_rate >= 0 && (
                        <div className="sm:col-span-2 rounded-xl bg-muted/60 border p-4 grid grid-cols-2 gap-3 text-center">
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Platform Takes</p>
                            <p className="text-lg font-bold text-destructive">{formData.commission_rate}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Restaurant Earns</p>
                            <p className="text-lg font-bold text-emerald-600">{(100 - formData.commission_rate).toFixed(1)}%</p>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="max_meals_per_day">Max Meals Per Day</Label>
                        <Input
                          id="max_meals_per_day"
                          type="number"
                          min="1"
                          value={formData.max_meals_per_day || ""}
                          onChange={(e) => handleInputChange("max_meals_per_day", e.target.value ? parseInt(e.target.value) : null)}
                          className={errors.max_meals_per_day ? "border-red-500" : ""}
                        />
                        {errors.max_meals_per_day && <p className="text-sm text-red-500">{errors.max_meals_per_day}</p>}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="approval_status">Approval Status</Label>
                        <Select
                          value={formData.approval_status}
                          onValueChange={(value: any) => handleInputChange("approval_status", value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="is_active">Account Status</Label>
                        <Select
                          value={formData.is_active ? "true" : "false"}
                          onValueChange={(value) => handleInputChange("is_active", value === "true")}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">Active</SelectItem>
                            <SelectItem value="false">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Banking Details */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5" />
                      Banking Details
                    </CardTitle>
                    <CardDescription>Secure banking information for payouts</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {restaurantDetails ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <Building2 className="w-4 h-4" />
                              Bank Name
                            </Label>
                            <div className="p-3 bg-muted rounded-lg flex items-center justify-between">
                              <span>{restaurantDetails.bank_name || "Not set"}</span>
                              {restaurantDetails.bank_name_encrypted && (
                                <Shield className="w-4 h-4 text-emerald-500" />
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>Account Name</Label>
                            <div className="p-3 bg-muted rounded-lg">
                              {restaurantDetails.bank_account_name || "Not set"}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <Shield className="w-4 h-4" />
                              Account Number
                            </Label>
                            <div className="p-3 bg-muted rounded-lg font-mono">
                              {restaurantDetails.bank_account_number 
                                ? `****${restaurantDetails.bank_account_number.slice(-4)}`
                                : "Not set"}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>IBAN</Label>
                            <div className="p-3 bg-muted rounded-lg font-mono">
                              {restaurantDetails.bank_iban 
                                ? `****${restaurantDetails.bank_iban.slice(-4)}`
                                : "Not set"}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Shield className="w-4 h-4 text-emerald-500" />
                          <span>Banking information is encrypted and secure</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No banking details available</p>
                        <p className="text-sm">Banking information can be set by the restaurant owner</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="w-4 h-4" />
                        Owner / Login Access
                      </CardTitle>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs"
                        onClick={() => { setOwnerDialogOpen(true); setOwnerCreated(null); }}
                      >
                        <UserPlus className="w-3 h-3" />
                        {restaurant.owner ? "Change Owner" : "Create Account"}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {restaurant.owner ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
                            <Users className="w-4 h-4 text-emerald-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{restaurant.owner.full_name || "Unnamed Owner"}</p>
                            <p className="text-xs text-muted-foreground">{restaurant.owner.email}</p>
                          </div>
                        </div>
                        <p className="text-xs text-emerald-600 flex items-center gap-1">
                          <CheckCheck className="w-3 h-3" /> Can log in at /partner/auth
                        </p>
                        <Button
                          variant="outline"
                          className="w-full text-xs h-8"
                          onClick={() => navigate(`/admin/users?search=${restaurant.owner?.email}`)}
                        >
                          View in Users Panel
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-amber-700">No login account</p>
                            <p className="text-xs text-amber-600">The restaurant owner cannot log in yet.</p>
                          </div>
                        </div>
                        <Button
                          className="w-full gap-2"
                          onClick={() => { setOwnerDialogOpen(true); setOwnerCreated(null); }}
                        >
                          <UserPlus className="w-4 h-4" />
                          Create Owner Account
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => navigate(`/restaurant/${restaurant.id}`)}
                    >
                      <Globe className="w-4 h-4 mr-2" />
                      View Public Page
                    </Button>
                    {restaurant.email && (
                      <Button 
                        variant="outline" 
                        className="w-full justify-start"
                        onClick={() => window.location.href = `mailto:${restaurant.email}`}
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Send Email
                      </Button>
                    )}
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={exportToCSV}
                    >
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Export Data (CSV)
                    </Button>
                  </CardContent>
                </Card>

                {/* Audit Log */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <History className="w-5 h-5" />
                      Recent Changes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {auditLog.length > 0 ? (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {auditLog.slice(0, 10).map((entry) => (
                          <div key={entry.id} className="text-sm border-l-2 border-primary pl-3 py-1">
                            <p className="font-medium capitalize">{entry.field} updated</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(entry.timestamp), "MMM d, h:mm a")}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No recent changes</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            {analyticsLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* Revenue Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Revenue & Orders (Last 30 Days)</CardTitle>
                    <CardDescription>Daily revenue and order volume trends</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={revenueData}>
                          <defs>
                            <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis 
                            dataKey="date" 
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                          />
                          <YAxis 
                            yAxisId="left"
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                            tickFormatter={(value) => `QAR ${value}`}
                          />
                          <YAxis 
                            yAxisId="right"
                            orientation="right"
                            tick={{ fontSize: 12 }}
                            tickLine={false}
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px"
                            }}
                          />
                          <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey="revenue"
                            stroke="#22c55e"
                            fillOpacity={1}
                            fill="url(#colorRevenue)"
                            name="Revenue (QAR)"
                          />
                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="orders"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            dot={{ fill: "#3b82f6", r: 3 }}
                            name="Orders"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Average Order Value */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Average Order Value Trend</CardTitle>
                      <CardDescription>Revenue per order over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={revenueData.map(d => ({
                            ...d,
                            aov: d.orders > 0 ? Math.round(d.revenue / d.orders) : 0
                          }))}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="date" tick={{ fontSize: 12 }} tickLine={false} />
                            <YAxis tick={{ fontSize: 12 }} tickLine={false} tickFormatter={(value) => `QAR ${value}`} />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px"
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="aov"
                              stroke="#8b5cf6"
                              strokeWidth={2}
                              dot={{ fill: "#8b5cf6", r: 3 }}
                              name="Avg Order Value"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Rating Distribution */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Customer Ratings Distribution</CardTitle>
                      <CardDescription>Breakdown of review ratings</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={ratingDistribution}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="rating" tick={{ fontSize: 12 }} tickLine={false} />
                            <YAxis tick={{ fontSize: 12 }} tickLine={false} />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px"
                              }}
                            />
                            <Bar dataKey="count" name="Reviews">
                              {ratingDistribution.map((_entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Order History</CardTitle>
                <CardDescription>View and manage orders for this restaurant</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by meal or customer..."
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select value={orderFilter} onValueChange={(v) => setOrderFilter(v as OrderStatus | "all")}>
                    <SelectTrigger className="w-[180px]">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="preparing">Preparing</SelectItem>
                      <SelectItem value="ready">Ready</SelectItem>
                      <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Orders Table */}
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Meal</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Scheduled</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-20">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ordersLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                          </TableCell>
                        </TableRow>
                      ) : paginatedOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No orders found</p>
                            <p className="text-sm">Try adjusting your filters</p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedOrders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell className="font-mono text-xs">
                              {order.id.slice(0, 8)}...
                            </TableCell>
                            <TableCell>{order.meal.name}</TableCell>
                            <TableCell>{order.profile?.full_name || "Guest"}</TableCell>
                            <TableCell>{formatCurrency(order.meal.price)}</TableCell>
                            <TableCell>{format(new Date(order.scheduled_date), "MMM d, yyyy")}</TableCell>
                            <TableCell>{getOrderStatusBadge(order.order_status)}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setOrderDetailOpen(true);
                                }}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Showing {((orderPage - 1) * ordersPerPage) + 1} to {Math.min(orderPage * ordersPerPage, filteredOrders.length)} of {filteredOrders.length} orders
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOrderPage(p => Math.max(1, p - 1))}
                        disabled={orderPage === 1}
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm">
                        Page {orderPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOrderPage(p => Math.min(totalPages, p + 1))}
                        disabled={orderPage === totalPages}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Order Detail Dialog */}
            <Dialog open={orderDetailOpen} onOpenChange={setOrderDetailOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Order Details</DialogTitle>
                  <DialogDescription>
                    Order ID: {selectedOrder?.id}
                  </DialogDescription>
                </DialogHeader>
                {selectedOrder && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Meal</p>
                        <p className="font-medium">{selectedOrder.meal.name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Price</p>
                        <p className="font-medium">{formatCurrency(selectedOrder.meal.price)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Customer</p>
                        <p className="font-medium">{selectedOrder.profile?.full_name || "Guest"}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Meal Type</p>
                        <p className="font-medium capitalize">{selectedOrder.meal_type}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Scheduled Date</p>
                        <p className="font-medium">{format(new Date(selectedOrder.scheduled_date), "MMM d, yyyy")}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Status</p>
                        {getOrderStatusBadge(selectedOrder.order_status)}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-4">
                      <Button
                        className="flex-1"
                        onClick={() => navigate(`/admin/orders?id=${selectedOrder.id}`)}
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Full Details
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>


          {/* Payouts Tab */}
          <TabsContent value="payouts" className="space-y-6">
            {/* Bank Account Summary */}
            {restaurantDetails && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Bank Account on File
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
                    {[
                      { label: "Bank", value: restaurantDetails.bank_name },
                      { label: "Account Holder", value: restaurantDetails.bank_account_name },
                      {
                        label: "Account Number",
                        value: restaurantDetails.bank_account_number
                          ? "••••" + restaurantDetails.bank_account_number.slice(-4)
                          : null,
                      },
                      {
                        label: "IBAN",
                        value: restaurantDetails.bank_iban
                          ? "••••" + restaurantDetails.bank_iban.slice(-4)
                          : null,
                      },
                      { label: "SWIFT", value: restaurantDetails.swift_code },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className="text-muted-foreground w-36 shrink-0">{label}</span>
                        <span className={value ? "font-medium" : "text-muted-foreground italic"}>
                          {value || "Not set"}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Payout History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Payout Request History</CardTitle>
                <CardDescription>All partner-initiated payout requests for this restaurant</CardDescription>
              </CardHeader>
              <CardContent>
                {payoutsLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : restaurantPayouts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No payout requests yet</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Period</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Reference</TableHead>
                          <TableHead>Requested</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {restaurantPayouts.map((payout) => (
                          <TableRow key={payout.id}>
                            <TableCell className="text-sm">
                              {format(new Date(payout.period_start), "MMM d")} – {format(new Date(payout.period_end), "MMM d, yyyy")}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-emerald-600">
                              {formatCurrency(payout.amount)}
                            </TableCell>
                            <TableCell className="capitalize text-sm text-muted-foreground">
                              {payout.payout_method?.replace(/_/g, " ") || "—"}
                            </TableCell>
                            <TableCell>
                              {payout.status === "completed" ? (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                  <CheckCircle className="h-3 w-3 mr-1" />Completed
                                </Badge>
                              ) : payout.status === "failed" ? (
                                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                  <XCircle className="h-3 w-3 mr-1" />Failed
                                </Badge>
                              ) : payout.status === "processing" ? (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                  <Clock className="h-3 w-3 mr-1" />Processing
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                  <Clock className="h-3 w-3 mr-1" />Pending
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-xs font-mono text-muted-foreground">
                              {payout.reference_number || "—"}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {format(new Date(payout.created_at), "MMM d, yyyy")}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                Delete Restaurant
              </DialogTitle>
              <DialogDescription>
                This action cannot be undone. This will permanently delete {restaurant.name} and all associated data.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">
                  <strong>Warning:</strong> Deleting this restaurant will also remove all associated meals, orders, and reviews.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="confirm-delete">
                  Type <strong>{restaurant.name}</strong> to confirm
                </Label>
                <Input
                  id="confirm-delete"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type restaurant name"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteConfirmText !== restaurant.name || deleting}
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete Restaurant
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      {/* Create Owner Account Dialog */}
      <Dialog open={ownerDialogOpen} onOpenChange={(open) => { setOwnerDialogOpen(open); if (!open) setOwnerCreated(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Create Owner Account
            </DialogTitle>
            <DialogDescription>
              Create a login account for <strong>{restaurant?.name}</strong>. The owner will log in at <code>/partner/auth</code>.
            </DialogDescription>
          </DialogHeader>

          {ownerCreated ? (
            /* Success state — show credentials */
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 space-y-3">
                <p className="text-sm font-semibold text-emerald-700 flex items-center gap-2">
                  <CheckCheck className="w-4 h-4" /> Account created successfully!
                </p>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm font-medium">{ownerCreated.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Password</p>
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-mono bg-muted px-2 py-1 rounded flex-1">{ownerCreated.password}</code>
                      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => copyPassword(ownerCreated.password)}>
                        {passwordCopied ? <CheckCheck className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
                  ⚠️ Share these credentials with the owner now. The password will not be shown again.
                </p>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Login URL: <strong>{window.location.origin}/partner/auth</strong>
              </p>
            </div>
          ) : (
            /* Form state */
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="owner-name">Full Name</Label>
                <Input
                  id="owner-name"
                  placeholder="e.g. Ahmed Al-Rashid"
                  value={ownerForm.full_name}
                  onChange={(e) => setOwnerForm((p) => ({ ...p, full_name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner-email">Email <span className="text-destructive">*</span></Label>
                <Input
                  id="owner-email"
                  type="email"
                  placeholder="owner@restaurant.qa"
                  value={ownerForm.email}
                  onChange={(e) => setOwnerForm((p) => ({ ...p, email: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner-password">Password <span className="text-destructive">*</span></Label>
                <div className="flex gap-2">
                  <Input
                    id="owner-password"
                    type="text"
                    placeholder="Min. 6 characters"
                    value={ownerForm.password}
                    onChange={(e) => setOwnerForm((p) => ({ ...p, password: e.target.value }))}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0 text-xs px-3"
                    onClick={() => setOwnerForm((p) => ({ ...p, password: Math.random().toString(36).slice(2, 10) }))}
                  >
                    Generate
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">The owner will use this to log in. Share it securely.</p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOwnerDialogOpen(false)}>
              {ownerCreated ? "Close" : "Cancel"}
            </Button>
            {!ownerCreated && (
              <Button
                onClick={handleCreateOwner}
                disabled={ownerCreating || !ownerForm.email || !ownerForm.password}
              >
                {ownerCreating ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating…</>
                ) : (
                  <><KeyRound className="w-4 h-4 mr-2" />Create Account</>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      </div>
    </AdminLayout>
  );
};

export default AdminRestaurantDetail;
