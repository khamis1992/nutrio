import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DollarSign,
  Search,
  CheckCircle,
  Clock,
  XCircle,
  Building2,
  Calendar,
  TrendingUp,
  Loader2,
  FileText,
  Download,
  MoreHorizontal,
  Wallet,
  Percent,
  User,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/currency";

interface Payout {
  id: string;
  partner_id: string;
  restaurant_id: string;
  amount: number;
  status: "pending" | "processed" | "rejected";
  period_start: string;
  period_end: string;
  order_count: number;
  commission_rate: number | null;
  total_order_value: number | null;
  commission_deducted: number | null;
  payout_method: string | null;
  processed_at: string | null;
  created_at: string;
  restaurant?: {
    name: string;
  };
  partner?: {
    full_name: string | null;
  };
}

interface PayoutStats {
  totalPending: number;
  totalProcessed: number;
  pendingCount: number;
  processedCount: number;
  rejectedCount: number;
  totalCommission: number;
  totalOrderValue: number;
}

interface PartnerRequest {
  id: string;
  restaurant_id: string;
  amount: number;
  status: "pending" | "processing" | "completed" | "failed";
  period_start: string;
  period_end: string;
  payout_method: string | null;
  reference_number: string | null;
  processed_at: string | null;
  created_at: string;
  restaurant?: { name: string; owner_id: string | null };
  partner_name?: string | null;
}

interface PartnerBankDetails {
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_iban: string | null;
  swift_code: string | null;
}

type TabValue = "all" | "pending" | "processed" | "rejected";
type MainView = "payouts" | "partner_requests";

type PartnerPayoutRow = {
  id: string;
  restaurant_id: string;
  amount: number;
  status: string | null;
  period_start: string;
  period_end: string;
  payout_method: string | null;
  reference_number: string | null;
  processed_at: string | null;
  created_at: string | null;
  restaurant: { name: string; owner_id: string | null } | null;
};

const normalizePartnerRequestStatus = (
  status: string | null,
): PartnerRequest["status"] => {
  if (
    status === "processing" ||
    status === "completed" ||
    status === "failed"
  ) {
    return status;
  }

  return "pending";
};

