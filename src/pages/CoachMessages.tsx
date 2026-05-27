import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ArrowLeft, Loader2, MessageSquare, User, Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useClientCoachMessages } from "@/hooks/useClientCoachMessages";
import { cn } from "@/lib/utils";

export default function CoachMessages() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const clientId = user?.id;
  const { messages, coachInfo, loading, sending, sendMessage, markAsRead } = useClientCoachMessages(clientId);
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
  }, [coachInfo, messages.length]);

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
      return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }).toLowerCase();
    }
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!coachInfo) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
          <Users className="w-8 h-8 text-slate-300" />
        </div>
        <h3 className="text-[15px] font-bold text-slate-900 mb-1">No coach connected</h3>
        <p className="text-[12px] text-slate-500 max-w-[260px]">
          You haven't connected with a coach yet. Ask your coach for an invite code.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ minHeight: "calc(100dvh - 56px - 100px - env(safe-area-inset-bottom, 16px))" }}>
      {/* Chat header */}
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-white border border-slate-100 flex items-center justify-center shrink-0 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </button>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center shrink-0">
            {coachInfo.coachAvatar ? (
              <img src={coachInfo.coachAvatar} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-emerald-600" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-[14px] font-extrabold text-slate-900 truncate">{coachInfo.coachName}</h2>
            <p className="text-[10px] text-slate-500">Your coach</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-2 mb-3"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="w-10 h-10 text-slate-200 mb-3" />
            <p className="text-[12px] text-slate-400">No messages yet. Your coach will reach out soon!</p>
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
                  className={cn("flex", isClient ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[75%] px-4 py-2.5 text-sm leading-relaxed rounded-2xl",
                      isClient
                        ? "bg-emerald-600 text-white rounded-br-sm"
                        : "bg-white text-slate-700 rounded-bl-sm shadow-sm border border-slate-100"
                    )}
                  >
                    <p>{msg.message}</p>
                    <p className={cn(
                      "text-[10px] mt-1",
                      isClient ? "text-emerald-200" : "text-slate-400"
                    )}>
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
            <div className="bg-emerald-600/50 text-white text-sm rounded-2xl rounded-br-sm px-4 py-2.5 flex items-center gap-1">
              <Loader2 className="w-4 h-4 animate-spin" />
              Sending...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 bg-white rounded-[20px] border border-slate-200 px-3 py-2 shadow-sm">
        <input
          ref={inputRef}
          type="text"
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Reply to your coach..."
          className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
          autoFocus
        />
        <button
          onClick={handleSend}
          disabled={!messageInput.trim() || sending}
          className="w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 disabled:opacity-40 active:scale-95 transition-all"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function Users(props: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
