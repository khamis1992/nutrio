import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  ArrowLeft,
  Loader2,
  MessageSquare,
  User,
  Bell,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useClientCoachMessages } from "@/hooks/useClientCoachMessages";
import { cn } from "@/lib/utils";

export default function CoachMessages() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const clientId = user?.id;
  const { messages, coachInfo, loading, sending, sendMessage, markAsRead } =
    useClientCoachMessages(clientId);
  const [messageInput, setMessageInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (coachInfo) {
      markAsRead();
    }
  }, [coachInfo, markAsRead, messages.length]);

  const handleSend = async () => {
    if (!messageInput.trim()) return;
    await sendMessage(messageInput.trim());
    setMessageInput("");
    inputRef.current?.focus();
  };

  const formatTime = (ts: string) => {
    if (!ts) return "";
    const date = new Date(ts);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date
        .toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
        .toLowerCase();
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex min-h-[70dvh] items-center justify-center bg-[#F6F8FB]">
        <div className="flex h-16 w-16 items-center justify-center rounded-[24px] border border-[#E5EAF1] bg-white shadow-sm">
          <Loader2 className="h-7 w-7 animate-spin text-[#7C83F6]" />
        </div>
      </div>
    );
  }

  if (!coachInfo) {
    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center bg-[#F6F8FB] px-5 text-center text-[#020617]">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] border border-[#E5EAF1] bg-white shadow-sm">
          <Users className="h-8 w-8 text-[#94A3B8]" />
        </div>
        <h3 className="mb-1 text-[17px] font-black text-[#020617]">
          No coach connected
        </h3>
        <p className="max-w-[280px] text-[13px] font-medium leading-relaxed text-[#94A3B8]">
          You haven't connected with a coach yet. Ask your coach for an invite
          code.
        </p>
      </div>
    );
  }

  return (
    <div
      className="mx-auto flex min-h-0 w-full max-w-[430px] flex-col overflow-hidden bg-[#F6F8FB] px-4 pb-3 pt-2 text-[#020617]"
      style={{
        height:
          "calc(100dvh - 56px - 100px - env(safe-area-inset-bottom, 16px))",
      }}
    >
      {/* Chat header */}
      <div className="mb-3 shrink-0 overflow-hidden rounded-[28px] border border-[#E5EAF1] bg-white p-3 shadow-[0_14px_34px_rgba(2,6,23,0.06)]">
        <div className="flex items-center gap-3">
          <button
            data-testid="coach-messages-back-btn"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#E5EAF1] bg-[#F6F8FB] transition-colors hover:bg-white"
          >
            <ArrowLeft className="h-4 w-4 text-[#020617]" />
          </button>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[20px] border border-[#22C7A1]/20 bg-[#22C7A1]/10">
              {coachInfo.coachAvatar ? (
                <img
                  src={coachInfo.coachAvatar}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <User className="h-5 w-5 text-[#22C7A1]" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#7C83F6]">
                Coach chat
              </p>
              <h2 className="truncate text-[17px] font-black text-[#020617]">
                {coachInfo.coachName}
              </h2>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#22C7A1]" />
                <p className="text-[11px] font-bold text-[#94A3B8]">
                  Your coach
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="mb-3 min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain rounded-[28px] border border-[#E5EAF1] bg-white p-3 shadow-[0_14px_34px_rgba(2,6,23,0.04)]"
      >
        {messages.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-[22px] bg-[#7C83F6]/10">
              <Bell className="h-7 w-7 text-[#7C83F6]" />
            </div>
            <h3 className="text-[15px] font-black text-[#020617]">
              No messages yet
            </h3>
            <p className="mt-1 text-[12px] font-medium leading-relaxed text-[#94A3B8]">
              Your coach will reach out here when there is an update.
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {messages.map((msg) => {
              const isClient = msg.sender_role === "client";
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn(
                    "flex",
                    isClient ? "justify-end" : "justify-start",
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[82%] break-words rounded-[22px] px-4 py-3 text-sm font-medium leading-relaxed",
                      isClient
                        ? "rounded-br-md bg-[#020617] text-white"
                        : "rounded-bl-md border border-[#E5EAF1] bg-[#F6F8FB] text-[#020617]",
                    )}
                  >
                    <p>{msg.message}</p>
                    <p
                      className={cn(
                        "mt-1 text-[10px] font-bold",
                        isClient ? "text-white/55" : "text-[#94A3B8]",
                      )}
                    >
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        {sending && (
          <div className="flex justify-end">
            <div className="flex items-center gap-2 rounded-[22px] rounded-br-md bg-[#020617]/70 px-4 py-3 text-sm font-bold text-white">
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="shrink-0 flex items-center gap-2 rounded-[24px] border border-[#E5EAF1] bg-white px-3 py-2 shadow-[0_14px_34px_rgba(2,6,23,0.08)]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#F6F8FB]">
          <MessageSquare className="h-4 w-4 text-[#94A3B8]" />
        </div>
        <input
          data-testid="coach-messages-input"
          ref={inputRef}
          type="text"
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Reply to your coach..."
          className="min-h-[44px] flex-1 bg-transparent text-sm font-semibold text-[#020617] outline-none placeholder:text-[#94A3B8]"
          autoFocus
        />
        <button
          data-testid="coach-messages-send-btn"
          onClick={handleSend}
          disabled={!messageInput.trim() || sending}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-[#020617] text-white transition-all active:scale-95 disabled:opacity-35"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
