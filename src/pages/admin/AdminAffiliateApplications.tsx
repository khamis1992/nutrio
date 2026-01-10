import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Users,
  Search,
  Check,
  X,
  Clock,
  Loader2,
  User,
  Calendar,
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Application {
  id: string;
  user_id: string;
  status: "pending" | "approved" | "rejected";
  application_note: string | null;
  rejection_reason: string | null;
  applied_at: string;
  reviewed_at: string | null;
  profile: {
    full_name: string | null;
    email?: string;
  } | null;
}

export default function AdminAffiliateApplications() {
  const { toast } = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTab, setSelectedTab] = useState("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      // Fetch applications
      const { data: appsData, error: appsError } = await supabase
        .from("affiliate_applications")
        .select("*")
        .order("applied_at", { ascending: false });

      if (appsError) throw appsError;

      // Fetch profiles for these users
      const userIds = (appsData || []).map(app => app.user_id);
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      // Combine the data
      const applicationsWithProfiles = (appsData || []).map((app) => {
        const profile = profilesData?.find(p => p.id === app.user_id);
        return {
          ...app,
          profile: {
            full_name: profile?.full_name || null,
          },
        };
      });

      setApplications(applicationsWithProfiles);
    } catch (err) {
      console.error("Error fetching applications:", err);
      toast({
        title: "Error",
        description: "Failed to load applications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (application: Application) => {
    setProcessingId(application.id);
    try {
      const { error } = await supabase
        .from("affiliate_applications")
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", application.id);

      if (error) throw error;

      // Generate referral code for the user if they don't have one
      const referralCode = `REF${application.user_id.slice(0, 6).toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}`;
      
      await supabase
        .from("profiles")
        .update({ referral_code: referralCode })
        .eq("id", application.user_id)
        .is("referral_code", null);

      // Send approval email notification
      try {
        await supabase.functions.invoke("send-affiliate-status-notification", {
          body: {
            user_id: application.user_id,
            status: "approved",
          },
        });
      } catch (emailError) {
        console.error("Error sending approval email:", emailError);
        // Don't fail the approval if email fails
      }

      toast({
        title: "Application Approved",
        description: "The user has been approved as an affiliate and notified via email.",
      });

      fetchApplications();
    } catch (err) {
      console.error("Error approving application:", err);
      toast({
        title: "Error",
        description: "Failed to approve application",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!selectedApplication) return;

    setProcessingId(selectedApplication.id);
    try {
      const { error } = await supabase
        .from("affiliate_applications")
        .update({
          status: "rejected",
          rejection_reason: rejectionReason || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", selectedApplication.id);

      if (error) throw error;

      // Send rejection email notification
      try {
        await supabase.functions.invoke("send-affiliate-status-notification", {
          body: {
            user_id: selectedApplication.user_id,
            status: "rejected",
            rejection_reason: rejectionReason || undefined,
          },
        });
      } catch (emailError) {
        console.error("Error sending rejection email:", emailError);
        // Don't fail the rejection if email fails
      }

      toast({
        title: "Application Rejected",
        description: "The application has been rejected and the user notified.",
      });

      setRejectDialogOpen(false);
      setSelectedApplication(null);
      setRejectionReason("");
      fetchApplications();
    } catch (err) {
      console.error("Error rejecting application:", err);
      toast({
        title: "Error",
        description: "Failed to reject application",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectDialog = (application: Application) => {
    setSelectedApplication(application);
    setRejectionReason("");
    setRejectDialogOpen(true);
  };

  const filteredApplications = applications.filter((app) => {
    const matchesSearch =
      app.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.user_id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = app.status === selectedTab;
    return matchesSearch && matchesStatus;
  });

  const counts = {
    pending: applications.filter((a) => a.status === "pending").length,
    approved: applications.filter((a) => a.status === "approved").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Affiliate Applications</h1>
          <p className="text-muted-foreground">Review and manage affiliate program applications</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{counts.pending}</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <Check className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{counts.approved}</p>
                  <p className="text-sm text-muted-foreground">Approved</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-destructive/20 flex items-center justify-center">
                  <X className="w-5 h-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{counts.rejected}</p>
                  <p className="text-sm text-muted-foreground">Rejected</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or user ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">
              Pending ({counts.pending})
            </TabsTrigger>
            <TabsTrigger value="approved">
              Approved ({counts.approved})
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Rejected ({counts.rejected})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={selectedTab} className="mt-4 space-y-3">
            {filteredApplications.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Users className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No {selectedTab} applications</p>
                </CardContent>
              </Card>
            ) : (
              filteredApplications.map((application) => (
                <Card key={application.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium">
                            {application.profile?.full_name || "Anonymous User"}
                          </p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            Applied {new Date(application.applied_at).toLocaleDateString()}
                          </div>
                          {application.application_note && (
                            <div className="mt-2 p-2 bg-muted rounded-lg">
                              <div className="flex items-start gap-2">
                                <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                                <p className="text-sm">{application.application_note}</p>
                              </div>
                            </div>
                          )}
                          {application.rejection_reason && (
                            <div className="mt-2 p-2 bg-destructive/10 rounded-lg">
                              <p className="text-sm text-destructive">
                                Rejection reason: {application.rejection_reason}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {application.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(application)}
                              disabled={processingId === application.id}
                            >
                              {processingId === application.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Check className="w-4 h-4 mr-1" />
                                  Approve
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openRejectDialog(application)}
                              disabled={processingId === application.id}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Reject
                            </Button>
                          </>
                        )}
                        {application.status === "approved" && (
                          <Badge className="bg-green-500/20 text-green-600 border-green-500/30">
                            Approved
                          </Badge>
                        )}
                        {application.status === "rejected" && (
                          <Badge variant="destructive">Rejected</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reject Application</DialogTitle>
            <DialogDescription>
              Provide a reason for rejecting this application (optional).
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processingId !== null}
            >
              {processingId ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              Reject Application
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
