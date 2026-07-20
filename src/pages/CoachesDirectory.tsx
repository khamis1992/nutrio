import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Award,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Loader2,
  Search,
  Sparkles,
  Star,
  UserPlus,
  Users,
  X,
} from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  getParticipantCareAssignments,
  listVerifiedCareProfessionals,
  requestCareProfessional,
  type CareAssignmentType,
  type CareConsentScope,
  type CareProfessionalType,
} from "@/hooks/useCareTeam";
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
  professionalType: CareProfessionalType;
  displayTitle: string;
  scopeStatement: string;
  acceptingClients: boolean;
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
    <div className={cn("shrink-0 overflow-hidden rounded-[18px] bg-[#F6F8FB] ring-1 ring-[#E5EAF1]", sizeClass)}>
      {coach.avatar_url ? (
        <img src={coach.avatar_url} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xl font-black text-[#020617]">
          {(coach.full_name || "C")[0].toUpperCase()}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onApply }: { onApply: () => void }) {
  return (
    <div className="rounded-[28px] bg-white p-8 text-center shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#F6F8FB] text-[#020617]">
        <Users className="h-8 w-8" />
      </div>
      <h3 className="mt-5 text-lg font-black text-[#020617]">No coaches yet</h3>
      <p className="mt-2 text-sm font-semibold leading-6 text-[#94A3B8]">
        Coaches will appear here once they join the platform.
      </p>
      <button
        onClick={onApply}
        className="mt-5 min-h-11 rounded-full bg-[#020617] px-5 text-sm font-black text-white shadow-[0_12px_24px_rgba(2,6,23,0.16)] active:scale-[0.98]"
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
  const [activeConnections, setActiveConnections] = useState<Set<string>>(new Set());
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
      const [professionals, myAssignments] = await Promise.all([
        listVerifiedCareProfessionals(),
        getParticipantCareAssignments({ clientId: user.id, statuses: ["pending", "active"] }),
      ]);
      const myActive = new Set(myAssignments.filter((item) => item.status === "active").map((item) => item.coach_id));
      const myPending = new Set(myAssignments.filter((item) => item.status === "pending").map((item) => item.coach_id));
      const sorted: CoachProfile[] = professionals
        .filter((professional) => professional.professional_id !== user.id)
        .map((professional) => ({
          id: professional.professional_id,
          full_name: professional.full_name || professional.display_title,
          avatar_url: professional.avatar_url,
          bio: professional.bio,
          specialties: professional.specialties || [],
          clientCount: professional.client_count,
          rating: professional.average_rating,
          verified: true,
          goalTypes: [],
          professionalType: professional.professional_type,
          displayTitle: professional.display_title,
          scopeStatement: professional.scope_statement,
          acceptingClients: professional.accepting_clients,
        }))
        .sort((a, b) => Number(b.acceptingClients) - Number(a.acceptingClients) || b.rating - a.rating);

      setCoaches(sorted);
      setActiveConnections(myActive);
      setPendingRequests(myPending);
      setCoachAvailabilities(new Map(sorted.map((coach) => [coach.id, {
        isAccepting: coach.acceptingClients,
        clientRange: coach.clientCount <= 5 ? "1-5" : coach.clientCount <= 10 ? "5-10" : "10+",
        responseLabel: null,
      }])));
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
    try {
      if (pendingRequests.size > 0) {
        sessionStorage.setItem("coach_pending_requests", JSON.stringify([...pendingRequests]));
      } else {
        sessionStorage.removeItem("coach_pending_requests");
      }
    } catch {
      // sessionStorage can be unavailable in private contexts.
    }
  }, [pendingRequests]);

  const handleRequestCoach = async (coach: CoachProfile) => {
    if (!user) return;
    const coachId = coach.id;

    setRequesting(coachId);
    setPendingRequests((prev) => {
      const next = new Set(prev);
      next.add(coachId);
      return next;
    });
    try {
      const assignmentType: CareAssignmentType = coach.professionalType === "dietitian"
        ? "nutrition_guidance"
        : coach.professionalType === "fitness_coach"
          ? "fitness_coaching"
          : "integrated_care";
      const consentScopes: CareConsentScope[] = assignmentType === "nutrition_guidance"
        ? ["macros", "weight", "hydration", "meal_adherence", "messages"]
        : assignmentType === "fitness_coaching"
          ? ["weight", "workouts", "messages"]
          : ["macros", "weight", "hydration", "meal_adherence", "workouts", "messages"];
      await requestCareProfessional({ professionalId: coachId, assignmentType, consentScopes });

      toast({
        title: "Request sent!",
        description: "Your coach will review and accept your request.",
      });
      setPendingRequests((current) => new Set(current).add(coachId));
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

  const hasCoach = activeConnections.size > 0;
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
    <div className="min-h-screen bg-[#F6F8FB] pb-28">
      <div className="sticky top-0 z-30 border-b border-[#E5EAF1] bg-[#F6F8FB]/95 backdrop-blur-xl">
        <div className="mx-auto max-w-[430px] px-4 pb-3 pt-4">
          <div className="flex items-center gap-3">
            <button
              data-testid="coaches-back-btn"
              onClick={() => navigate(-1)}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#020617] shadow-[0_8px_22px_rgba(15,23,42,0.07)] ring-1 ring-[#E5EAF1]"
              aria-label="Back"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#94A3B8]">Nutrio coaching</p>
              <h1 className="text-[24px] font-black leading-tight text-[#020617]">Find a Coach</h1>
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-[430px] px-4 py-4">
        <section className="overflow-hidden rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#F6F8FB] px-3 py-1 text-[11px] font-black text-[#020617] ring-1 ring-[#E5EAF1]">
                <Sparkles className="h-3.5 w-3.5" />
                Human support
              </div>
              <h2 className="mt-3 text-[27px] font-black leading-tight tracking-[-0.03em] text-[#020617]">
                Match with nutrition guidance that fits your routine.
              </h2>
              <p className="mt-2 text-[13px] font-semibold leading-6 text-[#94A3B8]">
                Compare verified coaches, request a connection, and start with programs built around your goals.
              </p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-[#FFF7ED] text-[#F97316] ring-1 ring-[#F97316]/20">
              <Award className="h-6 w-6" />
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="flex min-h-[66px] flex-col items-center justify-center rounded-[18px] bg-[#F6F8FB] p-3 text-center ring-1 ring-[#E5EAF1]">
              <p className="text-[20px] font-black leading-none text-[#020617]">{coaches.length}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[#64748B]">coaches</p>
            </div>
            <div className="flex min-h-[66px] flex-col items-center justify-center rounded-[18px] bg-[#EFF9FF] p-3 text-center ring-1 ring-[#38BDF8]/20">
              <p className="text-[20px] font-black leading-none text-[#020617]">{acceptingCount}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[#38BDF8]">accepting</p>
            </div>
            <div className="flex min-h-[66px] flex-col items-center justify-center rounded-[18px] bg-[#FFF7ED] p-3 text-center ring-1 ring-[#F97316]/20">
              <p className="text-[20px] font-black leading-none text-[#020617]">{totalClients}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-[#F97316]">clients</p>
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-[28px] bg-white p-3 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="flex min-h-12 items-center gap-2 rounded-[22px] bg-[#F6F8FB] px-3 ring-1 ring-[#E5EAF1]">
            <Search className="h-4 w-4 shrink-0 text-[#94A3B8]" />
            <input
              data-testid="coaches-search-input"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search coach, goal, or specialty"
              className="min-w-0 flex-1 bg-transparent text-[14px] font-bold text-[#020617] outline-none placeholder:text-[#94A3B8]"
            />
            {searchQuery && (
              <button data-testid="coaches-search-clear" onClick={() => setSearchQuery("")} className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#94A3B8]" aria-label="Clear search">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {specialtyOptions.map((specialty) => (
              <button
                key={specialty}
                data-testid={`coaches-specialty-${specialty.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={() => setActiveSpecialty(specialty)}
                className={cn(
                  "min-h-10 shrink-0 rounded-full px-4 text-[12px] font-black transition-all",
                  activeSpecialty === specialty
                    ? "bg-[#020617] text-white shadow-[0_10px_20px_rgba(2,6,23,0.16)]"
                    : "bg-[#F6F8FB] text-[#64748B] ring-1 ring-[#E5EAF1]"
                )}
              >
                {specialty}
              </button>
            ))}
          </div>
        </section>

        <div className="mt-5 flex items-center justify-between">
          <div>
            <h2 className="text-[18px] font-black text-[#020617]">Available coaches</h2>
            <p className="text-[12px] font-semibold text-[#94A3B8]">
              {loading ? "Loading matches" : `${filteredCoaches.length} of ${coaches.length} shown`}
            </p>
          </div>
          {hasCoach && (
            <span className="rounded-full bg-[#F6F8FB] px-3 py-1.5 text-[11px] font-black text-[#020617] ring-1 ring-[#E5EAF1]">
              Connected
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#020617]" />
          </div>
        ) : coaches.length === 0 ? (
          <div className="mt-4">
            <EmptyState onApply={() => navigate("/become-coach")} />
          </div>
        ) : filteredCoaches.length === 0 ? (
          <div className="mt-4 rounded-[28px] bg-white p-7 text-center shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
            <Search className="mx-auto h-6 w-6 text-[#94A3B8]" />
            <h3 className="mt-3 text-base font-black text-[#020617]">No matches found</h3>
            <p className="mt-1 text-sm font-semibold text-[#94A3B8]">Try another specialty or clear the search.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {filteredCoaches.map((coach, index) => {
              const isConnected = activeConnections.has(coach.id);
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
                  className="overflow-hidden rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]"
                >
                  <div className="flex items-start gap-3">
                    <CoachAvatar coach={coach} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-[16px] font-black text-[#020617]">{coach.full_name}</h3>
                        {coach.verified && <CheckCircle2 className="h-4 w-4 shrink-0 text-[#020617]" />}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#FFF7ED] px-2 py-1 text-[11px] font-black text-[#F97316] ring-1 ring-[#F97316]/20">
                          <Star className="h-3.5 w-3.5 fill-[#F97316] text-[#F97316]" />
                          {coach.rating > 0 ? coach.rating : "New"}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#F6F8FB] px-2 py-1 text-[11px] font-black text-[#64748B] ring-1 ring-[#E5EAF1]">
                          <Users className="h-3.5 w-3.5" />
                          {coach.clientCount} client{coach.clientCount !== 1 ? "s" : ""}
                        </span>
                        {availability && (
                          <span className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black ring-1",
                            availability.isAccepting
                              ? "bg-[#F6F8FB] text-[#020617] ring-[#E5EAF1]"
                              : "bg-[#F6F8FB] text-[#94A3B8] ring-[#E5EAF1]"
                          )}>
                            <Clock className="h-3.5 w-3.5" />
                            {availability.isAccepting ? "Accepting" : "Unavailable"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {coach.bio && (
                    <p className="mt-3 line-clamp-2 text-[13px] font-semibold leading-6 text-[#94A3B8]">{coach.bio}</p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {(coachTags.length > 0 ? coachTags : specialtyFallbacks.slice(0, 2)).map((tag) => (
                      <span key={tag} className="rounded-full bg-[#F6F8FB] px-3 py-1.5 text-[11px] font-black capitalize text-[#020617] ring-1 ring-[#E5EAF1]">
                        {tag}
                      </span>
                    ))}
                    {availability?.clientRange && (
                      <span className="rounded-full bg-[#EFF9FF] px-3 py-1.5 text-[11px] font-black text-[#38BDF8] ring-1 ring-[#38BDF8]/20">
                        {availability.clientRange} active clients
                      </span>
                    )}
                  </div>

                  <button
                    data-testid={`coaches-request-${coach.id}`}
                    onClick={() => !isConnected && !isPending && handleRequestCoach(coach)}
                    disabled={requesting === coach.id || isConnected || isPending}
                    className={cn(
                      "mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full text-[14px] font-black transition-all active:scale-[0.98] disabled:cursor-not-allowed",
                      isConnected
                        ? "bg-[#F6F8FB] text-[#020617] ring-1 ring-[#E5EAF1]"
                        : isPending
                          ? "bg-[#FFF7ED] text-[#F97316] ring-1 ring-[#F97316]/20"
                          : "bg-[#020617] text-white shadow-[0_12px_24px_rgba(2,6,23,0.16)]"
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
                        Add to care team
                      </>
                    )}
                  </button>
                </motion.article>
              );
            })}
          </div>
        )}

        <section className="mt-6 rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-[#E5EAF1]">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-[#F6F8FB] text-[#020617] ring-1 ring-[#E5EAF1]">
              <UserPlus className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-black text-[#020617]">Are you a nutrition professional?</h3>
              <p className="mt-1 text-[12px] font-semibold leading-5 text-[#94A3B8]">
                Apply to guide Nutrio clients with coaching, accountability, and meal planning.
              </p>
            </div>
          </div>
          <button
            data-testid="coaches-become-coach-btn"
            onClick={() => navigate("/become-coach")}
            className="mt-4 flex min-h-12 w-full items-center justify-center rounded-full bg-[#020617] text-[14px] font-black text-white shadow-[0_12px_24px_rgba(2,6,23,0.16)] active:scale-[0.98]"
          >
            Become a Coach
          </button>
        </section>
      </main>
    </div>
  );
}
