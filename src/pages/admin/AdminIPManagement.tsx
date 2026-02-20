import { useState, useEffect } from "react";
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
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
    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({
        title: "Error",
        description: "Failed to fetch IP data: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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
    } catch (error: any) {
      console.error("Error blocking IP:", error);
      toast({
        title: "Error",
        description: "Failed to block IP address: " + error.message,
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
    } catch (error: any) {
      console.error("Error unblocking IP:", error);
      toast({
        title: "Error",
        description: "Failed to unblock IP address: " + error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <AdminLayout title="IP Management" subtitle="Manage blocked IP addresses and view user IP logs">
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">IP Management</h1>
        <p className="text-muted-foreground">
          Manage blocked IP addresses and view user IP logs
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Block New IP */}
        <Card>
          <CardHeader>
            <CardTitle>Block IP Address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ip-address">IP Address</Label>
              <Input
                id="ip-address"
                placeholder="192.168.1.1"
                value={newIP}
                onChange={(e) => setNewIP(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Input
                id="reason"
                placeholder="Suspicious activity"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <Button onClick={handleBlockIP}>Block IP</Button>
          </CardContent>
        </Card>

        {/* Blocked IPs Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Total Blocked IPs:</span>
                <span className="font-semibold">{blockedIPs.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Active Blocks:</span>
                <span className="font-semibold">
                  {blockedIPs.filter(ip => ip.is_active).length}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total IP Logs:</span>
                <span className="font-semibold">{userIPLogs.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Blocked IPs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Blocked IP Addresses</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : blockedIPs.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No blocked IP addresses
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blockedIPs.map((ip) => (
                    <TableRow key={ip.id}>
                      <TableCell className="font-medium">{ip.ip_address}</TableCell>
                      <TableCell>{ip.reason || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={ip.is_active ? "destructive" : "secondary"}>
                          {ip.is_active ? "Blocked" : "Unblocked"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(ip.created_at), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        {ip.is_active && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleUnblockIP(ip.id, ip.ip_address)}
                          >
                            Unblock
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User IP Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>User IP Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : userIPLogs.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No IP logs found
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User ID</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userIPLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="font-mono text-xs">
                          {log.user_id.substring(0, 8)}...
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.ip_address}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {log.city && `${log.city}, `}
                          {log.country_name || log.country_code || "Unknown"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={log.action === "signup" ? "default" : "secondary"}>
                          {log.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(log.created_at), "MMM d, yyyy HH:mm")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </AdminLayout>
  );
}