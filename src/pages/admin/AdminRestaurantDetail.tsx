import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AdminDialogContent,
  AdminPanel,
  AdminWorkbenchHeader,
} from "@/components/admin/AdminPrimitives";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { cn } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  FileSpreadsheet,
  UserPlus,
  CheckCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
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
import {
  getPartnerBankingSummary,
  type PartnerBankingSummary,
} from "@/lib/partner-banking";

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
  bank_name_masked: string | null;
  bank_account_name_masked: string | null;
  bank_account_number_masked: string | null;
  bank_iban_masked: string | null;
  swift_code_masked: string | null;
  payout_frequency: PartnerBankingSummary["payout_frequency"];
  is_configured: boolean;
  banking_updated_at: string | null;
  alternate_phone: string | null;
  avg_prep_time_minutes: number | null;
  max_meals_per_day: number | null;
  operating_hours: Json | null;
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
  meal_type: string | null;
  order_status: OrderStatus;
  is_completed: boolean;
  created_at: string | null;
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
const STATUS_CONFIG: Record<
  OrderStatus,
  {
    label: string;
    color: string;
    bgColor: string;
  }
> = {
  pending: {
    label: "Pending",
    color: "text-[#F97316]",
    bgColor: "border-[#F97316]/20 bg-[#F97316]/10 text-[#F97316]",
  },
  confirmed: {
    label: "Confirmed",
    color: "text-[#38BDF8]",
    bgColor: "border-[#38BDF8]/20 bg-[#38BDF8]/10 text-[#38BDF8]",
  },
  preparing: {
    label: "Preparing",
    color: "text-[#7C83F6]",
    bgColor: "border-[#7C83F6]/20 bg-[#7C83F6]/10 text-[#7C83F6]",
  },
  ready: {
    label: "Ready",
    color: "text-[#38BDF8]",
    bgColor: "border-[#38BDF8]/20 bg-[#38BDF8]/10 text-[#38BDF8]",
  },
  out_for_delivery: {
    label: "Out for Delivery",
    color: "text-[#7C83F6]",
    bgColor: "border-[#7C83F6]/20 bg-[#7C83F6]/10 text-[#7C83F6]",
  },
  delivered: {
    label: "Delivered",
    color: "text-[#22C7A1]",
    bgColor: "border-[#22C7A1]/20 bg-[#22C7A1]/10 text-[#22C7A1]",
  },
  completed: {
    label: "Completed",
    color: "text-[#22C7A1]",
    bgColor: "border-[#22C7A1]/20 bg-[#22C7A1]/10 text-[#22C7A1]",
  },
  cancelled: {
    label: "Cancelled",
    color: "text-[#FB6B7A]",
    bgColor: "border-[#FB6B7A]/20 bg-[#FB6B7A]/10 text-[#FB6B7A]",
  },
};

// ── QNAS (Qatar National Address System) ────────────────────────────────────
// All calls go through the Supabase edge function proxy to avoid CORS issues.

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
    // QNAS returns plain arrays directly
    return data as T;
  } catch {
    return null;
  }
}

