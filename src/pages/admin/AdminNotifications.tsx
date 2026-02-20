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
  target_audience: "all" | "customers" | "partners" | "admins";
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
  target_audience: "all" | "customers" | "partners" | "admins";
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
    target_audience: "all",
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
      if (announcement.target_audience === "partners") {
        const { data: partnerRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "partner");
        
        if (partnerRoles && partnerRoles.length > 0) {
          const notifications = partnerRoles.map((r) => ({
            user_id: r.user_id,
            type: "announcement",
            title: announcement.title,
            message: announcement.message,
            metadata: { announcement_type: announcement.type },
          }));

          const { error } = await supabase.from("notifications").insert(notifications);
          if (error) throw error;
          toast.success(`Sent to ${notifications.length} partners`);
        }
      } else if (announcement.target_audience === "admins") {
        const { data: adminRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "admin");
        
        if (adminRoles && adminRoles.length > 0) {
          const notifications = adminRoles.map((r) => ({
            user_id: r.user_id,
            type: "announcement",
            title: announcement.title,
            message: announcement.message,
            metadata: { announcement_type: announcement.type },
          }));

          const { error } = await supabase.from("notifications").insert(notifications);
          if (error) throw error;
          toast.success(`Sent to ${notifications.length} admins`);
        }
      } else {
        const { data: profiles } = await supabase.from("profiles").select("user_id");
        
        if (profiles && profiles.length > 0) {
          const notifications = profiles.map((p) => ({
            user_id: p.user_id,
            type: "announcement",
            title: announcement.title,
            message: announcement.message,
            metadata: { announcement_type: announcement.type },
          }));

          const { error } = await supabase.from("notifications").insert(notifications);
          if (error) throw error;
          toast.success(`Sent to ${notifications.length} users`);
        }
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
      target_audience: announcement.target_audience as "all" | "customers" | "partners" | "admins",
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
      target_audience: "all",
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
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case "scheduled":
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Clock className="h-3 w-3 mr-1" />
            Scheduled
          </Badge>
        );
      case "expired":
        return (
          <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
            <Calendar className="h-3 w-3 mr-1" />
            Expired
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
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
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Warning
          </Badge>
        );
      case "success":
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Success
          </Badge>
        );
      case "error":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            <XCircle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
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
      customers: "Customers",
      partners: "Partners",
      admins: "Admins",
    };
    return (
      <div className="flex items-center gap-2">
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
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-xl" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Announcements" subtitle="Manage platform announcements and notifications">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Announcements</p>
                  <p className="text-3xl font-bold mt-1">{stats.total}</p>
                  <p className="text-xs text-muted-foreground mt-1">All time</p>
                </div>
                <div className="p-3 rounded-full bg-primary/10">
                  <Megaphone className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Currently Active</p>
                  <p className="text-3xl font-bold mt-1">{stats.active}</p>
                  <p className="text-xs text-emerald-600 mt-1">Visible now</p>
                </div>
                <div className="p-3 rounded-full bg-emerald-500/10">
                  <Eye className="h-6 w-6 text-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Scheduled</p>
                  <p className="text-3xl font-bold mt-1">{stats.scheduled}</p>
                  <p className="text-xs text-blue-600 mt-1">Pending start</p>
                </div>
                <div className="p-3 rounded-full bg-blue-500/10">
                  <Clock className="h-6 w-6 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Expired</p>
                  <p className="text-3xl font-bold mt-1">{stats.expired}</p>
                  <p className="text-xs text-slate-600 mt-1">Past end date</p>
                </div>
                <div className="p-3 rounded-full bg-slate-500/10">
                  <Calendar className="h-6 w-6 text-slate-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Actions */}
        <Card className="border-dashed">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
              <div className="relative flex-1 w-full max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search announcements..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 min-h-[44px]"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleExportCSV} className="min-h-[44px]">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button 
                  onClick={() => {
                    resetForm();
                    setFormOpen(true);
                  }} 
                  className="min-h-[44px]"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  New Announcement
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs and Table */}
        <Card>
          <CardContent className="p-0">
            {/* Tabs */}
            <div className="border-b px-4 py-3">
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] ${
                      activeTab === tab.value
                        ? "bg-primary text-white"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                    }`}
                  >
                    {tab.label}
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                      activeTab === tab.value
                        ? "bg-white/20 text-white"
                        : "bg-background text-muted-foreground"
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Bulk Actions */}
            {selectedAnnouncements.size > 0 && (
              <div className="px-4 py-3 bg-muted/50 border-b flex items-center gap-4">
                <span className="text-sm font-medium">{selectedAnnouncements.size} selected</span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleBulkDelete}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete All
                </Button>
              </div>
            )}

            {/* Table */}
            {filteredAnnouncements.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
                  <Bell className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">
                  {searchQuery ? "No announcements match your search" : "No announcements yet"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={filteredAnnouncements.length > 0 && selectedAnnouncements.size === filteredAnnouncements.length}
                          onCheckedChange={toggleAllSelection}
                        />
                      </TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Audience</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Schedule</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAnnouncements.map((announcement) => (
                      <TableRow 
                        key={announcement.id}
                        className="cursor-pointer hover:bg-muted/50"
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
                            <p className="font-medium">{announcement.title}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {announcement.message}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{getTypeBadge(announcement.type)}</TableCell>
                        <TableCell>{getAudienceBadge(announcement.target_audience)}</TableCell>
                        <TableCell>{getStatusBadge(announcement)}</TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{format(new Date(announcement.starts_at), "MMM d, yyyy")}</p>
                            {announcement.ends_at && (
                              <p className="text-muted-foreground">
                                to {format(new Date(announcement.ends_at), "MMM d, yyyy")}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
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
                                className="text-red-600"
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
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detail Sheet */}
      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Announcement Details</SheetTitle>
            <SheetDescription>
              View complete announcement information
            </SheetDescription>
          </SheetHeader>
          
          {selectedAnnouncement && (
            <div className="mt-6 space-y-6">
              <div className={`p-4 rounded-lg border ${
                selectedAnnouncement.type === "warning" ? "bg-amber-50 border-amber-100" :
                selectedAnnouncement.type === "success" ? "bg-emerald-50 border-emerald-100" :
                selectedAnnouncement.type === "error" ? "bg-red-50 border-red-100" :
                "bg-blue-50 border-blue-100"
              }`}>
                <div className="flex items-center gap-2 mb-2">
                  {getTypeBadge(selectedAnnouncement.type)}
                  {getStatusBadge(selectedAnnouncement)}
                </div>
                <h3 className="text-lg font-semibold">{selectedAnnouncement.title}</h3>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Message</p>
                  <p className="text-sm">{selectedAnnouncement.message}</p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Target Audience</p>
                    <p className="font-medium">{getAudienceBadge(selectedAnnouncement.target_audience)}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Schedule</p>
                    <p className="font-medium">
                      From: {format(new Date(selectedAnnouncement.starts_at), "MMMM d, yyyy 'at' h:mm a")}
                    </p>
                    {selectedAnnouncement.ends_at && (
                      <p className="text-muted-foreground">
                        Until: {format(new Date(selectedAnnouncement.ends_at), "MMMM d, yyyy 'at' h:mm a")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Bell className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-medium">{format(new Date(selectedAnnouncement.created_at), "MMMM d, yyyy 'at' h:mm a")}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  className="flex-1"
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
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send
                </Button>
                <Button
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50"
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
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {selectedAnnouncement ? "Edit Announcement" : "Create Announcement"}
            </SheetTitle>
            <SheetDescription>
              {selectedAnnouncement
                ? "Update the announcement details"
                : "Create a new platform announcement"}
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Announcement title"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="message">Message *</Label>
              <Textarea
                id="message"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Write your announcement..."
                rows={4}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value as "info" | "warning" | "success" | "error" })}
                >
                  <SelectTrigger>
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
                <Label>Target Audience</Label>
                <Select
                  value={formData.target_audience}
                  onValueChange={(value) => setFormData({ ...formData, target_audience: value as "all" | "customers" | "partners" | "admins" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="customers">Customers</SelectItem>
                    <SelectItem value="partners">Partners</SelectItem>
                    <SelectItem value="admins">Admins</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="starts_at">Start Date *</Label>
                <Input
                  id="starts_at"
                  type="datetime-local"
                  value={formData.starts_at}
                  onChange={(e) => setFormData({ ...formData, starts_at: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ends_at">End Date (optional)</Label>
                <Input
                  id="ends_at"
                  type="datetime-local"
                  value={formData.ends_at}
                  onChange={(e) => setFormData({ ...formData, ends_at: e.target.value })}
                />
              </div>
            </div>
            
            <div className="flex items-center gap-2 pt-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
              <Label htmlFor="is_active">Active immediately</Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button 
                className="flex-1" 
                onClick={handleSubmit} 
                disabled={saving}
              >
                {saving && <div className="animate-spin mr-2 h-4 w-4 border-2 border-current border-t-transparent rounded-full" />}
                {selectedAnnouncement ? "Update" : "Create"}
              </Button>
              <Button variant="outline" onClick={() => setFormOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Announcement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{selectedAnnouncement?.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
