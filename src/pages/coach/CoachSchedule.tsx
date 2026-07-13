import { useState } from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { useCoachSessions, type CoachSessionStatus } from "@/hooks/useCoachSessions";
import { useCoachClients } from "@/hooks/useCoachClients";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Video, Phone, MapPin, ClipboardCheck, X, ChevronLeft, ChevronRight } from "lucide-react";

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

const sessionTypeIcons: Record<string, typeof Video> = {
  video_call: Video,
  phone_call: Phone,
  in_person: MapPin,
  check_in: ClipboardCheck,
};

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700 border-blue-200",
  confirmed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  completed: "bg-slate-100 text-slate-500 border-slate-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
  no_show: "bg-orange-50 text-orange-700 border-orange-200",
};

export default function CoachSchedule() {
  const { user } = useAuth();
  const { toast } = useToast();
  const coachId = user?.id;
  const { clients: coachClients, loading: clientsLoading } = useCoachClients(coachId);
  const [selectedClientId, setSelectedClientId] = useState("");
  const { sessions, loading, createSession, updateSession, cancelSession } = useCoachSessions(coachId, selectedClientId || undefined);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editSessionId, setEditSessionId] = useState<string | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState(30);
  const [sessionType, setSessionType] = useState("video_call");
  const [notes, setNotes] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const clients = coachClients.map((client) => ({ id: client.id, name: client.full_name || "Unnamed client" }));

  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + weekOffset * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const generateWeekDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      days.push(d);
    }
    return days;
  };
  const weekDays = generateWeekDays();

  const weekSessions = sessions.filter((s) => {
    const sessionDate = s.scheduled_at.split("T")[0];
    return sessionDate >= weekStart.toISOString().split("T")[0] && sessionDate <= weekEnd.toISOString().split("T")[0];
  });

  const handleCreate = async () => {
    if (!title.trim() || !scheduledAt || !selectedClientId) {
      toast({ title: "Required", description: "Client, title, and date are required.", variant: "destructive" });
      return;
    }
    const result = await createSession({
      title: title.trim(),
      session_type: sessionType,
      scheduled_at: new Date(scheduledAt).toISOString(),
      duration_minutes: duration,
      notes: notes || null,
    });
    if (result.success) {
      toast({ title: "Scheduled!", description: "Session created successfully." });
      setCreateModalOpen(false);
      setTitle("");
      setScheduledAt("");
      setDuration(30);
      setSessionType("video_call");
      setNotes("");
    } else {
      toast({ title: "Failed", description: result.error?.message || "Please try again.", variant: "destructive" });
    }
  };

  const handleStatusChange = async (sessionId: string, status: CoachSessionStatus) => {
    const result = await updateSession(sessionId, { status });
    if (result.success) {
      toast({ title: "Updated", description: `Session marked as ${status}.` });
      setEditSessionId(null);
    } else {
      toast({ title: "Failed", description: "Could not update session.", variant: "destructive" });
    }
  };

  const filteredClients = clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()));

  if (loading || clientsLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[16px] font-extrabold tracking-[-0.02em] text-slate-950">Schedule</h1>
          <p className="text-[11px] font-medium text-slate-500 mt-0.5">
            {weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset(w => w - 1)}
            className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm hover:bg-slate-50"
          >
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={() => setWeekOffset(w => w + 1)}
            className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center shadow-sm hover:bg-slate-50"
          >
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 h-[38px] px-4 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[13px] font-bold shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            New
          </button>
        </div>
      </div>

      {/* Client filter */}
      <div className="relative">
        <input
          type="text"
          value={clientSearch}
          onChange={(e) => setClientSearch(e.target.value)}
          placeholder="Filter by client name..."
          className="w-full h-[40px] px-4 rounded-full bg-white border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
        />
        {clients.length > 0 && filteredClients.length > 0 && !selectedClientId && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl ring-1 ring-slate-200/80 z-30 max-h-48 overflow-y-auto">
            {filteredClients.map(c => (
              <button key={c.id} onClick={() => { setSelectedClientId(c.id); setClientSearch(c.name); }} className="w-full text-left px-4 py-2.5 text-[13px] hover:bg-slate-50 border-b border-slate-50 last:border-0">{c.name}</button>
            ))}
          </div>
        )}
      </div>

      {/* Weekly calendar */}
      <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="bg-white rounded-[24px] shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-100">
          {weekDays.map((d, i) => {
            const isToday = d.toDateString() === today.toDateString();
            return (
              <div key={i} className={`p-2 text-center border-r border-slate-50 last:border-r-0 ${isToday ? "bg-emerald-50/50" : ""}`}>
                <p className="text-[10px] font-medium text-slate-400">{d.toLocaleDateString("en-US", { weekday: "short" })}</p>
                <p className={`text-[16px] font-extrabold ${isToday ? "text-emerald-600" : "text-slate-800"}`}>{d.getDate()}</p>
              </div>
            );
          })}
        </div>
        <div className="p-2 min-h-[120px]">
          {weekSessions.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-[12px] text-slate-400">No sessions this week</p>
            </div>
          ) : (
            <div className="space-y-1">
              {weekSessions.map((s) => {
                const Icon = sessionTypeIcons[s.session_type] || Video;
                return (
                  <button
                    key={s.id}
                    onClick={() => setEditSessionId(s.id)}
                    className={`w-full flex items-center gap-2 p-2 rounded-xl text-left hover:bg-slate-50 transition-colors border ${statusColors[s.status]}`}
                  >
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold text-slate-800 truncate">{s.title}</p>
                      <p className="text-[10px] text-slate-400">
                        {new Date(s.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at{" "}
                        {new Date(s.scheduled_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                        {" · "}{s.duration_minutes} min
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>

      {/* Create Session Modal */}
      <AnimatePresence>
        {createModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 20 }} className="w-full max-w-md bg-white rounded-[24px] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[16px] font-extrabold text-slate-950">New Session</h2>
                <button onClick={() => setCreateModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><X className="w-4 h-4 text-slate-500" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Title</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Weekly Check-in" className="w-full h-[44px] px-4 rounded-full bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Date & Time</label>
                  <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full h-[44px] px-4 rounded-full bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Duration</label>
                    <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full h-[44px] px-4 rounded-full bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 appearance-none">
                      <option value={15}>15 min</option>
                      <option value={30}>30 min</option>
                      <option value={45}>45 min</option>
                      <option value={60}>60 min</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Type</label>
                    <select value={sessionType} onChange={(e) => setSessionType(e.target.value)} className="w-full h-[44px] px-4 rounded-full bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 appearance-none">
                      <option value="video_call">Video Call</option>
                      <option value="phone_call">Phone Call</option>
                      <option value="in_person">In Person</option>
                      <option value="check_in">Check-in</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Notes (optional)</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Session agenda or notes..." className="w-full h-20 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <button onClick={handleCreate} className="w-full h-[44px] rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[13px] font-bold shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 active:scale-[0.98] transition-all">
                  Create Session
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Session Modal */}
      <AnimatePresence>
        {editSessionId && (() => {
          const session = sessions.find(s => s.id === editSessionId);
          if (!session) return null;
          const Icon = sessionTypeIcons[session.session_type] || Video;
          return (
            <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
              <motion.div initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 20 }} className="w-full max-w-md bg-white rounded-[24px] p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-[16px] font-extrabold text-slate-950">{session.title}</h2>
                    <p className="text-[11px] text-slate-500">
                      {new Date(session.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at{" "}
                      {new Date(session.scheduled_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                      {" · "}{session.duration_minutes} min
                    </p>
                  </div>
                  <button onClick={() => setEditSessionId(null)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><X className="w-4 h-4 text-slate-500" /></button>
                </div>
                <div className="flex items-center gap-2 mb-4 p-3 rounded-2xl bg-slate-50">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-[12px] font-medium text-slate-700 capitalize">{session.session_type.replace(/_/g, " ")}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${statusColors[session.status]}`}>{session.status}</span>
                  </div>
                </div>
                {session.notes && <p className="text-[12px] text-slate-500 mb-4 italic">"{session.notes}"</p>}
                <div className="grid grid-cols-2 gap-2">
                  {session.status === "scheduled" && (
                    <button onClick={() => handleStatusChange(session.id, "confirmed")} className="h-[40px] rounded-full bg-emerald-600 text-white text-[12px] font-bold hover:bg-emerald-700 active:scale-95 transition-all">✓ Confirm</button>
                  )}
                  {session.status === "scheduled" && (
                    <button onClick={() => cancelSession(session.id).then(() => setEditSessionId(null))} className="h-[40px] rounded-full bg-red-50 text-red-600 text-[12px] font-bold hover:bg-red-100 active:scale-95 transition-all">✕ Cancel</button>
                  )}
                  {session.status === "confirmed" && (
                    <button onClick={() => handleStatusChange(session.id, "completed")} className="h-[40px] rounded-full bg-emerald-600 text-white text-[12px] font-bold hover:bg-emerald-700 active:scale-95 transition-all">✓ Mark Complete</button>
                  )}
                  {session.status === "confirmed" && (
                    <button onClick={() => handleStatusChange(session.id, "no_show")} className="h-[40px] rounded-full bg-orange-50 text-orange-600 text-[12px] font-bold hover:bg-orange-100 active:scale-95 transition-all">No Show</button>
                  )}
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>
    </div>
  );
}
