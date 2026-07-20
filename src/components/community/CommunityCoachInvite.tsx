import { useCallback, useEffect, useState } from "react";
import { ChevronRight, Users } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  getParticipantCareAssignments,
  listVerifiedCareProfessionals,
} from "@/hooks/useCareTeam";

type CoachPreview = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  specialties: string[] | null;
};

export function CommunityCoachInvite() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [coaches, setCoaches] = useState<CoachPreview[]>([]);
  const [myCoach, setMyCoach] = useState<CoachPreview | null>(null);

  const fetchCoaches = useCallback(async () => {
    if (!user?.id) return;

    const [assignments, professionals] = await Promise.all([
      getParticipantCareAssignments({ clientId: user.id, statuses: ["active"] }),
      listVerifiedCareProfessionals(),
    ]);
    const activeIds = new Set(assignments.map((assignment) => assignment.coach_id));
    if (!professionals.length) {
      setCoaches([]);
      setMyCoach(null);
      return;
    }
    const rows: CoachPreview[] = professionals.map((professional) => ({
      user_id: professional.professional_id,
      full_name: professional.full_name,
      avatar_url: professional.avatar_url,
      specialties: professional.specialties,
    }));
    setCoaches(rows.filter((coach) => !activeIds.has(coach.user_id)).slice(0, 2));
    setMyCoach(rows.find((coach) => activeIds.has(coach.user_id)) ?? null);
  }, [user?.id]);

  useEffect(() => {
    void fetchCoaches();
  }, [fetchCoaches]);

  const previewCoaches = myCoach ? [myCoach, ...coaches].slice(0, 2) : coaches.slice(0, 2);
  const title = myCoach ? t("your_coach") : t("community_need_guidance");
  const subtitle = myCoach?.full_name
    ? `${myCoach.full_name} - ${myCoach.specialties?.[0] ?? t("coach")}`
    : previewCoaches.length
      ? t("community_match_coach")
      : t("community_no_coaches_yet");

  return (
    <motion.div
      whileTap={{ scale: 0.988 }}
      onClick={() => navigate("/coaches")}
      className="mb-5 cursor-pointer overflow-hidden rounded-[28px] bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.06)] ring-1 ring-slate-100"
    >
      <div className="flex items-center gap-4">
        <div className="flex -space-x-3">
          {previewCoaches.length > 0 ? (
            previewCoaches.map((coach) => (
              <div key={coach.user_id} className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[#F6F8FB] text-sm font-black text-[#020617] shadow-sm">
                {coach.avatar_url ? (
                  <img src={coach.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  (coach.full_name || "C")[0].toUpperCase()
                )}
              </div>
            ))
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-[#F6F8FB] text-[#020617] shadow-sm">
              <Users className="h-5 w-5" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-black text-slate-950">{title}</p>
          <p className="mt-1 truncate text-[12px] font-semibold text-slate-500">{subtitle}</p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#020617] text-white shadow-[0_10px_22px_rgba(2,6,23,0.14)]">
          <ChevronRight className="h-5 w-5" />
        </span>
      </div>
    </motion.div>
  );
}
