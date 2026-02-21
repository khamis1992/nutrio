import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Shield,
  User,
  Ban,
  Unlock,
  MoreHorizontal,
  Mail,
  MapPin,
  Clock,
  Download,
  ChevronDown,
  ChevronUp,
  Activity,
  Eye,
  ExternalLink,
  ShieldAlert,
  Users,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useUserOrders } from "@/hooks/useUserOrders";
import { OrderHistoryCard } from "@/components/admin/OrderHistoryCard";
import { OrderStatistics } from "@/components/admin/OrderStatistics";

type UserRole = "user" | "admin" | "gym_owner" | "staff" | "restaurant" | "driver";
type UserStatus = "active" | "blocked" | "suspended";

interface UserIPLog {
  ip_address: string;
  created_at: string;
  country_code: string | null;
  country_name: string | null;
  city: string | null;
}

interface UserData {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  roles: UserRole[];
  status: UserStatus;
  latest_ip: string | null;
  ip_logs: UserIPLog[];
  is_blocked_ip: boolean;
}

interface BlockedIP {
  id: string;
  ip_address: string;
  is_active: boolean;
}

const AdminUsers = () => {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserData[]>([]);
  const [blockedIPs, setBlockedIPs] = useState<Map<string, BlockedIP>>(new Map());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "all">("all");
  const [sortField, setSortField] = useState<"created_at" | "last_sign_in_at" | "full_name">("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "orders">("overview");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Use fallback method which queries profiles directly
      // (auth admin API requires service role key and won't work client-side)
      await fetchUsersFallback();
    } catch (error) {
      console.error("Error fetching users:", error);
      toast({
        title: "Error",
        description: "Failed to load users. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsersFallback = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const { data: ipLogs } = await supabase.from("user_ip_logs").select("*").order("created_at", { ascending: false });
      const { data: blockedIPsData } = await supabase.from("blocked_ips").select("*").eq("is_active", true);

      const blockedIPsMap = new Map<string, BlockedIP>(
        (blockedIPsData || []).map((ip: any) => [ip.ip_address as string, ip as BlockedIP])
      );
      setBlockedIPs(blockedIPsMap);

      const rolesMap: Record<string, UserRole[]> = {};
      roles?.forEach((r: any) => {
        if (r.user_id) {
          if (!rolesMap[r.user_id]) rolesMap[r.user_id] = [];
          rolesMap[r.user_id].push(r.role as UserRole);
        }
      });

      const ipLogsMap: Record<string, UserIPLog[]> = {};
      ipLogs?.forEach((log: any) => {
        if (log.user_id) {
          if (!ipLogsMap[log.user_id]) ipLogsMap[log.user_id] = [];
          ipLogsMap[log.user_id].push({
            ip_address: log.ip_address,
            created_at: log.created_at,
            country_code: log.country_code,
            country_name: log.country_name,
            city: log.city,
          });
        }
      });

      const mergedUsers: UserData[] = (profiles || []).map((profile: any) => {
        const userIPLogs = ipLogsMap[profile.user_id] || [];
        const latestIP = userIPLogs[0]?.ip_address || null;
        
        return {
          id: profile.id,
          user_id: profile.user_id,
          full_name: profile.full_name,
          email: profile.email || "",
          avatar_url: profile.avatar_url,
          created_at: profile.created_at,
          last_sign_in_at: null,
          roles: rolesMap[profile.user_id] || ["user"],
          status: "active",
          latest_ip: latestIP,
          ip_logs: userIPLogs,
          is_blocked_ip: latestIP ? blockedIPsMap.has(latestIP) : false,
        };
      });

      setUsers(mergedUsers);
    } catch (error) {
      console.error("Error in fallback fetch:", error);
    }
  };

  const handleBlockIP = async (ipAddress: string, userName: string) => {
    try {
      const { error } = await supabase.from("blocked_ips").insert({
        ip_address: ipAddress,
        reason: `Blocked from user management - ${userName}`,
      });

      if (error) throw error;

      setBlockedIPs((prev) => {
        const newMap = new Map(prev);
        newMap.set(ipAddress, { id: "temp", ip_address: ipAddress, is_active: true });
        return newMap;
      });

      setUsers((prev) =>
        prev.map((u) =>
          u.latest_ip === ipAddress ? { ...u, is_blocked_ip: true } : u
        )
      );

      toast({
        title: "IP Blocked",
        description: `IP ${ipAddress} has been blocked successfully.`,
      });
    } catch (error) {
      console.error("Error blocking IP:", error);
      toast({
        title: "Error",
        description: "Failed to block IP address.",
        variant: "destructive",
      });
    }
  };

  const handleUnblockIP = async (ipAddress: string) => {
    try {
      const { error } = await supabase
        .from("blocked_ips")
        .update({ is_active: false })
        .eq("ip_address", ipAddress);

      if (error) throw error;

      setBlockedIPs((prev) => {
        const newMap = new Map(prev);
        newMap.delete(ipAddress);
        return newMap;
      });

      setUsers((prev) =>
        prev.map((u) =>
          u.latest_ip === ipAddress ? { ...u, is_blocked_ip: false } : u
        )
      );

      toast({
        title: "IP Unblocked",
        description: `IP ${ipAddress} has been unblocked.`,
      });
    } catch (error) {
      console.error("Error unblocking IP:", error);
      toast({
        title: "Error",
        description: "Failed to unblock IP address.",
        variant: "destructive",
      });
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const selectAllUsers = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map((u) => u.user_id)));
    }
  };

  const handleSort = (field: "created_at" | "last_sign_in_at" | "full_name") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const exportToCSV = () => {
    const headers = ["Name", "Email", "Roles", "Status", "Latest IP", "Created At", "Last Sign In"];
    const rows = filteredUsers.map((u) => [
      u.full_name || "Unnamed",
      u.email,
      u.roles.join(", "),
      u.status,
      u.latest_ip || "N/A",
      format(new Date(u.created_at), "yyyy-MM-dd HH:mm"),
      u.last_sign_in_at ? format(new Date(u.last_sign_in_at), "yyyy-MM-dd HH:mm") : "Never",
    ]);
    
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({ title: "Export Complete", description: `${rows.length} users exported to CSV.` });
  };

  const filteredUsers = users
    .filter((u) => {
      const matchesSearch =
        !searchQuery ||
        u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.latest_ip?.includes(searchQuery);
      const matchesRole = roleFilter === "all" || u.roles.includes(roleFilter);
      const matchesStatus = statusFilter === "all" || u.status === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === "created_at") {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      } else if (sortField === "last_sign_in_at") {
        const aTime = a.last_sign_in_at ? new Date(a.last_sign_in_at).getTime() : 0;
        const bTime = b.last_sign_in_at ? new Date(b.last_sign_in_at).getTime() : 0;
        comparison = aTime - bTime;
      } else if (sortField === "full_name") {
        comparison = (a.full_name || "").localeCompare(b.full_name || "");
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

  const getRoleBadge = (role: UserRole) => {
    const styles = {
      admin: "bg-red-500/10 text-red-600 border-red-500/20",
      restaurant: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      driver: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      gym_owner: "bg-purple-500/10 text-purple-600 border-purple-500/20",
      staff: "bg-orange-500/10 text-orange-600 border-orange-500/20",
      user: "bg-slate-500/10 text-slate-600 border-slate-500/20",
    };
    return styles[role] || styles.user;
  };

  const getStatusBadge = (status: UserStatus) => {
    const styles = {
      active: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      blocked: "bg-red-500/10 text-red-600 border-red-500/20",
      suspended: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    };
    return styles[status];
  };

  // Calculate stats
  const stats = {
    totalUsers: users.length,
    activeToday: users.filter((u) => u.last_sign_in_at && new Date(u.last_sign_in_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length,
    blockedIPs: blockedIPs.size,
    newThisWeek: users.filter((u) => new Date(u.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length,
  };

  return (
    <AdminLayout title="User Management" subtitle={`${users.length} total users`}>
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalUsers}</p>
                  <p className="text-xs text-muted-foreground">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Activity className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.activeToday}</p>
                  <p className="text-xs text-muted-foreground">Active Today</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <ShieldAlert className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.blockedIPs}</p>
                  <p className="text-xs text-muted-foreground">Blocked IPs</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.newThisWeek}</p>
                  <p className="text-xs text-muted-foreground">New This Week</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or IP address..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as UserRole | "all")}
                  className="px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">All Roles</option>
                  <option value="admin">Admin</option>
                  <option value="restaurant">Restaurant</option>
                  <option value="driver">Driver</option>
                  <option value="user">User</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as UserStatus | "all")}
                  className="px-3 py-2 border border-input rounded-md text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="blocked">Blocked</option>
                </select>
                <Button
                  variant="outline"
                  onClick={exportToCSV}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchData}
                  disabled={loading}
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedUsers.size > 0 && (
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between">
            <span className="text-sm text-primary font-medium">
              {selectedUsers.size} user{selectedUsers.size > 1 ? "s" : ""} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                Block Selected IPs
              </Button>
              <Button variant="outline" size="sm">
                Export Selected
              </Button>
            </div>
          </div>
        )}

        {/* Users Table */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Users</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 pl-6">
                    <Checkbox
                      checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                      onCheckedChange={selectAllUsers}
                    />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <button
                      onClick={() => handleSort("last_sign_in_at")}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      Last Activity
                      {sortField === "last_sign_in_at" && (
                        sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-muted-foreground text-sm">Loading users...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                          <Search className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground">No users found</p>
                        <p className="text-muted-foreground/70 text-sm">Try adjusting your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((userData) => (
                    <TableRow
                      key={userData.user_id}
                      className="hover:bg-muted/50 transition-colors"
                    >
                      <TableCell className="pl-6">
                        <Checkbox
                          checked={selectedUsers.has(userData.user_id)}
                          onCheckedChange={() => toggleUserSelection(userData.user_id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden">
                              {userData.avatar_url ? (
                                <img
                                  src={userData.avatar_url}
                                  alt={userData.full_name || ""}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <User className="w-5 h-5 text-primary" />
                              )}
                            </div>
                            {userData.last_sign_in_at &&
                              new Date(userData.last_sign_in_at) > new Date(Date.now() - 5 * 60 * 1000) && (
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-background" />
                              )}
                          </div>
                          <div>
                            <p className="font-medium">
                              {userData.full_name || "Unnamed User"}
                            </p>
                            <p className="text-xs text-muted-foreground">{userData.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {userData.roles.slice(0, 2).map((role) => (
                            <Badge
                              key={role}
                              variant="outline"
                              className={`text-xs capitalize ${getRoleBadge(role)}`}
                            >
                              {role.replace("_", " ")}
                            </Badge>
                          ))}
                          {userData.roles.length > 2 && (
                            <Badge variant="outline" className="text-xs border-border">
                              +{userData.roles.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs capitalize border ${getStatusBadge(userData.status)}`}
                        >
                          {userData.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {userData.last_sign_in_at ? (
                            <span className="flex items-center gap-1 text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {format(new Date(userData.last_sign_in_at), "MMM d, HH:mm")}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/70">Never</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground/70">
                          Joined {format(new Date(userData.created_at), "MMM yyyy")}
                        </p>
                      </TableCell>
                      <TableCell>
                        {userData.latest_ip ? (
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                              {userData.latest_ip}
                            </code>
                            {userData.is_blocked_ip ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                                onClick={() => handleUnblockIP(userData.latest_ip!)}
                                title="Unblock IP"
                              >
                                <Unlock className="w-3 h-3" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-red-600 hover:bg-red-500/10"
                                onClick={() => handleBlockIP(userData.latest_ip!, userData.full_name || "Unknown")}
                                title="Block IP"
                              >
                                <Ban className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/70">No IP</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser(userData);
                                setIsDetailOpen(true);
                              }}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedUser(userData);
                                setIsDetailOpen(true);
                                toast({
                                  title: "Manage Roles",
                                  description: "Role management feature coming soon",
                                });
                              }}
                            >
                              <Shield className="w-4 h-4 mr-2" />
                              Manage Roles
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {userData.latest_ip && !userData.is_blocked_ip && (
                              <DropdownMenuItem
                                onClick={() => handleBlockIP(userData.latest_ip!, userData.full_name || "Unknown")}
                                className="text-red-600 focus:text-red-600 focus:bg-red-500/10"
                              >
                                <Ban className="w-4 h-4 mr-2" />
                                Block IP
                              </DropdownMenuItem>
                            )}
                            {userData.latest_ip && userData.is_blocked_ip && (
                              <DropdownMenuItem
                                onClick={() => handleUnblockIP(userData.latest_ip!)}
                                className="text-emerald-600 focus:text-emerald-600 focus:bg-emerald-500/10"
                              >
                                <Unlock className="w-4 h-4 mr-2" />
                                Unblock IP
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* User Detail Sheet */}
        <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            {selectedUser && (
              <UserDetailSheet
                user={selectedUser}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              />
            )}
          </SheetContent>
        </Sheet>
      </div>
    </AdminLayout>
  );
};

// Separate component to handle user detail sheet with hooks
const UserDetailSheet = ({ 
  user, 
  activeTab, 
  setActiveTab 
}: { 
  user: UserData; 
  activeTab: "overview" | "orders";
  setActiveTab: (tab: "overview" | "orders") => void;
}) => {
  const { toast } = useToast();
  const { 
    orders, 
    stats, 
    loading: ordersLoading, 
    filters, 
    updateFilters, 
    clearFilters 
  } = useUserOrders(user.user_id);

  return (
    <>
      <SheetHeader className="pb-4 border-b">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center overflow-hidden">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.full_name || ""}
                className="w-full h-full object-cover"
              />
            ) : (
              <User className="w-8 h-8 text-primary" />
            )}
          </div>
          <div>
            <SheetTitle className="text-xl">
              {user.full_name || "Unnamed User"}
            </SheetTitle>
            <SheetDescription className="text-muted-foreground">
              {user.email}
            </SheetDescription>
            <div className="flex gap-2 mt-2">
              {user.roles.map((role) => (
                <Badge
                  key={role}
                  variant="outline"
                  className={`text-xs capitalize ${getRoleBadge(role)}`}
                >
                  {role.replace("_", " ")}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </SheetHeader>

      {/* Tabs */}
      <div className="flex border-b mt-4">
        <button
          onClick={() => setActiveTab("overview")}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "overview"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "orders"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Orders ({stats?.total_orders || 0})
        </button>
      </div>

      <div className="mt-6 space-y-6 pb-20">
        {activeTab === "orders" ? (
          <>
            <OrderStatistics stats={stats} />
            <OrderHistoryCard
              orders={orders}
              stats={stats}
              loading={ordersLoading}
              filters={filters}
              onFilterChange={updateFilters}
              onClearFilters={clearFilters}
            />
          </>
        ) : (
          <>
            {/* Account Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">User ID</p>
                    <code className="text-sm font-mono">{user.user_id.substring(0, 16)}...</code>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge className={getStatusBadge(user.status)}>
                      {user.status}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="text-sm">
                      {format(new Date(user.created_at), "MMM d, yyyy HH:mm")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Last Sign In</p>
                    <p className="text-sm">
                      {user.last_sign_in_at
                        ? format(new Date(user.last_sign_in_at), "MMM d, yyyy HH:mm")
                        : "Never"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

                  {/* IP Management */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        IP Management
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {selectedUser.latest_ip ? (
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                <MapPin className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <code className="text-sm font-mono font-semibold">{selectedUser.latest_ip}</code>
                                <p className="text-xs text-muted-foreground">Current IP Address</p>
                              </div>
                            </div>
                            {selectedUser.is_blocked_ip ? (
                              <Button
                                size="sm"
                                onClick={() => handleUnblockIP(selectedUser.latest_ip!)}
                                className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 hover:bg-emerald-500/20"
                              >
                                <Unlock className="w-4 h-4 mr-1" />
                                Unblock
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleBlockIP(selectedUser.latest_ip!, selectedUser.full_name || "Unknown")}
                                variant="destructive"
                                className="bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20"
                              >
                                <Ban className="w-4 h-4 mr-1" />
                                Block
                              </Button>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {selectedUser.is_blocked_ip
                              ? "This IP is currently blocked from accessing the platform."
                              : "This IP has full access to the platform."}
                          </p>

                          {/* IP History */}
                          {selectedUser.ip_logs.length > 0 && (
                            <div className="mt-4">
                              <h4 className="text-sm font-medium mb-2">IP History</h4>
                              <div className="space-y-2 max-h-48 overflow-y-auto">
                                {selectedUser.ip_logs.slice(0, 10).map((log, idx) => (
                                  <div key={idx} className="flex items-center justify-between p-2 bg-muted/50 rounded text-sm">
                                    <div className="flex items-center gap-2">
                                      <code className="font-mono text-primary">{log.ip_address}</code>
                                      {log.country_name && (
                                        <span className="text-xs text-muted-foreground">
                                          {log.city ? `${log.city}, ` : ""}{log.country_name}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(log.created_at), "MMM d, HH:mm")}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">No IP address recorded for this user.</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Quick Actions */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        Quick Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-2">
                        <Button 
                          variant="outline" 
                          className="justify-start"
                          onClick={() => {
                            window.location.href = `mailto:${selectedUser.email}`;
                          }}
                        >
                          <Mail className="w-4 h-4 mr-2" />
                          Send Email
                        </Button>
                        <Button 
                          variant="outline" 
                          className="justify-start"
                          onClick={() => {
                            toast({
                              title: "Edit Roles",
                              description: `Role management for ${selectedUser.full_name || selectedUser.email} - Feature coming soon`,
                            });
                          }}
                        >
                          <Shield className="w-4 h-4 mr-2" />
                          Edit Roles
                        </Button>
                        <Button 
                          variant="outline" 
                          className="justify-start"
                          onClick={() => {
                            toast({
                              title: "View Orders",
                              description: `Order history for ${selectedUser.full_name || selectedUser.email} - Feature coming soon`,
                            });
                          }}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View Orders
                        </Button>
                        <Button
                          variant="outline"
                          className="justify-start text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => {
                            toast({
                              title: "Suspend User",
                              description: `User suspension for ${selectedUser.full_name || selectedUser.email} - Feature coming soon`,
                              variant: "destructive",
                            });
                          }}
                        >
                          <Ban className="w-4 h-4 mr-2" />
                          Suspend User
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </AdminLayout>
  );
};

export default AdminUsers;
