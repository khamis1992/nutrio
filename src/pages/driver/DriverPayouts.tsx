import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Wallet, ArrowDownLeft, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";


interface Payout {
  id: string;
  amount: number;
  status: string;
  period_start: string;
  period_end: string;
  processed_at: string | null;
  payout_method: string | null;
  created_at: string;
}

export default function DriverPayouts() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [driverId, setDriverId] = useState<string | null>(null);
  const [balance, setBalance] = useState(0);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [minPayoutThreshold, setMinPayoutThreshold] = useState(10);
  const [bankDetails, setBankDetails] = useState({
    bankName: "",
    accountNumber: "",
    accountName: "",
  });

  useEffect(() => {
    if (user) {
      fetchDriverData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (driverId) {
      fetchPayouts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  const fetchDriverData = async () => {
    if (!user) return;

    try {
      // Fetch driver data and settings in parallel
      const [{ data: driver, error: driverError }, { data: settings }] = await Promise.all([
        supabase
          .from("drivers")
          .select("id, wallet_balance")
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("platform_settings")
          .select("value")
          .eq("key", "driver_settings")
          .single(),
      ]);

      if (driverError) throw driverError;
      setDriverId(driver.id);
      setBalance(driver.wallet_balance || 0);

      // Parse minimum payout threshold from settings
      if (settings?.value) {
        const driverSettings = settings.value as Record<string, number>;
        setMinPayoutThreshold(driverSettings.minimum_payout_threshold || 10);
      }
    } catch (error) {
      console.error("Error fetching driver data:", error);
      setLoading(false);
    }
  };

  const fetchPayouts = async () => {
    if (!driverId) return;

    try {
      const { data, error } = await supabase
        .from("driver_payouts")
        .select("*")
        .eq("driver_id", driverId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPayouts((data || []) as Payout[]);
    } catch (error) {
      console.error("Error fetching payouts:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestPayout = async () => {
    if (!driverId || balance < minPayoutThreshold) {
      toast({
        title: "Minimum balance required",
        description: `You need at least QAR ${minPayoutThreshold} to request a payout`,
        variant: "destructive",
      });
      return;
    }

    if (!bankDetails.bankName || !bankDetails.accountNumber || !bankDetails.accountName) {
      toast({
        title: "Bank details required",
        description: "Please fill in your bank account details",
        variant: "destructive",
      });
      return;
    }

    setRequesting(true);

    try {
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const { error } = await supabase.from("driver_payouts").insert({
        driver_id: driverId,
        amount: balance,
        period_start: periodStart.toISOString().split("T")[0],
        period_end: now.toISOString().split("T")[0],
        status: "pending",
        payout_method: "bank_transfer",
        payout_details: bankDetails,
      });

      if (error) throw error;

      await supabase
        .from("drivers")
        .update({ wallet_balance: 0 })
        .eq("id", driverId);

      setBalance(0);
      fetchPayouts();

      toast({
        title: "Payout requested!",
        description: "Your payout request has been submitted for processing.",
      });
    } catch (error) {
      console.error("Error requesting payout:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to request payout",
        variant: "destructive",
      });
    } finally {
      setRequesting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-amber-600" />;
      case "processing":
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
      case "paid":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      default:
        return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-500/10 text-amber-600 border-amber-500/20";
      case "processing":
        return "bg-blue-500/10 text-blue-600 border-blue-500/20";
      case "paid":
        return "bg-green-500/10 text-green-600 border-green-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
        <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
          <CardContent className="py-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-100">Available Balance</span>
              <Wallet className="h-5 w-5 text-green-100" />
            </div>
            <p className="text-4xl font-bold">QAR {balance.toFixed(2)}</p>
            {balance < minPayoutThreshold && (
              <p className="text-sm text-green-100 mt-2">
                Minimum QAR {minPayoutThreshold} required for payout
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Bank Account Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="bankName">Bank Name</Label>
              <Input
                id="bankName"
                placeholder="Enter bank name"
                value={bankDetails.bankName}
                onChange={(e) => setBankDetails({ ...bankDetails, bankName: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountNumber">Account Number</Label>
              <Input
                id="accountNumber"
                placeholder="Enter account number"
                value={bankDetails.accountNumber}
                onChange={(e) => setBankDetails({ ...bankDetails, accountNumber: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accountName">Account Name</Label>
              <Input
                id="accountName"
                placeholder="Enter account holder name"
                value={bankDetails.accountName}
                onChange={(e) => setBankDetails({ ...bankDetails, accountName: e.target.value })}
              />
            </div>

            <Button
              className="w-full mt-4 bg-green-600 hover:bg-green-700"
              onClick={handleRequestPayout}
              disabled={requesting || balance < minPayoutThreshold}
            >
              {requesting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Request Payout
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Payout History</CardTitle>
          </CardHeader>
          <CardContent>
            {payouts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No payout history yet
              </p>
            ) : (
              <div className="space-y-3">
                {payouts.map((payout) => (
                  <div
                    key={payout.id}
                    className="flex items-center justify-between py-3 border-b last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <ArrowDownLeft className="h-5 w-5 text-green-600" />
                      </div>
                      <div>
                        <p className="font-medium">QAR {payout.amount.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(payout.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={getStatusColor(payout.status)}>
                      {getStatusIcon(payout.status)}
                      <span className="ml-1 capitalize">{payout.status}</span>
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
    </div>
  );
}
