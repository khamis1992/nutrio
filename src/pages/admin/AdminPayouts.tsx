import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Send
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
  status: string;
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
}

export default function AdminPayouts() {
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [stats, setStats] = useState<PayoutStats>({
    totalPending: 0,
    totalProcessed: 0,
    pendingCount: 0,
    processedCount: 0,
  });
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"approve" | "reject" | null>(null);
  const [processing, setProcessing] = useState(false);
  const [generatingPayout, setGeneratingPayout] = useState(false);
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [restaurants, setRestaurants] = useState<{ id: string; name: string; owner_id: string }[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  useEffect(() => {
    if (user) {
      fetchPayouts();
      fetchRestaurants();
    }
  }, [user]);

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      
      // Fetch payouts with restaurant info
      const { data: payoutsData, error: payoutsError } = await supabase
        .from("payouts")
        .select(`
          *,
          restaurant:restaurants(name)
        `)
        .order("created_at", { ascending: false });

      if (payoutsError) throw payoutsError;

      // Fetch partner profiles separately
      const partnerIds = [...new Set((payoutsData || []).map(p => p.partner_id))];
      
      let profilesMap: Record<string, string> = {};
      if (partnerIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", partnerIds);
        
        profilesMap = (profilesData || []).reduce((acc, p) => {
          acc[p.user_id] = p.full_name || "Unknown";
          return acc;
        }, {} as Record<string, string>);
      }

      // Combine data
      const formattedPayouts = (payoutsData || []).map(payout => ({
        ...payout,
        restaurant: payout.restaurant as { name: string } | undefined,
        partner: { full_name: profilesMap[payout.partner_id] || null },
      }));

      setPayouts(formattedPayouts);

      // Calculate stats
      const pending = formattedPayouts.filter(p => p.status === "pending");
      const processed = formattedPayouts.filter(p => p.status === "processed");

      setStats({
        totalPending: pending.reduce((sum, p) => sum + Number(p.amount), 0),
        totalProcessed: processed.reduce((sum, p) => sum + Number(p.amount), 0),
        pendingCount: pending.length,
        processedCount: processed.length,
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
      setRestaurants(data || []);
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

  const handleGeneratePayout = async () => {
    if (!selectedRestaurant || !periodStart || !periodEnd) {
      toast.error("Please fill in all fields");
      return;
    }

    setGeneratingPayout(true);
    try {
      const { data, error } = await supabase.rpc("generate_partner_payout", {
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-500/30 bg-amber-500/10">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "processed":
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Processed
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredPayouts = payouts.filter(payout => {
    const matchesSearch = 
      payout.restaurant?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payout.partner?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      payout.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTab = 
      activeTab === "all" ||
      (activeTab === "pending" && payout.status === "pending") ||
      (activeTab === "processed" && payout.status === "processed") ||
      (activeTab === "rejected" && payout.status === "rejected");

    return matchesSearch && matchesTab;
  });

  if (loading) {
    return (
      <AdminLayout title="Payouts" subtitle="Manage partner payouts">
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-28 rounded-xl" />
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-amber-500/10">
                  <Clock className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Payouts</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalPending)}</p>
                  <p className="text-xs text-muted-foreground">{stats.pendingCount} payouts</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-500/10">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Processed</p>
                  <p className="text-2xl font-bold">{formatCurrency(stats.totalProcessed)}</p>
                  <p className="text-xs text-muted-foreground">{stats.processedCount} payouts</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Commission</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(payouts.reduce((sum, p) => sum + Number(p.commission_deducted || 0), 0))}
                  </p>
                  <p className="text-xs text-muted-foreground">Platform earnings</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-blue-500/10">
                  <DollarSign className="h-6 w-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Order Value</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(payouts.reduce((sum, p) => sum + Number(p.total_order_value || 0), 0))}
                  </p>
                  <p className="text-xs text-muted-foreground">Gross revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by restaurant or partner..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button onClick={() => setGenerateDialogOpen(true)}>
            <FileText className="h-4 w-4 mr-2" />
            Generate Payout
          </Button>
        </div>

        {/* Payouts Table */}
        <Card>
          <CardHeader>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">All ({payouts.length})</TabsTrigger>
                <TabsTrigger value="pending">Pending ({stats.pendingCount})</TabsTrigger>
                <TabsTrigger value="processed">Processed ({stats.processedCount})</TabsTrigger>
                <TabsTrigger value="rejected">
                  Rejected ({payouts.filter(p => p.status === "rejected").length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {filteredPayouts.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No payouts found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Restaurant</TableHead>
                      <TableHead>Partner</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Gross Value</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead className="text-right">Payout</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayouts.map((payout) => (
                      <TableRow key={payout.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{payout.restaurant?.name || "Unknown"}</span>
                          </div>
                        </TableCell>
                        <TableCell>{payout.partner?.full_name || "Unknown"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3 text-muted-foreground" />
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
                        <TableCell className="text-right font-semibold text-green-600">
                          {formatCurrency(payout.amount)}
                        </TableCell>
                        <TableCell>{getStatusBadge(payout.status)}</TableCell>
                        <TableCell>
                          {payout.status === "pending" && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => {
                                  setSelectedPayout(payout);
                                  setActionType("approve");
                                  setActionDialogOpen(true);
                                }}
                              >
                                <Send className="h-3 w-3 mr-1" />
                                Process
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  setSelectedPayout(payout);
                                  setActionType("reject");
                                  setActionDialogOpen(true);
                                }}
                              >
                                <XCircle className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                          {payout.status === "processed" && payout.processed_at && (
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(payout.processed_at), "MMM d, yyyy")}
                            </span>
                          )}
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
                <span className="font-bold text-green-600">{formatCurrency(selectedPayout.amount)}</span>
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
