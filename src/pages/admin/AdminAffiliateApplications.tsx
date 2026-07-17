import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import {
  AdminFilterBar,
  AdminKpiStrip,
  AdminSheetContent,
  AdminWorkbenchHeader,
} from "@/components/admin/AdminPrimitives";
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
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { downloadCsv } from "@/lib/csv";
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
    email: string | null;
  } | null;
}

const AdminAffiliateApplications = () => {
  const { toast } = useToast();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedApplications, setSelectedApplications] = useState<Set<string>>(
    new Set(),
  );
  const [selectedApplication, setSelectedApplication] =
    useState<Application | null>(null);
  const [activeTab, setActiveTab] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("pending");
  const [sortField, setSortField] = useState<"applied_at" | "full_name">(
    "applied_at",
  );
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

      const userIds = [
        ...new Set((appsData || []).map((app) => app.user_id).filter(Boolean)),
      ];

      let profilesData: {
        user_id: string;
        full_name: string | null;
        email: string | null;
      }[] = [];
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
            ? {
                ...app,
                status: "approved",
                reviewed_at: new Date().toISOString(),
              }
            : app,
        ),
      );

      toast({
        title: "Application Approved",
        description:
          "The user has been approved as an affiliate and notified via email.",
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
            ? {
                ...app,
                status: "rejected",
                rejection_reason: rejectionReason,
                reviewed_at: new Date().toISOString(),
              }
            : app,
        ),
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
          await supabase.functions.invoke(
            "send-affiliate-status-notification",
            {
              body: {
                user_id: application.user_id,
                status: "approved",
              },
            },
          );
        } catch (emailError) {
          console.error("Error sending approval email:", emailError);
        }

        approvedCount.value++;
      }

      // Update local state
      setApplications((prev) =>
        prev.map((app) =>
          selectedApplications.has(app.id) && app.status === "pending"
            ? {
                ...app,
                status: "approved",
                reviewed_at: new Date().toISOString(),
              }
            : app,
        ),
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
          await supabase.functions.invoke(
            "send-affiliate-status-notification",
            {
              body: {
                user_id: application.user_id,
                status: "rejected",
                rejection_reason: rejectionReason || undefined,
              },
            },
          );
        } catch (emailError) {
          console.error("Error sending rejection email:", emailError);
        }

        rejectedCount.value++;
      }

      // Update local state
      setApplications((prev) =>
        prev.map((app) =>
          selectedApplications.has(app.id) && app.status === "pending"
            ? {
                ...app,
                status: "rejected",
                rejection_reason: rejectionReason,
                reviewed_at: new Date().toISOString(),
              }
            : app,
        ),
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
      setSelectedApplications(
        new Set(filteredApplications.map((app) => app.id)),
      );
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
    const headers = [
      "Name",
      "Email",
      "Status",
      "Applied At",
      "Reviewed At",
      "Rejection Reason",
    ];
    const rows = filteredApplications.map((app) => [
      app.profile?.full_name || "Anonymous",
      app.profile?.email || "N/A",
      app.status,
      format(new Date(app.applied_at), "yyyy-MM-dd HH:mm"),
      app.reviewed_at
        ? format(new Date(app.reviewed_at), "yyyy-MM-dd HH:mm")
        : "Not reviewed",
      app.rejection_reason || "N/A",
    ]);

    downloadCsv(
      [headers, ...rows],
      `affiliate-applications-export-${format(new Date(), "yyyy-MM-dd")}.csv`,
    );

    toast({
      title: "Export Complete",
      description: `${rows.length} applications exported to CSV.`,
    });
  };

  const filteredApplications = applications
    .filter((app) => {
      const matchesSearch =
        !searchQuery ||
        app.profile?.full_name
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ||
        app.profile?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.user_id.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTab = activeTab === "all" || app.status === activeTab;
      return matchesSearch && matchesTab;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortField === "applied_at") {
        comparison =
          new Date(a.applied_at).getTime() - new Date(b.applied_at).getTime();
      } else if (sortField === "full_name") {
        comparison = (a.profile?.full_name || "").localeCompare(
          b.profile?.full_name || "",
        );
      }
      return sortDirection === "asc" ? comparison : -comparison;
    });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge
            variant="outline"
            className="border-[#F97316]/40 bg-[#F97316]/10 text-[#F97316]"
          >
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      case "approved":
        return (
          <Badge
            variant="outline"
            className="border-[#22C7A1]/20 bg-[#22C7A1]/10 text-[#22C7A1]"
          >
            <CheckCircle className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        );
      case "rejected":
        return (
          <Badge
            variant="outline"
            className="border-[#FB6B7A]/20 bg-[#FB6B7A]/10 text-[#FB6B7A]"
          >
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
    <AdminLayout
      title="Affiliate Applications"
      subtitle={`${stats.pending} pending review`}
    >
      <div className="space-y-5 text-[#020617]">
        <AdminWorkbenchHeader
          eyebrow="Affiliate review"
          title="Application intake desk"
          icon={Users}
          accent="#22C7A1"
          description="Review new applicants, grant referral access, reject incomplete requests, and keep the affiliate pipeline moving."
          meta={[
            { label: "Pending", value: stats.pending },
            { label: "Approved", value: stats.approved },
            { label: "Selected", value: selectedApplications.size },
          ]}
          actions={
            <>
              <Button
                variant="outline"
                onClick={exportToCSV}
                className="h-11 gap-2 rounded-[14px] border-[#38BDF8]/30 bg-[#38BDF8]/10 px-4 font-black text-[#020617] hover:bg-[#38BDF8]/15"
              >
                <Download className="h-4 w-4 text-[#38BDF8]" />
                Export
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={fetchApplications}
                disabled={loading}
                aria-label="Refresh affiliate applications"
                className="h-11 w-11 rounded-[14px] border-[#E5EAF1] bg-white text-[#020617] hover:bg-[#F6F8FB]"
              >
                <RefreshCw
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
              </Button>
            </>
          }
        />

        <AdminKpiStrip
          items={[
            {
              label: "Total applications",
              value: stats.total,
              helper: "All submissions",
              icon: Users,
              accent: "#7C83F6",
            },
            {
              label: "Pending review",
              value: stats.pending,
              helper: "Needs action",
              icon: Clock,
              accent: "#F97316",
            },
            {
              label: "Approved",
              value: stats.approved,
              helper: "Referral enabled",
              icon: CheckCircle,
              accent: "#22C7A1",
            },
            {
              label: "Rejected",
              value: stats.rejected,
              helper: "Declined",
              icon: XCircle,
              accent: "#FB6B7A",
            },
          ]}
        />

        <AdminFilterBar title="Review queue">
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
                  onClick={() =>
                    setActiveTab(
                      tab.value as "all" | "pending" | "approved" | "rejected",
                    )
                  }
                  className={`min-h-11 rounded-[14px] px-4 text-sm font-black transition ${
                    activeTab === tab.value
                      ? "border border-[#7C83F6]/30 bg-[#7C83F6]/10 text-[#020617]"
                      : "bg-[#F6F8FB] text-[#94A3B8] ring-1 ring-[#E5EAF1] hover:text-[#020617]"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${activeTab === tab.value ? "bg-[#7C83F6]/15 text-[#7C83F6]" : "bg-white text-[#94A3B8]"}`}
                  >
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
        </AdminFilterBar>

        {selectedApplications.size > 0 && (
          <div className="flex flex-col gap-3 rounded-[18px] border border-[#7C83F6]/20 bg-[#7C83F6]/10 p-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-black text-[#020617]">
              {selectedApplications.size} application
              {selectedApplications.size > 1 ? "s" : ""} selected
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkApprove}
                disabled={isBulkProcessing}
                className="min-h-11 rounded-[12px] border-[#22C7A1]/20 bg-white text-[#22C7A1]"
              >
                Approve Selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="min-h-11 rounded-[12px] border-[#FB6B7A]/20 bg-white text-[#FB6B7A] hover:bg-[#FB6B7A]/10"
                onClick={openBulkRejectDialog}
                disabled={isBulkProcessing}
              >
                Reject Selected
              </Button>
            </div>
          </div>
        )}

        <section className="overflow-hidden rounded-[24px] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="flex items-center justify-between gap-3 border-b border-[#E5EAF1] bg-[#F6F8FB] px-5 py-4">
            <div>
              <h3 className="text-lg font-black text-[#020617]">
                Application Queue
              </h3>
              <p className="text-xs font-bold text-[#94A3B8]">
                {filteredApplications.length} visible from {applications.length}{" "}
                total
              </p>
            </div>
            <Badge
              variant="outline"
              className="border-[#38BDF8]/20 bg-[#38BDF8]/10 text-[#38BDF8]"
            >
              Review center
            </Badge>
          </div>
          <div className="grid gap-3 p-4 md:hidden">
            {loading ? (
              <div className="flex flex-col items-center gap-3 rounded-[22px] border border-[#E5EAF1] bg-[#F6F8FB] p-8">
                <Loader2 className="h-8 w-8 animate-spin text-[#020617]" />
                <p className="text-sm font-semibold text-[#94A3B8]">
                  Loading applications...
                </p>
              </div>
            ) : filteredApplications.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-[22px] border border-[#E5EAF1] bg-[#F6F8FB] p-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-white ring-1 ring-[#E5EAF1]">
                  <Users className="h-6 w-6 text-[#94A3B8]" />
                </div>
                <p className="font-black text-[#020617]">
                  No applications found
                </p>
                <p className="text-sm font-semibold text-[#94A3B8]">
                  Try adjusting your filters
                </p>
              </div>
            ) : (
              filteredApplications.map((application) => (
                <div
                  key={application.id}
                  className="rounded-[24px] border border-[#E5EAF1] bg-white p-4 shadow-[0_12px_30px_rgba(2,6,23,0.05)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <Checkbox
                        checked={selectedApplications.has(application.id)}
                        onCheckedChange={() =>
                          toggleApplicationSelection(application.id)
                        }
                        className="mt-3"
                      />
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] bg-[#F6F8FB] ring-1 ring-[#E5EAF1]">
                        <User className="h-5 w-5 text-[#7C83F6]" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-base font-black text-[#020617]">
                          {application.profile?.full_name || "Anonymous User"}
                        </p>
                        <p className="mt-1 truncate text-xs font-semibold text-[#94A3B8]">
                          {application.profile?.email || "No email"}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(application.status)}
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                        Applied
                      </p>
                      <p className="mt-1 text-sm font-black text-[#020617]">
                        {format(
                          new Date(application.applied_at),
                          "MMM d, yyyy",
                        )}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-3">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                        User ID
                      </p>
                      <p className="mt-1 truncate font-mono text-sm font-black text-[#020617]">
                        {application.user_id.slice(0, 8)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-2xl bg-[#F6F8FB] p-3">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Note
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm font-semibold text-[#020617]">
                      {application.application_note || "No note provided"}
                    </p>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {application.status === "pending" ? (
                      <>
                        <Button
                          variant="outline"
                          className="min-h-[44px] rounded-2xl border-[#22C7A1]/20 bg-[#22C7A1]/10 font-black text-[#22C7A1] hover:bg-[#22C7A1]/15"
                          onClick={() => handleApprove(application)}
                          disabled={processingId === application.id}
                        >
                          {processingId === application.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle className="mr-2 h-4 w-4" />
                          )}
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          className="min-h-[44px] rounded-2xl border-[#FB6B7A]/20 bg-[#FB6B7A]/10 font-black text-[#FB6B7A] hover:bg-[#FB6B7A]/15"
                          onClick={() => openRejectDialog(application)}
                          disabled={processingId === application.id}
                        >
                          <XCircle className="mr-2 h-4 w-4" />
                          Reject
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        className="col-span-2 min-h-[44px] rounded-2xl border-[#7C83F6]/25 bg-[#7C83F6]/10 font-black text-[#020617] hover:bg-[#7C83F6]/15"
                        onClick={() => {
                          setSelectedApplication(application);
                          setIsDetailOpen(true);
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View details
                      </Button>
                    )}
                  </div>
                  {application.status === "pending" && (
                    <Button
                      variant="ghost"
                      className="mt-2 min-h-[44px] w-full rounded-2xl font-black text-[#020617] hover:bg-[#F6F8FB]"
                      onClick={() => {
                        setSelectedApplication(application);
                        setIsDetailOpen(true);
                      }}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View details
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <TableHeader className="bg-[#F6F8FB]">
                <TableRow className="border-[#E5EAF1] hover:bg-transparent">
                  <TableHead className="w-10 pl-6">
                    <Checkbox
                      checked={
                        selectedApplications.size ===
                          filteredApplications.length &&
                        filteredApplications.length > 0
                      }
                      onCheckedChange={selectAllApplications}
                    />
                  </TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                    Applicant
                  </TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                    Status
                  </TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                    <button
                      onClick={() => handleSort("applied_at")}
                      className="flex min-h-11 items-center gap-1 rounded-2xl px-2 text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8] transition-colors hover:text-[#020617]"
                    >
                      Applied Date
                      {sortField === "applied_at" &&
                        (sortDirection === "asc" ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        ))}
                    </button>
                  </TableHead>
                  <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                    Note
                  </TableHead>
                  <TableHead className="w-20 text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 animate-spin text-[#020617]" />
                        <p className="text-sm font-semibold text-[#94A3B8]">
                          Loading applications...
                        </p>
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
                        <p className="font-black text-[#020617]">
                          No applications found
                        </p>
                        <p className="text-sm font-semibold text-[#94A3B8]">
                          Try adjusting your filters
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredApplications.map((application) => (
                    <TableRow
                      key={application.id}
                      className="border-[#E5EAF1] transition-colors hover:bg-[#F6F8FB]/70"
                    >
                      <TableCell className="pl-6">
                        <Checkbox
                          checked={selectedApplications.has(application.id)}
                          onCheckedChange={() =>
                            toggleApplicationSelection(application.id)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-[15px] bg-[#F6F8FB] flex items-center justify-center ring-1 ring-[#E5EAF1]">
                            <User className="w-5 h-5 text-[#7C83F6]" />
                          </div>
                          <div>
                            <p className="font-black text-[#020617]">
                              {application.profile?.full_name ||
                                "Anonymous User"}
                            </p>
                            <p className="text-xs font-semibold text-[#94A3B8]">
                              {application.profile?.email || "No email"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(application.status)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm font-semibold text-[#94A3B8]">
                          <Calendar className="w-3 h-3 text-[#38BDF8]" />
                          {format(
                            new Date(application.applied_at),
                            "MMM d, yyyy",
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {application.application_note ? (
                          <div className="flex items-center gap-1 text-sm font-semibold text-[#94A3B8]">
                            <FileText className="w-3 h-3 text-[#7C83F6]" />
                            <span className="truncate max-w-[150px]">
                              {application.application_note}
                            </span>
                          </div>
                        ) : (
                          <span className="text-sm font-semibold text-[#94A3B8]">
                            -
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {application.status === "pending" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11 rounded-2xl text-[#22C7A1] hover:bg-[#22C7A1]/10 hover:text-[#22C7A1]"
                                aria-label="Approve affiliate application"
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
                                className="h-11 w-11 rounded-2xl text-[#FB6B7A] hover:bg-[#FB6B7A]/10 hover:text-[#FB6B7A]"
                                aria-label="Reject affiliate application"
                                onClick={() => openRejectDialog(application)}
                                disabled={processingId === application.id}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            </>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-11 w-11 rounded-2xl text-[#020617] hover:bg-[#F6F8FB]"
                                aria-label="Open affiliate application actions"
                              >
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="rounded-[18px] border-[#E5EAF1] bg-white text-[#020617] shadow-[0_18px_42px_rgba(2,6,23,0.12)]"
                            >
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
                                  className="text-[#22C7A1] focus:bg-[#22C7A1]/10 focus:text-[#22C7A1]"
                                >
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Approve
                                </DropdownMenuItem>
                              )}
                              {application.status !== "rejected" && (
                                <DropdownMenuItem
                                  onClick={() => openRejectDialog(application)}
                                  className="text-[#FB6B7A] focus:bg-[#FB6B7A]/10 focus:text-[#FB6B7A]"
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
          <AdminSheetContent size="xl">
            {selectedApplication && (
              <>
                <SheetHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 text-left">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[#7C83F6]/10 text-[#7C83F6] ring-1 ring-[#7C83F6]/15">
                      <User className="h-8 w-8" />
                    </div>
                    <div>
                      <SheetTitle className="text-xl font-black text-[#020617]">
                        {selectedApplication.profile?.full_name ||
                          "Anonymous User"}
                      </SheetTitle>
                      <SheetDescription className="mt-2">
                        {getStatusBadge(selectedApplication.status)}
                      </SheetDescription>
                    </div>
                  </div>
                </SheetHeader>

                <div className="space-y-4 p-5">
                  {/* Application Info */}
                  <section className="rounded-[22px] bg-white p-4 shadow-[0_12px_28px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Application Details
                    </p>
                    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.08em] text-[#94A3B8]">
                          User ID
                        </p>
                        <code className="text-sm font-bold text-[#020617]">
                          {selectedApplication.user_id.substring(0, 16)}...
                        </code>
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.08em] text-[#94A3B8]">
                          Email
                        </p>
                        <p className="text-sm font-bold text-[#020617]">
                          {selectedApplication.profile?.email || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.08em] text-[#94A3B8]">
                          Applied
                        </p>
                        <p className="text-sm font-bold text-[#020617]">
                          {format(
                            new Date(selectedApplication.applied_at),
                            "MMM d, yyyy HH:mm",
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.08em] text-[#94A3B8]">
                          Reviewed
                        </p>
                        <p className="text-sm font-bold text-[#020617]">
                          {selectedApplication.reviewed_at
                            ? format(
                                new Date(selectedApplication.reviewed_at),
                                "MMM d, yyyy HH:mm",
                              )
                            : "Not reviewed"}
                        </p>
                      </div>
                    </div>
                  </section>

                  {/* Application Note */}
                  {selectedApplication.application_note && (
                    <section className="rounded-[22px] bg-white p-4 shadow-[0_12px_28px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                        Application Note
                      </p>
                      <div className="mt-3 flex items-start gap-3 rounded-[16px] bg-[#F6F8FB] p-3 ring-1 ring-[#E5EAF1]">
                        <FileText className="mt-0.5 h-4 w-4 text-[#7C83F6]" />
                        <p className="text-sm font-semibold leading-6 text-[#94A3B8]">
                          {selectedApplication.application_note}
                        </p>
                      </div>
                    </section>
                  )}

                  {/* Rejection Reason */}
                  {selectedApplication.rejection_reason && (
                    <section className="rounded-[22px] bg-white p-4 shadow-[0_12px_28px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]">
                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                        Rejection Reason
                      </p>
                      <div className="mt-3 flex items-start gap-3 rounded-[16px] border border-[#FB6B7A]/20 bg-[#FB6B7A]/10 p-3">
                        <XCircle className="mt-0.5 h-4 w-4 text-[#FB6B7A]" />
                        <p className="text-sm font-semibold leading-6 text-[#FB6B7A]">
                          {selectedApplication.rejection_reason}
                        </p>
                      </div>
                    </section>
                  )}

                  {/* Actions */}
                  {selectedApplication.status === "pending" && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Button
                        variant="outline"
                        className="h-12 rounded-[16px] border-[#22C7A1]/30 bg-[#22C7A1]/10 font-black text-[#020617] hover:bg-[#22C7A1]/15"
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
                        className="h-12 rounded-[16px] border-[#FB6B7A]/25 bg-white font-black text-[#FB6B7A] hover:bg-[#FB6B7A]/10 hover:text-[#FB6B7A]"
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
          </AdminSheetContent>
        </Sheet>

        {/* Reject Dialog */}
        <Sheet open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
          <AdminSheetContent size="md">
            <SheetHeader className="border-b border-[#E5EAF1] bg-[#F6F8FB] p-5 text-left">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[#FB6B7A]/10 text-[#FB6B7A] ring-1 ring-[#FB6B7A]/20">
                  <XCircle className="h-5 w-5" />
                </span>
                <div>
                  <SheetTitle className="text-xl font-black text-[#020617]">
                    {selectedApplications.size > 0
                      ? `Reject ${selectedApplications.size} Applications`
                      : "Reject Application"}
                  </SheetTitle>
                  <SheetDescription className="mt-1 font-semibold text-[#94A3B8]">
                    {selectedApplications.size > 0
                      ? `Provide a reason for rejecting these ${selectedApplications.size} applications (optional). This reason will be sent to all selected applicants.`
                      : `Provide a reason for rejecting ${selectedApplication?.profile?.full_name || "this application"} (optional).`}
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
                  onClick={
                    selectedApplications.size > 0
                      ? handleBulkReject
                      : handleReject
                  }
                  disabled={processingId !== null || isBulkProcessing}
                  className="h-12 rounded-[16px] bg-[#FB6B7A] font-black text-white hover:bg-[#FB6B7A]/90"
                >
                  {processingId || isBulkProcessing ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <XCircle className="w-4 h-4 mr-2" />
                  )}
                  {selectedApplications.size > 0
                    ? `Reject ${selectedApplications.size} Applications`
                    : "Reject Application"}
                </Button>
              </div>
            </div>
          </AdminSheetContent>
        </Sheet>
      </div>
    </AdminLayout>
  );
};

export default AdminAffiliateApplications;