export default function AdminPayouts() {
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabValue>("all");
  const [stats, setStats] = useState<PayoutStats>({
    totalPending: 0,
    totalProcessed: 0,
    pendingCount: 0,
    processedCount: 0,
    rejectedCount: 0,
    totalCommission: 0,
    totalOrderValue: 0,
  });
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(
    null,
  );
  const [processing, setProcessing] = useState(false);
  const [generatingPayout, setGeneratingPayout] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [restaurants, setRestaurants] = useState<
    { id: string; name: string; owner_id: string }[]
  >([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [selectedPayouts, setSelectedPayouts] = useState<Set<string>>(
    new Set(),
  );

  // Partner Requests state
  const [mainView, setMainView] = useState<MainView>("payouts");
  const [partnerRequests, setPartnerRequests] = useState<PartnerRequest[]>([]);
  const [partnerRequestsLoading, setPartnerRequestsLoading] = useState(false);
  const [selectedPartnerRequest, setSelectedPartnerRequest] =
    useState<PartnerRequest | null>(null);
  const [partnerBankDetails, setPartnerBankDetails] =
    useState<PartnerBankDetails | null>(null);
  const [partnerDetailOpen, setPartnerDetailOpen] = useState(false);
  const [partnerActionDialogOpen, setPartnerActionDialogOpen] = useState(false);
  const [partnerActionType, setPartnerActionType] = useState<
    "approve" | "reject" | null
  >(null);
  const [referenceNumber, setReferenceNumber] = useState("");

  const fetchPayouts = useCallback(async () => {
    try {
      setLoading(true);

      const { data: payoutsData, error: payoutsError } = await supabase
        .from("payouts")
        .select(
          `
          *,
          restaurant:restaurants(name)
        `,
        )
        .order("created_at", { ascending: false });

      if (payoutsError) throw payoutsError;

      const partnerIds = [
        ...new Set(
          (payoutsData || []).map((p: { partner_id: string }) => p.partner_id),
        ),
      ];

      let profilesMap: Record<string, string> = {};
      if (partnerIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", partnerIds);

        profilesMap = (profilesData || []).reduce(
          (
            acc: Record<string, string>,
            p: { user_id: string; full_name: string | null },
          ) => {
            acc[p.user_id] = p.full_name || "Unknown";
            return acc;
          },
          {} as Record<string, string>,
        );
      }

      const formattedPayouts: Payout[] = (payoutsData || []).map(
        (payout: {
          id: string;
          partner_id: string;
          restaurant_id: string;
          amount: number;
          status: Payout["status"];
          period_start: string;
          period_end: string;
          order_count: number;
          commission_rate: number | null;
          total_order_value: number | null;
          commission_deducted: number | null;
          payout_method: string | null;
          processed_at: string | null;
          created_at: string;
          restaurant: { name: string } | null;
        }) => ({
          id: payout.id,
          partner_id: payout.partner_id,
          restaurant_id: payout.restaurant_id,
          amount: payout.amount,
          status: payout.status,
          period_start: payout.period_start,
          period_end: payout.period_end,
          order_count: payout.order_count,
          commission_rate: payout.commission_rate,
          total_order_value: payout.total_order_value,
          commission_deducted: payout.commission_deducted,
          payout_method: payout.payout_method,
          processed_at: payout.processed_at,
          created_at: payout.created_at,
          restaurant: payout.restaurant as { name: string } | undefined,
          partner: { full_name: profilesMap[payout.partner_id] || null },
        }),
      );

      setPayouts(formattedPayouts);

      const pending = formattedPayouts.filter((p) => p.status === "pending");
      const processed = formattedPayouts.filter(
        (p) => p.status === "processed",
      );
      const rejected = formattedPayouts.filter((p) => p.status === "rejected");

      setStats({
        totalPending: pending.reduce((sum, p) => sum + Number(p.amount), 0),
        totalProcessed: processed.reduce((sum, p) => sum + Number(p.amount), 0),
        pendingCount: pending.length,
        processedCount: processed.length,
        rejectedCount: rejected.length,
        totalCommission: formattedPayouts.reduce(
          (sum, p) => sum + Number(p.commission_deducted || 0),
          0,
        ),
        totalOrderValue: formattedPayouts.reduce(
          (sum, p) => sum + Number(p.total_order_value || 0),
          0,
        ),
      });
    } catch (error) {
      console.error("Error fetching payouts:", error);
      toast.error("Failed to load payouts");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRestaurants = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, owner_id")
        .eq("approval_status", "approved")
        .order("name");

      if (error) throw error;
      setRestaurants(
        (data || [])
          .filter((r) => r.owner_id !== null)
          .map((r) => ({ ...r, owner_id: r.owner_id! })),
      );
    } catch (error) {
      console.error("Error fetching restaurants:", error);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchPayouts();
      fetchRestaurants();
    }
  }, [user, fetchPayouts, fetchRestaurants]);

  const handleAction = async () => {
    if (!selectedPayout || !actionType) return;

    setProcessing(true);
    try {
      const newStatus = actionType === "approve" ? "processed" : "rejected";
      const updateData: Record<string, unknown> = { status: newStatus };

      if (actionType === "approve") {
        updateData.processed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("payouts")
        .update(updateData)
        .eq("id", selectedPayout.id);

      if (error) throw error;

      toast.success(
        `Payout ${actionType === "approve" ? "approved and processed" : "rejected"}`,
      );
      setActionDialogOpen(false);
      setDetailOpen(false);
      setSelectedPayout(null);
      setActionType(null);
      fetchPayouts();
    } catch (error) {
      console.error("Error updating payout:", error);
      toast.error("Failed to update payout");
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkAction = async (action: "approve" | "reject") => {
    if (selectedPayouts.size === 0) return;

    setProcessing(true);
    try {
      const newStatus = action === "approve" ? "processed" : "rejected";
      const updateData: Record<string, unknown> = { status: newStatus };

      if (action === "approve") {
        updateData.processed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("payouts")
        .update(updateData)
        .in("id", Array.from(selectedPayouts));

      if (error) throw error;

      toast.success(
        `${selectedPayouts.size} payout(s) ${action === "approve" ? "approved" : "rejected"}`,
      );
      setSelectedPayouts(new Set());
      fetchPayouts();
    } catch (error) {
      console.error("Error updating payouts:", error);
      toast.error("Failed to update payouts");
    } finally {
      setProcessing(false);
    }
  };

  const handleGeneratePayout = async () => {
    if (!selectedRestaurant || !periodStart || !periodEnd) {
      toast.error("Please fill in all fields");
      return;
    }

    setGeneratingPayout(true);
    try {
      const { error } = await supabase.rpc("generate_partner_payout", {
        p_restaurant_id: selectedRestaurant,
        p_period_start: periodStart,
        p_period_end: periodEnd,
      });

      if (error) throw error;

      toast.success("Payout generated successfully");
      setGenerateDialogOpen(false);
      setSelectedRestaurant("");
      setPeriodStart("");
      setPeriodEnd("");
      fetchPayouts();
    } catch (error: unknown) {
      console.error("Error generating payout:", error);
      const message =
        error instanceof Error ? error.message : "Failed to generate payout";
      toast.error(message);
    } finally {
      setGeneratingPayout(false);
    }
  };

  const fetchPartnerRequests = useCallback(async () => {
    setPartnerRequestsLoading(true);
    try {
      const { data, error } = await supabase
        .from("partner_payouts")
        .select(
          `
          id,
          restaurant_id,
          amount,
          status,
          period_start,
          period_end,
          payout_method,
          reference_number,
          processed_at,
          created_at,
          restaurant:restaurants(name, owner_id)
        `,
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = (data || []) as unknown as PartnerPayoutRow[];
      const ownerIds = [
        ...new Set(
          rows
            .map((row) => row.restaurant?.owner_id)
            .filter((ownerId): ownerId is string => Boolean(ownerId)),
        ),
      ];

      let profilesMap: Record<string, string> = {};
      if (ownerIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", ownerIds);

        if (profilesError) throw profilesError;

        profilesMap = (profilesData || []).reduce(
          (
            acc: Record<string, string>,
            profile: { user_id: string; full_name: string | null },
          ) => {
            acc[profile.user_id] = profile.full_name || "Unknown partner";
            return acc;
          },
          {},
        );
      }

      setPartnerRequests(
        rows.map((row) => ({
          id: row.id,
          restaurant_id: row.restaurant_id,
          amount: row.amount,
          status: normalizePartnerRequestStatus(row.status),
          period_start: row.period_start,
          period_end: row.period_end,
          payout_method: row.payout_method,
          reference_number: row.reference_number,
          processed_at: row.processed_at,
          created_at: row.created_at || new Date().toISOString(),
          restaurant: row.restaurant || undefined,
          partner_name: row.restaurant?.owner_id
            ? profilesMap[row.restaurant.owner_id] || null
            : null,
        })),
      );
    } catch (error) {
      console.error("Error fetching partner payout requests:", error);
      toast.error("Failed to load partner payout requests");
    } finally {
      setPartnerRequestsLoading(false);
    }
  }, []);

  const openPartnerDetail = async (request: PartnerRequest) => {
    setSelectedPartnerRequest(request);
    setPartnerBankDetails(null);
    setPartnerDetailOpen(true);

    try {
      const { data, error } = await supabase
        .from("restaurant_details")
        .select(
          "bank_name, bank_account_name, bank_account_number, bank_iban, swift_code",
        )
        .eq("restaurant_id", request.restaurant_id)
        .maybeSingle();

      if (error) throw error;

      setPartnerBankDetails((data as PartnerBankDetails | null) || null);
    } catch (error) {
      console.error("Error fetching partner bank details:", error);
      toast.error("Failed to load partner bank details");
    }
  };

  const handlePartnerRequestAction = async () => {
    if (!selectedPartnerRequest || !partnerActionType) return;
    setProcessing(true);
    try {
      const newStatus =
        partnerActionType === "approve" ? "completed" : "failed";
      const updateData: Record<string, unknown> = { status: newStatus };
      if (partnerActionType === "approve") {
        updateData.processed_at = new Date().toISOString();
        if (referenceNumber.trim()) {
          updateData.reference_number = referenceNumber.trim();
        }
      }
      const { error } = await supabase
        .from("partner_payouts")
        .update(updateData)
        .eq("id", selectedPartnerRequest.id);
      if (error) throw error;
      toast.success(
        `Payout request ${partnerActionType === "approve" ? "approved" : "rejected"}`,
      );
      setPartnerActionDialogOpen(false);
      setPartnerDetailOpen(false);
      setSelectedPartnerRequest(null);
      setPartnerActionType(null);
      setReferenceNumber("");
      fetchPartnerRequests();
    } catch (error) {
      console.error("Error updating partner request:", error);
      toast.error("Failed to update payout request");
    } finally {
      setProcessing(false);
    }
  };

  const handleExportCSV = () => {
    const csvRows = [
      [
        "ID",
        "Restaurant",
        "Partner",
        "Period Start",
        "Period End",
        "Orders",
        "Order Value",
        "Commission",
        "Payout Amount",
        "Status",
        "Created At",
      ],
      ...filteredPayouts.map((p) => [
        p.id,
        p.restaurant?.name || "Unknown",
        p.partner?.full_name || "Unknown",
        format(new Date(p.period_start), "yyyy-MM-dd"),
        format(new Date(p.period_end), "yyyy-MM-dd"),
        p.order_count,
        p.total_order_value || 0,
        p.commission_deducted || 0,
        p.amount,
        p.status,
        format(new Date(p.created_at), "yyyy-MM-dd HH:mm"),
      ]),
    ];

    const csvContent = csvRows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payouts-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Payouts exported to CSV");
  };

  const togglePayoutSelection = (payoutId: string) => {
    const newSelected = new Set(selectedPayouts);
    if (newSelected.has(payoutId)) {
      newSelected.delete(payoutId);
    } else {
      newSelected.add(payoutId);
    }
    setSelectedPayouts(newSelected);
  };

  const toggleAllSelection = () => {
    if (selectedPayouts.size === filteredPayouts.length) {
      setSelectedPayouts(new Set());
    } else {
      setSelectedPayouts(new Set(filteredPayouts.map((p) => p.id)));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge
            variant="outline"
            className="rounded-full border-[#7C83F6]/25 bg-[#7C83F6]/10 px-3 py-1 text-[#7C83F6]"
          >
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "processed":
        return (
          <Badge
            variant="outline"
            className="rounded-full border-[#22C7A1]/25 bg-[#22C7A1]/10 px-3 py-1 text-[#22C7A1]"
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            Processed
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="outline"
            className="rounded-full border-[#FB6B7A]/25 bg-[#FB6B7A]/10 px-3 py-1 text-[#FB6B7A]"
          >
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="rounded-full border-[#E5EAF1] px-3 py-1 text-[#94A3B8]"
          >
            {status}
          </Badge>
        );
    }
  };

  const getPartnerRequestStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge
            variant="outline"
            className="rounded-full border-[#7C83F6]/25 bg-[#7C83F6]/10 px-3 py-1 text-[#7C83F6]"
          >
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "processing":
        return (
          <Badge
            variant="outline"
            className="rounded-full border-[#38BDF8]/25 bg-[#38BDF8]/10 px-3 py-1 text-[#0284C7]"
          >
            <Loader2 className="h-3 w-3 mr-1" />
            Processing
          </Badge>
        );
      case "completed":
        return (
          <Badge
            variant="outline"
            className="rounded-full border-[#22C7A1]/25 bg-[#22C7A1]/10 px-3 py-1 text-[#22C7A1]"
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        );
      case "failed":
        return (
          <Badge
            variant="outline"
            className="rounded-full border-[#FB6B7A]/25 bg-[#FB6B7A]/10 px-3 py-1 text-[#FB6B7A]"
          >
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="rounded-full border-[#E5EAF1] px-3 py-1 text-[#94A3B8]"
          >
            {status}
          </Badge>
        );
    }
  };

  const pendingPartnerCount = partnerRequests.filter(
    (r) => r.status === "pending" || r.status === "processing",
  ).length;

  const filteredPartnerRequests = partnerRequests.filter(
    (r) =>
      r.restaurant?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.partner_name || "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      r.id.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const tabs: { value: TabValue; label: string; count: number }[] = [
    { value: "all", label: "All", count: payouts.length },
    { value: "pending", label: "Pending", count: stats.pendingCount },
    { value: "processed", label: "Processed", count: stats.processedCount },
    { value: "rejected", label: "Rejected", count: stats.rejectedCount },
  ];

  const filteredPayouts = payouts.filter((payout) => {
    const matchesSearch =
      payout.restaurant?.name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      payout.partner?.full_name
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      payout.id.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTab = activeTab === "all" || payout.status === activeTab;

    return matchesSearch && matchesTab;
  });

  if (loading) {
    return (
      <AdminLayout title="Payouts" subtitle="Manage partner payouts">
        <div className="space-y-6 bg-[#F6F8FB] text-[#020617]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-32 rounded-[24px] bg-white" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-[28px] bg-white" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Payouts"
      subtitle="Manage partner payouts and commissions"
    >
      <div className="space-y-6 bg-[#F6F8FB] text-[#020617]">
        <section className="overflow-hidden rounded-[28px] border border-[#E5EAF1] bg-white p-5 text-[#020617] shadow-[0_18px_44px_rgba(2,6,23,0.06)] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#38BDF8]/20 bg-[#38BDF8]/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[#38BDF8]">
                <Wallet className="h-3.5 w-3.5" />
                Partner finance
              </div>
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
                Payout operations
              </h2>
              <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-[#94A3B8]">
                Review pending payouts, process partner requests, and keep
                commission records clean.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
              <div className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#94A3B8]">
                  Pending
                </p>
                <p className="mt-2 text-xl font-black text-[#020617]">{stats.pendingCount}</p>
              </div>
              <div className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#94A3B8]">
                  Rejected
                </p>
                <p className="mt-2 text-xl font-black text-[#020617]">{stats.rejectedCount}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="rounded-[24px] border-[#E5EAF1] bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#94A3B8]">
                    Pending Payouts
                  </p>
                  <p className="mt-2 text-2xl font-black text-[#020617]">
                    {formatCurrency(stats.totalPending)}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#7C83F6]">
                    {stats.pendingCount} awaiting processing
                  </p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#7C83F6]/10">
                  <Clock className="h-6 w-6 text-[#7C83F6]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-[#E5EAF1] bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#94A3B8]">
                    Processed
                  </p>
                  <p className="mt-2 text-2xl font-black text-[#020617]">
                    {formatCurrency(stats.totalProcessed)}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#22C7A1]">
                    {stats.processedCount} completed
                  </p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#22C7A1]/10">
                  <CheckCircle className="h-6 w-6 text-[#22C7A1]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-[#E5EAF1] bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#94A3B8]">
                    Total Commission
                  </p>
                  <p className="mt-2 text-2xl font-black text-[#020617]">
                    {formatCurrency(stats.totalCommission)}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#7C83F6]">
                    Platform earnings
                  </p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#7C83F6]/10">
                  <Percent className="h-6 w-6 text-[#7C83F6]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-[#E5EAF1] bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#94A3B8]">
                    Total Order Value
                  </p>
                  <p className="mt-2 text-2xl font-black text-[#020617]">
                    {formatCurrency(stats.totalOrderValue)}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#38BDF8]">
                    Gross revenue
                  </p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#38BDF8]/10">
                  <TrendingUp className="h-6 w-6 text-[#38BDF8]" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Actions */}
        <Card className="rounded-[24px] border-[#E5EAF1] bg-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
              <div className="relative flex-1 w-full max-w-md">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <Input
                  placeholder="Search by restaurant, partner, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="min-h-[48px] rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] pl-11 text-[#020617] placeholder:text-[#94A3B8]"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  onClick={handleExportCSV}
                  className="min-h-[48px] rounded-2xl border-[#E5EAF1] bg-white px-5 text-[#020617] hover:bg-[#F6F8FB]"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button
                  onClick={() => setGenerateDialogOpen(true)}
                  className="min-h-[48px] rounded-2xl bg-[#020617] px-5 text-white hover:bg-[#020617]/90"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Payout
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs and Table */}
        <Card className="overflow-hidden rounded-[28px] border-[#E5EAF1] bg-white shadow-sm">
          <CardContent className="p-0">
            {/* Tabs */}
            <div className="border-b border-[#E5EAF1] bg-white px-4 py-4">
              <div className="flex flex-wrap gap-2 items-center">
                {tabs.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => {
                      setMainView("payouts");
                      setActiveTab(tab.value);
                    }}
                    className={`min-h-[44px] rounded-2xl px-4 py-2 text-sm font-bold transition-colors ${
                      mainView === "payouts" && activeTab === tab.value
                        ? "bg-[#020617] text-white shadow-[0_12px_28px_rgba(2,6,23,0.18)]"
                        : "border border-[#E5EAF1] bg-[#F6F8FB] text-[#94A3B8] hover:bg-white"
                    }`}
                  >
                    {tab.label}
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                        mainView === "payouts" && activeTab === tab.value
                          ? "bg-white/20 text-white"
                          : "bg-white text-[#94A3B8]"
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
                <div className="mx-1 h-6 w-px bg-[#E5EAF1]" />
                <button
                  onClick={() => {
                    setMainView("partner_requests");
                    fetchPartnerRequests();
                  }}
                  className={`min-h-[44px] rounded-2xl px-4 py-2 text-sm font-bold transition-colors ${
                    mainView === "partner_requests"
                      ? "bg-[#020617] text-white shadow-[0_12px_28px_rgba(2,6,23,0.18)]"
                      : "border border-[#E5EAF1] bg-[#F6F8FB] text-[#94A3B8] hover:bg-white"
                  }`}
                >
                  Partner Requests
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                      mainView === "partner_requests"
                        ? "bg-white/20 text-white"
                        : "bg-[#7C83F6]/10 text-[#7C83F6]"
                    }`}
                  >
                    {pendingPartnerCount}
                  </span>
                </button>
              </div>
            </div>

            {/* Bulk Actions (payouts view only) */}
            {mainView === "payouts" && selectedPayouts.size > 0 && (
              <div className="flex flex-col gap-3 border-b border-[#E5EAF1] bg-[#F6F8FB] px-4 py-3 sm:flex-row sm:items-center">
                <span className="text-sm font-bold text-[#020617]">
                  {selectedPayouts.size} selected
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkAction("approve")}
                    disabled={processing}
                    className="rounded-xl border-[#22C7A1]/25 bg-white text-[#22C7A1] hover:bg-[#22C7A1]/10"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkAction("reject")}
                    disabled={processing}
                    className="rounded-xl border-[#FB6B7A]/25 bg-white text-[#FB6B7A] hover:bg-[#FB6B7A]/10"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject All
                  </Button>
                </div>
              </div>
            )}

            {/* Partner Requests Table */}
            {mainView === "partner_requests" &&
              (partnerRequestsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-[#7C83F6]" />
                </div>
              ) : filteredPartnerRequests.length === 0 ? (
                <div className="text-center py-16">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F6F8FB]">
                    <Wallet className="h-8 w-8 text-[#94A3B8]" />
                  </div>
                  <p className="font-semibold text-[#94A3B8]">
                    No partner payout requests found
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-[#F6F8FB]">
                      <TableRow className="border-[#E5EAF1] hover:bg-[#F6F8FB]">
                        <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Restaurant
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Partner
                        </TableHead>
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
                          Ref #
                        </TableHead>
                        <TableHead className="w-24 text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPartnerRequests.map((req) => (
                        <TableRow
                          key={req.id}
                          className="cursor-pointer border-[#E5EAF1] hover:bg-[#F6F8FB]"
                          onClick={() => openPartnerDetail(req)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#38BDF8]/10">
                                <Building2 className="h-4 w-4 text-[#38BDF8]" />
                              </div>
                              <span className="font-bold text-[#020617]">
                                {req.restaurant?.name || "Unknown"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-[#94A3B8]" />
                              <span className="text-[#020617]">
                                {req.partner_name || "Unknown"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm font-medium text-[#94A3B8]">
                              <Calendar className="h-3 w-3" />
                              {format(
                                new Date(req.period_start),
                                "MMM d",
                              )} -{" "}
                              {format(new Date(req.period_end), "MMM d, yyyy")}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-black text-[#22C7A1]">
                            {formatCurrency(req.amount)}
                          </TableCell>
                          <TableCell className="capitalize text-sm font-medium text-[#94A3B8]">
                            {req.payout_method?.replace(/_/g, " ") || "-"}
                          </TableCell>
                          <TableCell>
                            {getPartnerRequestStatusBadge(req.status)}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-[#94A3B8]">
                            {req.reference_number || "-"}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            {(req.status === "pending" ||
                              req.status === "processing") && (
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 rounded-xl border-[#22C7A1]/25 px-2 text-[#22C7A1] hover:bg-[#22C7A1]/10"
                                  onClick={() => {
                                    setSelectedPartnerRequest(req);
                                    setPartnerActionType("approve");
                                    setPartnerActionDialogOpen(true);
                                  }}
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 rounded-xl border-[#FB6B7A]/25 px-2 text-[#FB6B7A] hover:bg-[#FB6B7A]/10"
                                  onClick={() => {
                                    setSelectedPartnerRequest(req);
                                    setPartnerActionType("reject");
                                    setPartnerActionDialogOpen(true);
                                  }}
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}

            {/* Admin Payouts Table */}
            {mainView === "payouts" && filteredPayouts.length === 0 ? (
              <div className="text-center py-16">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#F6F8FB]">
                  <DollarSign className="h-8 w-8 text-[#94A3B8]" />
                </div>
                <p className="font-semibold text-[#94A3B8]">No payouts found</p>
              </div>
            ) : (
              mainView === "payouts" && (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-[#F6F8FB]">
                      <TableRow className="border-[#E5EAF1] hover:bg-[#F6F8FB]">
                        <TableHead className="w-12">
                          <Checkbox
                            checked={
                              filteredPayouts.length > 0 &&
                              selectedPayouts.size === filteredPayouts.length
                            }
                            onCheckedChange={toggleAllSelection}
                          />
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Restaurant
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Partner
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Period
                        </TableHead>
                        <TableHead className="text-right text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Orders
                        </TableHead>
                        <TableHead className="text-right text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Gross Value
                        </TableHead>
                        <TableHead className="text-right text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Commission
                        </TableHead>
                        <TableHead className="text-right text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Payout
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Status
                        </TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayouts.map((payout) => (
                        <TableRow
                          key={payout.id}
                          className="cursor-pointer border-[#E5EAF1] hover:bg-[#F6F8FB]"
                          onClick={() => {
                            setSelectedPayout(payout);
                            setDetailOpen(true);
                          }}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedPayouts.has(payout.id)}
                              onCheckedChange={() =>
                                togglePayoutSelection(payout.id)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#38BDF8]/10">
                                <Building2 className="h-4 w-4 text-[#38BDF8]" />
                              </div>
                              <span className="font-bold text-[#020617]">
                                {payout.restaurant?.name || "Unknown"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-[#94A3B8]" />
                              <span className="text-[#020617]">
                                {payout.partner?.full_name || "Unknown"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm font-medium text-[#94A3B8]">
                              <Calendar className="h-3 w-3" />
                              {format(
                                new Date(payout.period_start),
                                "MMM d",
                              )} -{" "}
                              {format(
                                new Date(payout.period_end),
                                "MMM d, yyyy",
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold text-[#020617]">
                            {payout.order_count}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-[#020617]">
                            {formatCurrency(payout.total_order_value || 0)}
                          </TableCell>
                          <TableCell className="text-right text-[#94A3B8]">
                            -{formatCurrency(payout.commission_deducted || 0)}
                            <span className="text-xs ml-1">
                              ({payout.commission_rate || 0}%)
                            </span>
                          </TableCell>
                          <TableCell className="text-right font-black text-[#22C7A1]">
                            {formatCurrency(payout.amount)}
                          </TableCell>
                          <TableCell>{getStatusBadge(payout.status)}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-xl text-[#94A3B8] hover:bg-[#F6F8FB] hover:text-[#020617]"
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {payout.status === "pending" && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedPayout(payout);
                                        setActionType("approve");
                                        setActionDialogOpen(true);
                                      }}
                                      className="text-[#22C7A1]"
                                    >
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Approve
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setSelectedPayout(payout);
                                        setActionType("reject");
                                        setActionDialogOpen(true);
                                      }}
                                      className="text-[#FB6B7A]"
                                    >
                                      <XCircle className="h-4 w-4 mr-2" />
                                      Reject
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full overflow-y-auto border-[#E5EAF1] bg-[#F6F8FB] text-[#020617] sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="text-[#020617]">Payout Details</SheetTitle>
            <SheetDescription className="text-[#94A3B8]">
              View complete payout information
            </SheetDescription>
          </SheetHeader>

          {selectedPayout && (
            <div className="mt-6 space-y-6">
              <div className="flex items-center justify-between rounded-[24px] border border-[#22C7A1]/20 bg-[#22C7A1]/10 p-4">
                <div>
                  <p className="text-sm font-bold text-[#22C7A1]">
                    Payout Amount
                  </p>
                  <p className="text-3xl font-black text-[#020617]">
                    {formatCurrency(selectedPayout.amount)}
                  </p>
                </div>
                <Wallet className="h-8 w-8 text-[#22C7A1]" />
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#38BDF8]/10">
                    <Building2 className="h-4 w-4 text-[#38BDF8]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#94A3B8]">
                      Restaurant
                    </p>
                    <p className="font-bold text-[#020617]">
                      {selectedPayout.restaurant?.name || "Unknown"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#38BDF8]/10">
                    <User className="h-4 w-4 text-[#38BDF8]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#94A3B8]">
                      Partner
                    </p>
                    <p className="font-bold text-[#020617]">
                      {selectedPayout.partner?.full_name || "Unknown"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#7C83F6]/10">
                    <Calendar className="h-4 w-4 text-[#7C83F6]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#94A3B8]">
                      Payout Period
                    </p>
                    <p className="font-bold text-[#020617]">
                      {format(
                        new Date(selectedPayout.period_start),
                        "MMMM d, yyyy",
                      )}{" "}
                      -{" "}
                      {format(
                        new Date(selectedPayout.period_end),
                        "MMMM d, yyyy",
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#22C7A1]/10">
                    <TrendingUp className="h-4 w-4 text-[#22C7A1]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#94A3B8]">
                      Order Count
                    </p>
                    <p className="font-bold text-[#020617]">
                      {selectedPayout.order_count} orders
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-[#E5EAF1] bg-white p-4">
                <h4 className="mb-3 font-black text-[#020617]">Financial Breakdown</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium text-[#94A3B8]">
                      Total Order Value
                    </span>
                    <span className="font-bold text-[#020617]">
                      {formatCurrency(selectedPayout.total_order_value || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-[#94A3B8]">
                      Commission Rate
                    </span>
                    <span className="font-bold text-[#020617]">{selectedPayout.commission_rate || 0}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-[#94A3B8]">
                      Commission Deducted
                    </span>
                    <span className="font-bold text-[#FB6B7A]">
                      -{formatCurrency(selectedPayout.commission_deducted || 0)}
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-[#E5EAF1] pt-2 font-black text-[#020617]">
                    <span>Net Payout</span>
                    <span className="text-[#22C7A1]">
                      {formatCurrency(selectedPayout.amount)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-[#E5EAF1] bg-white p-4">
                <h4 className="mb-3 font-black text-[#020617]">Status Information</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#94A3B8]">
                      Current Status:
                    </span>
                    {getStatusBadge(selectedPayout.status)}
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-[#94A3B8]">Created</span>
                    <span className="font-bold text-[#020617]">
                      {format(
                        new Date(selectedPayout.created_at),
                        "MMM d, yyyy HH:mm",
                      )}
                    </span>
                  </div>
                  {selectedPayout.processed_at && (
                    <div className="flex justify-between">
                      <span className="font-medium text-[#94A3B8]">Processed</span>
                      <span className="font-bold text-[#020617]">
                        {format(
                          new Date(selectedPayout.processed_at),
                          "MMM d, yyyy HH:mm",
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {selectedPayout.status === "pending" && (
                <div className="flex gap-2 pt-4">
                  <Button
                    className="min-h-[44px] flex-1 rounded-2xl bg-[#22C7A1] text-white hover:bg-[#18B28F]"
                    onClick={() => {
                      setActionType("approve");
                      setActionDialogOpen(true);
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve Payout
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-[44px] rounded-2xl border-[#FB6B7A]/25 text-[#FB6B7A] hover:bg-[#FB6B7A]/10"
                    onClick={() => {
                      setActionType("reject");
                      setActionDialogOpen(true);
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Action Confirmation Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="border-[#E5EAF1] bg-white text-[#020617]">
          <DialogHeader>
            <DialogTitle className="text-[#020617]">
              {actionType === "approve" ? "Process Payout" : "Reject Payout"}
            </DialogTitle>
            <DialogDescription className="text-[#94A3B8]">
              {actionType === "approve"
                ? "This will mark the payout as processed and notify the partner."
                : "This will reject the payout request."}
            </DialogDescription>
          </DialogHeader>

          {selectedPayout && (
            <div className="space-y-2 rounded-[20px] border border-[#E5EAF1] bg-[#F6F8FB] p-4 text-sm">
              <div className="flex justify-between">
                <span className="font-medium text-[#94A3B8]">Restaurant:</span>
                <span className="font-bold text-[#020617]">
                  {selectedPayout.restaurant?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-[#94A3B8]">Partner:</span>
                <span className="font-bold text-[#020617]">
                  {selectedPayout.partner?.full_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-[#94A3B8]">Amount:</span>
                <span className="font-black text-[#22C7A1]">
                  {formatCurrency(selectedPayout.amount)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-[#94A3B8]">Period:</span>
                <span className="font-bold text-[#020617]">
                  {format(new Date(selectedPayout.period_start), "MMM d")} -{" "}
                  {format(new Date(selectedPayout.period_end), "MMM d, yyyy")}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActionDialogOpen(false)}
              disabled={processing}
              className="min-h-[44px] rounded-2xl border-[#E5EAF1] text-[#020617] hover:bg-[#F6F8FB]"
            >
              Cancel
            </Button>
            <Button
              variant={actionType === "approve" ? "default" : "destructive"}
              onClick={handleAction}
              disabled={processing}
              className={
                actionType === "approve"
                  ? "min-h-[44px] rounded-2xl bg-[#22C7A1] text-white hover:bg-[#18B28F]"
                  : "min-h-[44px] rounded-2xl bg-[#FB6B7A] text-white hover:bg-[#EF5A6B]"
              }
            >
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {actionType === "approve" ? "Process Payout" : "Reject Payout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Payout Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent className="border-[#E5EAF1] bg-white text-[#020617]">
          <DialogHeader>
            <DialogTitle className="text-[#020617]">Generate Partner Payout</DialogTitle>
            <DialogDescription className="text-[#94A3B8]">
              Create a payout for a restaurant partner based on their orders in
              the specified period.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-[#020617]">Restaurant</label>
              <Select
                value={selectedRestaurant}
                onValueChange={setSelectedRestaurant}
              >
                <SelectTrigger className="min-h-[48px] rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] text-[#020617]">
                  <SelectValue placeholder="Select a restaurant" />
                </SelectTrigger>
                <SelectContent>
                  {restaurants.map((restaurant) => (
                    <SelectItem key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-bold text-[#020617]">Period Start</label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="min-h-[48px] rounded-2xl border-[#E5EAF1] bg-[#F6F8FB]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-[#020617]">Period End</label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="min-h-[48px] rounded-2xl border-[#E5EAF1] bg-[#F6F8FB]"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGenerateDialogOpen(false)}
              disabled={generatingPayout}
              className="min-h-[44px] rounded-2xl border-[#E5EAF1] text-[#020617] hover:bg-[#F6F8FB]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleGeneratePayout}
              disabled={generatingPayout}
              className="min-h-[44px] rounded-2xl bg-[#020617] text-white hover:bg-[#020617]/90"
            >
              {generatingPayout && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Generate Payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Partner Request Detail Sheet */}
      <Sheet open={partnerDetailOpen} onOpenChange={setPartnerDetailOpen}>
        <SheetContent className="w-full overflow-y-auto border-[#E5EAF1] bg-[#F6F8FB] text-[#020617] sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="text-[#020617]">Partner Payout Request</SheetTitle>
            <SheetDescription className="text-[#94A3B8]">
              Review and action this partner-initiated payout request
            </SheetDescription>
          </SheetHeader>

          {selectedPartnerRequest && (
            <div className="mt-6 space-y-6">
              <div className="flex items-center justify-between rounded-[24px] border border-[#22C7A1]/20 bg-[#22C7A1]/10 p-4">
                <div>
                  <p className="text-sm font-bold text-[#22C7A1]">Requested Amount</p>
                  <p className="text-3xl font-black text-[#020617]">
                    {formatCurrency(selectedPartnerRequest.amount)}
                  </p>
                </div>
                <Wallet className="h-8 w-8 text-[#22C7A1]" />
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#38BDF8]/10">
                    <Building2 className="h-4 w-4 text-[#38BDF8]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#94A3B8]">Restaurant</p>
                    <p className="font-bold text-[#020617]">
                      {selectedPartnerRequest.restaurant?.name || "Unknown"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#38BDF8]/10">
                    <User className="h-4 w-4 text-[#38BDF8]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#94A3B8]">Partner</p>
                    <p className="font-bold text-[#020617]">
                      {selectedPartnerRequest.partner_name || "Unknown"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#7C83F6]/10">
                    <Calendar className="h-4 w-4 text-[#7C83F6]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#94A3B8]">
                      Payout Period
                    </p>
                    <p className="font-bold text-[#020617]">
                      {format(
                        new Date(selectedPartnerRequest.period_start),
                        "MMMM d, yyyy",
                      )}{" "}
                      –{" "}
                      {format(
                        new Date(selectedPartnerRequest.period_end),
                        "MMMM d, yyyy",
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Bank Account Details */}
              <div className="rounded-[24px] border border-[#E5EAF1] bg-white p-4">
                <h4 className="mb-3 font-black text-[#020617]">Bank Account</h4>
                {partnerBankDetails ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium text-[#94A3B8]">Bank</span>
                      <span className="font-bold text-[#020617]">
                        {partnerBankDetails.bank_name || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-[#94A3B8]">
                        Account Holder
                      </span>
                      <span className="font-bold text-[#020617]">
                        {partnerBankDetails.bank_account_name || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-[#94A3B8]">
                        Account Number
                      </span>
                      <span className="font-mono font-bold text-[#020617]">
                        {partnerBankDetails.bank_account_number
                          ? "****" +
                            partnerBankDetails.bank_account_number.slice(-4)
                          : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-[#94A3B8]">IBAN</span>
                      <span className="font-mono font-bold text-[#020617]">
                        {partnerBankDetails.bank_iban
                          ? "****" + partnerBankDetails.bank_iban.slice(-4)
                          : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-[#94A3B8]">SWIFT</span>
                      <span className="font-bold text-[#020617]">
                        {partnerBankDetails.swift_code || "-"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm font-medium italic text-[#94A3B8]">
                    Loading bank details...
                  </p>
                )}
              </div>

              {/* Status */}
              <div className="rounded-[24px] border border-[#E5EAF1] bg-white p-4">
                <h4 className="mb-3 font-black text-[#020617]">Status</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#94A3B8]">
                      Current Status:
                    </span>
                    {getPartnerRequestStatusBadge(
                      selectedPartnerRequest.status,
                    )}
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-[#94A3B8]">Requested</span>
                    <span className="font-bold text-[#020617]">
                      {format(
                        new Date(selectedPartnerRequest.created_at),
                        "MMM d, yyyy HH:mm",
                      )}
                    </span>
                  </div>
                  {selectedPartnerRequest.reference_number && (
                    <div className="flex justify-between">
                      <span className="font-medium text-[#94A3B8]">Reference</span>
                      <span className="font-mono font-bold text-[#020617]">
                        {selectedPartnerRequest.reference_number}
                      </span>
                    </div>
                  )}
                  {selectedPartnerRequest.processed_at && (
                    <div className="flex justify-between">
                      <span className="font-medium text-[#94A3B8]">Processed</span>
                      <span className="font-bold text-[#020617]">
                        {format(
                          new Date(selectedPartnerRequest.processed_at),
                          "MMM d, yyyy HH:mm",
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {(selectedPartnerRequest.status === "pending" ||
                selectedPartnerRequest.status === "processing") && (
                <div className="flex gap-2 pt-4">
                  <Button
                    className="min-h-[44px] flex-1 rounded-2xl bg-[#22C7A1] text-white hover:bg-[#18B28F]"
                    onClick={() => {
                      setPartnerActionType("approve");
                      setPartnerActionDialogOpen(true);
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve & Process
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-[44px] rounded-2xl border-[#FB6B7A]/25 text-[#FB6B7A] hover:bg-[#FB6B7A]/10"
                    onClick={() => {
                      setPartnerActionType("reject");
                      setPartnerActionDialogOpen(true);
                    }}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Partner Request Action Dialog */}
      <Dialog
        open={partnerActionDialogOpen}
        onOpenChange={setPartnerActionDialogOpen}
      >
        <DialogContent className="border-[#E5EAF1] bg-white text-[#020617]">
          <DialogHeader>
            <DialogTitle className="text-[#020617]">
              {partnerActionType === "approve"
                ? "Approve Payout Request"
                : "Reject Payout Request"}
            </DialogTitle>
            <DialogDescription className="text-[#94A3B8]">
              {partnerActionType === "approve"
                ? "This will mark the payout as completed. The partner will see this update immediately."
                : "This will mark the payout request as failed."}
            </DialogDescription>
          </DialogHeader>

          {selectedPartnerRequest && (
            <div className="space-y-4">
              <div className="space-y-2 rounded-[20px] border border-[#E5EAF1] bg-[#F6F8FB] p-4 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium text-[#94A3B8]">Restaurant:</span>
                  <span className="font-bold text-[#020617]">
                    {selectedPartnerRequest.restaurant?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-[#94A3B8]">Partner:</span>
                  <span className="font-bold text-[#020617]">
                    {selectedPartnerRequest.partner_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-[#94A3B8]">Amount:</span>
                  <span className="font-black text-[#22C7A1]">
                    {formatCurrency(selectedPartnerRequest.amount)}
                  </span>
                </div>
              </div>

              {partnerActionType === "approve" && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#020617]">
                    Reference Number (optional)
                  </label>
                  <Input
                    placeholder="Bank transfer ref, wire ID, etc."
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    className="min-h-[48px] rounded-2xl border-[#E5EAF1] bg-[#F6F8FB]"
                  />
                  <p className="text-xs font-medium text-[#94A3B8]">
                    This will be shown to the partner on their payouts page.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPartnerActionDialogOpen(false);
                setReferenceNumber("");
              }}
              disabled={processing}
              className="min-h-[44px] rounded-2xl border-[#E5EAF1] text-[#020617] hover:bg-[#F6F8FB]"
            >
              Cancel
            </Button>
            <Button
              variant={
                partnerActionType === "approve" ? "default" : "destructive"
              }
              onClick={handlePartnerRequestAction}
              disabled={processing}
              className={
                partnerActionType === "approve"
                  ? "min-h-[44px] rounded-2xl bg-[#22C7A1] text-white hover:bg-[#18B28F]"
                  : "min-h-[44px] rounded-2xl bg-[#FB6B7A] text-white hover:bg-[#EF5A6B]"
              }
            >
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {partnerActionType === "approve"
                ? "Approve & Mark Completed"
                : "Reject Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
