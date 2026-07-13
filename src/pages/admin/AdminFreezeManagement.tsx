import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  RefreshCw,
  Search,
  Snowflake,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

interface FreezeRequest {
  id: string;
  user_id: string;
  subscription_id: string;
  freeze_start_date: string;
  freeze_end_date: string;
  freeze_days: number;
  status: string;
  requested_at: string;
  user_email?: string;
}

const C = {
  ink: "#020617",
  muted: "#94A3B8",
  panel: "#F6F8FB",
  protein: "#7C83F6",
  progress: "#22C7A1",
  water: "#38BDF8",
  fat: "#FB6B7A",
};

const tabs = [
  { value: "scheduled", label: "Scheduled" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

function statusBadge(status: string) {
  if (status === "active") {
    return <Badge className="border border-[#38BDF8]/25 bg-[#38BDF8]/10 text-[#0369A1]">Active</Badge>;
  }
  if (status === "scheduled") {
    return <Badge className="border border-[#FB6B7A]/25 bg-[#FB6B7A]/10 text-[#F97316]">Scheduled</Badge>;
  }
  if (status === "cancelled") {
    return <Badge className="border border-[#FB6B7A]/25 bg-[#FB6B7A]/10 text-[#BE123C]">Cancelled</Badge>;
  }
  return <Badge className="border border-[#22C7A1]/25 bg-[#22C7A1]/10 text-[#047857]">{status}</Badge>;
}

export default function AdminFreezeManagement() {
  const [freezes, setFreezes] = useState<FreezeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("scheduled");

  const fetchFreezes = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("subscription_freezes")
        .select("*")
        .order("requested_at", { ascending: false });

      if (error) throw error;

      const userIds = [...new Set((data || []).map((freeze) => freeze.user_id))];
      const { data: profiles, error: profilesError } = userIds.length > 0
        ? await supabase.from("profiles").select("user_id, email").in("user_id", userIds)
        : { data: [], error: null };

      if (profilesError) throw profilesError;
      const emailsByUserId = new Map((profiles || []).map((profile) => [profile.user_id, profile.email]));

      const transformedData = data?.map((freeze) => ({
        ...freeze,
        user_email: emailsByUserId.get(freeze.user_id) || undefined,
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

  const filteredFreezes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return freezes.filter((freeze) => {
      const matchesSearch =
        !query ||
        freeze.user_email?.toLowerCase().includes(query) ||
        freeze.id.toLowerCase().includes(query);

      const matchesStatus = statusFilter === "all" || freeze.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [freezes, searchQuery, statusFilter]);

  const scheduledFreezes = filteredFreezes.filter((freeze) => freeze.status === "scheduled");
  const activeFreezes = filteredFreezes.filter((freeze) => freeze.status === "active");
  const completedFreezes = filteredFreezes.filter((freeze) => ["completed", "cancelled"].includes(freeze.status));

  const stats = useMemo(() => ({
    scheduled: freezes.filter((freeze) => freeze.status === "scheduled").length,
    active: freezes.filter((freeze) => freeze.status === "active").length,
    completed: freezes.filter((freeze) => ["completed", "cancelled"].includes(freeze.status)).length,
    total: freezes.length,
  }), [freezes]);

  const currentList = activeTab === "scheduled" ? scheduledFreezes : activeTab === "active" ? activeFreezes : completedFreezes;

  const renderFreezeCard = (freeze: FreezeRequest) => (
    <Card key={freeze.id} className="rounded-[28px] border-0 bg-white shadow-none ring-1 ring-[#E5EAF1]">
      <CardContent className="p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F6F8FB] text-[#7C83F6]">
                <User className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-black text-[#020617]">
                  {freeze.user_email || "Unknown User"}
                </p>
                <p className="truncate text-xs font-semibold text-[#94A3B8]">
                  Request #{freeze.id.slice(0, 8)}
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-2xl bg-[#F6F8FB] p-3">
                <Calendar className="mb-2 h-4 w-4 text-[#38BDF8]" />
                <p className="text-sm font-black text-[#020617]">
                  {format(parseISO(freeze.freeze_start_date), "MMM d")} - {format(parseISO(freeze.freeze_end_date), "MMM d")}
                </p>
                <p className="text-[10px] font-black uppercase text-[#94A3B8]">Freeze window</p>
              </div>
              <div className="rounded-2xl bg-[#F6F8FB] p-3">
                <Snowflake className="mb-2 h-4 w-4 text-[#7C83F6]" />
                <p className="text-sm font-black text-[#020617]">{freeze.freeze_days} days</p>
                <p className="text-[10px] font-black uppercase text-[#94A3B8]">Duration</p>
              </div>
              <div className="rounded-2xl bg-[#F6F8FB] p-3">
                <Clock className="mb-2 h-4 w-4 text-[#FB6B7A]" />
                <p className="text-sm font-black text-[#020617]">
                  {format(parseISO(freeze.requested_at), "MMM d")}
                </p>
                <p className="text-[10px] font-black uppercase text-[#94A3B8]">Requested</p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            {statusBadge(freeze.status)}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const emptyIcon = activeTab === "scheduled" ? Clock : activeTab === "active" ? Snowflake : CheckCircle2;
  const EmptyIcon = emptyIcon;

  return (
    <AdminLayout>
      <div className="space-y-5 bg-[#F6F8FB] p-1 text-[#020617]">
        <div className="overflow-hidden rounded-[28px] bg-white p-5 ring-1 ring-[#E5EAF1]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#F6F8FB] px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-[#38BDF8]">
                <span className="h-2 w-2 rounded-full bg-[#22C7A1]" />
                Freeze control
              </div>
              <h1 className="mt-3 text-[28px] font-black leading-tight text-[#020617]">Freeze Management</h1>
              <p className="mt-1 max-w-[42rem] text-sm font-semibold leading-6 text-[#64748B]">
                Review subscription pause requests, approve eligible freezes, and monitor active customer hold periods.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={fetchFreezes}
              disabled={isLoading}
              className="min-h-12 rounded-full border-[#E5EAF1] bg-white px-5 font-black text-[#020617] shadow-none"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Scheduled", value: stats.scheduled, icon: Clock, color: C.fat },
            { label: "Active", value: stats.active, icon: Snowflake, color: C.water },
            { label: "Completed", value: stats.completed, icon: CheckCircle2, color: C.progress },
            { label: "Total", value: stats.total, icon: AlertCircle, color: C.protein },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="rounded-[24px] bg-white p-4 ring-1 ring-[#E5EAF1]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ backgroundColor: `${color}18`, color }}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-black leading-none text-[#020617]">{value}</p>
                  <p className="mt-1 text-xs font-bold text-[#94A3B8]">{label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <Card className="rounded-[26px] border-0 bg-white shadow-none ring-1 ring-[#E5EAF1]">
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <Input
                  placeholder="Search by user email or freeze ID..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="min-h-12 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] pl-11 font-semibold text-[#020617] placeholder:text-[#94A3B8]"
                />
              </div>
              <div className="w-full md:w-56">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="min-h-12 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-black text-[#020617]">
                    <Filter className="mr-2 h-4 w-4 text-[#7C83F6]" />
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2 overflow-x-auto rounded-[26px] bg-white p-2 ring-1 ring-[#E5EAF1]">
          {tabs.map((tab) => {
            const count = tab.value === "scheduled" ? scheduledFreezes.length : tab.value === "active" ? activeFreezes.length : completedFreezes.length;
            const active = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`min-h-11 flex-1 rounded-full px-4 text-sm font-black transition-colors ${
                  active ? "bg-[#020617] text-white" : "bg-[#F6F8FB] text-[#64748B]"
                }`}
              >
                {tab.label} <span className={active ? "text-white/70" : "text-[#94A3B8]"}>{count}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <Card className="rounded-[28px] border-0 bg-white shadow-none ring-1 ring-[#E5EAF1]">
              <CardContent className="flex items-center justify-center py-14">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#7C83F6] border-t-transparent" />
              </CardContent>
            </Card>
          ) : currentList.length > 0 ? (
            currentList.map((freeze) => renderFreezeCard(freeze))
          ) : (
            <Card className="rounded-[28px] border-0 bg-white shadow-none ring-1 ring-[#E5EAF1]">
              <CardContent className="px-6 py-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#F6F8FB] text-[#7C83F6]">
                  <EmptyIcon className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-black text-[#020617]">
                  No {activeTab} freezes
                </h3>
                <p className="mt-1 text-sm font-semibold text-[#94A3B8]">
                  Nothing in this queue right now.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
