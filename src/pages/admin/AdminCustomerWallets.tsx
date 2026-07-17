import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import {
  AdminEmptyState,
  AdminFilterBar,
  AdminKpiStrip,
  AdminListSkeleton,
  AdminPanel,
  AdminPanelHeader,
  AdminWorkbenchHeader,
} from "@/components/admin/AdminPrimitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
type TransactionRow =
  Database["public"]["Tables"]["wallet_transactions"]["Row"];
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

export default function AdminCustomerWallets() {
  const [wallets, setWallets] = useState<WalletWithProfile[]>([]);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        { data: walletRows, error: walletError },
        { data: transactionRows, error: transactionError },
        { data: packageRows, error: packageError },
      ] = await Promise.all([
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

      const userIds = Array.from(
        new Set((walletRows || []).map((wallet) => wallet.user_id)),
      );
      let profilesByUserId = new Map<string, ProfileRow>();

      if (userIds.length > 0) {
        const { data: profileRows, error: profileError } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", userIds);

        if (profileError) throw profileError;
        profilesByUserId = new Map(
          (profileRows || []).map((profile) => [profile.user_id, profile]),
        );
      }

      setWallets(
        (walletRows || []).map((wallet) => ({
          ...wallet,
          profile: profilesByUserId.get(wallet.user_id),
        })),
      );
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
      ]
        .join(" ")
        .toLowerCase();
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
    setPackages((current) =>
      current.map((item) =>
        item.id === pkg.id ? { ...item, is_active: nextActive } : item,
      ),
    );

    const { error } = await supabase
      .from("wallet_topup_packages")
      .update({ is_active: nextActive, updated_at: new Date().toISOString() })
      .eq("id", pkg.id);

    if (error) {
      setPackages((current) =>
        current.map((item) =>
          item.id === pkg.id ? { ...item, is_active: pkg.is_active } : item,
        ),
      );
      toast.error("Failed to update package");
      return;
    }

    toast.success(nextActive ? "Package enabled" : "Package disabled");
  };

  return (
    <AdminLayout
      title="Customer Wallets"
      subtitle="Monitor balances, transactions, and top-up packages"
    >
      <div className="space-y-6 bg-[#F6F8FB] p-1 text-[#020617]">
        <AdminWorkbenchHeader
          eyebrow="Finance control"
          title="Customer wallet ledger"
          icon={Wallet}
          accent="#22C7A1"
          description="Monitor balances, audit wallet transactions, and manage customer top-up packages from one finance workflow."
          meta={[
            { label: "Wallets", value: wallets.length },
            { label: "Packages", value: packages.length },
            { label: "Recent transactions", value: transactions.length },
          ]}
          actions={
            <Button
              onClick={fetchData}
              variant="outline"
              disabled={loading}
              className="h-11 rounded-full border-[#E5EAF1] bg-white px-4 font-black text-[#020617] shadow-[0_10px_24px_rgba(2,6,23,0.045)] hover:bg-[#F6F8FB]"
            >
              {loading ? (
                <Loader2
                  className="mr-2 h-4 w-4 animate-spin"
                  style={{ color: C.progress }}
                />
              ) : (
                <RefreshCw
                  className="mr-2 h-4 w-4"
                  style={{ color: C.progress }}
                />
              )}
              Refresh
            </Button>
          }
        />

        <AdminKpiStrip
          className="md:grid-cols-3 2xl:grid-cols-3"
          items={[
            {
              label: "Total balance",
              value: formatCurrency(totals.balance),
              helper: "Current liability",
              accent: "#7C83F6",
              icon: Wallet,
            },
            {
              label: "Total credits",
              value: formatCurrency(totals.credits),
              helper: "Lifetime additions",
              accent: "#22C7A1",
              icon: PackagePlus,
            },
            {
              label: "Total debits",
              value: formatCurrency(totals.debits),
              helper: "Spend and deductions",
              accent: "#FB6B7A",
              icon: RefreshCw,
            },
          ]}
        />

        <AdminFilterBar title="Wallet search">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search customer..."
              className="h-12 rounded-2xl border-0 bg-[#F6F8FB] pl-11 text-sm font-semibold text-[#020617] placeholder:text-[#94A3B8] focus-visible:ring-2 focus-visible:ring-[#22C7A1]/30"
            />
          </div>
        </AdminFilterBar>

        <AdminPanel>
          <AdminPanelHeader
            eyebrow="Ledger"
            title="Wallets"
            description={`${filteredWallets.length} records match current search`}
            className="bg-[#F6F8FB]"
          />
          <div className="p-0">
            <div className="grid gap-3 p-4 md:hidden">
              {loading ? (
                <AdminListSkeleton rows={4} className="p-0" />
              ) : filteredWallets.length === 0 ? (
                <AdminEmptyState
                  icon={Search}
                  title="No wallets found"
                  description="Try a different customer name, email, or user ID."
                  className="rounded-[24px] border border-[#E5EAF1] bg-[#F6F8FB]"
                />
              ) : (
                filteredWallets.map((wallet) => (
                  <div
                    key={wallet.id}
                    className="rounded-[24px] border border-[#E5EAF1] bg-white p-4 shadow-[0_12px_30px_rgba(2,6,23,0.05)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#7C83F6]/10 text-[#7C83F6]">
                          <Wallet className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-base font-black text-[#020617]">
                            {wallet.profile?.full_name || "Unnamed customer"}
                          </p>
                          <p className="mt-1 truncate text-xs font-medium text-[#94A3B8]">
                            {wallet.profile?.email || wallet.user_id}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          "shrink-0 rounded-full px-2.5 py-1 text-xs font-bold",
                          wallet.is_active
                            ? "border-[#22C7A1]/20 bg-[#22C7A1]/10 text-[#22C7A1]"
                            : "border-[#E5EAF1] bg-[#F6F8FB] text-[#94A3B8]",
                        )}
                      >
                        {wallet.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="mt-4 rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                        Balance
                      </p>
                      <p className="mt-1 text-2xl font-black text-[#020617]">
                        {formatCurrency(Number(wallet.balance || 0))}
                      </p>
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div className="rounded-2xl bg-[#22C7A1]/10 p-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#22C7A1]">
                          Credits
                        </p>
                        <p className="mt-1 text-sm font-black text-[#020617]">
                          {formatCurrency(Number(wallet.total_credits || 0))}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-[#FB6B7A]/10 p-3">
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#FB6B7A]">
                          Debits
                        </p>
                        <p className="mt-1 text-sm font-black text-[#020617]">
                          {formatCurrency(Number(wallet.total_debits || 0))}
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-xs font-semibold text-[#94A3B8]">
                      Updated {formatDate(wallet.updated_at)}
                    </p>
                  </div>
                ))
              )}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader className="bg-[#F6F8FB]">
                  <TableRow className="border-[#E5EAF1] hover:bg-transparent">
                    <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                      Customer
                    </TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                      Balance
                    </TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                      Credits
                    </TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                      Debits
                    </TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                      Status
                    </TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                      Updated
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center">
                        <AdminListSkeleton rows={4} />
                      </TableCell>
                    </TableRow>
                  ) : filteredWallets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-12 text-center">
                        <AdminEmptyState
                          icon={Search}
                          title="No wallets found"
                          description="Try a different customer name, email, or user ID."
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredWallets.map((wallet) => (
                      <TableRow
                        key={wallet.id}
                        className="border-[#E5EAF1] transition-colors hover:bg-[#F6F8FB]/70"
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#7C83F6]/10 text-[#7C83F6]">
                              <Wallet className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="font-black text-[#020617]">
                                {wallet.profile?.full_name ||
                                  "Unnamed customer"}
                              </div>
                              <div className="text-xs font-medium text-[#94A3B8]">
                                {wallet.profile?.email || wallet.user_id}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-black text-[#020617]">
                          {formatCurrency(Number(wallet.balance || 0))}
                        </TableCell>
                        <TableCell className="font-bold text-[#22C7A1]">
                          {formatCurrency(Number(wallet.total_credits || 0))}
                        </TableCell>
                        <TableCell className="font-bold text-[#FB6B7A]">
                          {formatCurrency(Number(wallet.total_debits || 0))}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-full px-2.5 py-1 text-xs font-bold",
                              wallet.is_active
                                ? "border-[#22C7A1]/20 bg-[#22C7A1]/10 text-[#22C7A1]"
                                : "border-[#E5EAF1] bg-[#F6F8FB] text-[#94A3B8]",
                            )}
                          >
                            {wallet.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-medium text-[#94A3B8]">
                          {formatDate(wallet.updated_at)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </AdminPanel>

        <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
          <AdminPanel>
            <AdminPanelHeader
              eyebrow="Packages"
              title="Top-up packages"
              className="bg-[#F6F8FB]"
              description={
                <span className="inline-flex items-center gap-2">
                  <PackagePlus className="h-5 w-5 text-[#22C7A1]" />
                  Manage customer wallet add-ons
                </span>
              }
            />
            <div className="space-y-3 p-5">
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  className="flex items-center justify-between rounded-[22px] border border-[#E5EAF1] bg-[#F6F8FB] p-4 transition hover:bg-white hover:shadow-[0_10px_26px_rgba(2,6,23,0.045)]"
                >
                  <div>
                    <div className="font-black text-[#020617]">{pkg.name}</div>
                    <div className="text-sm font-semibold text-[#94A3B8]">
                      {formatCurrency(Number(pkg.amount))} +{" "}
                      {formatCurrency(Number(pkg.bonus_amount || 0))} bonus
                    </div>
                    {pkg.description && (
                      <div className="mt-1 text-xs font-medium text-[#94A3B8]">
                        {pkg.description}
                      </div>
                    )}
                  </div>
                  <Switch
                    checked={Boolean(pkg.is_active)}
                    onCheckedChange={() => togglePackage(pkg)}
                  />
                </div>
              ))}
            </div>
          </AdminPanel>

          <AdminPanel>
            <AdminPanelHeader
              eyebrow="Audit trail"
              title="Latest transactions"
              description={`${transactions.length} recent wallet movements`}
              className="bg-[#F6F8FB]"
            />
            <div className="p-0">
              <div className="grid gap-3 p-4 md:hidden">
                {transactions.length === 0 ? (
                  <AdminEmptyState
                    icon={RefreshCw}
                    title="No transactions yet"
                    description="Wallet credits and debits will appear here as soon as they are created."
                    className="rounded-[24px] border border-[#E5EAF1] bg-[#F6F8FB]"
                  />
                ) : (
                  transactions.map((transaction) => (
                    <div
                      key={transaction.id}
                      className="rounded-[22px] border border-[#E5EAF1] bg-white p-4 shadow-[0_10px_26px_rgba(2,6,23,0.04)]"
                    >
                      <div className="flex items-start justify-between gap-3">
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
                        <span className="text-xs font-semibold text-[#94A3B8]">
                          {formatDate(transaction.created_at)}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="rounded-2xl bg-[#F6F8FB] p-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                            Amount
                          </p>
                          <p className="mt-1 text-lg font-black text-[#020617]">
                            {formatCurrency(Number(transaction.amount))}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-[#F6F8FB] p-3">
                          <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                            Balance
                          </p>
                          <p className="mt-1 text-lg font-black text-[#7C83F6]">
                            {formatCurrency(Number(transaction.balance_after))}
                          </p>
                        </div>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm font-medium text-[#94A3B8]">
                        {transaction.description || "-"}
                      </p>
                    </div>
                  ))
                )}
              </div>
              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader className="bg-[#F6F8FB]">
                    <TableRow className="border-[#E5EAF1] hover:bg-transparent">
                      <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                        Type
                      </TableHead>
                      <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                        Amount
                      </TableHead>
                      <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                        Balance after
                      </TableHead>
                      <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                        Description
                      </TableHead>
                      <TableHead className="text-xs font-black uppercase tracking-[0.12em] text-[#94A3B8]">
                        Date
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => (
                      <TableRow
                        key={transaction.id}
                        className="border-[#E5EAF1] transition-colors hover:bg-[#F6F8FB]/70"
                      >
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
                        <TableCell className="font-black text-[#020617]">
                          {formatCurrency(Number(transaction.amount))}
                        </TableCell>
                        <TableCell className="font-bold text-[#7C83F6]">
                          {formatCurrency(Number(transaction.balance_after))}
                        </TableCell>
                        <TableCell className="max-w-[260px] truncate text-sm font-medium text-[#94A3B8]">
                          {transaction.description || "-"}
                        </TableCell>
                        <TableCell className="text-sm font-medium text-[#94A3B8]">
                          {formatDate(transaction.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </AdminPanel>
        </div>
      </div>
    </AdminLayout>
  );
}
