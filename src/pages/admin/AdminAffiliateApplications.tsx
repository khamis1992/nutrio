import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  useEffect(() => {
    fetchApplications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      
      let profilesData: { user_id: string; full_name: string | null; email?: string }[] = [];
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

  const handleBulkApprove = async () => {
    if (selectedApplications.size === 0) return;

    setIsBulkProcessing(true);
    const applicationIds = Array.from(selectedApplications);
    const approvedCount = { value: 0 };

    try {
      // Process each application
      for (const appId of applicationIds) {
        const application = applications.find((app) => app.id === appId);
        if (!application || application.status !== "pending") continue;

        // Update application status
        const { error: updateError } = await supabase
          .from("affiliate_applications")
          .update({
            status: "approved",
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", appId);

        if (updateError) {
          console.error(`Error approving application ${appId}:`, updateError);
          continue;
        }

        // Generate referral code
        const referralCode = `REF${application.user_id.slice(0, 6).toUpperCase()}${Date.now().toString(36).slice(-4).toUpperCase()}`;

        await supabase
          .from("profiles")
          .update({ referral_code: referralCode })
          .eq("user_id", application.user_id)
          .is("referral_code", null);

        // Send approval email (fire and forget)
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

        approvedCount.value++;
      }

      // Update local state
      setApplications((prev) =>
        prev.map((app) =>
          selectedApplications.has(app.id) && app.status === "pending"
            ? { ...app, status: "approved", reviewed_at: new Date().toISOString() }
            : app
        )
      );

      toast({
        title: "Applications Approved",
        description: `${approvedCount.value} application(s) have been approved and notified.`,
      });

      // Clear selection
      setSelectedApplications(new Set());
    } catch (err) {
      console.error("Error in bulk approve:", err);
      toast({
        title: "Error",
        description: "Failed to approve some applications",
        variant: "destructive",
      });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const openBulkRejectDialog = () => {
    if (selectedApplications.size === 0) return;
    setRejectionReason("");
    setIsRejectDialogOpen(true);
  };

  const handleBulkReject = async () => {
    if (selectedApplications.size === 0) return;

    setIsBulkProcessing(true);
    const applicationIds = Array.from(selectedApplications);
    const rejectedCount = { value: 0 };

    try {
      // Process each application
      for (const appId of applicationIds) {
        const application = applications.find((app) => app.id === appId);
        if (!application || application.status !== "pending") continue;

        // Update application status
        const { error: updateError } = await supabase
          .from("affiliate_applications")
          .update({
            status: "rejected",
            rejection_reason: rejectionReason || null,
            reviewed_at: new Date().toISOString(),
          })
          .eq("id", appId);

        if (updateError) {
          console.error(`Error rejecting application ${appId}:`, updateError);
          continue;
        }

        // Send rejection email (fire and forget)
        try {
          await supabase.functions.invoke("send-affiliate-status-notification", {
            body: {
              user_id: application.user_id,
              status: "rejected",
              rejection_reason: rejectionReason || undefined,
            },
          });
        } catch (emailError) {
          console.error("Error sending rejection email:", emailError);
        }

        rejectedCount.value++;
      }

      // Update local state
      setApplications((prev) =>
        prev.map((app) =>
          selectedApplications.has(app.id) && app.status === "pending"
            ? { ...app, status: "rejected", rejection_reason: rejectionReason, reviewed_at: new Date().toISOString() }
            : app
        )
      );

      toast({
        title: "Applications Rejected",
        description: `${rejectedCount.value} application(s) have been rejected and notified.`,
      });

      // Clear selection and close dialog
      setSelectedApplications(new Set());
      setIsRejectDialogOpen(false);
      setRejectionReason("");
    } catch (err) {
      console.error("Error in bulk reject:", err);
      toast({
        title: "Error",
        description: "Failed to reject some applications",
        variant: "destructive",
      });
    } finally {
      setIsBulkProcessing(false);
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
          <Badge variant="outline" className="border-[#FDBA74]/40 bg-[#FFF7ED] text-[#F97316]">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="outline" className="border-[#22C7A1]/20 bg-[#EFFFFA] text-[#22C7A1]">
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="border-[#FB6B7A]/20 bg-[#FFF0F2] text-[#FB6B7A]">
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
      <div className="space-y-5 text-[#020617]">
        <section className="overflow-hidden rounded-[24px] bg-white shadow-[0_18px_42px_rgba(2,6,23,0.07)] ring-1 ring-[#E5EAF1]">
          <div className="flex flex-col gap-4 border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[#22C7A1]">Affiliate Review</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-[#020617]">Applications</h2>
              <p className="mt-1 text-sm font-semibold text-[#94A3B8]">
                Review applicants, approve referral access, and manage rejection notes.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={exportToCSV}
                className="h-11 gap-2 rounded-[14px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-[#F6F8FB]"
              >
                <Download className="h-4 w-4 text-[#38BDF8]" />
                Export
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={fetchApplications}
                disabled={loading}
                className="h-11 w-11 rounded-[14px] border-[#E5EAF1] bg-white text-[#020617] hover:bg-[#F6F8FB]"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Total Applications", value: stats.total, Icon: Users, bg: "bg-[#F6F8FB]", color: "text-[#020617]", ring: "ring-[#E5EAF1]" },
              { label: "Pending Review", value: stats.pending, Icon: Clock, bg: "bg-[#FFF7ED]", color: "text-[#F97316]", ring: "ring-[#FDBA74]/35" },
              { label: "Approved", value: stats.approved, Icon: CheckCircle, bg: "bg-[#EFFFFA]", color: "text-[#22C7A1]", ring: "ring-[#22C7A1]/20" },
              { label: "Rejected", value: stats.rejected, Icon: XCircle, bg: "bg-[#FFF0F2]", color: "text-[#FB6B7A]", ring: "ring-[#FB6B7A]/20" },
            ].map(({ label, value, Icon, bg, color, ring }) => (
              <div key={label} className={`rounded-[20px] ${bg} p-4 ring-1 ${ring}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-3xl font-black leading-none text-[#020617]">{value}</p>
                    <p className="mt-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#94A3B8]">{label}</p>
                  </div>
                  <div className={`flex h-11 w-11 items-center justify-center rounded-[16px] bg-white ${color} shadow-sm ring-1 ring-white/80`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] bg-white p-4 shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap gap-2">
              {[
                { value: "all", label: "All", count: stats.total },
                { value: "pending", label: "Pending", count: stats.pending },
                { value: "approved", label: "Approved", count: stats.approved },
                { value: "rejected", label: "Rejected", count: stats.rejected },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value as "all" | "pending" | "approved" | "rejected")}
                  className={`min-h-10 rounded-[14px] px-4 text-sm font-black transition ${
                    activeTab === tab.value
                      ? "bg-[#020617] text-white shadow-[0_10px_20px_rgba(2,6,23,0.14)]"
                      : "bg-[#F6F8FB] text-[#64748B] ring-1 ring-[#E5EAF1] hover:text-[#020617]"
                  }`}
                >
                  {tab.label}
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${activeTab === tab.value ? "bg-white/10 text-white" : "bg-white text-[#94A3B8]"}`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="relative min-w-[280px] flex-1 xl:max-w-md">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
              <Input
                placeholder="Search by name, email, or user ID"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 rounded-[14px] border-[#E5EAF1] bg-[#F6F8FB] pl-10 font-semibold text-[#020617] placeholder:text-[#94A3B8] focus-visible:ring-[#020617]"
              />
            </div>
          </div>
        </section>

        {selectedApplications.size > 0 && (
          <div className="flex flex-col gap-3 rounded-[18px] border border-[#7C83F6]/20 bg-[#F3F4FF] p-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-black text-[#020617]">
              {selectedApplications.size} application{selectedApplications.size > 1 ? "s" : ""} selected
            </span>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleBulkApprove} disabled={isBulkProcessing} className="rounded-[12px] border-[#22C7A1]/20 bg-white text-[#22C7A1]">
                Approve Selected
              </Button>
              <Button variant="outline" size="sm" className="rounded-[12px] border-[#FB6B7A]/20 bg-white text-[#FB6B7A] hover:bg-[#FFF0F2]" onClick={openBulkRejectDialog} disabled={isBulkProcessing}>
                Reject Selected
              </Button>
            </div>
          </div>
        )}

        <section className="overflow-hidden rounded-[24px] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="flex items-center justify-between gap-3 border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
            <div>
              <h3 className="text-lg font-black text-[#020617]">Application Queue</h3>
              <p className="text-xs font-bold text-[#94A3B8]">{filteredApplications.length} visible from {applications.length} total</p>
            </div>
            <Badge variant="outline" className="border-[#38BDF8]/20 bg-[#EFF9FF] text-[#38BDF8]">
              Review center
            </Badge>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-[#E5EAF1] hover:bg-transparent">
                  <TableHead className="w-10 pl-6">
                    <Checkbox
                      checked={selectedApplications.size === filteredApplications.length && filteredApplications.length > 0}
                      onCheckedChange={selectAllApplications}
                    />
                  </TableHead>
                  <TableHead>Applicant</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <button onClick={() => handleSort("applied_at")} className="flex items-center gap-1 transition-colors hover:text-[#020617]">
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
                        <Loader2 className="w-8 h-8 animate-spin text-[#020617]" />
                        <p className="text-sm font-semibold text-[#94A3B8]">Loading applications...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredApplications.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-[18px] bg-[#F6F8FB] flex items-center justify-center ring-1 ring-[#E5EAF1]">
                          <Users className="w-6 h-6 text-[#94A3B8]" />
                        </div>
                        <p className="font-black text-[#020617]">No applications found</p>
                        <p className="text-sm font-semibold text-[#94A3B8]">Try adjusting your filters</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredApplications.map((application) => (
                    <TableRow key={application.id} className="border-[#E5EAF1] transition-colors hover:bg-[#F6F8FB]">
                      <TableCell className="pl-6">
                        <Checkbox
                          checked={selectedApplications.has(application.id)}
                          onCheckedChange={() => toggleApplicationSelection(application.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-[15px] bg-[#F6F8FB] flex items-center justify-center ring-1 ring-[#E5EAF1]">
                            <User className="w-5 h-5 text-[#7C83F6]" />
                          </div>
                          <div>
                            <p className="font-black text-[#020617]">{application.profile?.full_name || "Anonymous User"}</p>
                            <p className="text-xs font-semibold text-[#94A3B8]">{application.profile?.email || "No email"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(application.status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm font-semibold text-[#94A3B8]">
                          <Calendar className="w-3 h-3 text-[#38BDF8]" />
                          {format(new Date(application.applied_at), "MMM d, yyyy")}
                        </div>
                      </TableCell>
                      <TableCell>
                        {application.application_note ? (
                          <div className="flex items-center gap-1 text-sm font-semibold text-[#94A3B8]">
                            <FileText className="w-3 h-3 text-[#7C83F6]" />
                            <span className="truncate max-w-[150px]">{application.application_note}</span>
                          </div>
                        ) : (
                          <span className="text-sm font-semibold text-[#94A3B8]">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {application.status === "pending" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-[#22C7A1] hover:bg-[#EFFFFA] hover:text-[#22C7A1]"
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
                                className="h-8 w-8 text-[#FB6B7A] hover:bg-[#FFF0F2] hover:text-[#FB6B7A]"
                                onClick={() => openRejectDialog(application)}
                                disabled={processingId === application.id}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-[#020617] hover:bg-[#F6F8FB]">
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
                                  className="text-[#22C7A1] focus:bg-[#EFFFFA] focus:text-[#22C7A1]"
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Approve
                                </DropdownMenuItem>
                              )}
                              {application.status !== "rejected" && (
                                <DropdownMenuItem
                                  onClick={() => openRejectDialog(application)}
                                  className="text-[#FB6B7A] focus:bg-[#FFF0F2] focus:text-[#FB6B7A]"
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
          </div>
        </section>

        {/* Application Detail Sheet */}
        <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <SheetContent className="w-full border-l border-[#E5EAF1] bg-[#F6F8FB] p-0 sm:max-w-xl">
            {selectedApplication && (
              <>
                <SheetHeader className="border-b border-[#E5EAF1] bg-white p-5 text-left">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#F3F4FF] text-[#7C83F6] ring-1 ring-[#7C83F6]/15">
                      <User className="h-8 w-8" />
                    </div>
                    <div>
                      <SheetTitle className="text-xl font-black text-[#020617]">
                        {selectedApplication.profile?.full_name || "Anonymous User"}
                      </SheetTitle>
                      <SheetDescription className="mt-2">{getStatusBadge(selectedApplication.status)}</SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <div className="space-y-4 p-5">
                  {/* Application Info */}
                  <section className="rounded-[22px] bg-white p-4 shadow-[0_12px_28px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Application Details
                    </p>
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.08em] text-[#94A3B8]">User ID</p>
                          <code className="text-sm font-bold text-[#020617]">{selectedApplication.user_id.substring(0, 16)}...</code>
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.08em] text-[#94A3B8]">Email</p>
                          <p className="text-sm font-bold text-[#020617]">{selectedApplication.profile?.email || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.08em] text-[#94A3B8]">Applied</p>
                          <p className="text-sm font-bold text-[#020617]">{format(new Date(selectedApplication.applied_at), "MMM d, yyyy HH:mm")}</p>
                        </div>
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.08em] text-[#94A3B8]">Reviewed</p>
                          <p className="text-sm font-bold text-[#020617]">
                            {selectedApplication.reviewed_at
                              ? format(new Date(selectedApplication.reviewed_at), "MMM d, yyyy HH:mm")
                              : "Not reviewed"}
                          </p>
                        </div>
                      </div>
                  </section>

                  {/* Application Note */}
                  {selectedApplication.application_note && (
                    <section className="rounded-[22px] bg-white p-4 shadow-[0_12px_28px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">Application Note</p>
                      <div className="mt-3 flex items-start gap-3 rounded-[16px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                        <FileText className="mt-0.5 h-4 w-4 text-[#7C83F6]" />
                        <p className="text-sm font-semibold leading-6 text-[#64748B]">{selectedApplication.application_note}</p>
                      </div>
                    </section>
                  )}

                  {/* Rejection Reason */}
                  {selectedApplication.rejection_reason && (
                    <section className="rounded-[22px] bg-white p-4 shadow-[0_12px_28px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">Rejection Reason</p>
                      <div className="mt-3 flex items-start gap-3 rounded-[16px] border border-[#FB6B7A]/20 bg-[#FFF0F2] p-3">
                        <XCircle className="mt-0.5 h-4 w-4 text-[#FB6B7A]" />
                        <p className="text-sm font-semibold leading-6 text-[#FB6B7A]">{selectedApplication.rejection_reason}</p>
                      </div>
                    </section>
                  )}

                  {/* Actions */}
                  {selectedApplication.status === "pending" && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        className="h-12 rounded-[16px] bg-[#020617] font-black text-white hover:bg-[#020617]/90"
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
                        className="h-12 rounded-[16px] border-[#FB6B7A]/25 bg-white font-black text-[#FB6B7A] hover:bg-[#FFF0F2] hover:text-[#FB6B7A]"
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
          <SheetContent className="w-full border-l border-[#E5EAF1] bg-[#F6F8FB] p-0 sm:max-w-md">
            <SheetHeader className="border-b border-[#E5EAF1] bg-white p-5 text-left">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[#FFF0F2] text-[#FB6B7A] ring-1 ring-[#FB6B7A]/20">
                  <XCircle className="h-5 w-5" />
                </span>
                <div>
                  <SheetTitle className="text-xl font-black text-[#020617]">{selectedApplications.size > 0 ? `Reject ${selectedApplications.size} Applications` : "Reject Application"}</SheetTitle>
                  <SheetDescription className="mt-1 font-semibold text-[#94A3B8]">
                {selectedApplications.size > 0 ? `Provide a reason for rejecting these ${selectedApplications.size} applications (optional). This reason will be sent to all selected applicants.` : `Provide a reason for rejecting ${selectedApplication?.profile?.full_name || "this application"} (optional).`}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>
            <div className="space-y-4 p-5">
              <Textarea
                placeholder="Reason for rejection..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
                className="min-h-32 rounded-[18px] border-[#E5EAF1] bg-white font-semibold text-[#020617] placeholder:text-[#94A3B8] focus-visible:ring-[#020617]"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <Button
                  variant="outline"
                  className="h-12 rounded-[16px] border-[#E5EAF1] bg-white font-black text-[#020617] hover:bg-white"
                  onClick={() => setIsRejectDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={selectedApplications.size > 0 ? handleBulkReject : handleReject}
                  disabled={processingId !== null || isBulkProcessing}
                  className="h-12 rounded-[16px] bg-[#FB6B7A] font-black text-white hover:bg-[#FB6B7A]/90"
                >
                  {processingId || isBulkProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  {selectedApplications.size > 0 ? `Reject ${selectedApplications.size} Applications` : "Reject Application"}
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
