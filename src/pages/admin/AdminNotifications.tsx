import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Plus,
  Search,
  Megaphone,
  Bell,
  Calendar,
  Users,
  Store,
  Shield,
  Send,
  Trash2,
  Edit2,
  MoreHorizontal,
  Info,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Download,
} from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "error";
  target_audience: "all" | "users" | "partners";
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
  created_by: string | null;
}

interface AnnouncementStats {
  total: number;
  active: number;
  scheduled: number;
  expired: number;
}

interface AnnouncementFormData {
  title: string;
  message: string;
  type: "info" | "warning" | "success" | "error";
  target_audience: "all" | "users" | "partners";
  is_active: boolean;
  starts_at: string;
  ends_at: string;
}

type TabValue = "all" | "active" | "scheduled" | "expired" | "inactive";

export default function AdminNotifications() {
  const { user } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabValue>("all");
  const [stats, setStats] = useState<AnnouncementStats>({
    total: 0,
    active: 0,
    scheduled: 0,
    expired: 0,
  });
  
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedAnnouncements, setSelectedAnnouncements] = useState<Set<string>>(new Set());
  
  const [formData, setFormData] = useState<AnnouncementFormData>({
    title: "",
    message: "",
    type: "info",
    target_audience: "all" as "all" | "users" | "partners",
    is_active: true,
    starts_at: new Date().toISOString().slice(0, 16),
    ends_at: "",
  });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      const announcementsData = (data || []) as Announcement[];
      setAnnouncements(announcementsData);

      const now = new Date();
      const active = announcementsData.filter(a => {
        const startsAt = new Date(a.starts_at);
        const endsAt = a.ends_at ? new Date(a.ends_at) : null;
        return a.is_active && startsAt <= now && (!endsAt || endsAt > now);
      });
      
      const scheduled = announcementsData.filter(a => 
        a.is_active && new Date(a.starts_at) > now
      );
      
      const expired = announcementsData.filter(a => 
        a.ends_at && new Date(a.ends_at) < now
      );

      setStats({
        total: announcementsData.length,
        active: active.length,
        scheduled: scheduled.length,
        expired: expired.length,
      });
    } catch (error) {
      console.error("Error fetching announcements:", error);
      toast.error("Failed to load announcements");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.title.trim() || !formData.message.trim()) {
      toast.error("Title and message are required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: formData.title,
        message: formData.message,
        type: formData.type,
        target_audience: formData.target_audience,
        is_active: formData.is_active,
        starts_at: formData.starts_at,
        ends_at: formData.ends_at || null,
        created_by: user?.id,
      };

      if (selectedAnnouncement) {
        const { error } = await supabase
          .from("announcements")
          .update(payload)
          .eq("id", selectedAnnouncement.id);

        if (error) throw error;
        toast.success("Announcement updated successfully");
      } else {
        const { error } = await supabase.from("announcements").insert(payload);
        if (error) throw error;
        toast.success("Announcement created successfully");
      }

      setFormOpen(false);
      resetForm();
      fetchAnnouncements();
    } catch (error) {
      console.error("Error saving announcement:", error);
      toast.error("Failed to save announcement");
    } finally {
      setSaving(false);
    }
  };

  const handleSendNotification = async (announcement: Announcement) => {
    setSending(true);
    try {
      // Use the database function to send notifications
      const { data, error } = await supabase.rpc('send_announcement_notification_secure' as never, {
        p_announcement_id: announcement.id
      } as never);

      if (error) throw error;

      const count = Number(data || 0);
      if (count > 0) {
        const audienceLabel = announcement.target_audience === 'all' ? 'users' : announcement.target_audience === 'users' ? 'customers' : announcement.target_audience;
        toast.success(`Notification sent to ${count} ${audienceLabel}`);
      } else {
        toast.info('Notifications already sent or no target users found');
      }
    } catch (error) {
      console.error("Error sending notifications:", error);
      toast.error("Failed to send notifications");
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAnnouncement) return;

    try {
      const { error } = await supabase
        .from("announcements")
        .delete()
        .eq("id", selectedAnnouncement.id);

      if (error) throw error;
      toast.success("Announcement deleted");
      fetchAnnouncements();
    } catch (error) {
      console.error("Error deleting announcement:", error);
      toast.error("Failed to delete announcement");
    } finally {
      setDeleteDialogOpen(false);
      setDetailOpen(false);
      setSelectedAnnouncement(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedAnnouncements.size === 0) return;

    try {
      const { error } = await supabase
        .from("announcements")
        .delete()
        .in("id", Array.from(selectedAnnouncements));

      if (error) throw error;
      toast.success(`${selectedAnnouncements.size} announcement(s) deleted`);
      setSelectedAnnouncements(new Set());
      fetchAnnouncements();
    } catch (error) {
      console.error("Error deleting announcements:", error);
      toast.error("Failed to delete announcements");
    }
  };

  const toggleActive = async (announcement: Announcement) => {
    try {
      const { error } = await supabase
        .from("announcements")
        .update({ is_active: !announcement.is_active })
        .eq("id", announcement.id);

      if (error) throw error;
      toast.success(`Announcement ${announcement.is_active ? "deactivated" : "activated"}`);
      fetchAnnouncements();
    } catch (error) {
      console.error("Error toggling announcement:", error);
      toast.error("Failed to update announcement");
    }
  };

  const handleEdit = (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      message: announcement.message,
      type: announcement.type as "info" | "warning" | "success" | "error",
      target_audience: announcement.target_audience as "all" | "users" | "partners",
      is_active: announcement.is_active,
      starts_at: announcement.starts_at.slice(0, 16),
      ends_at: announcement.ends_at?.slice(0, 16) || "",
    });
    setFormOpen(true);
  };

  const resetForm = () => {
    setSelectedAnnouncement(null);
    setFormData({
      title: "",
      message: "",
      type: "info",
      target_audience: "all" as "all" | "users" | "partners",
      is_active: true,
      starts_at: new Date().toISOString().slice(0, 16),
      ends_at: "",
    });
  };

  const toggleAnnouncementSelection = (id: string) => {
    const newSelected = new Set(selectedAnnouncements);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedAnnouncements(newSelected);
  };

  const toggleAllSelection = () => {
    if (selectedAnnouncements.size === filteredAnnouncements.length) {
      setSelectedAnnouncements(new Set());
    } else {
      setSelectedAnnouncements(new Set(filteredAnnouncements.map(a => a.id)));
    }
  };

  const handleExportCSV = () => {
    const csvRows = [
      ["ID", "Title", "Message", "Type", "Audience", "Status", "Starts At", "Ends At", "Created At"],
      ...filteredAnnouncements.map(a => [
        a.id,
        a.title,
        a.message,
        a.type,
        a.target_audience,
        getStatusText(a),
        format(new Date(a.starts_at), "yyyy-MM-dd HH:mm"),
        a.ends_at ? format(new Date(a.ends_at), "yyyy-MM-dd HH:mm") : "",
        format(new Date(a.created_at), "yyyy-MM-dd HH:mm"),
      ]),
    ];

    const csvContent = csvRows.map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `announcements-${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Announcements exported to CSV");
  };

  const getStatusText = (announcement: Announcement) => {
    const now = new Date();
    const startsAt = new Date(announcement.starts_at);
    const endsAt = announcement.ends_at ? new Date(announcement.ends_at) : null;

    if (!announcement.is_active) return "inactive";
    if (startsAt > now) return "scheduled";
    if (endsAt && endsAt < now) return "expired";
    return "active";
  };

  const getStatusBadge = (announcement: Announcement) => {
    const status = getStatusText(announcement);
    
    switch (status) {
      case "active":
        return (
          <Badge variant="outline" className="rounded-full border-[#22C7A1]/25 bg-[#22C7A1]/10 px-3 py-1 text-[#22C7A1]">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case "scheduled":
        return (
          <Badge variant="outline" className="rounded-full border-[#7C83F6]/25 bg-[#7C83F6]/10 px-3 py-1 text-[#7C83F6]">
            <Clock className="h-3 w-3 mr-1" />
            Scheduled
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="outline" className="rounded-full border-[#94A3B8]/25 bg-[#F6F8FB] px-3 py-1 text-[#94A3B8]">
            <Calendar className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="rounded-full border-[#FB6B7A]/25 bg-[#FB6B7A]/10 px-3 py-1 text-[#FB6B7A]">
            <XCircle className="h-3 w-3 mr-1" />
            Inactive
          </Badge>
        );
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "warning":
        return (
          <Badge variant="outline" className="rounded-full border-[#7C83F6]/25 bg-[#7C83F6]/10 px-3 py-1 text-[#7C83F6]">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Warning
          </Badge>
        );
      case "success":
        return (
          <Badge variant="outline" className="rounded-full border-[#22C7A1]/25 bg-[#22C7A1]/10 px-3 py-1 text-[#22C7A1]">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Success
          </Badge>
        );
      case "error":
        return (
          <Badge variant="outline" className="rounded-full border-[#FB6B7A]/25 bg-[#FB6B7A]/10 px-3 py-1 text-[#FB6B7A]">
            <XCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="rounded-full border-[#38BDF8]/25 bg-[#38BDF8]/10 px-3 py-1 text-[#0284C7]">
            <Info className="h-3 w-3 mr-1" />
            Info
          </Badge>
        );
    }
  };

  const getAudienceIcon = (audience: string) => {
    switch (audience) {
      case "partners":
        return <Store className="h-4 w-4" />;
      case "admins":
        return <Shield className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  const getAudienceBadge = (audience: string) => {
    const labels: Record<string, string> = {
      all: "All Users",
      users: "Customers",
      partners: "Partners",
    };
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-[#E5EAF1] bg-[#F6F8FB] px-3 py-1 text-sm font-bold text-[#020617]">
        {getAudienceIcon(audience)}
        <span className="capitalize">{labels[audience] || audience}</span>
      </div>
    );
  };

  const tabs: { value: TabValue; label: string; count: number }[] = [
    { value: "all", label: "All", count: stats.total },
    { value: "active", label: "Active", count: stats.active },
    { value: "scheduled", label: "Scheduled", count: stats.scheduled },
    { value: "expired", label: "Expired", count: stats.expired },
  ];

  const filteredAnnouncements = announcements.filter((announcement) => {
    const matchesSearch =
      announcement.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      announcement.message.toLowerCase().includes(searchQuery.toLowerCase());
    
    const status = getStatusText(announcement);
    const matchesTab = 
      activeTab === "all" ||
      (activeTab === "inactive" && status === "inactive") ||
      activeTab === status;

    return matchesSearch && matchesTab;
  });

  if (loading) {
    return (
      <AdminLayout title="Announcements" subtitle="Manage platform announcements and notifications">
        <div className="space-y-6 bg-[#F6F8FB] text-[#020617]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32 rounded-[24px] bg-white" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-[28px] bg-white" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Announcements" subtitle="Manage platform announcements and notifications">
      <div className="space-y-6 bg-[#F6F8FB] text-[#020617]">
        <section className="overflow-hidden rounded-[28px] border border-[#E2E8F0] bg-white shadow-[0_18px_45px_rgba(2,6,23,0.06)]">
          <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-[#22C7A1]/15 text-[#047857]">
                <Megaphone className="h-7 w-7" />
              </div>
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#22C7A1]">
                  Broadcast center
                </p>
                <h2 className="mt-1 text-[28px] font-black leading-tight text-[#020617]">
                  Notifications
                </h2>
                <p className="mt-1 max-w-lg text-sm font-semibold leading-5 text-[#94A3B8]">
                  Compose announcements, target audiences, schedule visibility, and send platform updates.
                </p>
              </div>
            </div>
            <Button
              onClick={() => {
                resetForm();
                setFormOpen(true);
              }}
              className="h-12 rounded-2xl bg-[#020617] px-5 font-extrabold text-white shadow-[0_12px_24px_rgba(2,6,23,0.16)] hover:bg-[#020617]/90"
            >
              <Plus className="mr-2 h-4 w-4" />
              New Announcement
            </Button>
          </div>
        </section>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="rounded-[24px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#94A3B8]">Total Announcements</p>
                  <p className="mt-2 text-2xl font-black text-[#020617]">{stats.total}</p>
                  <p className="mt-1 text-xs font-semibold text-[#38BDF8]">All time</p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#38BDF8]/12">
                  <Megaphone className="h-6 w-6 text-[#38BDF8]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#94A3B8]">Currently Active</p>
                  <p className="mt-2 text-2xl font-black text-[#020617]">{stats.active}</p>
                  <p className="mt-1 text-xs font-semibold text-[#22C7A1]">Visible now</p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#22C7A1]/10">
                  <Eye className="h-6 w-6 text-[#22C7A1]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#94A3B8]">Scheduled</p>
                  <p className="mt-2 text-2xl font-black text-[#020617]">{stats.scheduled}</p>
                  <p className="mt-1 text-xs font-semibold text-[#7C83F6]">Pending start</p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#7C83F6]/10">
                  <Clock className="h-6 w-6 text-[#7C83F6]" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#94A3B8]">Expired</p>
                  <p className="mt-2 text-2xl font-black text-[#020617]">{stats.expired}</p>
                  <p className="mt-1 text-xs font-semibold text-[#FB6B7A]">Past end date</p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#FB6B7A]/10">
                  <Calendar className="h-6 w-6 text-[#FB6B7A]" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Actions */}
        <Card className="rounded-[28px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
              <div className="relative flex-1 w-full max-w-md">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <Input
                  placeholder="Search announcements..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="min-h-[48px] rounded-2xl border-[#E2E8F0] bg-[#F6F8FB] pl-11 font-bold text-[#020617] placeholder:text-[#94A3B8]"
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={handleExportCSV} className="min-h-[48px] rounded-2xl border-[#E2E8F0] bg-white px-5 font-extrabold text-[#020617] hover:bg-[#F6F8FB]">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button 
                  onClick={() => {
                    resetForm();
                    setFormOpen(true);
                  }} 
                  className="min-h-[48px] rounded-2xl bg-[#22C7A1] px-5 font-extrabold text-white hover:bg-[#1DB492]"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Announcement
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs and Table */}
        <Card className="overflow-hidden rounded-[28px] border-[#E2E8F0] bg-white shadow-[0_14px_34px_rgba(2,6,23,0.05)]">
          <CardContent className="p-0">
            {/* Tabs */}
            <div className="border-b border-[#E2E8F0] bg-white px-4 py-4">
              <div className="flex gap-2 overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={`min-h-[44px] shrink-0 rounded-2xl px-4 py-2 text-sm font-extrabold transition-colors ${
                      activeTab === tab.value
                        ? "bg-[#020617] text-white shadow-[0_12px_28px_rgba(2,6,23,0.18)]"
                        : "border border-[#E2E8F0] bg-[#F6F8FB] text-[#64748B] hover:bg-white hover:text-[#020617]"
                    }`}
                  >
                    {tab.label}
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                      activeTab === tab.value
                        ? "bg-white/20 text-white"
                        : "bg-white text-[#94A3B8]"
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Bulk Actions */}
            {selectedAnnouncements.size > 0 && (
              <div className="flex flex-col gap-3 border-b border-[#E2E8F0] bg-[#22C7A1]/10 px-4 py-3 sm:flex-row sm:items-center">
                <span className="text-sm font-bold text-[#020617]">{selectedAnnouncements.size} selected</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBulkDelete}
                  className="rounded-xl border-[#FB6B7A]/25 bg-white text-[#FB6B7A] hover:bg-[#FB6B7A]/10"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete All
                </Button>
              </div>
            )}

            {/* Table */}
            {filteredAnnouncements.length === 0 ? (
              <div className="text-center py-16">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#F6F8FB]">
                  <Bell className="h-8 w-8 text-[#94A3B8]" />
                </div>
                <p className="text-lg font-black text-[#020617]">
                  {searchQuery ? "No announcements match your search" : "No announcements yet"}
                </p>
              </div>
            ) : (
              <>
              <div className="grid gap-3 p-4 md:hidden">
                {filteredAnnouncements.map((announcement) => (
                  <article
                    key={announcement.id}
                    className="rounded-[24px] border border-[#E2E8F0] bg-[#F6F8FB] p-4"
                    onClick={() => {
                      setSelectedAnnouncement(announcement);
                      setDetailOpen(true);
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-black text-[#020617]">{announcement.title}</p>
                        <p className="mt-1 line-clamp-2 text-sm font-semibold text-[#94A3B8]">
                          {announcement.message}
                        </p>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedAnnouncements.has(announcement.id)}
                          onCheckedChange={() => toggleAnnouncementSelection(announcement.id)}
                        />
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {getTypeBadge(announcement.type)}
                      {getStatusBadge(announcement)}
                      {getAudienceBadge(announcement.target_audience)}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-[#E2E8F0] pt-3">
                      <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#94A3B8]">Starts</p>
                        <p className="text-sm font-black text-[#020617]">
                          {format(new Date(announcement.starts_at), "MMM d, yyyy")}
                        </p>
                      </div>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-11 w-11 rounded-2xl border-[#E2E8F0] bg-white text-[#020617]"
                          onClick={() => handleEdit(announcement)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-11 w-11 rounded-2xl border-[#7C83F6]/25 bg-white text-[#7C83F6]"
                          onClick={() => handleSendNotification(announcement)}
                          disabled={sending}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden overflow-x-auto md:block">
                <Table>
                  <TableHeader className="bg-[#F6F8FB]">
                    <TableRow className="border-[#E2E8F0] hover:bg-[#F6F8FB]">
                      <TableHead className="w-12">
                        <Checkbox
                          checked={filteredAnnouncements.length > 0 && selectedAnnouncements.size === filteredAnnouncements.length}
                          onCheckedChange={toggleAllSelection}
                        />
                      </TableHead>
                      <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">Title</TableHead>
                      <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">Type</TableHead>
                      <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">Audience</TableHead>
                      <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">Status</TableHead>
                      <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">Schedule</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAnnouncements.map((announcement) => (
                      <TableRow 
                        key={announcement.id}
                        className="cursor-pointer border-[#E2E8F0] hover:bg-[#F6F8FB]"
                        onClick={() => {
                          setSelectedAnnouncement(announcement);
                          setDetailOpen(true);
                        }}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedAnnouncements.has(announcement.id)}
                            onCheckedChange={() => toggleAnnouncementSelection(announcement.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-bold text-[#020617]">{announcement.title}</p>
                            <p className="line-clamp-1 text-sm font-medium text-[#94A3B8]">
                              {announcement.message}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{getTypeBadge(announcement.type)}</TableCell>
                        <TableCell>{getAudienceBadge(announcement.target_audience)}</TableCell>
                        <TableCell>{getStatusBadge(announcement)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="font-bold text-[#020617]">{format(new Date(announcement.starts_at), "MMM d, yyyy")}</p>
                            {announcement.ends_at && (
                              <p className="font-medium text-[#94A3B8]">
                                to {format(new Date(announcement.ends_at), "MMM d, yyyy")}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-[#94A3B8] hover:bg-[#F6F8FB] hover:text-[#020617]">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(announcement)}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleSendNotification(announcement)} disabled={sending}>
                                <Send className="h-4 w-4 mr-2" />
                                Send as Notification
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => toggleActive(announcement)}
                              >
                                {announcement.is_active ? (
                                  <>
                                    <XCircle className="h-4 w-4 mr-2" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                    Activate
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedAnnouncement(announcement);
                                  setDeleteDialogOpen(true);
                                }}
                                className="text-[#FB6B7A]"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full overflow-y-auto border-[#E5EAF1] bg-[#F6F8FB] text-[#020617] sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="text-[#020617]">Announcement Details</SheetTitle>
            <SheetDescription className="text-[#94A3B8]">
              View complete announcement information
            </SheetDescription>
          </SheetHeader>
          
          {selectedAnnouncement && (
            <div className="mt-6 space-y-6">
              <div className={`rounded-[24px] border p-4 ${
                selectedAnnouncement.type === "warning" ? "border-[#7C83F6]/20 bg-[#7C83F6]/10" :
                selectedAnnouncement.type === "success" ? "border-[#22C7A1]/20 bg-[#22C7A1]/10" :
                selectedAnnouncement.type === "error" ? "border-[#FB6B7A]/20 bg-[#FB6B7A]/10" :
                "border-[#38BDF8]/20 bg-[#38BDF8]/10"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {getTypeBadge(selectedAnnouncement.type)}
                  {getStatusBadge(selectedAnnouncement)}
                </div>
                <h3 className="text-lg font-black text-[#020617]">{selectedAnnouncement.title}</h3>
              </div>

              <div className="space-y-4">
                <div className="rounded-[24px] border border-[#E5EAF1] bg-white p-4">
                  <p className="mb-1 text-sm font-bold text-[#94A3B8]">Message</p>
                  <p className="text-sm font-medium leading-6 text-[#020617]">{selectedAnnouncement.message}</p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#38BDF8]/10">
                    <Users className="h-4 w-4 text-[#38BDF8]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#94A3B8]">Target Audience</p>
                    <div className="mt-1">{getAudienceBadge(selectedAnnouncement.target_audience)}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#7C83F6]/10">
                    <Calendar className="h-4 w-4 text-[#7C83F6]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#94A3B8]">Schedule</p>
                    <p className="font-bold text-[#020617]">
                      From: {format(new Date(selectedAnnouncement.starts_at), "MMMM d, yyyy 'at' h:mm a")}
                    </p>
                    {selectedAnnouncement.ends_at && (
                      <p className="font-medium text-[#94A3B8]">
                        Until: {format(new Date(selectedAnnouncement.ends_at), "MMMM d, yyyy 'at' h:mm a")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#22C7A1]/10">
                    <Bell className="h-4 w-4 text-[#22C7A1]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#94A3B8]">Created</p>
                    <p className="font-bold text-[#020617]">{format(new Date(selectedAnnouncement.created_at), "MMMM d, yyyy 'at' h:mm a")}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  className="min-h-[44px] flex-1 rounded-2xl bg-[#020617] text-white hover:bg-[#020617]/90"
                  onClick={() => {
                    setDetailOpen(false);
                    handleEdit(selectedAnnouncement);
                  }}
                >
                  <Edit2 className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleSendNotification(selectedAnnouncement)}
                  disabled={sending}
                  className="min-h-[44px] rounded-2xl border-[#7C83F6]/25 text-[#7C83F6] hover:bg-[#7C83F6]/10"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </Button>
                <Button
                  variant="outline"
                  className="min-h-[44px] rounded-2xl border-[#FB6B7A]/25 text-[#FB6B7A] hover:bg-[#FB6B7A]/10"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create/Edit Sheet */}
      <Sheet open={formOpen} onOpenChange={setFormOpen}>
        <SheetContent className="w-full overflow-y-auto border-[#E5EAF1] bg-[#F6F8FB] text-[#020617] sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="text-[#020617]">
              {selectedAnnouncement ? "Edit Announcement" : "Create Announcement"}
            </SheetTitle>
            <SheetDescription className="text-[#94A3B8]">
              {selectedAnnouncement
                ? "Update the announcement details"
                : "Create a new platform announcement"}
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title" className="font-bold text-[#020617]">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Announcement title"
                className="min-h-[48px] rounded-2xl border-[#E5EAF1] bg-white text-[#020617] placeholder:text-[#94A3B8]"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="message" className="font-bold text-[#020617]">Message *</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Write your announcement..."
                rows={4}
                className="rounded-2xl border-[#E5EAF1] bg-white text-[#020617] placeholder:text-[#94A3B8]"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-bold text-[#020617]">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value as "info" | "warning" | "success" | "error" })}
                >
                  <SelectTrigger className="min-h-[48px] rounded-2xl border-[#E5EAF1] bg-white text-[#020617]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="error">Error</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-bold text-[#020617]">Target Audience</Label>
                <Select
                  value={formData.target_audience}
                  onValueChange={(value) => setFormData({ ...formData, target_audience: value as "all" | "users" | "partners" })}
                >
                  <SelectTrigger className="min-h-[48px] rounded-2xl border-[#E5EAF1] bg-white text-[#020617]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="users">Customers</SelectItem>
                    <SelectItem value="partners">Partners</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="starts_at" className="font-bold text-[#020617]">Start Date *</Label>
                <Input
                  id="starts_at"
                  type="datetime-local"
                  value={formData.starts_at}
                  onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                  className="min-h-[48px] rounded-2xl border-[#E5EAF1] bg-white text-[#020617]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ends_at" className="font-bold text-[#020617]">End Date (optional)</Label>
                <Input
                  id="ends_at"
                  type="datetime-local"
                  value={formData.ends_at}
                  onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                  className="min-h-[48px] rounded-2xl border-[#E5EAF1] bg-white text-[#020617]"
                />
              </div>
            </div>
            
            <div className="flex min-h-[52px] items-center gap-3 rounded-2xl border border-[#E5EAF1] bg-white px-4">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active" className="font-bold text-[#020617]">Active immediately</Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                className="min-h-[44px] flex-1 rounded-2xl bg-[#020617] text-white hover:bg-[#020617]/90" 
                onClick={handleSubmit} 
                disabled={saving}
              >
                {saving && <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />}
                {selectedAnnouncement ? "Update" : "Create"}
              </Button>
              <Button variant="outline" onClick={() => setFormOpen(false)} className="min-h-[44px] rounded-2xl border-[#E5EAF1] text-[#020617] hover:bg-white">
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="border-[#E5EAF1] bg-white text-[#020617]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[#020617]">Delete Announcement</AlertDialogTitle>
            <AlertDialogDescription className="text-[#94A3B8]">
              Are you sure you want to delete "{selectedAnnouncement?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[44px] rounded-2xl border-[#E5EAF1] text-[#020617] hover:bg-[#F6F8FB]">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="min-h-[44px] rounded-2xl bg-[#FB6B7A] text-white hover:bg-[#EF5A6B]">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
