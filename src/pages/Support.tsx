import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Clock,
  FileText,
  Headphones,
  Image,
  Loader2,
  MessageCircle,
  Paperclip,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import {
  createPrivateStorageUrl,
  uploadSensitiveFile,
  validatePrivateStorageFile,
} from "@/lib/private-storage";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
type TicketPriority = "low" | "medium" | "high" | "urgent";

interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  category: string;
  status: TicketStatus;
  priority: TicketPriority;
  created_at: string;
  updated_at: string;
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

const statusLabels: Record<TicketStatus, string> = {
  open: "status_open",
  in_progress: "in_progress",
  resolved: "status_resolved",
  closed: "status_closed",
};

const statusConfig: Record<TicketStatus, { icon: React.ReactNode }> = {
  open: { icon: <AlertCircle className="h-3 w-3" /> },
  in_progress: { icon: <Clock className="h-3 w-3" /> },
  resolved: { icon: <CheckCircle className="h-3 w-3" /> },
  closed: { icon: <CheckCircle className="h-3 w-3" /> },
};

const statusTone: Record<TicketStatus, string> = {
  open: "border-[#FECACA] bg-[#FEF2F2] text-[#DC2626]",
  in_progress: "border-[#BFDBFE] bg-[#EFF6FF] text-[#2563EB]",
  resolved: "border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A]",
  closed: "border-[#E5EAF1] bg-white text-[#64748B]",
};

const categoryKeys: Record<string, string> = {
  general: "category_general",
  order: "category_order_issue",
  subscription: "category_subscription",
  technical: "category_technical",
  billing: "category_billing",
  feedback: "category_feedback",
};

const categoryTone: Record<string, string> = {
  general: "bg-[#F8FAFC] text-[#64748B]",
  order: "bg-[#FFF7ED] text-[#F97316]",
  subscription: "bg-[#EEF0FF] text-[#7C83F6]",
  technical: "bg-[#EFF6FF] text-[#2563EB]",
  billing: "bg-[#F0FDF4] text-[#16A34A]",
  feedback: "bg-[#ECFDF5] text-[#059669]",
};

const categories = [
  { value: "general" },
  { value: "order" },
  { value: "subscription" },
  { value: "technical" },
  { value: "billing" },
  { value: "feedback" },
];

