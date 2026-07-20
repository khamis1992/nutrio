import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Send, Loader2, Check, Users, AlertCircle, BadgeCheck, BriefcaseMedical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  submitCareProfessionalApplication,
  type CareProfessionalType,
} from "@/hooks/useCareTeam";
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
  const [professionalType, setProfessionalType] = useState<CareProfessionalType>("fitness_coach");
  const [licenseAuthority, setLicenseAuthority] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiresOn, setLicenseExpiresOn] = useState("");
  const [requestedScope, setRequestedScope] = useState("");
  const [languages, setLanguages] = useState<string[]>(["en"]);
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
    if (!user || bio.trim().length < 40 || specialties.length === 0) return;
    setSubmitting(true);
    try {
      await submitCareProfessionalApplication({
        professionalType,
        bio: bio.trim(),
        specialties,
        qualifications: qualifications.trim(),
        licenseAuthority: licenseAuthority.trim(),
        licenseNumber: licenseNumber.trim(),
        licenseJurisdiction: "QA",
        licenseExpiresOn,
        requestedScope: requestedScope.trim(),
        languages,
      });
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

  const toggleLanguage = (language: string) => {
    setLanguages((current) => current.includes(language)
      ? current.length === 1 ? current : current.filter((item) => item !== language)
      : [...current, language]);
  };

  const applicationLocked = existingApplication === "pending" || existingApplication === "approved";
  const formComplete = bio.trim().length >= 40
    && specialties.length > 0
    && licenseAuthority.trim().length >= 2
    && licenseNumber.trim().length >= 3
    && Boolean(licenseExpiresOn)
    && requestedScope.trim().length >= 20;

  if (checking) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-4">
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

        {applicationLocked ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[28px] bg-white p-8 text-center shadow-[0_14px_34px_rgba(2,6,23,0.06)] ring-1 ring-[#E5EAF1]"
          >
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#22C7A1]/10 text-[#22C7A1]">
              {existingApplication === "approved" ? (
                <Check className="h-8 w-8" />
              ) : (
                <Send className="h-8 w-8" />
              )}
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {existingApplication === "approved"
                ? "You're approved!"
                : "Application submitted"}
            </h3>
            <p className="text-sm text-gray-500">
              {existingApplication === "approved"
                ? "You are now a coach. Sign out and sign in again to access the coach portal."
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
            {existingApplication && (
              <div className="flex gap-3 rounded-[22px] bg-[#FB6B7A]/10 p-4 text-[#020617] ring-1 ring-[#FB6B7A]/20">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#FB6B7A]" />
                <div>
                  <p className="text-sm font-black">Update your application</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-[#64748B]">
                    Add complete credential and scope information, then resubmit for a new review.
                  </p>
                </div>
              </div>
            )}

            <div className="rounded-[26px] bg-white p-5 shadow-[0_12px_30px_rgba(2,6,23,0.05)] ring-1 ring-[#E5EAF1]">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#7C83F6]/10 text-[#7C83F6]">
                  <BriefcaseMedical className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-sm font-black text-[#020617]">Professional role</h2>
                  <p className="text-xs font-semibold text-[#94A3B8]">Choose the role your credential supports.</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {([
                  ["fitness_coach", "Fitness"],
                  ["dietitian", "Dietitian"],
                  ["wellness_coach", "Wellness"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setProfessionalType(value)}
                    className={`min-h-11 rounded-[14px] px-2 text-xs font-black ring-1 ${
                      professionalType === value
                        ? "bg-[#020617] text-white ring-[#020617]"
                        : "bg-[#F6F8FB] text-[#64748B] ring-[#E5EAF1]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

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
                  minLength={40}
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

            <div className="space-y-4 rounded-[26px] bg-white p-5 shadow-[0_12px_30px_rgba(2,6,23,0.05)] ring-1 ring-[#E5EAF1]">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#22C7A1]/10 text-[#22C7A1]">
                  <BadgeCheck className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-sm font-black text-[#020617]">Credential verification</h2>
                  <p className="text-xs font-semibold text-[#94A3B8]">Qatar credentials are reviewed by an AAL2 administrator.</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="license-authority">License authority</Label>
                  <Input id="license-authority" value={licenseAuthority} onChange={(event) => setLicenseAuthority(event.target.value)} placeholder="e.g. DHP Qatar" className="min-h-11 rounded-[14px]" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="license-number">License number</Label>
                  <Input id="license-number" value={licenseNumber} onChange={(event) => setLicenseNumber(event.target.value)} placeholder="Credential number" className="min-h-11 rounded-[14px]" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="license-expiry">License expiry</Label>
                <Input id="license-expiry" type="date" min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)} value={licenseExpiresOn} onChange={(event) => setLicenseExpiresOn(event.target.value)} className="min-h-11 rounded-[14px]" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="requested-scope">Requested scope of service</Label>
                <Textarea id="requested-scope" value={requestedScope} onChange={(event) => setRequestedScope(event.target.value)} placeholder="Describe what guidance you will provide and where you will refer clients to licensed medical care." minLength={20} rows={4} className="resize-none rounded-[14px]" required />
              </div>
              <div className="space-y-2">
                <Label>Languages</Label>
                <div className="grid grid-cols-2 gap-2">
                  {[["en", "English"], ["ar", "Arabic"]].map(([value, label]) => (
                    <button key={value} type="button" onClick={() => toggleLanguage(value)} className={`min-h-11 rounded-[14px] text-xs font-black ring-1 ${languages.includes(value) ? "bg-[#38BDF8]/10 text-[#0284C7] ring-[#38BDF8]/30" : "bg-[#F6F8FB] text-[#94A3B8] ring-[#E5EAF1]"}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !formComplete}
              className="min-h-12 w-full rounded-[16px] bg-[#020617] text-sm font-black text-white shadow-[0_12px_28px_rgba(2,6,23,0.18)] active:scale-[0.98] disabled:opacity-40"
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
