import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DollarSign,
  Users,
  TrendingUp,
  Wallet,
} from "lucide-react";

interface AffiliatePayout {
  id: string;
  user_id: string;
  amount: number;
  status: string;
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
}

export default function AdminAffiliatePayouts() {
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<AffiliatePayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [stats, setStats] = useState<PayoutStats>({
    totalPending: 0,
    totalApproved: 0,
    totalRejected: 0,
    pendingCount: 0,
  });
  const [selectedPayout, setSelectedPayout] = useState<AffiliatePayout | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [processing, setProcessing] = useState(false);

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

      // Fetch user profiles for each payout
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

      // Calculate stats
      const pending = payoutsWithProfiles.filter((p) => p.status === "pending");
      const approved = payoutsWithProfiles.filter((p) => p.status === "approved");
      const rejected = payoutsWithProfiles.filter((p) => p.status === "rejected");

      setStats({
        totalPending: pending.reduce((sum, p) => sum + Number(p.amount), 0),
        totalApproved: approved.reduce((sum, p) => sum + Number(p.amount), 0),
        totalRejected: rejected.reduce((sum, p) => sum + Number(p.amount), 0),
        pendingCount: pending.length,
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

      // If approved, deduct from user's affiliate balance
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
      setActionType(null);
      setActionNotes("");
    } catch (error) {
      console.error("Error processing payout:", error);
      toast.error("Failed to process payout");
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">
            <XCircle className="w-3 h-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTierBadge = (tier: string | null) => {
    const colors: Record<string, string> = {
      bronze: "bg-orange-500/10 text-orange-600 border-orange-500/30",
      silver: "bg-slate-500/10 text-slate-600 border-slate-500/30",
      gold: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
      platinum: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30",
      diamond: "bg-violet-500/10 text-violet-600 border-violet-500/30",
    };
    return (
      <Badge variant="outline" className={colors[tier || "bronze"] || colors.bronze}>
        {tier || "Bronze"}
      </Badge>
    );
  };

  const filteredPayouts = payouts.filter((payout) => {
    const matchesSearch =
      payout.user_profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payout.payout_method.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === "all" || payout.status === activeTab;
    return matchesSearch && matchesTab;
  });

  if (loading) {
    return (
      <AdminLayout title="Affiliate Payouts" subtitle="Manage affiliate payout requests">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-[400px]" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Affiliate Payouts" subtitle="Manage affiliate payout requests">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Payouts</CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalPending)}</div>
              <p className="text-xs text-muted-foreground">{stats.pendingCount} requests waiting</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalApproved)}</div>
              <p className="text-xs text-muted-foreground">Successfully paid out</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats.totalRejected)}</div>
              <p className="text-xs text-muted-foreground">Declined requests</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Affiliates</CardTitle>
              <Users className="h-4 w-4 text-violet-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(payouts.map((p) => p.user_id)).size}
              </div>
              <p className="text-xs text-muted-foreground">Unique affiliates</p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <div className="relative flex-1 w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or method..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 min-h-[44px]"
          />
        </div>

        {/* Tabs and Table */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex overflow-x-auto gap-1 w-full sm:w-auto">
            <TabsTrigger value="pending" className="gap-2 whitespace-nowrap min-h-[44px]">
              <Clock className="h-4 w-4" />
              Pending
              {stats.pendingCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {stats.pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved" className="gap-2 whitespace-nowrap min-h-[44px]">
              <CheckCircle className="h-4 w-4" />
              Approved
            </TabsTrigger>
            <TabsTrigger value="rejected" className="gap-2 whitespace-nowrap min-h-[44px]">
              <XCircle className="h-4 w-4" />
              Rejected
            </TabsTrigger>
            <TabsTrigger value="all" className="gap-2 whitespace-nowrap min-h-[44px]">
              <Wallet className="h-4 w-4" />
              All
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <Card>
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Affiliate</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Requested</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayouts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No payout requests found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredPayouts.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-xs sm:text-sm">
                              {payout.user_profile?.full_name || "Unknown User"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Balance: {formatCurrency(payout.user_profile?.affiliate_balance || 0)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{getTierBadge(payout.user_profile?.affiliate_tier || null)}</TableCell>
                        <TableCell className="font-semibold text-xs sm:text-sm">
                          {formatCurrency(payout.amount)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="capitalize text-xs sm:text-sm">{payout.payout_method.replace("_", " ")}</p>
                            {payout.payout_details?.email && (
                              <p className="text-xs text-muted-foreground">
                                {payout.payout_details.email}
                              </p>
                            )}
                            {payout.payout_details?.bank_name && (
                              <p className="text-xs text-muted-foreground">
                                {payout.payout_details.bank_name}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(payout.requested_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>{getStatusBadge(payout.status)}</TableCell>
                        <TableCell className="text-right">
                          {payout.status === "pending" ? (
                            <div className="flex flex-col sm:flex-row justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full sm:w-auto min-h-[44px] text-green-600 border-green-500/30 hover:bg-green-500/10"
                                onClick={() => {
                                  setSelectedPayout(payout);
                                  setActionType("approve");
                                }}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="w-full sm:w-auto min-h-[44px] text-red-600 border-red-500/30 hover:bg-red-500/10"
                                onClick={() => {
                                  setSelectedPayout(payout);
                                  setActionType("reject");
                                }}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {payout.processed_at
                                ? format(new Date(payout.processed_at), "MMM d, yyyy")
                                : "-"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Action Dialog */}
        <Dialog
          open={!!selectedPayout && !!actionType}
          onOpenChange={() => {
            setSelectedPayout(null);
            setActionType(null);
            setActionNotes("");
          }}
        >
          <DialogContent className="max-w-[95vw] sm:max-w-md mx-4 max-h-[90vh] overflow-y-auto">
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
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Affiliate</span>
                    <span className="font-medium">
                      {selectedPayout.user_profile?.full_name || "Unknown"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-semibold text-lg">
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
                  {selectedPayout.payout_details?.account_number && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Account</span>
                      <span>****{selectedPayout.payout_details.account_number.slice(-4)}</span>
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
                    className="min-h-[100px] sm:min-h-[120px]"
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedPayout(null);
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
                {processing
                  ? "Processing..."
                  : actionType === "approve"
                  ? "Confirm Approval"
                  : "Confirm Rejection"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
