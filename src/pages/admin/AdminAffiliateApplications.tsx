import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  User,
  Calendar,
  FileText,
  MoreHorizontal,
  Eye,
  Download,
  ChevronDown,
  ChevronUp,
  Mail,
  RefreshCw,
  UserCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

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

const AdminAffiliateApplications = () => {
  const { toast } = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedApplications, setSelectedApplications] = useState<Set<string>>(new Set());
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [sortField, setSortField] = useState<"applied_at" | "full_name">("applied_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const { data: appsData, error: appsError } = await supabase
        .from("affiliate_applications")
        .select("*")
        .order("applied_at", { ascending: false });

      if (appsError) throw appsError;

      const userIds = [...new Set((appsData || []).map((app) => app.user_id).filter(Boolean))];
      
      let profilesData: any[] = [];
      if (userIds.length > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", userIds);
        profilesData = data || [];
      }

      const applicationsWithProfiles = (appsData || []).map((app) => {
        const profile = profilesData?.find((p) => p.user_id === app.user_id);
        return {
          ...app,
          profile: {
            full_name: profile?.full_name || null,
            email: profile?.email || null,
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

      // Generate referral code
      const referralCode = `REF${application.user_id.slice(0, 6).toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}`;
      
      await supabase
        .from("profiles")
        .update({ referral_code: referralCode })
        .eq("user_id", application.user_id)
        .is("referral_code", null);

      // Send approval email
      try {
        await supabase.functions.invoke("send-affiliate-status-notification", {
          body: {
            user_id: application.user_id,
            status: "approved",
          },
        });
      } catch (emailError) {
        console.error("Error sending approval email:", emailError);
      }

      setApplications((prev) =>
        prev.map((app) =>
          app.id === application.id
            ? { ...app, status: "approved", reviewed_at: new Date().toISOString() }
            : app
        )
      );

      toast({
        title: "Application Approved",
        description: "The user has been approved as an affiliate and notified via email.",
      });
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

      // Send rejection email
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
      }

      setApplications((prev) =>
        prev.map((app) =>
          app.id === selectedApplication.id
            ? { ...app, status: "rejected", rejection_reason: rejectionReason, reviewed_at: new Date().toISOString() }
            : app
        )
      );

      toast({
        title: "Application Rejected",
        description: "The application has been rejected and the user notified.",
      });

      setIsRejectDialogOpen(false);
      setSelectedApplication(null);
      setRejectionReason("");
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
    setIsRejectDialogOpen(true);
  };

  const toggleApplicationSelection = (applicationId: string) => {
    setSelectedApplications((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(applicationId)) {
        newSet.delete(applicationId);
      } else {
        newSet.add(applicationId);
      }
      return newSet;
    });
  };

  const selectAllApplications = () => {
    if (selectedApplications.size === filteredApplications.length) {
      setSelectedApplications(new Set());
    } else {
      setSelectedApplications(new Set(filteredApplications.map((app) => app.id)));
    }
  };

  const handleSort = (field: "applied_at" | "full_name") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const exportToCSV = () => {
    const headers = ["Name", "Email", "Status", "Applied At", "Reviewed At", "Rejection Reason"];
    const rows = filteredApplications.map((app) => [
      app.profile?.full_name || "Anonymous",
      app.profile?.email || "N/A",
      app.status,
      format(new Date(app.applied_at), "yyyy-MM-dd HH:mm"),
      app.reviewed_at ? format(new Date(app.reviewed_at), "yyyy-MM-dd HH:mm") : "Not reviewed",
      app.rejection_reason || "N/A",
    ]);
    
    const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `affiliate-applications-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({ title: "Export Complete", description: `${rows.length} applications exported to CSV.` });
  };

  const filteredApplications = applications
    .filter((app) => {
      const matchesSearch =
        !searchQuery ||
        app.profile?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.profile?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.user_id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTab = activeTab === "all" || app.status === activeTab;
      return matchesSearch && matchesTab;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === "applied_at") {
        comparison = new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime();
      } else if (sortField === "full_name") {
        comparison = (a.profile?.full_name || "").localeCompare(b.profile?.full_name || "");
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
            <XCircle className="h-3 w-3 mr-1" />
            Rejected
          </Badge>
        );
      default:
        return null;
    }
  };

  // Calculate stats
  const stats = {
    total: applications.length,
    pending: applications.filter((a) => a.status === "pending").length,
    approved: applications.filter((a) => a.status === "approved").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
  };

  return (
    <AdminLayout title="Affiliate Applications" subtitle={`${stats.pending} pending review`}>
      <div className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total Applications</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.approved}</p>
                  <p className="text-xs text-muted-foreground">Approved</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <XCircle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.rejected}</p>
                  <p className="text-xs text-muted-foreground">Rejected</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { value: "all", label: "All", count: stats.total },
            { value: "pending", label: "Pending", count: stats.pending },
            { value: "approved", label: "Approved", count: stats.approved },
            { value: "rejected", label: "Rejected", count: stats.rejected },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {tab.count}
                </Badge>
              )}
            </button>
          ))}
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or user ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" onClick={exportToCSV} className="gap-2">
                  <Download className="w-4 h-4" />
                  Export
                </Button>
                <Button variant="outline" size="icon" onClick={fetchApplications} disabled={loading}>
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedApplications.size > 0 && (
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between">
            <span className="text-sm text-primary font-medium">
              {selectedApplications.size} application{selectedApplications.size > 1 ? "s" : ""} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                Approve Selected
              </Button>
              <Button variant="outline" size="sm" className="text-red-600 border-red-200">
                Reject Selected
              </Button>
            </div>
          </div>
        )}

        {/* Applications Table */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Applications</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10 pl-6">
                    <Checkbox
                      checked={selectedApplications.size === filteredApplications.length && filteredApplications.length > 0}
                      onCheckedChange={selectAllApplications}
                    />
                  </TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <button onClick={() => handleSort("applied_at")} className="flex items-center gap-1 hover:text-foreground transition-colors">
                      Applied Date
                      {sortField === "applied_at" && (sortDirection === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                    </button>
                  </TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        <p className="text-muted-foreground text-sm">Loading applications...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredApplications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                          <Users className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p className="text-muted-foreground">No applications found</p>
                        <p className="text-muted-foreground/70 text-sm">Try adjusting your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredApplications.map((application) => (
                    <TableRow key={application.id} className="hover:bg-muted/50 transition-colors">
                      <TableCell className="pl-6">
                        <Checkbox
                          checked={selectedApplications.has(application.id)}
                          onCheckedChange={() => toggleApplicationSelection(application.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <User className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{application.profile?.full_name || "Anonymous User"}</p>
                            <p className="text-xs text-muted-foreground">{application.profile?.email || "No email"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(application.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(application.applied_at), "MMM d, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell>
                        {application.application_note ? (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <FileText className="w-3 h-3" />
                            <span className="truncate max-w-[150px]">{application.application_note}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50 text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {application.status === "pending" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                                onClick={() => handleApprove(application)}
                                disabled={processingId === application.id}
                              >
                                {processingId === application.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                                onClick={() => openRejectDialog(application)}
                                disabled={processingId === application.id}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedApplication(application);
                                  setIsDetailOpen(true);
                                }}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {application.status !== "approved" && (
                                <DropdownMenuItem
                                  onClick={() => handleApprove(application)}
                                  className="text-emerald-600 focus:text-emerald-600 focus:bg-emerald-500/10"
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Approve
                                </DropdownMenuItem>
                              )}
                              {application.status !== "rejected" && (
                                <DropdownMenuItem
                                  onClick={() => openRejectDialog(application)}
                                  className="text-red-600 focus:text-red-600 focus:bg-red-500/10"
                                >
                                  <XCircle className="w-4 h-4 mr-2" />
                                  Reject
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Application Detail Sheet */}
        <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <SheetContent className="w-full sm:max-w-xl">
            {selectedApplication && (
              <>
                <SheetHeader className="pb-6 border-b">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <SheetTitle className="text-xl">
                        {selectedApplication.profile?.full_name || "Anonymous User"}
                      </SheetTitle>
                      <SheetDescription>{getStatusBadge(selectedApplication.status)}</SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {/* Application Info */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        Application Details
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">User ID</p>
                          <code className="text-sm font-mono">{selectedApplication.user_id.substring(0, 16)}...</code>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Email</p>
                          <p className="text-sm">{selectedApplication.profile?.email || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Applied</p>
                          <p className="text-sm">{format(new Date(selectedApplication.applied_at), "MMM d, yyyy HH:mm")}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Reviewed</p>
                          <p className="text-sm">
                            {selectedApplication.reviewed_at
                              ? format(new Date(selectedApplication.reviewed_at), "MMM d, yyyy HH:mm")
                              : "Not reviewed"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Application Note */}
                  {selectedApplication.application_note && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                          Application Note
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                          <FileText className="w-4 h-4 text-muted-foreground mt-0.5" />
                          <p className="text-sm">{selectedApplication.application_note}</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Rejection Reason */}
                  {selectedApplication.rejection_reason && (
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                          Rejection Reason
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-100">
                          <XCircle className="w-4 h-4 text-red-500 mt-0.5" />
                          <p className="text-sm text-red-700">{selectedApplication.rejection_reason}</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Actions */}
                  {selectedApplication.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                        onClick={() => {
                          handleApprove(selectedApplication);
                          setIsDetailOpen(false);
                        }}
                        disabled={processingId !== null}
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Approve Application
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => {
                          openRejectDialog(selectedApplication);
                          setIsDetailOpen(false);
                        }}
                        disabled={processingId !== null}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* Reject Dialog */}
        <Sheet open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
          <SheetContent className="w-full sm:max-w-md">
            <SheetHeader className="pb-6">
              <SheetTitle>Reject Application</SheetTitle>
              <SheetDescription>
                Provide a reason for rejecting {selectedApplication?.profile?.full_name || "this application"} (optional).
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-4 mt-4">
              <Textarea
                placeholder="Reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsRejectDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleReject}
                  disabled={processingId !== null}
                >
                  {processingId ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  Reject Application
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </AdminLayout>
  );
};

export default AdminAffiliateApplications;
