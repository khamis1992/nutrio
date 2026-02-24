import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Snowflake, 
  Search, 
  Filter, 
  Calendar, 
  User,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface FreezeRequest {
  id: string;
  user_id: string;
  subscription_id: string;
  freeze_start_date: string;
  freeze_end_date: string;
  days_count: number;
  status: string;
  requested_at: string;
  user_email?: string;
}

export default function AdminFreezeManagement() {
  const [freezes, setFreezes] = useState<FreezeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("pending");

  const fetchFreezes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("subscription_freezes")
        .select(`
          *,
          subscriptions:user_id (
            user:profiles (email)
          )
        `)
        .order("requested_at", { ascending: false });

      if (error) throw error;

      // Transform data to include user email
      const transformedData = data?.map(freeze => ({
        ...freeze,
        user_email: freeze.subscriptions?.user?.email
      })) || [];

      setFreezes(transformedData);
    } catch (error) {
      console.error("Error fetching freezes:", error);
      toast.error("Failed to load freeze requests");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFreezes();
  }, []);

  const handleApprove = async (freezeId: string) => {
    try {
      const { error } = await supabase
        .from("subscription_freezes")
        .update({ status: "approved" })
        .eq("id", freezeId);

      if (error) throw error;

      toast.success("Freeze request approved");
      fetchFreezes();
    } catch (error) {
      console.error("Error approving freeze:", error);
      toast.error("Failed to approve freeze");
    }
  };

  const handleReject = async (freezeId: string) => {
    try {
      const { error } = await supabase
        .from("subscription_freezes")
        .update({ status: "rejected" })
        .eq("id", freezeId);

      if (error) throw error;

      toast.success("Freeze request rejected");
      fetchFreezes();
    } catch (error) {
      console.error("Error rejecting freeze:", error);
      toast.error("Failed to reject freeze");
    }
  };

  const filteredFreezes = freezes.filter(freeze => {
    const matchesSearch = searchQuery === "" || 
      freeze.user_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      freeze.id.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || freeze.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const pendingFreezes = filteredFreezes.filter(f => f.status === "pending");
  const activeFreezes = filteredFreezes.filter(f => f.status === "active");
  const completedFreezes = filteredFreezes.filter(f => ["completed", "approved"].includes(f.status));

  const renderFreezeCard = (freeze: FreezeRequest, showActions = false) => (
    <Card key={freeze.id} className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              <span className="font-medium text-slate-900">
                {freeze.user_email || "Unknown User"}
              </span>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Calendar className="w-4 h-4" />
              <span>
                {format(parseISO(freeze.freeze_start_date), "MMM d")} - {format(parseISO(freeze.freeze_end_date), "MMM d, yyyy")}
              </span>
              <span className="text-slate-400">({freeze.days_count} days)</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Clock className="w-4 h-4" />
              <span>
                Requested {format(parseISO(freeze.requested_at), "MMM d, yyyy 'at' h:mm a")}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Badge 
              variant={
                freeze.status === "active" ? "default" :
                freeze.status === "pending" ? "secondary" :
                freeze.status === "completed" ? "outline" :
                "destructive"
              }
              className={cn(
                freeze.status === "active" && "bg-emerald-100 text-emerald-700",
                freeze.status === "pending" && "bg-amber-100 text-amber-700",
                freeze.status === "completed" && "bg-slate-100 text-slate-700"
              )}
            >
              {freeze.status}
            </Badge>

            {showActions && freeze.status === "pending" && (
              <div className="flex gap-2 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => handleReject(freeze.id)}
                >
                  <XCircle className="w-4 h-4 mr-1" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => handleApprove(freeze.id)}
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Approve
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 py-6 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Freeze Management</h1>
              <p className="text-slate-600 mt-1">
                Review and manage subscription freeze requests
              </p>
            </div>
            <Button
              variant="outline"
              onClick={fetchFreezes}
              disabled={isLoading}
            >
              <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Pending Requests</p>
                  <p className="text-2xl font-bold text-amber-600">
                    {freezes.filter(f => f.status === "pending").length}
                  </p>
                </div>
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Active Freezes</p>
                  <p className="text-2xl font-bold text-emerald-600">
                    {freezes.filter(f => f.status === "active").length}
                  </p>
                </div>
                <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                  <Snowflake className="w-5 h-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Completed</p>
                  <p className="text-2xl font-bold text-slate-600">
                    {freezes.filter(f => ["completed", "approved"].includes(f.status)).length}
                  </p>
                </div>
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-slate-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-500">Total Requests</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {freezes.length}
                  </p>
                </div>
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by user email or freeze ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="w-full md:w-48">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="pending">
              Pending
              {pendingFreezes.length > 0 && (
                <Badge variant="secondary" className="ml-2 bg-amber-100 text-amber-700">
                  {pendingFreezes.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
              </div>
            ) : pendingFreezes.length > 0 ? (
              pendingFreezes.map(freeze => renderFreezeCard(freeze, true))
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Clock className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    No Pending Requests
                  </h3>
                  <p className="text-slate-600">
                    There are no freeze requests waiting for approval
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="active" className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
              </div>
            ) : activeFreezes.length > 0 ? (
              activeFreezes.map(freeze => renderFreezeCard(freeze))
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <Snowflake className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    No Active Freezes
                  </h3>
                  <p className="text-slate-600">
                    No subscriptions are currently frozen
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
              </div>
            ) : completedFreezes.length > 0 ? (
              completedFreezes.map(freeze => renderFreezeCard(freeze))
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-lg font-semibold text-slate-900 mb-2">
                    No Completed Freezes
                  </h3>
                  <p className="text-slate-600">
                    No freeze requests have been completed yet
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
