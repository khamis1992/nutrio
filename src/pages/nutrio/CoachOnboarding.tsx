import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, CheckCircle2, Pencil } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useClientOnboarding } from "@/hooks/useClientOnboarding";
import { useToast } from "@/hooks/use-toast";

const fadeInUp = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
};

export default function CoachOnboarding() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const coachId = searchParams.get("coachId") || "";
  const clientId = user?.id;
  const { onboarding, loading, submitting, submitOnboarding } = useClientOnboarding(clientId, coachId);

  const [healthGoal, setHealthGoal] = useState("");
  const [currentWeight, setCurrentWeight] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [activityLevel, setActivityLevel] = useState("");
  const [dietaryPreferences, setDietaryPreferences] = useState("");
  const [allergies, setAllergies] = useState("");
  const [medicalConditions, setMedicalConditions] = useState("");
  const [expectations, setExpectations] = useState("");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (onboarding) {
      setHealthGoal(onboarding.health_goal || "");
      setCurrentWeight(onboarding.current_weight_kg?.toString() || "");
      setTargetWeight(onboarding.target_weight_kg?.toString() || "");
      setActivityLevel(onboarding.activity_level || "");
      setDietaryPreferences(onboarding.dietary_preferences || "");
      setAllergies(onboarding.allergies_or_restrictions || "");
      setMedicalConditions(onboarding.medical_conditions || "");
      setExpectations(onboarding.coaching_expectations || "");
    }
  }, [onboarding]);

  const handleSubmit = async () => {
    if (!healthGoal) {
      toast({ title: "Required", description: "Please select a health goal.", variant: "destructive" });
      return;
    }
    if (!currentWeight || isNaN(Number(currentWeight)) || Number(currentWeight) <= 0) {
      toast({ title: "Required", description: "Please enter your current weight.", variant: "destructive" });
      return;
    }
    const result = await submitOnboarding({
      health_goal: healthGoal,
      current_weight_kg: Number(currentWeight) || null,
      target_weight_kg: targetWeight ? Number(targetWeight) : null,
      activity_level: activityLevel || null,
      dietary_preferences: dietaryPreferences || null,
      allergies_or_restrictions: allergies || null,
      medical_conditions: medicalConditions || null,
      coaching_expectations: expectations || null,
    });
    if (result.success) {
      toast({ title: "Shared!", description: "Your health information has been shared with your coach." });
      setEditing(false);
    } else {
      toast({ title: "Failed", description: result.error?.message || "Please try again.", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
      </div>
    );
  }

  const hasSubmitted = !!onboarding && !editing;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-slate-100 px-4 py-3">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div>
            <h1 className="text-[16px] font-extrabold text-slate-950">Share With Your Coach</h1>
            <p className="text-[11px] text-slate-500">Help your coach understand your goals</p>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {hasSubmitted ? (
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="bg-white rounded-[24px] p-8 text-center shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
          >
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-[16px] font-extrabold text-slate-900 mb-2">Information Shared!</h2>
            <p className="text-[12px] text-slate-500 max-w-[280px] mx-auto mb-6">
              Your coach can now see your health goals and preferences. You can update this information anytime.
            </p>
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 h-[40px] px-5 rounded-full bg-slate-100 text-[13px] font-semibold text-slate-700 hover:bg-slate-200 active:scale-95 transition-all"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
          </motion.div>
        ) : (
          <motion.div
            variants={fadeInUp}
            initial="hidden"
            animate="visible"
            className="bg-white rounded-[24px] p-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-100/80"
          >
            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-semibold text-slate-500 mb-1 block">
                  Health Goal <span className="text-red-400">*</span>
                </label>
                <select
                  value={healthGoal}
                  onChange={(e) => setHealthGoal(e.target.value)}
                  className="w-full h-[44px] px-4 rounded-full bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 appearance-none"
                >
                  <option value="">Select your goal...</option>
                  <option value="weight_loss">Weight Loss</option>
                  <option value="muscle_gain">Muscle Gain</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="general_health">General Health</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 mb-1 block">
                    Current Weight (kg) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    value={currentWeight}
                    onChange={(e) => setCurrentWeight(e.target.value)}
                    placeholder="e.g. 85"
                    className="w-full h-[44px] px-4 rounded-full bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Target Weight (kg)</label>
                  <input
                    type="number"
                    value={targetWeight}
                    onChange={(e) => setTargetWeight(e.target.value)}
                    placeholder="e.g. 75"
                    className="w-full h-[44px] px-4 rounded-full bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Activity Level</label>
                <select
                  value={activityLevel}
                  onChange={(e) => setActivityLevel(e.target.value)}
                  className="w-full h-[44px] px-4 rounded-full bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 appearance-none"
                >
                  <option value="">Select activity level...</option>
                  <option value="sedentary">Sedentary (little or no exercise)</option>
                  <option value="light">Light (1-2 days/week)</option>
                  <option value="moderate">Moderate (3-5 days/week)</option>
                  <option value="active">Active (6-7 days/week)</option>
                  <option value="very_active">Very Active (intense daily)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Dietary Preferences</label>
                <select
                  value={dietaryPreferences}
                  onChange={(e) => setDietaryPreferences(e.target.value)}
                  className="w-full h-[44px] px-4 rounded-full bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 appearance-none"
                >
                  <option value="">No preference...</option>
                  <option value="omnivore">Omnivore (eat everything)</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="vegan">Vegan</option>
                  <option value="keto">Keto</option>
                  <option value="paleo">Paleo</option>
                  <option value="mediterranean">Mediterranean</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Allergies or Restrictions</label>
                <textarea
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  placeholder="e.g. nuts, dairy, gluten..."
                  className="w-full h-20 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Medical Conditions</label>
                <textarea
                  value={medicalConditions}
                  onChange={(e) => setMedicalConditions(e.target.value)}
                  placeholder="e.g. diabetes, high blood pressure..."
                  className="w-full h-20 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-500 mb-1 block">Coaching Expectations</label>
                <textarea
                  value={expectations}
                  onChange={(e) => setExpectations(e.target.value)}
                  placeholder="What do you hope to achieve with your coach?"
                  className="w-full h-20 p-3 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full h-[44px] rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[13px] font-bold shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/30 disabled:opacity-50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Share with Coach
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
