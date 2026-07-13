import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DollarSign,
  Calendar,
  TrendingUp,
  Clock,
  Wallet,
  ChevronDown,
  ChevronUp,
  Download,
  Building2,
  AlertTriangle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { PartnerLayout } from "@/components/PartnerLayout";
import { formatCurrency } from "@/lib/currency";
import { requestPartnerPayout } from "@/lib/payouts";

/**
 * Payouts reads from partner_payouts table for admin-processed settlement records.
 * Earnings analytics can differ slightly because each source has its own accounting cutoff.
 */
// PLATFORM_RATE is no longer hardcoded. It comes from restaurants.commission_rate per restaurant.

type DateRange = "7d" | "30d" | "90d" | "all";

const DATE_RANGE_OPTIONS: { label: string; value: DateRange }[] = [
  { label: "7 Days", value: "7d" },
  { label: "30 Days", value: "30d" },
  { label: "90 Days", value: "90d" },
  { label: "All Time", value: "all" },
];

const PAYOUT_FREQUENCY_OPTIONS = [
  { label: "Weekly", value: "weekly" },
  { label: "Bi-weekly", value: "biweekly" },
  { label: "Monthly", value: "monthly" },
];

const RANGE_LABELS: Record<DateRange, string> = {
  "7d": "7-day",
  "30d": "30-day",
  "90d": "90-day",
  all: "All-time",
};

// ── Interfaces ───────────────────────────────────────────────────────────────

interface PartnerPayout {
  id: string;
  amount: number;
  status: "pending" | "processing" | "completed" | "failed";
  period_start: string;
  period_end: string;
  processed_at: string | null;
  created_at: string;
  reference_number: string | null;
  payout_method: string | null;
}

interface EarningRow {
  gross_amount: number;
  platform_fee: number;
  net_amount: number;
  delivery_fee: number | null;
  created_at: string | null;
  order_id: string | null;
  status: string | null;
  payout_id: string | null;
}

interface WeeklyEarning {
  week_start: string;
  week_end: string;
  gross_amount: number;
  platform_fee: number;
  net_amount: number;
}

interface MonthlyEarning {
  month_key: string;
  month_label: string;
  gross_amount: number;
  platform_fee: number;
  net_amount: number;
}

interface Summary {
  totalGross: number;
  totalCommission: number;
  totalNet: number;
  thisMonthNet: number;
  pendingAmount: number;
  commissionRate: number;
  availableForPayout: number;
}

interface BankDetails {
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_iban: string;
  swift_code: string;
  payout_frequency: string;
}

// ── Pure helpers ─────────────────────────────────────────────────────────────

function filterByDateRange(
  earnings: EarningRow[],
  range: DateRange,
): EarningRow[] {
  if (range === "all") return earnings;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return earnings.filter(
    (e) => e.created_at && new Date(e.created_at) >= cutoff,
  );
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  start.setDate(start.getDate() + 6);
  return start;
}

function buildWeeklyEarnings(earnings: EarningRow[]): WeeklyEarning[] {
  const map = new Map<string, WeeklyEarning>();
  earnings.forEach((e) => {
    if (!e.created_at) return;
    const date = new Date(e.created_at);
    const weekStart = getWeekStart(date);
    const key = weekStart.toISOString().split("T")[0];
    if (!map.has(key)) {
      map.set(key, {
        week_start: key,
        week_end: getWeekEnd(new Date(e.created_at))
          .toISOString()
          .split("T")[0],
        gross_amount: 0,
        platform_fee: 0,
        net_amount: 0,
      });
    }
    const week = map.get(key)!;
    week.gross_amount += e.gross_amount ?? 0;
    week.platform_fee += e.platform_fee ?? 0;
    week.net_amount += e.net_amount ?? 0;
  });
  return Array.from(map.values()).sort((a, b) =>
    b.week_start.localeCompare(a.week_start),
  );
}

