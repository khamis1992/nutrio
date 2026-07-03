import { useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
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
  Lock,
  Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useUserOrders } from "@/hooks/useUserOrders";
import { OrderHistoryCard } from "@/components/admin/OrderHistoryCard";
import { OrderStatistics } from "@/components/admin/OrderStatistics";
import { ChangePasswordDialog } from "@/components/admin/ChangePasswordDialog";
import { UserSubscriptionManager } from "@/components/admin/UserSubscriptionManager";
import { CreateFleetManagerDialog } from "@/components/admin/CreateFleetManagerDialog";
import { ManageRolesDialog } from "@/components/admin/ManageRolesDialog";

type UserRole = "user" | "admin" | "gym_owner" | "staff" | "restaurant" | "driver" | "fleet_manager" | "partner";
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

const ADMIN_COLORS = {
  text: "#020617",
  muted: "#94A3B8",
  surface: "#F6F8FB",
  water: "#38BDF8",
  danger: "#FB6B7A",
  protein: "#7C83F6",
  progress: "#22C7A1",
};

const roleOptions: Array<UserRole | "all"> = [
  "all",
  "user",
  "admin",
  "restaurant",
  "partner",
  "driver",
  "fleet_manager",
  "gym_owner",
  "staff",
];

const statusOptions: Array<UserStatus | "all"> = ["all", "active", "blocked", "suspended"];

