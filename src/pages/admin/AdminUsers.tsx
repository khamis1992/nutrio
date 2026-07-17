import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { AdminAlertDialogContent } from "@/components/admin/AdminPrimitives";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Lock,
  Trash2,
  UserCog,
  ArrowLeft,
  CheckCircle2,
  CalendarDays,
  Flame,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useUserOrders } from "@/hooks/useUserOrders";
import {
  AdminEmptyState,
  AdminFilterBar,
  AdminKpiStrip,
  AdminListSkeleton,
  AdminPanel,
  AdminPanelHeader,
  AdminWorkbenchHeader,
} from "@/components/admin/AdminPrimitives";
import { OrderHistoryCard } from "@/components/admin/OrderHistoryCard";
import { OrderStatistics } from "@/components/admin/OrderStatistics";
import { ChangePasswordDialog } from "@/components/admin/ChangePasswordDialog";
import { UserSubscriptionManager } from "@/components/admin/UserSubscriptionManager";
import { CreateFleetManagerDialog } from "@/components/admin/CreateFleetManagerDialog";
import { ManageRolesDialog } from "@/components/admin/ManageRolesDialog";

type UserRole =
  | "user"
  | "admin"
  | "gym_owner"
  | "staff"
  | "restaurant"
  | "driver"
  | "fleet_manager"
  | "partner";
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

const statusOptions: Array<UserStatus | "all"> = [
  "all",
  "active",
  "blocked",
  "suspended",
];

const isUserRole = (value: string): value is UserRole =>
  roleOptions.includes(value as UserRole);

