import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ArrowLeft, Loader2, Search, MessageSquare, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCoachMessages } from "@/hooks/useCoachMessages";
import { cn } from "@/lib/utils";

export default function CoachChatPage() {
  const { user } = useAuth();
  const coachId = user?.id;
  const {
    conversations, activeMessages, activeClientId, loading, sending,
    fetchMessages, sendMessage, markAsRead, refreshConversations,
  } = useCoachMessages(coachId);
  const [messageInput, setMessageInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeMessages]);

  useEffect(() => {
    if (activeClientId) {
      markAsRead(activeClientId);
      refreshConversations();
    }
  }, [activeClientId]);

  const handleSend = async () => {
    if (!messageInput.trim() || !activeClientId) return;
    await sendMessage(activeClientId, messageInput.trim());
    setMessageInput("");
    inputRef.current?.focus();
  };

  const filteredConversations = conversations.filter((c) =>
    c.clientName.toLowerCase().includes(searchQuery.toLowerCase())
  );

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

  // Conversation list view
  if (!activeClientId) {
    return (
      <div className="flex flex-col" style={{ minHeight: "calc(100dvh - 56px - 100px - env(safe-area-inset-bottom, 16px))" }}>
      {/* Header */}
      <div className="mb-3">
        <h1 className="text-[16px] font-extrabold tracking-[-0.02em] text-slate-950">Messages</h1>
        <p className="text-[11px] font-medium text-slate-500 mt-0.5">
          {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Search */}
      {conversations.length > 0 && (
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search clients..."
            className="w-full h-[40px] pl-9 pr-4 rounded-full bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
          />
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-[20px] bg-slate-100" />
          ))}
        </div>
      ) : filteredConversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <MessageSquare className="w-8 h-8 text-slate-300" />
          </div>
          <h3 className="text-[15px] font-bold text-slate-900 mb-1">No messages yet</h3>
          <p className="text-[12px] text-slate-500 max-w-[240px]">
            Messages from your clients will appear here once you start coaching.
          </p>
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: 0.04 } } }}
          className="space-y-1"
        >
          {filteredConversations.map((conv) => (
            <motion.button
              key={conv.clientId}
              variants={{ hidden: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } }}
              onClick={() => fetchMessages(conv.clientId)}
              className="w-full flex items-center gap-3 p-3 rounded-[20px] bg-white hover:bg-slate-50 active:scale-[0.985] transition-all shadow-[0_2px_8px_rgba(15,23,42,0.03)] ring-1 ring-slate-100/60"
            >
              <div className="relative shrink-0">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center">
                  {conv.clientAvatar ? (
                    <img src={conv.clientAvatar} alt="" className="w-full h-full rounded-full object-cover" />
                  ) : (
                    <User className="w-5 h-5 text-emerald-600" />
                  )}
                </div>
                {conv.unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center px-1">
                    {conv.unreadCount}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-slate-900 truncate">{conv.clientName}</span>
                  <span className="text-[10px] text-slate-400 shrink-0 ml-2">{formatTime(conv.lastMessageTime)}</span>
                </div>
                <p className={cn(
                  "text-[12px] truncate mt-0.5",
                  conv.unreadCount > 0 ? "text-slate-700 font-semibold" : "text-slate-400"
                )}>
                  {conv.lastMessage}
                </p>
              </div>
            </motion.button>
          ))}
        </motion.div>
      )}
      </div>
    );
  }

  // Conversation view
  const activeConv = conversations.find((c) => c.clientId === activeClientId);
  return (
    <div className="flex flex-col" style={{ minHeight: "calc(100dvh - 56px - 100px - env(safe-area-inset-bottom, 16px))" }}>
      {/* Chat header */}
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={() => { setActiveClientId(null); }}
          className="w-9 h-9 rounded-full bg-white border border-slate-100 flex items-center justify-center shrink-0 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4 text-slate-600" />
        </button>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center shrink-0">
            {activeConv?.clientAvatar ? (
              <img src={activeConv.clientAvatar} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-emerald-600" />
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-[14px] font-extrabold text-slate-900 truncate">{activeConv?.clientName || "Client"}</h2>
            <p className="text-[10px] text-slate-500">Coach chat</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-2 mb-3"
      >
        {activeMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="w-10 h-10 text-slate-200 mb-3" />
            <p className="text-[12px] text-slate-400">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          <AnimatePresence>
            {activeMessages.map((msg) => {
              const isCoach = msg.sender_role === "coach";
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn("flex", isCoach ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[75%] px-4 py-2.5 text-sm leading-relaxed rounded-2xl",
                      isCoach
                        ? "bg-emerald-600 text-white rounded-br-sm"
                        : "bg-white text-slate-700 rounded-bl-sm shadow-sm border border-slate-100"
                    )
                  }
                  >
                    <p>{msg.message}</p>
                    <p className={cn(
                      "text-[10px] mt-1",
                      isCoach ? "text-emerald-200" : "text-slate-400"
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
          placeholder="Type a message..."
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
