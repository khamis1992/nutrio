import { useState, useEffect } from "react";
import { motion, type Variants } from "framer-motion";
import { Loader2, Calendar, Video, Phone, MapPin, ClipboardCheck, Plus, X, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useCoachSessions } from "@/hooks/useCoachSessions";
import { useToast } from "@/hooks/use-toast";

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

export default function ClientCoachSchedule() {
  const { user } = useAuth();
  const { toast } = useToast();
  const clientId = user?.id;
  const [coachId, setCoachId] = useState<string | undefined>(undefined);
  const [resolvingCoach, setResolvingCoach] = useState(true);
  const { sessions, loading, createSession, updateSession } = useCoachSessions(coachId, clientId);

  useEffect(() => {
    if (!clientId) {
      setResolvingCoach(false);
      return;
    }
    supabase
      .from("coach_client_assignments")
      .select("coach_id")
      .eq("client_id", clientId)
      .eq("status", "active")
      .maybeSingle()
      .then(({ data }) => {
        setCoachId(data?.coach_id ?? undefined);
        setResolvingCoach(false);
      });
  }, [clientId]);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [duration, setDuration] = useState(30);
  const [sessionType, setSessionType] = useState("video_call");
  const [notes, setNotes] = useState("");

  const handleRequest = async () => {
    if (!title.trim() || !scheduledAt) {
      toast({ title: "Required", description: "Please fill in all required fields.", variant: "destructive" });
      return;
    }
    const result = await createSession({
      title: title.trim(),
      description: notes || null,
      session_type: sessionType,
      scheduled_at: new Date(scheduledAt).toISOString(),
      duration_minutes: duration,
    });
    if (result.success) {
      toast({ title: "Requested!", description: "Your session request has been sent to your coach." });
      setRequestModalOpen(false);
      setTitle("");
      setScheduledAt("");
      setDuration(30);
      setSessionType("video_call");
      setNotes("");
    } else {
      toast({ title: "Failed", description: result.error?.message || "Please try again.", variant: "destructive" });
    }
  };

  const handleConfirm = async (sessionId: string) => {
    const result = await updateSession(sessionId, { status: "confirmed" });
    if (result.success) {
      toast({ title: "Confirmed", description: "Session confirmed!" });
    } else {
      toast({ title: "Failed", description: "Could not confirm session.", variant: "destructive" });
    }
  };

  const handleCancelClient = async (sessionId: string) => {
    const result = await updateSession(sessionId, { status: "cancelled" });
    if (result.success) {
      toast({ title: "Cancelled", description: "Session cancelled." });
    } else {
      toast({ title: "Failed", description: "Could not cancel session.", variant: "destructive" });
    }
  };

  const upcomingSessions = sessions.filter((s) => s.status === "scheduled" || s.status === "confirmed");
  const pastSessions = sessions.filter((s) => s.status === "completed" || s.status === "cancelled" || s.status === "no_show");

  if (loading || resolvingCoach) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  if (!coachId) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3">
          <div className="flex items-center justify-between max-w-lg mx-auto">
            <h1 className="text-[16px] font-extrabold text-slate-950">My Sessions</h1>
          </div>
        </div>
        <div className="p-4 max-w-lg mx-auto">
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="bg-white rounded-[24px] p-12 text-center shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <UserPlus className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-[15px] font-bold text-slate-900 mb-2">No coach connected</h3>
            <p className="text-[12px] text-slate-500">Go to Profile and enter your coach's invite code to get started.</p>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <h1 className="text-[16px] font-extrabold text-slate-950">My Sessions</h1>
          <button
            onClick={() => setRequestModalOpen(true)}
            className="flex items-center gap-1.5 h-[34px] px-3 rounded-full bg-emerald-600 text-white text-[11px] font-bold shadow-sm hover:bg-emerald-700 active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Request
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {sessions.length === 0 ? (
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="bg-white rounded-[24px] p-12 text-center shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
          >
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-[15px] font-bold text-slate-900 mb-2">No sessions yet</h3>
            <p className="text-[12px] text-slate-500">Request a session with your coach to get started.</p>
          </motion.div>
        ) : (
          <>
            {/* Upcoming */}
            {upcomingSessions.length > 0 && (
              <div>
                <h2 className="text-[13px] font-extrabold text-slate-500 uppercase tracking-wide mb-2">Upcoming</h2>
                <div className="space-y-2">
                  {upcomingSessions.map((session) => {
                    const Icon = sessionTypeIcons[session.session_type] || Video;
                    const statusColor = session.status === "confirmed" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-blue-50 text-blue-700 border-blue-200";
                    return (
                      <motion.div key={session.id} variants={fadeInUp} initial="hidden" animate="visible" className="bg-white rounded-[20px] p-4 shadow-[0_4px_12px_rgba(15,23,42,0.04)] ring-1 ring-slate-100">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                            <Icon className="w-5 h-5 text-emerald-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-bold text-slate-900">{session.title}</p>
                            <p className="text-[11px] text-slate-500">
                              {new Date(session.scheduled_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at{" "}
                              {new Date(session.scheduled_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                              {" · "}{session.duration_minutes} min
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-50">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusColor}`}>
                            {session.status === "confirmed" ? "Confirmed" : "Scheduled"}
                          </span>
                          {session.status === "scheduled" && (
                            <button
                              onClick={() => handleConfirm(session.id)}
                              className="text-[10px] font-semibold text-emerald-600 hover:underline"
                            >
                              Confirm
                            </button>
                          )}
                          <button
                            onClick={() => handleCancelClient(session.id)}
                            className="text-[10px] font-semibold text-red-500 hover:underline ml-auto"
                          >
                            Cancel
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Past */}
            {pastSessions.length > 0 && (
              <div>
                <h2 className="text-[13px] font-extrabold text-slate-400 uppercase tracking-wide mb-2">Past</h2>
                <div className="space-y-1">
                  {pastSessions.map((session) => {
                    const Icon = sessionTypeIcons[session.session_type] || Video;
                    return (
                      <div key={session.id} className="bg-white rounded-[16px] p-3 shadow-[0_2px_6px_rgba(15,23,42,0.02)] ring-1 ring-slate-50 opacity-50">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                          <span className="text-[12px] font-medium text-slate-500">{session.title}</span>
                          <span className="text-[10px] text-slate-400 ml-auto">{session.status}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* Request Session Modal */}
        {requestModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} className="w-full max-w-md bg-white rounded-[24px] p-6 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[16px] font-extrabold text-slate-950">Request Session</h2>
                <button onClick={() => setRequestModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><X className="w-4 h-4 text-slate-500" /></button>
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
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything your coach should know..." className="w-full h-20 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500" />
                </div>
                <button onClick={handleRequest} className="w-full h-[44px] rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[13px] font-bold shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 active:scale-[0.98] transition-all">
                  Send Request
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
