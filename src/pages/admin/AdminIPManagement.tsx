import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import {
  AdminAlertDialogContent,
  AdminPanel,
  AdminWorkbenchHeader,
} from "@/components/admin/AdminPrimitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import {
  Activity,
  Ban,
  Globe2,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Unlock,
} from "lucide-react";

interface BlockedIP {
  id: string;
  ip_address: string;
  reason: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface UserIPLog {
  id: string;
  user_id: string;
  ip_address: string;
  country_code: string | null;
  country_name: string | null;
  city: string | null;
  action: string;
  user_agent: string | null;
  created_at: string;
}

export default function AdminIPManagement() {
  const [blockedIPs, setBlockedIPs] = useState<BlockedIP[]>([]);
  const [userIPLogs, setUserIPLogs] = useState<UserIPLog[]>([]);
  const [newIP, setNewIP] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [pendingUnblock, setPendingUnblock] = useState<BlockedIP | null>(null);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);

    try {
      // Fetch blocked IPs
      const { data: blockedData, error: blockedError } = await supabase
        .from("blocked_ips")
        .select("*")
        .order("created_at", { ascending: false });

      if (blockedError) {
        console.error("Error fetching blocked IPs:", blockedError);
        toast({
          title: "Error",
          description: "Failed to fetch blocked IPs: " + blockedError.message,
          variant: "destructive",
        });
      } else {
        setBlockedIPs(
          (blockedData || []).map((row) => ({
            id: row.id,
            ip_address: String(row.ip_address || ""),
            reason: row.reason,
            is_active: row.is_active ?? false,
            created_at: row.created_at || new Date(0).toISOString(),
            updated_at: row.updated_at || new Date(0).toISOString(),
          })),
        );
      }

      // Fetch user IP logs
      const { data: logData, error: logError } = await supabase
        .from("user_ip_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (logError) {
        console.error("Error fetching IP logs:", logError);
        toast({
          title: "Error",
          description: "Failed to fetch IP logs: " + logError.message,
          variant: "destructive",
        });
      } else {
        setUserIPLogs(
          (logData || []).map((row) => ({
            id: row.id,
            user_id: row.user_id || "",
            ip_address: String(row.ip_address || ""),
            country_code: row.country_code,
            country_name: row.country_name,
            city: row.city,
            action: row.action,
            user_agent: row.user_agent,
            created_at: row.created_at || new Date(0).toISOString(),
          })),
        );
      }
    } catch (error: unknown) {
      console.error("Error fetching data:", error);
      const message =
        error instanceof Error ? error.message : "Failed to fetch IP data";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBlockIP = async () => {
    if (!newIP) {
      toast({
        title: "Error",
        description: "Please enter an IP address",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("blocked_ips").insert({
        ip_address: newIP,
        reason: reason || null,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `IP ${newIP} has been blocked`,
      });

      setNewIP("");
      setReason("");
      fetchData();
    } catch (error: unknown) {
      console.error("Error blocking IP:", error);
      const message =
        error instanceof Error ? error.message : "Failed to block IP address";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleUnblockIP = async (id: string, ipAddress: string) => {
    try {
      const { error } = await supabase
        .from("blocked_ips")
        .update({ is_active: false })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `IP ${ipAddress} has been unblocked`,
      });

      fetchData();
    } catch (error: unknown) {
      console.error("Error unblocking IP:", error);
      const message =
        error instanceof Error ? error.message : "Failed to unblock IP address";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const confirmUnblockIP = async () => {
    if (!pendingUnblock) return;
    const ip = pendingUnblock;
    setPendingUnblock(null);
    await handleUnblockIP(ip.id, ip.ip_address);
  };

  return (
    <AdminLayout
      title="IP Management"
      subtitle="Manage blocked IP addresses and view user IP logs"
    >
      <div className="space-y-4 bg-[#F6F8FB] text-[#020617] sm:space-y-5">
        <AdminWorkbenchHeader
          eyebrow="Access control"
          title="IP security workbench"
          icon={ShieldAlert}
          accent="#22C7A1"
          description="Review user IP activity, block risky addresses, and monitor active security restrictions."
          meta={[
            {
              label: "Active blocks",
              value: blockedIPs.filter((ip) => ip.is_active).length,
            },
            { label: "IP logs", value: userIPLogs.length },
            { label: "Total blocked", value: blockedIPs.length },
          ]}
        />

        <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
          {/* Block New IP */}
          <AdminPanel>
            <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
              <h3 className="flex items-center gap-2 text-xl font-black text-[#020617]">
                <Ban className="h-5 w-5 text-[#FB6B7A]" />
                Block IP Address
              </h3>
            </div>
            <div className="space-y-4 p-5">
              <div className="space-y-2">
                <Label
                  htmlFor="ip-address"
                  className="font-extrabold text-[#020617]"
                >
                  IP Address
                </Label>
                <Input
                  id="ip-address"
                  placeholder="192.168.1.1"
                  value={newIP}
                  onChange={(e) => setNewIP(e.target.value)}
                  className="min-h-12 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-bold text-[#020617] placeholder:text-[#94A3B8]"
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="reason"
                  className="font-extrabold text-[#020617]"
                >
                  Reason (Optional)
                </Label>
                <Input
                  id="reason"
                  placeholder="Suspicious activity"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="min-h-12 rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] font-bold text-[#020617] placeholder:text-[#94A3B8]"
                />
              </div>
              <Button
                onClick={handleBlockIP}
                variant="outline"
                className="min-h-12 w-full rounded-2xl border-[#22C7A1]/30 bg-[#22C7A1]/10 font-extrabold text-[#020617] hover:bg-[#22C7A1]/15"
              >
                <Ban className="mr-2 h-4 w-4" />
                Block IP
              </Button>
            </div>
          </AdminPanel>

          {/* Blocked IPs Stats */}
          <AdminPanel>
            <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
              <h3 className="flex items-center gap-2 text-xl font-black text-[#020617]">
                <Activity className="h-5 w-5 text-[#22C7A1]" />
                Statistics
              </h3>
            </div>
            <div className="p-5">
              <div className="grid gap-3">
                <div className="flex items-center justify-between rounded-2xl bg-[#F6F8FB] p-4">
                  <span className="font-bold text-[#94A3B8]">
                    Total Blocked IPs
                  </span>
                  <span className="text-xl font-black text-[#020617]">
                    {blockedIPs.length}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-[#FB6B7A]/10 p-4">
                  <span className="font-bold text-[#FB6B7A]">
                    Active Blocks
                  </span>
                  <span className="text-xl font-black text-[#020617]">
                    {blockedIPs.filter((ip) => ip.is_active).length}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-[#38BDF8]/10 p-4">
                  <span className="font-bold text-[#38BDF8]">
                    Total IP Logs
                  </span>
                  <span className="text-xl font-black text-[#020617]">
                    {userIPLogs.length}
                  </span>
                </div>
              </div>
            </div>
          </AdminPanel>
        </div>

        {/* Blocked IPs Table */}
        <AdminPanel>
          <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
            <h3 className="flex items-center gap-2 text-xl font-black text-[#020617]">
              <ShieldCheck className="h-5 w-5 text-[#22C7A1]" />
              Blocked IP Addresses
            </h3>
          </div>
          <div className="p-0">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-[#22C7A1]" />
              </div>
            ) : blockedIPs.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#F6F8FB] text-[#94A3B8] ring-1 ring-[#E5EAF1]">
                  <ShieldCheck className="h-7 w-7" />
                </div>
                <p className="text-lg font-black text-[#020617]">
                  No blocked IP addresses
                </p>
                <p className="text-sm font-semibold text-[#94A3B8]">
                  New blocks will appear here.
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-3 p-4 md:hidden">
                  {blockedIPs.map((ip) => (
                    <article
                      key={ip.id}
                      className="rounded-[24px] border border-[#E5EAF1] bg-[#F6F8FB] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-lg font-black text-[#020617]">
                            {ip.ip_address}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#94A3B8]">
                            {ip.reason || "No reason provided"}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            ip.is_active
                              ? "rounded-full border-[#FB6B7A]/25 bg-[#FB6B7A]/10 px-3 py-1 font-extrabold text-[#FB6B7A]"
                              : "rounded-full border-[#22C7A1]/25 bg-[#22C7A1]/10 px-3 py-1 font-extrabold text-[#22C7A1]"
                          }
                        >
                          {ip.is_active ? "Blocked" : "Unblocked"}
                        </Badge>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-[#E5EAF1] pt-3">
                        <p className="text-xs font-bold text-[#94A3B8]">
                          {format(new Date(ip.created_at), "MMM d, yyyy HH:mm")}
                        </p>
                        {ip.is_active && (
                          <Button
                            variant="outline"
                            className="h-11 rounded-2xl border-[#22C7A1]/25 bg-white font-extrabold text-[#22C7A1]"
                            onClick={() => setPendingUnblock(ip)}
                          >
                            <Unlock className="mr-2 h-4 w-4" />
                            Unblock
                          </Button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <Table>
                    <TableHeader className="bg-[#F6F8FB]">
                      <TableRow className="border-[#E5EAF1] hover:bg-transparent">
                        <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          IP Address
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Reason
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Status
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Created
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {blockedIPs.map((ip) => (
                        <TableRow
                          key={ip.id}
                          className="border-[#E5EAF1] transition-colors hover:bg-[#F6F8FB]/70"
                        >
                          <TableCell className="font-mono font-black text-[#020617]">
                            {ip.ip_address}
                          </TableCell>
                          <TableCell className="font-semibold text-[#94A3B8]">
                            {ip.reason || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                ip.is_active
                                  ? "rounded-full border-[#FB6B7A]/25 bg-[#FB6B7A]/10 px-3 py-1 font-extrabold text-[#FB6B7A]"
                                  : "rounded-full border-[#22C7A1]/25 bg-[#22C7A1]/10 px-3 py-1 font-extrabold text-[#22C7A1]"
                              }
                            >
                              {ip.is_active ? "Blocked" : "Unblocked"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold text-[#94A3B8]">
                            {format(
                              new Date(ip.created_at),
                              "MMM d, yyyy HH:mm",
                            )}
                          </TableCell>
                          <TableCell>
                            {ip.is_active && (
                              <Button
                                variant="outline"
                                className="min-h-11 rounded-2xl border-[#22C7A1]/25 bg-white px-4 font-extrabold text-[#22C7A1]"
                                onClick={() => setPendingUnblock(ip)}
                              >
                                <Unlock className="mr-2 h-4 w-4" />
                                Unblock
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        </AdminPanel>

        {/* User IP Logs Table */}
        <AdminPanel>
          <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
            <h3 className="flex items-center gap-2 text-xl font-black text-[#020617]">
              <Globe2 className="h-5 w-5 text-[#38BDF8]" />
              User IP Logs
            </h3>
          </div>
          <div className="p-0">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-[#22C7A1]" />
              </div>
            ) : userIPLogs.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-[24px] bg-[#F6F8FB] text-[#94A3B8] ring-1 ring-[#E5EAF1]">
                  <Globe2 className="h-7 w-7" />
                </div>
                <p className="text-lg font-black text-[#020617]">
                  No IP logs found
                </p>
                <p className="text-sm font-semibold text-[#94A3B8]">
                  Recent user IP activity will appear here.
                </p>
              </div>
            ) : (
              <>
                <div className="grid gap-3 p-4 md:hidden">
                  {userIPLogs.map((log) => (
                    <article
                      key={log.id}
                      className="rounded-[24px] border border-[#E5EAF1] bg-[#F6F8FB] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-mono text-lg font-black text-[#020617]">
                            {log.ip_address}
                          </p>
                          <p className="mt-1 text-sm font-semibold text-[#94A3B8]">
                            {log.city && `${log.city}, `}
                            {log.country_name || log.country_code || "Unknown"}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="rounded-full border-[#38BDF8]/25 bg-[#38BDF8]/10 px-3 py-1 font-extrabold text-[#38BDF8]"
                        >
                          {log.action}
                        </Badge>
                      </div>
                      <div className="mt-4 border-t border-[#E5EAF1] pt-3">
                        <p className="font-mono text-xs font-bold text-[#94A3B8]">
                          User {log.user_id.substring(0, 8)}...
                        </p>
                        <p className="mt-1 text-xs font-bold text-[#94A3B8]">
                          {format(
                            new Date(log.created_at),
                            "MMM d, yyyy HH:mm",
                          )}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <Table>
                    <TableHeader className="bg-[#F6F8FB]">
                      <TableRow className="border-[#E5EAF1] hover:bg-transparent">
                        <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          User ID
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          IP Address
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Location
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Action
                        </TableHead>
                        <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                          Date
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userIPLogs.map((log) => (
                        <TableRow
                          key={log.id}
                          className="border-[#E5EAF1] transition-colors hover:bg-[#F6F8FB]/70"
                        >
                          <TableCell>
                            <div className="font-mono text-xs font-bold text-[#94A3B8]">
                              {log.user_id.substring(0, 8)}...
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm font-black text-[#020617]">
                            {log.ip_address}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm font-semibold text-[#94A3B8]">
                              {log.city && `${log.city}, `}
                              {log.country_name ||
                                log.country_code ||
                                "Unknown"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                log.action === "signup"
                                  ? "rounded-full border-[#22C7A1]/25 bg-[#22C7A1]/10 px-3 py-1 font-extrabold text-[#22C7A1]"
                                  : "rounded-full border-[#38BDF8]/25 bg-[#38BDF8]/10 px-3 py-1 font-extrabold text-[#38BDF8]"
                              }
                            >
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm font-semibold text-[#94A3B8]">
                            {format(
                              new Date(log.created_at),
                              "MMM d, yyyy HH:mm",
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        </AdminPanel>

        <AlertDialog
          open={!!pendingUnblock}
          onOpenChange={(open) => !open && setPendingUnblock(null)}
        >
          <AdminAlertDialogContent>
            <AlertDialogHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4 text-left">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#22C7A1]/10 text-[#22C7A1]">
                  <Unlock className="h-5 w-5" />
                </span>
                <div>
                  <AlertDialogTitle className="text-xl font-black text-[#020617]">
                    Unblock this IP?
                  </AlertDialogTitle>
                  <AlertDialogDescription className="mt-1 font-semibold leading-6 text-[#94A3B8]">
                    {pendingUnblock?.ip_address} will be allowed to access the
                    platform again.
                  </AlertDialogDescription>
                </div>
              </div>
            </AlertDialogHeader>
            <div className="px-5 py-4">
              <div className="rounded-[20px] border border-[#22C7A1]/20 bg-[#22C7A1]/10 p-4">
                <p className="text-sm font-black text-[#020617]">
                  Security review recommended
                </p>
                <p className="mt-1 text-sm font-semibold leading-6 text-[#94A3B8]">
                  Only unblock addresses after confirming the block is no longer
                  needed.
                </p>
              </div>
            </div>
            <AlertDialogFooter className="gap-2 sm:gap-3 border-t border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
              <AlertDialogCancel className="min-h-[44px] rounded-2xl border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-white">
                Keep blocked
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmUnblockIP}
                className="min-h-[44px] rounded-2xl bg-[#22C7A1] font-black text-white hover:bg-[#22C7A1]/90"
              >
                Unblock IP
              </AlertDialogAction>
            </AlertDialogFooter>
          </AdminAlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
}