function buildMonthlyEarnings(earnings: EarningRow[]): MonthlyEarning[] {
  const map = new Map<string, MonthlyEarning>();
  earnings.forEach((e) => {
    if (!e.created_at) return;
    const date = new Date(e.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("en-US", {
      month: "short",
      year: "numeric",
    });
    if (!map.has(key)) {
      map.set(key, {
        month_key: key,
        month_label: label,
        gross_amount: 0,
        platform_fee: 0,
        net_amount: 0,
      });
    }
    const month = map.get(key)!;
    month.gross_amount += e.gross_amount ?? 0;
    month.platform_fee += e.platform_fee ?? 0;
    month.net_amount += e.net_amount ?? 0;
  });
  return Array.from(map.values()).sort((a, b) =>
    b.month_key.localeCompare(a.month_key),
  );
}

function exportToCsv(earnings: EarningRow[]) {
  const header = "Date,Order ID,Gross (QAR),Commission (QAR),Net (QAR)";
  const rows = earnings.map((e) => {
    const date = e.created_at
      ? new Date(e.created_at).toLocaleDateString()
      : "";
    const gross = (e.gross_amount ?? 0).toFixed(2);
    const commission = (e.platform_fee ?? 0).toFixed(2);
    const net = (e.net_amount ?? 0).toFixed(2);
    return `${date},${e.order_id ?? ""},${gross},${commission},${net}`;
  });
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `earnings-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Component ─────────────────────────────────────────────────────────────────

const PartnerPayouts = () => {
  const { user } = useAuth();

  // Core data
  const [loading, setLoading] = useState(true);
  const [rawEarnings, setRawEarnings] = useState<EarningRow[]>([]);
  const [payouts, setPayouts] = useState<PartnerPayout[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [platformRate, setPlatformRate] = useState<number>(0.18); // commission_rate / 100

  // Date range filter (1)
  const [dateRange, setDateRange] = useState<DateRange>("all");

  // Derived stats (recomputed on rawEarnings / dateRange / payouts change)
  const [summary, setSummary] = useState<Summary>({
    totalGross: 0,
    totalCommission: 0,
    totalNet: 0,
    thisMonthNet: 0,
    pendingAmount: 0,
    commissionRate: 18,
    availableForPayout: 0,
  });
  const [weeklyEarnings, setWeeklyEarnings] = useState<WeeklyEarning[]>([]);
  const [monthlyEarnings, setMonthlyEarnings] = useState<MonthlyEarning[]>([]);

  // Drill-down (4)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Payout request (5)
  const [showPayoutDialog, setShowPayoutDialog] = useState(false);
  const [requestingPayout, setRequestingPayout] = useState(false);

  // Bank account (6, 8)
  const [bankDetails, setBankDetails] = useState<BankDetails>({
    bank_name: "",
    bank_account_name: "",
    bank_account_number: "",
    bank_iban: "",
    swift_code: "",
    payout_frequency: "weekly",
  });
  const [bankEditing, setBankEditing] = useState(false);
  const [bankSaving, setBankSaving] = useState(false);

  // ── Initial fetch ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (user) fetchPayoutData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // ── Recompute derived state ────────────────────────────────────────────────

  useEffect(() => {
    const filtered = filterByDateRange(rawEarnings, dateRange);

    const totalGross = filtered.reduce((s, e) => s + (e.gross_amount ?? 0), 0);
    const totalCommission = filtered.reduce(
      (sum, earning) => sum + (earning.platform_fee ?? 0),
      0,
    );
    const totalNet = filtered.reduce(
      (sum, earning) => sum + (earning.net_amount ?? 0),
      0,
    );

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthNet = rawEarnings
      .filter((e) => e.created_at && new Date(e.created_at) >= thisMonthStart)
      .reduce((s, e) => s + (e.net_amount ?? 0), 0);

    const pendingAmount = payouts
      .filter((p) => p.status === "pending" || p.status === "processing")
      .reduce((s, p) => s + p.amount, 0);

    const availableForPayout = rawEarnings
      .filter((earning) => earning.status === "pending" && !earning.payout_id)
      .reduce((sum, earning) => sum + (earning.net_amount ?? 0), 0);

    setSummary({
      totalGross,
      totalCommission,
      totalNet,
      thisMonthNet,
      pendingAmount,
      commissionRate: Math.round(platformRate * 100),
      availableForPayout,
    });
    setWeeklyEarnings(buildWeeklyEarnings(filtered).slice(0, 12));
    setMonthlyEarnings(
      buildMonthlyEarnings(filtered).slice(0, 12),
    );
  }, [rawEarnings, dateRange, payouts, platformRate]);

  // ── Data fetch ────────────────────────────────────────────────────────────

  const fetchPayoutData = async () => {
    if (!user) return;
    try {
      const { data: restaurant } = await supabase
        .from("restaurants")
        .select("id, commission_rate")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!restaurant) return;
      setRestaurantId(restaurant.id);
      const commissionRate = restaurant.commission_rate ?? 18;
      setPlatformRate(commissionRate / 100);

      const [earningsRes, payoutsRes, bankRes] = await Promise.all([
        supabase
          .from("partner_earnings")
          .select(
            "gross_amount, platform_fee, net_amount, delivery_fee, created_at, order_id, status, payout_id",
          )
          .eq("restaurant_id", restaurant.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("partner_payouts")
          .select(
            "id, amount, status, period_start, period_end, processed_at, created_at, reference_number, payout_method",
          )
          .eq("restaurant_id", restaurant.id)
          .order("created_at", { ascending: false }),
        // payout_frequency added via migration — select * to include it without type errors
        supabase
          .from("restaurant_details")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .maybeSingle() as unknown as Promise<{
          data: Record<string, unknown> | null;
          error: unknown;
        }>,
      ]);

      setRawEarnings(earningsRes.data || []);
      setPayouts((payoutsRes.data || []) as PartnerPayout[]);

      const bankRow = bankRes.data as Record<string, unknown> | null;
      if (bankRow) {
        setBankDetails({
          bank_name: (bankRow.bank_name as string) ?? "",
          bank_account_name: (bankRow.bank_account_name as string) ?? "",
          bank_account_number: (bankRow.bank_account_number as string) ?? "",
          bank_iban: (bankRow.bank_iban as string) ?? "",
          swift_code: (bankRow.swift_code as string) ?? "",
          payout_frequency: (bankRow.payout_frequency as string) ?? "weekly",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleRequestPayout = async () => {
    if (!restaurantId) return;
    setRequestingPayout(true);
    try {
      await requestPartnerPayout(restaurantId);
      toast.success(
        "Payout request submitted. The admin team will process it within 3-5 business days.",
      );
      setShowPayoutDialog(false);
      fetchPayoutData();
    } catch (error) {
      console.error("Failed to request partner payout:", error);
      toast.error(
        error instanceof Error
          ? error.message.replace(/_/g, " ")
          : "Failed to submit payout request. Please try again.",
      );
    } finally {
      setRequestingPayout(false);
    }
  };

  const handleSaveBank = async () => {
    if (!restaurantId) return;
    setBankSaving(true);
    try {
      const upsertData = {
        restaurant_id: restaurantId,
        bank_name: bankDetails.bank_name || null,
        bank_account_name: bankDetails.bank_account_name || null,
        bank_account_number: bankDetails.bank_account_number || null,
        bank_iban: bankDetails.bank_iban || null,
        swift_code: bankDetails.swift_code || null,
        payout_frequency: bankDetails.payout_frequency,
      };
      const { error } = await (supabase
        .from("restaurant_details")
        .upsert(upsertData as never, {
          onConflict: "restaurant_id",
        }) as unknown as Promise<{ error: unknown }>);
      if (error) throw error;
      toast.success("Bank details saved successfully.");
      setBankEditing(false);
    } catch {
      toast.error("Failed to save bank details. Please try again.");
    } finally {
      setBankSaving(false);
    }
  };

  const toggleRow = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // ── Derived display values ─────────────────────────────────────────────────

  const isBankConfigured = !!(
    bankDetails.bank_name && bankDetails.bank_account_number
  );

  const chartData = [...weeklyEarnings]
    .reverse()
    .slice(-8)
    .map((w) => ({
      label: new Date(w.week_start + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      net: parseFloat(w.net_amount.toFixed(2)),
      gross: parseFloat(w.gross_amount.toFixed(2)),
    }));

  // ── Status helpers ────────────────────────────────────────────────────────

  const renderBreakdownRow = (
    key: string,
    dateLabel: string,
    gross: number,
    commission: number,
    net: number,
    orders: EarningRow[],
  ) => {
    const isExpanded = expandedRows.has(key);
    return (
      <div
        key={key}
        className="overflow-hidden rounded-[22px] border border-[#E5EAF1] bg-white shadow-sm"
      >
        <div className="space-y-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#94A3B8]">
                <Calendar className="h-3.5 w-3.5 text-[#7C83F6]" />
                {dateLabel}
              </div>
              <p className="mt-1 text-sm font-semibold text-[#020617]">
                {formatCurrency(net)} net settlement
              </p>
            </div>
            <button
              onClick={() => toggleRow(key)}
              className="flex min-h-10 items-center gap-1 rounded-full border border-[#E5EAF1] bg-[#F6F8FB] px-3 text-xs font-bold text-[#020617] transition hover:border-[#020617]"
            >
              {isExpanded ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              {orders.length} {orders.length === 1 ? "order" : "orders"}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-[#F6F8FB] p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#94A3B8]">
                Gross
              </p>
              <p className="mt-1 text-sm font-black text-[#020617]">
                {formatCurrency(gross)}
              </p>
            </div>
            <div className="rounded-2xl bg-[#FB6B7A]/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#FB6B7A]">
                Fee {summary.commissionRate}%
              </p>
              <p className="mt-1 text-sm font-black text-[#020617]">
                -{formatCurrency(commission)}
              </p>
            </div>
            <div className="rounded-2xl bg-[#22C7A1]/10 p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0B9B7E]">
                Net
              </p>
              <p className="mt-1 text-sm font-black text-[#020617]">
                {formatCurrency(net)}
              </p>
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-[#E5EAF1] bg-[#F6F8FB]">
            {orders.length === 0 ? (
              <p className="py-4 text-center text-xs font-medium text-[#94A3B8]">
                No orders in this period
              </p>
            ) : (
              <div className="divide-y divide-[#E5EAF1]">
                {orders.map((o, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="text-[#94A3B8]">Order </span>
                      <span className="font-mono font-bold text-[#020617]">
                        {o.order_id ? `${o.order_id.slice(0, 8)}...` : "-"}
                      </span>
                      {o.created_at && (
                        <span className="ml-2 text-[#94A3B8]">
                          {new Date(o.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-3 font-bold">
                      <span className="text-[#94A3B8]">
                        {formatCurrency(o.gross_amount ?? 0)}
                      </span>
                      <span className="text-[#0B9B7E]">
                        {formatCurrency(
                          (o.gross_amount ?? 0) * (1 - platformRate),
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const statusConfig: Record<
    string,
    { label: string; border: string; badge: string; dotColor: string }
  > = {
    completed: {
      label: "Completed",
      border: "border-l-[#22C7A1]",
      badge: "border-[#22C7A1]/25 bg-[#22C7A1]/10 text-[#0B9B7E]",
      dotColor: "bg-[#22C7A1]",
    },
    paid: {
      label: "Paid",
      border: "border-l-[#22C7A1]",
      badge: "border-[#22C7A1]/25 bg-[#22C7A1]/10 text-[#0B9B7E]",
      dotColor: "bg-[#22C7A1]",
    },
    processing: {
      label: "Processing",
      border: "border-l-[#F97316]",
      badge: "border-[#F97316]/25 bg-[#F97316]/10 text-[#F97316]",
      dotColor: "bg-[#F97316]",
    },
    pending: {
      label: "Pending",
      border: "border-l-[#38BDF8]",
      badge: "border-[#38BDF8]/25 bg-[#38BDF8]/10 text-[#0284C7]",
      dotColor: "bg-[#38BDF8]",
    },
    failed: {
      label: "Failed",
      border: "border-l-[#FB6B7A]",
      badge: "border-[#FB6B7A]/25 bg-[#FB6B7A]/10 text-[#FB6B7A]",
      dotColor: "bg-[#FB6B7A]",
    },
  };

  if (loading) {
    return (
      <PartnerLayout title="Payouts">
        <div className="-m-6 min-h-screen bg-[#F6F8FB] p-4 sm:p-6">
          <div className="mx-auto max-w-7xl space-y-4">
            <Skeleton className="h-48 w-full rounded-[28px] bg-white" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Skeleton className="h-24 rounded-[22px] bg-white" />
              <Skeleton className="h-24 rounded-[22px] bg-white" />
              <Skeleton className="h-24 rounded-[22px] bg-white" />
              <Skeleton className="h-24 rounded-[22px] bg-white" />
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Skeleton className="h-80 rounded-[26px] bg-white" />
              <Skeleton className="h-80 rounded-[26px] bg-white" />
            </div>
          </div>
        </div>
      </PartnerLayout>
    );
  }

  return (
    <PartnerLayout
      title="Payouts"
      subtitle="Track earnings, bank setup, and settlement history"
    >
      <div className="-m-6 min-h-screen bg-[#F6F8FB] p-4 text-[#020617] sm:p-6">
        <div className="mx-auto max-w-7xl space-y-4">
          <section className="overflow-hidden rounded-[30px] border border-[#E5EAF1] bg-white shadow-sm">
            <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-5 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-[#7C83F6]/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                      <Wallet className="h-3.5 w-3.5" />
                      Settlement center
                    </div>
                    <h1 className="mt-3 text-2xl font-black tracking-tight text-[#020617] sm:text-3xl">
                      Partner payouts
                    </h1>
                    <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-[#64748B]">
                      Review net earnings, request transfers, and keep bank
                      details ready for the next settlement cycle.
                    </p>
                  </div>
                  <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#22C7A1]/10 text-[#0B9B7E] sm:flex">
                    <DollarSign className="h-6 w-6" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Gross
                    </p>
                    <p className="mt-1 text-lg font-black text-[#020617]">
                      {formatCurrency(summary.totalGross)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#FB6B7A]/20 bg-[#FB6B7A]/10 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#FB6B7A]">
                      Fee {summary.commissionRate}%
                    </p>
                    <p className="mt-1 text-lg font-black text-[#020617]">
                      -{formatCurrency(summary.totalCommission)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#22C7A1]/20 bg-[#22C7A1]/10 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0B9B7E]">
                      Net
                    </p>
                    <p className="mt-1 text-lg font-black text-[#020617]">
                      {formatCurrency(summary.totalNet)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-[#38BDF8]/20 bg-[#38BDF8]/10 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0284C7]">
                      This month
                    </p>
                    <p className="mt-1 text-lg font-black text-[#020617]">
                      {formatCurrency(summary.thisMonthNet)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#020617] p-5 text-white sm:p-6">
                <div className="flex h-full flex-col justify-between gap-6 rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">
                      Available for payout
                    </p>
                    <p className="mt-3 text-4xl font-black tracking-tight">
                      {formatCurrency(summary.availableForPayout)}
                    </p>
                    <div className="mt-4 space-y-2 text-sm font-semibold text-white/70">
                      {summary.pendingAmount > 0 && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-[#F97316]" />
                          {formatCurrency(summary.pendingAmount)} pending
                          processing
                        </div>
                      )}
                      {!isBankConfigured && (
                        <div className="flex items-start gap-2 text-[#F97316]">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          Set up bank account below before requesting a payout.
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    size="lg"
                    className="min-h-12 rounded-2xl bg-white font-black text-[#020617] hover:bg-white/90"
                    disabled={
                      summary.availableForPayout <= 0 || !isBankConfigured
                    }
                    onClick={() => setShowPayoutDialog(true)}
                  >
                    <Wallet className="mr-2 h-4 w-4" />
                    Request payout
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <section className="flex flex-col gap-3 rounded-[24px] border border-[#E5EAF1] bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="grid grid-cols-4 gap-1 rounded-2xl bg-[#F6F8FB] p-1">
              {DATE_RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDateRange(opt.value)}
                  className={`min-h-10 rounded-xl px-3 text-xs font-black transition ${
                    dateRange === opt.value
                      ? "bg-[#020617] text-white shadow-sm"
                      : "text-[#64748B] hover:text-[#020617]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <Button
              variant="outline"
              className="min-h-11 rounded-2xl border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-[#F6F8FB]"
              onClick={() =>
                exportToCsv(filterByDateRange(rawEarnings, dateRange))
              }
              disabled={rawEarnings.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </section>

          <section className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr]">
            <div className="rounded-[28px] border border-[#E5EAF1] bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                    Earnings trend
                  </p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-[#020617]">
                    Weekly net performance
                  </h2>
                  <p className="mt-1 text-sm font-medium text-[#94A3B8]">
                    {RANGE_LABELS[dateRange]} view, net compared with gross
                    revenue.
                  </p>
                </div>
                <div className="rounded-2xl bg-[#22C7A1]/10 p-3 text-[#0B9B7E]">
                  <TrendingUp className="h-5 w-5" />
                </div>
              </div>

              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={chartData}
                    margin={{ top: 6, right: 4, left: 0, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="#E5EAF1"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "#94A3B8", fontWeight: 700 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => `${v}`}
                      tick={{ fontSize: 11, fill: "#94A3B8", fontWeight: 700 }}
                      tickLine={false}
                      axisLine={false}
                      width={52}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => [
                        formatCurrency(value),
                        name === "net" ? "Net earnings" : "Gross revenue",
                      ]}
                      contentStyle={{
                        fontSize: 12,
                        borderRadius: 16,
                        borderColor: "#E5EAF1",
                        color: "#020617",
                      }}
                      cursor={{ fill: "#F6F8FB" }}
                    />
                    <Bar
                      dataKey="gross"
                      fill="#E5EAF1"
                      radius={[6, 6, 0, 0]}
                      name="gross"
                    />
                    <Bar
                      dataKey="net"
                      fill="#22C7A1"
                      radius={[6, 6, 0, 0]}
                      name="net"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-64 flex-col items-center justify-center rounded-[24px] border border-dashed border-[#E5EAF1] bg-[#F6F8FB] text-center">
                  <TrendingUp className="mb-3 h-8 w-8 text-[#94A3B8]" />
                  <p className="text-sm font-bold text-[#020617]">
                    No earnings in this range
                  </p>
                  <p className="mt-1 text-xs font-medium text-[#94A3B8]">
                    Completed orders will build your weekly trend.
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-[#E5EAF1] bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                    History
                  </p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-[#020617]">
                    Payout requests
                  </h2>
                </div>
                <Badge className="rounded-full border-[#E5EAF1] bg-[#F6F8FB] text-[#020617] hover:bg-[#F6F8FB]">
                  {payouts.length} records
                </Badge>
              </div>

              {payouts.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-[#E5EAF1] bg-[#F6F8FB] p-8 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[#94A3B8]">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-black text-[#020617]">
                    No payout requests yet
                  </p>
                  <p className="mt-1 text-xs font-medium text-[#94A3B8]">
                    Request history appears here after your first transfer.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payouts.map((payout) => {
                    const cfg = statusConfig[payout.status] ?? statusConfig.pending;
                    return (
                      <div
                        key={payout.id}
                        className={`rounded-[22px] border border-[#E5EAF1] border-l-4 ${cfg.border} bg-[#F6F8FB] p-4`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-lg font-black text-[#020617]">
                              {formatCurrency(payout.amount)}
                            </p>
                            <p className="mt-1 text-xs font-bold text-[#94A3B8]">
                              {new Date(
                                payout.period_start,
                              ).toLocaleDateString()}{" "}
                              -{" "}
                              {new Date(payout.period_end).toLocaleDateString()}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={`rounded-full font-black ${cfg.badge}`}
                          >
                            <span
                              className={`mr-1.5 h-1.5 w-1.5 rounded-full ${cfg.dotColor}`}
                            />
                            {cfg.label}
                          </Badge>
                        </div>
                        {(payout.reference_number || payout.payout_method) && (
                          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-[#64748B]">
                            {payout.payout_method && (
                              <span>
                                {payout.payout_method.replace(/_/g, " ")}
                              </span>
                            )}
                            {payout.reference_number && (
                              <span className="font-mono">
                                Ref: {payout.reference_number}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="rounded-[28px] border border-[#E5EAF1] bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#38BDF8]/10 text-[#0284C7]">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                      Bank account
                    </p>
                    <h2 className="mt-1 text-xl font-black tracking-tight text-[#020617]">
                      Transfer details
                    </h2>
                  </div>
                </div>
                {!bankEditing ? (
                  <Button
                    variant="outline"
                    className="rounded-2xl border-[#E5EAF1] font-black text-[#020617]"
                    onClick={() => setBankEditing(true)}
                  >
                    {isBankConfigured ? "Edit" : "Set up"}
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="rounded-2xl border-[#E5EAF1]"
                      onClick={() => setBankEditing(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="rounded-2xl bg-[#020617] font-black text-white hover:bg-[#020617]/90"
                      onClick={handleSaveBank}
                      disabled={bankSaving}
                    >
                      {bankSaving ? "Saving..." : "Save"}
                    </Button>
                  </div>
                )}
              </div>

              {!isBankConfigured && !bankEditing && (
                <div className="mb-4 flex items-start gap-2 rounded-2xl border border-[#F97316]/25 bg-[#F97316]/10 p-3 text-xs font-bold text-[#F97316]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  Add bank details to enable payout requests.
                </div>
              )}

              {bankEditing ? (
                <div className="space-y-3">
                  {[
                    {
                      id: "bank_name",
                      label: "Bank Name",
                      placeholder: "e.g. Qatar National Bank",
                      field: "bank_name" as keyof BankDetails,
                    },
                    {
                      id: "bank_account_name",
                      label: "Account Holder",
                      placeholder: "As on the account",
                      field: "bank_account_name" as keyof BankDetails,
                    },
                    {
                      id: "bank_account_number",
                      label: "Account Number",
                      placeholder: "Account number",
                      field: "bank_account_number" as keyof BankDetails,
                    },
                    {
                      id: "bank_iban",
                      label: "IBAN",
                      placeholder: "QA...",
                      field: "bank_iban" as keyof BankDetails,
                    },
                    {
                      id: "swift_code",
                      label: "SWIFT / BIC",
                      placeholder: "e.g. QNBAQAQA",
                      field: "swift_code" as keyof BankDetails,
                    },
                  ].map(({ id, label, placeholder, field }) => (
                    <div key={id} className="space-y-1.5">
                      <Label
                        htmlFor={id}
                        className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]"
                      >
                        {label}
                      </Label>
                      <Input
                        id={id}
                        value={bankDetails[field]}
                        onChange={(e) =>
                          setBankDetails((prev) => ({
                            ...prev,
                            [field]: e.target.value,
                          }))
                        }
                        placeholder={placeholder}
                        className="min-h-11 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-bold text-[#020617]"
                      />
                    </div>
                  ))}
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="payout_frequency"
                      className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]"
                    >
                      Payout Schedule
                    </Label>
                    <Select
                      value={bankDetails.payout_frequency}
                      onValueChange={(v) =>
                        setBankDetails((prev) => ({
                          ...prev,
                          payout_frequency: v,
                        }))
                      }
                    >
                      <SelectTrigger
                        id="payout_frequency"
                        className="min-h-11 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-bold text-[#020617]"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYOUT_FREQUENCY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {[
                    { label: "Bank", value: bankDetails.bank_name },
                    { label: "Holder", value: bankDetails.bank_account_name },
                    {
                      label: "Account",
                      value: bankDetails.bank_account_number
                        ? "****" + bankDetails.bank_account_number.slice(-4)
                        : "",
                    },
                    {
                      label: "IBAN",
                      value: bankDetails.bank_iban
                        ? "****" + bankDetails.bank_iban.slice(-4)
                        : "",
                    },
                    { label: "SWIFT", value: bankDetails.swift_code },
                    {
                      label: "Schedule",
                      value:
                        PAYOUT_FREQUENCY_OPTIONS.find(
                          (o) => o.value === bankDetails.payout_frequency,
                        )?.label ?? bankDetails.payout_frequency,
                    },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] px-4 py-3"
                    >
                      <span className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                        {label}
                      </span>
                      <span
                        className={
                          value
                            ? "text-right text-sm font-black text-[#020617]"
                            : "text-right text-xs font-bold italic text-[#94A3B8]"
                        }
                      >
                        {value || "Not set"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-[28px] border border-[#E5EAF1] bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                    Breakdown
                  </p>
                  <h2 className="mt-1 text-xl font-black tracking-tight text-[#020617]">
                    Earnings details
                  </h2>
                </div>
              </div>

              <Tabs defaultValue="weekly">
                <TabsList className="mb-4 grid h-12 grid-cols-2 rounded-2xl bg-[#F6F8FB] p-1">
                  <TabsTrigger
                    value="weekly"
                    className="rounded-xl text-xs font-black data-[state=active]:bg-[#020617] data-[state=active]:text-white"
                  >
                    Weekly
                  </TabsTrigger>
                  <TabsTrigger
                    value="monthly"
                    className="rounded-xl text-xs font-black data-[state=active]:bg-[#020617] data-[state=active]:text-white"
                  >
                    Monthly
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="weekly" className="space-y-3">
                  {weeklyEarnings.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-[#E5EAF1] bg-[#F6F8FB] p-10 text-center">
                      <TrendingUp className="mx-auto mb-3 h-8 w-8 text-[#94A3B8]" />
                      <p className="text-sm font-bold text-[#020617]">
                        No earnings in this period
                      </p>
                    </div>
                  ) : (
                    weeklyEarnings.map((week) => {
                      const orders = rawEarnings.filter((e) => {
                        if (!e.created_at) return false;
                        const d = new Date(e.created_at);
                        return (
                          d >= new Date(week.week_start + "T00:00:00") &&
                          d <= new Date(week.week_end + "T23:59:59")
                        );
                      });
                      const dateLabel = `${new Date(week.week_start + "T00:00:00").toLocaleDateString()} - ${new Date(week.week_end + "T00:00:00").toLocaleDateString()}`;
                      return renderBreakdownRow(
                        week.week_start,
                        dateLabel,
                        week.gross_amount,
                        week.platform_fee,
                        week.net_amount,
                        orders,
                      );
                    })
                  )}
                </TabsContent>

                <TabsContent value="monthly" className="space-y-3">
                  {monthlyEarnings.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-[#E5EAF1] bg-[#F6F8FB] p-10 text-center">
                      <TrendingUp className="mx-auto mb-3 h-8 w-8 text-[#94A3B8]" />
                      <p className="text-sm font-bold text-[#020617]">
                        No earnings in this period
                      </p>
                    </div>
                  ) : (
                    monthlyEarnings.map((month) => {
                      const orders = rawEarnings.filter((e) => {
                        if (!e.created_at) return false;
                        const d = new Date(e.created_at);
                        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                        return key === month.month_key;
                      });
                      return renderBreakdownRow(
                        month.month_key,
                        month.month_label,
                        month.gross_amount,
                        month.platform_fee,
                        month.net_amount,
                        orders,
                      );
                    })
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </section>
        </div>
      </div>

      <AlertDialog open={showPayoutDialog} onOpenChange={setShowPayoutDialog}>
        <AlertDialogContent className="rounded-[28px] border-[#E5EAF1]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#020617]">
              Confirm payout request
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-sm">
                <div className="rounded-[24px] bg-[#F6F8FB] p-4 text-center">
                  <p className="mb-1 text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                    You are requesting
                  </p>
                  <p className="text-3xl font-black text-[#020617]">
                    {formatCurrency(summary.availableForPayout)}
                  </p>
                  {isBankConfigured && (
                    <p className="mt-2 text-xs font-bold text-[#94A3B8]">
                      via bank transfer to{" "}
                      <span className="text-[#020617]">
                        {bankDetails.bank_name}
                      </span>
                    </p>
                  )}
                </div>
                <p className="text-xs font-medium text-[#94A3B8]">
                  The admin team will review and process your request within 3-5
                  business days.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-2xl border-[#E5EAF1] font-black">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl bg-[#020617] font-black text-white hover:bg-[#020617]/90"
              onClick={handleRequestPayout}
              disabled={requestingPayout}
            >
              {requestingPayout ? "Submitting..." : "Confirm request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PartnerLayout>
  );
};

export default PartnerPayouts;
