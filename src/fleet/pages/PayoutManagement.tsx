import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  ArrowDownToLine,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  FileText,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePayouts, type Payout } from "@/fleet/hooks/useDrivers";
import { cn } from "@/lib/utils";

const C = {
  text: "#020617",
  muted: "#94A3B8",
  panel: "#F6F8FB",
  water: "#38BDF8",
  fat: "#FB6B7A",
  protein: "#7C83F6",
  progress: "#22C7A1",
};

const PAGE_SIZE = 20;

export default function PayoutManagement() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  const [page, setPage] = useState(1);

  const { payouts: rawPayouts, isLoading, total } = usePayouts({
    status: statusFilter,
    page,
    limit: PAGE_SIZE,
  });

  const payouts = useMemo(() => {
    const query = search.trim().toLowerCase();
    const start = dateRange.start ? new Date(dateRange.start) : null;
    const end = dateRange.end ? new Date(dateRange.end) : null;

    return rawPayouts.filter((payout) => {
      const matchesSearch = !query || [
        payout.driverName,
        payout.driverId,
        payout.id,
        payout.payoutMethod,
        payout.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));

      if (!matchesSearch) return false;

      const periodStart = new Date(payout.periodStart);
      if (start && periodStart < start) return false;
      if (end && periodStart > end) return false;

      return true;
    });
  }, [rawPayouts, search, dateRange]);

  const totalPending = payouts.filter((p) => p.status === "pending").reduce((acc, p) => acc + p.amount, 0);
  const totalPaid = payouts.filter((p) => p.status === "paid").reduce((acc, p) => acc + p.amount, 0);
  const totalProcessing = payouts.filter((p) => p.status === "processing").reduce((acc, p) => acc + p.amount, 0);
  const failedCount = payouts.filter((p) => p.status === "failed").length;
  const visibleTotal = payouts.reduce((acc, p) => acc + p.amount, 0);
  const paidRate = visibleTotal > 0 ? Math.round((totalPaid / visibleTotal) * 100) : 0;
  const pageStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const pageEnd = Math.min(page * PAGE_SIZE, total || payouts.length);
  const canGoNext = page * PAGE_SIZE < total;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-[28px]" />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <Skeleton className="h-32 rounded-[22px]" />
          <Skeleton className="h-32 rounded-[22px]" />
          <Skeleton className="h-32 rounded-[22px]" />
          <Skeleton className="h-32 rounded-[22px]" />
        </div>
        <Skeleton className="h-96 w-full rounded-[24px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 text-[#020617]">
      <section className="relative overflow-hidden rounded-[28px] border border-white bg-white p-5 shadow-[0_18px_45px_rgba(2,6,23,0.06)]">
        <div className="absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(124,131,246,0.18),transparent_44%),radial-gradient(circle_at_bottom_right,rgba(34,199,161,0.14),transparent_38%)]" />
        <div className="relative flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[#F6F8FB] px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
              <Wallet className="h-4 w-4 text-[#22C7A1]" />
              Driver Finance
            </div>
            <h1 className="text-3xl font-black tracking-[-0.04em] text-[#020617] md:text-4xl">Payouts</h1>
            <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-[#94A3B8]">
              Monitor payout readiness, payment status, driver balances, and processing history from a clean finance ledger.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="outline"
              className="h-11 rounded-full border-slate-200 bg-white px-5 font-black text-[#020617] shadow-sm"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setDateRange({ start: "", end: "" });
                setPage(1);
              }}
            >
              <SlidersHorizontal className="mr-2 h-4 w-4 text-[#94A3B8]" />
              Reset Filters
            </Button>
            <Link to="/fleet/payouts/process">
              <Button className="h-11 w-full rounded-full bg-[#22C7A1] px-5 font-black text-white shadow-[0_12px_24px_rgba(34,199,161,0.24)] hover:bg-[#1DB492] sm:w-auto">
                <CreditCard className="mr-2 h-4 w-4" />
                Process Payouts
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Pending Amount"
          value={`QAR ${totalPending.toLocaleString()}`}
          helper={`${payouts.filter((p) => p.status === "pending").length} payouts waiting`}
          icon={<AlertCircle className="h-5 w-5" />}
          color={C.fat}
        />
        <KpiCard
          title="Paid This Page"
          value={`QAR ${totalPaid.toLocaleString()}`}
          helper={`${paidRate}% of visible value`}
          icon={<ShieldCheck className="h-5 w-5" />}
          color={C.progress}
        />
        <KpiCard
          title="Processing"
          value={`QAR ${totalProcessing.toLocaleString()}`}
          helper="In active payment flow"
          icon={<CreditCard className="h-5 w-5" />}
          color={C.protein}
        />
        <KpiCard
          title="Total Records"
          value={total.toLocaleString()}
          helper={failedCount > 0 ? `${failedCount} failed visible` : "No failed visible"}
          icon={<FileText className="h-5 w-5" />}
          color={C.water}
        />
      </section>

      <section className="rounded-[24px] border border-slate-100 bg-white p-4 shadow-[0_14px_35px_rgba(2,6,23,0.045)]">
        <div className="grid gap-3 xl:grid-cols-[1fr_170px_170px_180px]">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              placeholder="Search driver, payout ID, method, or status..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-12 rounded-2xl border-slate-100 bg-[#F6F8FB] pl-11 text-sm font-semibold text-[#020617] shadow-none placeholder:text-[#94A3B8] focus-visible:ring-[#22C7A1]"
            />
          </div>
          <Input
            type="date"
            value={dateRange.start}
            onChange={(event) => setDateRange({ ...dateRange, start: event.target.value })}
            className="h-12 rounded-2xl border-slate-100 bg-[#F6F8FB] font-bold text-[#020617] shadow-none focus-visible:ring-[#22C7A1]"
          />
          <Input
            type="date"
            value={dateRange.end}
            onChange={(event) => setDateRange({ ...dateRange, end: event.target.value })}
            className="h-12 rounded-2xl border-slate-100 bg-[#F6F8FB] font-bold text-[#020617] shadow-none focus-visible:ring-[#22C7A1]"
          />
          <Select
            value={statusFilter}
            onValueChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-12 rounded-2xl border-slate-100 bg-[#F6F8FB] font-bold text-[#020617] shadow-none focus:ring-[#22C7A1]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </section>

      <Card className="overflow-hidden rounded-[24px] border-slate-100 bg-white shadow-[0_14px_35px_rgba(2,6,23,0.045)]">
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-black tracking-[-0.03em] text-[#020617]">Payout History</h2>
              <p className="mt-1 text-sm font-semibold text-[#94A3B8]">Showing finance activity for the selected status and period.</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[#F6F8FB] px-3 py-2 text-xs font-black text-[#94A3B8]">
              <ArrowDownToLine className="h-4 w-4 text-[#38BDF8]" />
              Export-ready ledger
            </div>
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-[#F6F8FB]">
                  <Th>Driver</Th>
                  <Th>Period</Th>
                  <Th align="right">Amount</Th>
                  <Th>Status</Th>
                  <Th>Processed</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <PayoutRow key={payout.id} payout={payout} />
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-4 lg:hidden">
            {payouts.map((payout) => (
              <PayoutMobileCard key={payout.id} payout={payout} />
            ))}
          </div>

          {payouts.length === 0 && (
            <div className="px-6 py-14 text-center">
              <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-[#F6F8FB] text-[#38BDF8]">
                <CreditCard className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-black text-[#020617]">No payouts found</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm font-medium text-[#94A3B8]">
                Try changing the status, date range, or search query to widen the payout ledger.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-[#94A3B8]">
              Showing <span className="font-black text-[#020617]">{pageStart}</span> -{" "}
              <span className="font-black text-[#020617]">{pageEnd}</span> of{" "}
              <span className="font-black text-[#020617]">{total}</span>
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-10 rounded-full border-slate-200 bg-white font-black text-[#020617]"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-10 rounded-full border-slate-200 bg-white font-black text-[#020617]"
                onClick={() => setPage((p) => p + 1)}
                disabled={!canGoNext}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  title,
  value,
  helper,
  icon,
  color,
}: {
  title: string;
  value: string;
  helper: string;
  icon: ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-[22px] border border-slate-100 bg-white p-4 shadow-[0_14px_35px_rgba(2,6,23,0.045)]">
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl text-white" style={{ background: color }}>
          {icon}
        </div>
        <div className="h-1.5 w-12 rounded-full" style={{ background: color }} />
      </div>
      <p className="mt-4 text-sm font-black text-[#020617]">{title}</p>
      <p className="mt-2 text-2xl font-black tracking-[-0.05em] text-[#020617]">{value}</p>
      <p className="mt-1 text-xs font-semibold text-[#94A3B8]">{helper}</p>
    </div>
  );
}

function PayoutRow({ payout }: { payout: Payout }) {
  return (
    <tr className="border-b border-slate-100 transition-colors hover:bg-[#F6F8FB]/70">
      <td className="px-4 py-4">
        <DriverCell payout={payout} />
      </td>
      <td className="px-4 py-4">
        <PeriodCell payout={payout} />
      </td>
      <td className="px-4 py-4 text-right">
        <p className="text-base font-black text-[#020617]">QAR {payout.amount.toLocaleString()}</p>
        <p className="mt-1 text-xs font-semibold capitalize text-[#94A3B8]">{formatMethod(payout.payoutMethod)}</p>
      </td>
      <td className="px-4 py-4">{getStatusBadge(payout.status)}</td>
      <td className="px-4 py-4 text-sm font-semibold text-[#020617]">
        {payout.processedAt ? new Date(payout.processedAt).toLocaleDateString() : "Not processed"}
      </td>
      <td className="px-4 py-4 text-right">
        <Button variant="ghost" size="sm" className="h-10 w-10 rounded-full text-[#94A3B8] hover:bg-[#F6F8FB] hover:text-[#020617]">
          <Download className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}

function PayoutMobileCard({ payout }: { payout: Payout }) {
  return (
    <div className="rounded-[20px] border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <DriverCell payout={payout} />
        {getStatusBadge(payout.status)}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <MiniInfo label="Amount" value={`QAR ${payout.amount.toLocaleString()}`} color={C.progress} />
        <MiniInfo label="Method" value={formatMethod(payout.payoutMethod)} color={C.water} />
      </div>
      <div className="mt-4 rounded-[16px] bg-[#F6F8FB] p-3">
        <PeriodCell payout={payout} />
        <p className="mt-3 text-xs font-semibold text-[#94A3B8]">
          Processed: <span className="font-black text-[#020617]">{payout.processedAt ? new Date(payout.processedAt).toLocaleDateString() : "Not processed"}</span>
        </p>
      </div>
    </div>
  );
}

function DriverCell({ payout }: { payout: Payout }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#F6F8FB] text-[#7C83F6]">
        <Wallet className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-black text-[#020617]">{payout.driverName || "Unknown Driver"}</p>
        <p className="mt-1 truncate text-xs font-semibold text-[#94A3B8]">ID: {payout.driverId}</p>
      </div>
    </div>
  );
}

function PeriodCell({ payout }: { payout: Payout }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold text-[#020617]">
      <CalendarDays className="h-4 w-4 shrink-0 text-[#38BDF8]" />
      <span>
        {new Date(payout.periodStart).toLocaleDateString()} - {new Date(payout.periodEnd).toLocaleDateString()}
      </span>
    </div>
  );
}

function MiniInfo({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-[16px] bg-[#F6F8FB] p-3">
      <div className="mb-2 h-1.5 w-8 rounded-full" style={{ background: color }} />
      <p className="text-[11px] font-black uppercase tracking-[0.08em] text-[#94A3B8]">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-[#020617]">{value}</p>
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-[#94A3B8]",
        align === "right" ? "text-right" : "text-left"
      )}
    >
      {children}
    </th>
  );
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    paid: "border-transparent bg-[#22C7A1]/10 text-[#0F9F82]",
    processing: "border-transparent bg-[#7C83F6]/10 text-[#7C83F6]",
    pending: "border-transparent bg-[#38BDF8]/10 text-[#0284C7]",
    failed: "border-transparent bg-[#FB6B7A]/10 text-[#FB6B7A]",
  };

  return (
    <Badge className={cn("rounded-full px-3 py-1 text-[11px] font-black shadow-none", styles[status] || styles.failed)}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function formatMethod(method?: string) {
  if (!method) return "Bank transfer";
  return method.replace(/_/g, " ");
}
