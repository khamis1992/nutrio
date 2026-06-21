import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Award,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Loader2,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
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

type CoachAvailability = {
  isAccepting: boolean;
  clientRange: string;
  responseLabel: string | null;
};

const specialtyFallbacks = ["Weight Loss", "Muscle Gain", "Meal Planning", "Habit Coaching"];

function CoachAvatar({ coach, size = "md" }: { coach: Pick<CoachProfile, "full_name" | "avatar_url">; size?: "md" | "lg" }) {
  const sizeClass = size === "lg" ? "h-16 w-16" : "h-14 w-14";

  return (
    <div className={cn("shrink-0 overflow-hidden rounded-2xl bg-emerald-50 ring-1 ring-emerald-100", sizeClass)}>
      {coach.avatar_url ? (
        <img src={coach.avatar_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xl font-black text-emerald-700">
          {(coach.full_name || "C")[0].toUpperCase()}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onApply }: { onApply: () => void }) {
  return (
    <div className="rounded-[30px] bg-white p-8 text-center shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-50 text-emerald-600">
        <Users className="h-8 w-8" />
      </div>
      <h3 className="mt-5 text-lg font-black text-slate-950">No coaches yet</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
        Coaches will appear here once they join the platform.
      </p>
      <button
        onClick={onApply}
        className="mt-5 min-h-11 rounded-full bg-emerald-600 px-5 text-sm font-black text-white shadow-[0_12px_24px_rgba(16,185,129,0.18)] active:scale-[0.98]"
      >
        Become a Coach
      </button>
    </div>
  );
}

export default function CoachesDirectory() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [coaches, setCoaches] = useState<CoachProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [myCoach, setMyCoach] = useState<string | null>(null);
  const [myCoachProfile, setMyCoachProfile] = useState<CoachProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSpecialty, setActiveSpecialty] = useState("All");
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(() => {
    try {
      const stored = sessionStorage.getItem("coach_pending_requests");
      return stored ? new Set<string>(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });
  const [coachAvailabilities, setCoachAvailabilities] = useState<Map<string, CoachAvailability>>(new Map());

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

      const coachIds = coachRoles.map((role) => role.user_id);

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

      for (const review of reviews || []) {
        const entry = ratingMap.get(review.coach_id) || { sum: 0, count: 0 };
        entry.sum += review.rating;
        entry.count += 1;
        ratingMap.set(review.coach_id, entry);
      }

      for (const goal of goals || []) {
        const existing = goalMap.get(goal.user_id) || [];
        existing.push(goal.goal_type);
        goalMap.set(goal.user_id, existing);
      }

      for (const assignment of assignments || []) {
        if (assignment.status === "active") {
          clientCounts.set(assignment.coach_id, (clientCounts.get(assignment.coach_id) || 0) + 1);
          if (assignment.client_id === user.id) myActiveCoach.add(assignment.coach_id);
        }
        if (assignment.client_id === user.id && assignment.status === "pending") {
          myPending.add(assignment.coach_id);
        }
      }

      for (const assignment of myAssignments || []) {
        if (assignment.status === "active") myActiveCoach.add(assignment.coach_id);
        if (assignment.status === "pending") myPending.add(assignment.coach_id);
      }

      const sorted: CoachProfile[] = (profiles || [])
        .filter((profile) => profile.user_id !== user.id)
        .map((profile) => {
          const ratings = ratingMap.get(profile.user_id);
          const avgRating = ratings && ratings.count > 0
            ? Math.round((ratings.sum / ratings.count) * 10) / 10
            : 0;
          return {
            id: profile.user_id,
            full_name: profile.full_name || "Unknown Coach",
            avatar_url: profile.avatar_url || null,
            bio: profile.bio || null,
            specialties: profile.specialties || [],
            clientCount: clientCounts.get(profile.user_id) || 0,
            rating: avgRating,
            verified: true,
            goalTypes: goalMap.get(profile.user_id) || [],
          };
        })
        .sort((a, b) => b.clientCount - a.clientCount);

      setCoaches(sorted);
      if (myActiveCoach.size > 0) {
        const activeId = [...myActiveCoach][0];
        setMyCoach(activeId);
        setMyCoachProfile(sorted.find((coach) => coach.id === activeId) || null);
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

  useEffect(() => {
    if (!coaches.length) return;
    const fetchAvailabilities = async () => {
      try {
        const coachIds = coaches.map((coach) => coach.id);
        const { data: pricingData } = await supabase
          .from("coach_pricing")
          .select("coach_id, is_active")
          .in("coach_id", coachIds);
        const activeCountMap = new Map<string, number>();

        for (const coachId of coachIds) {
          const { count } = await supabase
            .from("coach_client_assignments")
            .select("id", { count: "exact", head: true })
            .eq("coach_id", coachId)
            .eq("status", "active");
          activeCountMap.set(coachId, count || 0);
        }

        const availabilityMap = new Map<string, CoachAvailability>();
        for (const pricing of pricingData || []) {
          const count = activeCountMap.get(pricing.coach_id) || 0;
          availabilityMap.set(pricing.coach_id, {
            isAccepting: pricing.is_active,
            clientRange: count <= 5 ? "1-5" : count <= 10 ? "5-10" : "10+",
            responseLabel: null,
          });
        }
        setCoachAvailabilities(availabilityMap);
      } catch (err) {
        console.error("Error fetching availabilities:", err);
      }
    };
    fetchAvailabilities();
  }, [coaches]);

  useEffect(() => {
    try {
      sessionStorage.setItem("coach_pending_requests", JSON.stringify([...pendingRequests]));
    } catch {
      // sessionStorage can be unavailable in private contexts.
    }
  }, [pendingRequests]);

  const handleRequestCoach = async (coachId: string) => {
    if (!user) return;
    setRequesting(coachId);
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
  const acceptingCount = coaches.filter((coach) => coachAvailabilities.get(coach.id)?.isAccepting !== false).length;
  const totalClients = coaches.reduce((sum, coach) => sum + coach.clientCount, 0);

  const specialtyOptions = useMemo(() => {
    const values = new Set<string>();
    coaches.forEach((coach) => {
      coach.specialties.forEach((specialty) => {
        if (specialty) values.add(specialty);
      });
      coach.goalTypes.forEach((goal) => {
        if (goal) values.add(goal.replace(/_/g, " "));
      });
    });

    if (values.size === 0) {
      specialtyFallbacks.forEach((item) => values.add(item));
    }

    return ["All", ...Array.from(values).slice(0, 6)];
  }, [coaches]);

  const filteredCoaches = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return coaches.filter((coach) => {
      const specialtyText = [...coach.specialties, ...coach.goalTypes.map((goal) => goal.replace(/_/g, " "))].join(" ").toLowerCase();
      const matchesQuery = !query
        || coach.full_name.toLowerCase().includes(query)
        || (coach.bio || "").toLowerCase().includes(query)
        || specialtyText.includes(query);
      const matchesSpecialty = activeSpecialty === "All" || specialtyText.includes(activeSpecialty.toLowerCase());
      return matchesQuery && matchesSpecialty;
    });
  }, [activeSpecialty, coaches, searchQuery]);

  return (
    <div className="min-h-screen bg-[#F7FAF8] pb-28">
      <div className="sticky top-0 z-30 border-b border-emerald-50/90 bg-[#F7FAF8]/95 backdrop-blur-xl">
        <div className="mx-auto max-w-[430px] px-4 pb-3 pt-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-[0_8px_22px_rgba(15,23,42,0.07)] ring-1 ring-slate-100"
              aria-label="Back"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-emerald-600">Nutrio coaching</p>
              <h1 className="text-[24px] font-black leading-tight text-slate-950">Find a Coach</h1>
            </div>
            <button
              onClick={() => navigate("/become-coach")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-[0_12px_24px_rgba(16,185,129,0.2)]"
              aria-label="Become a coach"
            >
              <UserPlus className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[430px] px-4 py-4">
        <section className="overflow-hidden rounded-[32px] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-emerald-100">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700 ring-1 ring-emerald-100">
                <Sparkles className="h-3.5 w-3.5" />
                Human support
              </div>
              <h2 className="mt-3 text-[27px] font-black leading-tight tracking-[-0.03em] text-slate-950">
                Match with nutrition guidance that fits your routine.
              </h2>
              <p className="mt-2 text-[13px] font-semibold leading-6 text-slate-500">
                Compare verified coaches, request a connection, and start with programs built around your goals.
              </p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-amber-50 text-amber-600 ring-1 ring-amber-100">
              <Award className="h-6 w-6" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-2xl bg-emerald-50 p-3 ring-1 ring-emerald-100">
              <p className="text-[20px] font-black leading-none text-slate-950">{coaches.length}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700">coaches</p>
            </div>
            <div className="rounded-2xl bg-sky-50 p-3 ring-1 ring-sky-100">
              <p className="text-[20px] font-black leading-none text-slate-950">{acceptingCount}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-sky-700">accepting</p>
            </div>
            <div className="rounded-2xl bg-orange-50 p-3 ring-1 ring-orange-100">
              <p className="text-[20px] font-black leading-none text-slate-950">{totalClients}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-orange-700">clients</p>
            </div>
          </div>
        </section>

        {hasCoach && myCoachProfile && (
          <section className="mt-4 rounded-[30px] bg-emerald-50 p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)] ring-1 ring-emerald-100">
            <div className="flex items-start gap-3">
              <CoachAvatar coach={myCoachProfile} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-[16px] font-black text-slate-950">{myCoachProfile.full_name}</h3>
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                </div>
                <p className="mt-0.5 text-[12px] font-black uppercase tracking-[0.12em] text-emerald-700">Your coach</p>
                {myCoachProfile.bio && (
                  <p className="mt-2 line-clamp-2 text-[12px] font-semibold leading-5 text-slate-600">{myCoachProfile.bio}</p>
                )}
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => navigate("/coach-programs")}
                className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-emerald-600 px-3 text-[13px] font-black text-white shadow-[0_12px_24px_rgba(16,185,129,0.18)] active:scale-[0.98]"
              >
                <TrendingUp className="h-4 w-4" />
                Programs
              </button>
              <button
                onClick={() => navigate("/profile")}
                className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-3 text-[13px] font-black text-emerald-700 ring-1 ring-emerald-200 active:scale-[0.98]"
              >
                <MessageCircle className="h-4 w-4" />
                Manage
              </button>
            </div>
          </section>
        )}

        <section className="mt-4 rounded-[28px] bg-white p-3 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
          <div className="flex min-h-12 items-center gap-2 rounded-[22px] bg-slate-50 px-3 ring-1 ring-slate-100">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search coach, goal, or specialty"
              className="min-w-0 flex-1 bg-transparent text-[14px] font-bold text-slate-800 outline-none placeholder:text-slate-400"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-400" aria-label="Clear search">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {specialtyOptions.map((specialty) => (
              <button
                key={specialty}
                onClick={() => setActiveSpecialty(specialty)}
                className={cn(
                  "min-h-10 shrink-0 rounded-full px-4 text-[12px] font-black transition-all",
                  activeSpecialty === specialty
                    ? "bg-emerald-600 text-white shadow-[0_10px_20px_rgba(16,185,129,0.16)]"
                    : "bg-slate-50 text-slate-600 ring-1 ring-slate-100"
                )}
              >
                {specialty}
              </button>
            ))}
          </div>
        </section>

        <div className="mt-5 flex items-center justify-between">
          <div>
            <h2 className="text-[18px] font-black text-slate-950">Available coaches</h2>
            <p className="text-[12px] font-semibold text-slate-500">
              {loading ? "Loading matches" : `${filteredCoaches.length} of ${coaches.length} shown`}
            </p>
          </div>
          {hasCoach && (
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-700 ring-1 ring-emerald-100">
              Connected
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          </div>
        ) : coaches.length === 0 ? (
          <div className="mt-4">
            <EmptyState onApply={() => navigate("/become-coach")} />
          </div>
        ) : filteredCoaches.length === 0 ? (
          <div className="mt-4 rounded-[28px] bg-white p-7 text-center shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100">
            <Search className="mx-auto h-6 w-6 text-slate-300" />
            <h3 className="mt-3 text-base font-black text-slate-950">No matches found</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">Try another specialty or clear the search.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {filteredCoaches.map((coach, index) => {
              const isConnected = myCoach === coach.id;
              const isPending = pendingRequests.has(coach.id);
              const availability = coachAvailabilities.get(coach.id);
              const coachTags = [
                ...coach.specialties,
                ...coach.goalTypes.map((goal) => goal.replace(/_/g, " ")),
              ].filter(Boolean).slice(0, 3);

              return (
                <motion.article
                  key={coach.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04, type: "spring", stiffness: 260, damping: 26 }}
                  className="overflow-hidden rounded-[30px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100"
                >
                  <div className="flex items-start gap-3">
                    <CoachAvatar coach={coach} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-[16px] font-black text-slate-950">{coach.full_name}</h3>
                        {coach.verified && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] font-black text-amber-700 ring-1 ring-amber-100">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {coach.rating > 0 ? coach.rating : "New"}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-[11px] font-black text-slate-600 ring-1 ring-slate-100">
                          <Users className="h-3.5 w-3.5" />
                          {coach.clientCount} client{coach.clientCount !== 1 ? "s" : ""}
                        </span>
                        {availability && (
                          <span className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black ring-1",
                            availability.isAccepting
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
                              : "bg-slate-50 text-slate-500 ring-slate-100"
                          )}>
                            <Clock className="h-3.5 w-3.5" />
                            {availability.isAccepting ? "Accepting" : "Unavailable"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {coach.bio && (
                    <p className="mt-3 line-clamp-2 text-[13px] font-semibold leading-6 text-slate-500">{coach.bio}</p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {(coachTags.length > 0 ? coachTags : specialtyFallbacks.slice(0, 2)).map((tag) => (
                      <span key={tag} className="rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-black capitalize text-emerald-700 ring-1 ring-emerald-100">
                        {tag}
                      </span>
                    ))}
                    {availability?.clientRange && (
                      <span className="rounded-full bg-sky-50 px-3 py-1.5 text-[11px] font-black text-sky-700 ring-1 ring-sky-100">
                        {availability.clientRange} active clients
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => !isConnected && !isPending && handleRequestCoach(coach.id)}
                    disabled={requesting === coach.id || isConnected || isPending}
                    className={cn(
                      "mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-[14px] font-black transition-all active:scale-[0.98] disabled:cursor-not-allowed",
                      isConnected
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                        : isPending
                          ? "bg-amber-50 text-amber-700 ring-1 ring-amber-100"
                          : "bg-emerald-600 text-white shadow-[0_12px_24px_rgba(16,185,129,0.18)]"
                    )}
                  >
                    {requesting === coach.id ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : isConnected ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Connected
                      </>
                    ) : isPending ? (
                      <>
                        <Clock className="h-4 w-4" />
                        {t("pending_status")}
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" />
                        Request coach
                      </>
                    )}
                  </button>
                </motion.article>
              );
            })}
          </div>
        )}

        <section className="mt-6 rounded-[30px] bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-emerald-100">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
              <UserPlus className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-black text-slate-950">Are you a nutrition professional?</h3>
              <p className="mt-1 text-[12px] font-semibold leading-5 text-slate-500">
                Apply to guide Nutrio clients with coaching, accountability, and meal planning.
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate("/become-coach")}
            className="mt-4 flex min-h-12 w-full items-center justify-center rounded-full bg-emerald-600 text-[14px] font-black text-white shadow-[0_12px_24px_rgba(16,185,129,0.18)] active:scale-[0.98]"
          >
            Become a Coach
          </button>
        </section>
      </main>
    </div>
  );
}
