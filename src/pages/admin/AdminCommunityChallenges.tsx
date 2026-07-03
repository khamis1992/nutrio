import { useEffect, useState } from "react";
import { Calendar, Loader2, Plus, Save, Trophy } from "lucide-react";
import { toast } from "sonner";

import { AdminLayout } from "@/components/AdminLayout";
import { supabase } from "@/integrations/supabase/client";

type ChallengeRow = {
  id: string;
  title: string;
  description: string | null;
  challenge_type: string | null;
  category: string | null;
  difficulty_level: string | null;
  target_value: number;
  xp_reward: number | null;
  reward_points: number | null;
  wallet_reward_amount: number | null;
  participant_count: number | null;
  start_date: string;
  end_date: string;
  is_active: boolean | null;
};

type ChallengeForm = {
  title: string;
  description: string;
  challenge_type: string;
  category: string;
  difficulty_level: string;
  target_value: number;
  xp_reward: number;
  reward_points: number;
  wallet_reward_amount: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
};

type ChallengeTemplate = Omit<
  ChallengeForm,
  "start_date" | "end_date" | "is_active"
> & {
  label: string;
  durationDays: number;
  accent: string;
};

const today = new Date().toISOString().slice(0, 10);
const dateAfterDays = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const nextMonth = dateAfterDays(30);
const tomorrow = dateAfterDays(1);

const defaultForm: ChallengeForm = {
  title: "",
  description: "",
  challenge_type: "meals",
  category: "nutrition",
  difficulty_level: "easy",
  target_value: 7,
  xp_reward: 100,
  reward_points: 100,
  wallet_reward_amount: 0,
  start_date: today,
  end_date: nextMonth,
  is_active: true,
};

const C = {
  text: "#020617",
  muted: "#94A3B8",
  surface: "#F6F8FB",
  water: "#38BDF8",
  danger: "#FB6B7A",
  protein: "#7C83F6",
  progress: "#22C7A1",
  orange: "#F97316",
};

const challengeTemplates: ChallengeTemplate[] = [
  {
    label: "Nutrition",
    title: "Log Every Meal",
    description: "Log breakfast, lunch, and dinner for 5 days this week.",
    challenge_type: "meals",
    category: "nutrition",
    difficulty_level: "medium",
    target_value: 15,
    xp_reward: 200,
    reward_points: 200,
    wallet_reward_amount: 0,
    durationDays: 7,
    accent: C.progress,
  },
  {
    label: "Protein",
    title: "Protein Week",
    description: "Hit your daily protein target on 5 days this week.",
    challenge_type: "protein",
    category: "nutrition",
    difficulty_level: "medium",
    target_value: 5,
    xp_reward: 150,
    reward_points: 150,
    wallet_reward_amount: 0,
    durationDays: 7,
    accent: C.protein,
  },
  {
    label: "Hydration",
    title: "8 Cups Club",
    description: "Reach your water goal on 5 days this week.",
    challenge_type: "water",
    category: "hydration",
    difficulty_level: "easy",
    target_value: 5,
    xp_reward: 150,
    reward_points: 150,
    wallet_reward_amount: 0,
    durationDays: 7,
    accent: C.water,
  },
  {
    label: "Activity",
    title: "Move 3 Days",
    description: "Log any workout or activity session on 3 days this week.",
    challenge_type: "activity",
    category: "activity",
    difficulty_level: "easy",
    target_value: 3,
    xp_reward: 100,
    reward_points: 100,
    wallet_reward_amount: 0,
    durationDays: 7,
    accent: C.orange,
  },
  {
    label: "Coach",
    title: "Follow Coach Plan",
    description: "Complete 5 meals or workout actions assigned by your coach.",
    challenge_type: "coach",
    category: "coaching",
    difficulty_level: "medium",
    target_value: 5,
    xp_reward: 200,
    reward_points: 200,
    wallet_reward_amount: 0,
    durationDays: 14,
    accent: C.protein,
  },
  {
    label: "Referral",
    title: "Invite One Friend",
    description: "Refer one friend who joins Nutrio.",
    challenge_type: "referral",
    category: "growth",
    difficulty_level: "medium",
    target_value: 1,
    xp_reward: 250,
    reward_points: 250,
    wallet_reward_amount: 5,
    durationDays: 30,
    accent: C.progress,
  },
  {
    label: "Subscription",
    title: "First Week Active",
    description:
      "Use 5 meals from your active subscription during the first week.",
    challenge_type: "subscription",
    category: "subscription",
    difficulty_level: "easy",
    target_value: 5,
    xp_reward: 150,
    reward_points: 150,
    wallet_reward_amount: 0,
    durationDays: 7,
    accent: C.danger,
  },
  {
    label: "Streak",
    title: "7-Day Momentum",
    description: "Complete one healthy action every day for 7 straight days.",
    challenge_type: "streak",
    category: "consistency",
    difficulty_level: "hard",
    target_value: 7,
    xp_reward: 250,
    reward_points: 250,
    wallet_reward_amount: 10,
    durationDays: 7,
    accent: C.orange,
  },
];