// Validation schema
const restaurantSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be less than 100 characters"),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .nullable(),
  email: z.string().email("Invalid email address").nullable().or(z.literal("")),
  phone: z
    .string()
    .regex(/^\+?[0-9\s()-]{8,20}$/, "Invalid phone number")
    .nullable()
    .or(z.literal("")),
  website: z.string().url("Invalid URL").nullable().or(z.literal("")),
  address: z
    .string()
    .max(300, "Address must be less than 300 characters")
    .nullable()
    .or(z.literal("")),
  cuisine_type: z
    .string()
    .max(50, "Cuisine type must be less than 50 characters")
    .nullable()
    .or(z.literal("")),
  payout_rate: z
    .number()
    .min(1, "Payout rate must be at least 1")
    .max(1000, "Payout rate must be less than 1000"),
  commission_rate: z
    .number()
    .min(0, "Commission must be 0% or more")
    .max(100, "Commission cannot exceed 100%"),
  max_meals_per_day: z
    .number()
    .min(1, "Must be at least 1")
    .max(10000, "Must be less than 10000")
    .nullable(),
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
  const [restaurantDetails, setRestaurantDetails] =
    useState<RestaurantDetails | null>(null);
  const [stats, setStats] = useState<RestaurantStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Create owner account dialog
  const [ownerDialogOpen, setOwnerDialogOpen] = useState(false);
  const [ownerCreating, setOwnerCreating] = useState(false);
  const [ownerForm, setOwnerForm] = useState({
    full_name: "",
    email: "",
  });
  const [ownerCreated, setOwnerCreated] = useState<{
    email: string;
  } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [initialFormData, setInitialFormData] =
    useState<RestaurantFormData | null>(null);

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
  const [errors, setErrors] = useState<
    Partial<Record<keyof RestaurantFormData, string>>
  >({});

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
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
  const [ratingDistribution, setRatingDistribution] = useState<
    RatingDistribution[]
  >([]);
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
  const [restaurantPayouts, setRestaurantPayouts] = useState<
    Array<{
      id: string;
      amount: number;
      status: string | null;
      period_start: string;
      period_end: string;
      processed_at: string | null;
      reference_number: string | null;
      payout_method: string | null;
      created_at: string | null;
    }>
  >([]);
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
    if (!id) return;
    fetchRestaurant();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (!qnasZone) {
      setQnasStreets([]);
      setQnasBuildings([]);
      return;
    }
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
    if (!qnasZone || !qnasStreet) {
      setQnasBuildings([]);
      return;
    }
    setQnasLoadingBuildings(true);
    qnasFetch<QnasBuilding[]>(`/get_buildings/${qnasZone}/${qnasStreet}`).then(
      (data) => {
        if (Array.isArray(data)) setQnasBuildings(data);
        setQnasLoadingBuildings(false);
      },
    );
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
      if (
        !restaurantData ||
        Array.isArray(restaurantData) ||
        typeof restaurantData.id !== "string"
      ) {
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

      // Fetch only non-sensitive columns directly. Banking identifiers are
      // returned masked by a separately authorized server-side function.
      const { data: detailsData, error: detailsError } = await supabase
        .from("restaurant_details")
        .select(
          "id, restaurant_id, alternate_phone, avg_prep_time_minutes, max_meals_per_day, operating_hours, website_url",
        )
        .eq("restaurant_id", id)
        .maybeSingle();

      if (detailsError) throw detailsError;

      const bankingSummary = await getPartnerBankingSummary(id);

      const restaurantWithOwner: Restaurant = {
        ...restaurantData,
        approval_status: restaurantData.approval_status || "pending",
        is_active: restaurantData.is_active ?? true,
        owner,
      };

      setRestaurant(restaurantWithOwner);
      setRestaurantDetails(
        detailsData
          ? {
              ...detailsData,
              bank_name_masked: bankingSummary.bank_name_masked,
              bank_account_name_masked:
                bankingSummary.bank_account_name_masked,
              bank_account_number_masked:
                bankingSummary.bank_account_number_masked,
              bank_iban_masked: bankingSummary.bank_iban_masked,
              swift_code_masked: bankingSummary.swift_code_masked,
              payout_frequency: bankingSummary.payout_frequency,
              is_configured: bankingSummary.is_configured,
              banking_updated_at: bankingSummary.updated_at,
            }
          : null,
      );

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
      const rd = restaurantData as Record<string, unknown>;
      if (rd.zone_number) setQnasZone(rd.zone_number as number);
      if (rd.street_number) setQnasStreet(rd.street_number as number);
      if (rd.building_number) setQnasBuilding(rd.building_number as string);
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
      const mealIds = [
        ...new Set((ordersData || []).map((o) => o.meal_id).filter(Boolean)),
      ];
      let mealsMap: Record<string, number> = {};

      if (mealIds.length > 0) {
        const { data: meals } = await supabase
          .from("meals")
          .select("id, price")
          .in("id", mealIds);

        if (meals) {
          mealsMap = meals.reduce(
            (acc, m) => {
              acc[m.id] = m.price || 0;
              return acc;
            },
            {} as Record<string, number>,
          );
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
      const averageOrderValue =
        totalOrders > 0 ? totalRevenue / totalOrders : 0;

      const reviewCount = reviewsData?.length || 0;
      const averageRating =
        reviewCount > 0 && reviewsData
          ? reviewsData.reduce((sum, review) => sum + (review.rating || 0), 0) /
            reviewCount
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
      const mealIds = [
        ...new Set((ordersData || []).map((o) => o.meal_id).filter(Boolean)),
      ];
      let mealsMap: Record<string, number> = {};

      if (mealIds.length > 0) {
        const { data: meals } = await supabase
          .from("meals")
          .select("id, price")
          .in("id", mealIds);

        if (meals) {
          mealsMap = meals.reduce(
            (acc, m) => {
              acc[m.id] = m.price || 0;
              return acc;
            },
            {} as Record<string, number>,
          );
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

      const revenueChartData: DailyRevenue[] = Object.entries(dailyMap).map(
        ([date, data]) => ({
          date: format(new Date(date), "MMM d"),
          revenue: data.revenue,
          orders: data.orders,
        }),
      );

      setRevenueData(revenueChartData);

      // Get rating distribution
      const { data: reviewsData } = await supabase
        .from("restaurant_reviews")
        .select("rating")
        .eq("restaurant_id", id);

      const ratingCounts: Record<number, number> = {
        1: 0,
        2: 0,
        3: 0,
        4: 0,
        5: 0,
      };
      (reviewsData || []).forEach((review) => {
        const rating = Math.round(review.rating || 0);
        if (rating >= 1 && rating <= 5) {
          ratingCounts[rating]++;
        }
      });

      const ratingChartData: RatingDistribution[] = Object.entries(
        ratingCounts,
      ).map(([rating, count]) => ({
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
        .select(
          `
          id,
          scheduled_date,
          meal_type,
          is_completed,
          order_status,
          created_at,
          user_id,
          meal_id
        `,
        )
        .eq("restaurant_id", id)
        .order("created_at", { ascending: false });

      if (schedulesError) throw schedulesError;

      // Get meal details
      const mealIds = [
        ...new Set(
          (schedulesData || [])
            .map((schedule) => schedule.meal_id)
            .filter((mealId): mealId is string => Boolean(mealId)),
        ),
      ];
      let mealsMap: Record<string, { name: string; price: number }> = {};

      if (mealIds.length > 0) {
        const { data: meals } = await supabase
          .from("meals")
          .select("id, name, price")
          .in("id", mealIds);

        if (meals) {
          mealsMap = meals.reduce(
            (acc, m) => {
              acc[m.id] = { name: m.name, price: m.price || 0 };
              return acc;
            },
            {} as Record<string, { name: string; price: number }>,
          );
        }
      }

      // Get user profiles
      const userIds = [...new Set((schedulesData || []).map((o) => o.user_id))];
      let profilesMap: Record<
        string,
        { full_name: string | null; email?: string }
      > = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

        if (profiles) {
          profilesMap = profiles.reduce(
            (acc, p: Record<string, unknown>) => {
              acc[p.user_id as string] = {
                full_name: p.full_name as string | null,
              };
              return acc;
            },
            {} as Record<string, { full_name: string | null }>,
          );
        }
      }

      const ordersWithDetails: Order[] = (schedulesData || []).map(
        (schedule) => {
          const meal = schedule.meal_id
            ? mealsMap[schedule.meal_id] || { name: "Unknown", price: 0 }
            : { name: "Unknown", price: 0 };

          return {
            id: schedule.id,
            scheduled_date: schedule.scheduled_date,
            meal_type: schedule.meal_type,
            order_status: (schedule.order_status || "pending") as OrderStatus,
            is_completed: schedule.is_completed ?? false,
            created_at: schedule.created_at,
            meal: {
              name: meal.name,
              price: meal.price,
            },
            profile: profilesMap[schedule.user_id] || null,
          };
        },
      );

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
        .select(
          "id, amount, status, period_start, period_end, processed_at, reference_number, payout_method, created_at",
        )
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

  const handleInputChange = (
    field: keyof RestaurantFormData,
    value: string | number | boolean | null,
  ) => {
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
      addAuditLogEntry(
        field,
        String(initialFormData[field] || ""),
        String(value || ""),
      );
    }
  };

  const addAuditLogEntry = (
    field: string,
    oldValue: string,
    newValue: string,
  ) => {
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
    if (!ownerForm.email || !restaurant?.id) return;
    setOwnerCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "create-partner-user",
        {
          body: {
            email: ownerForm.email.trim(),
            full_name:
              ownerForm.full_name.trim() || ownerForm.email.split("@")[0],
            restaurant_id: restaurant.id,
          },
        },
      );

      if (error || data?.error)
        throw new Error(
          data?.error ?? error?.message ?? "Failed to create account",
        );

      // Refresh restaurant so owner info updates
      await fetchRestaurant();
      setOwnerCreated({
        email: ownerForm.email.trim(),
      });
      setOwnerForm({ full_name: "", email: "" });
      toast({
        title: "Secure invitation sent",
        description: `${ownerForm.email} can set a password from the email invitation.`,
      });
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "An error occurred",
        variant: "destructive",
      });
    } finally {
      setOwnerCreating(false);
    }
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
        })
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
        description:
          "Please type the restaurant name exactly to confirm deletion.",
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
      setLeaveDialogOpen(true);
      return;
    }
    navigate("/admin/restaurants");
  };

  const confirmLeaveWithoutSaving = () => {
    setLeaveDialogOpen(false);
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

      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(filePath);

      // Update restaurant record
      const updateField = type === "logo" ? "logo_url" : "cover_image_url";
      const { error: updateError } = await supabase
        .from("restaurants")
        .update({ [updateField]: publicUrl })
        .eq("id", id);

      if (updateError) throw updateError;

      // Update local state
      setRestaurant((prev) =>
        prev ? { ...prev, [updateField]: publicUrl } : null,
      );

      toast({
        title: `${type === "logo" ? "Logo" : "Cover image"} uploaded successfully`,
      });
    } catch (error: unknown) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description:
          error instanceof Error ? error.message : `Failed to upload ${type}`,
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

    downloadCsv(
      [headers, ...rows],
      `${restaurant.name}-export-${format(new Date(), "yyyy-MM-dd")}.csv`,
    );

    toast({
      title: "Export Complete",
      description: "Restaurant data exported to CSV.",
    });
  };

  // Filtered orders
  const filteredOrders = orders.filter((order) => {
    const matchesStatus =
      orderFilter === "all" || order.order_status === orderFilter;
    const matchesSearch =
      !orderSearch ||
      order.meal.name.toLowerCase().includes(orderSearch.toLowerCase()) ||
      order.profile?.full_name
        ?.toLowerCase()
        .includes(orderSearch.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredOrders.length / ordersPerPage);
  const paginatedOrders = filteredOrders.slice(
    (orderPage - 1) * ordersPerPage,
    orderPage * ordersPerPage,
  );

  // UI Helpers
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge
            variant="outline"
            className="rounded-full border-[#F97316]/25 bg-[#F97316]/10 px-3 py-1 font-black text-[#F97316]"
          >
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge
            variant="outline"
            className="rounded-full border-[#22C7A1]/25 bg-[#22C7A1]/10 px-3 py-1 font-black text-[#22C7A1]"
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="outline"
            className="rounded-full border-[#FB6B7A]/25 bg-[#FB6B7A]/10 px-3 py-1 font-black text-[#FB6B7A]"
          >
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
      <Badge
        variant="outline"
        className={
          config?.bgColor || "border-[#E5EAF1] bg-[#F6F8FB] text-[#94A3B8]"
        }
      >
        {config?.label || status}
      </Badge>
    );
  };

  const COLORS = ["#FB6B7A", "#F97316", "#F97316", "#22C7A1", "#22C7A1"];

  if (loading) {
    return (
      <AdminLayout title="Restaurant Details">
        <div className="flex min-h-[420px] items-center justify-center">
          <div className="rounded-[30px] border border-[#E5EAF1] bg-white p-8 text-center shadow-[0_18px_44px_rgba(2,6,23,0.06)]">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#22C7A1]" />
            <p className="mt-4 text-sm font-black text-[#020617]">
              Loading restaurant details
            </p>
            <p className="mt-1 text-xs font-semibold text-[#94A3B8]">
              Fetching profile, orders, payouts, and settings.
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!restaurant) {
    return (
      <AdminLayout title="Restaurant Not Found">
        <div className="flex min-h-[420px] items-center justify-center">
          <div className="max-w-md rounded-[30px] border border-[#E5EAF1] bg-white p-8 text-center shadow-[0_18px_44px_rgba(2,6,23,0.06)]">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-[24px] bg-[#F6F8FB] text-[#94A3B8] ring-1 ring-[#E5EAF1]">
              <Store className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-xl font-black text-[#020617]">
              Restaurant Not Found
            </h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-[#94A3B8]">
              The requested restaurant could not be found.
            </p>
            <Button
              variant="outline"
              className="mt-5 min-h-[44px] rounded-[16px] border-[#7C83F6]/30 bg-[#7C83F6]/10 font-black text-[#020617] hover:bg-[#7C83F6]/15"
              onClick={() => navigate("/admin/restaurants")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Restaurants
            </Button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const detailInputClass =
    "min-h-11 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-bold text-[#020617] placeholder:text-[#94A3B8] focus-visible:ring-[#020617]";

  const restaurantShortId =
    typeof restaurant.id === "string" ? restaurant.id.slice(0, 8) : "unknown";

  return (
    <AdminLayout
      title={restaurant.name}
      subtitle={`ID: ${restaurantShortId}...`}
    >
      <div className="space-y-6 text-[#020617]">
        {/* Header */}
        <AdminWorkbenchHeader
          eyebrow="Restaurant profile"
          title={restaurant.name}
          icon={Store}
          accent="#22C7A1"
          description={
            <>
              Created{" "}
              {restaurant.created_at
                ? format(
                    new Date(restaurant.created_at as string),
                    "MMM d, yyyy",
                  )
                : "Unknown"}{" "}
              - Last updated{" "}
              {restaurant.updated_at
                ? format(
                    new Date(restaurant.updated_at as string),
                    "MMM d, yyyy",
                  )
                : "Unknown"}
            </>
          }
          meta={[
            {
              label: "Status",
              value: getStatusBadge(restaurant.approval_status),
            },
            { label: "Active", value: restaurant.is_active ? "Yes" : "No" },
            { label: "ID", value: `${restaurantShortId}...` },
          ]}
          actions={
            <>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCancel}
                aria-label="Back to restaurants"
                className="min-h-[44px] min-w-[44px] rounded-[16px] border-[#E5EAF1] bg-[#F6F8FB] text-[#020617]"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              {hasChanges && (
                <Badge
                  variant="secondary"
                  className="rounded-full bg-[#7C83F6]/10 px-3 py-1 font-black text-[#7C83F6]"
                >
                  Unsaved Changes
                </Badge>
              )}
              <Button
                variant="outline"
                onClick={() => fetchRestaurant()}
                disabled={loading}
                className="min-h-[44px] rounded-[16px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-[#F6F8FB]"
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={!hasChanges}
                className="min-h-[44px] rounded-[16px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-[#F6F8FB]"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                className="min-h-[44px] rounded-[16px] bg-[#FB6B7A] font-black text-white hover:bg-[#FB6B7A]/90"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
              <Button
                onClick={handleSave}
                disabled={!hasChanges || saving}
                variant="outline"
                className="min-h-[44px] rounded-[16px] border-[#22C7A1]/30 bg-[#22C7A1]/10 font-black text-[#020617] hover:bg-[#22C7A1]/15"
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
            </>
          }
        />

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <AdminPanel className="rounded-[24px] border-[#E5EAF1] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7C83F6]/10 text-[#7C83F6]">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-[#020617]">
                      {stats.total_orders}
                    </p>
                    <p className="text-xs font-bold text-[#94A3B8]">
                      Total Orders
                    </p>
                  </div>
                </div>
              </div>
            </AdminPanel>
            <AdminPanel className="rounded-[24px] border-[#E5EAF1] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#22C7A1]/10 text-[#22C7A1]">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-[#020617]">
                      {formatCurrency(stats.total_revenue)}
                    </p>
                    <p className="text-xs font-bold text-[#94A3B8]">
                      Total Revenue
                    </p>
                  </div>
                </div>
              </div>
            </AdminPanel>
            <AdminPanel className="rounded-[24px] border-[#E5EAF1] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#38BDF8]/10 text-[#38BDF8]">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-[#020617]">
                      {formatCurrency(stats.average_order_value)}
                    </p>
                    <p className="text-xs font-bold text-[#94A3B8]">
                      Avg Order Value
                    </p>
                  </div>
                </div>
              </div>
            </AdminPanel>
            <AdminPanel className="rounded-[24px] border-[#E5EAF1] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F97316]/10 text-[#F97316]">
                    <Star className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-[#020617]">
                      {stats.rating.toFixed(1)}
                    </p>
                    <p className="text-xs font-bold text-[#94A3B8]">
                      {stats.review_count} Reviews
                    </p>
                  </div>
                </div>
              </div>
            </AdminPanel>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="details" className="space-y-6">
          <TabsList className="grid h-auto w-full grid-cols-2 rounded-[24px] border border-[#E5EAF1] bg-white p-2 shadow-[0_14px_34px_rgba(2,6,23,0.05)] sm:grid-cols-4 lg:w-auto">
            <TabsTrigger
              value="details"
              className="min-h-11 gap-2 rounded-2xl text-xs font-black text-[#94A3B8] data-[state=active]:border data-[state=active]:border-[#22C7A1]/30 data-[state=active]:bg-[#22C7A1]/10 data-[state=active]:text-[#020617] data-[state=active]:shadow-none sm:text-sm"
            >
              <Store className="w-4 h-4" />
              Details
            </TabsTrigger>
            <TabsTrigger
              value="analytics"
              className="min-h-11 gap-2 rounded-2xl text-xs font-black text-[#94A3B8] data-[state=active]:border data-[state=active]:border-[#7C83F6]/30 data-[state=active]:bg-[#7C83F6]/10 data-[state=active]:text-[#020617] data-[state=active]:shadow-none sm:text-sm"
              onClick={fetchAnalytics}
            >
              <TrendingUp className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger
              value="orders"
              className="min-h-11 gap-2 rounded-2xl text-xs font-black text-[#94A3B8] data-[state=active]:border data-[state=active]:border-[#38BDF8]/30 data-[state=active]:bg-[#38BDF8]/10 data-[state=active]:text-[#020617] data-[state=active]:shadow-none sm:text-sm"
              onClick={fetchOrders}
            >
              <Package className="w-4 h-4" />
              Orders
            </TabsTrigger>
            <TabsTrigger
              value="payouts"
              className="min-h-11 gap-2 rounded-2xl text-xs font-black text-[#94A3B8] data-[state=active]:border data-[state=active]:border-[#F97316]/30 data-[state=active]:bg-[#F97316]/10 data-[state=active]:text-[#020617] data-[state=active]:shadow-none sm:text-sm"
              onClick={fetchRestaurantPayouts}
            >
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
                <AdminPanel className="rounded-[28px]">
                  <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
                    <h2 className="text-lg font-black text-[#020617]">
                      Restaurant Images
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-[#94A3B8]">
                      Upload logo and cover image
                    </p>
                  </div>
                  <div className="space-y-6 pt-5">
                    {/* Logo Upload */}
                    <div className="space-y-3">
                      <Label className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4" />
                        Restaurant Logo
                      </Label>
                      <div className="flex items-start gap-4">
                        <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-[22px] border border-dashed border-[#E5EAF1] bg-[#F6F8FB]">
                          {restaurant.logo_url ? (
                            <>
                              <img
                                src={restaurant.logo_url}
                                alt="Logo"
                                className="w-full h-full object-cover"
                              />
                            </>
                          ) : (
                            <div className="text-center text-[#94A3B8]">
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
                            onChange={(e) =>
                              e.target.files?.[0] &&
                              handleImageUpload(e.target.files[0], "logo")
                            }
                            className="hidden"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            disabled={uploadingLogo}
                            onClick={() => logoInputRef.current?.click()}
                            className="min-h-[44px] rounded-[16px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-[#F6F8FB]"
                          >
                            {uploadingLogo ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4" />
                            )}
                            {uploadingLogo ? "Uploading..." : "Upload Logo"}
                          </Button>
                          <p className="text-xs text-[#94A3B8]">
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
                        <div className="relative flex h-32 w-full items-center justify-center overflow-hidden rounded-[22px] border border-dashed border-[#E5EAF1] bg-[#F6F8FB]">
                          {restaurant.cover_image_url ? (
                            <img
                              src={restaurant.cover_image_url}
                              alt="Cover"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="text-center text-[#94A3B8]">
                              <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-50" />
                              <span className="text-sm">No cover image</span>
                            </div>
                          )}
                        </div>
                        <input
                          ref={coverInputRef}
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            e.target.files?.[0] &&
                            handleImageUpload(e.target.files[0], "cover")
                          }
                          className="hidden"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          disabled={uploadingCover}
                          onClick={() => coverInputRef.current?.click()}
                          className="min-h-[44px] rounded-[16px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-[#F6F8FB]"
                        >
                          {uploadingCover ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4" />
                          )}
                          {uploadingCover ? "Uploading..." : "Upload Cover"}
                        </Button>
                        <p className="text-xs text-[#94A3B8]">
                          JPG, PNG or WebP. Max 5MB. Recommended: 1200x400px
                        </p>
                      </div>
                    </div>
                  </div>
                </AdminPanel>

                <AdminPanel className="rounded-[28px]">
                  <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
                    <h2 className="text-lg font-black text-[#020617]">
                      Basic Information
                    </h2>
                  </div>
                  <div className="space-y-4 pt-5">
                    <div className="space-y-2">
                      <Label htmlFor="name">Restaurant Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) =>
                          handleInputChange("name", e.target.value)
                        }
                        className={cn(
                          detailInputClass,
                          errors.name && "border-[#FB6B7A] bg-[#FB6B7A]/10",
                        )}
                      />
                      {errors.name && (
                        <p className="text-sm text-[#FB6B7A]">{errors.name}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description || ""}
                        onChange={(e) =>
                          handleInputChange("description", e.target.value)
                        }
                        rows={3}
                        className={cn(
                          detailInputClass,
                          "min-h-24",
                          errors.description &&
                            "border-[#FB6B7A] bg-[#FB6B7A]/10",
                        )}
                      />
                      {errors.description && (
                        <p className="text-sm text-[#FB6B7A]">
                          {errors.description}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="cuisine_type">Cuisine Type</Label>
                        <Input
                          id="cuisine_type"
                          value={formData.cuisine_type || ""}
                          onChange={(e) =>
                            handleInputChange("cuisine_type", e.target.value)
                          }
                          placeholder="e.g., Healthy, Italian, Asian"
                          className={cn(
                            detailInputClass,
                            errors.cuisine_type &&
                              "border-[#FB6B7A] bg-[#FB6B7A]/10",
                          )}
                        />
                        {errors.cuisine_type && (
                          <p className="text-sm text-[#FB6B7A]">
                            {errors.cuisine_type}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="website">Website</Label>
                        <Input
                          id="website"
                          value={formData.website || ""}
                          onChange={(e) =>
                            handleInputChange("website", e.target.value)
                          }
                          placeholder="https://..."
                          className={cn(
                            detailInputClass,
                            errors.website &&
                              "border-[#FB6B7A] bg-[#FB6B7A]/10",
                          )}
                        />
                        {errors.website && (
                          <p className="text-sm text-[#FB6B7A]">
                            {errors.website}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </AdminPanel>

                <AdminPanel className="rounded-[28px]">
                  <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
                    <h2 className="text-lg font-black text-[#020617]">
                      Contact Information
                    </h2>
                  </div>
                  <div className="space-y-4 pt-5">
                    {/* ── QNAS Address Picker ── */}
                    <div className="space-y-4 rounded-[24px] border border-[#E5EAF1] bg-[#F6F8FB] p-4">
                      {/* Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-[#38BDF8]/10 text-[#38BDF8]">
                            <MapPin className="w-4 h-4" />
                          </span>
                          <div>
                            <span className="block text-sm font-black text-[#020617]">
                              Find Qatar Address
                            </span>
                            <span className="text-xs font-semibold text-[#94A3B8]">
                              QNAS location lookup
                            </span>
                          </div>
                        </div>
                        {qnasLoadingZones && (
                          <div className="flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-bold text-[#38BDF8] ring-1 ring-[#E5EAF1]">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Loading zones...
                          </div>
                        )}
                        {!qnasLoadingZones && qnasZones.length > 0 && (
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-[#94A3B8] ring-1 ring-[#E5EAF1]">
                            {qnasZones.length} zones loaded
                          </span>
                        )}
                      </div>

                      {/* Zone - searchable combobox */}
                      <div className="space-y-1">
                        <Label className="text-sm font-black text-[#020617]">
                          Zone
                        </Label>
                        <Popover
                          open={qnasZoneOpen}
                          onOpenChange={setQnasZoneOpen}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              disabled={
                                qnasLoadingZones || qnasZones.length === 0
                              }
                              className="h-11 w-full justify-between rounded-2xl border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-white"
                            >
                              {qnasZone
                                ? (() => {
                                    const z = qnasZones.find(
                                      (z) => z.zone_number === qnasZone,
                                    );
                                    return z
                                      ? `${z.zone_number} - ${z.zone_name_en}`
                                      : qnasZone.toString();
                                  })()
                                : qnasLoadingZones
                                  ? "Loading list..."
                                  : "Select Zone"}
                              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[calc(100vw-32px)] max-w-[380px] overflow-hidden rounded-[22px] border-[#E5EAF1] bg-white p-0 text-[#020617] shadow-[0_18px_44px_rgba(2,6,23,0.12)]"
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
                                  {qnasZones.map((z) => (
                                    <CommandItem
                                      key={z.zone_number}
                                      value={`${z.zone_number} ${z.zone_name_en} ${z.zone_name_ar}`}
                                      className="min-h-11 rounded-2xl px-3 font-semibold text-[#020617] data-[selected=true]:bg-[#F6F8FB]"
                                      onSelect={() => {
                                        setQnasZone(z.zone_number);
                                        setQnasStreet(null);
                                        setQnasBuilding("");
                                        setQnasLat(null);
                                        setQnasLng(null);
                                        setQnasZoneOpen(false);
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
                                        <span className="text-[#94A3B8] ml-2 text-xs">
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
                        <Label className="text-sm font-black text-[#020617]">
                          Street
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
                          <SelectTrigger className="h-11 rounded-2xl border-[#E5EAF1] bg-white font-black text-[#020617]">
                            <SelectValue
                              placeholder={
                                !qnasZone
                                  ? "Select Street"
                                  : qnasLoadingStreets
                                    ? "Loading list..."
                                    : "Select Street"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent className="max-h-72 rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]">
                            {qnasStreets.map((s) => (
                              <SelectItem
                                key={s.street_number}
                                value={s.street_number.toString()}
                              >
                                <span className="font-medium">
                                  {s.street_number}
                                </span>
                                {" - "}
                                <span>{s.street_name_en}</span>
                                {s.street_name_ar && (
                                  <span className="text-[#94A3B8] mr-1">
                                    {" "}
                                    {s.street_name_ar}
                                  </span>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Building */}
                      <div className="space-y-1">
                        <Label className="text-sm font-black text-[#020617]">
                          Building Number
                        </Label>
                        <Select
                          value={qnasBuilding}
                          onValueChange={(v) => {
                            setQnasBuilding(v);
                            // Find lat/lng from the buildings list
                            const bld = qnasBuildings.find(
                              (b) => b.building_number === v,
                            );
                            if (bld?.x && bld?.y) {
                              setQnasLat(parseFloat(bld.x));
                              setQnasLng(parseFloat(bld.y));
                              const zone = qnasZones.find(
                                (z) => z.zone_number === qnasZone,
                              );
                              const street = qnasStreets.find(
                                (s) => s.street_number === qnasStreet,
                              );
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
                          <SelectTrigger className="h-11 rounded-2xl border-[#E5EAF1] bg-white font-black text-[#020617]">
                            <SelectValue
                              placeholder={
                                !qnasStreet
                                  ? "Select Building"
                                  : qnasLoadingBuildings
                                    ? "Loading list..."
                                    : "Select Building"
                              }
                            />
                          </SelectTrigger>
                          <SelectContent className="max-h-72 rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]">
                            {qnasBuildings.map((b) => (
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

                      {/* Coordinates + success */}
                      {qnasLat && qnasLng && (
                        <div className="flex items-center gap-2 rounded-2xl border border-[#22C7A1]/20 bg-[#22C7A1]/10 px-3 py-2">
                          <MapPin className="w-4 h-4 text-[#22C7A1] shrink-0" />
                          <span className="text-xs font-black text-[#22C7A1]">
                            Location found - {qnasLat.toFixed(6)},{" "}
                            {qnasLng.toFixed(6)}
                          </span>
                        </div>
                      )}

                      {/* Map preview */}
                      {qnasLat && qnasLng && (
                        <div
                          className="overflow-hidden rounded-[22px] border border-[#E5EAF1]"
                          style={{ height: 240 }}
                        >
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
                        <span className="text-xs text-[#94A3B8] ml-2">
                          Auto-filled by QNAS or enter manually
                        </span>
                      </Label>
                      <Textarea
                        id="address"
                        value={formData.address || ""}
                        onChange={(e) =>
                          handleInputChange("address", e.target.value)
                        }
                        rows={2}
                        className={cn(
                          detailInputClass,
                          "min-h-20",
                          errors.address && "border-[#FB6B7A] bg-[#FB6B7A]/10",
                        )}
                      />
                      {errors.address && (
                        <p className="text-sm text-[#FB6B7A]">
                          {errors.address}
                        </p>
                      )}
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
                          onChange={(e) =>
                            handleInputChange("email", e.target.value)
                          }
                          className={cn(
                            detailInputClass,
                            errors.email && "border-[#FB6B7A] bg-[#FB6B7A]/10",
                          )}
                        />
                        {errors.email && (
                          <p className="text-sm text-[#FB6B7A]">
                            {errors.email}
                          </p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="phone">
                          <Phone className="w-4 h-4 inline mr-1" />
                          Phone
                        </Label>
                        <Input
                          id="phone"
                          value={formData.phone || ""}
                          onChange={(e) =>
                            handleInputChange("phone", e.target.value)
                          }
                          className={cn(
                            detailInputClass,
                            errors.phone && "border-[#FB6B7A] bg-[#FB6B7A]/10",
                          )}
                        />
                        {errors.phone && (
                          <p className="text-sm text-[#FB6B7A]">
                            {errors.phone}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </AdminPanel>

                <AdminPanel className="rounded-[28px]">
                  <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
                    <h2 className="text-lg font-black text-[#020617]">
                      Business Settings
                    </h2>
                  </div>
                  <div className="space-y-4 pt-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="commission_rate">
                          Platform Commission (%) *
                        </Label>
                        <Input
                          id="commission_rate"
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={formData.commission_rate}
                          onChange={(e) =>
                            handleInputChange(
                              "commission_rate",
                              parseFloat(e.target.value),
                            )
                          }
                          className={cn(
                            detailInputClass,
                            errors.commission_rate &&
                              "border-[#FB6B7A] bg-[#FB6B7A]/10",
                          )}
                        />
                        {errors.commission_rate && (
                          <p className="text-sm text-[#FB6B7A]">
                            {errors.commission_rate}
                          </p>
                        )}
                        <p className="text-xs text-[#94A3B8]">
                          % Nutrio takes from each meal sale
                        </p>
                      </div>

                      {/* Commission preview */}
                      {formData.commission_rate >= 0 && (
                        <div className="grid grid-cols-2 gap-3 rounded-[22px] border border-[#E5EAF1] bg-[#F6F8FB] p-4 text-center sm:col-span-2">
                          <div>
                            <p className="mb-1 text-xs font-bold text-[#94A3B8]">
                              Platform Takes
                            </p>
                            <p className="text-lg font-black text-[#FB6B7A]">
                              {formData.commission_rate}%
                            </p>
                          </div>
                          <div>
                            <p className="mb-1 text-xs font-bold text-[#94A3B8]">
                              Restaurant Earns
                            </p>
                            <p className="text-lg font-black text-[#22C7A1]">
                              {(100 - formData.commission_rate).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="space-y-2">
                        <Label htmlFor="max_meals_per_day">
                          Max Meals Per Day
                        </Label>
                        <Input
                          id="max_meals_per_day"
                          type="number"
                          min="1"
                          value={formData.max_meals_per_day || ""}
                          onChange={(e) =>
                            handleInputChange(
                              "max_meals_per_day",
                              e.target.value ? parseInt(e.target.value) : null,
                            )
                          }
                          className={cn(
                            detailInputClass,
                            errors.max_meals_per_day &&
                              "border-[#FB6B7A] bg-[#FB6B7A]/10",
                          )}
                        />
                        {errors.max_meals_per_day && (
                          <p className="text-sm text-[#FB6B7A]">
                            {errors.max_meals_per_day}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="approval_status">Approval Status</Label>
                        <Select
                          value={formData.approval_status}
                          onValueChange={(value: string) =>
                            handleInputChange(
                              "approval_status",
                              value as "pending" | "approved" | "rejected",
                            )
                          }
                        >
                          <SelectTrigger className="h-11 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-black text-[#020617]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]">
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
                          onValueChange={(value) =>
                            handleInputChange("is_active", value === "true")
                          }
                        >
                          <SelectTrigger className="h-11 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-black text-[#020617]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]">
                            <SelectItem value="true">Active</SelectItem>
                            <SelectItem value="false">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </AdminPanel>

                {/* Banking Details */}
                <AdminPanel className="rounded-[28px]">
                  <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
                    <h2 className="flex items-center gap-2 text-lg font-black text-[#020617]">
                      <CreditCard className="w-5 h-5" />
                      Banking Details
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-[#94A3B8]">
                      Only masked payout information is loaded in this browser
                    </p>
                  </div>
                  <div className="space-y-4 pt-5">
                    {restaurantDetails ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <Building2 className="w-4 h-4" />
                              Bank Name
                            </Label>
                            <div className="flex items-center justify-between rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-3 font-bold text-[#020617]">
                              <span>
                                {restaurantDetails.bank_name_masked || "Not set"}
                              </span>
                              {restaurantDetails.is_configured && (
                                <Shield className="w-4 h-4 text-[#22C7A1]" />
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>Account Name</Label>
                            <div className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-3 font-bold text-[#020617]">
                              {restaurantDetails.bank_account_name_masked ||
                                "Not set"}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <Shield className="w-4 h-4" />
                              Account Number
                            </Label>
                            <div className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-3 font-mono font-bold text-[#020617]">
                              {restaurantDetails.bank_account_number_masked ||
                                "Not set"}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>IBAN</Label>
                            <div className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-3 font-mono font-bold text-[#020617]">
                              {restaurantDetails.bank_iban_masked || "Not set"}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 rounded-2xl bg-[#22C7A1]/10 px-3 py-2 text-sm font-bold text-[#22C7A1]">
                          <Shield className="w-4 h-4 text-[#22C7A1]" />
                          <span>
                            Banking information is encrypted and secure
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-[22px] border border-[#E5EAF1] bg-[#F6F8FB] px-4 py-8 text-center text-[#94A3B8]">
                        <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No banking details available</p>
                        <p className="text-sm">
                          Banking information can be set by the restaurant owner
                        </p>
                      </div>
                    )}
                  </div>
                </AdminPanel>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                <AdminPanel className="rounded-[28px]">
                  <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
                    <div className="flex items-center justify-between">
                      <h2 className="flex items-center gap-2 text-lg font-black text-[#020617]">
                        <Shield className="w-4 h-4" />
                        Owner / Login Access
                      </h2>
                      <Button
                        variant="outline"
                        className="min-h-[44px] rounded-[16px] border-[#E5EAF1] bg-white px-3 text-xs font-black text-[#020617] hover:bg-[#F6F8FB]"
                        onClick={() => {
                          setOwnerDialogOpen(true);
                          setOwnerCreated(null);
                        }}
                      >
                        <UserPlus className="w-3 h-3" />
                        {restaurant.owner ? "Change Owner" : "Create Account"}
                      </Button>
                    </div>
                  </div>
                  <div className="pt-4">
                    {restaurant.owner ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 rounded-2xl border border-[#22C7A1]/20 bg-[#22C7A1]/10 p-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#22C7A1]">
                            <Users className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">
                              {restaurant.owner.full_name || "Unnamed Owner"}
                            </p>
                            <p className="text-xs text-[#94A3B8]">
                              {restaurant.owner.email}
                            </p>
                          </div>
                        </div>
                        <p className="flex items-center gap-1 text-xs font-black text-[#22C7A1]">
                          <CheckCheck className="w-3 h-3" /> Can log in at
                          /partner/auth
                        </p>
                        <Button
                          variant="outline"
                          className="min-h-[44px] w-full rounded-[16px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-[#F6F8FB]"
                          onClick={() =>
                            navigate(
                              `/admin/users?search=${restaurant.owner?.email}`,
                            )
                          }
                        >
                          View in Users Panel
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 rounded-2xl border border-[#F97316]/20 bg-[#F97316]/10 p-3">
                          <AlertTriangle className="w-4 h-4 text-[#F97316] shrink-0" />
                          <div>
                            <p className="text-sm font-black text-[#020617]">
                              No login account
                            </p>
                            <p className="text-xs font-bold text-[#F97316]">
                              The restaurant owner cannot log in yet.
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          className="min-h-[44px] w-full rounded-[16px] border-[#7C83F6]/30 bg-[#7C83F6]/10 font-black text-[#020617] hover:bg-[#7C83F6]/15"
                          onClick={() => {
                            setOwnerDialogOpen(true);
                            setOwnerCreated(null);
                          }}
                        >
                          <UserPlus className="w-4 h-4" />
                          Create Owner Account
                        </Button>
                      </div>
                    )}
                  </div>
                </AdminPanel>

                <AdminPanel className="rounded-[28px]">
                  <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
                    <h2 className="text-lg font-black text-[#020617]">
                      Actions
                    </h2>
                  </div>
                  <div className="space-y-2 pt-4">
                    <Button
                      variant="outline"
                      className="min-h-[44px] w-full justify-start rounded-[16px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-[#F6F8FB]"
                      onClick={() => navigate(`/restaurant/${restaurant.id}`)}
                    >
                      <Globe className="w-4 h-4 mr-2" />
                      View Public Page
                    </Button>
                    {restaurant.email && (
                      <Button
                        variant="outline"
                        className="min-h-[44px] w-full justify-start rounded-[16px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-[#F6F8FB]"
                        onClick={() =>
                          (window.location.href = `mailto:${restaurant.email}`)
                        }
                      >
                        <Mail className="w-4 h-4 mr-2" />
                        Send Email
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      className="min-h-[44px] w-full justify-start rounded-[16px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-[#F6F8FB]"
                      onClick={exportToCSV}
                    >
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Export Data (CSV)
                    </Button>
                  </div>
                </AdminPanel>

                {/* Audit Log */}
                <AdminPanel className="rounded-[28px]">
                  <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
                    <h2 className="flex items-center gap-2 text-lg font-black text-[#020617]">
                      <History className="w-5 h-5" />
                      Recent Changes
                    </h2>
                  </div>
                  <div className="pt-4">
                    {auditLog.length > 0 ? (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {auditLog.slice(0, 10).map((entry) => (
                          <div
                            key={entry.id}
                            className="text-sm border-l-2 border-[#22C7A1] pl-3 py-1"
                          >
                            <p className="font-medium capitalize">
                              {entry.field} updated
                            </p>
                            <p className="text-xs text-[#94A3B8]">
                              {format(
                                new Date(entry.timestamp),
                                "MMM d, h:mm a",
                              )}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[#94A3B8]">
                        No recent changes
                      </p>
                    )}
                  </div>
                </AdminPanel>
              </div>
            </div>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            {analyticsLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-[#22C7A1]" />
              </div>
            ) : (
              <>
                {/* Revenue Chart */}
                <AdminPanel className="rounded-[28px]">
                  <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
                    <h2 className="text-lg font-black text-[#020617]">
                      Revenue & Orders (Last 30 Days)
                    </h2>
                    <p className="mt-1 text-sm font-semibold text-[#94A3B8]">
                      Daily revenue and order volume trends
                    </p>
                  </div>
                  <div className="pt-5">
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={revenueData}>
                          <defs>
                            <linearGradient
                              id="colorRevenue"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="5%"
                                stopColor="#22C7A1"
                                stopOpacity={0.3}
                              />
                              <stop
                                offset="95%"
                                stopColor="#22C7A1"
                                stopOpacity={0}
                              />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="#E5EAF1"
                          />
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
                              backgroundColor: "white",
                              border: "1px solid #E5EAF1",
                              borderRadius: "16px",
                              color: "#020617",
                            }}
                          />
                          <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey="revenue"
                            stroke="#22C7A1"
                            fillOpacity={1}
                            fill="url(#colorRevenue)"
                            name="Revenue (QAR)"
                          />
                          <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="orders"
                            stroke="#38BDF8"
                            strokeWidth={2}
                            dot={{ fill: "#38BDF8", r: 3 }}
                            name="Orders"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </AdminPanel>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Average Order Value */}
                  <AdminPanel className="rounded-[28px]">
                    <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
                      <h2 className="text-lg font-black text-[#020617]">
                        Average Order Value Trend
                      </h2>
                      <p className="mt-1 text-sm font-semibold text-[#94A3B8]">
                        Revenue per order over time
                      </p>
                    </div>
                    <div className="pt-5">
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={revenueData.map((d) => ({
                              ...d,
                              aov:
                                d.orders > 0
                                  ? Math.round(d.revenue / d.orders)
                                  : 0,
                            }))}
                          >
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#E5EAF1"
                            />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 12 }}
                              tickLine={false}
                            />
                            <YAxis
                              tick={{ fontSize: 12 }}
                              tickLine={false}
                              tickFormatter={(value) => `QAR ${value}`}
                            />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "white",
                                border: "1px solid #E5EAF1",
                                borderRadius: "16px",
                                color: "#020617",
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="aov"
                              stroke="#7C83F6"
                              strokeWidth={2}
                              dot={{ fill: "#7C83F6", r: 3 }}
                              name="Avg Order Value"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </AdminPanel>

                  {/* Rating Distribution */}
                  <AdminPanel className="rounded-[28px]">
                    <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
                      <h2 className="text-lg font-black text-[#020617]">
                        Customer Ratings Distribution
                      </h2>
                      <p className="mt-1 text-sm font-semibold text-[#94A3B8]">
                        Breakdown of review ratings
                      </p>
                    </div>
                    <div className="pt-5">
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={ratingDistribution}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#E5EAF1"
                            />
                            <XAxis
                              dataKey="rating"
                              tick={{ fontSize: 12 }}
                              tickLine={false}
                            />
                            <YAxis tick={{ fontSize: 12 }} tickLine={false} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "white",
                                border: "1px solid #E5EAF1",
                                borderRadius: "16px",
                                color: "#020617",
                              }}
                            />
                            <Bar dataKey="count" name="Reviews">
                              {ratingDistribution.map((_entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={COLORS[index % COLORS.length]}
                                />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </AdminPanel>
                </div>
              </>
            )}
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="space-y-6">
            <AdminPanel className="rounded-[28px]">
              <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
                <h2 className="text-lg font-black text-[#020617]">
                  Order History
                </h2>
                <p className="mt-1 text-sm font-semibold text-[#94A3B8]">
                  View and manage orders for this restaurant
                </p>
              </div>
              <div className="space-y-4 pt-5">
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                    <Input
                      placeholder="Search by meal or customer..."
                      value={orderSearch}
                      onChange={(e) => setOrderSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <Select
                    value={orderFilter}
                    onValueChange={(v) =>
                      setOrderFilter(v as OrderStatus | "all")
                    }
                  >
                    <SelectTrigger className="h-11 w-full rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-black text-[#020617] sm:w-[180px]">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent className="rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]">
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="preparing">Preparing</SelectItem>
                      <SelectItem value="ready">Ready</SelectItem>
                      <SelectItem value="out_for_delivery">
                        Out for Delivery
                      </SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Orders Table */}
                <div className="grid gap-3 md:hidden">
                  {ordersLoading ? (
                    <div className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-8 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#22C7A1]" />
                    </div>
                  ) : paginatedOrders.length === 0 ? (
                    <div className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-8 text-center text-[#94A3B8]">
                      <Package className="mx-auto mb-2 h-10 w-10 opacity-50" />
                      <p className="font-black text-[#020617]">
                        No orders found
                      </p>
                      <p className="text-sm">Try adjusting your filters</p>
                    </div>
                  ) : (
                    paginatedOrders.map((order) => (
                      <div
                        key={order.id}
                        className="rounded-[24px] border border-[#E5EAF1] bg-white p-4 shadow-[0_12px_30px_rgba(2,6,23,0.05)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-base font-black text-[#020617]">
                              {order.meal.name}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-[#94A3B8]">
                              #{order.id.slice(0, 8)} -{" "}
                              {order.profile?.full_name || "Guest"}
                            </p>
                          </div>
                          {getOrderStatusBadge(order.order_status)}
                        </div>
                        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="rounded-2xl bg-[#F6F8FB] p-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                              Price
                            </p>
                            <p className="mt-1 text-sm font-black text-[#22C7A1]">
                              {formatCurrency(order.meal.price)}
                            </p>
                          </div>
                          <div className="rounded-2xl bg-[#F6F8FB] p-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                              Scheduled
                            </p>
                            <p className="mt-1 text-sm font-black text-[#020617]">
                              {format(
                                new Date(order.scheduled_date),
                                "MMM d, yyyy",
                              )}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          className="mt-3 min-h-[44px] w-full rounded-2xl border-[#E5EAF1] bg-white font-black text-[#020617]"
                          onClick={() => {
                            setSelectedOrder(order);
                            setOrderDetailOpen(true);
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View order
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                <div className="hidden overflow-hidden rounded-[22px] border border-[#E5EAF1] md:block">
                  <Table>
                    <TableHeader className="bg-[#F6F8FB]">
                      <TableRow className="border-[#E5EAF1] hover:bg-[#F6F8FB]">
                        <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Order ID
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Meal
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Customer
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Price
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Scheduled
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Status
                        </TableHead>
                        <TableHead className="w-20 text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Actions
                        </TableHead>
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
                          <TableCell
                            colSpan={7}
                            className="text-center py-8 text-[#94A3B8]"
                          >
                            <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                            <p>No orders found</p>
                            <p className="text-sm">
                              Try adjusting your filters
                            </p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedOrders.map((order) => (
                          <TableRow
                            key={order.id}
                            className="border-[#E5EAF1] transition-colors hover:bg-[#F6F8FB]/70"
                          >
                            <TableCell className="font-mono text-xs font-black text-[#020617]">
                              {order.id.slice(0, 8)}...
                            </TableCell>
                            <TableCell className="font-black text-[#020617]">
                              {order.meal.name}
                            </TableCell>
                            <TableCell className="font-semibold text-[#020617]">
                              {order.profile?.full_name || "Guest"}
                            </TableCell>
                            <TableCell className="font-black text-[#22C7A1]">
                              {formatCurrency(order.meal.price)}
                            </TableCell>
                            <TableCell className="font-semibold text-[#94A3B8]">
                              {format(
                                new Date(order.scheduled_date),
                                "MMM d, yyyy",
                              )}
                            </TableCell>
                            <TableCell>
                              {getOrderStatusBadge(order.order_status)}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setOrderDetailOpen(true);
                                }}
                                className="h-11 w-11 rounded-2xl text-[#020617] hover:bg-[#F6F8FB]"
                                aria-label={`View order ${order.id.slice(0, 8)}`}
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
                    <p className="text-sm text-[#94A3B8]">
                      Showing {(orderPage - 1) * ordersPerPage + 1} to{" "}
                      {Math.min(
                        orderPage * ordersPerPage,
                        filteredOrders.length,
                      )}{" "}
                      of {filteredOrders.length} orders
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => setOrderPage((p) => Math.max(1, p - 1))}
                        disabled={orderPage === 1}
                        className="h-11 w-11 rounded-2xl border-[#E5EAF1] bg-white text-[#020617]"
                        aria-label="Previous orders page"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </Button>
                      <span className="text-sm">
                        Page {orderPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          setOrderPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={orderPage === totalPages}
                        className="h-11 w-11 rounded-2xl border-[#E5EAF1] bg-white text-[#020617]"
                        aria-label="Next orders page"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </AdminPanel>

            {/* Order Detail Dialog */}
            <Dialog open={orderDetailOpen} onOpenChange={setOrderDetailOpen}>
              <AdminDialogContent size="md">
                <DialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 text-left">
                  <DialogTitle className="text-xl font-black text-[#020617]">
                    Order Details
                  </DialogTitle>
                  <DialogDescription className="font-semibold text-[#94A3B8]">
                    Order ID: {selectedOrder?.id}
                  </DialogDescription>
                </DialogHeader>
                {selectedOrder && (
                  <div className="space-y-4 p-5">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-[18px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Meal
                        </p>
                        <p className="mt-1 font-black text-[#020617]">
                          {selectedOrder.meal.name}
                        </p>
                      </div>
                      <div className="rounded-[18px] bg-[#22C7A1]/10 p-3 ring-1 ring-[#22C7A1]/20">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">
                          Price
                        </p>
                        <p className="mt-1 font-black text-[#020617]">
                          {formatCurrency(selectedOrder.meal.price)}
                        </p>
                      </div>
                      <div className="rounded-[18px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Customer
                        </p>
                        <p className="mt-1 font-black text-[#020617]">
                          {selectedOrder.profile?.full_name || "Guest"}
                        </p>
                      </div>
                      <div className="rounded-[18px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Meal Type
                        </p>
                        <p className="mt-1 font-black capitalize text-[#020617]">
                          {selectedOrder.meal_type}
                        </p>
                      </div>
                      <div className="rounded-[18px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Scheduled Date
                        </p>
                        <p className="mt-1 font-black text-[#020617]">
                          {format(
                            new Date(selectedOrder.scheduled_date),
                            "MMM d, yyyy",
                          )}
                        </p>
                      </div>
                      <div className="rounded-[18px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                        <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Status
                        </p>
                        {getOrderStatusBadge(selectedOrder.order_status)}
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button
                        variant="outline"
                        className="min-h-[48px] flex-1 rounded-[16px] border-[#38BDF8]/30 bg-[#38BDF8]/10 font-black text-[#020617] hover:bg-[#38BDF8]/15"
                        onClick={() =>
                          navigate(`/admin/orders?id=${selectedOrder.id}`)
                        }
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Full Details
                      </Button>
                    </div>
                  </div>
                )}
              </AdminDialogContent>
            </Dialog>
          </TabsContent>

          {/* Payouts Tab */}
          <TabsContent value="payouts" className="space-y-6">
            {/* Bank Account Summary */}
            {restaurantDetails && (
              <AdminPanel className="rounded-[28px]">
                <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
                  <h2 className="flex items-center gap-2 text-base font-black text-[#020617]">
                    <CreditCard className="w-4 h-4" />
                    Bank Account on File
                  </h2>
                </div>
                <div className="pt-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 text-sm">
                    {[
                      {
                        label: "Bank",
                        value: restaurantDetails.bank_name_masked,
                      },
                      {
                        label: "Account Holder",
                        value: restaurantDetails.bank_account_name_masked,
                      },
                      {
                        label: "Account Number",
                        value: restaurantDetails.bank_account_number_masked,
                      },
                      {
                        label: "IBAN",
                        value: restaurantDetails.bank_iban_masked,
                      },
                      {
                        label: "SWIFT",
                        value: restaurantDetails.swift_code_masked,
                      },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center gap-2">
                        <span className="text-[#94A3B8] w-36 shrink-0">
                          {label}
                        </span>
                        <span
                          className={
                            value ? "font-medium" : "text-[#94A3B8] italic"
                          }
                        >
                          {value || "Not set"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </AdminPanel>
            )}

            {/* Payout History */}
            <AdminPanel className="rounded-[28px]">
              <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
                <h2 className="text-base font-black text-[#020617]">
                  Payout Request History
                </h2>
                <p className="mt-1 text-sm font-semibold text-[#94A3B8]">
                  All partner-initiated payout requests for this restaurant
                </p>
              </div>
              <div className="pt-5">
                {payoutsLoading ? (
                  <div className="flex items-center justify-center h-32">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : restaurantPayouts.length === 0 ? (
                  <div className="text-center py-8 text-[#94A3B8]">
                    <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No payout requests yet</p>
                  </div>
                ) : (
                  <>
                    <div className="grid gap-3 md:hidden">
                      {restaurantPayouts.map((payout) => (
                        <div
                          key={payout.id}
                          className="rounded-[24px] border border-[#E5EAF1] bg-white p-4 shadow-[0_12px_30px_rgba(2,6,23,0.05)]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-lg font-black text-[#22C7A1]">
                                {formatCurrency(payout.amount)}
                              </p>
                              <p className="mt-1 text-xs font-semibold text-[#94A3B8]">
                                {format(new Date(payout.period_start), "MMM d")}{" "}
                                -{" "}
                                {format(
                                  new Date(payout.period_end),
                                  "MMM d, yyyy",
                                )}
                              </p>
                            </div>
                            {payout.status === "completed" ? (
                              <Badge
                                variant="outline"
                                className="border-[#22C7A1]/20 bg-[#22C7A1]/10 text-[#22C7A1]"
                              >
                                <CheckCircle className="mr-1 h-3 w-3" />
                                Completed
                              </Badge>
                            ) : payout.status === "failed" ? (
                              <Badge
                                variant="outline"
                                className="border-[#FB6B7A]/20 bg-[#FB6B7A]/10 text-[#FB6B7A]"
                              >
                                <XCircle className="mr-1 h-3 w-3" />
                                Failed
                              </Badge>
                            ) : payout.status === "processing" ? (
                              <Badge
                                variant="outline"
                                className="border-[#38BDF8]/20 bg-[#38BDF8]/10 text-[#38BDF8]"
                              >
                                <Clock className="mr-1 h-3 w-3" />
                                Processing
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="border-[#F97316]/20 bg-[#F97316]/10 text-[#F97316]"
                              >
                                <Clock className="mr-1 h-3 w-3" />
                                Pending
                              </Badge>
                            )}
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <div className="rounded-2xl bg-[#F6F8FB] p-3">
                              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                                Method
                              </p>
                              <p className="mt-1 truncate text-sm font-black capitalize text-[#020617]">
                                {payout.payout_method?.replace(/_/g, " ") ||
                                  "-"}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-[#F6F8FB] p-3">
                              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                                Requested
                              </p>
                              <p className="mt-1 text-sm font-black text-[#020617]">
                                {payout.created_at
                                  ? format(
                                      new Date(payout.created_at),
                                      "MMM d, yyyy",
                                    )
                                  : "-"}
                              </p>
                            </div>
                          </div>
                          <p className="mt-3 truncate font-mono text-xs font-semibold text-[#94A3B8]">
                            Ref: {payout.reference_number || "-"}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="hidden overflow-hidden rounded-[22px] border border-[#E5EAF1] md:block">
                      <Table>
                        <TableHeader className="bg-[#F6F8FB]">
                          <TableRow className="border-[#E5EAF1] hover:bg-[#F6F8FB]">
                            <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                              Period
                            </TableHead>
                            <TableHead className="text-right text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                              Amount
                            </TableHead>
                            <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                              Method
                            </TableHead>
                            <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                              Status
                            </TableHead>
                            <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                              Reference
                            </TableHead>
                            <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                              Requested
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {restaurantPayouts.map((payout) => (
                            <TableRow
                              key={payout.id}
                              className="border-[#E5EAF1] transition-colors hover:bg-[#F6F8FB]/70"
                            >
                              <TableCell className="text-sm font-semibold text-[#020617]">
                                {format(new Date(payout.period_start), "MMM d")}{" "}
                                -{" "}
                                {format(
                                  new Date(payout.period_end),
                                  "MMM d, yyyy",
                                )}
                              </TableCell>
                              <TableCell className="text-right font-black text-[#22C7A1]">
                                {formatCurrency(payout.amount)}
                              </TableCell>
                              <TableCell className="text-sm font-semibold capitalize text-[#94A3B8]">
                                {payout.payout_method?.replace(/_/g, " ") ||
                                  "-"}
                              </TableCell>
                              <TableCell>
                                {payout.status === "completed" ? (
                                  <Badge
                                    variant="outline"
                                    className="border-[#22C7A1]/25 bg-[#22C7A1]/10 text-[#22C7A1]"
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Completed
                                  </Badge>
                                ) : payout.status === "failed" ? (
                                  <Badge
                                    variant="outline"
                                    className="border-[#FB6B7A]/25 bg-[#FB6B7A]/10 text-[#FB6B7A]"
                                  >
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Failed
                                  </Badge>
                                ) : payout.status === "processing" ? (
                                  <Badge
                                    variant="outline"
                                    className="border-[#38BDF8]/25 bg-[#38BDF8]/10 text-[#38BDF8]"
                                  >
                                    <Clock className="h-3 w-3 mr-1" />
                                    Processing
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="border-[#F97316]/25 bg-[#F97316]/10 text-[#F97316]"
                                  >
                                    <Clock className="h-3 w-3 mr-1" />
                                    Pending
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-xs font-semibold text-[#94A3B8]">
                                {payout.reference_number || "-"}
                              </TableCell>
                              <TableCell className="text-sm font-semibold text-[#94A3B8]">
                                {payout.created_at
                                  ? format(
                                      new Date(payout.created_at),
                                      "MMM d, yyyy",
                                    )
                                  : "-"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
              </div>
            </AdminPanel>
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AdminDialogContent size="md">
            <DialogHeader className="border-b border-[#E5EAF1] bg-[#FB6B7A]/10 p-5 text-left">
              <DialogTitle className="flex items-center gap-2 text-xl font-black text-[#FB6B7A]">
                <AlertTriangle className="w-5 h-5" />
                Delete Restaurant
              </DialogTitle>
              <DialogDescription className="font-semibold text-[#94A3B8]">
                This action cannot be undone. This will permanently delete{" "}
                {restaurant.name} and all associated data.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 p-5">
              <div className="rounded-[18px] border border-[#FB6B7A]/20 bg-[#FB6B7A]/10 p-4">
                <p className="text-sm font-semibold leading-6 text-[#FB6B7A]">
                  <strong>Warning:</strong> Deleting this restaurant will also
                  remove all associated meals, orders, and reviews.
                </p>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="confirm-delete"
                  className="font-black text-[#020617]"
                >
                  Type <strong>{restaurant.name}</strong> to confirm
                </Label>
                <Input
                  id="confirm-delete"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type restaurant name"
                  className="min-h-[48px] rounded-[16px] border-[#E5EAF1] bg-[#F6F8FB] font-bold text-[#020617] focus-visible:ring-[#020617]"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-3 border-t border-[#E5EAF1] bg-[#F6F8FB] p-5">
              <Button
                variant="outline"
                className="min-h-[44px] rounded-[16px] border-[#E5EAF1] bg-white font-black text-[#020617]"
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                disabled={deleteConfirmText !== restaurant.name || deleting}
                className="min-h-[44px] rounded-[16px] bg-[#FB6B7A] font-black text-white hover:bg-[#FB6B7A]/90 disabled:opacity-60"
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
          </AdminDialogContent>
        </Dialog>
        <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
          <AdminDialogContent size="md">
            <DialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 text-left">
              <DialogTitle className="flex items-center gap-2 text-xl font-black text-[#020617]">
                <AlertTriangle className="h-5 w-5 text-[#F97316]" />
                Leave without saving?
              </DialogTitle>
              <DialogDescription className="font-semibold leading-6 text-[#94A3B8]">
                You have unsaved restaurant changes. If you leave now, the edits
                on this page will be discarded.
              </DialogDescription>
            </DialogHeader>
            <div className="p-5">
              <div className="rounded-[18px] border border-[#F97316]/20 bg-[#F97316]/10 p-4">
                <p className="text-sm font-black text-[#020617]">
                  Review before leaving
                </p>
                <p className="mt-1 text-sm font-semibold leading-6 text-[#94A3B8]">
                  Save changes to keep updates to profile, settings, or delivery
                  data.
                </p>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-3 border-t border-[#E5EAF1] bg-[#F6F8FB] p-5">
              <Button
                variant="outline"
                className="min-h-[44px] rounded-[16px] border-[#E5EAF1] bg-white font-black text-[#020617]"
                onClick={() => setLeaveDialogOpen(false)}
              >
                Stay here
              </Button>
              <Button
                variant="outline"
                className="min-h-[44px] rounded-[16px] border-[#FB6B7A]/30 bg-[#FB6B7A]/10 font-black text-[#FB6B7A] hover:bg-[#FB6B7A]/15"
                onClick={confirmLeaveWithoutSaving}
              >
                Leave page
              </Button>
            </DialogFooter>
          </AdminDialogContent>
        </Dialog>
        {/* Create Owner Account Dialog */}
        <Dialog
          open={ownerDialogOpen}
          onOpenChange={(open) => {
            setOwnerDialogOpen(open);
            if (!open) setOwnerCreated(null);
          }}
        >
          <AdminDialogContent size="md">
            <DialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 text-left">
              <DialogTitle className="flex items-center gap-2 text-xl font-black text-[#020617]">
                <UserPlus className="w-5 h-5 text-[#7C83F6]" />
                Invite Owner
              </DialogTitle>
              <DialogDescription className="font-semibold text-[#94A3B8]">
                Send a secure account invitation for <strong>{restaurant?.name}</strong>.
                The owner chooses a password from a one-time email link.
              </DialogDescription>
            </DialogHeader>

            {ownerCreated ? (
              /* Success state */
              <div className="space-y-4 p-5">
                <div className="space-y-3 rounded-[20px] border border-[#22C7A1]/20 bg-[#22C7A1]/10 p-4">
                  <p className="flex items-center gap-2 text-sm font-black text-[#22C7A1]">
                    <CheckCheck className="w-4 h-4" /> Invitation sent
                    successfully
                  </p>
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                        Email
                      </p>
                      <p className="text-sm font-black text-[#020617]">
                        {ownerCreated.email}
                      </p>
                    </div>
                  </div>
                  <p className="rounded-[14px] border border-[#38BDF8]/20 bg-[#EFFAFF] p-3 text-xs font-bold text-[#0369A1]">
                    No password was generated or exposed. The invitation link
                    lets the owner establish credentials directly with the
                    authentication provider.
                  </p>
                </div>
                <p className="text-center text-xs font-semibold text-[#94A3B8]">
                  Login URL:{" "}
                  <strong>{window.location.origin}/partner/auth</strong>
                </p>
              </div>
            ) : (
              /* Form state */
              <div className="space-y-4 p-5">
                <div className="space-y-2">
                  <Label
                    htmlFor="owner-name"
                    className="font-black text-[#020617]"
                  >
                    Full Name
                  </Label>
                  <Input
                    id="owner-name"
                    placeholder="e.g. Ahmed Al-Rashid"
                    value={ownerForm.full_name}
                    onChange={(e) =>
                      setOwnerForm((p) => ({ ...p, full_name: e.target.value }))
                    }
                    className="min-h-[48px] rounded-[16px] border-[#E5EAF1] bg-[#F6F8FB] font-bold text-[#020617] focus-visible:ring-[#020617]"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="owner-email"
                    className="font-black text-[#020617]"
                  >
                    Email <span className="text-[#FB6B7A]">*</span>
                  </Label>
                  <Input
                    id="owner-email"
                    type="email"
                    placeholder="owner@restaurant.qa"
                    value={ownerForm.email}
                    onChange={(e) =>
                      setOwnerForm((p) => ({ ...p, email: e.target.value }))
                    }
                    className="min-h-[48px] rounded-[16px] border-[#E5EAF1] bg-[#F6F8FB] font-bold text-[#020617] focus-visible:ring-[#020617]"
                  />
                </div>
                <p className="rounded-[14px] border border-[#E5EAF1] bg-[#F6F8FB] p-3 text-xs font-semibold leading-5 text-[#64748B]">
                  The invitation is sent only to this address. Confirm it with
                  the restaurant owner before sending.
                </p>
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-3 border-t border-[#E5EAF1] bg-[#F6F8FB] p-5">
              <Button
                variant="outline"
                className="min-h-[44px] rounded-[16px] border-[#E5EAF1] bg-white font-black text-[#020617]"
                onClick={() => setOwnerDialogOpen(false)}
              >
                {ownerCreated ? "Close" : "Cancel"}
              </Button>
              {!ownerCreated && (
                <Button
                  onClick={handleCreateOwner}
                  disabled={ownerCreating || !ownerForm.email}
                  variant="outline"
                  className="min-h-[44px] rounded-[16px] border-[#22C7A1]/30 bg-[#22C7A1]/10 font-black text-[#020617] hover:bg-[#22C7A1]/15"
                >
                  {ownerCreating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Send Invitation
                    </>
                  )}
                </Button>
              )}
            </DialogFooter>
          </AdminDialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminRestaurantDetail;