const AdminUsers = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { userId: detailUserId } = useParams<{ userId?: string }>();
  const [users, setUsers] = useState<UserData[]>([]);
  const [blockedIPs, setBlockedIPs] = useState<Map<string, BlockedIP>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "all">("all");
  const [sortField, setSortField] = useState<
    "created_at" | "last_sign_in_at" | "full_name"
  >("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [activeTab, setActiveTab] = useState<"overview" | "orders">("overview");
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [isRolesDialogOpen, setIsRolesDialogOpen] = useState(false);
  const [userPendingDelete, setUserPendingDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

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

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");
      const { data: fleetManagers } = await supabase
        .from("fleet_managers")
        .select("auth_user_id, role");
      const { data: ipLogs } = await supabase
        .from("user_ip_logs")
        .select("*")
        .order("created_at", { ascending: false });
      const { data: blockedIPsData } = await supabase
        .from("blocked_ips")
        .select("*")
        .eq("is_active", true);

      const blockedIPsMap = new Map<string, BlockedIP>(
        (blockedIPsData || []).map((ip) => [
          String(ip.ip_address || ""),
          {
            id: ip.id,
            ip_address: String(ip.ip_address || ""),
            is_active: ip.is_active ?? false,
          },
        ]),
      );
      setBlockedIPs(blockedIPsMap);

      const rolesMap: Record<string, UserRole[]> = {};
      roles?.forEach((r) => {
        const userId = r.user_id;
        if (userId && isUserRole(r.role)) {
          if (!rolesMap[userId]) rolesMap[userId] = [];
          rolesMap[userId].push(r.role);
        }
      });

      // Add fleet_manager role for users in fleet_managers table
      fleetManagers?.forEach((fm) => {
        const authUserId = fm.auth_user_id;
        if (authUserId) {
          if (!rolesMap[authUserId]) rolesMap[authUserId] = [];
          if (!rolesMap[authUserId].includes("fleet_manager")) {
            rolesMap[authUserId].push("fleet_manager");
          }
        }
      });

      const ipLogsMap: Record<string, UserIPLog[]> = {};
      ipLogs?.forEach((log) => {
        const userId = log.user_id;
        if (userId && log.ip_address && log.created_at) {
          if (!ipLogsMap[userId]) ipLogsMap[userId] = [];
          ipLogsMap[userId].push({
            ip_address: String(log.ip_address),
            created_at: log.created_at,
            country_code: log.country_code,
            country_name: log.country_name,
            city: log.city,
          });
        }
      });

      const mergedUsers: UserData[] = (profiles || []).map((profile) => {
        const userIPLogs = ipLogsMap[profile.user_id] || [];
        const latestIP =
          userIPLogs.find(
            (log) => log.ip_address && log.ip_address !== "0.0.0.0",
          )?.ip_address || null;

        return {
          id: profile.id,
          user_id: profile.user_id,
          full_name: profile.full_name,
          email: profile.email || "",
          avatar_url: profile.avatar_url,
          created_at: profile.created_at || new Date(0).toISOString(),
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
        newMap.set(ipAddress, {
          id: "temp",
          ip_address: ipAddress,
          is_active: true,
        });
        return newMap;
      });

      setUsers((prev) =>
        prev.map((u) =>
          u.latest_ip === ipAddress ? { ...u, is_blocked_ip: true } : u,
        ),
      );

      toast({
        title: "IP Blocked",
        description: `${ipAddress} has been blocked.`,
      });
    } catch (error) {
      console.error("Error blocking IP:", error);
      toast({
        title: "Error",
        description: "Failed to block IP",
        variant: "destructive",
      });
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
          u.latest_ip === ipAddress ? { ...u, is_blocked_ip: false } : u,
        ),
      );

      toast({
        title: "IP Unblocked",
        description: `${ipAddress} has been unblocked.`,
      });
    } catch (error) {
      console.error("Error unblocking IP:", error);
      toast({
        title: "Error",
        description: "Failed to unblock IP",
        variant: "destructive",
      });
    }
  };

  const requestDeleteUser = (userId: string, userName: string) => {
    setUserPendingDelete({ id: userId, name: userName || "this user" });
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    try {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase
        .from("profiles")
        .delete()
        .eq("user_id", userId);
      if (error) throw error;
      setUsers((prev) => prev.filter((u) => u.user_id !== userId));
      if (detailUserId === userId) {
        navigate("/admin/users");
      }
      toast({
        title: "User Deleted",
        description: `${userName || "User"} has been removed.`,
      });
    } catch (error) {
      console.error("Error deleting user:", error);
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      });
    }
  };

  const confirmDeleteUser = async () => {
    if (!userPendingDelete) return;
    const pending = userPendingDelete;
    setUserPendingDelete(null);
    await handleDeleteUser(pending.id, pending.name);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case "admin":
        return "bg-[#FB6B7A]/10 text-[#FB6B7A] border-[#FB6B7A]/20";
      case "fleet_manager":
        return "bg-[#7C83F6]/10 text-[#7C83F6] border-[#7C83F6]/20";
      case "restaurant":
        return "bg-[#22C7A1]/10 text-[#22C7A1] border-[#22C7A1]/20";
      case "partner":
        return "bg-[#FB6B7A]/10 text-[#FB6B7A] border-[#FB6B7A]/20";
      case "driver":
        return "bg-[#38BDF8]/10 text-[#38BDF8] border-[#38BDF8]/20";
      case "gym_owner":
        return "bg-[#7C83F6]/10 text-[#7C83F6] border-[#7C83F6]/20";
      case "staff":
        return "bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20";
      default:
        return "bg-[#F6F8FB] text-[#94A3B8] border-[#E5EAF1]";
    }
  };

  const getStatusBadge = (status: UserStatus) => {
    switch (status) {
      case "active":
        return "bg-[#22C7A1]/10 text-[#22C7A1] border-[#22C7A1]/20";
      case "blocked":
        return "bg-[#FB6B7A]/10 text-[#FB6B7A] border-[#FB6B7A]/20";
      case "suspended":
        return "bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20";
      default:
        return "bg-[#F6F8FB] text-[#94A3B8] border-[#E5EAF1]";
    }
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      searchQuery === "" ||
      user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === "all" || user.roles.includes(roleFilter);
    const matchesStatus =
      statusFilter === "all" || user.status === statusFilter;
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

  const detailUser = detailUserId
    ? users.find((user) => user.user_id === detailUserId)
    : null;
  const activeDialogUser = detailUser || selectedUser;

  const selectAllUsers = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map((u) => u.user_id)));
    }
  };

  const handleSort = (
    field: "created_at" | "last_sign_in_at" | "full_name",
  ) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const renderRolesDialog = () =>
    activeDialogUser ? (
      <ManageRolesDialog
        isOpen={isRolesDialogOpen}
        onClose={() => setIsRolesDialogOpen(false)}
        userId={activeDialogUser.user_id}
        userName={activeDialogUser.full_name}
        currentRoles={activeDialogUser.roles}
        onRolesUpdated={(newRoles) => {
          setSelectedUser({ ...activeDialogUser, roles: newRoles });
          setUsers((prev) =>
            prev.map((user) =>
              user.user_id === activeDialogUser.user_id
                ? { ...user, roles: newRoles }
                : user,
            ),
          );
        }}
      />
    ) : null;

  const renderDeleteDialog = () => (
    <AlertDialog
      open={!!userPendingDelete}
      onOpenChange={(open) => !open && setUserPendingDelete(null)}
    >
      <AdminAlertDialogContent>
        <AlertDialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4 text-left">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FB6B7A]/10 text-[#FB6B7A]">
              <Trash2 className="h-5 w-5" />
            </span>
            <div>
              <AlertDialogTitle className="text-xl font-black text-[#020617]">
                Delete user?
              </AlertDialogTitle>
              <AlertDialogDescription className="mt-1 font-semibold leading-6 text-[#94A3B8]">
                This permanently removes{" "}
                {userPendingDelete?.name || "this user"} and clears their role
                records first.
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>
        <div className="px-5 py-4">
          <div className="rounded-[20px] border border-[#FB6B7A]/20 bg-[#FB6B7A]/10 p-4">
            <p className="text-sm font-black text-[#020617]">
              This action cannot be undone.
            </p>
            <p className="mt-1 text-sm font-semibold leading-6 text-[#94A3B8]">
              Use this only for confirmed account removals, duplicates, or test
              records.
            </p>
          </div>
        </div>
        <AlertDialogFooter className="gap-2 sm:gap-3 border-t border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
          <AlertDialogCancel className="min-h-[44px] rounded-2xl border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-white">
            Keep user
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={confirmDeleteUser}
            className="min-h-[44px] rounded-2xl bg-[#FB6B7A] font-black text-white hover:bg-[#FB6B7A]/90"
          >
            Delete user
          </AlertDialogAction>
        </AlertDialogFooter>
      </AdminAlertDialogContent>
    </AlertDialog>
  );

  if (detailUserId) {
    return (
      <AdminLayout
        title={detailUser?.full_name || "User details"}
        subtitle={detailUser?.email || "Full customer profile"}
      >
        <div className="min-h-[calc(100vh-120px)] bg-[#F6F8FB] p-1 text-[#020617]">
          {loading ? (
            <AdminPanel>
              <AdminListSkeleton rows={6} />
            </AdminPanel>
          ) : detailUser ? (
            <UserDetailContent
              user={detailUser}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              handleBlockIP={handleBlockIP}
              handleUnblockIP={handleUnblockIP}
              requestDeleteUser={requestDeleteUser}
              isPasswordDialogOpen={isPasswordDialogOpen}
              setIsPasswordDialogOpen={setIsPasswordDialogOpen}
              setIsRolesDialogOpen={setIsRolesDialogOpen}
              onBack={() => navigate("/admin/users")}
            />
          ) : (
            <AdminPanel>
              <AdminEmptyState
                icon={User}
                title="User not found"
                description="This customer could not be found in the current user list."
                action={
                  <Button
                    onClick={() => navigate("/admin/users")}
                    className="h-11 rounded-2xl bg-[#020617] px-4 font-black text-white hover:bg-[#020617]/90"
                  >
                    Back to users
                  </Button>
                }
              />
            </AdminPanel>
          )}
          {renderRolesDialog()}
          {renderDeleteDialog()}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Users"
      subtitle={`${filteredUsers.length} users match current filters`}
    >
      <div className="space-y-6 bg-[#F6F8FB] p-1 text-[#020617]">
        <AdminWorkbenchHeader
          eyebrow="Identity operations"
          title="User control desk"
          icon={UserCog}
          accent="#22C7A1"
          description="Resolve account access, role changes, IP risk, subscriptions, and customer identity reviews from one audited workflow."
          meta={[
            { label: "Filtered users", value: filteredUsers.length },
            { label: "Selected", value: selectedUsers.size },
            { label: "Blocked IPs", value: blockedIPs.size },
          ]}
          actions={
            <>
              <CreateFleetManagerDialog onSuccess={fetchData} />
              <Button
                variant="outline"
                onClick={fetchData}
                disabled={loading}
                className="h-11 rounded-[14px] border-[#E5EAF1] bg-white px-4 font-black text-[#020617] hover:bg-[#F6F8FB]"
              >
                <RefreshCw
                  className={`mr-2 h-4 w-4 text-[#22C7A1] ${
                    loading ? "animate-spin" : ""
                  }`}
                />
                Refresh
              </Button>
              <Button
                variant="outline"
                className="h-11 rounded-[14px] border-[#E5EAF1] bg-white px-4 font-black text-[#020617] hover:bg-[#F6F8FB]"
              >
                <Download className="mr-2 h-4 w-4 text-[#38BDF8]" />
                Export
              </Button>
            </>
          }
        />

        <AdminKpiStrip
          items={[
            {
              label: "Total users",
              value: users.length.toLocaleString(),
              helper: "Registered profiles",
              icon: Users,
              accent: "#7C83F6",
            },
            {
              label: "Active today",
              value: users.filter(
                (u) =>
                  u.last_sign_in_at &&
                  new Date(u.last_sign_in_at) >
                    new Date(Date.now() - 24 * 60 * 60 * 1000),
              ).length,
              helper: "Signed in last 24h",
              icon: Activity,
              accent: "#22C7A1",
            },
            {
              label: "Blocked IPs",
              value: blockedIPs.size,
              helper: "Active security blocks",
              icon: ShieldAlert,
              accent: "#FB6B7A",
            },
            {
              label: "Admins",
              value: users.filter((u) => u.roles.includes("admin")).length,
              helper: "Privileged access",
              icon: Shield,
              accent: "#38BDF8",
            },
          ]}
        />

        <AdminFilterBar title="Review queue">
          <div className="flex flex-col gap-3 xl:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
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
                  <Button
                    variant="outline"
                    className="h-12 rounded-2xl border-[#E5EAF1] bg-white px-4 font-bold text-[#020617]"
                  >
                    Role:{" "}
                    {roleFilter === "all"
                      ? "All"
                      : roleFilter.replace("_", " ")}
                    <ChevronDown className="ml-2 h-4 w-4 text-[#94A3B8]" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-56 rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]"
                >
                  {roleOptions.map((role) => (
                    <DropdownMenuItem
                      key={role}
                      onClick={() => setRoleFilter(role)}
                      className="capitalize"
                    >
                      {role === "all" ? "All roles" : role.replace("_", " ")}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-12 rounded-2xl border-[#E5EAF1] bg-white px-4 font-bold text-[#020617]"
                  >
                    Status: {statusFilter === "all" ? "All" : statusFilter}
                    <ChevronDown className="ml-2 h-4 w-4 text-[#94A3B8]" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48 rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]"
                >
                  {statusOptions.map((status) => (
                    <DropdownMenuItem
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className="capitalize"
                    >
                      {status === "all" ? "All statuses" : status}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </AdminFilterBar>

        {selectedUsers.size > 0 && (
          <div className="flex flex-col gap-3 rounded-[24px] border border-[#7C83F6]/25 bg-[#7C83F6]/10 p-4 shadow-[0_12px_28px_rgba(2,6,23,0.04)] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-[#020617]">
                {selectedUsers.size} user{selectedUsers.size > 1 ? "s" : ""}{" "}
                selected
              </p>
              <p className="text-xs font-bold text-[#94A3B8]">
                Use this selection to review high-risk accounts or export a
                focused list.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => setSelectedUsers(new Set())}
                className="min-h-[44px] rounded-[14px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-white"
              >
                Clear selection
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  toast({
                    title: "Export selected",
                    description:
                      "Selected user export will use the current filtered selection.",
                  })
                }
                className="min-h-[44px] rounded-[14px] border-[#38BDF8]/25 bg-white font-black text-[#38BDF8] hover:bg-[#38BDF8]/10"
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                Export selected
              </Button>
            </div>
          </div>
        )}

        {/* Users Table */}
        <AdminPanel className="hidden md:block">
          <AdminPanelHeader
            title="Users"
            description={`${displayedUsers.length} records match the current view`}
            className="bg-[#F6F8FB]"
            actions={
              selectedUsers.size > 0 ? (
                <Badge className="w-fit rounded-full border-0 bg-[#7C83F6]/10 px-3 py-1.5 text-[#7C83F6]">
                  {selectedUsers.size} selected
                </Badge>
              ) : null
            }
          />
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-[#F6F8FB]">
                <TableRow className="border-[#E5EAF1] hover:bg-transparent">
                  <TableHead className="w-10 pl-6">
                    <Checkbox
                      checked={
                        selectedUsers.size === filteredUsers.length &&
                        filteredUsers.length > 0
                      }
                      onCheckedChange={selectAllUsers}
                    />
                  </TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                    <button
                      onClick={() => handleSort("full_name")}
                      className="flex items-center gap-1 transition-colors hover:text-[#020617]"
                    >
                      User
                      {sortField === "full_name" &&
                        (sortDirection === "asc" ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        ))}
                    </button>
                  </TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                    Roles
                  </TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                    <button
                      onClick={() => handleSort("last_sign_in_at")}
                      className="flex items-center gap-1 transition-colors hover:text-[#020617]"
                    >
                      Last Activity
                      {sortField === "last_sign_in_at" &&
                        (sortDirection === "asc" ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        ))}
                    </button>
                  </TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                    IP Address
                  </TableHead>
                  <TableHead className="w-20 text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="p-0">
                      <AdminListSkeleton rows={5} />
                    </TableCell>
                  </TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="p-0">
                      <AdminEmptyState
                        icon={Search}
                        title="No users found"
                        description="Try adjusting your filters"
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  displayedUsers.map((userData) => (
                    <TableRow
                      key={userData.user_id}
                      className="border-[#E5EAF1] transition-colors hover:bg-[#F6F8FB]/70"
                    >
                      <TableCell className="pl-6">
                        <Checkbox
                          checked={selectedUsers.has(userData.user_id)}
                          onCheckedChange={() =>
                            toggleUserSelection(userData.user_id)
                          }
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
                              new Date(userData.last_sign_in_at) >
                                new Date(Date.now() - 5 * 60 * 1000) && (
                                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-[#22C7A1]" />
                              )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-black text-[#020617]">
                              {userData.full_name || "Unnamed User"}
                            </p>
                            <p className="truncate text-xs font-medium text-[#94A3B8]">
                              {userData.email}
                            </p>
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
                            <Badge
                              variant="outline"
                              className="rounded-full px-2.5 py-1 text-xs font-bold text-[#94A3B8]"
                            >
                              +{userData.roles.length - 2}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`rounded-full px-2.5 py-1 text-xs font-bold capitalize ${getStatusBadge(userData.status)}`}
                        >
                          {userData.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {userData.last_sign_in_at ? (
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-[#94A3B8]" />
                            <span className="text-sm font-semibold text-[#020617]">
                              {format(
                                new Date(userData.last_sign_in_at),
                                "MMM d, HH:mm",
                              )}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm font-medium text-[#94A3B8]">
                            Never
                          </span>
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
                                className="h-11 w-11 rounded-2xl text-[#22C7A1] hover:bg-[#22C7A1]/10 hover:text-[#22C7A1]"
                                aria-label={`Unblock IP ${userData.latest_ip}`}
                                onClick={() =>
                                  handleUnblockIP(userData.latest_ip!)
                                }
                                title="Unblock IP"
                              >
                                <Unlock className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11 rounded-2xl text-[#94A3B8] hover:bg-[#FB6B7A]/10 hover:text-[#FB6B7A]"
                                aria-label={`Block IP ${userData.latest_ip}`}
                                onClick={() =>
                                  handleBlockIP(
                                    userData.latest_ip!,
                                    userData.full_name || "Unknown",
                                  )
                                }
                                title="Block IP"
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs font-medium text-[#94A3B8]">
                            No IP
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-11 w-11 rounded-full hover:bg-[#F6F8FB]"
                              aria-label="Open user actions"
                            >
                              <MoreHorizontal className="h-4 w-4 text-[#94A3B8]" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]"
                          >
                            <DropdownMenuItem
                              onClick={() => {
                                navigate(`/admin/users/${userData.user_id}`);
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
                                onClick={() =>
                                  handleBlockIP(
                                    userData.latest_ip!,
                                    userData.full_name || "Unknown",
                                  )
                                }
                                className="text-[#FB6B7A] focus:bg-[#FB6B7A]/10 focus:text-[#FB6B7A]"
                              >
                                <Ban className="w-4 h-4 mr-2" />
                                Block IP
                              </DropdownMenuItem>
                            )}
                            {userData.latest_ip && userData.is_blocked_ip && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleUnblockIP(userData.latest_ip!)
                                }
                                className="text-[#22C7A1] focus:bg-[#22C7A1]/10 focus:text-[#22C7A1]"
                              >
                                <Unlock className="w-4 h-4 mr-2" />
                                Unblock IP
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() =>
                                requestDeleteUser(
                                  userData.user_id,
                                  userData.full_name || "",
                                )
                              }
                              className="text-[#FB6B7A] focus:bg-[#FB6B7A]/10 focus:text-[#FB6B7A]"
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
          </div>
        </AdminPanel>

        {/* Mobile Users List */}
        <section className="space-y-3 md:hidden">
          <div className="flex items-center justify-between px-1">
            <div>
              <h3 className="text-lg font-black text-[#020617]">Users</h3>
              <p className="text-xs font-bold text-[#94A3B8]">
                {displayedUsers.length} records match this view
              </p>
            </div>
            <Badge
              variant="outline"
              className="rounded-full border-[#E5EAF1] bg-white px-3 py-1 text-[#020617]"
            >
              Mobile review
            </Badge>
          </div>

          {loading ? (
            <AdminPanel>
              <AdminListSkeleton rows={4} />
            </AdminPanel>
          ) : displayedUsers.length === 0 ? (
            <AdminPanel>
              <AdminEmptyState
                icon={Search}
                title="No users found"
                description="Try changing search or filters."
              />
            </AdminPanel>
          ) : (
            displayedUsers.map((userData) => (
              <article
                key={userData.user_id}
                className="rounded-[24px] bg-white p-4 shadow-[0_14px_34px_rgba(2,6,23,0.05)] ring-1 ring-[#E5EAF1]"
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedUsers.has(userData.user_id)}
                    onCheckedChange={() =>
                      toggleUserSelection(userData.user_id)
                    }
                    className="mt-3"
                  />
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[18px] border border-[#7C83F6]/20 bg-[#7C83F6]/10">
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
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-base font-black text-[#020617]">
                          {userData.full_name || "Unnamed User"}
                        </p>
                        <p className="truncate text-xs font-semibold text-[#94A3B8]">
                          {userData.email}
                        </p>
                      </div>
                      <Badge
                        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black capitalize ${getStatusBadge(userData.status)}`}
                      >
                        {userData.status}
                      </Badge>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {userData.roles.slice(0, 3).map((role) => (
                        <Badge
                          key={role}
                          variant="outline"
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${getRoleBadge(role)}`}
                        >
                          {role.replace("_", " ")}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 rounded-[18px] bg-[#F6F8FB] p-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                      Last activity
                    </p>
                    <p className="mt-1 text-xs font-black text-[#020617]">
                      {userData.last_sign_in_at
                        ? format(
                            new Date(userData.last_sign_in_at),
                            "MMM d, HH:mm",
                          )
                        : "Never"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                      IP address
                    </p>
                    <p className="mt-1 truncate font-mono text-xs font-black text-[#020617]">
                      {userData.latest_ip || "No IP"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    variant="outline"
                    className="h-11 rounded-[16px] border-[#E5EAF1] bg-white font-black text-[#020617]"
                    onClick={() => {
                      navigate(`/admin/users/${userData.user_id}`);
                    }}
                  >
                    <Eye className="mr-2 h-4 w-4 text-[#38BDF8]" />
                    Details
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 rounded-[16px] border-[#E5EAF1] bg-white font-black text-[#020617]"
                    onClick={() => {
                      setSelectedUser(userData);
                      setIsRolesDialogOpen(true);
                    }}
                  >
                    <Shield className="mr-2 h-4 w-4 text-[#7C83F6]" />
                    Roles
                  </Button>
                </div>
              </article>
            ))
          )}
        </section>

        {/* Manage Roles Dialog */}
        {renderRolesDialog()}
        {renderDeleteDialog()}
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
  requestDeleteUser,
  isPasswordDialogOpen,
  setIsPasswordDialogOpen,
  setIsRolesDialogOpen,
  onBack,
}: {
  user: UserData;
  activeTab: "overview" | "orders";
  setActiveTab: (tab: "overview" | "orders") => void;
  handleBlockIP: (ip: string, name: string) => Promise<void>;
  handleUnblockIP: (ip: string) => Promise<void>;
  requestDeleteUser: (userId: string, userName: string) => void;
  isPasswordDialogOpen: boolean;
  setIsPasswordDialogOpen: (open: boolean) => void;
  setIsRolesDialogOpen: (open: boolean) => void;
  onBack: () => void;
}) => {
  const {
    orders,
    stats,
    loading: ordersLoading,
    filters,
    updateFilters,
    clearFilters,
  } = useUserOrders(user.user_id);

  const completionRate = stats?.total_orders
    ? Math.round((stats.completed_orders / stats.total_orders) * 100)
    : 0;
  const lastActiveLabel = user.last_sign_in_at
    ? format(new Date(user.last_sign_in_at), "MMM d, HH:mm")
    : "Never";
  const ipStatusLabel = user.is_blocked_ip
    ? "Blocked IP"
    : user.latest_ip
      ? "Known IP"
      : "No IP yet";

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case "admin":
        return "bg-[#FB6B7A]/10 text-[#FB6B7A] border-[#FB6B7A]/20";
      case "fleet_manager":
        return "bg-[#7C83F6]/10 text-[#7C83F6] border-[#7C83F6]/20";
      case "restaurant":
        return "bg-[#22C7A1]/10 text-[#22C7A1] border-[#22C7A1]/20";
      case "partner":
        return "bg-[#FB6B7A]/10 text-[#FB6B7A] border-[#FB6B7A]/20";
      case "driver":
        return "bg-[#38BDF8]/10 text-[#38BDF8] border-[#38BDF8]/20";
      case "gym_owner":
        return "bg-[#7C83F6]/10 text-[#7C83F6] border-[#7C83F6]/20";
      case "staff":
        return "bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20";
      default:
        return "bg-white text-[#94A3B8] border-[#E5EAF1]";
    }
  };

  return (
    <>
      <div className="overflow-hidden rounded-[30px] border border-[#E5EAF1] bg-white shadow-[0_22px_54px_rgba(2,6,23,0.07)]">
        <div className="border-b border-[#E5EAF1] bg-white p-4 sm:p-6">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <Button
              variant="outline"
              onClick={onBack}
              className="h-11 w-fit rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] px-4 font-black text-[#020617] hover:bg-[#F6F8FB]"
            >
              <ArrowLeft className="mr-2 h-4 w-4 text-[#94A3B8]" />
              Back to users
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="h-11 rounded-[14px] border-[#E5EAF1] bg-white px-4 font-black text-[#020617]"
                onClick={() => setIsRolesDialogOpen(true)}
              >
                <Shield className="mr-2 h-4 w-4 text-[#7C83F6]" />
                Manage roles
              </Button>
              <Button
                className="h-11 rounded-[14px] bg-[#020617] px-4 font-black text-white hover:bg-[#020617]/90"
                onClick={() => setActiveTab("orders")}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                View orders
              </Button>
            </div>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-stretch">
            <div className="rounded-[24px] border border-[#E5EAF1] bg-[#F6F8FB] p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[24px] border border-[#7C83F6]/20 bg-white shadow-[0_12px_24px_rgba(124,131,246,0.12)]">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt={user.full_name || ""}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <User className="h-9 w-9 text-[#7C83F6]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#22C7A1]">
                      Customer profile
                    </p>
                    <Badge
                      className={`rounded-full px-2.5 py-1 text-xs font-black capitalize ${
                        user.is_blocked_ip
                          ? "border-[#FB6B7A]/20 bg-[#FB6B7A]/10 text-[#FB6B7A]"
                          : "border-[#22C7A1]/20 bg-[#22C7A1]/10 text-[#22C7A1]"
                      }`}
                    >
                      {ipStatusLabel}
                    </Badge>
                  </div>
                  <h1 className="truncate text-2xl font-black tracking-tight text-[#020617] sm:text-4xl">
                    {user.full_name || "Unnamed User"}
                  </h1>
                  <p className="mt-1 truncate text-sm font-bold text-[#64748B]">
                    {user.email}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {user.roles.map((role) => (
                      <Badge
                        key={role}
                        variant="outline"
                        className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${getRoleBadge(role)}`}
                      >
                        {role.replace("_", " ")}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[20px] border border-[#E5EAF1] bg-white p-4 shadow-[0_10px_24px_rgba(2,6,23,0.04)]">
                <Activity className="mb-3 h-5 w-5 text-[#22C7A1]" />
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                  Orders
                </p>
                <p className="mt-1 text-2xl font-black text-[#020617]">
                  {stats?.total_orders ?? 0}
                </p>
              </div>
              <div className="rounded-[20px] border border-[#E5EAF1] bg-white p-4 shadow-[0_10px_24px_rgba(2,6,23,0.04)]">
                <CheckCircle2 className="mb-3 h-5 w-5 text-[#38BDF8]" />
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                  Completion
                </p>
                <p className="mt-1 text-2xl font-black text-[#020617]">
                  {completionRate}%
                </p>
              </div>
              <div className="rounded-[20px] border border-[#E5EAF1] bg-white p-4 shadow-[0_10px_24px_rgba(2,6,23,0.04)]">
                <Clock className="mb-3 h-5 w-5 text-[#7C83F6]" />
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                  Last sign in
                </p>
                <p className="mt-1 truncate text-sm font-black text-[#020617]">
                  {lastActiveLabel}
                </p>
              </div>
              <div className="rounded-[20px] border border-[#E5EAF1] bg-white p-4 shadow-[0_10px_24px_rgba(2,6,23,0.04)]">
                <Flame className="mb-3 h-5 w-5 text-[#F97316]" />
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                  Protein
                </p>
                <p className="mt-1 text-sm font-black text-[#020617]">
                  {Math.round(stats?.total_protein ?? 0)}g tracked
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mx-4 mt-4 grid grid-cols-2 rounded-[18px] bg-[#F6F8FB] p-1 ring-1 ring-[#E5EAF1] sm:mx-6 xl:w-[520px]">
          <button
            onClick={() => setActiveTab("overview")}
            className={`rounded-2xl py-3 text-sm font-black transition-colors ${
              activeTab === "overview"
                ? "bg-[#22C7A1]/10 text-[#020617] shadow-sm ring-1 ring-[#22C7A1]/25"
                : "text-[#94A3B8] hover:text-[#020617]"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`rounded-2xl py-3 text-sm font-black transition-colors ${
              activeTab === "orders"
                ? "bg-[#22C7A1]/10 text-[#020617] shadow-sm ring-1 ring-[#22C7A1]/25"
                : "text-[#94A3B8] hover:text-[#020617]"
            }`}
          >
            Orders ({stats?.total_orders || 0})
          </button>
        </div>

        <div className="mt-6 space-y-6 px-4 pb-8 sm:px-6">
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
              requestDeleteUser={requestDeleteUser}
              setActiveTab={setActiveTab}
              setIsPasswordDialogOpen={setIsPasswordDialogOpen}
              setIsRolesDialogOpen={setIsRolesDialogOpen}
            />
          )}
        </div>
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
  requestDeleteUser,
  setActiveTab,
  setIsPasswordDialogOpen,
  setIsRolesDialogOpen,
}: {
  user: UserData;
  handleBlockIP: (ip: string, name: string) => Promise<void>;
  handleUnblockIP: (ip: string) => Promise<void>;
  requestDeleteUser: (userId: string, userName: string) => void;
  setActiveTab: (tab: "overview" | "orders") => void;
  setIsPasswordDialogOpen: (open: boolean) => void;
  setIsRolesDialogOpen: (open: boolean) => void;
}) => {
  const getStatusBadge = (status: UserStatus) => {
    switch (status) {
      case "active":
        return "bg-[#22C7A1]/10 text-[#22C7A1] border-[#22C7A1]/20";
      case "blocked":
        return "bg-[#FB6B7A]/10 text-[#FB6B7A] border-[#FB6B7A]/20";
      case "suspended":
        return "bg-[#F97316]/10 text-[#F97316] border-[#F97316]/20";
      default:
        return "bg-[#F6F8FB] text-[#94A3B8] border-[#E5EAF1]";
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
      <div className="space-y-6">
        <AdminPanel className="rounded-[24px]">
          <AdminPanelHeader
            title="Account information"
            eyebrow="Identity"
            description="Core account fields used for support, access reviews, and audit checks."
            className="bg-[#F6F8FB] py-4"
          />
          <div className="space-y-4 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-[20px] border border-[#E5EAF1] bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                  User ID
                </p>
                <code className="mt-2 block break-all text-sm font-black text-[#020617]">
                  {user.user_id}
                </code>
              </div>
              <div className="rounded-[20px] border border-[#E5EAF1] bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                  Status
                </p>
                <Badge
                  className={`mt-2 rounded-full px-3 py-1 text-xs font-black capitalize ${getStatusBadge(user.status)}`}
                >
                  {user.status}
                </Badge>
              </div>
              <div className="rounded-[20px] border border-[#E5EAF1] bg-white p-4">
                <CalendarDays className="mb-3 h-5 w-5 text-[#7C83F6]" />
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                  Created
                </p>
                <p className="mt-1 text-sm font-black text-[#020617]">
                  {format(new Date(user.created_at), "MMM d, yyyy HH:mm")}
                </p>
              </div>
              <div className="rounded-[20px] border border-[#E5EAF1] bg-white p-4">
                <Clock className="mb-3 h-5 w-5 text-[#38BDF8]" />
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                  Last sign in
                </p>
                <p className="mt-1 text-sm font-black text-[#020617]">
                  {user.last_sign_in_at
                    ? format(new Date(user.last_sign_in_at), "MMM d, yyyy HH:mm")
                    : "Never"}
                </p>
              </div>
            </div>
          </div>
        </AdminPanel>

        <AdminPanel className="rounded-[24px]">
          <AdminPanelHeader
            title="IP management"
            eyebrow="Security"
            description="Review recent network activity and block suspicious access when needed."
            className="bg-[#F6F8FB] py-4"
          />
          <div className="p-4">
            {user.latest_ip ? (
              <div className="space-y-4">
                <div className="flex flex-col gap-4 rounded-[22px] border border-[#E5EAF1] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#38BDF8]/10">
                      <MapPin className="h-5 w-5 text-[#38BDF8]" />
                    </div>
                    <div>
                      <code className="text-sm font-mono font-black text-[#020617]">
                        {user.latest_ip}
                      </code>
                      <p className="text-xs font-bold text-[#94A3B8]">
                        Current IP address
                      </p>
                    </div>
                  </div>
                  {user.is_blocked_ip ? (
                    <Button
                      onClick={() => handleUnblockIP(user.latest_ip!)}
                      className="min-h-[44px] rounded-2xl border border-[#22C7A1]/20 bg-[#22C7A1]/10 px-4 font-black text-[#22C7A1] hover:bg-[#22C7A1]/20"
                    >
                      <Unlock className="mr-2 h-4 w-4" />
                      Unblock IP
                    </Button>
                  ) : (
                    <Button
                      onClick={() =>
                        handleBlockIP(
                          user.latest_ip!,
                          user.full_name || "Unknown",
                        )
                      }
                      variant="destructive"
                      className="min-h-[44px] rounded-2xl border border-[#FB6B7A]/20 bg-[#FB6B7A]/10 px-4 font-black text-[#FB6B7A] hover:bg-[#FB6B7A]/20"
                    >
                      <Ban className="mr-2 h-4 w-4" />
                      Block IP
                    </Button>
                  )}
                </div>

                <div className="rounded-[20px] bg-[#F6F8FB] p-4">
                  <p className="text-sm font-black text-[#020617]">
                    {user.is_blocked_ip
                      ? "This IP is currently blocked."
                      : "This IP currently has platform access."}
                  </p>
                  <p className="mt-1 text-sm font-semibold leading-6 text-[#64748B]">
                    Keep this section as the quick security check before editing sensitive account or subscription details.
                  </p>
                </div>

                {user.ip_logs.length > 0 && (
                  <div>
                    <h4 className="mb-3 text-sm font-black text-[#020617]">
                      Recent IP history
                    </h4>
                    <div className="space-y-2">
                      {user.ip_logs.slice(0, 8).map((log, idx) => (
                        <div
                          key={`${log.ip_address}-${log.created_at}-${idx}`}
                          className="flex flex-col gap-2 rounded-[18px] border border-[#E5EAF1] bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <code className="font-mono font-black text-[#7C83F6]">
                              {log.ip_address}
                            </code>
                            {log.country_name && (
                              <p className="truncate text-xs font-semibold text-[#94A3B8]">
                                {log.city ? `${log.city}, ` : ""}
                                {log.country_name}
                              </p>
                            )}
                          </div>
                          <span className="text-xs font-black text-[#94A3B8]">
                            {format(new Date(log.created_at), "MMM d, HH:mm")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <AdminEmptyState
                icon={MapPin}
                title="No IP address recorded"
                description="This user does not have an IP address in the activity log yet."
                className="py-10"
              />
            )}
          </div>
        </AdminPanel>
      </div>

      <aside className="space-y-6 xl:sticky xl:top-6 xl:self-start">
        <UserSubscriptionManager
          userId={user.user_id}
          userName={user.full_name}
        />

        <AdminPanel className="rounded-[24px]">
          <AdminPanelHeader
            title="Quick actions"
            eyebrow="Operations"
            description="Common support actions for this customer."
            className="bg-[#F6F8FB] py-4"
          />
          <div className="space-y-3 p-4">
            <Button
              variant="outline"
              className="h-12 w-full justify-start rounded-2xl border-[#E5EAF1] font-black text-[#020617]"
              onClick={() => (window.location.href = `mailto:${user.email}`)}
            >
              <Mail className="mr-3 h-4 w-4 text-[#38BDF8]" />
              Send email
            </Button>
            <Button
              variant="outline"
              className="h-12 w-full justify-start rounded-2xl border-[#E5EAF1] font-black text-[#020617]"
              onClick={() => setIsRolesDialogOpen(true)}
            >
              <Shield className="mr-3 h-4 w-4 text-[#7C83F6]" />
              Edit roles
            </Button>
            <Button
              variant="outline"
              className="h-12 w-full justify-start rounded-2xl border-[#E5EAF1] font-black text-[#020617]"
              onClick={() => setActiveTab("orders")}
            >
              <ExternalLink className="mr-3 h-4 w-4 text-[#22C7A1]" />
              View orders
            </Button>
            <Button
              variant="outline"
              className="h-12 w-full justify-start rounded-2xl border-[#E5EAF1] font-black text-[#020617]"
              onClick={() => setIsPasswordDialogOpen(true)}
            >
              <Lock className="mr-3 h-4 w-4 text-[#F97316]" />
              Change password
            </Button>
            <div className="rounded-[20px] border border-[#FB6B7A]/20 bg-[#FB6B7A]/10 p-3">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-[#FB6B7A]">
                Danger zone
              </p>
              <Button
                variant="outline"
                className="mt-3 h-12 w-full justify-start rounded-2xl border-[#FB6B7A]/20 bg-white font-black text-[#FB6B7A] hover:bg-white"
                onClick={() =>
                  requestDeleteUser(user.user_id, user.full_name || "")
                }
              >
                <Trash2 className="mr-3 h-4 w-4" />
                Delete user
              </Button>
            </div>
          </div>
        </AdminPanel>
      </aside>
    </div>
  );
};

export default AdminUsers;
