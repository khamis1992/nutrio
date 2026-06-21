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
  Sparkles,
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
  <section className="rounded-[22px] border border-slate-100 bg-white p-4 shadow-[0_14px_34px_rgba(15,23,42,0.05)]">
    <div className="mb-3 flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
        {icon}
      </div>
      <div className="min-w-0">
        <Label className="text-[13px] font-black text-slate-900">{title}</Label>
        <p className="mt-0.5 line-clamp-1 text-[12px] font-medium text-slate-500">
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
        "relative flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-[18px] border px-2 text-center transition active:scale-[0.98]",
        selected
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 shadow-[0_10px_22px_rgba(16,185,129,0.1)]"
          : "border-slate-100 bg-slate-50 text-slate-500"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full",
          selected ? "bg-emerald-500 text-white" : "bg-white text-slate-400"
        )}
      >
        {selected ? <Check className="h-4 w-4" strokeWidth={3} /> : <User className="h-4 w-4" />}
      </div>
      <span className="line-clamp-1 text-[12px] font-black">{label}</span>
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
      <div className="flex min-h-screen items-center justify-center bg-[#F4F7F4]">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7F4] pb-28 pt-safe text-slate-900">
      <header className="sticky top-0 z-40 border-b border-white/70 bg-[#F4F7F4]/88 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 shadow-[0_8px_22px_rgba(15,23,42,0.08)] active:scale-95"
            aria-label={t("go_back")}
          >
            <ArrowLeft className="h-5 w-5 rtl-flip" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-emerald-600">
              Nutrio
            </p>
            <h1 className="truncate text-[18px] font-black">{t("personal_info")}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-4">
        <section className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-700 p-5 text-white shadow-[0_22px_44px_rgba(5,150,105,0.2)]">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-lime-200/20 blur-2xl" />
          <div className="relative flex items-start gap-4">
            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-[26px] border border-white/30 bg-white/18 text-[24px] font-black shadow-[0_14px_28px_rgba(15,23,42,0.18)]">
              {initials || "N"}
              <span className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full border-4 border-emerald-600 bg-white text-emerald-600">
                <Pencil className="h-4 w-4" />
              </span>
            </div>
            <div className="min-w-0 flex-1 pt-1">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-white/13 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.1em] text-emerald-50">
                <Sparkles className="h-3 w-3" />
                {completionPercent}% complete
              </div>
              <h2 className="truncate text-[24px] font-black leading-tight">
                {fullName || t("your_name")}
              </h2>
              <p className="mt-1 line-clamp-2 text-[13px] font-medium leading-relaxed text-white/75">
                {t("personal_info_manage")}
              </p>
            </div>
          </div>

          <div className="relative mt-5 h-2 overflow-hidden rounded-full bg-white/18">
            <div
              className="h-full rounded-full bg-white transition-all"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
        </section>

        <div className="mt-5 space-y-3" dir={isRTL ? "rtl" : "ltr"}>
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
                className="h-14 rounded-2xl border-slate-100 bg-slate-50 px-4 pe-11 text-[15px] font-bold shadow-none focus-visible:ring-emerald-500/30"
              />
              <User className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
                className="h-14 rounded-2xl border-slate-100 bg-slate-50 px-4 pe-20 text-[15px] font-bold shadow-none focus-visible:ring-emerald-500/30"
              />
              <span className="absolute end-2 top-1/2 -translate-y-1/2 rounded-xl bg-white px-3 py-1.5 text-[12px] font-bold text-slate-500 shadow-sm">
                years
              </span>
            </div>
          </FieldPanel>

          <FieldPanel
            icon={<Mail className="h-5 w-5" />}
            title="Email"
            description={t("personal_info_email_privacy")}
          >
            <div className="relative">
              <Input
                value={user?.email || ""}
                readOnly
                className="h-14 cursor-default rounded-2xl border-slate-100 bg-slate-50 px-4 pe-11 text-[15px] font-bold text-slate-500 shadow-none"
              />
              <Mail className="pointer-events-none absolute end-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </FieldPanel>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-100 bg-white/92 px-4 py-3 backdrop-blur-xl">
        <div className="mx-auto max-w-lg">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="h-14 w-full rounded-[20px] bg-emerald-600 text-[15px] font-black text-white shadow-[0_14px_28px_rgba(5,150,105,0.24)] hover:bg-emerald-700 active:scale-[0.99]"
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
