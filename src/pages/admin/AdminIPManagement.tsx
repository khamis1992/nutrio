import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { Activity, Ban, Globe2, Loader2, ShieldAlert, ShieldCheck, Unlock } from "lucide-react";

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
        setBlockedIPs(blockedData || []);
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
        setUserIPLogs(logData || []);
      }
    } catch (error: unknown) {
      console.error("Error fetching data:", error);
      const message = error instanceof Error ? error.message : "Failed to fetch IP data";
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
      const { error } = await supabase
        .from("blocked_ips")
        .insert({
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
      const message = error instanceof Error ? error.message : "Failed to block IP address";
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
      const message = error instanceof Error ? error.message : "Failed to unblock IP address";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  return (
    <AdminLayout title="IP Management" subtitle="Manage blocked IP addresses and view user IP logs">
    <div className="space-y-4 bg-[#F6F8FB] text-[#020617] sm:space-y-5">
      <section className="overflow-hidden rounded-[28px] border border-[#E2E8F0] bg-white shadow-[0_18px_45px_rgba(2,6,23,0.06)]">
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-[#22C7A1]/15 text-[#047857]">
              <ShieldAlert className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#22C7A1]">
                Access control
              </p>
              <h1 className="mt-1 text-[28px] font-black leading-tight text-[#020617]">
                IP Management
              </h1>
              <p className="mt-1 max-w-lg text-sm font-semibold leading-5 text-[#94A3B8]">
                Review user IP activity, block risky addresses, and monitor active security restrictions.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:min-w-[220px]">
            <div className="rounded-2xl bg-[#F6F8FB] p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#94A3B8]">Active</p>
              <p className="mt-1 text-xl font-black text-[#020617]">{blockedIPs.filter(ip => ip.is_active).length}</p>
            </div>
            <div className="rounded-2xl bg-[#F6F8FB] p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#94A3B8]">Logs</p>
              <p className="mt-1 text-xl font-black text-[#020617]">{userIPLogs.length}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
        {/* Block New IP */}
        <Card className="rounded-[28px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black text-[#020617]">
              <Ban className="h-5 w-5 text-[#FB6B7A]" />
              Block IP Address
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ip-address" className="font-extrabold text-[#020617]">IP Address</Label>
              <Input
                id="ip-address"
                placeholder="192.168.1.1"
                value={newIP}
                onChange={(e) => setNewIP(e.target.value)}
                className="min-h-12 rounded-2xl border-[#E2E8F0] bg-[#F6F8FB] font-bold text-[#020617] placeholder:text-[#94A3B8]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason" className="font-extrabold text-[#020617]">Reason (Optional)</Label>
              <Input
                id="reason"
                placeholder="Suspicious activity"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-12 rounded-2xl border-[#E2E8F0] bg-[#F6F8FB] font-bold text-[#020617] placeholder:text-[#94A3B8]"
              />
            </div>
            <Button onClick={handleBlockIP} className="min-h-12 w-full rounded-2xl bg-[#020617] font-extrabold text-white hover:bg-[#020617]/90">
              <Ban className="mr-2 h-4 w-4" />
              Block IP
            </Button>
          </CardContent>
        </Card>

        {/* Blocked IPs Stats */}
        <Card className="rounded-[28px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-black text-[#020617]">
              <Activity className="h-5 w-5 text-[#22C7A1]" />
              Statistics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              <div className="flex items-center justify-between rounded-2xl bg-[#F6F8FB] p-4">
                <span className="font-bold text-[#64748B]">Total Blocked IPs</span>
                <span className="text-xl font-black text-[#020617]">{blockedIPs.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-[#FB6B7A]/10 p-4">
                <span className="font-bold text-[#BE123C]">Active Blocks</span>
                <span className="text-xl font-black text-[#020617]">
                  {blockedIPs.filter(ip => ip.is_active).length}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-[#38BDF8]/10 p-4">
                <span className="font-bold text-[#0369A1]">Total IP Logs</span>
                <span className="text-xl font-black text-[#020617]">{userIPLogs.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Blocked IPs Table */}
      <Card className="overflow-hidden rounded-[28px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
        <CardHeader className="border-b border-[#E2E8F0]">
          <CardTitle className="flex items-center gap-2 text-xl font-black text-[#020617]">
            <ShieldCheck className="h-5 w-5 text-[#22C7A1]" />
            Blocked IP Addresses
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-[#22C7A1]" />
            </div>
          ) : blockedIPs.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#F6F8FB] text-[#94A3B8]">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <p className="text-lg font-black text-[#020617]">No blocked IP addresses</p>
              <p className="text-sm font-semibold text-[#94A3B8]">New blocks will appear here.</p>
            </div>
          ) : (
            <>
            <div className="grid gap-3 p-4 md:hidden">
              {blockedIPs.map((ip) => (
                <article key={ip.id} className="rounded-[24px] border border-[#E2E8F0] bg-[#F6F8FB] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-lg font-black text-[#020617]">{ip.ip_address}</p>
                      <p className="mt-1 text-sm font-semibold text-[#94A3B8]">{ip.reason || "No reason provided"}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={ip.is_active
                        ? "rounded-full border-[#FB6B7A]/25 bg-[#FB6B7A]/10 px-3 py-1 font-extrabold text-[#BE123C]"
                        : "rounded-full border-[#22C7A1]/25 bg-[#22C7A1]/10 px-3 py-1 font-extrabold text-[#047857]"}
                    >
                      {ip.is_active ? "Blocked" : "Unblocked"}
                    </Badge>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-[#E2E8F0] pt-3">
                    <p className="text-xs font-bold text-[#94A3B8]">
                      {format(new Date(ip.created_at), "MMM d, yyyy HH:mm")}
                    </p>
                    {ip.is_active && (
                      <Button
                        variant="outline"
                        className="h-11 rounded-2xl border-[#22C7A1]/25 bg-white font-extrabold text-[#047857]"
                        onClick={() => handleUnblockIP(ip.id, ip.ip_address)}
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
                <TableHeader>
                  <TableRow className="bg-[#F6F8FB] hover:bg-[#F6F8FB]">
                    <TableHead className="font-extrabold text-[#94A3B8]">IP Address</TableHead>
                    <TableHead className="font-extrabold text-[#94A3B8]">Reason</TableHead>
                    <TableHead className="font-extrabold text-[#94A3B8]">Status</TableHead>
                    <TableHead className="font-extrabold text-[#94A3B8]">Created</TableHead>
                    <TableHead className="font-extrabold text-[#94A3B8]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blockedIPs.map((ip) => (
                    <TableRow key={ip.id} className="border-[#E2E8F0] hover:bg-[#F6F8FB]">
                      <TableCell className="font-mono font-black text-[#020617]">{ip.ip_address}</TableCell>
                      <TableCell className="font-semibold text-[#64748B]">{ip.reason || "-"}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={ip.is_active
                            ? "rounded-full border-[#FB6B7A]/25 bg-[#FB6B7A]/10 px-3 py-1 font-extrabold text-[#BE123C]"
                            : "rounded-full border-[#22C7A1]/25 bg-[#22C7A1]/10 px-3 py-1 font-extrabold text-[#047857]"}
                        >
                          {ip.is_active ? "Blocked" : "Unblocked"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-[#94A3B8]">
                        {format(new Date(ip.created_at), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        {ip.is_active && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-2xl border-[#22C7A1]/25 bg-white font-extrabold text-[#047857]"
                            onClick={() => handleUnblockIP(ip.id, ip.ip_address)}
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
        </CardContent>
      </Card>

      {/* User IP Logs Table */}
      <Card className="overflow-hidden rounded-[28px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
        <CardHeader className="border-b border-[#E2E8F0]">
          <CardTitle className="flex items-center gap-2 text-xl font-black text-[#020617]">
            <Globe2 className="h-5 w-5 text-[#38BDF8]" />
            User IP Logs
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-[#22C7A1]" />
            </div>
          ) : userIPLogs.length === 0 ? (
            <div className="py-12 text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#F6F8FB] text-[#94A3B8]">
                <Globe2 className="h-7 w-7" />
              </div>
              <p className="text-lg font-black text-[#020617]">No IP logs found</p>
              <p className="text-sm font-semibold text-[#94A3B8]">Recent user IP activity will appear here.</p>
            </div>
          ) : (
            <>
            <div className="grid gap-3 p-4 md:hidden">
              {userIPLogs.map((log) => (
                <article key={log.id} className="rounded-[24px] border border-[#E2E8F0] bg-[#F6F8FB] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-lg font-black text-[#020617]">{log.ip_address}</p>
                      <p className="mt-1 text-sm font-semibold text-[#94A3B8]">
                        {log.city && `${log.city}, `}
                        {log.country_name || log.country_code || "Unknown"}
                      </p>
                    </div>
                    <Badge variant="outline" className="rounded-full border-[#38BDF8]/25 bg-[#38BDF8]/10 px-3 py-1 font-extrabold text-[#0369A1]">
                      {log.action}
                    </Badge>
                  </div>
                  <div className="mt-4 border-t border-[#E2E8F0] pt-3">
                    <p className="font-mono text-xs font-bold text-[#94A3B8]">User {log.user_id.substring(0, 8)}...</p>
                    <p className="mt-1 text-xs font-bold text-[#94A3B8]">{format(new Date(log.created_at), "MMM d, yyyy HH:mm")}</p>
                  </div>
                </article>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#F6F8FB] hover:bg-[#F6F8FB]">
                    <TableHead className="font-extrabold text-[#94A3B8]">User ID</TableHead>
                    <TableHead className="font-extrabold text-[#94A3B8]">IP Address</TableHead>
                    <TableHead className="font-extrabold text-[#94A3B8]">Location</TableHead>
                    <TableHead className="font-extrabold text-[#94A3B8]">Action</TableHead>
                    <TableHead className="font-extrabold text-[#94A3B8]">Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userIPLogs.map((log) => (
                    <TableRow key={log.id} className="border-[#E2E8F0] hover:bg-[#F6F8FB]">
                      <TableCell>
                        <div className="font-mono text-xs font-bold text-[#94A3B8]">
                          {log.user_id.substring(0, 8)}...
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm font-black text-[#020617]">
                        {log.ip_address}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-semibold text-[#64748B]">
                          {log.city && `${log.city}, `}
                          {log.country_name || log.country_code || "Unknown"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={log.action === "signup" ? "rounded-full border-[#22C7A1]/25 bg-[#22C7A1]/10 px-3 py-1 font-extrabold text-[#047857]" : "rounded-full border-[#38BDF8]/25 bg-[#38BDF8]/10 px-3 py-1 font-extrabold text-[#0369A1]"}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm font-semibold text-[#94A3B8]">
                        {format(new Date(log.created_at), "MMM d, yyyy HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
    </AdminLayout>
  );
}
