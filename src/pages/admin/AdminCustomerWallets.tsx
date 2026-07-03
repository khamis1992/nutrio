import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { formatCurrency } from "@/lib/currency";
import { cn } from "@/lib/utils";
import { Loader2, PackagePlus, RefreshCw, Search, Wallet } from "lucide-react";
import { toast } from "sonner";

type WalletRow = Database["public"]["Tables"]["customer_wallets"]["Row"];
type TransactionRow = Database["public"]["Tables"]["wallet_transactions"]["Row"];
type PackageRow = Database["public"]["Tables"]["wallet_topup_packages"]["Row"];
type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "user_id" | "full_name" | "email"
>;

interface WalletWithProfile extends WalletRow {
  profile?: ProfileRow;
}

const formatDate = (value: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString();
};

const C = {
  text: "#020617",
  muted: "#94A3B8",
  surface: "#F6F8FB",
  water: "#38BDF8",
  danger: "#FB6B7A",
  protein: "#7C83F6",
  progress: "#22C7A1",
};

function WalletMetricCard({
  label,
  value,
  detail,
  color,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden rounded-2xl border-0 bg-white shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-slate-100">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em]" style={{ color: C.muted }}>
              {label}
            </p>
            <p className="mt-3 text-3xl font-black leading-none tracking-tight" style={{ color: C.text }}>
              {value}
            </p>
            <p className="mt-2 text-sm font-medium" style={{ color: C.muted }}>
              {detail}
            </p>
          </div>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ backgroundColor: `${color}18`, color }}>
            {icon}
          </div>
        </div>
        <div className="mt-5 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: C.surface }}>
          <div className="h-full w-2/3 rounded-full" style={{ backgroundColor: color }} />
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminCustomerWallets() {
  const [wallets, setWallets] = useState<WalletWithProfile[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: walletRows, error: walletError }, { data: transactionRows, error: transactionError }, { data: packageRows, error: packageError }] =
        await Promise.all([
          supabase
            .from("customer_wallets")
            .select("*")
            .order("updated_at", { ascending: false })
            .limit(100),
          supabase
            .from("wallet_transactions")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("wallet_topup_packages")
            .select("*")
            .order("display_order", { ascending: true }),
        ]);

      if (walletError) throw walletError;
      if (transactionError) throw transactionError;
      if (packageError) throw packageError;

      const userIds = Array.from(new Set((walletRows || []).map((wallet) => wallet.user_id)));
      let profilesByUserId = new Map<string, ProfileRow>();

      if (userIds.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", userIds);

        if (profileError) throw profileError;
        profilesByUserId = new Map((profileRows || []).map((profile) => [profile.user_id, profile]));
      }

      setWallets((walletRows || []).map((wallet) => ({ ...wallet, profile: profilesByUserId.get(wallet.user_id) })));
      setTransactions(transactionRows || []);
      setPackages(packageRows || []);
    } catch (error) {
      console.error("Error loading customer wallets:", error);
      toast.error("Failed to load customer wallets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredWallets = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return wallets;
    return wallets.filter((wallet) => {
      const haystack = [
        wallet.user_id,
        wallet.profile?.full_name,
        wallet.profile?.email,
      ].join(" ").toLowerCase();
      return haystack.includes(query);
    });
  }, [search, wallets]);

  const totals = useMemo(() => {
    return wallets.reduce(
      (acc, wallet) => {
        acc.balance += Number(wallet.balance || 0);
        acc.credits += Number(wallet.total_credits || 0);
        acc.debits += Number(wallet.total_debits || 0);
        return acc;
      },
      { balance: 0, credits: 0, debits: 0 },
    );
  }, [wallets]);

  const togglePackage = async (pkg: PackageRow) => {
    const nextActive = !pkg.is_active;
    setPackages((current) => current.map((item) => (item.id === pkg.id ? { ...item, is_active: nextActive } : item)));

    const { error } = await supabase
      .from("wallet_topup_packages")
      .update({ is_active: nextActive, updated_at: new Date().toISOString() })
      .eq("id", pkg.id);

    if (error) {
      setPackages((current) => current.map((item) => (item.id === pkg.id ? { ...item, is_active: pkg.is_active } : item)));
      toast.error("Failed to update package");
      return;
    }

    toast.success(nextActive ? "Package enabled" : "Package disabled");
  };

  return (
    <AdminLayout>
      <div className="space-y-6 bg-[#F6F8FB] p-1 text-[#020617]">
        <div className="overflow-hidden rounded-3xl bg-white shadow-[0_18px_44px_rgba(2,6,23,0.06)] ring-1 ring-slate-100">
          <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_14px_28px_rgba(34,199,161,0.22)]" style={{ backgroundColor: C.progress }}>
                <Wallet className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: C.progress }}>
                  Finance control
                </p>
                <h1 className="mt-1 text-3xl font-black tracking-tight" style={{ color: C.text }}>
                  Customer Wallets
                </h1>
                <p className="mt-2 max-w-2xl text-sm font-medium leading-6" style={{ color: C.muted }}>
                  Monitor balances, audit wallet transactions, and manage customer top-up packages.
                </p>
              </div>
            </div>
            <Button
              onClick={fetchData}
              variant="outline"
              disabled={loading}
              className="h-11 rounded-xl border-slate-200 bg-white px-4 font-bold text-[#020617] shadow-sm hover:bg-[#F6F8FB]"
            >
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" style={{ color: C.progress }} /> : <RefreshCw className="mr-2 h-4 w-4" style={{ color: C.progress }} />}
              Refresh
            </Button>
          </div>
          <div className="grid border-t border-slate-100 bg-[#F6F8FB]/70 px-6 py-4 text-sm font-semibold sm:grid-cols-3">
            <span style={{ color: C.muted }}>Wallets: <strong className="text-[#020617]">{wallets.length}</strong></span>
            <span style={{ color: C.muted }}>Packages: <strong className="text-[#020617]">{packages.length}</strong></span>
            <span style={{ color: C.muted }}>Recent transactions: <strong className="text-[#020617]">{transactions.length}</strong></span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <WalletMetricCard
            label="Total balance"
            value={formatCurrency(totals.balance)}
            detail="Current customer wallet liability"
            color={C.protein}
            icon={<Wallet className="h-6 w-6" />}
          />
          <WalletMetricCard
            label="Total credits"
            value={formatCurrency(totals.credits)}
            detail="Lifetime wallet additions"
            color={C.progress}
            icon={<PackagePlus className="h-6 w-6" />}
          />
          <WalletMetricCard
            label="Total debits"
            value={formatCurrency(totals.debits)}
            detail="Wallet spend and deductions"
            color={C.danger}
            icon={<RefreshCw className="h-6 w-6" />}
          />
        </div>

        <Card className="overflow-hidden rounded-3xl border-0 bg-white shadow-[0_18px_44px_rgba(2,6,23,0.06)] ring-1 ring-slate-100">
          <CardHeader className="flex flex-col gap-3 border-b border-slate-100 bg-white px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-xl font-black text-[#020617]">Wallets</CardTitle>
              <p className="mt-1 text-sm font-medium text-[#94A3B8]">{filteredWallets.length} records match current search</p>
            </div>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search customer..."
                className="h-12 rounded-2xl border-0 bg-[#F6F8FB] pl-11 text-sm font-semibold text-[#020617] placeholder:text-[#94A3B8] focus-visible:ring-2 focus-visible:ring-[#22C7A1]/30"
              />
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader className="bg-[#F6F8FB]">
                <TableRow className="border-slate-100 hover:bg-transparent">
                  <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">Customer</TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">Balance</TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">Credits</TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">Debits</TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">Status</TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin" style={{ color: C.progress }} />
                        <p className="text-sm font-semibold text-[#94A3B8]">Loading wallets...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredWallets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F6F8FB]">
                          <Search className="h-6 w-6 text-[#94A3B8]" />
                        </div>
                        <p className="font-bold text-[#020617]">No wallets found</p>
                        <p className="text-sm font-medium text-[#94A3B8]">Try a different customer name, email, or user ID.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredWallets.map((wallet) => (
                    <TableRow key={wallet.id} className="border-slate-100 transition-colors hover:bg-[#F6F8FB]/70">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7C83F6]/10 text-[#7C83F6]">
                            <Wallet className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-black text-[#020617]">{wallet.profile?.full_name || "Unnamed customer"}</div>
                            <div className="text-xs font-medium text-[#94A3B8]">{wallet.profile?.email || wallet.user_id}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-black text-[#020617]">{formatCurrency(Number(wallet.balance || 0))}</TableCell>
                      <TableCell className="font-bold text-[#22C7A1]">{formatCurrency(Number(wallet.total_credits || 0))}</TableCell>
                      <TableCell className="font-bold text-[#FB6B7A]">{formatCurrency(Number(wallet.total_debits || 0))}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs font-bold",
                            wallet.is_active
                              ? "border-[#22C7A1]/20 bg-[#22C7A1]/10 text-[#22C7A1]"
                              : "border-slate-200 bg-[#F6F8FB] text-[#94A3B8]",
                          )}
                        >
                          {wallet.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-medium text-[#94A3B8]">{formatDate(wallet.updated_at)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
          <Card className="rounded-3xl border-0 bg-white shadow-[0_18px_44px_rgba(2,6,23,0.06)] ring-1 ring-slate-100">
            <CardHeader className="border-b border-slate-100 px-6 py-5">
              <CardTitle className="flex items-center gap-2 text-xl font-black text-[#020617]">
                <PackagePlus className="h-5 w-5 text-[#22C7A1]" />
                Top-up packages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              {packages.map((pkg) => (
                <div key={pkg.id} className="flex items-center justify-between rounded-2xl border border-slate-100 bg-[#F6F8FB] p-4">
                  <div>
                    <div className="font-black text-[#020617]">{pkg.name}</div>
                    <div className="text-sm font-semibold text-[#94A3B8]">
                      {formatCurrency(Number(pkg.amount))} + {formatCurrency(Number(pkg.bonus_amount || 0))} bonus
                    </div>
                    {pkg.description && <div className="mt-1 text-xs font-medium text-[#94A3B8]">{pkg.description}</div>}
                  </div>
                  <Switch checked={Boolean(pkg.is_active)} onCheckedChange={() => togglePackage(pkg)} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="overflow-hidden rounded-3xl border-0 bg-white shadow-[0_18px_44px_rgba(2,6,23,0.06)] ring-1 ring-slate-100">
            <CardHeader className="border-b border-slate-100 px-6 py-5">
              <CardTitle className="text-xl font-black text-[#020617]">Latest transactions</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader className="bg-[#F6F8FB]">
                  <TableRow className="border-slate-100 hover:bg-transparent">
                    <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">Type</TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">Amount</TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">Balance after</TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">Description</TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id} className="border-slate-100 transition-colors hover:bg-[#F6F8FB]/70">
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "rounded-full px-2.5 py-1 text-xs font-bold capitalize",
                            transaction.type === "debit"
                              ? "border-[#FB6B7A]/20 bg-[#FB6B7A]/10 text-[#FB6B7A]"
                              : "border-[#22C7A1]/20 bg-[#22C7A1]/10 text-[#22C7A1]",
                          )}
                        >
                          {transaction.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-black text-[#020617]">{formatCurrency(Number(transaction.amount))}</TableCell>
                      <TableCell className="font-bold text-[#7C83F6]">{formatCurrency(Number(transaction.balance_after))}</TableCell>
                      <TableCell className="max-w-[260px] truncate text-sm font-medium text-[#94A3B8]">{transaction.description || "-"}</TableCell>
                      <TableCell className="text-sm font-medium text-[#94A3B8]">{formatDate(transaction.created_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
