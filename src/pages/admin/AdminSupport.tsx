import { useState, useEffect, useRef, useCallback } from "react";
import { AdminLayout } from "@/components/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { createPrivateStorageUrl } from "@/lib/private-storage";
import {
  Search,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  Send,
  User,
  Filter,
  Paperclip,
  Image,
  FileText,
  ExternalLink,
  X,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  description: string;
  category: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  assigned_to: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
  user_email?: string;
  user_name?: string;
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  message: string;
  is_admin_reply: boolean;
  created_at: string;
}

interface TicketAttachment {
  id: string;
  ticket_id: string;
  message_id: string | null;
  file_name: string;
  file_url: string;
  file_type: string | null;
  created_at: string;
}

export default function AdminSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [replyAttachments, setReplyAttachments] = useState<File[]>([]);
  const [sendingMessage, setSendingMessage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
  });
  const { toast } = useToast();
  const { user } = useAuth();

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      const { data: ticketsData, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch user profiles for tickets
      const userIds = [
        ...new Set((ticketsData || []).map((t) => t.user_id).filter(Boolean)),
      ];

      let profileMap = new Map();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

        profileMap = new Map(
          profiles?.map((p) => [p.user_id, p.full_name]) || [],
        );
      }

      const ticketsWithUsers =
        ticketsData?.map((ticket) => ({
          ...ticket,
          user_name: profileMap.get(ticket.user_id) || "Unknown User",
        })) || [];

      setTickets(ticketsWithUsers as Ticket[]);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      toast({
        title: "Error",
        description: "Failed to fetch support tickets",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const fetchStats = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("status");

      if (error) throw error;

      const total = data?.length || 0;
      const open = data?.filter((t) => t.status === "open").length || 0;
      const inProgress =
        data?.filter((t) => t.status === "in_progress").length || 0;
      const resolved =
        data?.filter((t) => t.status === "resolved" || t.status === "closed")
          .length || 0;

      setStats({ total, open, inProgress, resolved });
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
    fetchStats();
  }, [fetchTickets, fetchStats]);

  useEffect(() => {
    if (selectedTicket) {
      fetchMessages(selectedTicket.id);
      fetchAttachments(selectedTicket.id);
    }
  }, [selectedTicket]);

  const fetchMessages = async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages((data || []).map((message) => ({
        id: message.id,
        ticket_id: message.ticket_id,
        sender_id: message.sender_id,
        message: message.message,
        is_admin_reply: message.is_internal,
        created_at: message.created_at,
      })));
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const fetchAttachments = async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from("ticket_attachments")
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      const signedAttachments = await Promise.all(
        ((data || []) as TicketAttachment[]).map(async (attachment) => ({
          ...attachment,
          file_url: await createPrivateStorageUrl("ticket-attachments", attachment.file_url),
        })),
      );
      setAttachments(signedAttachments);
    } catch (error) {
      console.error("Error fetching attachments:", error);
    }
  };

  const getFileIcon = (type: string | null) => {
    if (type?.startsWith("image/")) return <Image className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const isImage = (type: string | null) => type?.startsWith("image/");

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    try {
      const updateData: Partial<
        Pick<Ticket, "status" | "assigned_to" | "resolved_at">
      > = { status: newStatus as Ticket["status"] };
      if (newStatus === "resolved") {
        updateData.resolved_at = new Date().toISOString();
      }
      if (newStatus === "in_progress" && user) {
        updateData.assigned_to = user.id;
      }

      const { error } = await supabase
        .from("support_tickets")
        .update(updateData)
        .eq("id", ticketId);

      if (error) throw error;

      toast({ title: "Success", description: "Ticket status updated" });
      fetchTickets();
      fetchStats();

      if (selectedTicket?.id === ticketId) {
        setSelectedTicket((prev) =>
          prev ? { ...prev, status: newStatus as Ticket["status"] } : null,
        );
      }
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Error",
        description: "Failed to update ticket status",
        variant: "destructive",
      });
    }
  };

  const handlePriorityChange = async (
    ticketId: string,
    newPriority: "low" | "medium" | "high" | "urgent",
  ) => {
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ priority: newPriority })
        .eq("id", ticketId);

      if (error) throw error;

      toast({ title: "Success", description: "Ticket priority updated" });
      fetchTickets();

      if (selectedTicket?.id === ticketId) {
        setSelectedTicket((prev) =>
          prev ? { ...prev, priority: newPriority } : null,
        );
      }
    } catch (error) {
      console.error("Error updating priority:", error);
      toast({
        title: "Error",
        description: "Failed to update ticket priority",
        variant: "destructive",
      });
    }
  };

  const uploadFiles = async (
    files: File[],
    ticketId: string,
    messageId: string,
  ) => {
    const uploadedAttachments = [];
    for (const file of files) {
      const fileExt = file.name.split(".").pop();
      const filePath = `${ticketId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("ticket-attachments")
        .upload(filePath, file);
      if (uploadError) throw uploadError;

      uploadedAttachments.push({
        ticket_id: ticketId,
        message_id: messageId,
        file_name: file.name,
        file_url: filePath,
        file_size: file.size,
        file_type: file.type,
        uploaded_by: user!.id,
      });
    }
    if (uploadedAttachments.length > 0) {
      const { error } = await supabase
        .from("ticket_attachments")
        .insert(uploadedAttachments);
      if (error) throw error;
    }
  };

  const handleSendMessage = async () => {
    if (
      (!newMessage.trim() && replyAttachments.length === 0) ||
      !selectedTicket ||
      !user
    )
      return;

    setSendingMessage(true);
    try {
      const { data, error } = await supabase
        .from("ticket_messages")
        .insert({
          ticket_id: selectedTicket.id,
          sender_id: user.id,
          message: newMessage.trim() || "(attachment)",
          is_internal: true,
        })
        .select()
        .single();

      if (error) throw error;

      if (replyAttachments.length > 0) {
        await uploadFiles(replyAttachments, selectedTicket.id, data.id);
      }

      setNewMessage("");
      setReplyAttachments([]);
      fetchMessages(selectedTicket.id);
      fetchAttachments(selectedTicket.id);

      // Auto-update status to in_progress if it was open
      if (selectedTicket.status === "open") {
        handleStatusChange(selectedTicket.id, "in_progress");
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((f) => f.size <= 10 * 1024 * 1024);
    if (validFiles.length !== files.length) {
      toast({
        title: "Warning",
        description: "Some files exceeded 10MB limit",
        variant: "destructive",
      });
    }
    setReplyAttachments((prev) => [...prev, ...validFiles]);
    e.target.value = "";
  };

  const removeAttachment = (index: number) => {
    setReplyAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return (
          <Badge
            variant="outline"
            className="rounded-full border-[#FB6B7A]/25 bg-[#FB6B7A]/10 px-3 py-1 text-[#FB6B7A]"
          >
            Open
          </Badge>
        );
      case "in_progress":
        return (
          <Badge
            variant="outline"
            className="rounded-full border-[#38BDF8]/25 bg-[#38BDF8]/10 px-3 py-1 text-[#0284C7]"
          >
            In Progress
          </Badge>
        );
      case "resolved":
        return (
          <Badge
            variant="outline"
            className="rounded-full border-[#22C7A1]/25 bg-[#22C7A1]/10 px-3 py-1 text-[#22C7A1]"
          >
            Resolved
          </Badge>
        );
      case "closed":
        return (
          <Badge
            variant="outline"
            className="rounded-full border-[#E5EAF1] bg-[#F6F8FB] px-3 py-1 text-[#94A3B8]"
          >
            Closed
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="rounded-full border-[#E5EAF1] px-3 py-1 text-[#94A3B8]"
          >
            {status}
          </Badge>
        );
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "urgent":
        return (
          <Badge
            variant="outline"
            className="rounded-full border-[#FB6B7A]/25 bg-[#FB6B7A]/10 px-3 py-1 text-[#FB6B7A]"
          >
            Urgent
          </Badge>
        );
      case "high":
        return (
          <Badge
            variant="outline"
            className="rounded-full border-[#F97316]/25 bg-[#F97316]/10 px-3 py-1 text-[#F97316]"
          >
            High
          </Badge>
        );
      case "medium":
        return (
          <Badge
            variant="outline"
            className="rounded-full border-[#7C83F6]/25 bg-[#7C83F6]/10 px-3 py-1 text-[#7C83F6]"
          >
            Medium
          </Badge>
        );
      case "low":
        return (
          <Badge
            variant="outline"
            className="rounded-full border-[#E5EAF1] bg-[#F6F8FB] px-3 py-1 text-[#94A3B8]"
          >
            Low
          </Badge>
        );
      default:
        return (
          <Badge
            variant="outline"
            className="rounded-full border-[#E5EAF1] px-3 py-1 text-[#94A3B8]"
          >
            {priority}
          </Badge>
        );
    }
  };

  const filteredTickets = tickets.filter((ticket) => {
    const matchesSearch =
      ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.user_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ticket.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" || ticket.status === statusFilter;
    const matchesPriority =
      priorityFilter === "all" || ticket.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  return (
    <AdminLayout title="Support" subtitle="Manage customer support requests">
      <div className="space-y-6 bg-[#F6F8FB] text-[#020617]">
        <section className="overflow-hidden rounded-[28px] border border-[#E5EAF1] bg-white p-5 text-[#020617] shadow-[0_18px_44px_rgba(2,6,23,0.06)] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#38BDF8]/20 bg-[#38BDF8]/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-[#38BDF8]">
                <MessageSquare className="h-3.5 w-3.5" />
                Support desk
              </div>
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">
                Customer ticket queue
              </h2>
              <p className="mt-2 max-w-xl text-sm font-semibold leading-6 text-[#94A3B8]">
                Prioritize open cases, reply with attachments, and keep support
                status visible across the team.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:min-w-[320px]">
              <div className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#94A3B8]">
                  Open
                </p>
                <p className="mt-2 text-xl font-black text-[#020617]">{stats.open}</p>
              </div>
              <div className="rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#94A3B8]">
                  Active
                </p>
                <p className="mt-2 text-xl font-black text-[#020617]">{stats.inProgress}</p>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="rounded-[24px] border-[#E5EAF1] bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#94A3B8]">
                    Total Tickets
                  </p>
                  <div className="mt-2 text-2xl font-black text-[#020617]">
                    {stats.total}
                  </div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#7C83F6]/10">
                  <MessageSquare className="h-5 w-5 text-[#7C83F6]" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-[24px] border-[#E5EAF1] bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#94A3B8]">
                    Open
                  </p>
                  <div className="mt-2 text-2xl font-black text-[#FB6B7A]">
                    {stats.open}
                  </div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FB6B7A]/10">
                  <AlertCircle className="h-5 w-5 text-[#FB6B7A]" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-[24px] border-[#E5EAF1] bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#94A3B8]">
                    In Progress
                  </p>
                  <div className="mt-2 text-2xl font-black text-[#38BDF8]">
                    {stats.inProgress}
                  </div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#38BDF8]/10">
                  <Clock className="h-5 w-5 text-[#38BDF8]" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-[24px] border-[#E5EAF1] bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#94A3B8]">
                    Resolved
                  </p>
                  <div className="mt-2 text-2xl font-black text-[#22C7A1]">
                    {stats.resolved}
                  </div>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#22C7A1]/10">
                  <CheckCircle2 className="h-5 w-5 text-[#22C7A1]" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="rounded-[24px] border-[#E5EAF1] bg-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-center">
              <div className="relative flex-1 w-full max-w-sm">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <Input
                  placeholder="Search tickets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="min-h-[48px] rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] pl-11 text-[#020617] placeholder:text-[#94A3B8]"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="min-h-[48px] w-full rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] text-[#020617] sm:w-[160px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="min-h-[48px] w-full rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] text-[#020617] sm:w-[160px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tickets Table */}
        <Card className="overflow-hidden rounded-[28px] border-[#E5EAF1] bg-white shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#F6F8FB]">
                  <TableRow className="border-[#E5EAF1] hover:bg-[#F6F8FB]">
                    <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Ticket
                    </TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Customer
                    </TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Category
                    </TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Priority
                    </TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Status
                    </TableHead>
                    <TableHead className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Created
                    </TableHead>
                    <TableHead className="text-right text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-10 text-center font-semibold text-[#94A3B8]"
                      >
                        Loading tickets...
                      </TableCell>
                    </TableRow>
                  ) : filteredTickets.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="py-10 text-center font-semibold text-[#94A3B8]"
                      >
                        No tickets found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTickets.map((ticket) => (
                      <TableRow
                        key={ticket.id}
                        className="cursor-pointer border-[#E5EAF1] hover:bg-[#F6F8FB]"
                      >
                        <TableCell onClick={() => setSelectedTicket(ticket)}>
                          <div>
                            <p className="font-black text-[#020617]">
                              {ticket.subject}
                            </p>
                            <p className="text-xs font-semibold text-[#94A3B8]">
                              #{ticket.id.slice(0, 8)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell onClick={() => setSelectedTicket(ticket)}>
                          <div className="flex items-center gap-2">
                            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#7C83F6]/10">
                              <User className="h-4 w-4 text-[#7C83F6]" />
                            </span>
                            <span className="font-semibold text-[#020617]">
                              {ticket.user_name}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell onClick={() => setSelectedTicket(ticket)}>
                          <Badge
                            variant="outline"
                            className="rounded-full border-[#E5EAF1] bg-[#F6F8FB] px-3 py-1 capitalize text-[#64748B]"
                          >
                            {ticket.category}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={ticket.priority}
                            onValueChange={(
                              value: "low" | "medium" | "high" | "urgent",
                            ) => handlePriorityChange(ticket.id, value)}
                          >
                            <SelectTrigger className="h-10 min-h-[44px] w-[110px] rounded-2xl border-[#E5EAF1] bg-white text-[#020617]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="urgent">Urgent</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={ticket.status}
                            onValueChange={(value) =>
                              handleStatusChange(ticket.id, value)
                            }
                          >
                            <SelectTrigger className="h-10 min-h-[44px] w-[135px] rounded-2xl border-[#E5EAF1] bg-white text-[#020617]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Open</SelectItem>
                              <SelectItem value="in_progress">
                                In Progress
                              </SelectItem>
                              <SelectItem value="resolved">Resolved</SelectItem>
                              <SelectItem value="closed">Closed</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell onClick={() => setSelectedTicket(ticket)}>
                          <span className="text-sm font-medium text-[#94A3B8]">
                            {formatDistanceToNow(new Date(ticket.created_at), {
                              addSuffix: true,
                            })}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="min-h-[44px] min-w-[44px] rounded-2xl border-[#E5EAF1] bg-white font-bold text-[#020617] hover:bg-[#F6F8FB]"
                            onClick={() => setSelectedTicket(ticket)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Ticket Detail Dialog */}
        <Dialog
          open={!!selectedTicket}
          onOpenChange={() => setSelectedTicket(null)}
        >
          <DialogContent className="mx-4 max-h-[90vh] max-w-[95vw] overflow-y-auto rounded-[28px] border-[#E5EAF1] bg-white text-[#020617] sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex flex-col gap-3 pr-8 text-xl font-black text-[#020617] sm:flex-row sm:items-center sm:justify-between">
                <span>{selectedTicket?.subject}</span>
                <div className="flex flex-wrap gap-2">
                  {selectedTicket && getPriorityBadge(selectedTicket.priority)}
                  {selectedTicket && getStatusBadge(selectedTicket.status)}
                </div>
              </DialogTitle>
            </DialogHeader>

            {selectedTicket && (
              <div className="space-y-4">
                {/* Ticket Info */}
                <div className="space-y-3 rounded-[24px] border border-[#E5EAF1] bg-[#F6F8FB] p-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#7C83F6]/10">
                      <User className="h-4 w-4 text-[#7C83F6]" />
                    </span>
                    <span className="font-bold text-[#020617]">
                      {selectedTicket.user_name}
                    </span>{" "}
                    <Badge
                      variant="outline"
                      className="rounded-full border-[#E5EAF1] bg-white px-3 py-1 capitalize text-[#64748B]"
                    >
                      {selectedTicket.category}
                    </Badge>{" "}
                    <span className="font-medium text-[#94A3B8]">
                      {format(
                        new Date(selectedTicket.created_at),
                        "MMM d, yyyy h:mm a",
                      )}
                    </span>
                  </div>
                  <p className="text-sm font-medium leading-relaxed text-[#334155]">
                    {selectedTicket.description}
                  </p>

                  {/* Ticket-level attachments */}
                  {attachments.filter((a) => !a.message_id).length > 0 && (
                    <div className="border-t border-[#E5EAF1] pt-3">
                      <p className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-[0.14em] text-[#94A3B8]">
                        <Paperclip className="h-3 w-3" /> Attachments
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {attachments
                          .filter((a) => !a.message_id)
                          .map((att) => (
                            <a
                              key={att.id}
                              href={att.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block"
                            >
                              {isImage(att.file_type) ? (
                                <img
                                  src={att.file_url}
                                  alt={att.file_name}
                                  className="h-24 w-full rounded-2xl border border-[#E5EAF1] object-cover transition-opacity hover:opacity-80"
                                />
                              ) : (
                                <div className="flex items-center gap-2 rounded-2xl border border-[#E5EAF1] bg-white p-3 transition-colors hover:bg-[#F6F8FB]">
                                  {getFileIcon(att.file_type)}
                                  <span className="flex-1 truncate text-xs font-semibold text-[#020617]">
                                    {att.file_name}
                                  </span>
                                  <ExternalLink className="h-3 w-3 text-[#94A3B8]" />
                                </div>
                              )}
                            </a>
                          ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Messages */}
                <div className="overflow-hidden rounded-[24px] border border-[#E5EAF1]">
                  <div className="border-b border-[#E5EAF1] bg-[#F6F8FB] p-3">
                    <h4 className="text-sm font-black text-[#020617]">
                      Conversation
                    </h4>
                  </div>
                  <ScrollArea className="h-[250px] p-4">
                    {messages.length === 0 ? (
                      <p className="py-8 text-center text-sm font-semibold text-[#94A3B8]">
                        No replies yet
                      </p>
                    ) : (
                      <div className="space-y-4">
                        {messages.map((msg) => (
                          <div
                            key={msg.id}
                            className={`flex ${msg.is_admin_reply ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[80%] rounded-2xl p-3 ${
                                msg.is_admin_reply
                                  ? "bg-[#020617] text-white"
                                  : "bg-[#F6F8FB] text-[#020617]"
                              }`}
                            >
                              <p className="text-xs sm:text-sm">
                                {msg.message}
                              </p>
                              {/* Message attachments */}
                              {attachments.filter(
                                (a) => a.message_id === msg.id,
                              ).length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {attachments
                                    .filter((a) => a.message_id === msg.id)
                                    .map((att) => (
                                      <a
                                        key={att.id}
                                        href={att.file_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block"
                                      >
                                        {isImage(att.file_type) ? (
                                          <img
                                            src={att.file_url}
                                            alt={att.file_name}
                                            className="max-w-full max-h-32 rounded border hover:opacity-80 transition-opacity"
                                          />
                                        ) : (
                                          <div
                                            className={`flex items-center gap-1 text-xs hover:underline ${
                                              msg.is_admin_reply
                                                ? "text-white/80"
                                                : "text-[#7C83F6]"
                                            }`}
                                          >
                                            {getFileIcon(att.file_type)}
                                            {att.file_name}
                                          </div>
                                        )}
                                      </a>
                                    ))}
                                </div>
                              )}
                              <p
                                className={`text-xs mt-1 ${
                                  msg.is_admin_reply
                                    ? "text-white/60"
                                    : "text-[#94A3B8]"
                                }`}
                              >
                                {format(
                                  new Date(msg.created_at),
                                  "MMM d, h:mm a",
                                )}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>

                {/* Reply Input */}
                {selectedTicket.status !== "closed" && (
                  <div className="space-y-2">
                    {replyAttachments.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {replyAttachments.map((file, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="gap-1 rounded-full border-[#E5EAF1] bg-[#F6F8FB] px-3 py-1 text-[#64748B]"
                          >
                            {file.type.startsWith("image/") ? (
                              <Image className="h-3 w-3" />
                            ) : (
                              <FileText className="h-3 w-3" />
                            )}
                            {file.name.length > 20
                              ? file.name.substring(0, 20) + "..."
                              : file.name}
                            <X
                              className="h-3 w-3 cursor-pointer hover:text-[#FB6B7A]"
                              onClick={() => removeAttachment(i)}
                            />
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf,.doc,.docx,.txt"
                        className="hidden"
                        onChange={handleFileSelect}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={sendingMessage}
                        className="min-h-[44px] min-w-[44px] rounded-2xl border-[#E5EAF1] text-[#64748B] hover:bg-[#F6F8FB] hover:text-[#020617]"
                      >
                        <Paperclip className="h-4 w-4" />
                      </Button>
                      <Textarea
                        placeholder="Type your reply..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        className="min-h-[88px] rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] text-[#020617] placeholder:text-[#94A3B8]"
                      />
                      <Button
                        onClick={handleSendMessage}
                        disabled={
                          (!newMessage.trim() &&
                            replyAttachments.length === 0) ||
                          sendingMessage
                        }
                        className="min-h-[44px] rounded-2xl bg-[#020617] text-white hover:bg-[#020617]/90 self-end"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="flex flex-col gap-2 border-t border-[#E5EAF1] pt-3 sm:flex-row">
                  <Select
                    value={selectedTicket.status}
                    onValueChange={(value) =>
                      handleStatusChange(selectedTicket.id, value)
                    }
                  >
                    <SelectTrigger className="min-h-[44px] w-full rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] text-[#020617] sm:w-[160px]">
                      <SelectValue placeholder="Change status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select
                    value={selectedTicket.priority}
                    onValueChange={(
                      value: "low" | "medium" | "high" | "urgent",
                    ) => handlePriorityChange(selectedTicket.id, value)}
                  >
                    <SelectTrigger className="min-h-[44px] w-full rounded-2xl border-[#E5EAF1] bg-[#F6F8FB] text-[#020617] sm:w-[160px]">
                      <SelectValue placeholder="Change priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
