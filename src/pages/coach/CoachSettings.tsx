import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Save, Loader2, Check, User, Shield, LogOut, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import { CoachPricingSection } from "@/components/coach/CoachPricingSection";

const SPECIALTY_OPTIONS = [
  "Weight Loss", "Muscle Gain", "Sports Nutrition", "Plant-Based",
  "Diabetes Management", "Heart Health", "Gut Health", "Meal Planning",
  "Macro Tracking", "Mindful Eating",
];

const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

export default function CoachSettings() {
  const { user } = useAuth();
  const { profile, updateProfile } = useProfile();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bio, setBio] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [customSpecialty, setCustomSpecialty] = useState("");
  const [canViewMacros, setCanViewMacros] = useState(true);
  const [canViewWeight, setCanViewWeight] = useState(true);
  const [canViewAdherence, setCanViewAdherence] = useState(true);
  const [showDangerConfirm, setShowDangerConfirm] = useState(false);

  useEffect(() => {
    if (profile) {
      setBio((profile as any).bio || "");
      setSpecialties((profile as any).specialties || []);
      setLoading(false);
    } else if (profile === null) {
      setLoading(false);
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const result = await updateProfile({ bio, specialties } as any);
      if (result.error) throw result.error;
      toast({ title: "Settings saved", description: "Your coach profile has been updated." });
    } catch {
      toast({ title: "Failed to save", description: "Please try again.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleSpecialty = (s: string) => {
    setSpecialties((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const addCustomSpecialty = () => {
    const val = customSpecialty.trim();
    if (val && !specialties.includes(val)) {
      setSpecialties((prev) => [...prev, val]);
      setCustomSpecialty("");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-[200px] animate-pulse rounded-[24px] bg-slate-100" />
        <div className="h-[160px] animate-pulse rounded-[24px] bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-[16px] font-extrabold tracking-[-0.02em] text-slate-950">Settings</h1>
        <p className="text-[11px] font-medium text-slate-500 mt-0.5">Manage your coach profile</p>
      </div>

      {/* Profile Section */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80 space-y-4"
      >
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-emerald-600" />
          <h2 className="text-[14px] font-extrabold text-slate-800">Coach Profile</h2>
        </div>

        {/* Avatar preview */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              <span className="text-xl font-bold text-emerald-700">
                {(profile?.full_name || "C")[0].toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <p className="text-[14px] font-bold text-slate-900">{profile?.full_name || "Coach"}</p>
            <p className="text-[11px] text-slate-500">Coach</p>
          </div>
        </div>

        {/* Bio */}
        <div className="space-y-2">
          <label className="text-[12px] font-semibold text-slate-600">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell clients about your coaching philosophy..."
            rows={4}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 resize-none bg-slate-50"
          />
        </div>
      </motion.div>

      {/* Specialties */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80 space-y-4"
      >
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          <h2 className="text-[14px] font-extrabold text-slate-800">Specialties</h2>
        </div>

        <div className="flex flex-wrap gap-2">
          {SPECIALTY_OPTIONS.map((s) => {
            const active = specialties.includes(s);
            return (
              <motion.button
                key={s}
                whileTap={{ scale: 0.96 }}
                onClick={() => toggleSpecialty(s)}
                className={cn(
                  "px-3 py-2 rounded-full text-[11px] font-semibold border transition-colors",
                  active
                    ? "bg-emerald-100 border-emerald-300 text-emerald-700"
                    : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100"
                )}
              >
                {active && <Check className="w-3 h-3 inline mr-1" />}
                {s}
              </motion.button>
            );
          })}
          {/* Custom specialties */}
          {specialties.filter((s) => !SPECIALTY_OPTIONS.includes(s)).map((s) => (
            <motion.button
              key={s}
              whileTap={{ scale: 0.96 }}
              onClick={() => toggleSpecialty(s)}
              className="px-3 py-2 rounded-full text-[11px] font-semibold bg-emerald-100 border border-emerald-300 text-emerald-700"
            >
              <Check className="w-3 h-3 inline mr-1" />
              {s}
            </motion.button>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add custom specialty..."
            value={customSpecialty}
            onChange={(e) => setCustomSpecialty(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCustomSpecialty()}
            className="flex-1 h-[38px] rounded-xl border border-slate-200 px-3 text-[12px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50"
          />
          <button
            type="button"
            onClick={addCustomSpecialty}
            disabled={!customSpecialty.trim()}
            className="h-[38px] px-4 rounded-xl bg-emerald-600 text-white text-[12px] font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            Add
          </button>
        </div>
      </motion.div>

      {/* Pricing */}
      <CoachPricingSection />

      {/* Privacy */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80 space-y-1"
      >
        <div className="flex items-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-emerald-600" />
          <h2 className="text-[14px] font-extrabold text-slate-800">Privacy & Permissions</h2>
        </div>

        {[
          { label: "Macro intake", desc: "Clients can share their daily macros", value: canViewMacros, setter: setCanViewMacros },
          { label: "Weight & body metrics", desc: "Clients can share weight and measurements", value: canViewWeight, setter: setCanViewWeight },
          { label: "Meal adherence", desc: "Clients can share meal tracking data", value: canViewAdherence, setter: setCanViewAdherence },
        ].map(({ label, desc, value, setter }) => (
          <div key={label} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
            <div>
              <span className="text-[13px] font-semibold text-slate-700">{label}</span>
              <p className="text-[10px] text-slate-400">{desc}</p>
            </div>
            <button
              onClick={() => setter(!value)}
              className={cn(
                "relative w-[44px] h-[26px] rounded-full transition-colors",
                value ? "bg-emerald-500" : "bg-slate-300"
              )}
            >
              <motion.div
                animate={{ x: value ? 18 : 2 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
                className="absolute top-[3px] w-[20px] h-[20px] rounded-full bg-white shadow-md"
              />
            </button>
          </div>
        ))}
      </motion.div>

      {/* Save Button */}
      <motion.button
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        whileTap={{ scale: 0.98 }}
        onClick={handleSave}
        disabled={saving}
        className="w-full h-[48px] rounded-[16px] bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[14px] font-bold shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saving ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <Save className="w-4 h-4" />
            Save Settings
          </>
        )}
      </motion.button>

      {/* Danger Zone */}
      <motion.div
        variants={fadeInUp}
        initial="hidden"
        animate="visible"
        className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80 space-y-3"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <h2 className="text-[14px] font-extrabold text-slate-800">Danger Zone</h2>
        </div>

        {!showDangerConfirm ? (
          <button
            onClick={() => setShowDangerConfirm(true)}
            className="w-full h-[44px] rounded-[16px] border border-red-200 bg-red-50 text-[13px] font-bold text-red-600 hover:bg-red-100 transition-colors"
          >
            Stop Coaching
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-[12px] text-red-600 font-medium text-center">
              This will remove your coach role. Your clients will lose access to your coaching. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDangerConfirm(false)}
                className="flex-1 h-[44px] rounded-[16px] bg-slate-100 text-[13px] font-bold text-slate-600 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!user) return;
                  await supabase.from("user_roles").delete().eq("user_id", user.id).eq("role", "coach");
                  await supabase.from("coach_client_assignments").update({ status: "revoked" }).eq("coach_id", user.id);
                  await supabase.auth.signOut();
                  window.location.href = "/nutrio/auth";
                }}
                className="flex-1 h-[44px] rounded-[16px] bg-red-600 text-white text-[13px] font-bold hover:bg-red-700 transition-colors"
              >
                <LogOut className="w-4 h-4 inline mr-1" />
                Stop Coaching
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Bottom spacer for tab bar */}
      <div className="h-4" />
    </div>
  );
}
