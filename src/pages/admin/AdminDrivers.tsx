import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Truck,
  Users,
  Star,
  Wallet,
  CheckCircle,
  XCircle,
  Search,
  RefreshCw,
  User,
  Bike,
  Car,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/AdminLayout";

interface Driver {
  id: string;
  user_id: string;
  vehicle_type: string;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
  is_online: boolean;
  total_deliveries: number;
  rating: number | null;
  wallet_balance: number;
  approval_status: "pending" | "approved" | "rejected";
  created_at: string;
  profile: {
    full_name: string | null;
    email: string;
  } | null;
}

export default function AdminDrivers() {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("drivers")
        .select(`
          id,
          user_id,
          vehicle_type,
          vehicle_make,
          vehicle_model,
          vehicle_plate,
          is_online,
          total_deliveries,
          rating,
          wallet_balance,
          approval_status,
          created_at
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles for drivers
      const userIds = [...new Set((data || []).map((d) => d.user_id).filter(Boolean))];
      
      let profilesMap: Record<string, { full_name: string | null; email: string }> = {};
      
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", userIds);

        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
        } else if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.user_id] = { 
              full_name: p.full_name, 
              email: p.email || ""
            };
            return acc;
          }, {} as Record<string, { full_name: string | null; email: string }>);
        }
      }

      // Merge driver data with profiles
      const transformed: Driver[] = (data || []).map((d) => ({
        ...d,
        profile: profilesMap[d.user_id] || null,
      }));

      setDrivers(transformed);
    } catch (error) {
      // Only log the error — drivers table might be empty, which is a valid state
      console.warn("Error fetching drivers (table may be empty):", error);
    } finally {
      setLoading(false);
    }
  };

  const updateApprovalStatus = async (driverId: string, status: "approved" | "rejected") => {
    try {
      const { error } = await supabase
        .from("drivers")
        .update({ approval_status: status })
        .eq("id", driverId);

      if (error) throw error;

      setDrivers((prev) =>
        prev.map((d) =>
          d.id === driverId ? { ...d, approval_status: status } : d
        )
      );

      toast({
        title: `Driver ${status}`,
        description: `Driver has been ${status} successfully`,
      });
    } catch (error) {
      console.error("Error updating driver:", error);
      toast({
        title: "Error",
        description: "Failed to update driver status",
        variant: "destructive",
      });
    }
  };

  const filteredDrivers = drivers.filter((driver) => {
    // Filter by search
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch =
      driver.profile?.full_name?.toLowerCase().includes(searchLower) ||
      driver.profile?.email?.toLowerCase().includes(searchLower) ||
      driver.vehicle_plate?.toLowerCase().includes(searchLower);

    // Filter by tab
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "pending" && driver.approval_status === "pending") ||
      (activeTab === "approved" && driver.approval_status === "approved") ||
      (activeTab === "online" && driver.is_online);

    return matchesSearch && matchesTab;
  });

  const stats = {
    total: drivers.length,
    pending: drivers.filter((d) => d.approval_status === "pending").length,
    approved: drivers.filter((d) => d.approval_status === "approved").length,
    online: drivers.filter((d) => d.is_online).length,
    totalEarnings: drivers.reduce((sum, d) => sum + d.wallet_balance, 0),
    totalDeliveries: drivers.reduce((sum, d) => sum + d.total_deliveries, 0),
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Approved</Badge>;
      case "pending":
        return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">Pending</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getVehicleIcon = (type: string) => {
    switch (type) {
      case "car":
        return <Car className="h-4 w-4" />;
      case "bike":
        return <Bike className="h-4 w-4" />;
      default:
        return <Truck className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <AdminLayout title="Driver Management">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Driver Management" subtitle="Manage drivers and deliveries">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total Drivers</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.approved}</p>
                  <p className="text-sm text-muted-foreground">Approved</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <Truck className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalDeliveries}</p>
                  <p className="text-sm text-muted-foreground">Deliveries</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                  <Wallet className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">QAR {stats.totalEarnings.toFixed(2)}</p>
                  <p className="text-sm text-muted-foreground">Total Earnings</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search drivers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" onClick={fetchDrivers}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Drivers Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Drivers</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">All ({stats.total})</TabsTrigger>
                <TabsTrigger value="pending">Pending ({stats.pending})</TabsTrigger>
                <TabsTrigger value="approved">Approved ({stats.approved})</TabsTrigger>
                <TabsTrigger value="online">Online ({stats.online})</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="mt-0">
                {filteredDrivers.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                    <p className="font-medium text-foreground mb-1">No drivers registered yet</p>
                    <p className="text-sm text-muted-foreground">Drivers will appear here once they register via the Driver portal.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Driver</TableHead>
                          <TableHead>Vehicle</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Deliveries</TableHead>
                          <TableHead>Rating</TableHead>
                          <TableHead>Wallet</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredDrivers.map((driver) => (
                          <TableRow key={driver.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                  <User className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div>
                                  <p className="font-medium">
                                    {driver.profile?.full_name || "Unnamed Driver"}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {driver.profile?.email}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getVehicleIcon(driver.vehicle_type)}
                                <span className="capitalize">{driver.vehicle_type}</span>
                                {driver.vehicle_plate && (
                                  <span className="text-sm text-muted-foreground">
                                    ({driver.vehicle_plate})
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {getStatusBadge(driver.approval_status)}
                                {driver.is_online && (
                                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                                    Online
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{driver.total_deliveries}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                                <span>{driver.rating?.toFixed(1) || "0.0"}</span>
                              </div>
                            </TableCell>
                            <TableCell>QAR {driver.wallet_balance.toFixed(2)}</TableCell>
                            <TableCell>
                              {driver.approval_status === "pending" && (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-green-500/10 text-green-600 border-green-500/20 hover:bg-green-500/20"
                                    onClick={() => updateApprovalStatus(driver.id, "approved")}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/20"
                                    onClick={() => updateApprovalStatus(driver.id, "rejected")}
                                  >
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Reject
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