function AdminStatCard({
  label,
  value,
  detail,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: ReactNode;
  color: string;
}) {
  return (
    <Card className="overflow-hidden rounded-2xl border-0 bg-white shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-slate-100">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: ADMIN_COLORS.muted }}>
              {label}
            </p>
            <p className="mt-3 text-3xl font-black leading-none tracking-tight" style={{ color: ADMIN_COLORS.text }}>
              {value}
            </p>
            <p className="mt-2 text-sm font-medium" style={{ color: ADMIN_COLORS.muted }}>
              {detail}
            </p>
          </div>
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${color}18`, color }}
          >
            {icon}
          </div>
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: ADMIN_COLORS.surface }}>
          <div className="h-full w-2/3 rounded-full" style={{ backgroundColor: color }} />
        </div>
      </CardContent>
    </Card>
  );
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
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isRolesDialogOpen, setIsRolesDialogOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
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
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchUsersFallback = async () => {
    try {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const { data: fleetManagers } = await supabase.from("fleet_managers").select("auth_user_id, role");
      const { data: ipLogs } = await supabase.from("user_ip_logs").select("*").order("created_at", { ascending: false });
      const { data: blockedIPsData } = await supabase.from("blocked_ips").select("*").eq("is_active", true);

      const blockedIPsMap = new Map<string, BlockedIP>(
        (blockedIPsData || []).map((ip: Record<string, unknown>) => [ip.ip_address as string, ip as BlockedIP])
      );
      setBlockedIPs(blockedIPsMap);

      const rolesMap: Record<string, UserRole[]> = {};
      roles?.forEach((r: Record<string, unknown>) => {
        const userId = r.user_id as string;
        if (userId) {
          if (!rolesMap[userId]) rolesMap[userId] = [];
          rolesMap[userId].push(r.role as UserRole);
        }
      });

      // Add fleet_manager role for users in fleet_managers table
      fleetManagers?.forEach((fm: Record<string, unknown>) => {
        const authUserId = fm.auth_user_id as string;
        if (authUserId) {
          if (!rolesMap[authUserId]) rolesMap[authUserId] = [];
          if (!rolesMap[authUserId].includes("fleet_manager")) {
            rolesMap[authUserId].push("fleet_manager");
          }
        }
      });

      const ipLogsMap: Record<string, UserIPLog[]> = {};
      ipLogs?.forEach((log: Record<string, unknown>) => {
        const userId = log.user_id as string;
        if (userId) {
          if (!ipLogsMap[userId]) ipLogsMap[userId] = [];
          ipLogsMap[userId].push({
            ip_address: log.ip_address as string,
            created_at: log.created_at as string,
            country_code: log.country_code as string | null,
            country_name: log.country_name as string | null,
            city: log.city as string | null,
          });
        }
      });

      const mergedUsers: UserData[] = (profiles || []).map((profile: Record<string, unknown>) => {
        const userIPLogs = ipLogsMap[profile.user_id] || [];
        const latestIP = userIPLogs.find(log => log.ip_address && log.ip_address !== "0.0.0.0")?.ip_address || null;
        
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

      toast({ title: "IP Blocked", description: `${ipAddress} has been blocked.` });
    } catch (error) {
      console.error("Error blocking IP:", error);
      toast({ title: "Error", description: "Failed to block IP", variant: "destructive" });
    }
  };

  const handleUnblockIP = async (ipAddress: string) => {
    try {
      const { error } = await supabase
        .from("blocked_ips")
        .delete()
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

      toast({ title: "IP Unblocked", description: `${ipAddress} has been unblocked.` });
    } catch (error) {
      console.error("Error unblocking IP:", error);
      toast({ title: "Error", description: "Failed to unblock IP", variant: "destructive" });
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${userName || "this user"}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("profiles").delete().eq("user_id", userId);
      if (error) throw error;
      setUsers((prev) => prev.filter((u) => u.user_id !== userId));
      setIsDetailOpen(false);
      toast({ title: "User Deleted", description: `${userName || "User"} has been removed.` });
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({ title: "Error", description: "Failed to delete user", variant: "destructive" });
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case "admin": return "bg-[#FB6B7A]/10 text-[#FB6B7A] border-[#FB6B7A]/20";
      case "fleet_manager": return "bg-[#7C83F6]/10 text-[#7C83F6] border-[#7C83F6]/20";
      case "restaurant": return "bg-[#22C7A1]/10 text-[#22C7A1] border-[#22C7A1]/20";
      case "partner": return "bg-[#FB6B7A]/10 text-[#FB6B7A] border-[#FB6B7A]/20";
      case "driver": return "bg-[#38BDF8]/10 text-[#38BDF8] border-[#38BDF8]/20";
      case "gym_owner": return "bg-[#7C83F6]/10 text-[#7C83F6] border-[#7C83F6]/20";
      case "staff": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      default: return "bg-[#F6F8FB] text-[#94A3B8] border-slate-200";
    }
  };

  const getStatusBadge = (status: UserStatus) => {
    switch (status) {
      case "active": return "bg-[#22C7A1]/10 text-[#22C7A1] border-[#22C7A1]/20";
      case "blocked": return "bg-[#FB6B7A]/10 text-[#FB6B7A] border-[#FB6B7A]/20";
      case "suspended": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      default: return "bg-[#F6F8FB] text-[#94A3B8] border-slate-200";
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      searchQuery === "" ||
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || user.roles.includes(roleFilter);
    const matchesStatus = statusFilter === "all" || user.status === statusFilter;
    return matchesSearch && matchesRole && matchesStatus;
  });

  const displayedUsers = [...filteredUsers].sort((a, b) => {
    const direction = sortDirection === "asc" ? 1 : -1;
    if (sortField === "full_name") {
      return (a.full_name || "").localeCompare(b.full_name || "") * direction;
    }
    const left = a[sortField] ? new Date(a[sortField] as string).getTime() : 0;
    const right = b[sortField] ? new Date(b[sortField] as string).getTime() : 0;
    return (left - right) * direction;
  });

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
      setSortDirection("asc");
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 bg-[#F6F8FB] p-1 text-[#020617]">
        {/* Header */}
        <div className="overflow-hidden rounded-3xl bg-white shadow-[0_18px_44px_rgba(2,6,23,0.06)] ring-1 ring-slate-100">
          <div className="flex flex-col gap-5 p-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_14px_28px_rgba(34,199,161,0.22)]" style={{ backgroundColor: ADMIN_COLORS.progress }}>
                <Users className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: ADMIN_COLORS.progress }}>
                  Admin control
                </p>
                <h1 className="mt-1 text-3xl font-black tracking-tight" style={{ color: ADMIN_COLORS.text }}>
                  User Management
                </h1>
                <p className="mt-2 max-w-2xl text-sm font-medium leading-6" style={{ color: ADMIN_COLORS.muted }}>
                  Manage identities, roles, IP access, subscriptions, and account security from one audited workspace.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <CreateFleetManagerDialog onSuccess={fetchData} />
              <Button
                variant="outline"
                onClick={fetchData}
                disabled={loading}
                className="h-11 rounded-xl border-slate-200 bg-white px-4 font-bold text-[#020617] shadow-sm hover:bg-[#F6F8FB]"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} style={{ color: ADMIN_COLORS.progress }} />
                Refresh
              </Button>
              <Button
                variant="outline"
                className="h-11 rounded-xl border-slate-200 bg-white px-4 font-bold text-[#020617] shadow-sm hover:bg-[#F6F8FB]"
              >
                <Download className="mr-2 h-4 w-4" style={{ color: ADMIN_COLORS.water }} />
                Export
              </Button>
            </div>
          </div>
          <div className="grid border-t border-slate-100 bg-[#F6F8FB]/70 px-6 py-4 text-sm font-semibold sm:grid-cols-3">
            <span style={{ color: ADMIN_COLORS.muted }}>Filtered users: <strong className="text-[#020617]">{filteredUsers.length}</strong></span>
            <span style={{ color: ADMIN_COLORS.muted }}>Selected: <strong className="text-[#020617]">{selectedUsers.size}</strong></span>
            <span style={{ color: ADMIN_COLORS.muted }}>Blocked IPs: <strong className="text-[#020617]">{blockedIPs.size}</strong></span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <AdminStatCard
            label="Total users"
            value={users.length.toLocaleString()}
            detail="All registered profiles"
            icon={<Users className="h-6 w-6" />}
            color={ADMIN_COLORS.protein}
          />
          <AdminStatCard
            label="Active today"
            value={users.filter((u) => u.last_sign_in_at && new Date(u.last_sign_in_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)).length}
            detail="Signed in last 24 hours"
            icon={<Activity className="h-6 w-6" />}
            color={ADMIN_COLORS.progress}
          />
          <AdminStatCard
            label="Blocked IPs"
            value={blockedIPs.size}
            detail="Active security blocks"
            icon={<ShieldAlert className="h-6 w-6" />}
            color={ADMIN_COLORS.danger}
          />
          <AdminStatCard
            label="Admins"
            value={users.filter((u) => u.roles.includes("admin")).length}
            detail="Users with admin access"
            icon={<Shield className="h-6 w-6" />}
            color={ADMIN_COLORS.water}
          />
        </div>

        {/* Filters */}
        <div className="rounded-3xl bg-white p-4 shadow-[0_14px_34px_rgba(2,6,23,0.05)] ring-1 ring-slate-100">
          <div className="flex flex-col gap-3 xl:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: ADMIN_COLORS.muted }} />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-12 rounded-2xl border-0 bg-[#F6F8FB] pl-11 text-sm font-semibold text-[#020617] placeholder:text-[#94A3B8] focus-visible:ring-2 focus-visible:ring-[#22C7A1]/30"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-12 rounded-2xl border-slate-200 bg-white px-4 font-bold text-[#020617]">
                  Role: {roleFilter === "all" ? "All" : roleFilter.replace("_", " ")}
                  <ChevronDown className="ml-2 h-4 w-4 text-[#94A3B8]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {roleOptions.map((role) => (
                  <DropdownMenuItem key={role} onClick={() => setRoleFilter(role)} className="capitalize">
                    {role === "all" ? "All roles" : role.replace("_", " ")}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-12 rounded-2xl border-slate-200 bg-white px-4 font-bold text-[#020617]">
                  Status: {statusFilter === "all" ? "All" : statusFilter}
                  <ChevronDown className="ml-2 h-4 w-4 text-[#94A3B8]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {statusOptions.map((status) => (
                  <DropdownMenuItem key={status} onClick={() => setStatusFilter(status)} className="capitalize">
                    {status === "all" ? "All statuses" : status}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          </div>
        </div>

        {/* Users Table */}
        <Card className="overflow-hidden rounded-3xl border-0 bg-white shadow-[0_18px_44px_rgba(2,6,23,0.06)] ring-1 ring-slate-100">
          <CardHeader className="border-b border-slate-100 bg-white px-6 py-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-xl font-black text-[#020617]">Users</CardTitle>
                <p className="mt-1 text-sm font-medium text-[#94A3B8]">
                  {displayedUsers.length} records match the current view
                </p>
              </div>
              {selectedUsers.size > 0 && (
                <Badge className="w-fit rounded-full border-0 bg-[#7C83F6]/10 px-3 py-1.5 text-[#7C83F6]">
                  {selectedUsers.size} selected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader className="bg-[#F6F8FB]">
                <TableRow className="border-slate-100 hover:bg-transparent">
                  <TableHead className="w-10 pl-6">
                    <Checkbox
                      checked={selectedUsers.size === filteredUsers.length && filteredUsers.length > 0}
                      onCheckedChange={selectAllUsers}
                    />
                  </TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                    <button
                      onClick={() => handleSort("full_name")}
                      className="flex items-center gap-1 transition-colors hover:text-[#020617]"
                    >
                      User
                      {sortField === "full_name" && (
                        sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">Roles</TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">Status</TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                    <button
                      onClick={() => handleSort("last_sign_in_at")}
                      className="flex items-center gap-1 transition-colors hover:text-[#020617]"
                    >
                      Last Activity
                      {sortField === "last_sign_in_at" && (
                        sortDirection === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">IP Address</TableHead>
                  <TableHead className="w-20 text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin" style={{ color: ADMIN_COLORS.progress }} />
                        <p className="text-sm font-semibold text-[#94A3B8]">Loading users...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F6F8FB]">
                          <Search className="h-6 w-6 text-[#94A3B8]" />
                        </div>
                        <p className="font-bold text-[#020617]">No users found</p>
                        <p className="text-sm font-medium text-[#94A3B8]">Try adjusting your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedUsers.map((userData) => (
                    <TableRow
                      key={userData.user_id}
                      className="border-slate-100 transition-colors hover:bg-[#F6F8FB]/70"
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
                            <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-[#7C83F6]/20 bg-[#7C83F6]/10">
                              {userData.avatar_url ? (
                                <img
                                  src={userData.avatar_url}
                                  alt={userData.full_name || ""}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <User className="h-5 w-5 text-[#7C83F6]" />
                              )}
                            </div>
                            {userData.last_sign_in_at &&
                              new Date(userData.last_sign_in_at) > new Date(Date.now() - 5 * 60 * 1000) && (
                                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#22C7A1]" />
                              )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-[#020617]">
                              {userData.full_name || "Unnamed User"}
                            </p>
                            <p className="truncate text-xs font-medium text-[#94A3B8]">{userData.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {userData.roles.slice(0, 2).map((role) => (
                            <Badge
                              key={role}
                              variant="outline"
                              className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${getRoleBadge(role)}`}
                            >
                              {role.replace("_", " ")}
                            </Badge>
                          ))}
                          {userData.roles.length > 2 && (
                            <Badge variant="outline" className="rounded-full px-2.5 py-1 text-xs font-bold text-[#94A3B8]">
                              +{userData.roles.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${getStatusBadge(userData.status)}`}>
                          {userData.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {userData.last_sign_in_at ? (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-[#94A3B8]" />
                            <span className="text-sm font-semibold text-[#020617]">
                              {format(new Date(userData.last_sign_in_at), "MMM d, HH:mm")}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm font-medium text-[#94A3B8]">Never</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {userData.latest_ip ? (
                          <div className="flex items-center gap-2">
                            <code className="rounded-full bg-[#F6F8FB] px-2.5 py-1.5 font-mono text-xs font-bold text-[#020617]">
                              {userData.latest_ip}
                            </code>
                            {userData.is_blocked_ip ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full text-[#22C7A1] hover:bg-[#22C7A1]/10 hover:text-[#22C7A1]"
                                onClick={() => handleUnblockIP(userData.latest_ip!)}
                                title="Unblock IP"
                              >
                                <Unlock className="h-3.5 w-3.5" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 rounded-full text-[#94A3B8] hover:bg-[#FB6B7A]/10 hover:text-[#FB6B7A]"
                                onClick={() => handleBlockIP(userData.latest_ip!, userData.full_name || "Unknown")}
                                title="Block IP"
                              >
                                <Ban className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-[#94A3B8]">No IP</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-[#F6F8FB]">
                              <MoreHorizontal className="h-4 w-4 text-[#94A3B8]" />
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
                                setIsRolesDialogOpen(true);
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
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDeleteUser(userData.user_id, userData.full_name || "")}
                              className="text-red-600 focus:text-red-600 focus:bg-red-500/10"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete User
                            </DropdownMenuItem>
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
          <SheetContent className="w-full overflow-y-auto bg-[#F6F8FB] p-0 sm:max-w-2xl">
            {selectedUser && (
              <UserDetailContent
                user={selectedUser}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                handleBlockIP={handleBlockIP}
                handleUnblockIP={handleUnblockIP}
                handleDeleteUser={handleDeleteUser}
                isPasswordDialogOpen={isPasswordDialogOpen}
                setIsPasswordDialogOpen={setIsPasswordDialogOpen}
                setIsRolesDialogOpen={setIsRolesDialogOpen}
              />
            )}
          </SheetContent>
        </Sheet>

        {/* Manage Roles Dialog */}
        {selectedUser && (
          <ManageRolesDialog
            isOpen={isRolesDialogOpen}
            onClose={() => setIsRolesDialogOpen(false)}
            userId={selectedUser.user_id}
            userName={selectedUser.full_name}
            currentRoles={selectedUser.roles}
            onRolesUpdated={(newRoles) => {
              // Update the selected user and the users list
              setSelectedUser({ ...selectedUser, roles: newRoles });
              setUsers((prev) =>
                prev.map((u) =>
                  u.user_id === selectedUser.user_id ? { ...u, roles: newRoles } : u
                )
              );
            }}
          />
        )}
      </div>
    </AdminLayout>
  );
};

// Separate component for user details with orders
const UserDetailContent = ({
  user,
  activeTab,
  setActiveTab,
  handleBlockIP,
  handleUnblockIP,
  handleDeleteUser,
  isPasswordDialogOpen,
  setIsPasswordDialogOpen,
  setIsRolesDialogOpen,
}: {
  user: UserData;
  activeTab: "overview" | "orders";
  setActiveTab: (tab: "overview" | "orders") => void;
  handleBlockIP: (ip: string, name: string) => Promise<void>;
  handleUnblockIP: (ip: string) => Promise<void>;
  handleDeleteUser: (userId: string, userName: string) => Promise<void>;
  isPasswordDialogOpen: boolean;
  setIsPasswordDialogOpen: (open: boolean) => void;
  setIsRolesDialogOpen: (open: boolean) => void;
}) => {
  const { toast } = useToast();
  const { orders, stats, loading: ordersLoading, filters, updateFilters, clearFilters } = useUserOrders(user.user_id);

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case "admin": return "bg-[#FB6B7A]/10 text-[#FB6B7A] border-[#FB6B7A]/20";
      case "fleet_manager": return "bg-[#7C83F6]/10 text-[#7C83F6] border-[#7C83F6]/20";
      case "restaurant": return "bg-[#22C7A1]/10 text-[#22C7A1] border-[#22C7A1]/20";
      case "partner": return "bg-[#FB6B7A]/10 text-[#FB6B7A] border-[#FB6B7A]/20";
      case "driver": return "bg-[#38BDF8]/10 text-[#38BDF8] border-[#38BDF8]/20";
      case "gym_owner": return "bg-[#7C83F6]/10 text-[#7C83F6] border-[#7C83F6]/20";
      case "staff": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      default: return "bg-white text-[#94A3B8] border-slate-200";
    }
  };

  const getStatusBadge = (status: UserStatus) => {
    switch (status) {
      case "active": return "bg-[#22C7A1]/10 text-[#22C7A1] border-[#22C7A1]/20";
      case "blocked": return "bg-[#FB6B7A]/10 text-[#FB6B7A] border-[#FB6B7A]/20";
      case "suspended": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      default: return "bg-white text-[#94A3B8] border-slate-200";
    }
  };

  return (
    <>
      <SheetHeader className="border-b border-slate-100 bg-white p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-[#7C83F6]/20 bg-[#7C83F6]/10">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.full_name || ""} className="h-full w-full object-cover" />
            ) : (
              <User className="h-8 w-8 text-[#7C83F6]" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#22C7A1]">User profile</p>
            <SheetTitle className="mt-1 truncate text-2xl font-black text-[#020617]">{user.full_name || "Unnamed User"}</SheetTitle>
            <SheetDescription className="font-medium text-[#94A3B8]">{user.email}</SheetDescription>
            <div className="flex gap-2 mt-2">
              {user.roles.map((role) => (
                <Badge key={role} variant="outline" className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${getRoleBadge(role)}`}>
                  {role.replace("_", " ")}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </SheetHeader>

      <SheetDescription className="sr-only">
        User details and management options for {user.full_name || "Unnamed User"}
      </SheetDescription>

      {/* Tabs */}
      <div className="mx-6 mt-4 grid grid-cols-2 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-100">
        <button
          onClick={() => setActiveTab("overview")}
          className={`rounded-xl py-3 text-sm font-black transition-colors ${
            activeTab === "overview" ? "bg-[#22C7A1] text-white shadow-sm" : "text-[#94A3B8] hover:text-[#020617]"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab("orders")}
          className={`rounded-xl py-3 text-sm font-black transition-colors ${
            activeTab === "orders" ? "bg-[#22C7A1] text-white shadow-sm" : "text-[#94A3B8] hover:text-[#020617]"
          }`}
        >
          Orders ({stats?.total_orders || 0})
        </button>
      </div>

      <div className="mt-6 space-y-6 px-6 pb-20">
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
          <OverviewContent
            user={user}
            handleBlockIP={handleBlockIP}
            handleUnblockIP={handleUnblockIP}
            handleDeleteUser={handleDeleteUser}
            setActiveTab={setActiveTab}
            setIsPasswordDialogOpen={setIsPasswordDialogOpen}
            setIsRolesDialogOpen={setIsRolesDialogOpen}
            toast={toast}
          />
        )}
      </div>

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        userId={user.user_id}
        userEmail={user.email}
        userName={user.full_name || ""}
        isOpen={isPasswordDialogOpen}
        onClose={() => setIsPasswordDialogOpen(false)}
      />
    </>
  );
};

const OverviewContent = ({
  user,
  handleBlockIP,
  handleUnblockIP,
  handleDeleteUser,
  setActiveTab,
  setIsPasswordDialogOpen,
  setIsRolesDialogOpen,
  toast,
}: {
  user: UserData;
  handleBlockIP: (ip: string, name: string) => Promise<void>;
  handleUnblockIP: (ip: string) => Promise<void>;
  handleDeleteUser: (userId: string, userName: string) => Promise<void>;
  setActiveTab: (tab: "overview" | "orders") => void;
  setIsPasswordDialogOpen: (open: boolean) => void;
  setIsRolesDialogOpen: (open: boolean) => void;
  toast: ReturnType<typeof useToast>["toast"];
}) => {
  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case "admin": return "bg-red-500/10 text-red-600 border-red-500/20";
      case "fleet_manager": return "bg-indigo-500/10 text-indigo-600 border-indigo-500/20";
      case "restaurant": return "bg-orange-500/10 text-orange-600 border-orange-500/20";
      case "driver": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "gym_owner": return "bg-purple-500/10 text-purple-600 border-purple-500/20";
      case "staff": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      default: return "bg-slate-500/10 text-slate-600 border-slate-500/20";
    }
  };

  const getStatusBadge = (status: UserStatus) => {
    switch (status) {
      case "active": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
      case "blocked": return "bg-red-500/10 text-red-600 border-red-500/20";
      case "suspended": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      default: return "bg-slate-500/10 text-slate-600 border-slate-500/20";
    }
  };

  return (
    <>
      {/* Account Info */}
      <Card className="rounded-3xl border-0 bg-white shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-slate-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-black uppercase tracking-[0.16em] text-[#94A3B8]">
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-[#F6F8FB] p-3">
              <p className="text-xs font-bold text-[#94A3B8]">User ID</p>
              <code className="text-sm font-bold text-[#020617]">{user.user_id.substring(0, 16)}...</code>
            </div>
            <div className="rounded-2xl bg-[#F6F8FB] p-3">
              <p className="text-xs font-bold text-[#94A3B8]">Status</p>
              <Badge className={`mt-1 rounded-full px-2.5 py-1 text-xs font-bold capitalize ${getStatusBadge(user.status)}`}>{user.status}</Badge>
            </div>
            <div className="rounded-2xl bg-[#F6F8FB] p-3">
              <p className="text-xs font-bold text-[#94A3B8]">Created</p>
              <p className="text-sm font-bold text-[#020617]">{format(new Date(user.created_at), "MMM d, yyyy HH:mm")}</p>
            </div>
            <div className="rounded-2xl bg-[#F6F8FB] p-3">
              <p className="text-xs font-bold text-[#94A3B8]">Last Sign In</p>
              <p className="text-sm font-bold text-[#020617]">
                {user.last_sign_in_at ? format(new Date(user.last_sign_in_at), "MMM d, yyyy HH:mm") : "Never"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* IP Management */}
      <Card className="rounded-3xl border-0 bg-white shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-slate-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-black uppercase tracking-[0.16em] text-[#94A3B8]">
            IP Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          {user.latest_ip ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl bg-[#F6F8FB] p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#38BDF8]/10">
                    <MapPin className="h-5 w-5 text-[#38BDF8]" />
                  </div>
                  <div>
                    <code className="text-sm font-mono font-black text-[#020617]">{user.latest_ip}</code>
                    <p className="text-xs font-bold text-[#94A3B8]">Current IP Address</p>
                  </div>
                </div>
                {user.is_blocked_ip ? (
                  <Button
                    size="sm"
                    onClick={() => handleUnblockIP(user.latest_ip!)}
                    className="rounded-xl border border-[#22C7A1]/20 bg-[#22C7A1]/10 text-[#22C7A1] hover:bg-[#22C7A1]/20"
                  >
                    <Unlock className="mr-1 h-4 w-4" />
                    Unblock
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => handleBlockIP(user.latest_ip!, user.full_name || "Unknown")}
                    variant="destructive"
                    className="rounded-xl border border-[#FB6B7A]/20 bg-[#FB6B7A]/10 text-[#FB6B7A] hover:bg-[#FB6B7A]/20"
                  >
                    <Ban className="mr-1 h-4 w-4" />
                    Block
                  </Button>
                )}
              </div>
              <p className="text-sm font-medium text-[#94A3B8]">
                {user.is_blocked_ip
                  ? "This IP is currently blocked from accessing the platform."
                  : "This IP has full access to the platform."}
              </p>

              {user.ip_logs.length > 0 && (
                <div className="mt-4">
                  <h4 className="mb-2 text-sm font-black text-[#020617]">IP History</h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {user.ip_logs.slice(0, 10).map((log, idx) => (
                      <div key={idx} className="flex items-center justify-between rounded-xl bg-[#F6F8FB] p-2 text-sm">
                        <div className="flex items-center gap-2">
                          <code className="font-mono font-bold text-[#7C83F6]">{log.ip_address}</code>
                          {log.country_name && (
                            <span className="text-xs font-medium text-[#94A3B8]">
                              {log.city ? `${log.city}, ` : ""}{log.country_name}
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-medium text-[#94A3B8]">
                          {format(new Date(log.created_at), "MMM d, HH:mm")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="font-medium text-[#94A3B8]">No IP address recorded for this user.</p>
          )}
        </CardContent>
      </Card>

      {/* Subscription Management */}
      <UserSubscriptionManager 
        userId={user.user_id} 
        userName={user.full_name} 
      />

      {/* Quick Actions */}
      <Card className="rounded-3xl border-0 bg-white shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-slate-100">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-black uppercase tracking-[0.16em] text-[#94A3B8]">
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="h-11 justify-start rounded-xl border-slate-200 font-bold text-[#020617]" onClick={() => window.location.href = `mailto:${user.email}`}>
              <Mail className="w-4 h-4 mr-2" />
              Send Email
            </Button>
            <Button 
              variant="outline" 
              className="h-11 justify-start rounded-xl border-slate-200 font-bold text-[#020617]"
              onClick={() => setIsRolesDialogOpen(true)}
            >
              <Shield className="w-4 h-4 mr-2" />
              Edit Roles
            </Button>
            <Button variant="outline" className="h-11 justify-start rounded-xl border-slate-200 font-bold text-[#020617]" onClick={() => setActiveTab("orders")}>
              <ExternalLink className="w-4 h-4 mr-2" />
              View Orders
            </Button>
            <Button variant="outline" className="h-11 justify-start rounded-xl border-slate-200 font-bold text-[#020617]" onClick={() => setIsPasswordDialogOpen(true)}>
              <Lock className="w-4 h-4 mr-2" />
              Change Password
            </Button>
            <Button
              variant="outline"
              className="h-11 justify-start rounded-xl border-[#FB6B7A]/20 text-[#FB6B7A] hover:bg-[#FB6B7A]/10"
              onClick={() => toast({ title: "Suspend User", description: "User suspension feature coming soon", variant: "destructive" })}
            >
              <Ban className="w-4 h-4 mr-2" />
              Suspend User
            </Button>
            <Button
              variant="outline"
              className="h-11 justify-start rounded-xl border-[#FB6B7A]/20 text-[#FB6B7A] hover:bg-[#FB6B7A]/10"
              onClick={() => handleDeleteUser(user.user_id, user.full_name || "")}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete User
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default AdminUsers;
