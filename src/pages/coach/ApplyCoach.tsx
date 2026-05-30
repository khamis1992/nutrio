import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Send, Loader2, Check, Users, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

const SPECIALTY_OPTIONS = [
  "Weight Loss", "Muscle Gain", "Sports Nutrition", "Plant-Based",
  "Diabetes Management", "Heart Health", "Gut Health", "Meal Planning",
  "Macro Tracking", "Mindful Eating",
];

export default function ApplyCoach() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [bio, setBio] = useState("");
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [qualifications, setQualifications] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [existingApplication, setExistingApplication] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const { data } = await supabase
        .from("coach_applications")
        .select("status")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) setExistingApplication(data.status);
      setChecking(false);
    };
    check();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !bio.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("coach_applications").insert({
        user_id: user.id,
        bio: bio.trim(),
        specialties,
        qualifications: qualifications.trim() || null,
      });

      if (error) throw error;
      setExistingApplication("pending");
      toast({
        title: "Application submitted!",
        description: "We'll review your application and notify you when approved.",
      });
    } catch (err) {
      toast({
        title: "Failed to submit",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSpecialty = (s: string) => {
    setSpecialties((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-20">
      <div className="max-w-[480px] mx-auto px-4 py-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full bg-white border border-gray-100 flex items-center justify-center shrink-0 shadow-sm"
          >
            <ArrowLeft className="h-5 w-5 text-gray-700" />
          </button>
          <div className="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Become a Coach</h1>
            <p className="text-xs text-gray-500">Share your nutrition expertise</p>
          </div>
        </div>

        {existingApplication ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-10 text-center border border-gray-100 shadow-sm"
          >
            <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
              {existingApplication === "approved" ? (
                <Check className="w-8 h-8 text-emerald-500" />
              ) : existingApplication === "rejected" ? (
                <AlertCircle className="w-8 h-8 text-red-500" />
              ) : (
                <Send className="w-8 h-8 text-violet-500" />
              )}
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {existingApplication === "approved"
                ? "You're approved!"
                : existingApplication === "rejected"
                ? "Application not accepted"
                : "Application submitted"}
            </h3>
            <p className="text-sm text-gray-500">
              {existingApplication === "approved"
                ? "You are now a coach. Sign out and sign in again to access the coach portal."
                : existingApplication === "rejected"
                ? "Your application was not accepted at this time."
                : "We're reviewing your application. You'll be notified when it's processed."}
            </p>
          </motion.div>
        ) : (
          <motion.form
            onSubmit={handleSubmit}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-extrabold text-gray-700">Your Profile</h2>

              <div className="space-y-2">
                <Label htmlFor="bio" className="text-sm font-semibold text-gray-600">
                  Tell us about yourself <span className="text-red-400">*</span>
                </Label>
                <Textarea
                  id="bio"
                  placeholder="Describe your coaching philosophy, experience, and approach to nutrition..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={5}
                  required
                  className="rounded-xl resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-gray-600">
                  Specialties <span className="text-red-400">*</span>
                </Label>
                <div className="flex flex-wrap gap-2">
                  {SPECIALTY_OPTIONS.map((s) => {
                    const active = specialties.includes(s);
                    return (
                      <motion.button
                        key={s}
                        type="button"
                        whileTap={{ scale: 0.96 }}
                        onClick={() => toggleSpecialty(s)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                          active
                            ? "bg-violet-100 border-violet-300 text-violet-700"
                            : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100"
                        }`}
                      >
                        {s}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="qualifications" className="text-sm font-semibold text-gray-600">
                  Qualifications (optional)
                </Label>
                <Input
                  id="qualifications"
                  placeholder="e.g. Certified Nutrition Coach, NASM-CNC, Precision Nutrition L1"
                  value={qualifications}
                  onChange={(e) => setQualifications(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !bio.trim()}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-bold shadow-lg shadow-violet-600/20 hover:shadow-xl hover:shadow-violet-600/30 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                <>
                  <Send className="w-4 h-4 inline mr-2" />
                  Submit Application
                </>
              )}
            </button>
          </motion.form>
        )}
      </div>
    </div>
  );
}