export default function AdminCommunityChallenges() {
  const [challenges, setChallenges] = useState<ChallengeRow[]>([]);
  const [form, setForm] = useState<ChallengeForm>(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingTest, setCreatingTest] = useState(false);
  const [editingPrizeId, setEditingPrizeId] = useState<string | null>(null);
  const [savingPrizeId, setSavingPrizeId] = useState<string | null>(null);
  const [prizeDraft, setPrizeDraft] = useState({
    xp_reward: 0,
    reward_points: 0,
    wallet_reward_amount: 0,
  });

  const fetchChallenges = async () => {
    setLoading(true);
    try {
      const withWalletReward = await supabase
        .from("community_challenges")
        .select(
          "id,title,description,challenge_type,category,difficulty_level,target_value,xp_reward,reward_points,wallet_reward_amount,participant_count,start_date,end_date,is_active",
        )
        .order("created_at", { ascending: false });

      if (withWalletReward.error && withWalletReward.error.message.includes("wallet_reward_amount")) {
        const fallback = await supabase
          .from("community_challenges")
          .select(
            "id,title,description,challenge_type,category,difficulty_level,target_value,xp_reward,reward_points,participant_count,start_date,end_date,is_active",
          )
          .order("created_at", { ascending: false });

        if (fallback.error) throw fallback.error;
        setChallenges(
          ((fallback.data ?? []) as Omit<ChallengeRow, "wallet_reward_amount">[]).map((challenge) => ({
            ...challenge,
            wallet_reward_amount: 0,
          })),
        );
        return;
      }

      const { data, error } = withWalletReward;
      if (error) throw error;
      setChallenges((data ?? []) as ChallengeRow[]);
    } catch (error) {
      console.error("Error loading community challenges:", error);
      toast.error("Could not load community challenges");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchChallenges();
  }, []);

  const createChallenge = async () => {
    if (!form.title.trim()) {
      toast.error("Challenge title is required");
      return;
    }

    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("community_challenges").insert({
        ...form,
        created_by: userData.user?.id ?? null,
      });

      if (error) throw error;
      toast.success("Challenge created");
      setForm(defaultForm);
      await fetchChallenges();
    } catch (error) {
      console.error("Error creating challenge:", error);
      toast.error("Could not create challenge");
    } finally {
      setSaving(false);
    }
  };

  const toggleChallenge = async (challenge: ChallengeRow) => {
    const { error } = await supabase
      .from("community_challenges")
      .update({ is_active: !challenge.is_active })
      .eq("id", challenge.id);

    if (error) {
      toast.error("Could not update challenge");
      return;
    }

    setChallenges((current) =>
      current.map((item) =>
        item.id === challenge.id
          ? { ...item, is_active: !item.is_active }
          : item,
      ),
    );
  };

  const startPrizeEdit = (challenge: ChallengeRow) => {
    setEditingPrizeId(challenge.id);
    setPrizeDraft({
      xp_reward: challenge.xp_reward ?? 0,
      reward_points: challenge.reward_points ?? 0,
      wallet_reward_amount: challenge.wallet_reward_amount ?? 0,
    });
  };

  const cancelPrizeEdit = () => {
    setEditingPrizeId(null);
    setSavingPrizeId(null);
    setPrizeDraft({ xp_reward: 0, reward_points: 0, wallet_reward_amount: 0 });
  };

  const savePrize = async (challenge: ChallengeRow) => {
    setSavingPrizeId(challenge.id);
    try {
      const nextPrize = {
        xp_reward: Math.max(0, Number(prizeDraft.xp_reward) || 0),
        reward_points: Math.max(0, Number(prizeDraft.reward_points) || 0),
        wallet_reward_amount: Math.max(0, Number(prizeDraft.wallet_reward_amount) || 0),
      };

      const { error } = await supabase
        .from("community_challenges")
        .update(nextPrize)
        .eq("id", challenge.id);

      if (error) throw error;

      setChallenges((current) =>
        current.map((item) =>
          item.id === challenge.id ? { ...item, ...nextPrize } : item,
        ),
      );
      toast.success("Challenge prize updated");
      cancelPrizeEdit();
    } catch (error) {
      console.error("Error updating challenge prize:", error);
      toast.error("Could not update challenge prize");
    } finally {
      setSavingPrizeId(null);
    }
  };

  const applyTemplate = (template: ChallengeTemplate) => {
    setForm({
      title: template.title,
      description: template.description,
      challenge_type: template.challenge_type,
      category: template.category,
      difficulty_level: template.difficulty_level,
      target_value: template.target_value,
      xp_reward: template.xp_reward,
      reward_points: template.reward_points,
      wallet_reward_amount: template.wallet_reward_amount,
      start_date: today,
      end_date: dateAfterDays(template.durationDays),
      is_active: true,
    });
    toast.success(`${template.title} template loaded`);
  };

  const createOneDayTestChallenge = async () => {
    setCreatingTest(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const testChallenge = {
        title: "One-Day Community Test",
        description:
          "Test event for today: log one meal and join the community leaderboard.",
        challenge_type: "meals",
        category: "nutrition",
        difficulty_level: "easy",
        target_value: 1,
        xp_reward: 25,
        reward_points: 25,
        wallet_reward_amount: 5,
        participant_count: 0,
        start_date: today,
        end_date: tomorrow,
        is_active: true,
        created_by: userData.user?.id ?? null,
      };

      const { data: existing, error: findError } = await supabase
        .from("community_challenges")
        .select("id")
        .eq("title", testChallenge.title)
        .maybeSingle();

      if (findError) throw findError;

      const { error } = existing?.id
        ? await supabase
            .from("community_challenges")
            .update(testChallenge)
            .eq("id", existing.id)
        : await supabase.from("community_challenges").insert(testChallenge);

      if (error) throw error;

      toast.success(
        existing?.id
          ? "One-day test challenge refreshed"
          : "One-day test challenge created",
      );
      await fetchChallenges();
    } catch (error) {
      console.error("Error creating one-day test challenge:", error);
      toast.error("Could not create one-day test challenge");
    } finally {
      setCreatingTest(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 bg-[#F6F8FB] p-1 text-[#020617]">
        <div className="overflow-hidden rounded-3xl bg-white shadow-[0_18px_44px_rgba(2,6,23,0.06)] ring-1 ring-slate-100">
          <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-[0_14px_28px_rgba(34,199,161,0.22)]"
                style={{ backgroundColor: C.progress }}
              >
                <Trophy className="h-7 w-7" />
              </div>
              <div>
                <p
                  className="text-xs font-black uppercase tracking-[0.18em]"
                  style={{ color: C.progress }}
                >
                  Community control
                </p>
                <h1
                  className="mt-1 text-3xl font-black tracking-tight"
                  style={{ color: C.text }}
                >
                  Challenge Management
                </h1>
                <p
                  className="mt-2 max-w-2xl text-sm font-medium leading-6"
                  style={{ color: C.muted }}
                >
                  Create and manage community challenges for meals, water,
                  protein targets, and streak progress.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={createOneDayTestChallenge}
                disabled={creatingTest}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#22C7A1] px-5 text-sm font-black text-white shadow-[0_14px_28px_rgba(34,199,161,0.22)] transition hover:opacity-95 disabled:opacity-60"
              >
                {creatingTest ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trophy className="h-4 w-4" />
                )}
                Create 1-day test
              </button>
              <button
                onClick={createChallenge}
                disabled={saving}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-black text-white shadow-[0_14px_28px_rgba(2,6,23,0.16)] transition hover:opacity-95 disabled:opacity-60"
                style={{ backgroundColor: C.text }}
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Create challenge
              </button>
            </div>
          </div>
          <div className="grid border-t border-slate-100 bg-[#F6F8FB]/70 px-6 py-4 text-sm font-semibold sm:grid-cols-3">
            <span style={{ color: C.muted }}>
              Total challenges:{" "}
              <strong className="text-[#020617]">{challenges.length}</strong>
            </span>
            <span style={{ color: C.muted }}>
              Active:{" "}
              <strong className="text-[#020617]">
                {challenges.filter((challenge) => challenge.is_active).length}
              </strong>
            </span>
            <span style={{ color: C.muted }}>
              Participants:{" "}
              <strong className="text-[#020617]">
                {challenges.reduce(
                  (sum, challenge) => sum + (challenge.participant_count ?? 0),
                  0,
                )}
              </strong>
            </span>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[400px_1fr]">
          <div className="rounded-3xl bg-white p-5 shadow-[0_18px_44px_rgba(2,6,23,0.06)] ring-1 ring-slate-100">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#7C83F6]/10 text-[#7C83F6]">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-black text-[#020617]">
                  New challenge
                </h2>
                <p className="text-sm font-medium text-[#94A3B8]">
                  Choose a type supported by the app.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-3xl bg-[#F6F8FB] p-3">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                      Templates
                    </p>
                    <p className="text-sm font-black text-[#020617]">
                      Start from a Nutrio service
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-[#94A3B8]">
                    {challengeTemplates.length}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {challengeTemplates.map((template) => (
                    <button
                      key={template.title}
                      type="button"
                      onClick={() => applyTemplate(template)}
                      className="rounded-2xl bg-white p-3 text-left ring-1 ring-slate-100 transition hover:-translate-y-0.5 hover:shadow-[0_12px_24px_rgba(2,6,23,0.08)]"
                    >
                      <span
                        className="mb-2 inline-flex rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-white"
                        style={{ backgroundColor: template.accent }}
                      >
                        {template.label}
                      </span>
                      <p className="line-clamp-1 text-xs font-black text-[#020617]">
                        {template.title}
                      </p>
                      <p className="mt-1 text-[10px] font-bold text-[#94A3B8]">
                        {template.target_value} target · {template.xp_reward} XP
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <input
                className="h-12 w-full rounded-2xl border-0 bg-[#F6F8FB] px-4 text-sm font-bold text-[#020617] outline-none placeholder:text-[#94A3B8] focus:ring-2 focus:ring-[#22C7A1]/30"
                placeholder="Title"
                value={form.title}
                onChange={(e) =>
                  setForm((current) => ({ ...current, title: e.target.value }))
                }
              />
              <textarea
                className="min-h-28 w-full rounded-2xl border-0 bg-[#F6F8FB] px-4 py-3 text-sm font-semibold text-[#020617] outline-none placeholder:text-[#94A3B8] focus:ring-2 focus:ring-[#22C7A1]/30"
                placeholder="Description"
                value={form.description}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    description: e.target.value,
                  }))
                }
              />

              <div className="grid grid-cols-2 gap-3">
                <select
                  className="h-12 rounded-2xl border-0 bg-[#F6F8FB] px-3 text-sm font-bold text-[#020617] outline-none focus:ring-2 focus:ring-[#22C7A1]/30"
                  value={form.challenge_type}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      challenge_type: e.target.value,
                    }))
                  }
                >
                  <option value="meals">Meals logged</option>
                  <option value="streak">Logging days</option>
                  <option value="water">Water goal days</option>
                  <option value="protein">Protein target days</option>
                  <option value="activity">Activity sessions</option>
                  <option value="coach">Coach plan actions</option>
                  <option value="referral">Referrals</option>
                  <option value="subscription">Subscription usage</option>
                </select>
                <select
                  className="h-12 rounded-2xl border-0 bg-[#F6F8FB] px-3 text-sm font-bold text-[#020617] outline-none focus:ring-2 focus:ring-[#22C7A1]/30"
                  value={form.difficulty_level}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      difficulty_level: e.target.value,
                    }))
                  }
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
                <input
                  className="h-12 rounded-2xl border-0 bg-[#F6F8FB] px-3 text-sm font-bold text-[#020617] outline-none placeholder:text-[#94A3B8] focus:ring-2 focus:ring-[#22C7A1]/30"
                  placeholder="Category"
                  value={form.category}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      category: e.target.value,
                    }))
                  }
                />
                <input
                  className="h-12 rounded-2xl border-0 bg-[#F6F8FB] px-3 text-sm font-bold text-[#020617] outline-none focus:ring-2 focus:ring-[#22C7A1]/30"
                  type="number"
                  min="1"
                  value={form.target_value}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      target_value: Number(e.target.value) || 1,
                    }))
                  }
                />
                <label className="rounded-2xl bg-[#F6F8FB] px-3 py-2 focus-within:ring-2 focus-within:ring-[#22C7A1]/30">
                  <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-[#7C83F6]">
                    XP prize
                  </span>
                  <input
                    className="mt-1 h-7 w-full border-0 bg-transparent text-sm font-black text-[#020617] outline-none"
                    type="number"
                    min="0"
                    value={form.xp_reward}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        xp_reward: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </label>
                <label className="rounded-2xl bg-[#F6F8FB] px-3 py-2 focus-within:ring-2 focus-within:ring-[#22C7A1]/30">
                  <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-[#22C7A1]">
                    Reward points
                  </span>
                  <input
                    className="mt-1 h-7 w-full border-0 bg-transparent text-sm font-black text-[#020617] outline-none"
                    type="number"
                    min="0"
                    value={form.reward_points}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        reward_points: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </label>
                <label className="rounded-2xl bg-[#F6F8FB] px-3 py-2 focus-within:ring-2 focus-within:ring-[#22C7A1]/30">
                  <span className="block text-[10px] font-black uppercase tracking-[0.12em] text-[#FB6B7A]">
                    Wallet credit QAR
                  </span>
                  <input
                    className="mt-1 h-7 w-full border-0 bg-transparent text-sm font-black text-[#020617] outline-none"
                    type="number"
                    min="0"
                    step="0.5"
                    value={form.wallet_reward_amount}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        wallet_reward_amount: Number(e.target.value) || 0,
                      }))
                    }
                  />
                </label>
                <input
                  className="h-12 rounded-2xl border-0 bg-[#F6F8FB] px-3 text-sm font-bold text-[#020617] outline-none focus:ring-2 focus:ring-[#22C7A1]/30"
                  type="date"
                  value={form.start_date}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      start_date: e.target.value,
                    }))
                  }
                />
                <input
                  className="h-12 rounded-2xl border-0 bg-[#F6F8FB] px-3 text-sm font-bold text-[#020617] outline-none focus:ring-2 focus:ring-[#22C7A1]/30"
                  type="date"
                  value={form.end_date}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      end_date: e.target.value,
                    }))
                  }
                />
              </div>

              <label className="flex items-center justify-between rounded-2xl bg-[#F6F8FB] px-4 py-3 text-sm font-black text-[#020617]">
                Active
                <input
                  className="h-4 w-4 accent-[#22C7A1]"
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm((current) => ({
                      ...current,
                      is_active: e.target.checked,
                    }))
                  }
                />
              </label>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5 shadow-[0_18px_44px_rgba(2,6,23,0.06)] ring-1 ring-slate-100">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-[#020617]">
                  Challenges
                </h2>
                <p className="text-sm font-medium text-[#94A3B8]">
                  Live and scheduled community goals.
                </p>
              </div>
              <span className="rounded-full bg-[#7C83F6]/10 px-3 py-1.5 text-xs font-black text-[#7C83F6]">
                {challenges.length} total
              </span>
            </div>

            {loading ? (
              <div className="flex min-h-64 items-center justify-center">
                <Loader2 className="h-7 w-7 animate-spin text-[#22C7A1]" />
              </div>
            ) : challenges.length === 0 ? (
              <div className="flex min-h-64 flex-col items-center justify-center text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F6F8FB]">
                  <Trophy className="h-7 w-7 text-[#94A3B8]" />
                </div>
                <h3 className="text-lg font-black text-[#020617]">
                  No challenges yet
                </h3>
                <p className="mt-1 text-sm font-semibold text-[#94A3B8]">
                  Create the first community challenge.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {challenges.map((challenge) => (
                  <div
                    key={challenge.id}
                    className="rounded-3xl bg-[#F6F8FB] p-4 ring-1 ring-slate-100"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-base font-black text-[#020617]">
                            {challenge.title}
                          </h3>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[10px] font-black ${challenge.is_active ? "bg-[#22C7A1]/10 text-[#22C7A1]" : "bg-white text-[#94A3B8]"}`}
                          >
                            {challenge.is_active ? "Active" : "Paused"}
                          </span>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs font-semibold text-[#94A3B8]">
                          {challenge.description}
                        </p>
                      </div>
                      <button
                        onClick={() => toggleChallenge(challenge)}
                        className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#020617] ring-1 ring-slate-200 transition hover:bg-slate-50"
                      >
                        {challenge.is_active ? "Pause" : "Activate"}
                      </button>
                    </div>

                    <div className="mt-4 rounded-3xl bg-white p-3 ring-1 ring-slate-100">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#94A3B8]">
                            Prize
                          </p>
                          <p className="mt-1 text-sm font-black text-[#020617]">
                            {(challenge.xp_reward ?? 0).toLocaleString()} XP
                            <span className="mx-2 text-[#94A3B8]">+</span>
                            {(challenge.reward_points ?? 0).toLocaleString()} points
                            {(challenge.wallet_reward_amount ?? 0) > 0 && (
                              <>
                                <span className="mx-2 text-[#94A3B8]">+</span>
                                QAR {(challenge.wallet_reward_amount ?? 0).toLocaleString()} wallet
                              </>
                            )}
                          </p>
                        </div>
                        {editingPrizeId === challenge.id ? (
                          <div className="grid gap-2 sm:grid-cols-[90px_100px_120px_auto_auto]">
                            <label className="rounded-2xl bg-[#F6F8FB] px-3 py-2">
                              <span className="block text-[9px] font-black uppercase text-[#7C83F6]">
                                XP
                              </span>
                              <input
                                type="number"
                                min="0"
                                value={prizeDraft.xp_reward}
                                onChange={(event) =>
                                  setPrizeDraft((current) => ({
                                    ...current,
                                    xp_reward: Number(event.target.value) || 0,
                                  }))
                                }
                                className="mt-1 h-7 w-full bg-transparent text-sm font-black text-[#020617] outline-none"
                              />
                            </label>
                            <label className="rounded-2xl bg-[#F6F8FB] px-3 py-2">
                              <span className="block text-[9px] font-black uppercase text-[#22C7A1]">
                                Points
                              </span>
                              <input
                                type="number"
                                min="0"
                                value={prizeDraft.reward_points}
                                onChange={(event) =>
                                  setPrizeDraft((current) => ({
                                    ...current,
                                    reward_points: Number(event.target.value) || 0,
                                  }))
                                }
                                className="mt-1 h-7 w-full bg-transparent text-sm font-black text-[#020617] outline-none"
                              />
                            </label>
                            <label className="rounded-2xl bg-[#F6F8FB] px-3 py-2">
                              <span className="block text-[9px] font-black uppercase text-[#FB6B7A]">
                                Wallet
                              </span>
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={prizeDraft.wallet_reward_amount}
                                onChange={(event) =>
                                  setPrizeDraft((current) => ({
                                    ...current,
                                    wallet_reward_amount: Number(event.target.value) || 0,
                                  }))
                                }
                                className="mt-1 h-7 w-full bg-transparent text-sm font-black text-[#020617] outline-none"
                              />
                            </label>
                            <button
                              type="button"
                              onClick={() => savePrize(challenge)}
                              disabled={savingPrizeId === challenge.id}
                              className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#020617] px-4 text-xs font-black text-white disabled:opacity-60"
                            >
                              {savingPrizeId === challenge.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                "Save"
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={cancelPrizeEdit}
                              className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#F6F8FB] px-4 text-xs font-black text-[#020617] ring-1 ring-slate-100"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startPrizeEdit(challenge)}
                            className="inline-flex h-10 items-center justify-center rounded-full bg-[#020617] px-4 text-xs font-black text-white"
                          >
                            Edit prize
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-6">
                      <div className="rounded-2xl bg-white p-3">
                        <p className="text-[10px] font-black uppercase text-[#94A3B8]">
                          Type
                        </p>
                        <p className="mt-1 text-sm font-black text-[#020617]">
                          {challenge.challenge_type}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white p-3">
                        <p className="text-[10px] font-black uppercase text-[#94A3B8]">
                          Category
                        </p>
                        <p className="mt-1 text-sm font-black text-[#F97316]">
                          {challenge.category ?? "community"}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white p-3">
                        <p className="text-[10px] font-black uppercase text-[#94A3B8]">
                          Target
                        </p>
                        <p className="mt-1 text-sm font-black text-[#38BDF8]">
                          {challenge.target_value}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white p-3">
                        <p className="text-[10px] font-black uppercase text-[#94A3B8]">
                          XP Prize
                        </p>
                        <p className="mt-1 text-sm font-black text-[#7C83F6]">
                          {challenge.xp_reward ?? 0} XP
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white p-3">
                        <p className="text-[10px] font-black uppercase text-[#94A3B8]">
                          Wallet
                        </p>
                        <p className="mt-1 text-sm font-black text-[#FB6B7A]">
                          QAR {challenge.wallet_reward_amount ?? 0}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-white p-3">
                        <p className="text-[10px] font-black uppercase text-[#94A3B8]">
                          Joined
                        </p>
                        <p className="mt-1 text-sm font-black text-[#22C7A1]">
                          {challenge.participant_count ?? 0}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-xs font-bold text-[#94A3B8]">
                      <Calendar className="h-4 w-4 text-[#38BDF8]" />
                      {challenge.start_date} to {challenge.end_date}
                      <Save className="ml-auto h-4 w-4 text-[#22C7A1]" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
