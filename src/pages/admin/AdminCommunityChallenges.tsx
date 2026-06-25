import { useEffect, useState } from "react";
import { Calendar, Loader2, Plus, Save, Trophy } from "lucide-react";
import { toast } from "sonner";

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
  start_date: string;
  end_date: string;
  is_active: boolean;
};

const today = new Date().toISOString().slice(0, 10);
const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

const defaultForm: ChallengeForm = {
  title: "",
  description: "",
  challenge_type: "meals",
  category: "nutrition",
  difficulty_level: "easy",
  target_value: 7,
  xp_reward: 100,
  reward_points: 100,
  start_date: today,
  end_date: nextMonth,
  is_active: true,
};

export default function AdminCommunityChallenges() {
  const [challenges, setChallenges] = useState<ChallengeRow[]>([]);
  const [form, setForm] = useState<ChallengeForm>(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchChallenges = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("community_challenges")
        .select("id,title,description,challenge_type,category,difficulty_level,target_value,xp_reward,reward_points,participant_count,start_date,end_date,is_active")
        .order("created_at", { ascending: false });

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

    setChallenges((current) => current.map((item) => (item.id === challenge.id ? { ...item, is_active: !item.is_active } : item)));
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">Community</p>
          <h1 className="text-2xl font-black text-[#020617]">Challenge management</h1>
          <p className="mt-1 text-sm font-semibold text-slate-500">Create challenges that sync with customer meals, water, protein, and streak progress.</p>
        </div>
        <button
          onClick={createChallenge}
          disabled={saving}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-[#020617] px-5 text-sm font-black text-white disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create challenge
        </button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F6F8FB] text-[#020617]">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-[#020617]">New challenge</h2>
              <p className="text-xs font-semibold text-slate-500">Choose a type supported by the app.</p>
            </div>
          </div>

          <div className="space-y-3">
            <input className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm font-bold outline-none focus:border-[#020617]" placeholder="Title" value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} />
            <textarea className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold outline-none focus:border-[#020617]" placeholder="Description" value={form.description} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} />

            <div className="grid grid-cols-2 gap-3">
              <select className="h-11 rounded-2xl border border-slate-200 px-3 text-sm font-bold" value={form.challenge_type} onChange={(e) => setForm((current) => ({ ...current, challenge_type: e.target.value }))}>
                <option value="meals">Meals logged</option>
                <option value="streak">Logging days</option>
                <option value="water">Water goal days</option>
                <option value="protein">Protein target days</option>
              </select>
              <select className="h-11 rounded-2xl border border-slate-200 px-3 text-sm font-bold" value={form.difficulty_level} onChange={(e) => setForm((current) => ({ ...current, difficulty_level: e.target.value }))}>
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
              <input className="h-11 rounded-2xl border border-slate-200 px-3 text-sm font-bold" type="number" min="1" value={form.target_value} onChange={(e) => setForm((current) => ({ ...current, target_value: Number(e.target.value) || 1 }))} />
              <input className="h-11 rounded-2xl border border-slate-200 px-3 text-sm font-bold" type="number" min="0" value={form.xp_reward} onChange={(e) => setForm((current) => ({ ...current, xp_reward: Number(e.target.value) || 0 }))} />
              <input className="h-11 rounded-2xl border border-slate-200 px-3 text-sm font-bold" type="date" value={form.start_date} onChange={(e) => setForm((current) => ({ ...current, start_date: e.target.value }))} />
              <input className="h-11 rounded-2xl border border-slate-200 px-3 text-sm font-bold" type="date" value={form.end_date} onChange={(e) => setForm((current) => ({ ...current, end_date: e.target.value }))} />
            </div>

            <label className="flex items-center justify-between rounded-2xl bg-[#F6F8FB] px-4 py-3 text-sm font-black text-[#020617]">
              Active
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((current) => ({ ...current, is_active: e.target.checked }))} />
            </label>
          </div>
        </div>

        <div className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-slate-100">
          {loading ? (
            <div className="flex min-h-64 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-[#020617]" />
            </div>
          ) : challenges.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center text-center">
              <Trophy className="mb-3 h-9 w-9 text-slate-300" />
              <h3 className="text-lg font-black text-[#020617]">No challenges yet</h3>
              <p className="mt-1 text-sm font-semibold text-slate-500">Create the first community challenge.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {challenges.map((challenge) => (
                <div key={challenge.id} className="rounded-[22px] bg-[#F6F8FB] p-4 ring-1 ring-slate-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-black text-[#020617]">{challenge.title}</h3>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black ${challenge.is_active ? "bg-[#EFFFFA] text-[#22C7A1]" : "bg-slate-100 text-slate-500"}`}>
                          {challenge.is_active ? "Active" : "Paused"}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">{challenge.description}</p>
                    </div>
                    <button onClick={() => toggleChallenge(challenge)} className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#020617] ring-1 ring-slate-200">
                      {challenge.is_active ? "Pause" : "Activate"}
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                    <div className="rounded-2xl bg-white p-3">
                      <p className="text-[10px] font-black uppercase text-slate-400">Type</p>
                      <p className="mt-1 text-sm font-black text-[#020617]">{challenge.challenge_type}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-3">
                      <p className="text-[10px] font-black uppercase text-slate-400">Target</p>
                      <p className="mt-1 text-sm font-black text-[#020617]">{challenge.target_value}</p>
                    </div>
                    <div className="rounded-2xl bg-white p-3">
                      <p className="text-[10px] font-black uppercase text-slate-400">Reward</p>
                      <p className="mt-1 text-sm font-black text-[#020617]">{challenge.xp_reward ?? 0} XP</p>
                    </div>
                    <div className="rounded-2xl bg-white p-3">
                      <p className="text-[10px] font-black uppercase text-slate-400">Joined</p>
                      <p className="mt-1 text-sm font-black text-[#020617]">{challenge.participant_count ?? 0}</p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-500">
                    <Calendar className="h-4 w-4" />
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
  );
}
