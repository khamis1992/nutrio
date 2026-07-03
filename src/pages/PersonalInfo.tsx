import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Check,
  Loader2,
  Mail,
  Pencil,
  ShieldCheck,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Gender = "male" | "female" | "prefer_not_to_say";

const FieldPanel = ({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) => (
  <section className="rounded-[26px] border border-[#E2E8F0] bg-white p-4">
    <div className="mb-3 flex items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-[#E9FBF7] text-[#22C7A1]">
        {icon}
      </div>
      <div className="min-w-0">
        <Label className="text-[13px] font-extrabold text-[#020617]">{title}</Label>
        <p className="mt-0.5 line-clamp-1 text-[12px] font-medium text-[#94A3B8]">
          {description}
        </p>
      </div>
    </div>
    {children}
  </section>
);

const GenderOption = ({
  gender,
  selected,
  onClick,
  t,
}: {
  gender: Gender;
  selected: boolean;
  onClick: () => void;
  t: (key: string) => string;
}) => {
  const label = gender === "prefer_not_to_say" ? t("prefer_not_to_say") : t(gender);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "relative flex min-h-[68px] flex-col items-center justify-center gap-2 rounded-[20px] border px-2 text-center transition active:scale-[0.98]",
        selected
          ? "border-[#22C7A1] bg-[#E9FBF7] text-[#047857]"
          : "border-[#E2E8F0] bg-[#F6F8FB] text-[#64748B]"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full",
          selected ? "bg-[#22C7A1] text-white" : "bg-white text-[#94A3B8]"
        )}
      >
        {selected ? <Check className="h-4 w-4" strokeWidth={3} /> : <User className="h-4 w-4" />}
      </div>
      <span className="line-clamp-1 text-[12px] font-extrabold">{label}</span>
    </button>
  );
};

const PersonalInfo = () => {
  const { t, isRTL } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { profile, loading, updateProfile } = useProfile();

  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [age, setAge] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = `${t("personal_info")} - Nutrio`;
  }, [t]);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setGender(profile.gender);
      setAge(profile.age?.toString() || "");
    }
  }, [profile]);

  const initials = useMemo(() => {
    const source = fullName.trim() || user?.email || "N";
    return source
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("");
  }, [fullName, user?.email]);

  const completionCount = [fullName.trim(), gender, age].filter(Boolean).length;
  const completionPercent = Math.round((completionCount / 3) * 100);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await updateProfile({
        full_name: fullName,
        gender,
        age: age ? parseInt(age) : null,
      });

      if (error) throw error;

      toast({
        title: t("settings_saved"),
        description: t("personal_info_saved"),
      });
    } catch {
      toast({
        title: t("preferences_save_failed"),
        description: t("error_saving_profile"),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F6F8FB]">
        <Loader2 className="h-6 w-6 animate-spin text-[#22C7A1]" />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] overflow-y-auto overflow-x-hidden bg-[#F6F8FB] pb-32 pt-safe text-[#020617] [-webkit-overflow-scrolling:touch]">
      <header className="sticky top-0 z-40 border-b border-[#E2E8F0]/70 bg-[#F6F8FB]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#020617] shadow-[0_8px_20px_rgba(2,6,23,0.06)] active:scale-95"
            aria-label={t("go_back")}
          >
            <ArrowLeft className="h-5 w-5 rtl-flip" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#22C7A1]">
              Account
            </p>
            <h1 className="truncate text-[18px] font-extrabold">{t("personal_info")}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-4">
        <section className="rounded-[30px] border border-[#E2E8F0] bg-white p-5 shadow-[0_18px_40px_rgba(2,6,23,0.05)]">
          <div className="flex items-start gap-4">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-[26px] bg-[#22C7A1] text-[24px] font-extrabold text-white shadow-[0_14px_26px_rgba(34,199,161,0.24)]">
              {initials || "N"}
              <span className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full border-4 border-white bg-[#020617] text-white">
                <Pencil className="h-4 w-4" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-2 inline-flex items-center rounded-full bg-[#E9FBF7] px-2.5 py-1 text-[11px] font-extrabold text-[#047857]">
                {completionPercent}% complete
              </div>
              <h2 className="truncate text-[24px] font-extrabold leading-tight text-[#020617]">
                {fullName || t("your_name")}
              </h2>
              <p className="mt-1 line-clamp-2 text-[13px] font-medium leading-relaxed text-[#64748B]">
                {t("personal_info_manage")}
              </p>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#94A3B8]">
              Profile
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#E2E8F0]">
              <div
                className="h-full rounded-full bg-[#22C7A1] transition-all"
                style={{ width: `${completionPercent}%` }}
              />
            </div>
          </div>
        </section>

        <section className="mt-4 rounded-[26px] border border-[#E2E8F0] bg-white px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#7C83F6]">
              <Mail className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#94A3B8]">
                Email
              </p>
              <p className="truncate text-[14px] font-bold text-[#020617]">{user?.email || "-"}</p>
            </div>
            <ShieldCheck className="h-5 w-5 text-[#22C7A1]" />
          </div>
        </section>

        <div className="mt-4 space-y-3" dir={isRTL ? "rtl" : "ltr"}>
          <FieldPanel
            icon={<User className="h-5 w-5" />}
            title={t("full_name")}
            description={t("personal_info_display")}
          >
            <div className="relative">
              <Input
                id="fullName"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder={t("enter_full_name")}
                className="h-14 rounded-[20px] border-[#E2E8F0] bg-[#F6F8FB] px-4 pe-11 text-[15px] font-bold text-[#020617] shadow-none focus-visible:ring-[#22C7A1]/30"
              />
              <User className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
            </div>
          </FieldPanel>

          <FieldPanel
            icon={<ShieldCheck className="h-5 w-5" />}
            title={t("gender")}
            description={t("personal_info_sex")}
          >
            <div className="grid grid-cols-3 gap-2">
              {(["male", "female", "prefer_not_to_say"] as Gender[]).map((item) => (
                <GenderOption
                  key={item}
                  gender={item}
                  selected={gender === item}
                  onClick={() => setGender(item)}
                  t={t}
                />
              ))}
            </div>
          </FieldPanel>

          <FieldPanel
            icon={<Calendar className="h-5 w-5" />}
            title={t("age")}
            description={t("personal_info_age")}
          >
            <div className="relative">
              <Input
                id="age"
                type="number"
                inputMode="numeric"
                value={age}
                onChange={(event) => setAge(event.target.value)}
                placeholder={t("age_default_placeholder")}
                min={13}
                max={120}
                className="h-14 rounded-[20px] border-[#E2E8F0] bg-[#F6F8FB] px-4 pe-20 text-[15px] font-bold text-[#020617] shadow-none focus-visible:ring-[#22C7A1]/30"
              />
              <span className="absolute end-2 top-1/2 -translate-y-1/2 rounded-2xl bg-white px-3 py-1.5 text-[12px] font-bold text-[#64748B] shadow-sm">
                years
              </span>
            </div>
          </FieldPanel>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E2E8F0] bg-white/94 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl">
        <div className="mx-auto max-w-lg">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="h-14 w-full rounded-[22px] bg-[#020617] text-[15px] font-extrabold text-white shadow-[0_16px_30px_rgba(2,6,23,0.18)] hover:bg-[#020617] active:scale-[0.99]"
          >
            {saving ? (
              <>
                <Loader2 className="me-2 h-5 w-5 animate-spin" />
                {t("saving")}
              </>
            ) : (
              <>
                <Check className="me-2 h-5 w-5" />
                {t("save_changes")}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PersonalInfo;
