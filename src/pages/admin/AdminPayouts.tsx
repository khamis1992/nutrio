import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import {
  AdminSheetContent,
  AdminDialogContent,
  AdminFilterBar,
  AdminKpiStrip,
  AdminPanel,
  AdminWorkbenchHeader,
} from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
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
import { downloadCsv } from "@/lib/csv";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/currency";
import {
  getPartnerBankingSummary,
  type PartnerBankingSummary,
} from "@/lib/partner-banking";
import {
  transitionLegacyPartnerPayout,
  transitionPartnerPayout,
} from "@/lib/payouts";

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
    useState<PartnerBankingSummary | null>(null);
  const [partnerBankLoading, setPartnerBankLoading] = useState(false);
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

      const validPayouts = (payoutsData || []).filter((payout) =>
        Boolean(
          payout.partner_id &&
          payout.restaurant_id &&
          payout.period_start &&
          payout.period_end,
        ),
      );

      const partnerIds = [
        ...new Set(
          validPayouts
            .map((payout) => payout.partner_id!)
            .filter((id): id is string => Boolean(id)),
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

      const formattedPayouts: Payout[] = validPayouts.map((payout) => ({
        id: payout.id,
        partner_id: payout.partner_id!,
        restaurant_id: payout.restaurant_id!,
        amount: payout.amount,
        status:
          payout.status === "processed" || payout.status === "rejected"
            ? payout.status
            : "pending",
        period_start: payout.period_start!,
        period_end: payout.period_end!,
        order_count: payout.order_count,
        commission_rate: payout.commission_rate,
        total_order_value: payout.total_order_value,
        commission_deducted: payout.commission_deducted,
        payout_method: payout.payout_method,
        processed_at: payout.processed_at,
        created_at: payout.created_at,
        restaurant: payout.restaurant as { name: string } | undefined,
        partner: { full_name: profilesMap[payout.partner_id!] || null },
      }));

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
      await transitionLegacyPartnerPayout(
        selectedPayout.id,
        actionType === "approve" ? "process" : "reject",
        actionType === "approve" ? referenceNumber : undefined,
      );

      toast.success(
        `Payout ${actionType === "approve" ? "approved and processed" : "rejected"}`,
      );
      setActionDialogOpen(false);
      setDetailOpen(false);
      setSelectedPayout(null);
      setActionType(null);
      setReferenceNumber("");
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

    if (action === "approve") {
      toast.error(
        "Process payouts individually so every bank transfer has its own reference",
      );
      return;
    }

    setProcessing(true);
    try {
      await Promise.all(
        Array.from(selectedPayouts).map((payoutId) =>
          transitionLegacyPartnerPayout(payoutId, "reject"),
        ),
      );

      toast.success(`${selectedPayouts.size} payout(s) rejected`);
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
      setMainView("partner_requests");
      fetchPartnerRequests();
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
    setPartnerBankLoading(true);
    setPartnerDetailOpen(true);

    try {
      setPartnerBankDetails(
        await getPartnerBankingSummary(request.restaurant_id),
      );
    } catch (error) {
      console.error("Error fetching partner bank details:", error);
      toast.error("Failed to load partner bank details");
    } finally {
      setPartnerBankLoading(false);
    }
  };

  const handlePartnerRequestAction = async () => {
    if (!selectedPartnerRequest || !partnerActionType) return;
    setProcessing(true);
    try {
      await transitionPartnerPayout(
        selectedPartnerRequest.id,
        partnerActionType === "approve" ? "complete" : "reject",
        partnerActionType === "approve" ? referenceNumber : undefined,
      );
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

    downloadCsv(csvRows, `payouts-${format(new Date(), "yyyy-MM-dd")}.csv`);
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
            className="rounded-full border-[#38BDF8]/25 bg-[#38BDF8]/10 px-3 py-1 text-[#38BDF8]"
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
        <AdminWorkbenchHeader
          eyebrow="Finance settlement"
          title="Payout command desk"
          icon={Wallet}
          accent="#7C83F6"
          description="Review payout liabilities, partner withdrawal requests, commission deductions, and settlement exceptions from one finance workflow."
          meta={[
            { label: "Pending payouts", value: stats.pendingCount },
            { label: "Partner requests", value: pendingPartnerCount },
            { label: "Selected", value: selectedPayouts.size },
          ]}
          actions={
            <>
              <Button
                variant="outline"
                onClick={handleExportCSV}
                className="h-11 rounded-[14px] border-[#E5EAF1] bg-white px-4 font-black text-[#020617] hover:bg-[#F6F8FB]"
              >
                <Download className="mr-2 h-4 w-4 text-[#38BDF8]" />
                Export CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => setGenerateDialogOpen(true)}
                className="h-11 rounded-[14px] border-[#7C83F6]/30 bg-[#7C83F6]/10 px-4 font-black text-[#020617] hover:bg-[#7C83F6]/15"
              >
                <FileText className="mr-2 h-4 w-4 text-[#7C83F6]" />
                Generate Payout
              </Button>
            </>
          }
        />

        <AdminKpiStrip
          items={[
            {
              label: "Pending Payouts",
              value: formatCurrency(stats.totalPending),
              helper: `${stats.pendingCount} awaiting processing`,
              icon: Clock,
              accent: "#7C83F6",
            },
            {
              label: "Processed",
              value: formatCurrency(stats.totalProcessed),
              helper: `${stats.processedCount} completed`,
              icon: CheckCircle,
              accent: "#22C7A1",
            },
            {
              label: "Total Commission",
              value: formatCurrency(stats.totalCommission),
              helper: "Platform earnings",
              icon: Percent,
              accent: "#F97316",
            },
            {
              label: "Total Order Value",
              value: formatCurrency(stats.totalOrderValue),
              helper: "Gross revenue",
              icon: TrendingUp,
              accent: "#38BDF8",
            },
          ]}
        />

        <AdminFilterBar title="Settlement queue">
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              placeholder="Search by restaurant, partner, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-h-[48px] rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] pl-11 text-[#020617] placeholder:text-[#94A3B8] focus-visible:ring-[#7C83F6]/30"
            />
          </div>
        </AdminFilterBar>

        {/* Tabs and Table */}
        <AdminPanel>
          <div className="p-0">
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
                    className={`min-h-[44px] rounded-2xl border px-4 py-2 text-sm font-bold transition-colors ${
                      mainView === "payouts" && activeTab === tab.value
                        ? "border-[#7C83F6]/30 bg-[#7C83F6]/10 text-[#020617]"
                        : "border-[#E5EAF1] bg-[#F6F8FB] text-[#94A3B8] hover:bg-white hover:text-[#020617]"
                    }`}
                  >
                    {tab.label}
                    <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-[#94A3B8]">
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
                  className={`min-h-[44px] rounded-2xl border px-4 py-2 text-sm font-bold transition-colors ${
                    mainView === "partner_requests"
                      ? "border-[#7C83F6]/30 bg-[#7C83F6]/10 text-[#020617]"
                      : "border-[#E5EAF1] bg-[#F6F8FB] text-[#94A3B8] hover:bg-white hover:text-[#020617]"
                  }`}
                >
                  Partner Requests
                  <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-[#7C83F6]">
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
                    className="rounded-2xl border-[#22C7A1]/25 bg-white text-[#22C7A1] hover:bg-[#22C7A1]/10"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkAction("reject")}
                    disabled={processing}
                    className="rounded-2xl border-[#FB6B7A]/25 bg-white text-[#FB6B7A] hover:bg-[#FB6B7A]/10"
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
                <>
                  <div className="grid gap-3 p-4 md:hidden">
                    {filteredPartnerRequests.map((req) => (
                      <div
                        key={req.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => openPartnerDetail(req)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openPartnerDetail(req);
                          }
                        }}
                        className="rounded-[24px] border border-[#E5EAF1] bg-white p-4 text-left shadow-[0_12px_30px_rgba(2,6,23,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(2,6,23,0.08)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#38BDF8]/10">
                              <Building2 className="h-5 w-5 text-[#38BDF8]" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-base font-black text-[#020617]">
                                {req.restaurant?.name || "Unknown"}
                              </p>
                              <p className="mt-1 truncate text-xs font-bold text-[#94A3B8]">
                                {req.partner_name || "Unknown partner"}
                              </p>
                            </div>
                          </div>
                          {getPartnerRequestStatusBadge(req.status)}
                        </div>
                        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                              Amount
                            </p>
                            <p className="mt-1 text-lg font-black text-[#22C7A1]">
                              {formatCurrency(req.amount)}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                              Method
                            </p>
                            <p className="mt-1 truncate text-sm font-black capitalize text-[#020617]">
                              {req.payout_method?.replace(/_/g, " ") || "-"}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#F6F8FB] px-3 py-2 text-xs font-bold text-[#94A3B8]">
                          <span>
                            {format(new Date(req.period_start), "MMM d")} -{" "}
                            {format(new Date(req.period_end), "MMM d, yyyy")}
                          </span>
                          <span className="font-mono">
                            {req.reference_number || "No ref"}
                          </span>
                        </div>
                        {(req.status === "pending" ||
                          req.status === "processing") && (
                          <div
                            className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              size="sm"
                              variant="outline"
                              className="min-h-11 rounded-2xl border-[#22C7A1]/25 bg-[#22C7A1]/10 font-black text-[#22C7A1] hover:bg-[#22C7A1]/15"
                              onClick={() => {
                                setSelectedPartnerRequest(req);
                                setPartnerActionType("approve");
                                setPartnerActionDialogOpen(true);
                              }}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="min-h-11 rounded-2xl border-[#FB6B7A]/25 bg-[#FB6B7A]/10 font-black text-[#FB6B7A] hover:bg-[#FB6B7A]/15"
                              onClick={() => {
                                setSelectedPartnerRequest(req);
                                setPartnerActionType("reject");
                                setPartnerActionDialogOpen(true);
                              }}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="hidden overflow-x-auto md:block">
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
                            role="button"
                            tabIndex={0}
                            aria-label={`Open partner payout request for ${req.restaurant?.name || "unknown restaurant"}`}
                            className="cursor-pointer border-[#E5EAF1] outline-none transition-colors hover:bg-[#F6F8FB] focus-visible:bg-[#F6F8FB] focus-visible:ring-2 focus-visible:ring-[#7C83F6]/35"
                            onClick={() => openPartnerDetail(req)}
                            onKeyDown={(event) => {
                              if (event.target !== event.currentTarget) return;
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openPartnerDetail(req);
                              }
                            }}
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
                                {format(
                                  new Date(req.period_end),
                                  "MMM d, yyyy",
                                )}
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
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-11 min-w-11 rounded-2xl border-[#22C7A1]/25 px-3 text-[#22C7A1] hover:bg-[#22C7A1]/10"
                                    aria-label="Approve partner payout request"
                                    onClick={() => {
                                      setSelectedPartnerRequest(req);
                                      setPartnerActionType("approve");
                                      setPartnerActionDialogOpen(true);
                                    }}
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-11 min-w-11 rounded-2xl border-[#FB6B7A]/25 px-3 text-[#FB6B7A] hover:bg-[#FB6B7A]/10"
                                    aria-label="Reject partner payout request"
                                    onClick={() => {
                                      setSelectedPartnerRequest(req);
                                      setPartnerActionType("reject");
                                      setPartnerActionDialogOpen(true);
                                    }}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
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
                <>
                  <div className="grid gap-3 p-4 md:hidden">
                    {filteredPayouts.map((payout) => (
                      <div
                        key={payout.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          setSelectedPayout(payout);
                          setDetailOpen(true);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedPayout(payout);
                            setDetailOpen(true);
                          }
                        }}
                        className="rounded-[24px] border border-[#E5EAF1] bg-white p-4 text-left shadow-[0_12px_30px_rgba(2,6,23,0.05)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(2,6,23,0.08)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <div
                              className="pt-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Checkbox
                                checked={selectedPayouts.has(payout.id)}
                                onCheckedChange={() =>
                                  togglePayoutSelection(payout.id)
                                }
                              />
                            </div>
                            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#38BDF8]/10">
                              <Building2 className="h-5 w-5 text-[#38BDF8]" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-base font-black text-[#020617]">
                                {payout.restaurant?.name || "Unknown"}
                              </p>
                              <p className="mt-1 truncate text-xs font-bold text-[#94A3B8]">
                                {payout.partner?.full_name || "Unknown partner"}
                              </p>
                            </div>
                          </div>
                          {getStatusBadge(payout.status)}
                        </div>
                        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <div className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                              Payout
                            </p>
                            <p className="mt-1 text-lg font-black text-[#22C7A1]">
                              {formatCurrency(payout.amount)}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-3">
                            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                              Orders
                            </p>
                            <p className="mt-1 text-lg font-black text-[#020617]">
                              {payout.order_count}
                            </p>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 text-xs font-bold">
                          <div className="rounded-2xl bg-[#F6F8FB] px-3 py-2 text-[#94A3B8]">
                            Gross{" "}
                            <span className="block text-sm font-black text-[#020617]">
                              {formatCurrency(payout.total_order_value || 0)}
                            </span>
                          </div>
                          <div className="rounded-2xl bg-[#F6F8FB] px-3 py-2 text-[#94A3B8]">
                            Commission{" "}
                            <span className="block text-sm font-black text-[#FB6B7A]">
                              -{formatCurrency(payout.commission_deducted || 0)}
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between rounded-2xl bg-[#F6F8FB] px-3 py-2 text-xs font-bold text-[#94A3B8]">
                          <span>
                            {format(new Date(payout.period_start), "MMM d")} -{" "}
                            {format(new Date(payout.period_end), "MMM d, yyyy")}
                          </span>
                          <span>{payout.commission_rate || 0}%</span>
                        </div>
                        {payout.status === "pending" && (
                          <div
                            className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              size="sm"
                              variant="outline"
                              className="min-h-11 rounded-2xl border-[#22C7A1]/25 bg-[#22C7A1]/10 font-black text-[#22C7A1] hover:bg-[#22C7A1]/15"
                              onClick={() => {
                                setSelectedPayout(payout);
                                setActionType("approve");
                                setActionDialogOpen(true);
                              }}
                            >
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="min-h-11 rounded-2xl border-[#FB6B7A]/25 bg-[#FB6B7A]/10 font-black text-[#FB6B7A] hover:bg-[#FB6B7A]/15"
                              onClick={() => {
                                setSelectedPayout(payout);
                                setActionType("reject");
                                setActionDialogOpen(true);
                              }}
                            >
                              <XCircle className="mr-2 h-4 w-4" />
                              Reject
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="hidden overflow-x-auto md:block">
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
                            role="button"
                            tabIndex={0}
                            aria-label={`Open payout for ${payout.restaurant?.name || "unknown restaurant"}`}
                            className="cursor-pointer border-[#E5EAF1] outline-none transition-colors hover:bg-[#F6F8FB] focus-visible:bg-[#F6F8FB] focus-visible:ring-2 focus-visible:ring-[#7C83F6]/35"
                            onClick={() => {
                              setSelectedPayout(payout);
                              setDetailOpen(true);
                            }}
                            onKeyDown={(event) => {
                              if (event.target !== event.currentTarget) return;
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setSelectedPayout(payout);
                                setDetailOpen(true);
                              }
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
                                )}{" "}
                                -{" "}
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
                            <TableCell>
                              {getStatusBadge(payout.status)}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-11 w-11 rounded-2xl text-[#94A3B8] hover:bg-[#F6F8FB] hover:text-[#020617]"
                                    aria-label="Open payout actions"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                  align="end"
                                  className="rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]"
                                >
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
                </>
              )
            )}
          </div>
        </AdminPanel>
      </div>

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <AdminSheetContent size="lg">
          <SheetHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 text-left shadow-[0_12px_30px_rgba(2,6,23,0.05)]">
            <SheetTitle className="text-[#020617]">Payout Details</SheetTitle>
            <SheetDescription className="text-[#94A3B8]">
              View complete payout information
            </SheetDescription>
          </SheetHeader>

          {selectedPayout && (
            <div className="space-y-6 p-5">
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
                <h4 className="mb-3 font-black text-[#020617]">
                  Financial Breakdown
                </h4>
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
                    <span className="font-bold text-[#020617]">
                      {selectedPayout.commission_rate || 0}%
                    </span>
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
                <h4 className="mb-3 font-black text-[#020617]">
                  Status Information
                </h4>
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
                      <span className="font-medium text-[#94A3B8]">
                        Processed
                      </span>
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
                    className="min-h-[44px] flex-1 rounded-2xl bg-[#22C7A1] text-white hover:bg-[#22C7A1]"
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
        </AdminSheetContent>
      </Sheet>

      {/* Action Confirmation Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <AdminDialogContent size="md">
          <DialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4 text-left">
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
            <div className="space-y-4 bg-[#F6F8FB] px-5 py-4">
              <div className="space-y-2 rounded-[20px] border border-[#E5EAF1] bg-[#F6F8FB] p-4 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium text-[#94A3B8]">
                    Restaurant:
                  </span>
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
              {actionType === "approve" && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-[#020617]">
                    Bank transfer reference
                  </label>
                  <Input
                    value={referenceNumber}
                    onChange={(event) => setReferenceNumber(event.target.value)}
                    placeholder="Required transfer reference"
                    className="min-h-[48px] rounded-2xl border-[#E5EAF1] bg-[#F6F8FB]"
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-3 border-t border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
            <Button
              variant="outline"
              onClick={() => {
                setActionDialogOpen(false);
                setReferenceNumber("");
              }}
              disabled={processing}
              className="min-h-[44px] rounded-2xl border-[#E5EAF1] text-[#020617] hover:bg-[#F6F8FB]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={
                processing ||
                (actionType === "approve" && referenceNumber.trim().length < 3)
              }
              className={
                actionType === "approve"
                  ? "min-h-[44px] rounded-2xl bg-[#22C7A1] font-black text-white hover:bg-[#22C7A1]/90"
                  : "min-h-[44px] rounded-2xl bg-[#FB6B7A] font-black text-white hover:bg-[#FB6B7A]/90"
              }
            >
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {actionType === "approve" ? "Process Payout" : "Reject Payout"}
            </Button>
          </DialogFooter>
        </AdminDialogContent>
      </Dialog>

      {/* Generate Payout Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <AdminDialogContent size="md">
          <DialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4 text-left">
            <DialogTitle className="text-[#020617]">
              Generate Partner Payout
            </DialogTitle>
            <DialogDescription className="text-[#94A3B8]">
              Create a payout for a restaurant partner based on their orders in
              the specified period.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 bg-[#F6F8FB] px-5 py-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-[#020617]">
                Restaurant
              </label>
              <Select
                value={selectedRestaurant}
                onValueChange={setSelectedRestaurant}
              >
                <SelectTrigger className="min-h-[48px] rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] text-[#020617]">
                  <SelectValue placeholder="Select a restaurant" />
                </SelectTrigger>
                <SelectContent className="rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]">
                  {restaurants.map((restaurant) => (
                    <SelectItem key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-bold text-[#020617]">
                  Period Start
                </label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="min-h-[48px] rounded-2xl border-[#E5EAF1] bg-[#F6F8FB]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-bold text-[#020617]">
                  Period End
                </label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="min-h-[48px] rounded-2xl border-[#E5EAF1] bg-[#F6F8FB]"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-3 border-t border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
            <Button
              variant="outline"
              onClick={() => setGenerateDialogOpen(false)}
              disabled={generatingPayout}
              className="min-h-[44px] rounded-2xl border-[#E5EAF1] text-[#020617] hover:bg-[#F6F8FB]"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleGeneratePayout}
              disabled={generatingPayout}
              className="min-h-[44px] rounded-2xl border-[#7C83F6]/30 bg-[#7C83F6]/10 font-black text-[#020617] hover:bg-[#7C83F6]/15"
            >
              {generatingPayout && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Generate Payout
            </Button>
          </DialogFooter>
        </AdminDialogContent>
      </Dialog>
      {/* Partner Request Detail Sheet */}
      <Sheet open={partnerDetailOpen} onOpenChange={setPartnerDetailOpen}>
        <AdminSheetContent size="lg">
          <SheetHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 text-left shadow-[0_12px_30px_rgba(2,6,23,0.05)]">
            <SheetTitle className="text-[#020617]">
              Partner Payout Request
            </SheetTitle>
            <SheetDescription className="text-[#94A3B8]">
              Review and action this partner-initiated payout request
            </SheetDescription>
          </SheetHeader>

          {selectedPartnerRequest && (
            <div className="space-y-6 p-5">
              <div className="flex items-center justify-between rounded-[24px] border border-[#22C7A1]/20 bg-[#22C7A1]/10 p-4">
                <div>
                  <p className="text-sm font-bold text-[#22C7A1]">
                    Requested Amount
                  </p>
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
                    <p className="text-sm font-medium text-[#94A3B8]">
                      Restaurant
                    </p>
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
                    <p className="text-sm font-medium text-[#94A3B8]">
                      Partner
                    </p>
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
                {partnerBankLoading ? (
                  <p className="text-sm font-medium italic text-[#94A3B8]">
                    Loading bank details...
                  </p>
                ) : partnerBankDetails ? (
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
                        {partnerBankDetails.bank_account_name_masked || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-[#94A3B8]">
                        Account Number
                      </span>
                      <span className="font-mono font-bold text-[#020617]">
                        {partnerBankDetails.bank_account_number_masked || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-[#94A3B8]">IBAN</span>
                      <span className="font-mono font-bold text-[#020617]">
                        {partnerBankDetails.bank_iban_masked || "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-[#94A3B8]">SWIFT</span>
                      <span className="font-bold text-[#020617]">
                        {partnerBankDetails.swift_code_masked || "-"}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm font-medium italic text-[#94A3B8]">
                    Bank details unavailable.
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
                    <span className="font-medium text-[#94A3B8]">
                      Requested
                    </span>
                    <span className="font-bold text-[#020617]">
                      {format(
                        new Date(selectedPartnerRequest.created_at),
                        "MMM d, yyyy HH:mm",
                      )}
                    </span>
                  </div>
                  {selectedPartnerRequest.reference_number && (
                    <div className="flex justify-between">
                      <span className="font-medium text-[#94A3B8]">
                        Reference
                      </span>
                      <span className="font-mono font-bold text-[#020617]">
                        {selectedPartnerRequest.reference_number}
                      </span>
                    </div>
                  )}
                  {selectedPartnerRequest.processed_at && (
                    <div className="flex justify-between">
                      <span className="font-medium text-[#94A3B8]">
                        Processed
                      </span>
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
                    className="min-h-[44px] flex-1 rounded-2xl bg-[#22C7A1] text-white hover:bg-[#22C7A1]"
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
        </AdminSheetContent>
      </Sheet>

      {/* Partner Request Action Dialog */}
      <Dialog
        open={partnerActionDialogOpen}
        onOpenChange={setPartnerActionDialogOpen}
      >
        <AdminDialogContent size="md">
          <DialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4 text-left">
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
            <div className="space-y-4 bg-[#F6F8FB] px-5 py-4">
              <div className="space-y-2 rounded-[20px] border border-[#E5EAF1] bg-[#F6F8FB] p-4 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium text-[#94A3B8]">
                    Restaurant:
                  </span>
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
                    Reference Number (required)
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

          <DialogFooter className="gap-2 sm:gap-3 border-t border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
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
              onClick={handlePartnerRequestAction}
              disabled={
                processing ||
                (partnerActionType === "approve" &&
                  referenceNumber.trim().length < 3)
              }
              className={
                partnerActionType === "approve"
                  ? "min-h-[44px] rounded-2xl bg-[#22C7A1] font-black text-white hover:bg-[#22C7A1]/90"
                  : "min-h-[44px] rounded-2xl bg-[#FB6B7A] font-black text-white hover:bg-[#FB6B7A]/90"
              }
            >
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {partnerActionType === "approve"
                ? "Approve & Mark Completed"
                : "Reject Request"}
            </Button>
          </DialogFooter>
        </AdminDialogContent>
      </Dialog>
    </AdminLayout>
  );
}
