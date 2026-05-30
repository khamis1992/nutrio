import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users,
  ChevronLeft,
  Flame,
  Target,
  Star,
  Loader2,
  CheckCircle2,
  Clock,
  UserPlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useCoachReviews } from "@/hooks/useCoachReviews";
import { useCoachAvailability } from "@/hooks/useCoachAvailability";
import { cn } from "@/lib/utils";

interface CoachProfile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  specialties: string[];
  clientCount: number;
  rating: number;
  verified: boolean;
  goalTypes: string[];
}

export default function CoachesDirectory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [coaches, setCoaches] = useState<CoachProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [myCoach, setMyCoach] = useState<string | null>(null);
  const [myCoachProfile, setMyCoachProfile] = useState<CoachProfile | null>(null);
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem("coach_pending_requests");
      return stored ? new Set<string>(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });
  const [coachAvailabilities, setCoachAvailabilities] = useState<Map<string, { isAccepting: boolean; clientRange: string; responseLabel: string | null }>>(new Map());

  const fetchCoaches = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: coachRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "coach");

      if (!coachRoles?.length) {
        setCoaches([]);
        setLoading(false);
        return;
      }

      const coachIds = coachRoles.map((r) => r.user_id);

      const [{ data: profiles }, { data: assignments }, { data: goals }, { data: reviews }, { data: myAssignments }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name, avatar_url, bio, specialties")
          .in("user_id", coachIds),
        supabase
          .from("coach_client_assignments")
          .select("coach_id, client_id, status")
          .in("coach_id", coachIds),
        supabase
          .from("nutrition_goals")
          .select("user_id, goal_type")
          .in("user_id", coachIds)
          .eq("is_active", true),
        supabase
          .from("coach_reviews")
          .select("coach_id, rating")
          .in("coach_id", coachIds),
        supabase
          .from("coach_client_assignments")
          .select("coach_id, status")
          .eq("client_id", user.id)
          .in("status", ["pending", "active"]),
      ]);

      const clientCounts = new Map<string, number>();
      const myActiveCoach = new Set<string>();
      const myPending = new Set<string>();
      const goalMap = new Map<string, string[]>();
      const ratingMap = new Map<string, { sum: number; count: number }>();

      for (const r of reviews || []) {
        const entry = ratingMap.get(r.coach_id) || { sum: 0, count: 0 };
        entry.sum += r.rating;
        entry.count += 1;
        ratingMap.set(r.coach_id, entry);
      }

      for (const g of goals || []) {
        const existing = goalMap.get(g.user_id) || [];
        existing.push(g.goal_type);
        goalMap.set(g.user_id, existing);
      }

      for (const a of assignments || []) {
        if (a.status === "active") {
          clientCounts.set(a.coach_id, (clientCounts.get(a.coach_id) || 0) + 1);
          if (a.client_id === user?.id) myActiveCoach.add(a.coach_id);
        }
        if (a.client_id === user?.id && a.status === "pending") {
          myPending.add(a.coach_id);
        }
      }

      // Directly populate from user's own assignments (bypasses RLS timing issues on cold load)
      for (const ma of myAssignments || []) {
        if (ma.status === "active") myActiveCoach.add(ma.coach_id);
        if (ma.status === "pending") myPending.add(ma.coach_id);
      }

      const sorted: CoachProfile[] = (profiles || [])
        .filter((p) => p.user_id !== user?.id)
        .map((p) => {
          const ratings = ratingMap.get(p.user_id);
          const avgRating = ratings && ratings.count > 0
            ? Math.round((ratings.sum / ratings.count) * 10) / 10
            : 0;
          return {
            id: p.user_id,
            full_name: p.full_name || "Unknown Coach",
            avatar_url: p.avatar_url || null,
            bio: p.bio || null,
            specialties: p.specialties || [],
            clientCount: clientCounts.get(p.user_id) || 0,
            rating: avgRating,
            verified: true,
            goalTypes: goalMap.get(p.user_id) || [],
          };
        })
        .sort((a, b) => b.clientCount - a.clientCount);

      setCoaches(sorted);
      if (myActiveCoach.size > 0) {
        const activeId = [...myActiveCoach][0];
        setMyCoach(activeId);
        const connectedProfile = sorted.find((c) => c.id === activeId) || null;
        setMyCoachProfile(connectedProfile);
      }
      setPendingRequests((prev) => {
        const merged = new Set(myPending);
        for (const id of prev) merged.add(id);
        return merged;
      });
    } catch (err) {
      console.error("Error fetching coaches:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchCoaches();
  }, [fetchCoaches]);

  // Fetch availability signals for all coaches
  useEffect(() => {
    if (!coaches.length) return;
    const fetchAvailabilities = async () => {
      try {
        const coachIds = coaches.map(c => c.id);
        const [{ data: pricingData }, { data: clientCounts }] = await Promise.all([
          supabase.from("coach_pricing").select("coach_id, is_active").in("coach_id", coachIds),
          supabase.from("coach_client_assignments").select("coach_id", { count: "exact", head: true })
            .in("coach_id", coachIds)
            .eq("status", "active")
        ]);
        const availMap = new Map<string, { isAccepting: boolean; clientRange: string; responseLabel: string | null }>();
        const activeCountMap = new Map<string, number>();
        
        // Build client counts from assignments
        if (clientCounts) {
          // Individual counts for each coach
          for (const cid of coachIds) {
            const { count } = await supabase.from("coach_client_assignments")
              .select("id", { count: "exact", head: true })
              .eq("coach_id", cid)
              .eq("status", "active");
            activeCountMap.set(cid, count || 0);
          }
        }
        
        for (const p of pricingData || []) {
          const count = activeCountMap.get(p.coach_id) || 0;
          availMap.set(p.coach_id, {
            isAccepting: p.is_active,
            clientRange: count <= 5 ? "1-5" : count <= 10 ? "5-10" : "10+",
            responseLabel: null,
          });
        }
        setCoachAvailabilities(availMap);
      } catch (err) {
        console.error("Error fetching availabilities:", err);
      }
    };
    fetchAvailabilities();
  }, [coaches]);

  // Sync pending state to sessionStorage so it survives hard refresh
  useEffect(() => {
    try {
      sessionStorage.setItem("coach_pending_requests", JSON.stringify([...pendingRequests]));
    } catch {}
  }, [pendingRequests]);

  const handleRequestCoach = async (coachId: string) => {
    if (!user) return;
    setRequesting(coachId);
    // Optimistically mark as pending so UI updates immediately
    setPendingRequests((prev) => {
      const next = new Set(prev);
      next.add(coachId);
      return next;
    });
    try {
      const { data: existing } = await supabase
        .from("coach_client_assignments")
        .select("id, status")
        .eq("client_id", user.id)
        .eq("coach_id", coachId)
        .maybeSingle();

      if (existing) {
        toast({
          title: "Already requested",
          description: existing.status === "active" ? "This coach is already connected." : "Your request is pending.",
        });
        return;
      }

      await supabase.from("coach_client_assignments").insert({
        coach_id: coachId,
        client_id: user.id,
        status: "pending",
      });

      toast({
        title: "Request sent!",
        description: "Your coach will review and accept your request.",
      });
    } catch {
      // Revert on failure
      setPendingRequests((prev) => {
        const next = new Set(prev);
        next.delete(coachId);
        return next;
      });
      toast({ title: "Failed", description: "Could not send request. Try again.", variant: "destructive" });
    } finally {
      setRequesting(null);
    }
  };

  const hasCoach = myCoach !== null;

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-20">
      <div className="max-w-[480px] mx-auto px-4 py-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center shrink-0 shadow-sm"
          >
            <ChevronLeft className="h-5 w-5 text-gray-700" />
          </button>
          <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Find a Coach</h1>
            <p className="text-xs text-gray-500">Connect with certified nutrition coaches</p>
          </div>
        </div>

        {hasCoach && myCoachProfile && (
          <div className="mb-5 rounded-2xl bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-200 p-5 shadow-sm">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-200 to-purple-300 flex items-center justify-center shrink-0 overflow-hidden">
                {myCoachProfile.avatar_url ? (
                  <img src={myCoachProfile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-violet-700">
                    {(myCoachProfile.full_name || "C")[0].toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-gray-900">{myCoachProfile.full_name}</h3>
                  <CheckCircle2 className="w-4 h-4 text-violet-500 shrink-0" />
                </div>
                <p className="text-xs text-violet-600 font-semibold mt-0.5">Your Nutrition Coach</p>
                {myCoachProfile.bio && (
                  <p className="text-[11px] text-gray-500 mt-1.5 line-clamp-2">{myCoachProfile.bio}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/coach-programs")}
                className="flex-1 py-2 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 active:scale-[0.98] transition-all"
              >
                My Programs
              </button>
              <button
                onClick={() => navigate("/profile")}
                className="flex-1 py-2 rounded-xl bg-white border border-violet-200 text-violet-700 text-xs font-bold hover:bg-violet-50 active:scale-[0.98] transition-all"
              >
                Manage Connection
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          </div>
        ) : coaches.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-violet-400" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">No coaches yet</h3>
            <p className="text-sm text-gray-500">Coaches will appear here once they join the platform.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {coaches.map((coach, index) => {
              const isConnected = myCoach === coach.id;
              const isPending = pendingRequests.has(coach.id);
              return (
                <motion.div
                  key={coach.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05, type: "spring", stiffness: 260, damping: 26 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 flex items-center justify-center shrink-0 overflow-hidden">
                        {coach.avatar_url ? (
                          <img src={coach.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-lg font-bold text-violet-600">
                            {(coach.full_name || "C")[0].toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-gray-900 truncate">{coach.full_name}</h3>
                          {coach.verified && (
                            <CheckCircle2 className="w-4 h-4 text-violet-500 shrink-0" />
                          )}
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-3 mt-1.5">
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                            {coach.rating > 0 ? coach.rating : "New"}
                          </div>
                          <span className="text-gray-300">·</span>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <Users className="w-3.5 h-3.5" />
                            {coach.clientCount} client{coach.clientCount !== 1 ? "s" : ""}
                          </div>
                        </div>
                        {/* Availability signals */}
                        {coachAvailabilities.has(coach.id) && (
                          <div className="flex items-center gap-2 mt-1.5">
                            {(() => {
                              const avail = coachAvailabilities.get(coach.id)!;
                              return (
                                <>
                                  {avail.responseLabel && (
                                    <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {avail.responseLabel}
                                    </span>
                                  )}
                                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${avail.isAccepting ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                    {avail.isAccepting ? "Accepting clients" : "Not accepting"}
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      {/* Action */}
                      <button
                        onClick={() => !isConnected && !isPending && handleRequestCoach(coach.id)}
                        disabled={requesting === coach.id || isConnected || isPending}
                        className={cn(
                          "px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all active:scale-95",
                          isConnected
                            ? "bg-emerald-100 text-emerald-700"
                            : isPending
                            ? "bg-amber-50 text-amber-600"
                            : "bg-violet-600 text-white shadow-md shadow-violet-600/20 hover:bg-violet-700"
                        )}
                      >
                        {requesting === coach.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : isConnected ? (
                          "Connected"
                        ) : isPending ? (
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Pending</span>
                        ) : (
                          "Request"
                        )}
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Become a Coach CTA */}
        <div className="mt-6 bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl border border-violet-200 p-5 shadow-sm">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
              <UserPlus className="w-5 h-5 text-violet-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Are you a nutrition professional?</h3>
              <p className="text-[12px] text-violet-600 mt-0.5">
                Apply to become a coach and start guiding clients on their health journey.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/become-coach")}
            className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 active:scale-[0.98] transition-all"
          >
            Become a Coach
          </button>
        </div>
      </div>
    </div>
  );
}
