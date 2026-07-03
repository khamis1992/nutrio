import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import {
  Calendar,
  CheckCircle,
  Clock,
  CreditCard,
  Download,
  Search,
  Star,
  User,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/currency";

interface AffiliatePayout {
  id: string;
  user_id: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  payout_method: string;
  payout_details: Record<string, string>;
  requested_at: string;
  processed_at: string | null;
  notes: string | null;
  user_profile?: {
    full_name: string | null;
    affiliate_tier: string | null;
    affiliate_balance: number;
  };
}

interface PayoutStats {
  totalPending: number;
  totalApproved: number;
  totalRejected: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  uniqueAffiliates: number;
}

type TabValue = "all" | "pending" | "approved" | "rejected";

const C = {
  ink: "#020617",
  muted: "#94A3B8",
  panel: "#F6F8FB",
  protein: "#7C83F6",
  progress: "#22C7A1",
  water: "#38BDF8",
  fat: "#FB6B7A",
};

function statusBadge(status: AffiliatePayout["status"]) {
  if (status === "pending") {
    return (
      <Badge variant="outline" className="border-[#FB6B7A]/25 bg-[#FB6B7A]/10 text-[#F97316]">
        <Clock className="mr-1 h-3 w-3" />
        Pending
      </Badge>
    );
  }
  if (status === "approved") {
    return (
      <Badge variant="outline" className="border-[#22C7A1]/25 bg-[#22C7A1]/10 text-[#047857]">
        <CheckCircle className="mr-1 h-3 w-3" />
        Approved
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-[#FB6B7A]/25 bg-[#FB6B7A]/10 text-[#BE123C]">
      <XCircle className="mr-1 h-3 w-3" />
      Rejected
    </Badge>
  );
}

function tierBadge(tier: string | null) {
  const normalized = tier || "bronze";
  const classNameByTier: Record<string, string> = {
    bronze: "border-[#FB6B7A]/25 bg-[#FB6B7A]/10 text-[#F97316]",
    silver: "border-[#E5EAF1] bg-[#F6F8FB] text-[#64748B]",
    gold: "border-[#22C7A1]/25 bg-[#22C7A1]/10 text-[#047857]",
    platinum: "border-[#38BDF8]/25 bg-[#38BDF8]/10 text-[#0369A1]",
    diamond: "border-[#7C83F6]/25 bg-[#7C83F6]/10 text-[#4F46E5]",
  };

  return (
    <Badge variant="outline" className={classNameByTier[normalized] || classNameByTier.bronze}>
      <Star className="mr-1 h-3 w-3" />
      {normalized.charAt(0).toUpperCase() + normalized.slice(1)}
    </Badge>
  );
}

export default function AdminAffiliatePayouts() {
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<AffiliatePayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabValue>("pending");
  const [stats, setStats] = useState<PayoutStats>({
    totalPending: 0,
    totalApproved: 0,
    totalRejected: 0,
    pendingCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    uniqueAffiliates: 0,
  });
  const [selectedPayout, setSelectedPayout] = useState<AffiliatePayout | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [processing, setProcessing] = useState(false);
  const [selectedPayouts, setSelectedPayouts] = useState<Set<string>>(new Set());

  const fetchPayouts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("affiliate_payouts")
        .select("*")
        .order("requested_at", { ascending: false });

      if (error) throw error;

      const payoutsWithProfiles = await Promise.all(
        (data || []).map(async (payout) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name, affiliate_tier, affiliate_balance")
            .eq("user_id", payout.user_id)
            .single();

          return {
            ...payout,
            payout_details: (payout.payout_details as Record<string, string>) || {},
            user_profile: profile || undefined,
          };
        })
      );

      setPayouts(payoutsWithProfiles);

      const pending = payoutsWithProfiles.filter((payout) => payout.status === "pending");
      const approved = payoutsWithProfiles.filter((payout) => payout.status === "approved");
      const rejected = payoutsWithProfiles.filter((payout) => payout.status === "rejected");

      setStats({
        totalPending: pending.reduce((sum, payout) => sum + Number(payout.amount), 0),
        totalApproved: approved.reduce((sum, payout) => sum + Number(payout.amount), 0),
        totalRejected: rejected.reduce((sum, payout) => sum + Number(payout.amount), 0),
        pendingCount: pending.length,
        approvedCount: approved.length,
        rejectedCount: rejected.length,
        uniqueAffiliates: new Set(payoutsWithProfiles.map((payout) => payout.user_id)).size,
      });
    } catch (error) {
      console.error("Error fetching payouts:", error);
      toast.error("Failed to load affiliate payouts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPayouts();
    }
  }, [user]);

  const filteredPayouts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return payouts.filter((payout) => {
      const matchesSearch =
        !query ||
        payout.user_profile?.full_name?.toLowerCase().includes(query) ||
        payout.payout_method.toLowerCase().includes(query) ||
        payout.id.toLowerCase().includes(query);
      const matchesTab = activeTab === "all" || payout.status === activeTab;
      return matchesSearch && matchesTab;
    });
  }, [activeTab, payouts, searchQuery]);

  const tabs: { value: TabValue; label: string; count: number }[] = [
    { value: "pending", label: "Pending", count: stats.pendingCount },
    { value: "approved", label: "Approved", count: stats.approvedCount },
    { value: "rejected", label: "Rejected", count: stats.rejectedCount },
    { value: "all", label: "All", count: payouts.length },
  ];

  const handleAction = async () => {
    if (!selectedPayout || !actionType) return;

    setProcessing(true);
    try {
      const newStatus = actionType === "approve" ? "approved" : "rejected";

      const { error } = await supabase
        .from("affiliate_payouts")
        .update({
          status: newStatus,
          processed_at: new Date().toISOString(),
          notes: actionNotes || null,
        })
        .eq("id", selectedPayout.id);

      if (error) throw error;

      if (actionType === "approve") {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({
            affiliate_balance: (selectedPayout.user_profile?.affiliate_balance || 0) - selectedPayout.amount,
          })
          .eq("user_id", selectedPayout.user_id);

        if (profileError) throw profileError;
      }

      toast.success(`Payout ${newStatus} successfully`);
      fetchPayouts();
      setSelectedPayout(null);
      setDetailOpen(false);
      setActionType(null);
      setActionNotes("");
    } catch (error) {
      console.error("Error processing payout:", error);
      toast.error("Failed to process payout");
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkAction = async (action: "approve" | "reject") => {
    if (selectedPayouts.size === 0) return;

    setProcessing(true);
    try {
      const newStatus = action === "approve" ? "approved" : "rejected";
      const { error } = await supabase
        .from("affiliate_payouts")
        .update({
          status: newStatus,
          processed_at: new Date().toISOString(),
        })
        .in("id", Array.from(selectedPayouts));

      if (error) throw error;

      toast.success(`${selectedPayouts.size} payout(s) ${action === "approve" ? "approved" : "rejected"}`);
      setSelectedPayouts(new Set());
      fetchPayouts();
    } catch (error) {
      console.error("Error updating payouts:", error);
      toast.error("Failed to update payouts");
    } finally {
      setProcessing(false);
    }
  };

  const handleExportCSV = () => {
    const csvRows = [
      ["ID", "Affiliate", "Tier", "Amount", "Method", "Status", "Requested At", "Processed At", "Notes"],
      ...filteredPayouts.map((payout) => [
        payout.id,
        payout.user_profile?.full_name || "Unknown",
        payout.user_profile?.affiliate_tier || "Bronze",
        payout.amount,
        payout.payout_method.replace("_", " "),
        payout.status,
        format(new Date(payout.requested_at), "yyyy-MM-dd HH:mm"),
        payout.processed_at ? format(new Date(payout.processed_at), "yyyy-MM-dd HH:mm") : "-",
        payout.notes || "",
      ]),
    ];

    const csvContent = csvRows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `affiliate-payouts-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Payouts exported to CSV");
  };

  const togglePayoutSelection = (payoutId: string) => {
    setSelectedPayouts((current) => {
      const next = new Set(current);
      if (next.has(payoutId)) {
        next.delete(payoutId);
      } else {
        next.add(payoutId);
      }
      return next;
    });
  };

  const toggleAllSelection = () => {
    if (selectedPayouts.size === filteredPayouts.length) {
      setSelectedPayouts(new Set());
    } else {
      setSelectedPayouts(new Set(filteredPayouts.map((payout) => payout.id)));
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Affiliate Payouts" subtitle="Manage affiliate payout requests">
        <div className="space-y-5 bg-[#F6F8FB]">
          <Skeleton className="h-36 rounded-[28px]" />
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <Skeleton key={item} className="h-28 rounded-[24px]" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-[28px]" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Affiliate Payouts" subtitle="Manage affiliate payout requests">
      <div className="space-y-5 bg-[#F6F8FB] pb-8 text-[#020617]">
        <div className="overflow-hidden rounded-[28px] bg-white p-5 ring-1 ring-[#E5EAF1]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#F6F8FB] px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-[#7C83F6]">
                <span className="h-2 w-2 rounded-full bg-[#22C7A1]" />
                Affiliate finance
              </div>
              <h1 className="mt-3 text-[28px] font-black leading-tight text-[#020617]">Affiliate payouts</h1>
              <p className="mt-1 max-w-[42rem] text-sm font-semibold leading-6 text-[#64748B]">
                Review affiliate payout requests, verify payment details, and process approvals with a clean operations queue.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleExportCSV}
              className="min-h-12 rounded-full border-[#E5EAF1] bg-white px-5 font-black text-[#020617] shadow-none"
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Pending", value: formatCurrency(stats.totalPending), note: `${stats.pendingCount} waiting`, icon: Clock, color: C.fat },
            { label: "Approved", value: formatCurrency(stats.totalApproved), note: `${stats.approvedCount} paid out`, icon: CheckCircle, color: C.progress },
            { label: "Rejected", value: formatCurrency(stats.totalRejected), note: `${stats.rejectedCount} declined`, icon: XCircle, color: C.water },
            { label: "Affiliates", value: stats.uniqueAffiliates, note: "Active partners", icon: Users, color: C.protein },
          ].map(({ label, value, note, icon: Icon, color }) => (
            <div key={label} className="rounded-[24px] bg-white p-4 ring-1 ring-[#E5EAF1]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#94A3B8]">{label}</p>
                  <p className="mt-1 truncate text-2xl font-black text-[#020617]">{value}</p>
                  <p className="mt-1 text-xs font-bold text-[#94A3B8]">{note}</p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: `${color}18`, color }}>
                  <Icon className="h-6 w-6" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <Card className="rounded-[26px] border-0 bg-white shadow-none ring-1 ring-[#E5EAF1]">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <Input
                  placeholder="Search by name, method, or ID..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="min-h-12 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] pl-11 font-semibold text-[#020617] placeholder:text-[#94A3B8]"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {tabs.map((tab) => {
                  const active = activeTab === tab.value;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setActiveTab(tab.value)}
                      className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-black transition-colors ${
                        active ? "bg-[#020617] text-white" : "bg-[#F6F8FB] text-[#64748B] ring-1 ring-[#E5EAF1]"
                      }`}
                    >
                      {tab.label} <span className={active ? "text-white/70" : "text-[#94A3B8]"}>{tab.count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedPayouts.size > 0 && (
          <div className="flex flex-col gap-3 rounded-[24px] bg-white p-3 ring-1 ring-[#E5EAF1] sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-black text-[#020617]">{selectedPayouts.size} selected</span>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction("approve")}
                disabled={processing}
                className="rounded-full border-[#22C7A1]/25 bg-[#22C7A1]/10 font-black text-[#047857] shadow-none"
              >
                <CheckCircle className="mr-1 h-4 w-4" />
                Approve All
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleBulkAction("reject")}
                disabled={processing}
                className="rounded-full border-[#FB6B7A]/25 bg-[#FB6B7A]/10 font-black text-[#BE123C] shadow-none"
              >
                <XCircle className="mr-1 h-4 w-4" />
                Reject All
              </Button>
            </div>
          </div>
        )}

        <Card className="rounded-[28px] border-0 bg-white shadow-none ring-1 ring-[#E5EAF1]">
          <CardContent className="p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em] text-[#94A3B8]">Requests</p>
                <h2 className="text-xl font-black text-[#020617]">Payout queue</h2>
              </div>
              <label className="flex items-center gap-2 rounded-full bg-[#F6F8FB] px-3 py-2 text-xs font-black text-[#64748B]">
                <Checkbox
                  checked={filteredPayouts.length > 0 && selectedPayouts.size === filteredPayouts.length}
                  onCheckedChange={toggleAllSelection}
                />
                Select all
              </label>
            </div>

            {filteredPayouts.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-[#CBD5E1] bg-[#F6F8FB] px-6 py-14 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] bg-white text-[#7C83F6] ring-1 ring-[#E5EAF1]">
                  <Wallet className="h-8 w-8" />
                </div>
                <p className="font-black text-[#020617]">No payout requests found</p>
                <p className="mt-1 text-sm font-semibold text-[#94A3B8]">Try another tab or search term.</p>
              </div>
            ) : (
              <div className="grid gap-4 xl:grid-cols-2">
                {filteredPayouts.map((payout) => (
                  <div
                    key={payout.id}
                    className="rounded-[26px] bg-[#F6F8FB] p-4 ring-1 ring-[#E5EAF1] transition hover:ring-[#CBD5E1]"
                  >
                    <div className="flex items-start gap-3">
                      <Checkbox
                        checked={selectedPayouts.has(payout.id)}
                        onCheckedChange={() => togglePayoutSelection(payout.id)}
                        className="mt-1"
                      />
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => {
                          setSelectedPayout(payout);
                          setDetailOpen(true);
                        }}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-[#7C83F6] ring-1 ring-[#E5EAF1]">
                              <User className="h-5 w-5" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-base font-black text-[#020617]">
                                {payout.user_profile?.full_name || "Unknown User"}
                              </p>
                              <p className="truncate text-xs font-semibold text-[#94A3B8]">
                                Balance: {formatCurrency(payout.user_profile?.affiliate_balance || 0)}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 sm:justify-end">
                            {tierBadge(payout.user_profile?.affiliate_tier || null)}
                            {statusBadge(payout.status)}
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                          <div className="rounded-2xl bg-white p-3 ring-1 ring-[#E5EAF1]">
                            <Wallet className="mb-2 h-4 w-4 text-[#22C7A1]" />
                            <p className="text-sm font-black text-[#020617]">{formatCurrency(payout.amount)}</p>
                            <p className="text-[10px] font-black uppercase text-[#94A3B8]">Amount</p>
                          </div>
                          <div className="rounded-2xl bg-white p-3 ring-1 ring-[#E5EAF1]">
                            <CreditCard className="mb-2 h-4 w-4 text-[#38BDF8]" />
                            <p className="truncate text-sm font-black capitalize text-[#020617]">{payout.payout_method.replace("_", " ")}</p>
                            <p className="text-[10px] font-black uppercase text-[#94A3B8]">Method</p>
                          </div>
                          <div className="rounded-2xl bg-white p-3 ring-1 ring-[#E5EAF1]">
                            <Calendar className="mb-2 h-4 w-4 text-[#7C83F6]" />
                            <p className="text-sm font-black text-[#020617]">{format(new Date(payout.requested_at), "MMM d")}</p>
                            <p className="text-[10px] font-black uppercase text-[#94A3B8]">Requested</p>
                          </div>
                          <div className="rounded-2xl bg-white p-3 ring-1 ring-[#E5EAF1]">
                            <Star className="mb-2 h-4 w-4 fill-[#FB6B7A] text-[#FB6B7A]" />
                            <p className="truncate text-sm font-black text-[#020617]">#{payout.id.slice(0, 6)}</p>
                            <p className="text-[10px] font-black uppercase text-[#94A3B8]">Request</p>
                          </div>
                        </div>
                      </button>
                    </div>

                    {payout.status === "pending" && (
                      <div className="mt-4 grid grid-cols-2 gap-2 border-t border-[#E5EAF1] pt-4">
                        <Button
                          variant="outline"
                          className="min-h-10 rounded-full border-[#22C7A1]/25 bg-[#22C7A1]/10 font-black text-[#047857] shadow-none"
                          onClick={() => {
                            setSelectedPayout(payout);
                            setActionType("approve");
                          }}
                        >
                          <CheckCircle className="mr-1 h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          className="min-h-10 rounded-full border-[#FB6B7A]/25 bg-[#FB6B7A]/10 font-black text-[#BE123C] shadow-none"
                          onClick={() => {
                            setSelectedPayout(payout);
                            setActionType("reject");
                          }}
                        >
                          <XCircle className="mr-1 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full overflow-y-auto bg-white sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="text-2xl font-black text-[#020617]">Payout Request Details</SheetTitle>
            <SheetDescription className="font-semibold text-[#94A3B8]">
              View complete payout information.
            </SheetDescription>
          </SheetHeader>

          {selectedPayout && (
            <div className="mt-6 space-y-5">
              <div className="rounded-[24px] bg-[#22C7A1]/10 p-4 ring-1 ring-[#22C7A1]/20">
                <p className="text-sm font-black text-[#047857]">Payout Amount</p>
                <p className="mt-1 text-3xl font-black text-[#020617]">{formatCurrency(selectedPayout.amount)}</p>
              </div>

              <div className="grid gap-3">
                {[
                  { label: "Affiliate", value: selectedPayout.user_profile?.full_name || "Unknown", icon: User, color: C.protein },
                  { label: "Payout Method", value: selectedPayout.payout_method.replace("_", " "), icon: CreditCard, color: C.water },
                  { label: "Requested At", value: format(new Date(selectedPayout.requested_at), "MMMM d, yyyy 'at' h:mm a"), icon: Calendar, color: C.fat },
                  ...(selectedPayout.processed_at
                    ? [{ label: "Processed At", value: format(new Date(selectedPayout.processed_at), "MMMM d, yyyy 'at' h:mm a"), icon: CheckCircle, color: C.progress }]
                    : []),
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="flex items-start gap-3 rounded-2xl bg-[#F6F8FB] p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white" style={{ color }}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#94A3B8]">{label}</p>
                      <p className="font-black capitalize text-[#020617]">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {selectedPayout.payout_details && Object.keys(selectedPayout.payout_details).length > 0 && (
                <div className="border-t border-[#E5EAF1] pt-4">
                  <h4 className="mb-3 font-black text-[#020617]">Payment Details</h4>
                  <div className="space-y-2 rounded-2xl bg-[#F6F8FB] p-4">
                    {Object.entries(selectedPayout.payout_details).map(([key, value]) => (
                      <div key={key} className="flex justify-between gap-3 text-sm">
                        <span className="font-semibold capitalize text-[#94A3B8]">{key.replace("_", " ")}</span>
                        <span className="text-right font-black text-[#020617]">
                          {key === "account_number" ? `****${value.slice(-4)}` : value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-[#E5EAF1] pt-4">
                <h4 className="mb-3 font-black text-[#020617]">Status Information</h4>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#94A3B8]">Current Status:</span>
                  {statusBadge(selectedPayout.status)}
                </div>
                {selectedPayout.notes && (
                  <div className="mt-3 rounded-2xl bg-[#F6F8FB] p-3">
                    <p className="mb-1 text-sm font-bold text-[#94A3B8]">Notes:</p>
                    <p className="text-sm font-semibold text-[#020617]">{selectedPayout.notes}</p>
                  </div>
                )}
              </div>

              {selectedPayout.status === "pending" && (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button className="min-h-11 rounded-full bg-[#020617] font-black text-white shadow-none" onClick={() => setActionType("approve")}>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    className="min-h-11 rounded-full border-[#FB6B7A]/25 bg-[#FB6B7A]/10 font-black text-[#BE123C] shadow-none"
                    onClick={() => setActionType("reject")}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Dialog
        open={!!selectedPayout && !!actionType}
        onOpenChange={() => {
          setSelectedPayout(null);
          setDetailOpen(false);
          setActionType(null);
          setActionNotes("");
        }}
      >
        <DialogContent className="rounded-[28px]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-[#020617]">
              {actionType === "approve" ? "Approve Payout" : "Reject Payout"}
            </DialogTitle>
            <DialogDescription className="font-semibold text-[#94A3B8]">
              {actionType === "approve"
                ? "Confirm that you have processed this payout to the affiliate."
                : "Provide a reason for rejecting this payout request."}
            </DialogDescription>
          </DialogHeader>

          {selectedPayout && (
            <div className="space-y-4">
              <div className="rounded-2xl bg-[#F6F8FB] p-4">
                <div className="flex justify-between gap-3">
                  <span className="font-semibold text-[#94A3B8]">Affiliate</span>
                  <span className="font-black text-[#020617]">{selectedPayout.user_profile?.full_name || "Unknown"}</span>
                </div>
                <div className="mt-2 flex justify-between gap-3">
                  <span className="font-semibold text-[#94A3B8]">Amount</span>
                  <span className="text-lg font-black text-[#047857]">{formatCurrency(selectedPayout.amount)}</span>
                </div>
                <div className="mt-2 flex justify-between gap-3">
                  <span className="font-semibold text-[#94A3B8]">Method</span>
                  <span className="font-black capitalize text-[#020617]">{selectedPayout.payout_method.replace("_", " ")}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-[#020617]">
                  Notes {actionType === "reject" && "(required)"}
                </label>
                <Textarea
                  placeholder={actionType === "approve" ? "Add payout notes (optional)" : "Explain why this payout is being rejected..."}
                  value={actionNotes}
                  onChange={(event) => setActionNotes(event.target.value)}
                  className="rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-semibold"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-full border-[#E5EAF1] bg-white font-black text-[#020617] shadow-none"
              onClick={() => {
                setActionType(null);
                setActionNotes("");
              }}
            >
              Cancel
            </Button>
            <Button
              className={actionType === "approve" ? "rounded-full bg-[#020617] font-black text-white shadow-none" : "rounded-full bg-[#FB6B7A] font-black text-white shadow-none"}
              onClick={handleAction}
              disabled={processing || (actionType === "reject" && !actionNotes.trim())}
            >
              {processing && <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              {actionType === "approve" ? "Confirm Approval" : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
