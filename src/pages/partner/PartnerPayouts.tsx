import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  CheckCircle,
  Wallet,
  ArrowRight,
  Minus,
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

// ── Constants ────────────────────────────────────────────────────────────────
// PLATFORM_RATE is no longer hardcoded — it comes from restaurants.commission_rate per restaurant

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

function filterByDateRange(earnings: EarningRow[], range: DateRange): EarningRow[] {
  if (range === "all") return earnings;
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return earnings.filter((e) => e.created_at && new Date(e.created_at) >= cutoff);
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

function buildWeeklyEarnings(earnings: EarningRow[], rate = 0.18): WeeklyEarning[] {
  const map = new Map<string, WeeklyEarning>();
  earnings.forEach((e) => {
    if (!e.created_at) return;
    const date = new Date(e.created_at);
    const weekStart = getWeekStart(date);
    const key = weekStart.toISOString().split("T")[0];
    if (!map.has(key)) {
      map.set(key, {
        week_start: key,
        week_end: getWeekEnd(new Date(e.created_at)).toISOString().split("T")[0],
        gross_amount: 0,
        platform_fee: 0,
        net_amount: 0,
      });
    }
    const week = map.get(key)!;
    const gross = e.gross_amount ?? 0;
    week.gross_amount += gross;
    week.platform_fee += gross * rate;
    week.net_amount += gross * (1 - rate);
  });
  return Array.from(map.values()).sort((a, b) => b.week_start.localeCompare(a.week_start));
}

function buildMonthlyEarnings(earnings: EarningRow[], rate = 0.18): MonthlyEarning[] {
  const map = new Map<string, MonthlyEarning>();
  earnings.forEach((e) => {
    if (!e.created_at) return;
    const date = new Date(e.created_at);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const label = date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    if (!map.has(key)) {
      map.set(key, { month_key: key, month_label: label, gross_amount: 0, platform_fee: 0, net_amount: 0 });
    }
    const month = map.get(key)!;
    const gross = e.gross_amount ?? 0;
    month.gross_amount += gross;
    month.platform_fee += gross * rate;
    month.net_amount += gross * (1 - rate);
  });
  return Array.from(map.values()).sort((a, b) => b.month_key.localeCompare(a.month_key));
}

function exportToCsv(earnings: EarningRow[], rate = 0.18) {
  const header = "Date,Order ID,Gross (QAR),Commission (QAR),Net (QAR)";
  const rows = earnings.map((e) => {
    const date = e.created_at ? new Date(e.created_at).toLocaleDateString() : "";
    const gross = (e.gross_amount ?? 0).toFixed(2);
    const commission = ((e.gross_amount ?? 0) * rate).toFixed(2);
    const net = ((e.gross_amount ?? 0) * (1 - rate)).toFixed(2);
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
    const totalCommission = totalGross * platformRate;
    const totalNet = totalGross - totalCommission;

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthGross = rawEarnings
      .filter((e) => e.created_at && new Date(e.created_at) >= thisMonthStart)
      .reduce((s, e) => s + (e.gross_amount ?? 0), 0);
    const thisMonthNet = thisMonthGross * (1 - platformRate);

    const pendingAmount = payouts
      .filter((p) => p.status === "pending" || p.status === "processing")
      .reduce((s, p) => s + p.amount, 0);

    const rawTotalNet = rawEarnings.reduce((s, e) => s + (e.gross_amount ?? 0), 0) * (1 - platformRate);
    const totalAllocated = payouts
      .filter((p) => p.status !== "failed")
      .reduce((s, p) => s + p.amount, 0);
    const availableForPayout = Math.max(0, rawTotalNet - totalAllocated);

    setSummary({ totalGross, totalCommission, totalNet, thisMonthNet, pendingAmount, commissionRate: Math.round(platformRate * 100), availableForPayout });
    setWeeklyEarnings(buildWeeklyEarnings(filtered, platformRate).slice(0, 12));
    setMonthlyEarnings(buildMonthlyEarnings(filtered, platformRate).slice(0, 12));
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
          .select("gross_amount, platform_fee, net_amount, delivery_fee, created_at, order_id")
          .eq("restaurant_id", restaurant.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("partner_payouts")
          .select("id, amount, status, period_start, period_end, processed_at, created_at, reference_number, payout_method")
          .eq("restaurant_id", restaurant.id)
          .order("created_at", { ascending: false }),
        // payout_frequency added via migration — select * to include it without type errors
        (supabase
          .from("restaurant_details")
          .select("*")
          .eq("restaurant_id", restaurant.id)
          .maybeSingle() as unknown as Promise<{ data: Record<string, unknown> | null; error: unknown }>),
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
      const now = new Date();
      const periodEnd = now.toISOString().split("T")[0];
      const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const { error } = await supabase.from("partner_payouts").insert({
        restaurant_id: restaurantId,
        amount: summary.availableForPayout,
        status: "pending",
        period_start: periodStart,
        period_end: periodEnd,
        payout_method: "bank_transfer",
      });
      if (error) throw error;
      toast.success("Payout request submitted. The admin team will process it within 3–5 business days.");
      setShowPayoutDialog(false);
      fetchPayoutData();
    } catch {
      toast.error("Failed to submit payout request. Please try again.");
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
        .upsert(upsertData as never, { onConflict: "restaurant_id" }) as unknown as Promise<{ error: unknown }>);
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

  const isBankConfigured = !!(bankDetails.bank_name && bankDetails.bank_account_number);

  const chartData = [...weeklyEarnings].reverse().slice(-8).map((w) => ({
    label: new Date(w.week_start + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    net: parseFloat(w.net_amount.toFixed(2)),
    gross: parseFloat(w.gross_amount.toFixed(2)),
  }));

  // ── Status helpers ────────────────────────────────────────────────────────

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "processing": return <Clock className="h-4 w-4 text-amber-500" />;
      default: return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-500/10 text-green-600 border-green-500/20";
      case "processing": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "failed": return "bg-red-500/10 text-red-600 border-red-500/20";
      default: return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    }
  };

  // ── Breakdown row renderer (shared for weekly + monthly) ──────────────────

  const renderBreakdownRow = (
    key: string,
    dateLabel: string,
    gross: number,
    commission: number,
    net: number,
    orders: EarningRow[]
  ) => {
    const isExpanded = expandedRows.has(key);
    return (
      <div key={key} className="rounded-lg bg-muted/50 overflow-hidden">
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>{dateLabel}</span>
            </div>
            <button
              onClick={() => toggleRow(key)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {orders.length} {orders.length === 1 ? "order" : "orders"}
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-center flex-1 min-w-[80px]">
              <p className="text-xs text-muted-foreground">Gross</p>
              <p className="font-semibold text-sm">{formatCurrency(gross)}</p>
            </div>
            <Minus className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <div className="text-center flex-1 min-w-[80px]">
              <p className="text-xs text-muted-foreground">Commission ({summary.commissionRate}%)</p>
              <p className="font-semibold text-sm text-destructive">{formatCurrency(commission)}</p>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <div className="text-center flex-1 min-w-[80px]">
              <p className="text-xs text-muted-foreground">Your Earnings</p>
              <p className="font-semibold text-sm text-green-600">{formatCurrency(net)}</p>
            </div>
          </div>
        </div>

        {isExpanded && (
          <div className="border-t border-border/50 bg-background/50">
            {orders.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No orders in this period</p>
            ) : (
              <div className="divide-y divide-border/30">
                {orders.map((o, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 text-xs">
                    <div>
                      <span className="text-muted-foreground">Order </span>
                      <span className="font-mono">
                        {o.order_id ? o.order_id.slice(0, 8) + "…" : "—"}
                      </span>
                      {o.created_at && (
                        <span className="ml-2 text-muted-foreground">
                          {new Date(o.created_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-muted-foreground">{formatCurrency(o.gross_amount ?? 0)}</span>
                      <span className="text-green-600 font-medium">
                        {formatCurrency((o.gross_amount ?? 0) * (1 - platformRate))}
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

  // ── Status config for payout history items ───────────────────────────────

  const statusConfig: Record<string, { label: string; border: string; badge: string; dotColor: string }> = {
    completed: {
      label: "Completed",
      border: "border-l-emerald-500",
      badge: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      dotColor: "bg-emerald-500",
    },
    processing: {
      label: "Processing",
      border: "border-l-blue-500",
      badge: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      dotColor: "bg-blue-500",
    },
    pending: {
      label: "Pending",
      border: "border-l-amber-400",
      badge: "bg-amber-500/10 text-amber-600 border-amber-500/20",
      dotColor: "bg-amber-400",
    },
    failed: {
      label: "Failed",
      border: "border-l-red-500",
      badge: "bg-red-500/10 text-red-600 border-red-500/20",
      dotColor: "bg-red-500",
    },
  };

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <PartnerLayout title="Payouts">
        <div className="space-y-4">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-48 rounded-lg" />
            <Skeleton className="h-9 w-32 rounded-lg ml-auto" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-52 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <Skeleton className="h-64 lg:col-span-3" />
            <Skeleton className="h-64 lg:col-span-2" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </PartnerLayout>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <PartnerLayout title="Payouts" subtitle="Track your earnings and manage payouts">
      <div className="space-y-6">

        {/* ── Hero: Available for Payout ───────────────────────────────────── */}
        <div className="rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/80 p-6 text-primary-foreground shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <p className="text-primary-foreground/70 text-sm font-medium mb-1">Available for Payout</p>
              <p className="text-4xl font-bold tracking-tight">{formatCurrency(summary.availableForPayout)}</p>
              {summary.pendingAmount > 0 && (
                <p className="text-primary-foreground/60 text-xs mt-1.5 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatCurrency(summary.pendingAmount)} pending processing
                </p>
              )}
              {!isBankConfigured && (
                <p className="text-amber-200 text-xs mt-1.5 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Set up bank account below to request payouts
                </p>
              )}
            </div>
            <Button
              size="lg"
              variant="secondary"
              className="shrink-0 font-semibold"
              disabled={summary.availableForPayout <= 0 || !isBankConfigured}
              onClick={() => setShowPayoutDialog(true)}
            >
              <Wallet className="h-4 w-4 mr-2" />
              Request Payout
            </Button>
          </div>

          {/* Inline earnings summary */}
          <div className="mt-5 pt-4 border-t border-primary-foreground/20 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-primary-foreground/60 mb-0.5">Gross Revenue</p>
              <p className="font-semibold text-sm sm:text-base">{formatCurrency(summary.totalGross)}</p>
            </div>
            <div>
              <p className="text-xs text-primary-foreground/60 mb-0.5">Fee ({summary.commissionRate}%)</p>
              <p className="font-semibold text-sm sm:text-base text-red-200">−{formatCurrency(summary.totalCommission)}</p>
            </div>
            <div>
              <p className="text-xs text-primary-foreground/60 mb-0.5">Net Earnings</p>
              <p className="font-semibold text-sm sm:text-base text-green-200">{formatCurrency(summary.totalNet)}</p>
            </div>
          </div>
        </div>

        {/* ── Date filter + secondary stats ────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Segmented pill control */}
          <div className="flex items-center bg-muted rounded-lg p-1 gap-0.5">
            {DATE_RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDateRange(opt.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  dateRange === opt.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* This month callout */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span>This month:</span>
              <span className="font-semibold text-foreground">{formatCurrency(summary.thisMonthNet)}</span>
            </div>
          </div>
        </div>

        {/* ── Earnings trend chart ──────────────────────────────────────────── */}
        {chartData.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Weekly Earnings Trend</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{RANGE_LABELS[dateRange]} · Net vs Gross</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground h-8 text-xs"
                  onClick={() => exportToCsv(filterByDateRange(rawEarnings, dateRange), platformRate)}
                  disabled={rawEarnings.length === 0}
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis
                    tickFormatter={(v) => `${v}`}
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={52}
                  />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      formatCurrency(value),
                      name === "net" ? "Net Earnings" : "Gross Revenue",
                    ]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    cursor={{ fill: "hsl(var(--muted))" }}
                  />
                  <Bar dataKey="gross" fill="hsl(var(--muted-foreground)/0.15)" radius={[3, 3, 0, 0]} name="gross" />
                  <Bar dataKey="net" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} name="net" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* ── Payout history + Bank account (side by side on desktop) ──────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* Payout History — 3/5 width */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Payout History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {payouts.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                    <Wallet className="h-5 w-5 text-muted-foreground/60" />
                  </div>
                  <p className="text-sm text-muted-foreground">No payout requests yet</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {summary.availableForPayout > 0
                      ? "Use the 'Request Payout' button above to get started"
                      : "Earnings will appear here once you have completed orders"}
                  </p>
                </div>
              ) : (
                payouts.map((payout) => {
                  const cfg = statusConfig[payout.status] ?? statusConfig.pending;
                  return (
                    <div
                      key={payout.id}
                      className={`flex items-center gap-4 p-3.5 rounded-lg bg-muted/40 border-l-[3px] ${cfg.border}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm">{formatCurrency(payout.amount)}</p>
                          <Badge variant="outline" className={`text-xs shrink-0 ${cfg.badge}`}>
                            <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${cfg.dotColor}`} />
                            {cfg.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {new Date(payout.period_start).toLocaleDateString()} –{" "}
                            {new Date(payout.period_end).toLocaleDateString()}
                          </span>
                        </div>
                        {(payout.reference_number || payout.payout_method) && (
                          <div className="flex items-center gap-3 mt-1">
                            {payout.payout_method && (
                              <span className="text-xs text-muted-foreground capitalize">
                                {payout.payout_method.replace(/_/g, " ")}
                              </span>
                            )}
                            {payout.reference_number && (
                              <span className="text-xs font-mono text-muted-foreground">
                                Ref: {payout.reference_number}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Bank Account — 2/5 width */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">Bank Account</CardTitle>
                </div>
                {!bankEditing ? (
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setBankEditing(true)}>
                    {isBankConfigured ? "Edit" : "Set up"}
                  </Button>
                ) : (
                  <div className="flex gap-1.5">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setBankEditing(false)}>
                      Cancel
                    </Button>
                    <Button size="sm" className="h-7 text-xs" onClick={handleSaveBank} disabled={bankSaving}>
                      {bankSaving ? "Saving…" : "Save"}
                    </Button>
                  </div>
                )}
              </div>
              {!isBankConfigured && !bankEditing && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-md px-2.5 py-1.5 mt-2">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  Not configured — required for payouts
                </div>
              )}
            </CardHeader>

            <CardContent>
              {bankEditing ? (
                <div className="space-y-3">
                  {[
                    { id: "bank_name", label: "Bank Name", placeholder: "e.g. Qatar National Bank", field: "bank_name" as keyof BankDetails },
                    { id: "bank_account_name", label: "Account Holder", placeholder: "As on the account", field: "bank_account_name" as keyof BankDetails },
                    { id: "bank_account_number", label: "Account Number", placeholder: "Account number", field: "bank_account_number" as keyof BankDetails },
                    { id: "bank_iban", label: "IBAN", placeholder: "QA...", field: "bank_iban" as keyof BankDetails },
                    { id: "swift_code", label: "SWIFT / BIC", placeholder: "e.g. QNBAQAQA", field: "swift_code" as keyof BankDetails },
                  ].map(({ id, label, placeholder, field }) => (
                    <div key={id} className="space-y-1">
                      <Label htmlFor={id} className="text-xs">{label}</Label>
                      <Input
                        id={id}
                        value={bankDetails[field]}
                        onChange={(e) => setBankDetails((prev) => ({ ...prev, [field]: e.target.value }))}
                        placeholder={placeholder}
                        className="h-8 text-sm"
                      />
                    </div>
                  ))}
                  <div className="space-y-1">
                    <Label htmlFor="payout_frequency" className="text-xs">Payout Schedule</Label>
                    <Select
                      value={bankDetails.payout_frequency}
                      onValueChange={(v) => setBankDetails((prev) => ({ ...prev, payout_frequency: v }))}
                    >
                      <SelectTrigger id="payout_frequency" className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PAYOUT_FREQUENCY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5 text-sm">
                  {[
                    { label: "Bank", value: bankDetails.bank_name },
                    { label: "Holder", value: bankDetails.bank_account_name },
                    {
                      label: "Account",
                      value: bankDetails.bank_account_number
                        ? "••••" + bankDetails.bank_account_number.slice(-4)
                        : "",
                    },
                    {
                      label: "IBAN",
                      value: bankDetails.bank_iban ? "••••" + bankDetails.bank_iban.slice(-4) : "",
                    },
                    { label: "SWIFT", value: bankDetails.swift_code },
                    {
                      label: "Schedule",
                      value: PAYOUT_FREQUENCY_OPTIONS.find((o) => o.value === bankDetails.payout_frequency)?.label ?? bankDetails.payout_frequency,
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center gap-2">
                      <span className="text-muted-foreground text-xs w-16 shrink-0">{label}</span>
                      <span className={value ? "font-medium text-sm" : "text-muted-foreground italic text-xs"}>
                        {value || "Not set"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Earnings Breakdown (weekly/monthly tabs + drill-down) ─────────── */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Earnings Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="weekly">
              <TabsList className="mb-4 h-8">
                <TabsTrigger value="weekly" className="text-xs">Weekly</TabsTrigger>
                <TabsTrigger value="monthly" className="text-xs">Monthly</TabsTrigger>
              </TabsList>

              <TabsContent value="weekly" className="space-y-2.5">
                {weeklyEarnings.length === 0 ? (
                  <div className="text-center py-10">
                    <TrendingUp className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No earnings in this period</p>
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
                    const dateLabel = `${new Date(week.week_start + "T00:00:00").toLocaleDateString()} – ${new Date(week.week_end + "T00:00:00").toLocaleDateString()}`;
                    return renderBreakdownRow(week.week_start, dateLabel, week.gross_amount, week.platform_fee, week.net_amount, orders);
                  })
                )}
              </TabsContent>

              <TabsContent value="monthly" className="space-y-2.5">
                {monthlyEarnings.length === 0 ? (
                  <div className="text-center py-10">
                    <TrendingUp className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No earnings in this period</p>
                  </div>
                ) : (
                  monthlyEarnings.map((month) => {
                    const orders = rawEarnings.filter((e) => {
                      if (!e.created_at) return false;
                      const d = new Date(e.created_at);
                      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                      return key === month.month_key;
                    });
                    return renderBreakdownRow(month.month_key, month.month_label, month.gross_amount, month.platform_fee, month.net_amount, orders);
                  })
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

      </div>

      {/* ── Payout request dialog ─────────────────────────────────────────────── */}
      <AlertDialog open={showPayoutDialog} onOpenChange={setShowPayoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Payout Request</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-sm">
                <div className="rounded-xl bg-muted/60 p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">You are requesting</p>
                  <p className="text-3xl font-bold text-foreground">{formatCurrency(summary.availableForPayout)}</p>
                  {isBankConfigured && (
                    <p className="text-xs text-muted-foreground mt-1">
                      via bank transfer to <span className="font-medium text-foreground">{bankDetails.bank_name}</span>
                    </p>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">
                  The admin team will review and process your request within 3–5 business days.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRequestPayout} disabled={requestingPayout}>
              {requestingPayout ? "Submitting…" : "Confirm Request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PartnerLayout>
  );
};

export default PartnerPayouts;