const SUPPORT_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export default function Support() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [newTicket, setNewTicket] = useState({
    subject: "",
    description: "",
    category: "general",
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [messageAttachments, setMessageAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = `${t("support")} - Nutrio`;
  }, [t]);

  const {
    data: tickets,
    isLoading,
    isError: ticketsError,
    error: ticketsErrorObj,
  } = useQuery({
    queryKey: ["user-support-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((ticket) => ({
        ...ticket,
        status: ticket.status as TicketStatus,
        priority: ticket.priority as TicketPriority,
      }));
    },
    enabled: !!user,
  });

  const { data: messages, isLoading: messagesLoading, isError: messagesError } = useQuery({
    queryKey: ["ticket-messages", selectedTicket?.id],
    queryFn: async () => {
      if (!selectedTicket) return [];
      const { data, error } = await supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", selectedTicket.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []).map((message) => ({
        id: message.id,
        message: message.message,
        is_admin_reply: message.is_internal,
        created_at: message.created_at,
        sender_id: message.sender_id,
      }));
    },
    enabled: !!selectedTicket,
  });

  const { data: ticketAttachments } = useQuery({
    queryKey: ["ticket-attachments", selectedTicket?.id],
    queryFn: async () => {
      if (!selectedTicket) return [];
      const { data, error } = await supabase
        .from("ticket_attachments")
        .select("*")
        .eq("ticket_id", selectedTicket.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return Promise.all(
        ((data || []) as TicketAttachment[]).map(async (attachment) => ({
          ...attachment,
          file_url: await createPrivateStorageUrl("ticket-attachments", attachment.file_url),
        })),
      );
    },
    enabled: !!selectedTicket,
  });

  const uploadFiles = async (files: File[], ticketId: string, messageId?: string) => {
    const uploadedAttachments = [];
    for (const file of files) {
      const fileExt = validatePrivateStorageFile(
        file,
        SUPPORT_ATTACHMENT_TYPES,
        10 * 1024 * 1024,
      );
      const filePath = `${ticketId}/${crypto.randomUUID()}.${fileExt}`;
      await uploadSensitiveFile("ticket-attachments", filePath, file);

      uploadedAttachments.push({
        ticket_id: ticketId,
        message_id: messageId || null,
        file_name: file.name,
        file_url: filePath,
        file_size: file.size,
        file_type: file.type,
      });
    }
    if (uploadedAttachments.length > 0) {
      const { error } = await supabase.from("ticket_attachments").insert(uploadedAttachments);
      if (error) throw error;
    }
  };

  const createTicketMutation = useMutation({
    mutationFn: async (ticket: typeof newTicket) => {
      setUploading(true);
      const { data, error } = await supabase.from("support_tickets").insert({
        user_id: user!.id,
        subject: ticket.subject,
        description: ticket.description,
        category: ticket.category,
      }).select().single();
      if (error) throw error;

      if (attachments.length > 0) {
        await uploadFiles(attachments, data.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-support-tickets"] });
      setIsCreateOpen(false);
      setNewTicket({ subject: "", description: "", category: "general" });
      setAttachments([]);
      setUploading(false);
      toast.success("Support ticket created successfully");
    },
    onError: () => {
      setUploading(false);
      toast.error("Failed to create ticket");
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      setUploading(true);
      const { data, error } = await supabase.from("ticket_messages").insert({
        ticket_id: selectedTicket!.id,
        sender_id: user!.id,
        message,
        is_internal: false,
      }).select().single();
      if (error) throw error;

      if (messageAttachments.length > 0) {
        await uploadFiles(messageAttachments, selectedTicket!.id, data.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-messages", selectedTicket?.id] });
      queryClient.invalidateQueries({ queryKey: ["ticket-attachments", selectedTicket?.id] });
      setNewMessage("");
      setMessageAttachments([]);
      setUploading(false);
      toast.success("Message sent");
    },
    onError: () => {
      setUploading(false);
      toast.error("Failed to send message");
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, isMessage: boolean) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(
      (file) =>
        file.size > 0 &&
        file.size <= 10 * 1024 * 1024 &&
        SUPPORT_ATTACHMENT_TYPES.includes(file.type as (typeof SUPPORT_ATTACHMENT_TYPES)[number]),
    );
    if (validFiles.length !== files.length) {
      toast.error("Some files were too large or had an unsupported type");
    }
    if (isMessage) {
      setMessageAttachments((prev) => [...prev, ...validFiles]);
    } else {
      setAttachments((prev) => [...prev, ...validFiles]);
    }
    e.target.value = "";
  };

  const removeAttachment = (index: number, isMessage: boolean) => {
    if (isMessage) {
      setMessageAttachments((prev) => prev.filter((_, i) => i !== index));
    } else {
      setAttachments((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const getFileIcon = (type: string | null) => {
    if (type?.startsWith("image/")) return <Image className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const handleCreateTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicket.subject.trim() || !newTicket.description.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    createTicketMutation.mutate(newTicket);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendMessageMutation.mutate(newMessage);
  };

  const getCategoryLabel = (category: string) => t(categoryKeys[category] || categoryKeys.general);
  const ticketCount = tickets?.length ?? 0;
  const openTicketCount = tickets?.filter((ticket) => ticket.status === "open" || ticket.status === "in_progress").length ?? 0;
  const resolvedTicketCount = tickets?.filter((ticket) => ticket.status === "resolved" || ticket.status === "closed").length ?? 0;

  return (
    <div className="min-h-screen bg-[#F6F8FB] pb-[max(1.5rem,env(safe-area-inset-bottom))] text-[#020617]">
      <div className="mx-auto w-full max-w-[1120px] px-4 py-5 sm:px-6 lg:py-8">
        <div className="mb-5 overflow-hidden rounded-[28px] bg-[#020617] text-white shadow-[0_24px_60px_rgba(2,6,23,0.18)]">
          <div className="relative p-5 sm:p-7">
            <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[#22C7A1]/20 blur-2xl" />
            <div className="absolute -bottom-16 left-12 h-44 w-44 rounded-full bg-[#7C83F6]/20 blur-3xl" />
            <div className="relative flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <button
                  data-testid="support-back-btn"
                  onClick={() => navigate(-1)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/15 transition active:scale-95"
                  aria-label={t("go_back")}
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-[#A7F3E5] ring-1 ring-white/10">
                    <Headphones className="h-3.5 w-3.5" />
                    Nutrio support
                  </div>
                  <h1 className="text-[28px] font-black leading-tight tracking-normal text-white sm:text-[34px]">
                    {t("support_center_title")}
                  </h1>
                  <p className="mt-2 max-w-[560px] text-sm font-medium leading-6 text-white/70">
                    {t("support_subtitle")}
                  </p>
                </div>
              </div>
              <Button
                data-testid="support-new-ticket-btn"
                className="hidden h-12 rounded-[16px] bg-white px-5 text-[13px] font-black text-[#020617] shadow-[0_16px_32px_rgba(0,0,0,0.18)] hover:bg-white/90 sm:inline-flex"
                onClick={() => setIsCreateOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                New Ticket
              </Button>
            </div>

            <div className="relative mt-6 grid grid-cols-3 gap-2 sm:max-w-[520px] sm:gap-3">
              {[
                { label: "Total", value: ticketCount, icon: MessageCircle },
                { label: "Active", value: openTicketCount, icon: Clock },
                { label: "Resolved", value: resolvedTicketCount, icon: ShieldCheck },
              ].map((item) => (
                <div key={item.label} className="rounded-[18px] bg-white/10 p-3 ring-1 ring-white/10">
                  <item.icon className="mb-2 h-4 w-4 text-[#A7F3E5]" />
                  <p className="text-xl font-black leading-none text-white">{item.value}</p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white/50">{item.label}</p>
                </div>
              ))}
            </div>

            <Button
              data-testid="support-new-ticket-btn-mobile"
              className="relative mt-5 h-12 w-full rounded-[16px] bg-white text-[13px] font-black text-[#020617] shadow-[0_16px_32px_rgba(0,0,0,0.18)] hover:bg-white/90 sm:hidden"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              New Ticket
            </Button>
          </div>
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[24px] border-[#E5EAF1] p-5 sm:max-w-[520px]">
            <DialogHeader>
              <DialogTitle className="text-[22px] font-black text-[#020617]">{t("support_create_ticket")}</DialogTitle>
              <DialogDescription className="text-sm font-medium leading-6 text-[#64748B]">
                Describe your issue and we'll get back to you as soon as possible.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateTicket} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[12px] font-black uppercase tracking-[0.12em] text-[#64748B]">{t("support_category")}</label>
                <Select
                  value={newTicket.category}
                  onValueChange={(value) => setNewTicket({ ...newTicket, category: value })}
                >
                  <SelectTrigger className="h-12 rounded-[16px] border-[#E5EAF1] bg-[#F8FAFC]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {getCategoryLabel(cat.value)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-black uppercase tracking-[0.12em] text-[#64748B]">{t("support_subject")}</label>
                <Input
                  className="h-12 rounded-[16px] border-[#E5EAF1] bg-[#F8FAFC] text-[14px] font-semibold"
                  value={newTicket.subject}
                  onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                  placeholder={t("support_ticket_desc")}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-black uppercase tracking-[0.12em] text-[#64748B]">{t("support_description")}</label>
                <Textarea
                  className="min-h-[130px] rounded-[18px] border-[#E5EAF1] bg-[#F8FAFC] text-[14px] font-medium leading-6"
                  value={newTicket.description}
                  onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                  placeholder="Please provide as much detail as possible..."
                  rows={4}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[12px] font-black uppercase tracking-[0.12em] text-[#64748B]">{t("support_attachments")}</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,.pdf,.docx,.txt"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e, false)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="mt-1 h-12 w-full rounded-[16px] border-dashed border-[#CBD5E1] bg-white text-[13px] font-black text-[#020617]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="mr-2 h-4 w-4" />
                  Add Screenshots/Files
                </Button>
                {attachments.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {attachments.map((file, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-[14px] bg-[#F8FAFC] px-3 py-2 text-sm font-medium text-[#334155]">
                        {getFileIcon(file.type)}
                        <span className="flex-1 truncate">{file.name}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeAttachment(i, false)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" className="h-11 rounded-[14px] border-[#E5EAF1] font-bold" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="h-11 rounded-[14px] bg-[#020617] font-black text-white" disabled={createTicketMutation.isPending || uploading}>
                  {(createTicketMutation.isPending || uploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Ticket
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <div className="grid gap-3 lg:grid-cols-[390px_minmax(0,1fr)]">
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="rounded-[22px] border-[#E5EAF1] shadow-none">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card className="hidden min-h-[540px] rounded-[26px] border-[#E5EAF1] lg:block" />
          </div>
        ) : ticketsError ? (
          <Card className="rounded-[26px] border-[#FECACA] bg-white shadow-[0_16px_40px_rgba(2,6,23,0.06)]">
            <CardContent className="flex flex-col items-center justify-center px-6 py-12 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-[20px] bg-[#FEF2F2] text-[#DC2626]">
                <AlertCircle className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-lg font-black text-[#020617]">Could not load support tickets</h3>
              <p className="mt-2 max-w-[360px] text-sm font-medium leading-6 text-[#64748B]">
                {ticketsErrorObj instanceof Error ? ticketsErrorObj.message : "Please refresh and try again."}
              </p>
              <Button
                className="mt-5 h-11 rounded-[14px] bg-[#020617] px-5 text-[13px] font-black text-white"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["user-support-tickets"] })}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </CardContent>
          </Card>
        ) : tickets?.length === 0 ? (
          <Card className="rounded-[28px] border-[#E5EAF1] bg-white shadow-[0_16px_40px_rgba(2,6,23,0.06)]">
            <CardContent className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-[24px] bg-[#EEF0FF] text-[#7C83F6]">
                <MessageCircle className="h-8 w-8" />
              </div>
              <h3 className="mt-5 text-xl font-black text-[#020617]">{t("support_no_tickets")}</h3>
              <p className="mt-2 max-w-[360px] text-sm font-medium leading-6 text-[#64748B]">
                {t("support_empty_prompt")}
              </p>
              <Button className="mt-6 h-12 rounded-[16px] bg-[#020617] px-5 text-[13px] font-black text-white" onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Ticket
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[390px_minmax(0,1fr)]">
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-[18px] font-black text-[#020617]">{t("support_your_tickets")}</h2>
                <button
                  className="grid h-9 w-9 place-items-center rounded-full bg-white text-[#64748B] ring-1 ring-[#E5EAF1] transition active:scale-95"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["user-support-tickets"] })}
                  aria-label="Refresh tickets"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
              {tickets?.map((ticket) => (
                <Card
                  key={ticket.id}
                  className={`cursor-pointer rounded-[22px] border bg-white shadow-[0_10px_28px_rgba(2,6,23,0.045)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(2,6,23,0.08)] ${
                    selectedTicket?.id === ticket.id ? "border-[#020617] ring-2 ring-[#020617]/10" : "border-[#E5EAF1]"
                  }`}
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle className="line-clamp-2 text-[15px] font-black leading-5 text-[#020617]">{ticket.subject}</CardTitle>
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black ${statusTone[ticket.status]}`}>
                        {statusConfig[ticket.status].icon}
                        {t(statusLabels[ticket.status])}
                      </span>
                    </div>
                    <CardDescription className="mt-2 flex items-center gap-2 text-[11px] font-bold text-[#94A3B8]">
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black ${categoryTone[ticket.category] || categoryTone.general}`}>
                        {getCategoryLabel(ticket.category)}
                      </span>
                      <span>{format(new Date(ticket.created_at), "MMM d, yyyy")}</span>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 pt-1">
                    <p className="line-clamp-2 text-[13px] font-medium leading-5 text-[#64748B]">{ticket.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div>
              {selectedTicket ? (
                <Card className="flex h-[min(680px,calc(100dvh-9rem))] min-h-[540px] flex-col overflow-hidden rounded-[26px] border-[#E5EAF1] bg-white shadow-[0_18px_48px_rgba(2,6,23,0.08)]">
                  <CardHeader className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <CardTitle className="line-clamp-2 text-[18px] font-black leading-6 text-[#020617]">{selectedTicket.subject}</CardTitle>
                        <CardDescription className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-bold text-[#94A3B8]">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${categoryTone[selectedTicket.category] || categoryTone.general}`}>
                            {getCategoryLabel(selectedTicket.category)}
                          </span>
                          <span>{format(new Date(selectedTicket.created_at), "MMM d, yyyy h:mm a")}</span>
                        </CardDescription>
                      </div>
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-[10px] font-black ${statusTone[selectedTicket.status]}`}>
                        {statusConfig[selectedTicket.status].icon}
                        {t(statusLabels[selectedTicket.status])}
                      </span>
                    </div>
                  </CardHeader>
                  <Separator className="bg-[#E5EAF1]" />
                  <ScrollArea className="flex-1 bg-[#F8FAFC] p-4">
                    <div className="space-y-3">
                      <div className="rounded-[20px] bg-white p-4 shadow-[0_8px_24px_rgba(2,6,23,0.04)] ring-1 ring-[#E5EAF1]">
                        <p className="text-[13px] font-medium leading-6 text-[#334155]">{selectedTicket.description}</p>
                        <p className="mt-3 text-[11px] font-bold text-[#94A3B8]">
                          {format(new Date(selectedTicket.created_at), "MMM d, yyyy h:mm a")}
                        </p>
                      </div>
                      {messagesLoading ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-[#7C83F6]" />
                        </div>
                      ) : messagesError ? (
                        <div className="rounded-[18px] bg-white p-4 text-center text-[13px] font-bold text-[#DC2626] ring-1 ring-[#FECACA]">
                          Could not load messages.
                        </div>
                      ) : (
                        messages?.map((msg) => (
                          <div
                            key={msg.id}
                            className={`rounded-[20px] p-3.5 shadow-[0_8px_24px_rgba(2,6,23,0.04)] ${
                              msg.is_admin_reply
                                ? "ml-5 bg-[#EEF0FF] text-[#020617]"
                                : "mr-5 bg-white text-[#020617] ring-1 ring-[#E5EAF1]"
                            }`}
                          >
                            <p className="mb-1 text-[11px] font-black uppercase tracking-[0.1em] text-[#64748B]">
                              {msg.is_admin_reply ? "Support Team" : "You"}
                            </p>
                            <p className="text-[13px] font-medium leading-6">{msg.message}</p>
                            {ticketAttachments?.filter((attachment) => attachment.message_id === msg.id).map((attachment) => (
                              <a key={attachment.id} href={attachment.file_url} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1 text-[12px] font-bold text-[#2563EB] hover:underline">
                                {getFileIcon(attachment.file_type)}
                                {attachment.file_name}
                              </a>
                            ))}
                            <p className="mt-2 text-[11px] font-bold text-[#94A3B8]">
                              {format(new Date(msg.created_at), "MMM d, h:mm a")}
                            </p>
                          </div>
                        ))
                      )}
                      {ticketAttachments?.filter((attachment) => !attachment.message_id).map((attachment) => (
                        <a key={attachment.id} href={attachment.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-[14px] bg-white px-3 py-2 text-[12px] font-bold text-[#2563EB] ring-1 ring-[#E5EAF1] hover:underline">
                          {getFileIcon(attachment.file_type)}
                          {attachment.file_name}
                        </a>
                      ))}
                    </div>
                  </ScrollArea>
                  {selectedTicket.status !== "closed" && (
                    <>
                      <Separator className="bg-[#E5EAF1]" />
                      <div className="space-y-2 bg-white p-3 sm:p-4">
                        {messageAttachments.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {messageAttachments.map((file, i) => (
                              <Badge key={i} variant="secondary" className="gap-1 rounded-full bg-[#F1F5F9] text-[#334155]">
                                {file.name.length > 15 ? file.name.substring(0, 15) + "..." : file.name}
                                <X className="h-3 w-3 cursor-pointer" onClick={() => removeAttachment(i, true)} />
                              </Badge>
                            ))}
                          </div>
                        )}
                        <form onSubmit={handleSendMessage} className="flex gap-2">
                          <input
                            ref={messageFileInputRef}
                            type="file"
                            multiple
                            accept="image/jpeg,image/png,image/webp,.pdf,.docx,.txt"
                            className="hidden"
                            onChange={(e) => handleFileSelect(e, true)}
                          />
                          <Button type="button" variant="outline" size="icon" className="h-12 w-12 shrink-0 rounded-[16px] border-[#E5EAF1]" onClick={() => messageFileInputRef.current?.click()}>
                            <Paperclip className="h-4 w-4" />
                          </Button>
                          <Input
                            className="h-12 rounded-[16px] border-[#E5EAF1] bg-[#F8FAFC] text-[14px] font-semibold"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type your message..."
                            disabled={sendMessageMutation.isPending || uploading}
                          />
                          <Button type="submit" size="icon" className="h-12 w-12 shrink-0 rounded-[16px] bg-[#020617] text-white" disabled={sendMessageMutation.isPending || uploading || !newMessage.trim()}>
                            {(sendMessageMutation.isPending || uploading) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </Button>
                        </form>
                      </div>
                    </>
                  )}
                </Card>
              ) : (
                <Card className="flex h-[540px] items-center justify-center rounded-[26px] border-dashed border-[#CBD5E1] bg-white/70 shadow-none">
                  <div className="px-6 text-center">
                    <div className="mx-auto grid h-16 w-16 place-items-center rounded-[24px] bg-[#F8FAFC] text-[#94A3B8] ring-1 ring-[#E5EAF1]">
                      <MessageCircle className="h-8 w-8" />
                    </div>
                    <p className="mt-4 text-sm font-black text-[#64748B]">{t("support_select_ticket")}</p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
