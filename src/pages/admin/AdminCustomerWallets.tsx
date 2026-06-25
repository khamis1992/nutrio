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
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Customer Wallets</h1>
            <p className="text-muted-foreground">Customer balances, transactions, and top-up packages.</p>
          </div>
          <Button onClick={fetchData} variant="outline" disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#020617] text-white">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total balance</p>
                <p className="text-2xl font-bold">{formatCurrency(totals.balance)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Total credits</p>
              <p className="text-2xl font-bold text-[#22C7A1]">{formatCurrency(totals.credits)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">Total debits</p>
              <p className="text-2xl font-bold text-[#FB6B7A]">{formatCurrency(totals.debits)}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Wallets</CardTitle>
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search customer..."
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Credits</TableHead>
                  <TableHead>Debits</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      Loading wallets...
                    </TableCell>
                  </TableRow>
                ) : filteredWallets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      No wallets found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredWallets.map((wallet) => (
                    <TableRow key={wallet.id}>
                      <TableCell>
                        <div className="font-medium">{wallet.profile?.full_name || "Unnamed customer"}</div>
                        <div className="text-xs text-muted-foreground">{wallet.profile?.email || wallet.user_id}</div>
                      </TableCell>
                      <TableCell className="font-semibold">{formatCurrency(Number(wallet.balance || 0))}</TableCell>
                      <TableCell>{formatCurrency(Number(wallet.total_credits || 0))}</TableCell>
                      <TableCell>{formatCurrency(Number(wallet.total_debits || 0))}</TableCell>
                      <TableCell>
                        <Badge variant={wallet.is_active ? "default" : "secondary"}>
                          {wallet.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(wallet.updated_at)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PackagePlus className="h-5 w-5" />
                Top-up packages
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {packages.map((pkg) => (
                <div key={pkg.id} className="flex items-center justify-between rounded-2xl border bg-muted/20 p-4">
                  <div>
                    <div className="font-semibold">{pkg.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatCurrency(Number(pkg.amount))} + {formatCurrency(Number(pkg.bonus_amount || 0))} bonus
                    </div>
                    {pkg.description && <div className="mt-1 text-xs text-muted-foreground">{pkg.description}</div>}
                  </div>
                  <Switch checked={Boolean(pkg.is_active)} onCheckedChange={() => togglePackage(pkg)} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Latest transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Balance after</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={cn(
                            transaction.type === "debit" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700",
                          )}
                        >
                          {transaction.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(Number(transaction.amount))}</TableCell>
                      <TableCell>{formatCurrency(Number(transaction.balance_after))}</TableCell>
                      <TableCell className="max-w-[260px] truncate">{transaction.description || "-"}</TableCell>
                      <TableCell>{formatDate(transaction.created_at)}</TableCell>
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
