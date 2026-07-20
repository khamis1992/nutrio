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
import { FreezesDataTable } from "@/components/admin/FreezesDataTable";
import {
  AdminEmptyState,
  AdminFilterBar,
  AdminKpiStrip,
  AdminPanel,
  AdminWorkbenchHeader,
} from "@/components/admin/AdminPrimitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllSubscriptionFreezes } from "@/services/subscriptionFreezeService";
import type { SubscriptionFreeze } from "@/types/retention";

interface FreezeRequest extends SubscriptionFreeze {
  user_email?: string;
}

const tabs = [
  { value: "scheduled", label: "Scheduled" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

function statusBadge(status: string) {
  if (status === "active") {
    return (
      <Badge className="border border-[#38BDF8]/25 bg-[#38BDF8]/10 text-[#38BDF8]">
        Active
      </Badge>
    );
  }
  if (status === "scheduled") {
    return (
      <Badge className="border border-[#FB6B7A]/25 bg-[#FB6B7A]/10 text-[#F97316]">
        Scheduled
      </Badge>
    );
  }
  if (status === "cancelled") {
    return (
      <Badge className="border border-[#FB6B7A]/25 bg-[#FB6B7A]/10 text-[#FB6B7A]">
        Cancelled
      </Badge>
    );
  }
  return (
    <Badge className="border border-[#22C7A1]/25 bg-[#22C7A1]/10 text-[#22C7A1]">
      {status}
    </Badge>
  );
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
      const data = await fetchAllSubscriptionFreezes();

      const userIds = [
        ...new Set((data || []).map((freeze) => freeze.user_id)),
      ];
      const { data: profiles, error: profilesError } =
        userIds.length > 0
          ? await supabase
              .from("profiles")
              .select("user_id, email")
              .in("user_id", userIds)
          : { data: [], error: null };

      if (profilesError) throw profilesError;
      const emailsByUserId = new Map(
        (profiles || []).map((profile) => [profile.user_id, profile.email]),
      );

      const transformedData =
        data?.map((freeze) => ({
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

      const matchesStatus =
        statusFilter === "all" || freeze.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [freezes, searchQuery, statusFilter]);

  const scheduledFreezes = filteredFreezes.filter(
    (freeze) => freeze.status === "scheduled",
  );
  const activeFreezes = filteredFreezes.filter(
    (freeze) => freeze.status === "active",
  );
  const completedFreezes = filteredFreezes.filter((freeze) =>
    ["completed", "cancelled"].includes(freeze.status),
  );

  const stats = useMemo(
    () => ({
      scheduled: freezes.filter((freeze) => freeze.status === "scheduled")
        .length,
      active: freezes.filter((freeze) => freeze.status === "active").length,
      completed: freezes.filter((freeze) =>
        ["completed", "cancelled"].includes(freeze.status),
      ).length,
      total: freezes.length,
    }),
    [freezes],
  );

  const currentList =
    activeTab === "scheduled"
      ? scheduledFreezes
      : activeTab === "active"
        ? activeFreezes
        : completedFreezes;

  const renderFreezeCard = (freeze: FreezeRequest) => (
    <AdminPanel
      key={freeze.id}
      className="transition hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(2,6,23,0.07)]"
    >
      <div className="p-4">
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
                  {format(parseISO(freeze.freeze_start_date), "MMM d")} -{" "}
                  {format(parseISO(freeze.freeze_end_date), "MMM d")}
                </p>
                <p className="text-[10px] font-black uppercase text-[#94A3B8]">
                  Freeze window
                </p>
              </div>
              <div className="rounded-2xl bg-[#F6F8FB] p-3">
                <Snowflake className="mb-2 h-4 w-4 text-[#7C83F6]" />
                <p className="text-sm font-black text-[#020617]">
                  {freeze.freeze_days} days
                </p>
                <p className="text-[10px] font-black uppercase text-[#94A3B8]">
                  Duration
                </p>
              </div>
              <div className="rounded-2xl bg-[#F6F8FB] p-3">
                <Clock className="mb-2 h-4 w-4 text-[#FB6B7A]" />
                <p className="text-sm font-black text-[#020617]">
                  {format(parseISO(freeze.requested_at), "MMM d")}
                </p>
                <p className="text-[10px] font-black uppercase text-[#94A3B8]">
                  Requested
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            {statusBadge(freeze.status)}
          </div>
        </div>
      </div>
    </AdminPanel>
  );

  const emptyIcon =
    activeTab === "scheduled"
      ? Clock
      : activeTab === "active"
        ? Snowflake
        : CheckCircle2;
  const EmptyIcon = emptyIcon;

  return (
    <AdminLayout
      title="Freeze Management"
      subtitle="Review subscription pause requests and active freezes"
    >
      <div className="space-y-5 bg-[#F6F8FB] p-1 text-[#020617]">
        <AdminWorkbenchHeader
          eyebrow="Freeze control"
          title="Subscription pause desk"
          icon={Snowflake}
          accent="#38BDF8"
          description="Review subscription pause requests, approve eligible freezes, and monitor active customer hold periods."
          meta={[
            { label: "Scheduled", value: stats.scheduled },
            { label: "Active", value: stats.active },
            { label: "Completed", value: stats.completed },
          ]}
          actions={
            <Button
              variant="outline"
              onClick={fetchFreezes}
              disabled={isLoading}
              className="min-h-12 rounded-full border-[#E5EAF1] bg-white px-5 font-black text-[#020617] shadow-none"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
              Refresh
            </Button>
          }
        />

        <AdminKpiStrip
          items={[
            {
              label: "Scheduled",
              value: stats.scheduled,
              icon: Clock,
              accent: "#FB6B7A",
            },
            {
              label: "Active",
              value: stats.active,
              icon: Snowflake,
              accent: "#38BDF8",
            },
            {
              label: "Completed",
              value: stats.completed,
              icon: CheckCircle2,
              accent: "#22C7A1",
            },
            {
              label: "Total",
              value: stats.total,
              icon: AlertCircle,
              accent: "#7C83F6",
            },
          ]}
        />

        <AdminFilterBar title="Freeze queue">
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
                <SelectContent className="rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]">
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </AdminFilterBar>

        <div className="flex gap-2 overflow-x-auto rounded-[26px] bg-white p-2 ring-1 ring-[#E5EAF1]">
          {tabs.map((tab) => {
            const count =
              tab.value === "scheduled"
                ? scheduledFreezes.length
                : tab.value === "active"
                  ? activeFreezes.length
                  : completedFreezes.length;
            const active = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={`min-h-11 flex-1 rounded-full px-4 text-sm font-black transition-colors ${
                  active
                    ? "border border-[#7C83F6]/30 bg-[#7C83F6]/10 text-[#020617]"
                    : "bg-[#F6F8FB] text-[#94A3B8]"
                }`}
              >
                {tab.label}{" "}
                <span className={active ? "text-[#7C83F6]" : "text-[#94A3B8]"}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <AdminPanel>
              <div className="flex items-center justify-center py-14">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#7C83F6] border-t-transparent" />
              </div>
            </AdminPanel>
          ) : currentList.length > 0 ? (
            currentList.map((freeze) => renderFreezeCard(freeze))
          ) : (
            <AdminPanel>
              <AdminEmptyState
                icon={EmptyIcon}
                title={`No ${activeTab} freezes`}
                description="Nothing in this queue right now."
              />
            </AdminPanel>
          )}
        </div>

        {!isLoading && currentList.length > 0 && (
          <AdminPanel>
            <div className="border-b border-[#E5EAF1] px-5 py-4">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                Operational table
              </p>
              <h3 className="mt-1 text-lg font-black text-[#020617]">
                Freeze requests detail
              </h3>
            </div>
            <div className="p-4">
              <FreezesDataTable freezes={currentList} />
            </div>
          </AdminPanel>
        )}
      </div>
    </AdminLayout>
  );
}
