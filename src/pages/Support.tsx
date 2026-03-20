import React, { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Plus, MessageCircle, Clock, CheckCircle, AlertCircle, Loader2, Send, Paperclip, X, Image, FileText } from "lucide-react";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type TicketStatus = Database["public"]["Enums"]["ticket_status"];
type TicketPriority = Database["public"]["Enums"]["ticket_priority"];

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

interface TicketMessage {
  id: string;
  message: string;
  is_admin_reply: boolean;
  created_at: string;
  sender_id: string;
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

const statusConfig: Record<TicketStatus, { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  open: { label: "Open", icon: <AlertCircle className="w-3 h-3" />, variant: "destructive" },
  in_progress: { label: "In Progress", icon: <Clock className="w-3 h-3" />, variant: "default" },
  resolved: { label: "Resolved", icon: <CheckCircle className="w-3 h-3" />, variant: "secondary" },
  closed: { label: "Closed", icon: <CheckCircle className="w-3 h-3" />, variant: "outline" },
};

const categories = [
  { value: "general", label: "General Inquiry" },
  { value: "order", label: "Order Issue" },
  { value: "subscription", label: "Subscription" },
  { value: "technical", label: "Technical Problem" },
  { value: "billing", label: "Billing" },
  { value: "feedback", label: "Feedback" },
];

export default function Support() {
  const { user } = useAuth();
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

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["user-support-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as SupportTicket[];
    },
    enabled: !!user,
  });

  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ["ticket-messages", selectedTicket?.id],
    queryFn: async () => {
      if (!selectedTicket) return [];
      const { data, error } = await supabase
        .from("ticket_messages")
        .select("*")
        .eq("ticket_id", selectedTicket.id)
        .order("created_at", { ascending: true });
      
      if (error) throw error;
      return data as TicketMessage[];
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
      return data as TicketAttachment[];
    },
    enabled: !!selectedTicket,
  });

  const uploadFiles = async (files: File[], ticketId: string, messageId?: string) => {
    const uploadedAttachments = [];
    for (const file of files) {
      const fileExt = file.name.split(".").pop();
      const filePath = `${ticketId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from("ticket-attachments")
        .upload(filePath, file);
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from("ticket-attachments")
        .getPublicUrl(filePath);
      
      uploadedAttachments.push({
        ticket_id: ticketId,
        message_id: messageId || null,
        file_name: file.name,
        file_url: publicUrl,
        file_size: file.size,
        file_type: file.type,
        uploaded_by: user!.id,
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
        is_admin_reply: false,
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
    const validFiles = files.filter(f => f.size <= 10 * 1024 * 1024); // 10MB limit
    if (validFiles.length !== files.length) {
      toast.error("Some files exceeded 10MB limit");
    }
    if (isMessage) {
      setMessageAttachments(prev => [...prev, ...validFiles]);
    } else {
      setAttachments(prev => [...prev, ...validFiles]);
    }
    e.target.value = "";
  };

  const removeAttachment = (index: number, isMessage: boolean) => {
    if (isMessage) {
      setMessageAttachments(prev => prev.filter((_, i) => i !== index));
    } else {
      setAttachments(prev => prev.filter((_, i) => i !== index));
    }
  };

  const getFileIcon = (type: string | null) => {
    if (type?.startsWith("image/")) return <Image className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Support Center</h1>
            <p className="text-muted-foreground">Get help with your orders and account</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                New Ticket
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Support Ticket</DialogTitle>
                <DialogDescription>
                  Describe your issue and we'll get back to you as soon as possible.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateTicket} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Category</label>
                  <Select
                    value={newTicket.category}
                    onValueChange={(value) => setNewTicket({ ...newTicket, category: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Subject</label>
                  <Input
                    value={newTicket.subject}
                    onChange={(e) => setNewTicket({ ...newTicket, subject: e.target.value })}
                    placeholder="Brief description of your issue"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={newTicket.description}
                    onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                    placeholder="Please provide as much detail as possible..."
                    rows={4}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Attachments</label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf,.doc,.docx,.txt"
                    className="hidden"
                    onChange={(e) => handleFileSelect(e, false)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full mt-1"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Paperclip className="w-4 h-4 mr-2" />
                    Add Screenshots/Files
                  </Button>
                  {attachments.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {attachments.map((file, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm bg-muted rounded px-2 py-1">
                          {getFileIcon(file.type)}
                          <span className="flex-1 truncate">{file.name}</span>
                          <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => removeAttachment(i, false)}>
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createTicketMutation.isPending || uploading}>
                    {(createTicketMutation.isPending || uploading) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Submit Ticket
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : tickets?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <MessageCircle className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No support tickets yet</h3>
              <p className="text-muted-foreground text-center mb-4">
                Need help? Create a support ticket and our team will assist you.
              </p>
              <Button onClick={() => setIsCreateOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Ticket
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Your Tickets</h2>
              {tickets?.map((ticket) => (
                <Card
                  key={ticket.id}
                  className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                    selectedTicket?.id === ticket.id ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => setSelectedTicket(ticket)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base">{ticket.subject}</CardTitle>
                      <Badge variant={statusConfig[ticket.status].variant} className="flex items-center gap-1">
                        {statusConfig[ticket.status].icon}
                        {statusConfig[ticket.status].label}
                      </Badge>
                    </div>
                    <CardDescription>
                      {categories.find((c) => c.value === ticket.category)?.label} • {format(new Date(ticket.created_at), "MMM d, yyyy")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2">{ticket.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div>
              {selectedTicket ? (
                <Card className="h-[500px] flex flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{selectedTicket.subject}</CardTitle>
                        <CardDescription>
                          {categories.find((c) => c.value === selectedTicket.category)?.label}
                        </CardDescription>
                      </div>
                      <Badge variant={statusConfig[selectedTicket.status].variant}>
                        {statusConfig[selectedTicket.status].label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <Separator />
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      <div className="bg-muted rounded-lg p-3">
                        <p className="text-sm">{selectedTicket.description}</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          {format(new Date(selectedTicket.created_at), "MMM d, yyyy h:mm a")}
                        </p>
                      </div>
                      {messagesLoading ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="w-5 h-5 animate-spin" />
                        </div>
                      ) : (
                        messages?.map((msg) => (
                          <div
                            key={msg.id}
                            className={`rounded-lg p-3 ${
                              msg.is_admin_reply
                                ? "bg-primary/10 ml-4"
                                : "bg-muted mr-4"
                            }`}
                          >
                            <p className="text-xs font-medium mb-1">
                              {msg.is_admin_reply ? "Support Team" : "You"}
                            </p>
                            <p className="text-sm">{msg.message}</p>
                            {ticketAttachments?.filter(a => a.message_id === msg.id).map(att => (
                              <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline mt-1">
                                {getFileIcon(att.file_type)}
                                {att.file_name}
                              </a>
                            ))}
                            <p className="text-xs text-muted-foreground mt-2">
                              {format(new Date(msg.created_at), "MMM d, h:mm a")}
                            </p>
                          </div>
                        ))
                      )}
                      {ticketAttachments?.filter(a => !a.message_id).map(att => (
                        <a key={att.id} href={att.file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline">
                          {getFileIcon(att.file_type)}
                          {att.file_name}
                        </a>
                      ))}
                    </div>
                  </ScrollArea>
                  {selectedTicket.status !== "closed" && (
                    <>
                      <Separator />
                      <div className="p-4 space-y-2">
                        {messageAttachments.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {messageAttachments.map((file, i) => (
                              <Badge key={i} variant="secondary" className="gap-1">
                                {file.name.length > 15 ? file.name.substring(0, 15) + "..." : file.name}
                                <X className="w-3 h-3 cursor-pointer" onClick={() => removeAttachment(i, true)} />
                              </Badge>
                            ))}
                          </div>
                        )}
                        <form onSubmit={handleSendMessage} className="flex gap-2">
                          <input
                            ref={messageFileInputRef}
                            type="file"
                            multiple
                            accept="image/*,.pdf,.doc,.docx,.txt"
                            className="hidden"
                            onChange={(e) => handleFileSelect(e, true)}
                          />
                          <Button type="button" variant="outline" size="icon" onClick={() => messageFileInputRef.current?.click()}>
                            <Paperclip className="w-4 h-4" />
                          </Button>
                          <Input
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Type your message..."
                            disabled={sendMessageMutation.isPending || uploading}
                          />
                          <Button type="submit" size="icon" disabled={sendMessageMutation.isPending || uploading || !newMessage.trim()}>
                            {(sendMessageMutation.isPending || uploading) ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                          </Button>
                        </form>
                      </div>
                    </>
                  )}
                </Card>
              ) : (
                <Card className="h-[500px] flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Select a ticket to view details</p>
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>    </div>
  );
}
