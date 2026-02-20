import { useState, useEffect } from "react";
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
  User
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

type TabValue = "all" | "pending" | "processed" | "rejected";

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
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [processing, setProcessing] = useState(false);
  const [generatingPayout, setGeneratingPayout] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [restaurants, setRestaurants] = useState<{ id: string; name: string; owner_id: string }[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [selectedPayouts, setSelectedPayouts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      fetchPayouts();
      fetchRestaurants();
    }
  }, [user]);

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      
      const { data: payoutsData, error: payoutsError } = await supabase
        .from("payouts")
        .select(`
          *,
          restaurant:restaurants(name)
        `)
        .order("created_at", { ascending: false });

      if (payoutsError) throw payoutsError;

      const partnerIds = [...new Set((payoutsData || []).map((p: any) => p.partner_id))];
      
      let profilesMap: Record<string, string> = {};
      if (partnerIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", partnerIds);
        
        profilesMap = (profilesData || []).reduce((acc: Record<string, string>, p: any) => {
          acc[p.user_id] = p.full_name || "Unknown";
          return acc;
        }, {} as Record<string, string>);
      }

      const formattedPayouts: Payout[] = (payoutsData || []).map((payout: any) => ({
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
      }));

      setPayouts(formattedPayouts);

      const pending = formattedPayouts.filter(p => p.status === "pending");
      const processed = formattedPayouts.filter(p => p.status === "processed");
      const rejected = formattedPayouts.filter(p => p.status === "rejected");

      setStats({
        totalPending: pending.reduce((sum, p) => sum + Number(p.amount), 0),
        totalProcessed: processed.reduce((sum, p) => sum + Number(p.amount), 0),
        pendingCount: pending.length,
        processedCount: processed.length,
        rejectedCount: rejected.length,
        totalCommission: formattedPayouts.reduce((sum, p) => sum + Number(p.commission_deducted || 0), 0),
        totalOrderValue: formattedPayouts.reduce((sum, p) => sum + Number(p.total_order_value || 0), 0),
      });
    } catch (error) {
      console.error("Error fetching payouts:", error);
      toast.error("Failed to load payouts");
    } finally {
      setLoading(false);
    }
  };

  const fetchRestaurants = async () => {
    try {
      const { data, error } = await supabase
        .from("restaurants")
        .select("id, name, owner_id")
        .eq("approval_status", "approved")
        .order("name");

      if (error) throw error;
      setRestaurants((data || []).filter(r => r.owner_id !== null).map(r => ({ ...r, owner_id: r.owner_id! })));
    } catch (error) {
      console.error("Error fetching restaurants:", error);
    }
  };

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

      toast.success(`Payout ${actionType === "approve" ? "approved and processed" : "rejected"}`);
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
    } catch (error: any) {
      console.error("Error generating payout:", error);
      toast.error(error.message || "Failed to generate payout");
    } finally {
      setGeneratingPayout(false);
    }
  };

  const handleExportCSV = () => {
    const csvRows = [
      ["ID", "Restaurant", "Partner", "Period Start", "Period End", "Orders", "Order Value", "Commission", "Payout Amount", "Status", "Created At"],
      ...filteredPayouts.map(p => [
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

    const csvContent = csvRows.map(row => row.join(",")).join("\n");
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
      case "processed":
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Processed
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

  const tabs: { value: TabValue; label: string; count: number }[] = [
    { value: "all", label: "All", count: payouts.length },
    { value: "pending", label: "Pending", count: stats.pendingCount },
    { value: "processed", label: "Processed", count: stats.processedCount },
    { value: "rejected", label: "Rejected", count: stats.rejectedCount },
  ];

  const filteredPayouts = payouts.filter(payout => {
    const matchesSearch = 
      payout.restaurant?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payout.partner?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payout.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTab = 
      activeTab === "all" ||
      payout.status === activeTab;

    return matchesSearch && matchesTab;
  });

  if (loading) {
    return (
      <AdminLayout title="Payouts" subtitle="Manage partner payouts">
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
    <AdminLayout title="Payouts" subtitle="Manage partner payouts and commissions">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pending Payouts</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(stats.totalPending)}</p>
                  <p className="text-xs text-amber-600 mt-1">{stats.pendingCount} awaiting processing</p>
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
                  <p className="text-sm font-medium text-muted-foreground">Processed</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(stats.totalProcessed)}</p>
                  <p className="text-xs text-emerald-600 mt-1">{stats.processedCount} completed</p>
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
                  <p className="text-sm font-medium text-muted-foreground">Total Commission</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(stats.totalCommission)}</p>
                  <p className="text-xs text-purple-600 mt-1">Platform earnings</p>
                </div>
                <div className="p-3 rounded-full bg-purple-500/10">
                  <Percent className="h-6 w-6 text-purple-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Order Value</p>
                  <p className="text-3xl font-bold mt-1">{formatCurrency(stats.totalOrderValue)}</p>
                  <p className="text-xs text-blue-600 mt-1">Gross revenue</p>
                </div>
                <div className="p-3 rounded-full bg-blue-500/10">
                  <TrendingUp className="h-6 w-6 text-blue-500" />
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
                  placeholder="Search by restaurant, partner, or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 min-h-[44px]"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleExportCSV} className="min-h-[44px]">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button onClick={() => setGenerateDialogOpen(true)} className="min-h-[44px]">
                  <FileText className="h-4 w-4 mr-2" />
                  Generate Payout
                </Button>
              </div>
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
                  <DollarSign className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No payouts found</p>
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
                      <TableHead>Restaurant</TableHead>
                      <TableHead>Partner</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Gross Value</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead className="text-right">Payout</TableHead>
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
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <Building2 className="h-4 w-4 text-primary" />
                            </div>
                            <span className="font-medium">{payout.restaurant?.name || "Unknown"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{payout.partner?.full_name || "Unknown"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(payout.period_start), "MMM d")} - {format(new Date(payout.period_end), "MMM d, yyyy")}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{payout.order_count}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(payout.total_order_value || 0)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          -{formatCurrency(payout.commission_deducted || 0)}
                          <span className="text-xs ml-1">({payout.commission_rate || 0}%)</span>
                        </TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600">
                          {formatCurrency(payout.amount)}
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
                                      setActionDialogOpen(true);
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
                                      setActionDialogOpen(true);
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
            <SheetTitle>Payout Details</SheetTitle>
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
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Restaurant</p>
                    <p className="font-medium">{selectedPayout.restaurant?.name || "Unknown"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Partner</p>
                    <p className="font-medium">{selectedPayout.partner?.full_name || "Unknown"}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Payout Period</p>
                    <p className="font-medium">
                      {format(new Date(selectedPayout.period_start), "MMMM d, yyyy")} - {format(new Date(selectedPayout.period_end), "MMMM d, yyyy")}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Order Count</p>
                    <p className="font-medium">{selectedPayout.order_count} orders</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Financial Breakdown</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Order Value</span>
                    <span>{formatCurrency(selectedPayout.total_order_value || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Commission Rate</span>
                    <span>{selectedPayout.commission_rate || 0}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Commission Deducted</span>
                    <span className="text-red-600">-{formatCurrency(selectedPayout.commission_deducted || 0)}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between font-medium">
                    <span>Net Payout</span>
                    <span className="text-emerald-600">{formatCurrency(selectedPayout.amount)}</span>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Status Information</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Current Status:</span>
                    {getStatusBadge(selectedPayout.status)}
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Created</span>
                    <span>{format(new Date(selectedPayout.created_at), "MMM d, yyyy HH:mm")}</span>
                  </div>
                  {selectedPayout.processed_at && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Processed</span>
                      <span>{format(new Date(selectedPayout.processed_at), "MMM d, yyyy HH:mm")}</span>
                    </div>
                  )}
                </div>
              </div>

              {selectedPayout.status === "pending" && (
                <div className="flex gap-2 pt-4">
                  <Button
                    className="flex-1"
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
                    className="text-red-600 border-red-200 hover:bg-red-50"
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === "approve" ? "Process Payout" : "Reject Payout"}
            </DialogTitle>
            <DialogDescription>
              {actionType === "approve" 
                ? "This will mark the payout as processed and notify the partner."
                : "This will reject the payout request."
              }
            </DialogDescription>
          </DialogHeader>
          
          {selectedPayout && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Restaurant:</span>
                <span className="font-medium">{selectedPayout.restaurant?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Partner:</span>
                <span className="font-medium">{selectedPayout.partner?.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Amount:</span>
                <span className="font-bold text-emerald-600">{formatCurrency(selectedPayout.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Period:</span>
                <span>{format(new Date(selectedPayout.period_start), "MMM d")} - {format(new Date(selectedPayout.period_end), "MMM d, yyyy")}</span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)} disabled={processing}>
              Cancel
            </Button>
            <Button 
              variant={actionType === "approve" ? "default" : "destructive"}
              onClick={handleAction}
              disabled={processing}
            >
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {actionType === "approve" ? "Process Payout" : "Reject Payout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Payout Dialog */}
      <Dialog open={generateDialogOpen} onOpenChange={setGenerateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Partner Payout</DialogTitle>
            <DialogDescription>
              Create a payout for a restaurant partner based on their orders in the specified period.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Restaurant</label>
              <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a restaurant" />
                </SelectTrigger>
                <SelectContent>
                  {restaurants.map(restaurant => (
                    <SelectItem key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Period Start</label>
                <Input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Period End</label>
                <Input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialogOpen(false)} disabled={generatingPayout}>
              Cancel
            </Button>
            <Button onClick={handleGeneratePayout} disabled={generatingPayout}>
              {generatingPayout && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generate Payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
