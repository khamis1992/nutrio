import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/currency";
import { format } from "date-fns";
import {
  Search,
  Clock,
  CheckCircle,
  XCircle,
  Users,
  Wallet,
  Download,
  MoreHorizontal,
  User,
  CreditCard,
  Calendar,
  Star,
} from "lucide-react";

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

  useEffect(() => {
    if (user) {
      fetchPayouts();
    }
  }, [user]);

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

      const pending = payoutsWithProfiles.filter((p) => p.status === "pending");
      const approved = payoutsWithProfiles.filter((p) => p.status === "approved");
      const rejected = payoutsWithProfiles.filter((p) => p.status === "rejected");

      setStats({
        totalPending: pending.reduce((sum, p) => sum + Number(p.amount), 0),
        totalApproved: approved.reduce((sum, p) => sum + Number(p.amount), 0),
        totalRejected: rejected.reduce((sum, p) => sum + Number(p.amount), 0),
        pendingCount: pending.length,
        approvedCount: approved.length,
        rejectedCount: rejected.length,
        uniqueAffiliates: new Set(payoutsWithProfiles.map((p) => p.user_id)).size,
      });
    } catch (error) {
      console.error("Error fetching payouts:", error);
      toast.error("Failed to load affiliate payouts");
    } finally {
      setLoading(false);
    }
  };

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
      ...filteredPayouts.map(p => [
        p.id,
        p.user_profile?.full_name || "Unknown",
        p.user_profile?.affiliate_tier || "Bronze",
        p.amount,
        p.payout_method.replace("_", " "),
        p.status,
        format(new Date(p.requested_at), "yyyy-MM-dd HH:mm"),
        p.processed_at ? format(new Date(p.processed_at), "yyyy-MM-dd HH:mm") : "-",
        p.notes || "",
      ]),
    ];

    const csvContent = csvRows.map(row => row.join(",")).join("\n");
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
      setSelectedPayouts(new Set(filteredPayouts.map(p => p.id)));
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTierBadge = (tier: string | null) => {
    const colors: Record<string, string> = {
      bronze: "bg-orange-50 text-orange-700 border-orange-200",
      silver: "bg-slate-50 text-slate-700 border-slate-200",
      gold: "bg-yellow-50 text-yellow-700 border-yellow-200",
      platinum: "bg-cyan-50 text-cyan-700 border-cyan-200",
      diamond: "bg-violet-50 text-violet-700 border-violet-200",
    };
    return (
      <Badge variant="outline" className={colors[tier || "bronze"] || colors.bronze}>
        <Star className="h-3 w-3 mr-1" />
        {tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : "Bronze"}
      </Badge>
    );
  };

  const tabs: { value: TabValue; label: string; count: number }[] = [
    { value: "pending", label: "Pending", count: stats.pendingCount },
    { value: "approved", label: "Approved", count: stats.approvedCount },
    { value: "rejected", label: "Rejected", count: stats.rejectedCount },
    { value: "all", label: "All", count: payouts.length },
  ];

  const filteredPayouts = payouts.filter((payout) => {
    const matchesSearch =
      payout.user_profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payout.payout_method.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payout.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === "all" || payout.status === activeTab;
    return matchesSearch && matchesTab;
  });

  if (loading) {
    return (
      <AdminLayout title="Affiliate Payouts" subtitle="Manage affiliate payout requests">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Affiliate Payouts" subtitle="Manage affiliate payout requests">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending Payouts</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(stats.totalPending)}</p>
                  <p className="text-xs text-amber-600 mt-1">{stats.pendingCount} requests waiting</p>
                </div>
                <div className="p-3 rounded-full bg-amber-500/10">
                  <Clock className="h-6 w-6 text-amber-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Approved</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(stats.totalApproved)}</p>
                  <p className="text-xs text-emerald-600 mt-1">{stats.approvedCount} paid out</p>
                </div>
                <div className="p-3 rounded-full bg-emerald-500/10">
                  <CheckCircle className="h-6 w-6 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Rejected</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(stats.totalRejected)}</p>
                  <p className="text-xs text-red-600 mt-1">{stats.rejectedCount} declined</p>
                </div>
                <div className="p-3 rounded-full bg-red-500/10">
                  <XCircle className="h-6 w-6 text-red-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Unique Affiliates</p>
                  <p className="text-3xl font-bold mt-1">{stats.uniqueAffiliates}</p>
                  <p className="text-xs text-violet-600 mt-1">Active partners</p>
                </div>
                <div className="p-3 rounded-full bg-violet-500/10">
                  <Users className="h-6 w-6 text-violet-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Actions */}
        <Card className="border-dashed">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
              <div className="relative flex-1 w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, method, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 min-h-[44px]"
                />
              </div>
              <Button variant="outline" onClick={handleExportCSV} className="min-h-[44px]">
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs and Table */}
        <Card>
          <CardContent className="p-0">
            {/* Tabs */}
            <div className="border-b px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                      activeTab === tab.value
                        ? "bg-primary text-white"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                    }`}
                  >
                    {tab.label}
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                      activeTab === tab.value
                        ? "bg-white/20 text-white"
                        : "bg-background text-muted-foreground"
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Bulk Actions */}
            {selectedPayouts.size > 0 && (
              <div className="px-4 py-3 bg-muted/50 border-b flex items-center gap-4">
                <span className="text-sm font-medium">{selectedPayouts.size} selected</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkAction("approve")}
                    disabled={processing}
                    className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve All
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkAction("reject")}
                    disabled={processing}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Reject All
                  </Button>
                </div>
              </div>
            )}

            {/* Table */}
            {filteredPayouts.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
                  <Wallet className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No payout requests found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={filteredPayouts.length > 0 && selectedPayouts.size === filteredPayouts.length}
                          onCheckedChange={toggleAllSelection}
                        />
                      </TableHead>
                      <TableHead>Affiliate</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayouts.map((payout) => (
                      <TableRow 
                        key={payout.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          setSelectedPayout(payout);
                          setDetailOpen(true);
                        }}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedPayouts.has(payout.id)}
                            onCheckedChange={() => togglePayoutSelection(payout.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">
                                {payout.user_profile?.full_name || "Unknown User"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Balance: {formatCurrency(payout.user_profile?.affiliate_balance || 0)}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getTierBadge(payout.user_profile?.affiliate_tier || null)}</TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600">
                          {formatCurrency(payout.amount)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                            <span className="capitalize">{payout.payout_method.replace("_", " ")}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(payout.requested_at), "MMM d, yyyy")}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(payout.status)}</TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
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
                                    }}
                                    className="text-emerald-600"
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Approve
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectedPayout(payout);
                                      setActionType("reject");
                                    }}
                                    className="text-red-600"
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
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Payout Request Details</SheetTitle>
            <SheetDescription>
              View complete payout information
            </SheetDescription>
          </SheetHeader>
          
          {selectedPayout && (
            <div className="mt-6 space-y-6">
              <div className="flex items-center justify-between p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                <div>
                  <p className="text-sm text-emerald-600">Payout Amount</p>
                  <p className="text-3xl font-bold text-emerald-700">{formatCurrency(selectedPayout.amount)}</p>
                </div>
                <Wallet className="h-8 w-8 text-emerald-500" />
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Affiliate</p>
                    <p className="font-medium">{selectedPayout.user_profile?.full_name || "Unknown"}</p>
                    <div className="mt-1">{getTierBadge(selectedPayout.user_profile?.affiliate_tier || null)}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <CreditCard className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Payout Method</p>
                    <p className="font-medium capitalize">{selectedPayout.payout_method.replace("_", " ")}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Requested At</p>
                    <p className="font-medium">{format(new Date(selectedPayout.requested_at), "MMMM d, yyyy 'at' h:mm a")}</p>
                  </div>
                </div>

                {selectedPayout.processed_at && (
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <CheckCircle className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Processed At</p>
                      <p className="font-medium">{format(new Date(selectedPayout.processed_at), "MMMM d, yyyy 'at' h:mm a")}</p>
                    </div>
                  </div>
                )}
              </div>

              {selectedPayout.payout_details && Object.keys(selectedPayout.payout_details).length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3">Payment Details</h4>
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                    {selectedPayout.payout_details.email && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">PayPal Email</span>
                        <span className="font-medium">{selectedPayout.payout_details.email}</span>
                      </div>
                    )}
                    {selectedPayout.payout_details.bank_name && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Bank Name</span>
                        <span className="font-medium">{selectedPayout.payout_details.bank_name}</span>
                      </div>
                    )}
                    {selectedPayout.payout_details.account_number && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Account Number</span>
                        <span className="font-medium">****{selectedPayout.payout_details.account_number.slice(-4)}</span>
                      </div>
                    )}
                    {selectedPayout.payout_details.iban && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">IBAN</span>
                        <span className="font-medium">{selectedPayout.payout_details.iban}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Status Information</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Current Status:</span>
                    {getStatusBadge(selectedPayout.status)}
                  </div>
                  {selectedPayout.notes && (
                    <div className="bg-muted/50 rounded-lg p-3 mt-2">
                      <p className="text-sm text-muted-foreground mb-1">Notes:</p>
                      <p className="text-sm">{selectedPayout.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {selectedPayout.status === "pending" && (
                <div className="flex gap-2 pt-4">
                  <Button
                    className="flex-1"
                    onClick={() => setActionType("approve")}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve Payout
                  </Button>
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => setActionType("reject")}
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

      {/* Action Dialog */}
      <Dialog
        open={!!selectedPayout && !!actionType}
        onOpenChange={() => {
          setSelectedPayout(null);
          setDetailOpen(false);
          setActionType(null);
          setActionNotes("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Approve Payout" : "Reject Payout"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve"
                ? "Confirm that you have processed this payout to the affiliate."
                : "Provide a reason for rejecting this payout request."}
            </DialogDescription>
          </DialogHeader>

          {selectedPayout && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Affiliate</span>
                  <span className="font-medium">
                    {selectedPayout.user_profile?.full_name || "Unknown"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-bold text-emerald-600 text-lg">
                    {formatCurrency(selectedPayout.amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Method</span>
                  <span className="capitalize">
                    {selectedPayout.payout_method.replace("_", " ")}
                  </span>
                </div>
                {selectedPayout.payout_details?.email && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">PayPal Email</span>
                    <span>{selectedPayout.payout_details.email}</span>
                  </div>
                )}
                {selectedPayout.payout_details?.bank_name && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bank</span>
                    <span>{selectedPayout.payout_details.bank_name}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Notes {actionType === "reject" && "(required)"}
                </label>
                <Textarea
                  placeholder={
                    actionType === "approve"
                      ? "Add any notes about this payout (optional)"
                      : "Explain why this payout is being rejected..."
                  }
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setActionType(null);
                setActionNotes("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant={actionType === "approve" ? "default" : "destructive"}
              onClick={handleAction}
              disabled={processing || (actionType === "reject" && !actionNotes.trim())}
            >
              {processing && <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />}
              {actionType === "approve" ? "Confirm Approval" : "Confirm Rejection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
